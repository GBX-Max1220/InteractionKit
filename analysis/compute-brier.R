#!/usr/bin/env Rscript
# InteractionKit — Brier Score & Trust Calibration Analysis
# BRIER_FORMULA_v1: (probability_prediction - answer_accurate)^2
# TRUST_CLASS_v1:   overtrust  = decision == "trust"   & answer_accurate == FALSE
#                   undertrust = decision == "distrust" & answer_accurate == TRUE
#
# Usage: Rscript compute-brier.R <participant.csv> <scenarios.json>
#
# Output: analysis results to stdout, optional CSV with derived metrics

suppressPackageStartupMessages({
  library(jsonlite)
  library(lmerTest)    # p-values for mixed models
  library(lme4)        # glmer for binary outcomes
})

# ─── Config ──────────────────────────────────────────────
MIN_SCENARIOS <- 6        # minimum completed scenarios
MIN_TIME_SEC <- 20        # minimum total completion time (bot filter)
ATTENTION_CHECK_ID <- "attention-check"  # scenario ID for attention check

# ─── CLI ─────────────────────────────────────────────────
args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2) {
  stop("Usage: Rscript compute-brier.R <participant.csv> <scenarios.json>")
}

# ─── Read data ────────────────────────────────────────────
participants <- read.csv(args[1], stringsAsFactors = FALSE, na.strings = c("NA", ""))
scenarios_raw <- fromJSON(args[2])

# ─── Build scenario lookup ────────────────────────────────
scenario_lookup <- list()
for (s in scenarios_raw$scenarios) {
  id <- s$id
  # Convert JSON boolean to R logical robustly
  acc <- s$answerAccurate
  if (is.logical(acc)) {
    scenario_lookup[[id]] <- acc
  } else if (is.character(acc)) {
    scenario_lookup[[id]] <- as.logical(tolower(acc))
    if (is.na(scenario_lookup[[id]])) {
      warning(sprintf("Ambiguous answerAccurate value '%s' for scenario '%s'", acc, id))
      scenario_lookup[[id]] <- FALSE
    }
  } else if (is.numeric(acc)) {
    scenario_lookup[[id]] <- as.logical(acc)
  } else {
    warning(sprintf("Unexpected type for answerAccurate in scenario '%s'", id))
    scenario_lookup[[id]] <- FALSE
  }
}

# ─── Preprocessing ───────────────────────────────────────

# 1. Filter to decision events
decisions <- participants[participants$event_type == "decision", ]

# 2. Apply exclusion criteria

# 2a. Attention check: DISABLED — no attention check scenario in current scenario set.
# Re-enable by adding an attention-check scenario to data/scenarios/*.json.

# 2b. Minimum scenarios
trial_counts <- aggregate(scenario_id ~ participant_id, data = decisions, FUN = function(x) length(unique(x)))
colnames(trial_counts) <- c("participant_id", "n_scenarios")
low_trial_participants <- trial_counts$participant_id[trial_counts$n_scenarios < MIN_SCENARIOS]
if (length(low_trial_participants) > 0) {
  message(sprintf("Excluding %d participants with < %d scenarios",
                  length(low_trial_participants), MIN_SCENARIOS))
  decisions <- decisions[!decisions$participant_id %in% low_trial_participants, ]
}

# 2c. Total completion time < 20s (from session_start to session_complete)
session_events <- participants[participants$event_type %in% c("session_start", "session_complete"), ]
if (nrow(session_events) > 0) {
  session_times <- aggregate(timestamp ~ participant_id, data = session_events,
                             FUN = function(x) {
                               times <- sort(as.POSIXct(x, format = "%Y-%m-%dT%H:%M:%OSZ", tz = "UTC"))
                               if (length(times) >= 2) difftime(times[length(times)], times[1], units = "secs")
                               else NA
                             })
  colnames(session_times) <- c("participant_id", "total_time_sec")
  bot_participants <- session_times$participant_id[
    !is.na(session_times$total_time_sec) & session_times$total_time_sec < MIN_TIME_SEC
  ]
  if (length(bot_participants) > 0) {
    message(sprintf("Excluding %d participants with total time < %ds",
                    length(bot_participants), MIN_TIME_SEC))
    decisions <- decisions[!decisions$participant_id %in% bot_participants, ]
  }
}

if (nrow(decisions) == 0) {
  stop("No valid decision events after exclusion criteria")
}

# ─── Scenario join ───────────────────────────────────────
decisions$answer_accurate <- sapply(decisions$scenario_id, function(id) {
  val <- scenario_lookup[[id]]
  if (is.null(val)) {
    warning(sprintf("Scenario ID '%s' not found in scenarios.json — setting answer_accurate to NA", id))
    return(NA)
  }
  return(val)
})

# Validate join — no silent failures
unmatched <- decisions$scenario_id[!decisions$scenario_id %in% names(scenario_lookup)]
if (length(unmatched) > 0) {
  warning(sprintf("Unmatched scenario_ids: %s", paste(unique(unmatched), collapse = ", ")))
}

