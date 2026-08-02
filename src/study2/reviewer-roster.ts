import type { CandidateScenario } from './materials';

export type CandidateDomain = CandidateScenario['domain'];

export interface ReviewerAssignmentRequirement {
  reviewerId: string;
  panelId: string;
  requiredDomains: CandidateDomain[];
}

export interface ReviewerRosterEntry {
  reviewerId: string;
  panelId: string;
  stablePersonId: string;
  qualifiedDomains: CandidateDomain[];
  relevantQualifications: string;
  identityVerificationMethod: string;
  conflictOfInterestStatement: string;
  materialContributionConflict: boolean;
  independenceAttestation: string;
  compensationStatement: string;
  outcomeContingentCompensation: boolean;
  eligibilityDecision: 'eligible' | 'ineligible';
  verifiedBy: string;
  verifiedAt: string;
}

export interface ReviewerRoster {
  schemaVersion: 'study2-reviewer-roster-v1';
  roundId: string;
  entries: ReviewerRosterEntry[];
}

export interface ReviewerRosterValidation {
  valid: boolean;
  errors: string[];
}

const candidateDomains = new Set<CandidateDomain>([
  'exercise_training',
  'recovery',
  'nutrition',
  'injury_risk',
  'environment',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateReviewerRoster(
  value: unknown,
  options: { roundId: string; assignments: ReviewerAssignmentRequirement[] },
): ReviewerRosterValidation {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ['Reviewer roster must be a JSON object.'] };
  }
  if (value.schemaVersion !== 'study2-reviewer-roster-v1') {
    errors.push('Unsupported reviewer-roster schema version.');
  }
  if (value.roundId !== options.roundId) {
    errors.push('Reviewer roster round ID does not match the review manifest.');
  }
  const entries = Array.isArray(value.entries) ? value.entries : [];
  if (!Array.isArray(value.entries)) errors.push('Reviewer roster entries must be an array.');
  if (entries.length !== options.assignments.length) {
    errors.push(`Expected ${options.assignments.length} roster entries; received ${entries.length}.`);
  }

  const requirementsByReviewerId = new Map(
    options.assignments.map((assignment) => [assignment.reviewerId, assignment]),
  );
  const seenReviewerIds = new Set<string>();
  const stablePeopleByPanel = new Map<string, Set<string>>();
  for (const [index, rawEntry] of entries.entries()) {
    if (!isRecord(rawEntry)) {
      errors.push(`Roster entry ${index + 1} must be a JSON object.`);
      continue;
    }
    const reviewerId = typeof rawEntry.reviewerId === 'string' ? rawEntry.reviewerId : '';
    const label = reviewerId || `Roster entry ${index + 1}`;
    if (!reviewerId) errors.push(`Roster entry ${index + 1} is missing reviewerId.`);
    if (seenReviewerIds.has(reviewerId)) errors.push(`Duplicate roster assignment ${reviewerId}.`);
    seenReviewerIds.add(reviewerId);
    const requirement = requirementsByReviewerId.get(reviewerId);
    if (!requirement) {
      errors.push(`${label} is not an assignment in the review manifest.`);
      continue;
    }
    if (rawEntry.panelId !== requirement.panelId) {
      errors.push(`${label} has the wrong expertise panel.`);
    }
    const stablePersonId =
      typeof rawEntry.stablePersonId === 'string' ? rawEntry.stablePersonId.trim() : '';
    if (!stablePersonId) errors.push(`${label} is missing a private stable person ID.`);
    if (stablePersonId) {
      const panelPeople = stablePeopleByPanel.get(requirement.panelId) ?? new Set<string>();
      const normalizedPersonId = stablePersonId.toLocaleLowerCase();
      if (panelPeople.has(normalizedPersonId)) {
        errors.push(
          `${requirement.panelId} assigns the same person to both independent reviewer seats.`,
        );
      }
      panelPeople.add(normalizedPersonId);
      stablePeopleByPanel.set(requirement.panelId, panelPeople);
    }

    const qualifiedDomains = Array.isArray(rawEntry.qualifiedDomains)
      ? rawEntry.qualifiedDomains.filter(
          (domain): domain is CandidateDomain =>
            typeof domain === 'string' && candidateDomains.has(domain as CandidateDomain),
        )
      : [];
    if (
      !Array.isArray(rawEntry.qualifiedDomains) ||
      qualifiedDomains.length !== rawEntry.qualifiedDomains.length
    ) {
      errors.push(`${label} contains an invalid qualified domain.`);
    }
    for (const domain of requirement.requiredDomains) {
      if (!qualifiedDomains.includes(domain)) {
        errors.push(`${label} does not claim required expertise in ${domain}.`);
      }
    }
    for (const field of [
      'relevantQualifications',
      'identityVerificationMethod',
      'conflictOfInterestStatement',
      'independenceAttestation',
      'compensationStatement',
      'verifiedBy',
    ] as const) {
      if (typeof rawEntry[field] !== 'string' || !rawEntry[field].trim()) {
        errors.push(`${label} is missing ${field}.`);
      }
    }
    if (rawEntry.eligibilityDecision !== 'eligible') {
      errors.push(`${label} is not marked eligible.`);
    }
    if (rawEntry.materialContributionConflict !== false) {
      errors.push(`${label} must not have contributed to the reviewed materials or dossiers.`);
    }
    if (rawEntry.outcomeContingentCompensation !== false) {
      errors.push(`${label} compensation must not depend on judgments or retention outcomes.`);
    }
    if (
      typeof rawEntry.verifiedAt !== 'string' ||
      !Number.isFinite(Date.parse(rawEntry.verifiedAt))
    ) {
      errors.push(`${label} has an invalid verification timestamp.`);
    }
  }
  for (const reviewerId of requirementsByReviewerId.keys()) {
    if (!seenReviewerIds.has(reviewerId)) errors.push(`Roster is missing ${reviewerId}.`);
  }
  return { valid: errors.length === 0, errors };
}
