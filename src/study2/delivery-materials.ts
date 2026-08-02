import type { FrozenStudy2MaterialsArtifact } from './frozen-materials';
import type { CandidateScenario } from './materials';
import {
  ACCURACY_LEVELS,
  FAILURE_FAMILIES,
  INTERVENTION_TYPES,
  type AccuracyLevel,
  type FailureFamily,
  type InterventionType,
} from './types';

export interface DeliveryCardRow {
  label: string;
  text: string;
}

export interface DeliveryInterventionCard {
  cardId: string;
  interventionType: InterventionType;
  rows: DeliveryCardRow[];
  citationSourceId: string;
}

export interface DeliveryAnswerVariant {
  variantId: string;
  scenarioId: string;
  failureFamily: FailureFamily;
  accuracy: AccuracyLevel;
  coreRecommendationOption: 'option_a' | 'option_b';
  answerText: string;
  targetFailureSpan: string;
  precisionFailurePresent: boolean | null;
  boundaryFailurePresent: boolean | null;
  coreRecommendationOnlyAccuracyStatus: boolean | null;
  displayedConfidenceEmbedded: boolean | null;
  cards: DeliveryInterventionCard[];
}

export interface Study2DeliveryMaterials {
  schemaVersion: 'study2-delivery-materials-v1';
  roundId: string;
  frozenMaterialVersion: string;
  answerVariantVersion: string;
  interventionCardVersion: string;
  sourceFrozenMaterialsSha256: string;
  variants: DeliveryAnswerVariant[];
}

export interface DeliveryMaterialAudit {
  structurallyValid: boolean;
  pilotReady: false;
  errors: string[];
  warnings: string[];
  counts: {
    scenarios: number;
    answerVariants: number;
    interventionCards: number;
  };
}

const CARD_LABELS: Record<InterventionType, readonly [string, string, string]> = {
  numerical_warrant_card: ['Claimed value', 'Evidence-supported value', 'Source'],
  boundary_condition_card: ['Default applies when', 'Recommendation changes when', 'Source'],
};

function opposite(option: 'option_a' | 'option_b'): 'option_a' | 'option_b' {
  return option === 'option_a' ? 'option_b' : 'option_a';
}

function expectedCoreOption(
  groundTruth: 'option_a' | 'option_b',
  accuracy: AccuracyLevel,
): 'option_a' | 'option_b' {
  return accuracy === 'correct' ? groundTruth : opposite(groundTruth);
}

export function deliveryVariantId(
  scenarioId: string,
  failureFamily: FailureFamily,
  accuracy: AccuracyLevel,
): string {
  return `${scenarioId}::${failureFamily}::${accuracy}`;
}

export function deliveryCardId(
  variantId: string,
  interventionType: InterventionType,
): string {
  return `${variantId}::${interventionType}`;
}

export function visibleWordCount(rows: DeliveryCardRow[]): number {
  return rows
    .flatMap((row) => `${row.label} ${row.text}`.trim().split(/\s+/u))
    .filter(Boolean).length;
}

