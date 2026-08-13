import type { Study2DeliveryMaterials } from './delivery-materials';
import type { EvidenceDossier } from './evidence-dossiers';
import type { FrozenStudy2MaterialsArtifact } from './frozen-materials';
import { seededShuffle } from './random';

export const CARD_SAFETY_CRITERIA = [
  'directVerdictCuePresent',
  'relianceDirectivePresent',
  'confidenceCuePresent',
  'answerSpecificFramingPresent',
  'unsupportedCardClaimPresent',
] as const;
export type CardSafetyCriterion = (typeof CARD_SAFETY_CRITERIA)[number];
export type CardSafetyJudgments = Record<CardSafetyCriterion, boolean | null>;

export interface CardSafetyPacketItem {
  blindId: string;
  decisionPrompt: string;
  optionA: string;
  optionB: string;
  targetPopulation: string;
  answerText: string;
  cardRows: { label: string; text: string }[];
  citedSource: {
    fullCitation: string;
    populationAndSetting: string;
    relevantFinding: string;
    limitationsForScenario: string;
  };
}

export interface CardSafetyPacket {
  schemaVersion: 'study2-card-safety-packet-v1';
  roundId: 'study2-card-safety-round-v1';
  answerVariantVersion: string;
  interventionCardVersion: string;
  reviewerId: string;
  packetSeed: string;
  items: CardSafetyPacketItem[];
}

export interface CardSafetyCrosswalkItem {
  blindId: string;
  cardId: string;
  variantId: string;
}

export interface CardSafetySubmissionItem {
  blindId: string;
  judgments: CardSafetyJudgments;
  flaggedTextSpans: string[];
  sourceAssessmentRationale: string;
  reviewerConfidence: number;
}

export interface CardSafetySubmission {
  schemaVersion: 'study2-card-safety-submission-v1';
  roundId: 'study2-card-safety-round-v1';
  answerVariantVersion: string;
  interventionCardVersion: string;
  reviewerId: string;
  packetSeed: string;
  trainingCompleted: boolean;
  independenceAttestation: boolean;
  hypothesisBlindAttestation: boolean;
  materialContributionConflict: boolean;
  submittedAt: string;
  items: CardSafetySubmissionItem[];
}

export interface CardSafetyReviewerRosterEntry {
  reviewerId: string;
  stablePersonId: string;
  trainingExampleVersion: string;
  trainingCompleted: boolean;
  materialContributionConflict: boolean;
  hypothesisBlindAttestation: boolean;
  eligibilityDecision: 'eligible' | 'ineligible';
  verifiedBy: string;
  verifiedAt: string;
}

export interface CardSafetyReviewerRoster {
  schemaVersion: 'study2-card-safety-reviewer-roster-v1';
  roundId: 'study2-card-safety-round-v1';
  entries: CardSafetyReviewerRosterEntry[];
}

export interface CardSafetyPairAuditItem {
  cardId: string;
  variantId: string;
  firstJudgments: Record<CardSafetyCriterion, boolean>;
  secondJudgments: Record<CardSafetyCriterion, boolean>;
  exactAgreement: boolean;
  prohibitedCueFound: boolean;
  disposition: 'retain' | 'revise_and_rereview';
}

export interface CardSafetyPairAudit {
  valid: boolean;
  errors: string[];
  rawCriterionAgreement: number;
  gwetsAc1: number;
  passesAggregateThresholds: boolean;
  allCardsRetained: boolean;
  items: CardSafetyPairAuditItem[];
  counts: { cards: number; criterionJudgments: number; agreements: number; retained: number; disputedOrFlagged: number };
}

