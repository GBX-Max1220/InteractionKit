import {
  buildAdjudicationQueue,
  resolveReviewOutcomes,
  type AdjudicationQueue,
  type AdjudicationResolution,
  type FinalReviewOutcome,
} from './adjudication';
import type { ReviewPairAudit } from './review-submissions';

export interface StoredPairAudit extends ReviewPairAudit {
  schemaVersion: 'study2-domain-review-pair-audit-v1';
  roundId: string;
  materialVersion: string;
  auditedAt: string;
}

export interface PanelFinalizationInput {
  panelId: string;
  audit: StoredPairAudit;
  queue: AdjudicationQueue;
  resolution?: AdjudicationResolution;
}

export interface ReviewRoundFinalization {
  valid: boolean;
  errors: string[];
  outcomes: FinalReviewOutcome[];
  panels: Array<{
    panelId: string;
    reviewed: number;
    fullAgreement: number;
    adjudicated: number;
  }>;
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  return [...new Set(values.filter((value) => (seen.has(value) ? true : !seen.add(value))))];
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value);
}

export function finalizeReviewRound(options: {
  expectedRoundId: string;
  expectedMaterialVersion: string;
  expectedPanelIds: string[];
  expectedCandidateIds: string[];
  panels: PanelFinalizationInput[];
}): ReviewRoundFinalization {
  const errors: string[] = [];
  const outcomes: FinalReviewOutcome[] = [];
  const panelSummaries: ReviewRoundFinalization['panels'] = [];
  const expectedPanels = [...options.expectedPanelIds].sort();
  const receivedPanels = options.panels.map((panel) => panel.panelId).sort();
  const duplicatePanels = duplicates(receivedPanels);
  if (duplicatePanels.length > 0) errors.push(`Duplicate panel inputs: ${duplicatePanels.join(', ')}.`);
  if (canonicalJson(receivedPanels) !== canonicalJson(expectedPanels)) {
    errors.push('Finalization inputs do not exactly cover the expected expertise panels.');
  }

  for (const panel of options.panels) {
    try {
      if (
        panel.audit.schemaVersion !== 'study2-domain-review-pair-audit-v1' ||
        panel.audit.roundId !== options.expectedRoundId ||
        panel.audit.materialVersion !== options.expectedMaterialVersion ||
        !panel.audit.valid
      ) {
        errors.push(`${panel.panelId} has an invalid or mismatched pair audit.`);
        continue;
      }
      if (
        panel.queue.schemaVersion !== 'study2-adjudication-queue-v1' ||
        panel.queue.roundId !== options.expectedRoundId ||
        panel.queue.materialVersion !== options.expectedMaterialVersion ||
        panel.queue.panelId !== panel.panelId
      ) {
        errors.push(`${panel.panelId} has an invalid or mismatched adjudication queue.`);
        continue;
      }
      const rebuiltQueue = buildAdjudicationQueue({
        audit: panel.audit,
        roundId: panel.audit.roundId,
        materialVersion: panel.audit.materialVersion,
        panelId: panel.panelId,
        generatedAt: panel.queue.generatedAt,
      });
      if (canonicalJson(rebuiltQueue) !== canonicalJson(panel.queue)) {
        errors.push(`${panel.panelId} adjudication queue does not match its pair audit.`);
        continue;
      }
      const result = resolveReviewOutcomes({
        audit: panel.audit,
        queue: panel.queue,
        resolution: panel.resolution,
      });
      if (!result.valid) {
        errors.push(...result.errors.map((error) => `${panel.panelId}: ${error}`));
        continue;
      }
      outcomes.push(...result.outcomes);
      panelSummaries.push({
        panelId: panel.panelId,
        reviewed: result.outcomes.length,
        fullAgreement: result.outcomes.filter(
          (outcome) => outcome.basis === 'full_reviewer_agreement',
        ).length,
        adjudicated: result.outcomes.filter((outcome) => outcome.basis === 'adjudication').length,
      });
    } catch (error) {
      errors.push(
        `${panel.panelId} cannot be finalized: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const expectedCandidateIds = [...options.expectedCandidateIds].sort();
  const outcomeIds = outcomes.map((outcome) => outcome.candidateId).sort();
  const duplicateOutcomeIds = duplicates(outcomeIds);
  if (duplicateOutcomeIds.length > 0) {
    errors.push(`Candidates finalized more than once: ${duplicateOutcomeIds.join(', ')}.`);
  }
  if (canonicalJson(outcomeIds) !== canonicalJson(expectedCandidateIds)) {
    errors.push('Final review outcomes do not exactly cover the expected candidate set.');
  }
  outcomes.sort((first, second) => first.candidateId.localeCompare(second.candidateId));
  panelSummaries.sort((first, second) => first.panelId.localeCompare(second.panelId));
  return { valid: errors.length === 0, errors, outcomes, panels: panelSummaries };
}
