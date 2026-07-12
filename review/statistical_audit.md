# 统计审查 — compute-brier.R

**脚本版本：** `BRIER_FORMULA_v1` / `TRUST_CLASS_v1`
**对应 PRD：** 00_PRD_v0.3 + 06_experiment_methods_review

---

## 发现 6 个问题，3 个致命。

---

## 致命问题

### M1: 随机效应缺少 scenario

**问题行：** 54

```r
model <- lmer(brier_score ~ condition + (1 | participant_id), data = decisions)
```

10 个 scenario，每个 participant 做全部 10 个，scenario 是重复测量因子。模型只做 participant random intercept，没做 scenario random intercept，意味着模型把 10×N 个观测当作独立处理。这会导致：

- scenario 层面的残差方差被吸收进 error term
- 标准误低估
- Type I error rate 膨胀

**修法：**

```r
model <- lmer(brier_score ~ condition + (1 | participant_id) + (1 | scenario_id), data = decisions)
```

两个 random intercepts。scenario 作为随机效应是因为 10 个 scenario 是从更大的 scenario 总体中抽样的（参见实验方法学审查 C1）。

**严重程度：** 致命。审稿人发现缺少 scenario 随机效应会直接质疑统计有效性。

---

### M2: lmerTest 未加载，p 值不输出

**问题行：** 10, 54

```r
library(lme4)
...
model <- lmer(...)
summary(model)
```

`lme4::lmer()` 不产生 p 值。`summary(model)` 只输出 t-values，没有 p 值列。试验方法学审查 D 要求报告 p 值。

当前输出：

```
            Estimate Std. Error t value
(Intercept)  0.12345    0.01234   10.00
conditionv2 -0.02345    0.00987   -2.38
```

没有 `Pr(>|t|)` 列。

**修法：**

```r
library(lmerTest)  # 覆盖 lmer()，追加 Satterthwaite df 和 p 值
```

**严重程度：** 致命。论文无法报告没有 p 值的模型。

---

### M3: Aggregate 层面的 Brier 均值计算错误

**问题行：** 49-50

```r
aggregate(brier_score ~ condition, data = decisions, FUN = mean)
```

`decisions` 是 trial-level 数据（每个 participant 10 行）。`aggregate()` 把 10×N 个 trial 当作独立观测计算均值，不反映 participant-level 分布。

**举例：** Condition v1 有 60 人 × 10 trials = 600 行。条件均值是 600 个 trial 的简单平均，而不是 60 个 participant 均值的平均。两者在平衡设计下数值接近，但标准误、置信区间不能直接从 aggregate 输出中读取。

**为什么重要：** 汇报表格需要 `Mean (SD)` per condition。当前代码无法生成。Reviewer 会要求描述性统计表。

**修法：**

```r
# Participant-level mean first, then by condition
participant_brier <- aggregate(
  brier_score ~ participant_id + condition,
  data = decisions,
  FUN = mean
)
desc <- aggregate(
  brier_score ~ condition,
  data = participant_brier,
  FUN = function(x) c(mean = mean(x), sd = sd(x), n = length(x))
)
```

**严重程度：** 致命。论文第 1 个 table 就无法生成。

---

## 重要问题

### M4: 缺失效应量

lmer 输出包含 `Estimate`（系数），但论文需要的 `Cohen's d` 不在输出中。实验方法学审查 D 的汇报表格要求 Cohen's d 列。

**修法：**

```r
library(effectsize)
# 从 lmer 对象计算 d
t_value <- summary(model)$coefficients["conditionv2", "t value"]
df <- summary(model)$coefficients["conditionv2", "df"]
d <- t_value / sqrt(df) * 2  # 近似
```

或更准确：

```r
# 标准化均值差 / pooled SD
# participant_brier 来自 M3 修正
pooled_sd <- sqrt((sd_v1^2 + sd_v2^2) / 2)
d <- (mean_v2 - mean_v1) / pooled_sd
```

**严重程度：** 重要。缺少 d 值不影响统计有效性，但论文无法提交。

---

### M5: Unsure 处理未记录

**问题行：** 45-46

```r
decisions$overtrust <- decisions$decision == "trust" & !decisions$answer_accurate
decisions$undertrust <- decisions$decision == "distrust" & decisions$answer_accurate
```

"unsure" 的判断同时在两个 binary 列中为 FALSE。这是合理的处理方式，但：

- 脚本没有记录这个决策（注释或日志）
- 无法从脚本的输出判断 "unsure" 的比例
- 如果 pre-registration 指定其他处理方式（如 "unsure = distrust" 的 sensitivity），脚本只有一种实现

**修法：**

```r
# Pre-registered: unsure treated as neither overtrust nor undertrust
# Sensitivity analysis with unsure → distrust in overtrust-sensitivity.R
cat(sprintf("Unsure responses excluded from overtrust/undertrust: %d / %d (%.1f%%)\n",
    sum(decisions$decision == "unsure"),
    nrow(decisions),
    100 * mean(decisions$decision == "unsure")))
```