const CARD_SAFETY_PROMPTS: Record<CardSafetyCriterion, string> = {
  directVerdictCuePresent: 'Does the card directly label the answer or recommendation as correct, incorrect, right, wrong, or equivalent?',
  relianceDirectivePresent: 'Does the card tell the participant to trust, distrust, follow, ignore, accept, or reject the answer?',
  confidenceCuePresent: 'Does the card state or imply the AI confidence condition or prescribe a probability judgment?',
  answerSpecificFramingPresent: 'Does the card evaluate “this answer,” “the AI,” or “the model” instead of neutrally presenting evidence?',
  unsupportedCardClaimPresent: 'Does any visible card claim exceed the cited source finding, population, or stated limitations?',
};

const emptyJudgments = (): CardSafetyJudgments => ({
  directVerdictCuePresent: null,
  relianceDirectivePresent: null,
  confidenceCuePresent: null,
  answerSpecificFramingPresent: null,
  unsupportedCardClaimPresent: null,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

export function generateCardSafetyPacket(options: {
  bundle: Study2DeliveryMaterials;
  frozen: FrozenStudy2MaterialsArtifact;
  dossiers: EvidenceDossier[];
  reviewerId: string;
  seed: string;
}): {
  packet: CardSafetyPacket;
  crosswalk: CardSafetyCrosswalkItem[];
  submissionTemplate: CardSafetySubmission;
} {
  if (!options.reviewerId.trim() || !options.seed.trim()) throw new Error('Reviewer ID and packet seed are required.');
  if (options.bundle.variants.length !== 96 || options.frozen.items.length !== 24) {
    throw new Error('Card-safety review requires 96 answer variants and 24 frozen scenarios.');
  }
  const cards = options.bundle.variants.flatMap((variant) =>
    variant.cards.map((card) => ({ variant, card })),
  );
  if (
    cards.length !== 192 ||
    new Set(cards.map(({ card }) => card.cardId)).size !== 192 ||
    new Set(options.bundle.variants.map((variant) => variant.variantId)).size !== 96
  ) throw new Error('Card-safety review requires 192 unique cards across 96 unique answer variants.');
  const frozenById = new Map(options.frozen.items.map((item) => [item.candidateId, item]));
  const dossierById = new Map(options.dossiers.map((dossier) => [dossier.candidateId, dossier]));
  if (frozenById.size !== 24 || dossierById.size !== options.dossiers.length) {
    throw new Error('Frozen scenarios and evidence dossiers require unique IDs.');
  }
  const ordered = seededShuffle(cards, `${options.seed}:${options.reviewerId}`);
  const crosswalk: CardSafetyCrosswalkItem[] = [];
  const items = ordered.map(({ variant, card }, index): CardSafetyPacketItem => {
    const frozen = frozenById.get(variant.scenarioId);
    const dossier = dossierById.get(variant.scenarioId);
    const source = dossier?.sources.find((candidate) => candidate.id === card.citationSourceId);
    if (!frozen || !source) throw new Error(`Card ${card.cardId} lacks its frozen scenario or cited dossier source.`);
    if (!variant.answerText.trim() || card.rows.length !== 3 || card.rows.some((row) => !row.label.trim() || !row.text.trim())) {
      throw new Error(`Card ${card.cardId} is not complete enough for safety review.`);
    }
    const blindId = `C${String(index + 1).padStart(3, '0')}`;
    crosswalk.push({ blindId, cardId: card.cardId, variantId: variant.variantId });
    return {
      blindId,
      decisionPrompt: frozen.decisionPrompt,
      optionA: frozen.optionA,
      optionB: frozen.optionB,
      targetPopulation: frozen.targetPopulation,
      answerText: variant.answerText,
      cardRows: card.rows.map(({ label, text }) => ({ label, text })),
      citedSource: {
        fullCitation: source.fullCitation,
        populationAndSetting: source.populationAndSetting,
        relevantFinding: source.relevantFinding,
        limitationsForScenario: source.limitationsForScenario,
      },
    };
  });
  const packet: CardSafetyPacket = {
    schemaVersion: 'study2-card-safety-packet-v1',
    roundId: 'study2-card-safety-round-v1',
    answerVariantVersion: options.bundle.answerVariantVersion,
    interventionCardVersion: options.bundle.interventionCardVersion,
    reviewerId: options.reviewerId,
    packetSeed: options.seed,
    items,
  };
  return {
    packet,
    crosswalk,
    submissionTemplate: {
      schemaVersion: 'study2-card-safety-submission-v1',
      roundId: packet.roundId,
      answerVariantVersion: packet.answerVariantVersion,
      interventionCardVersion: packet.interventionCardVersion,
      reviewerId: packet.reviewerId,
      packetSeed: packet.packetSeed,
      trainingCompleted: false,
      independenceAttestation: false,
      hypothesisBlindAttestation: false,
      materialContributionConflict: true,
      submittedAt: '',
      items: items.map((item) => ({
        blindId: item.blindId,
        judgments: emptyJudgments(),
        flaggedTextSpans: [],
        sourceAssessmentRationale: '',
        reviewerConfidence: 0,
      })),
    },
  };
}

export function renderCardSafetyReviewForm(packet: CardSafetyPacket): string {
  const sections = packet.items.map((item) => {
    const rows = item.cardRows.map((row) => `- **${row.label}:** ${row.text}`).join('\n');
    const criteria = CARD_SAFETY_CRITERIA.map(
      (criterion) => `- ${criterion}: [ ] Present  [ ] Absent — ${CARD_SAFETY_PROMPTS[criterion]}`,
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
      `Answer shown before card: ${item.answerText}`,
      '',
      'Participant-visible card:',
      rows,
      '',
      `Cited source: ${item.citedSource.fullCitation}`,
      `Source population/setting: ${item.citedSource.populationAndSetting}`,
      `Relevant finding: ${item.citedSource.relevantFinding}`,
      `Scenario limitation: ${item.citedSource.limitationsForScenario}`,
      '',
      criteria,
      '',
      'Flagged verbatim text span(s), if any:',
      '',
      'Source-assessment rationale:',
      '',
      'Reviewer confidence (1-5):',
    ].join('\n');
  });
  return [
    '# Study 2 blinded intervention-card content-safety review',
    '',
    `Reviewer alias: ${packet.reviewerId}`,
    `Round: ${packet.roundId}`,
    `Answer version: ${packet.answerVariantVersion}`,
    `Card version: ${packet.interventionCardVersion}`,
    `Packet seed: ${packet.packetSeed}`,
    '',
    'Work independently. Do not access condition labels, ground truth, crosswalks, or the other reviewer’s judgments.',
    'Construct-relevant evidence is allowed. Direct verdicts, reliance directives, confidence-condition cues, answer-specific evaluation, and source-exceeding claims are prohibited.',
    '',
    ...sections,
    '',
  ].join('\n');
}

export function validateCardSafetyReviewerRoster(
  value: unknown,
  expectedReviewerIds: string[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ['Card-safety reviewer roster must be an object.'] };
  if (value.schemaVersion !== 'study2-card-safety-reviewer-roster-v1' || value.roundId !== 'study2-card-safety-round-v1') errors.push('Card-safety reviewer roster metadata is invalid.');
  const entries = Array.isArray(value.entries) ? value.entries : [];
  if (entries.length !== expectedReviewerIds.length) errors.push(`Expected ${expectedReviewerIds.length} card-safety reviewer entries.`);
  const people = new Set<string>();
  const seen = new Set<string>();
  for (const [index, raw] of entries.entries()) {
    if (!isRecord(raw)) { errors.push(`Card-safety reviewer entry ${index + 1} is malformed.`); continue; }
    const reviewerId = nonEmptyString(raw.reviewerId) ? raw.reviewerId : '';
    if (!expectedReviewerIds.includes(reviewerId)) errors.push(`${reviewerId || `Entry ${index + 1}`} is not an expected reviewer alias.`);
    if (seen.has(reviewerId)) errors.push(`Duplicate card-safety reviewer alias ${reviewerId}.`);
    seen.add(reviewerId);
    const person = nonEmptyString(raw.stablePersonId) ? raw.stablePersonId.toLowerCase() : '';
    if (!person) errors.push(`${reviewerId} is missing a private stable person ID.`);
    if (people.has(person)) errors.push('The same person cannot occupy both independent card-safety reviewer seats.');
    people.add(person);
    if (!nonEmptyString(raw.trainingExampleVersion) || !nonEmptyString(raw.verifiedBy)) errors.push(`${reviewerId} is missing training or verifier metadata.`);
    if (raw.trainingCompleted !== true || raw.hypothesisBlindAttestation !== true) errors.push(`${reviewerId} has not completed training and hypothesis-blind attestation.`);
    if (raw.materialContributionConflict !== false) errors.push(`${reviewerId} materially contributed to the reviewed cards or answers.`);
    if (raw.eligibilityDecision !== 'eligible') errors.push(`${reviewerId} is not marked eligible.`);
    if (!nonEmptyString(raw.verifiedAt) || !Number.isFinite(Date.parse(raw.verifiedAt))) errors.push(`${reviewerId} has an invalid verification timestamp.`);
  }
  for (const reviewerId of expectedReviewerIds) if (!seen.has(reviewerId)) errors.push(`Card-safety reviewer roster is missing ${reviewerId}.`);
  return { valid: errors.length === 0, errors };
}

export function validateCardSafetySubmission(
  value: unknown,
  packet: CardSafetyPacket,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ['Card-safety submission must be an object.'] };
  if (
    value.schemaVersion !== 'study2-card-safety-submission-v1' ||
    value.roundId !== packet.roundId ||
    value.answerVariantVersion !== packet.answerVariantVersion ||
    value.interventionCardVersion !== packet.interventionCardVersion ||
    value.reviewerId !== packet.reviewerId ||
    value.packetSeed !== packet.packetSeed
  ) errors.push('Card-safety submission metadata does not match its packet.');
  if (value.trainingCompleted !== true || value.independenceAttestation !== true || value.hypothesisBlindAttestation !== true) errors.push('Card-safety submission requires training, independence, and hypothesis-blind attestations.');
  if (value.materialContributionConflict !== false) errors.push('A material contributor cannot submit independent card-safety review.');
  if (!nonEmptyString(value.submittedAt) || !Number.isFinite(Date.parse(value.submittedAt))) errors.push('Card-safety submission requires a valid timestamp.');
  const rawItems = Array.isArray(value.items) ? value.items : [];
  if (rawItems.length !== packet.items.length) errors.push(`Expected ${packet.items.length} card-safety judgments.`);
  const packetById = new Map(packet.items.map((item) => [item.blindId, item]));
  const seen = new Set<string>();
  for (const [index, raw] of rawItems.entries()) {
    if (!isRecord(raw)) { errors.push(`Card-safety judgment ${index + 1} is malformed.`); continue; }
    const blindId = nonEmptyString(raw.blindId) ? raw.blindId : '';
    if (!packetById.has(blindId)) errors.push(`${blindId || `Judgment ${index + 1}`} is not in the packet.`);
    if (seen.has(blindId)) errors.push(`Duplicate card-safety judgment ${blindId}.`);
    seen.add(blindId);
    if (!isRecord(raw.judgments)) { errors.push(`${blindId} has malformed safety criteria.`); continue; }
    const judgments = raw.judgments;
    const keys = Object.keys(judgments).sort();
    const expectedKeys = [...CARD_SAFETY_CRITERIA].sort();
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key, keyIndex) => key !== expectedKeys[keyIndex]) ||
      CARD_SAFETY_CRITERIA.some((key) => typeof judgments[key] !== 'boolean')
    ) errors.push(`${blindId} must complete exactly the five defined card-safety criteria.`);
    const anyFlag = CARD_SAFETY_CRITERIA.some((key) => judgments[key] === true);
    const spans = Array.isArray(raw.flaggedTextSpans) ? raw.flaggedTextSpans : [];
    if (anyFlag && (!spans.length || spans.some((span) => !nonEmptyString(span)))) errors.push(`${blindId} requires at least one flagged text span when a prohibited cue is present.`);
    if (!anyFlag && spans.length) errors.push(`${blindId} cannot report flagged spans when all safety criteria are false.`);
    const packetItem = packetById.get(blindId);
    const visibleText = packetItem?.cardRows.map((row) => `${row.label} ${row.text}`).join('\n') ?? '';
    if (spans.some((span) => nonEmptyString(span) && !visibleText.includes(span))) errors.push(`${blindId} contains a flagged span that is not verbatim in the card.`);
    if (!nonEmptyString(raw.sourceAssessmentRationale)) errors.push(`${blindId} requires a source-assessment rationale.`);
    if (!Number.isInteger(raw.reviewerConfidence) || Number(raw.reviewerConfidence) < 1 || Number(raw.reviewerConfidence) > 5) errors.push(`${blindId} reviewer confidence must be 1-5.`);
  }
  for (const blindId of packetById.keys()) if (!seen.has(blindId)) errors.push(`Card-safety submission is missing ${blindId}.`);
  return { valid: errors.length === 0, errors };
}

