import type { Study2DeliveryMaterials } from './delivery-materials';
import type { FrozenStudy2MaterialsArtifact } from './frozen-materials';
import { seededShuffle } from './random';
import type { FailureFamily } from './types';

export const TAXONOMY_LABELS = [
  'unsupported_numerical_precision',
  'omitted_decision_boundary',
  'both',
  'neither',
  'unresolved',
] as const;
export type TaxonomyLabel = (typeof TAXONOMY_LABELS)[number];

export interface TaxonomyCriterionJudgments {
  containsSpecificNumber: boolean | null;
  numberChangesJudgmentOrAction: boolean | null;
  numericalGranularityUnsupported: boolean | null;
  wideningNumberRepairsWithoutBoundary: boolean | null;
  expressesGeneralRecommendation: boolean | null;
  concreteBoundaryConditionMissing: boolean | null;
  crossingBoundaryChangesDecision: boolean | null;
  addingClauseRepairsWithoutPrecisionChange: boolean | null;
}

const TAXONOMY_CRITERION_KEYS = [
  'containsSpecificNumber',
  'numberChangesJudgmentOrAction',
  'numericalGranularityUnsupported',
  'wideningNumberRepairsWithoutBoundary',
  'expressesGeneralRecommendation',
  'concreteBoundaryConditionMissing',
  'crossingBoundaryChangesDecision',
  'addingClauseRepairsWithoutPrecisionChange',
] as const satisfies readonly (keyof TaxonomyCriterionJudgments)[];

export interface TaxonomyCodingPacketItem {
  blindId: string;
  decisionPrompt: string;
  optionA: string;
  optionB: string;
  targetPopulation: string;
  answerText: string;
  evidenceSupportedDecisionBoundary: string;
  evidenceSupportedNumericalGranularity: string;
}

export interface TaxonomyCodingPacket {
  schemaVersion: 'study2-taxonomy-coding-packet-v1';
  roundId: 'study2-taxonomy-coding-round-v1';
  answerVariantVersion: string;
  coderId: string;
  packetSeed: string;
  items: TaxonomyCodingPacketItem[];
}

export interface TaxonomyCodingCrosswalkItem {
  blindId: string;
  variantId: string;
}

export interface TaxonomyCodingSubmissionItem {
  blindId: string;
  familyLabel: TaxonomyLabel;
  criteria: TaxonomyCriterionJudgments;
  decisiveTextSpan: string;
  coderConfidence: number;
  rationale: string;
}

export interface TaxonomyCodingSubmission {
  schemaVersion: 'study2-taxonomy-coding-submission-v1';
  roundId: 'study2-taxonomy-coding-round-v1';
  answerVariantVersion: string;
  coderId: string;
  packetSeed: string;
  trainingCompleted: boolean;
  independenceAttestation: boolean;
  hypothesisBlindAttestation: boolean;
  materialContributionConflict: boolean;
  submittedAt: string;
  items: TaxonomyCodingSubmissionItem[];
}

export interface TaxonomyCoderRosterEntry {
  coderId: string;
  stablePersonId: string;
  trainingExampleVersion: string;
  trainingCompleted: boolean;
  materialContributionConflict: boolean;
  hypothesisBlindAttestation: boolean;
  eligibilityDecision: 'eligible' | 'ineligible';
  verifiedBy: string;
  verifiedAt: string;
}

export interface TaxonomyCoderRoster {
  schemaVersion: 'study2-taxonomy-coder-roster-v1';
  roundId: 'study2-taxonomy-coding-round-v1';
  entries: TaxonomyCoderRosterEntry[];
}

export interface TaxonomyCodingPairItem {
  variantId: string;
  intendedFamily: FailureFamily;
  firstLabel: TaxonomyLabel;
  secondLabel: TaxonomyLabel;
  labelsAgree: boolean;
  agreesWithIntendedFamily: boolean;
  disposition: 'retain' | 'remove_or_third_coder_review';
}

export interface TaxonomyCodingPairAudit {
  valid: boolean;
  errors: string[];
  rawAgreement: number;
  cohensKappa: number;
  passesAggregateThresholds: boolean;
  allVariantsRetained: boolean;
  items: TaxonomyCodingPairItem[];
  counts: { coded: number; agreements: number; retained: number; disputed: number };
}