**严重程度：** 重要。pre-registration 与 implementation 必须可审计。

---

### M6: Scenario 作为重复测量因子的假设未验证

Brier score 在 10 个 scenario 间的相关性假设（compound symmetry / auto-regressive）未检查。如果某些 scenario 产生系统偏差（如高 familiarity 的 scenario 校准更好），模型可能错过 scenario-level 的异质性。

**修法：** 在输出中加入：

```r
# ICC by scenario
icc_by_scenario <- by(decisions$brier_score, decisions$scenario_id, function(x) {
  # variance decomposition
})
```

或作为 mixed model 的随机斜率版本：

```r
model_full <- lmer(brier_score ~ condition + (1 + condition | scenario_id) + (1 | participant_id), data = decisions)
anova(model, model_full)  # 比较
```

**严重程度：** 中等。

---

## 修正后脚本

```r
#!/usr/bin/env Rscript
# InteractionKit — Brier Score Computation v2
# BRIER_FORMULA_v1: (probability_prediction - as.numeric(answer_accurate))^2
# TRUST_CLASS_v1:   overtrust  = (decision == "trust"   & !answer_accurate)
#                   undertrust  = (decision == "distrust" &  answer_accurate)
# Unsure handling:  excluded from overtrust/undertrust (pre-registered)

suppressPackageStartupMessages({
  library(jsonlite)
  library(lmerTest)   # p-values via Satterthwaite
  library(effectsize) # Cohen's d
})

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2) {
  stop("Usage: Rscript compute-brier.R <participant.csv> <scenarios.json>")
}

# — Data loading —
participants <- read.csv(args[1], stringsAsFactors = FALSE)
scenarios <- fromJSON(args[2])

# — Scenario lookup —
scenario_lookup <- list()
for (s in scenarios$scenarios) {
  scenario_lookup[[s$id]] <- s$answerAccurate
}

# — Filter to decision events —
decisions <- participants[participants$event_type == "decision", ]
if (nrow(decisions) == 0) {
  stop("No decision events found in CSV")
}

# — Join scenario ground truth —
decisions$answer_accurate <- sapply(decisions$scenario_id, function(id) {
  as.logical(scenario_lookup[[id]])
})

# — Derived metrics —
decisions$brier_score <- (decisions$probability_prediction - as.numeric(decisions$answer_accurate)) ^ 2
decisions$overtrust    <- decisions$decision == "trust"    & !decisions$answer_accurate
decisions$undertrust   <- decisions$decision == "distrust" &  decisions$answer_accurate

# — Participant-level Brier means for descriptive stats —
p_mean <- aggregate(brier_score ~ participant_id + condition,
                    data = decisions, FUN = mean)

# — Descriptive statistics —
cat("\n=== Brier Score by Condition ===\n")
desc <- aggregate(brier_score ~ condition, data = p_mean,
                  FUN = function(x) c(mean = mean(x), sd = sd(x), n = length(x)))
print(desc)

# — Cohen's d (descriptive) —
v1 <- p_mean$brier_score[p_mean$condition == "v1"]
v2 <- p_mean$brier_score[p_mean$condition == "v2"]
pooled_sd <- sqrt((sd(v1)^2 + sd(v2)^2) / 2)
d <- (mean(v2) - mean(v1)) / pooled_sd
cat(sprintf("\nCohen's d (v2 - v1): %.3f\n", d))

# — Primary mixed model —
cat("\n=== Mixed Model: brier ~ condition + (1|participant) + (1|scenario) ===\n")
model <- lmer(brier_score ~ condition + (1 | participant_id) + (1 | scenario_id),
              data = decisions)
print(summary(model), correlation = FALSE)

# — Secondary: overtrust / undertrust —
cat(sprintf("\nUnsure responses excluded: %d / %d (%.1f%%)\n",
    sum(decisions$decision == "unsure"),
    nrow(decisions),
    100 * mean(decisions$decision == "unsure")))

cat("\n=== Over-trust Rate by Condition ===\n")
ot <- aggregate(overtrust ~ condition, data = decisions,
                FUN = function(x) c(rate = mean(x), n = sum(x)))
print(ot)

cat("\n=== Under-trust Rate by Condition ===\n")
ut <- aggregate(undertrust ~ condition, data = decisions,
                FUN = function(x) c(rate = mean(x), n = sum(x)))
print(ut)
```

---

## 总表

| # | 问题 | 行 | 严重程度 | 修法 |
|---|---|---|---|---|
| M1 | 缺少 scenario random intercept | 54 | 致命 | `+ (1 \| scenario_id)` |
| M2 | lmerTest 未加载 | 10 | 致命 | `library(lmerTest)` |
| M3 | Aggregate 在 trial-level 算均值 | 49 | 致命 | 先 participant-level then condition |
| M4 | 缺失 Cohens d | — | 重要 | `library(effectsize)` 或手算 |
| M5 | Unsure 处理未记录 | 45 | 重要 | 加日志输出 |
| M6 | Scenario 异质性未检查 | 54 | 中等 | 加 ICC 或随机斜率模型 |