function unblind(
  submission: CardSafetySubmission,
  crosswalk: CardSafetyCrosswalkItem[],
): Map<string, { variantId: string; item: CardSafetySubmissionItem }> {
  if (crosswalk.length !== submission.items.length) throw new Error('Card-safety crosswalk must have one entry per judgment.');
  const blindIds = crosswalk.map((item) => item.blindId);
  const cardIds = crosswalk.map((item) => item.cardId);
  if (
    crosswalk.some((item) => !item.blindId.trim() || !item.cardId.trim() || !item.variantId.trim()) ||
    new Set(blindIds).size !== crosswalk.length ||
    new Set(cardIds).size !== crosswalk.length
  ) throw new Error('Card-safety crosswalk blind IDs and card IDs must be non-empty and unique.');
  const itemByBlind = new Map(submission.items.map((item) => [item.blindId, item]));
  if (blindIds.some((blindId) => !itemByBlind.has(blindId))) throw new Error('Card-safety crosswalk does not exactly match submitted blind IDs.');
  return new Map(crosswalk.map((entry) => [entry.cardId, { variantId: entry.variantId, item: itemByBlind.get(entry.blindId)! }]));
}

function gwetsAc1(first: boolean[], second: boolean[]): number {
  const observed = first.filter((value, index) => value === second[index]).length / first.length;
  const firstTrue = first.filter(Boolean).length / first.length;
  const secondTrue = second.filter(Boolean).length / second.length;
  const meanTrue = (firstTrue + secondTrue) / 2;
  const expected = 2 * meanTrue * (1 - meanTrue);
  return (observed - expected) / (1 - expected);
}