export function buildDeliveryAuthoringTemplate(options: {
  frozen: FrozenStudy2MaterialsArtifact;
  answerVariantVersion: string;
  interventionCardVersion: string;
  sourceFrozenMaterialsSha256: string;
}): Study2DeliveryMaterials {
  if (!Array.isArray(options.frozen.items) || options.frozen.items.length !== 24) {
    throw new Error('Delivery authoring requires exactly 24 frozen scenarios.');
  }
  if (
    new Set(options.frozen.items.map((item) => item.candidateId)).size !== 24 ||
    options.frozen.items.some(
      (item) =>
        !['option_a', 'option_b'].includes(item.finalBinaryDecision) ||
        !['strong_consensus', 'mixed_or_conditional'].includes(item.finalSupportLevel),
    )
  ) {
    throw new Error('Frozen scenarios require unique IDs and resolved final labels.');
  }
  if (!/^[a-f0-9]{64}$/.test(options.sourceFrozenMaterialsSha256)) {
    throw new Error('Delivery authoring requires the frozen-material file SHA-256.');
  }
  if (!options.answerVariantVersion.trim() || !options.interventionCardVersion.trim()) {
    throw new Error('Delivery authoring requires explicit answer and card versions.');
  }
  const variants = options.frozen.items.flatMap((item) =>
    FAILURE_FAMILIES.flatMap((failureFamily) =>
      ACCURACY_LEVELS.map((accuracy): DeliveryAnswerVariant => {
        const variantId = deliveryVariantId(item.candidateId, failureFamily, accuracy);
        return {
          variantId,
          scenarioId: item.candidateId,
          failureFamily,
          accuracy,
          coreRecommendationOption: expectedCoreOption(item.finalBinaryDecision, accuracy),
          answerText: '',
          targetFailureSpan: '',
          precisionFailurePresent: null,
          boundaryFailurePresent: null,
          coreRecommendationOnlyAccuracyStatus: null,
          displayedConfidenceEmbedded: null,
          cards: INTERVENTION_TYPES.map((interventionType) => ({
            cardId: deliveryCardId(variantId, interventionType),
            interventionType,
            rows: CARD_LABELS[interventionType].map((label) => ({ label, text: '' })),
            citationSourceId: '',
          })),
        };
      }),
    ),
  );
  variants.sort((first, second) => first.variantId.localeCompare(second.variantId));
  return {
    schemaVersion: 'study2-delivery-materials-v1',
    roundId: options.frozen.roundId,
    frozenMaterialVersion: options.frozen.materialVersion,
    answerVariantVersion: options.answerVariantVersion,
    interventionCardVersion: options.interventionCardVersion,
    sourceFrozenMaterialsSha256: options.sourceFrozenMaterialsSha256,
    variants,
  };
}