const CRITERION_PROMPTS: Record<keyof TaxonomyCriterionJudgments, string> = {
  containsSpecificNumber: 'Does the answer contain a specific numerical value, range, probability, or threshold?',
  numberChangesJudgmentOrAction: 'Does that numerical granularity materially affect the judgment or action?',
  numericalGranularityUnsupported: 'Is that numerical granularity unsupported by the supplied evidence description?',
  wideningNumberRepairsWithoutBoundary: 'Could widening/removing the number repair the defect without adding a boundary condition?',
  expressesGeneralRecommendation: 'Does the answer express a general recommendation or default action?',
  concreteBoundaryConditionMissing: 'Is a concrete action-changing boundary condition missing?',
  crossingBoundaryChangesDecision: 'Would crossing that boundary change the recommended decision?',
  addingClauseRepairsWithoutPrecisionChange: 'Could adding the boundary clause repair the defect without changing numerical precision?',
};

const emptyCriteria = (): TaxonomyCriterionJudgments => ({
  containsSpecificNumber: null,
  numberChangesJudgmentOrAction: null,
  numericalGranularityUnsupported: null,
  wideningNumberRepairsWithoutBoundary: null,
  expressesGeneralRecommendation: null,
  concreteBoundaryConditionMissing: null,
  crossingBoundaryChangesDecision: null,
  addingClauseRepairsWithoutPrecisionChange: null,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

function allTrue(values: unknown[]): boolean {
  return values.every((value) => value === true);
}

function criteriaSupportLabel(
  criteria: TaxonomyCriterionJudgments,
  label: TaxonomyLabel,
): boolean {
  const precision = allTrue([
    criteria.containsSpecificNumber,
    criteria.numberChangesJudgmentOrAction,
    criteria.numericalGranularityUnsupported,
    criteria.wideningNumberRepairsWithoutBoundary,
  ]);
  const boundary = allTrue([
    criteria.expressesGeneralRecommendation,
    criteria.concreteBoundaryConditionMissing,
    criteria.crossingBoundaryChangesDecision,
    criteria.addingClauseRepairsWithoutPrecisionChange,
  ]);
  if (label === 'unsupported_numerical_precision') return precision && !boundary;
  if (label === 'omitted_decision_boundary') return boundary && !precision;
  if (label === 'both') return precision && boundary;
  if (label === 'neither') return !precision && !boundary;
  return true;
}

export function generateTaxonomyCodingPacket(options: {
  bundle: Study2DeliveryMaterials;
  frozen: FrozenStudy2MaterialsArtifact;
  coderId: string;
  seed: string;
}): {
  packet: TaxonomyCodingPacket;
  crosswalk: TaxonomyCodingCrosswalkItem[];
  submissionTemplate: TaxonomyCodingSubmission;
} {
  if (options.bundle.variants.length !== 96 || options.frozen.items.length !== 24) {
    throw new Error('Taxonomy coding requires structurally complete 96-answer and 24-scenario inputs.');
  }
  if (!options.coderId.trim() || !options.seed.trim()) throw new Error('Coder ID and packet seed are required.');
  if (new Set(options.bundle.variants.map((variant) => variant.variantId)).size !== 96) {
    throw new Error('Taxonomy coding requires 96 unique answer-variant IDs.');
  }
  if (
    options.bundle.variants.some(
      (variant) => !variant.variantId.trim() || !variant.scenarioId.trim() || !variant.answerText.trim(),
    )
  ) {
    throw new Error('Taxonomy coding requires non-empty variant IDs, scenario IDs, and answer text.');
  }
  if (new Set(options.frozen.items.map((item) => item.candidateId)).size !== 24) {
    throw new Error('Taxonomy coding requires 24 unique frozen-scenario IDs.');
  }
  const frozenById = new Map(options.frozen.items.map((item) => [item.candidateId, item]));
  const ordered = seededShuffle(
    options.bundle.variants,
    `${options.seed}:${options.coderId}`,
  );
  const crosswalk: TaxonomyCodingCrosswalkItem[] = [];
  const items = ordered.map((variant, index): TaxonomyCodingPacketItem => {
    const frozen = frozenById.get(variant.scenarioId);
    if (!frozen) throw new Error(`Taxonomy packet is missing frozen scenario ${variant.scenarioId}.`);
    const blindId = `T${String(index + 1).padStart(3, '0')}`;
    crosswalk.push({ blindId, variantId: variant.variantId });
    return {
      blindId,
      decisionPrompt: frozen.decisionPrompt,
      optionA: frozen.optionA,
      optionB: frozen.optionB,
      targetPopulation: frozen.targetPopulation,
      answerText: variant.answerText,
      evidenceSupportedDecisionBoundary: frozen.finalDecisionBoundary,
      evidenceSupportedNumericalGranularity: frozen.finalNumericalGranularity,
    };
  });
  const packet: TaxonomyCodingPacket = {
    schemaVersion: 'study2-taxonomy-coding-packet-v1',
    roundId: 'study2-taxonomy-coding-round-v1',
    answerVariantVersion: options.bundle.answerVariantVersion,
    coderId: options.coderId,
    packetSeed: options.seed,
    items,
  };
  return {
    packet,
    crosswalk,
    submissionTemplate: {
      schemaVersion: 'study2-taxonomy-coding-submission-v1',
      roundId: packet.roundId,
      answerVariantVersion: packet.answerVariantVersion,
      coderId: packet.coderId,
      packetSeed: packet.packetSeed,
      trainingCompleted: false,
      independenceAttestation: false,
      hypothesisBlindAttestation: false,
      materialContributionConflict: true,
      submittedAt: '',
      items: items.map((item) => ({
        blindId: item.blindId,
        familyLabel: 'unresolved',
        criteria: emptyCriteria(),
        decisiveTextSpan: '',
        coderConfidence: 0,
        rationale: '',
      })),
    },
  };
}

export function renderTaxonomyCodingForm(packet: TaxonomyCodingPacket): string {
  const sections = packet.items.map((item) => {
    const criteria = TAXONOMY_CRITERION_KEYS.map(
      (key) => `- ${key}: [ ] Yes  [ ] No — ${CRITERION_PROMPTS[key]}`,
    ).join('\n');
    return [
      `## ${item.blindId}`,
      '',
      `Decision: ${item.decisionPrompt}`,
      '',
      `Option A: ${item.optionA}`,
      '',
      `Option B: ${item.optionB}`,
      '',
      `Target population: ${item.targetPopulation}`,
      '',
      `Evidence-supported decision boundary: ${item.evidenceSupportedDecisionBoundary}`,
      '',
      `Evidence-supported numerical granularity: ${item.evidenceSupportedNumericalGranularity}`,
      '',
      `Answer: ${item.answerText}`,
      '',
      criteria,
      '',
      'Family label: [ ] unsupported_numerical_precision  [ ] omitted_decision_boundary  [ ] both  [ ] neither  [ ] unresolved',
      '',
      'Decisive verbatim text span:',
      '',
      'Coder confidence (1-5):',
      '',
      'Rationale:',
    ].join('\n');
  });
  return [
    '# Study 2 blinded taxonomy coding form',
    '',
    `Coder alias: ${packet.coderId}`,
    `Round: ${packet.roundId}`,
    `Answer version: ${packet.answerVariantVersion}`,
    `Packet seed: ${packet.packetSeed}`,
    '',
    'Work independently. Do not discuss answers, infer study hypotheses, or access authoring metadata/crosswalks.',
    'Complete all eight binary criteria before assigning one family label. Copy a decisive span verbatim from the answer.',
    '',
    ...sections,
    '',
  ].join('\n');
}

export function validateTaxonomyCoderRoster(
  value: unknown,
  expectedCoderIds: string[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ['Taxonomy coder roster must be an object.'] };
  if (value.schemaVersion !== 'study2-taxonomy-coder-roster-v1' || value.roundId !== 'study2-taxonomy-coding-round-v1') errors.push('Taxonomy coder roster metadata is invalid.');
  const entries = Array.isArray(value.entries) ? value.entries : [];
  if (entries.length !== expectedCoderIds.length) errors.push(`Expected ${expectedCoderIds.length} coder roster entries.`);
  const people = new Set<string>();
  const seen = new Set<string>();
  for (const [index, raw] of entries.entries()) {
    if (!isRecord(raw)) { errors.push(`Coder roster entry ${index + 1} is malformed.`); continue; }
    const coderId = nonEmptyString(raw.coderId) ? raw.coderId : '';
    if (!expectedCoderIds.includes(coderId)) errors.push(`${coderId || `Entry ${index + 1}`} is not an expected coder alias.`);
    if (seen.has(coderId)) errors.push(`Duplicate coder alias ${coderId}.`);
    seen.add(coderId);
    const person = nonEmptyString(raw.stablePersonId) ? raw.stablePersonId.toLowerCase() : '';
    if (!person) errors.push(`${coderId} is missing a private stable person ID.`);
    if (people.has(person)) errors.push('The same person cannot occupy both independent taxonomy-coder seats.');
    people.add(person);
    for (const field of ['trainingExampleVersion', 'verifiedBy'] as const) {
      if (!nonEmptyString(raw[field])) errors.push(`${coderId} is missing ${field}.`);
    }
    if (raw.trainingCompleted !== true || raw.hypothesisBlindAttestation !== true) errors.push(`${coderId} has not completed training and hypothesis-blind attestation.`);
    if (raw.materialContributionConflict !== false) errors.push(`${coderId} materially contributed to the coded answers.`);
    if (raw.eligibilityDecision !== 'eligible') errors.push(`${coderId} is not marked eligible.`);
    if (!nonEmptyString(raw.verifiedAt) || !Number.isFinite(Date.parse(raw.verifiedAt))) errors.push(`${coderId} has an invalid verification timestamp.`);
  }
  for (const coderId of expectedCoderIds) if (!seen.has(coderId)) errors.push(`Coder roster is missing ${coderId}.`);
  return { valid: errors.length === 0, errors };
}

export function validateTaxonomyCodingSubmission(
  value: unknown,
  packet: TaxonomyCodingPacket,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ['Taxonomy submission must be an object.'] };
  if (
    value.schemaVersion !== 'study2-taxonomy-coding-submission-v1' ||
    value.roundId !== packet.roundId ||
    value.answerVariantVersion !== packet.answerVariantVersion ||
    value.coderId !== packet.coderId ||
    value.packetSeed !== packet.packetSeed
  ) errors.push('Taxonomy submission metadata does not match its packet.');
  if (value.trainingCompleted !== true || value.independenceAttestation !== true || value.hypothesisBlindAttestation !== true) errors.push('Taxonomy submission requires training, independence, and hypothesis-blind attestations.');
  if (value.materialContributionConflict !== false) errors.push('A material contributor cannot submit independent taxonomy coding.');
  if (!nonEmptyString(value.submittedAt) || !Number.isFinite(Date.parse(value.submittedAt))) errors.push('Taxonomy submission requires a valid timestamp.');
  const rawItems = Array.isArray(value.items) ? value.items : [];
  if (rawItems.length !== packet.items.length) errors.push(`Expected ${packet.items.length} taxonomy judgments.`);
  const expectedIds = new Set(packet.items.map((item) => item.blindId));
  const seen = new Set<string>();
  for (const [index, raw] of rawItems.entries()) {
    if (!isRecord(raw)) { errors.push(`Taxonomy judgment ${index + 1} is malformed.`); continue; }
    const blindId = nonEmptyString(raw.blindId) ? raw.blindId : '';
    if (!expectedIds.has(blindId)) errors.push(`${blindId || `Judgment ${index + 1}`} is not in the packet.`);
    if (seen.has(blindId)) errors.push(`Duplicate taxonomy judgment ${blindId}.`);
    seen.add(blindId);
    if (!TAXONOMY_LABELS.includes(raw.familyLabel as TaxonomyLabel)) errors.push(`${blindId} has an invalid family label.`);
    if (!isRecord(raw.criteria)) { errors.push(`${blindId} has malformed criteria.`); continue; }
    const criteriaRecord = raw.criteria;
    const criteria = criteriaRecord as unknown as TaxonomyCriterionJudgments;
    const criterionKeys = Object.keys(criteriaRecord).sort();
    const expectedCriterionKeys = [...TAXONOMY_CRITERION_KEYS].sort();
    if (
      criterionKeys.length !== expectedCriterionKeys.length ||
      criterionKeys.some((key, criterionIndex) => key !== expectedCriterionKeys[criterionIndex]) ||
      TAXONOMY_CRITERION_KEYS.some((key) => typeof criteriaRecord[key] !== 'boolean')
    ) errors.push(`${blindId} must complete exactly the eight defined criterion judgments.`);
    else if (!criteriaSupportLabel(criteria, raw.familyLabel as TaxonomyLabel)) errors.push(`${blindId} criterion judgments do not support its family label.`);
    if (!nonEmptyString(raw.decisiveTextSpan) || !nonEmptyString(raw.rationale)) errors.push(`${blindId} requires a decisive span and rationale.`);
    const packetItem = packet.items.find((item) => item.blindId === blindId);
    if (packetItem && nonEmptyString(raw.decisiveTextSpan) && !packetItem.answerText.includes(raw.decisiveTextSpan)) errors.push(`${blindId} decisive span is not verbatim in the answer.`);
    if (!Number.isInteger(raw.coderConfidence) || Number(raw.coderConfidence) < 1 || Number(raw.coderConfidence) > 5) errors.push(`${blindId} coder confidence must be 1-5.`);
  }
  for (const blindId of expectedIds) if (!seen.has(blindId)) errors.push(`Taxonomy submission is missing ${blindId}.`);
  return { valid: errors.length === 0, errors };
}

function unblind(
  submission: TaxonomyCodingSubmission,
  crosswalk: TaxonomyCodingCrosswalkItem[],
): Map<string, TaxonomyCodingSubmissionItem> {
  if (crosswalk.length !== submission.items.length) {
    throw new Error('Crosswalk must have exactly one entry per taxonomy judgment.');
  }
  const blindIds = crosswalk.map((item) => item.blindId);
  const variantIds = crosswalk.map((item) => item.variantId);
  if (
    crosswalk.some((item) => !item.blindId.trim() || !item.variantId.trim()) ||
    new Set(blindIds).size !== crosswalk.length ||
    new Set(variantIds).size !== crosswalk.length
  ) {
    throw new Error('Crosswalk blind IDs and answer-variant IDs must be non-empty and unique.');
  }
  const submittedIds = new Set(submission.items.map((item) => item.blindId));
  if (blindIds.some((blindId) => !submittedIds.has(blindId))) {
    throw new Error('Crosswalk does not exactly match the submitted blind IDs.');
  }
  const variantByBlindId = new Map(crosswalk.map((item) => [item.blindId, item.variantId]));
  return new Map(
    submission.items.map((item) => {
      const variantId = variantByBlindId.get(item.blindId);
      if (!variantId) throw new Error(`Crosswalk is missing ${item.blindId}.`);
      return [variantId, item];
    }),
  );
}

function cohensKappa(first: TaxonomyLabel[], second: TaxonomyLabel[]): number {
  const observed = first.filter((label, index) => label === second[index]).length / first.length;
  const expected = TAXONOMY_LABELS.reduce((sum, label) => {
    const firstRate = first.filter((value) => value === label).length / first.length;
    const secondRate = second.filter((value) => value === label).length / second.length;
    return sum + firstRate * secondRate;
  }, 0);
  if (expected === 1) return observed === 1 ? 1 : 0;
  return (observed - expected) / (1 - expected);
}

export function auditTaxonomyCodingPair(options: {
  bundle: Study2DeliveryMaterials;
  firstPacket: TaxonomyCodingPacket;
  firstCrosswalk: TaxonomyCodingCrosswalkItem[];
  firstSubmission: TaxonomyCodingSubmission;
  secondPacket: TaxonomyCodingPacket;
  secondCrosswalk: TaxonomyCodingCrosswalkItem[];
  secondSubmission: TaxonomyCodingSubmission;
  coderRoster: TaxonomyCoderRoster;
}): TaxonomyCodingPairAudit {
  const errors: string[] = [];
  if (
    options.firstPacket.roundId !== options.secondPacket.roundId ||
    options.firstPacket.answerVariantVersion !== options.secondPacket.answerVariantVersion ||
    options.firstPacket.packetSeed !== options.secondPacket.packetSeed
  ) {
    errors.push('Taxonomy coding packets must belong to the same round, answer version, and packet seed.');
  }
  const coderIds = [options.firstPacket.coderId, options.secondPacket.coderId];
  if (coderIds[0] === coderIds[1]) errors.push('Taxonomy coding requires two distinct coder aliases.');
  errors.push(...validateTaxonomyCoderRoster(options.coderRoster, coderIds).errors);
  errors.push(...validateTaxonomyCodingSubmission(options.firstSubmission, options.firstPacket).errors.map((error) => `First coder: ${error}`));
  errors.push(...validateTaxonomyCodingSubmission(options.secondSubmission, options.secondPacket).errors.map((error) => `Second coder: ${error}`));
  if (errors.length) return { valid: false, errors, rawAgreement: 0, cohensKappa: 0, passesAggregateThresholds: false, allVariantsRetained: false, items: [], counts: { coded: 0, agreements: 0, retained: 0, disputed: 0 } };
  let first: Map<string, TaxonomyCodingSubmissionItem>;
  let second: Map<string, TaxonomyCodingSubmissionItem>;
  try {
    first = unblind(options.firstSubmission, options.firstCrosswalk);
    second = unblind(options.secondSubmission, options.secondCrosswalk);
  } catch (error) {
    return { valid: false, errors: [error instanceof Error ? error.message : String(error)], rawAgreement: 0, cohensKappa: 0, passesAggregateThresholds: false, allVariantsRetained: false, items: [], counts: { coded: 0, agreements: 0, retained: 0, disputed: 0 } };
  }
  const intendedByVariant = new Map(options.bundle.variants.map((variant) => [variant.variantId, variant.failureFamily]));
  if (options.bundle.variants.length !== 96 || intendedByVariant.size !== 96) {
    errors.push('Taxonomy pair audit requires exactly 96 unique intended answer variants.');
  }
  if (first.size !== 96 || second.size !== 96 || [...intendedByVariant.keys()].some((id) => !first.has(id) || !second.has(id))) errors.push('Unblinded taxonomy judgments must exactly cover all 96 answer variants.');
  if (errors.length) return { valid: false, errors, rawAgreement: 0, cohensKappa: 0, passesAggregateThresholds: false, allVariantsRetained: false, items: [], counts: { coded: 0, agreements: 0, retained: 0, disputed: 0 } };
  const items = [...intendedByVariant.entries()].map(([variantId, intendedFamily]): TaxonomyCodingPairItem => {
    const firstLabel = first.get(variantId)!.familyLabel;
    const secondLabel = second.get(variantId)!.familyLabel;
    const labelsAgree = firstLabel === secondLabel;
    const agreesWithIntendedFamily = labelsAgree && firstLabel === intendedFamily;
    return { variantId, intendedFamily, firstLabel, secondLabel, labelsAgree, agreesWithIntendedFamily, disposition: agreesWithIntendedFamily ? 'retain' : 'remove_or_third_coder_review' };
  });
  items.sort((a, b) => a.variantId.localeCompare(b.variantId));
  const firstLabels = items.map((item) => item.firstLabel);
  const secondLabels = items.map((item) => item.secondLabel);
  const agreements = items.filter((item) => item.labelsAgree).length;
  const retained = items.filter((item) => item.disposition === 'retain').length;
  const rawAgreement = agreements / items.length;
  const kappa = cohensKappa(firstLabels, secondLabels);
  return {
    valid: true,
    errors: [],
    rawAgreement,
    cohensKappa: kappa,
    passesAggregateThresholds: rawAgreement >= 0.9 && kappa >= 0.8,
    allVariantsRetained: retained === 96,
    items,
    counts: { coded: 96, agreements, retained, disputed: 96 - retained },
  };
}