export function auditCardSafetyPair(options: {
  bundle: Study2DeliveryMaterials;
  firstPacket: CardSafetyPacket;
  firstCrosswalk: CardSafetyCrosswalkItem[];
  firstSubmission: CardSafetySubmission;
  secondPacket: CardSafetyPacket;
  secondCrosswalk: CardSafetyCrosswalkItem[];
  secondSubmission: CardSafetySubmission;
  reviewerRoster: CardSafetyReviewerRoster;
}): CardSafetyPairAudit {
  const errors: string[] = [];
  if (
    options.firstPacket.roundId !== options.secondPacket.roundId ||
    options.firstPacket.answerVariantVersion !== options.secondPacket.answerVariantVersion ||
    options.firstPacket.interventionCardVersion !== options.secondPacket.interventionCardVersion ||
    options.firstPacket.packetSeed !== options.secondPacket.packetSeed
  ) errors.push('Card-safety packets must belong to the same frozen round and material versions.');
  const reviewerIds = [options.firstPacket.reviewerId, options.secondPacket.reviewerId];
  if (reviewerIds[0] === reviewerIds[1]) errors.push('Card-safety review requires two distinct reviewer aliases.');
  errors.push(...validateCardSafetyReviewerRoster(options.reviewerRoster, reviewerIds).errors);
  errors.push(...validateCardSafetySubmission(options.firstSubmission, options.firstPacket).errors.map((error) => `First reviewer: ${error}`));
  errors.push(...validateCardSafetySubmission(options.secondSubmission, options.secondPacket).errors.map((error) => `Second reviewer: ${error}`));
  const empty = (): CardSafetyPairAudit => ({ valid: false, errors, rawCriterionAgreement: 0, gwetsAc1: 0, passesAggregateThresholds: false, allCardsRetained: false, items: [], counts: { cards: 0, criterionJudgments: 0, agreements: 0, retained: 0, disputedOrFlagged: 0 } });
  if (errors.length) return empty();
  let first: ReturnType<typeof unblind>;
  let second: ReturnType<typeof unblind>;
  try {
    first = unblind(options.firstSubmission, options.firstCrosswalk);
    second = unblind(options.secondSubmission, options.secondCrosswalk);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return empty();
  }
  const expected = options.bundle.variants.flatMap((variant) => variant.cards.map((card) => ({ cardId: card.cardId, variantId: variant.variantId })));
  if (expected.length !== 192 || new Set(expected.map((item) => item.cardId)).size !== 192 || expected.some(({ cardId }) => !first.has(cardId) || !second.has(cardId))) {
    errors.push('Card-safety pair audit requires exact coverage of 192 unique authored cards.');
    return empty();
  }
  const firstCriteria: boolean[] = [];
  const secondCriteria: boolean[] = [];
  const items = expected.map(({ cardId, variantId }): CardSafetyPairAuditItem => {
    const firstEntry = first.get(cardId)!;
    const secondEntry = second.get(cardId)!;
    if (firstEntry.variantId !== variantId || secondEntry.variantId !== variantId) errors.push(`${cardId} crosswalk has the wrong answer-variant identity.`);
    const firstJudgments = firstEntry.item.judgments as Record<CardSafetyCriterion, boolean>;
    const secondJudgments = secondEntry.item.judgments as Record<CardSafetyCriterion, boolean>;
    const exactAgreement = CARD_SAFETY_CRITERIA.every((criterion) => firstJudgments[criterion] === secondJudgments[criterion]);
    const prohibitedCueFound = CARD_SAFETY_CRITERIA.some((criterion) => firstJudgments[criterion] || secondJudgments[criterion]);
    for (const criterion of CARD_SAFETY_CRITERIA) {
      firstCriteria.push(firstJudgments[criterion]);
      secondCriteria.push(secondJudgments[criterion]);
    }
    return { cardId, variantId, firstJudgments, secondJudgments, exactAgreement, prohibitedCueFound, disposition: exactAgreement && !prohibitedCueFound ? 'retain' : 'revise_and_rereview' };
  });
  if (errors.length) return empty();
  items.sort((a, b) => a.cardId.localeCompare(b.cardId));
  const agreements = firstCriteria.filter((value, index) => value === secondCriteria[index]).length;
  const retained = items.filter((item) => item.disposition === 'retain').length;
  const rawCriterionAgreement = agreements / firstCriteria.length;
  const ac1 = gwetsAc1(firstCriteria, secondCriteria);
  return {
    valid: true,
    errors: [],
    rawCriterionAgreement,
    gwetsAc1: ac1,
    passesAggregateThresholds: rawCriterionAgreement >= 0.9 && ac1 >= 0.8,
    allCardsRetained: retained === 192,
    items,
    counts: { cards: 192, criterionJudgments: 960, agreements, retained, disputedOrFlagged: 192 - retained },
  };
}