export function auditDeliveryMaterials(options: {
  bundle: Study2DeliveryMaterials;
  frozen: FrozenStudy2MaterialsArtifact;
  candidates: CandidateScenario[];
  expectedFrozenMaterialsSha256: string;
  expectedAnswerVariantVersion?: string;
  expectedInterventionCardVersion?: string;
}): DeliveryMaterialAudit {
  const errors: string[] = [];
  const warnings = [
    'Structural validity does not replace independent taxonomy coding, direct-verdict leakage review, wording equivalence testing, or participant pretesting.',
  ];
  const frozenById = new Map(options.frozen.items.map((item) => [item.candidateId, item]));
  const candidateById = new Map(options.candidates.map((candidate) => [candidate.id, candidate]));
  if (options.bundle.schemaVersion !== 'study2-delivery-materials-v1') errors.push('Unsupported delivery-material schema.');
  if (
    options.bundle.roundId !== options.frozen.roundId ||
    options.bundle.frozenMaterialVersion !== options.frozen.materialVersion
  ) errors.push('Delivery materials do not match the frozen round or material version.');
  if (options.bundle.sourceFrozenMaterialsSha256 !== options.expectedFrozenMaterialsSha256) errors.push('Delivery materials do not match the frozen-material file hash.');
  if (!options.bundle.answerVariantVersion.trim() || !options.bundle.interventionCardVersion.trim()) errors.push('Delivery materials require explicit answer and card versions.');
  if (
    options.expectedAnswerVariantVersion &&
    options.bundle.answerVariantVersion !== options.expectedAnswerVariantVersion
  ) errors.push('Answer-variant version does not match the authoring manifest.');
  if (
    options.expectedInterventionCardVersion &&
    options.bundle.interventionCardVersion !== options.expectedInterventionCardVersion
  ) errors.push('Intervention-card version does not match the authoring manifest.');
  if (frozenById.size !== 24) errors.push(`Expected 24 frozen scenarios; found ${frozenById.size}.`);
  const expectedVariantIds = new Set(
    options.frozen.items.flatMap((item) =>
      FAILURE_FAMILIES.flatMap((failure) =>
        ACCURACY_LEVELS.map((accuracy) => deliveryVariantId(item.candidateId, failure, accuracy)),
      ),
    ),
  );
  const seenVariantIds = new Set<string>();
  let interventionCards = 0;
  for (const variant of options.bundle.variants) {
    if (seenVariantIds.has(variant.variantId)) errors.push(`Duplicate answer variant ${variant.variantId}.`);
    seenVariantIds.add(variant.variantId);
    if (!expectedVariantIds.has(variant.variantId)) {
      errors.push(`Unexpected answer variant ${variant.variantId}.`);
      continue;
    }
    if (variant.variantId !== deliveryVariantId(variant.scenarioId, variant.failureFamily, variant.accuracy)) errors.push(`${variant.variantId} has inconsistent identity fields.`);
    const frozen = frozenById.get(variant.scenarioId)!;
    if (variant.coreRecommendationOption !== expectedCoreOption(frozen.finalBinaryDecision, variant.accuracy)) errors.push(`${variant.variantId} has the wrong core recommendation for its accuracy condition.`);
    if (!variant.answerText.trim() || !variant.targetFailureSpan.trim()) errors.push(`${variant.variantId} has incomplete answer text or target-failure span.`);
    if (variant.targetFailureSpan.trim() && !variant.answerText.includes(variant.targetFailureSpan)) errors.push(`${variant.variantId} target-failure span is not present verbatim in the answer.`);
    const expectsPrecision = variant.failureFamily === 'unsupported_numerical_precision';
    if (variant.precisionFailurePresent !== expectsPrecision || variant.boundaryFailurePresent !== !expectsPrecision) errors.push(`${variant.variantId} does not demonstrate single-family failure purity.`);
    if (variant.coreRecommendationOnlyAccuracyStatus !== true) errors.push(`${variant.variantId} has not passed the single-accuracy-status authoring check.`);
    if (variant.displayedConfidenceEmbedded !== false) errors.push(`${variant.variantId} must keep displayed confidence out of authored answer text.`);
    if (variant.cards.length !== 2) errors.push(`${variant.variantId} requires exactly two intervention cards.`);
    const seenCardTypes = new Set<InterventionType>();
    const cardWordCounts: number[] = [];
    for (const card of variant.cards) {
      interventionCards += 1;
      if (seenCardTypes.has(card.interventionType)) errors.push(`${variant.variantId} duplicates ${card.interventionType}.`);
      seenCardTypes.add(card.interventionType);
      if (card.cardId !== deliveryCardId(variant.variantId, card.interventionType)) errors.push(`${card.cardId} has an inconsistent card ID.`);
      const expectedLabels = CARD_LABELS[card.interventionType];
      if (!expectedLabels || card.rows.length !== 3 || card.rows.some((row, index) => row.label !== expectedLabels[index])) errors.push(`${card.cardId} does not use the locked three-row layout.`);
      if (card.rows.some((row) => !row.text.trim())) errors.push(`${card.cardId} contains an empty visible row.`);
      const wordCount = visibleWordCount(card.rows);
      cardWordCounts.push(wordCount);
      if (wordCount < 35 || wordCount > 45) errors.push(`${card.cardId} has ${wordCount} visible words; required range is 35-45.`);
      if (/\b(?:correct|incorrect|wrong|myth|trust|distrust)\b/i.test(card.rows.map((row) => row.text).join(' '))) errors.push(`${card.cardId} contains a prohibited direct-verdict cue.`);
      const candidate = candidateById.get(variant.scenarioId);
      if (!candidate?.evidenceSources.some((source) => source.id === card.citationSourceId)) errors.push(`${card.cardId} citation source is not in the frozen candidate dossier.`);
    }
    for (const interventionType of INTERVENTION_TYPES) {
      if (!seenCardTypes.has(interventionType)) errors.push(`${variant.variantId} is missing ${interventionType}.`);
    }
    if (cardWordCounts.length === 2 && cardWordCounts[0] !== cardWordCounts[1]) errors.push(`${variant.variantId} card pair is not exactly word-count matched.`);
  }
  for (const expectedVariantId of expectedVariantIds) {
    if (!seenVariantIds.has(expectedVariantId)) errors.push(`Missing answer variant ${expectedVariantId}.`);
  }
  if (options.bundle.variants.length !== 96) errors.push(`Expected 96 answer variants; received ${options.bundle.variants.length}.`);
  if (interventionCards !== 192) errors.push(`Expected 192 intervention cards; received ${interventionCards}.`);
  return {
    structurallyValid: errors.length === 0,
    pilotReady: false,
    errors,
    warnings,
    counts: {
      scenarios: frozenById.size,
      answerVariants: options.bundle.variants.length,
      interventionCards,
    },
  };
}