stopifnot(!anyNA(decisions$answer_accurate))
stopifnot(!anyNA(decisions$probability_prediction))

# ─── Derived metrics ─────────────────────────────────────
decisions$answer_accurate_num <- as.numeric(decisions$answer_accurate)
decisions$brier_score <- (decisions$probability_prediction - decisions$answer_accurate_num)^2

# Over-trust / under-trust (exclude "unsure" from these)
decisions$overtrust <- decisions$decision == "trust"   & !decisions$answer_accurate
decisions$undertrust <- decisions$decision == "distrust" & decisions$answer_accurate

# ─── Unsure rate reporting ──────────────────────────────
cat("\n=== Unsure Rate by Condition ===\n")
decisions$is_unsure <- decisions$decision == "unsure"
unsure_rate <- aggregate(is_unsure ~ condition, data = decisions, FUN = mean)
colnames(unsure_rate) <- c("condition", "unsure_rate")
print(unsure_rate)

# ─── Primary Analysis: Brier Score ───────────────────────
cat("\n=== Brier Score by Condition ===\n")
brier_summary <- aggregate(brier_score ~ condition, data = decisions, FUN = function(x)
  round(c(mean = mean(x), sd = sd(x), n = length(x)), 4))
print(brier_summary)

cat("\n=== Primary Mixed Model: brier ~ condition + (1|participant_id) ===\n")
m1 <- lmer(brier_score ~ condition + familiarity + (1 | participant_id) + (1 | scenario_id), data = decisions)
print(summary(m1))

cat("\n=== Model with answer_accurate covariate: brier ~ condition + answer_accurate + (1|participant_id) ===\n")
m2 <- lmer(brier_score ~ condition + answer_accurate + familiarity + (1 | participant_id) + (1 | scenario_id), data = decisions)
print(summary(m2))

cat("\n=== Sensitivity: brier ~ condition + answer_accurate + scenario_id + (1|participant_id) ===\n")
m3 <- lmer(brier_score ~ condition + answer_accurate + scenario_id + familiarity + (1 | participant_id),
           data = decisions)
print(summary(m3))

# ─── Secondary: Over-trust Rate (GLMM) ──────────────────
cat("\n=== Over-trust Rate by Condition ===\n")
overtrust_data <- decisions[!decisions$is_unsure, ]
overtrust_summary <- aggregate(overtrust ~ condition, data = overtrust_data, FUN = function(x)
  round(c(rate = mean(x), n = length(x)), 4))
print(overtrust_summary)

cat("\n=== GLMM: overtrust ~ condition + (1|participant_id) [binomial] ===\n")
if (length(unique(overtrust_data$condition)) > 1 && var(overtrust_data$overtrust) > 0) {
  m4 <- glmer(overtrust ~ condition + familiarity + (1 | participant_id) + (1 | scenario_id),
              family = binomial, data = overtrust_data)
  print(summary(m4))
} else {
  cat("Insufficient variance for overtrust model\n")
}

# ─── Secondary: Under-trust Rate (GLMM) ─────────────────
cat("\n=== Under-trust Rate by Condition ===\n")
undertrust_data <- decisions[!decisions$is_unsure, ]
undertrust_summary <- aggregate(undertrust ~ condition, data = undertrust_data, FUN = function(x)
  round(c(rate = mean(x), n = length(x)), 4))
print(undertrust_summary)

cat("\n=== GLMM: undertrust ~ condition + (1|participant_id) [binomial] ===\n")
if (length(unique(undertrust_data$condition)) > 1 && var(undertrust_data$undertrust) > 0) {
  m5 <- glmer(undertrust ~ condition + familiarity + (1 | participant_id) + (1 | scenario_id),
              family = binomial, data = undertrust_data)
  print(summary(m5))
} else {
  cat("Insufficient variance for undertrust model\n")
}

# ─── Decision time ───────────────────────────────────────
cat("\n=== Decision Time by Condition ===\n")
time_summary <- aggregate(decision_time_ms ~ condition, data = decisions, FUN = function(x)
  round(c(mean = mean(x, na.rm = TRUE), sd = sd(x, na.rm = TRUE)), 2))
print(time_summary)

cat("\n=== Mixed Model: decision_time_ms ~ condition + (1|participant_id) ===\n")
m6 <- lmer(decision_time_ms ~ condition + familiarity + (1 | participant_id) + (1 | scenario_id), data = decisions)
print(summary(m6))

# ─── Summary stats ───────────────────────────────────────
cat(sprintf("\n\n=== Summary ===\n"))
cat(sprintf("Total participants (after exclusion): %d\n", length(unique(decisions$participant_id))))
cat(sprintf("Total trials: %d\n", nrow(decisions)))
cat(sprintf("Trials per condition: v1 = %d, v2 = %d\n",
            sum(decisions$condition == "v1"), sum(decisions$condition == "v2")))
cat(sprintf("Overall unsure rate: %.2f%%\n", 100 * mean(decisions$is_unsure)))
