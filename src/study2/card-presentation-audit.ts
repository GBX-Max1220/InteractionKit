export const CARD_PRESENTATION_VIEWPORTS = [375, 768, 1280] as const;

export interface CardGeometryMeasurement {
  viewportWidth: number;
  variantId: string;
  cardId: string;
  width: number;
  height: number;
  clientWidth: number;
  scrollWidth: number;
  rowTops: number[];
  rowHeights: number[];
}

export interface CardPresentationGeometryAudit {
  valid: boolean;
  equivalent: boolean;
  errors: string[];
  counts: { viewports: number; variants: number; measurements: number; comparisons: number };
  maximumPairHeightDifferencePx: number;
  maximumRowTopDifferencePx: number;
  maximumRowHeightDifferencePx: number;
}

function finiteNonnegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function auditCardPresentationGeometry(options: {
  measurements: CardGeometryMeasurement[];
  expectedVariantCardIds: Map<string, string[]>;
}): CardPresentationGeometryAudit {
  const errors: string[] = [];
  const expectedVariants = [...options.expectedVariantCardIds.entries()];
  if (expectedVariants.length !== 96 || expectedVariants.some(([, cardIds]) => cardIds.length !== 2 || new Set(cardIds).size !== 2)) {
    errors.push('Presentation audit requires 96 variants with exactly two unique cards each.');
  }
  const expectedCardIds = expectedVariants.flatMap(([, cardIds]) => cardIds);
  if (new Set(expectedCardIds).size !== 192) errors.push('Presentation audit requires 192 globally unique card IDs.');
  const expectedViewports = new Set<number>(CARD_PRESENTATION_VIEWPORTS);
  const seen = new Set<string>();
  for (const [index, measurement] of options.measurements.entries()) {
    const key = `${measurement.viewportWidth}:${measurement.cardId}`;
    if (seen.has(key)) errors.push(`Duplicate geometry measurement ${key}.`);
    seen.add(key);
    if (!expectedViewports.has(measurement.viewportWidth)) errors.push(`Measurement ${index + 1} uses an unexpected viewport.`);
    if (!options.expectedVariantCardIds.get(measurement.variantId)?.includes(measurement.cardId)) errors.push(`Measurement ${key} has an invalid variant/card identity.`);
    if (
      !finiteNonnegative(measurement.width) ||
      !finiteNonnegative(measurement.height) ||
      !finiteNonnegative(measurement.clientWidth) ||
      !finiteNonnegative(measurement.scrollWidth) ||
      measurement.rowTops.length !== 3 ||
      measurement.rowHeights.length !== 3 ||
      [...measurement.rowTops, ...measurement.rowHeights].some((value) => !finiteNonnegative(value))
    ) errors.push(`Measurement ${key} contains malformed geometry.`);
    if (measurement.scrollWidth > measurement.clientWidth + 1) errors.push(`Card ${measurement.cardId} horizontally overflows at ${measurement.viewportWidth}px.`);
  }
  for (const viewport of CARD_PRESENTATION_VIEWPORTS) {
    for (const [variantId, cardIds] of expectedVariants) {
      for (const cardId of cardIds) {
        if (!seen.has(`${viewport}:${cardId}`)) errors.push(`Missing ${viewport}px geometry for ${variantId}/${cardId}.`);
      }
    }
  }
  let maximumPairHeightDifferencePx = 0;
  let maximumRowTopDifferencePx = 0;
  let maximumRowHeightDifferencePx = 0;
  let comparisons = 0;
  if (!errors.length) {
    const byKey = new Map(options.measurements.map((item) => [`${item.viewportWidth}:${item.cardId}`, item]));
    for (const viewport of CARD_PRESENTATION_VIEWPORTS) {
      for (const [variantId, cardIds] of expectedVariants) {
        const first = byKey.get(`${viewport}:${cardIds[0]}`)!;
        const second = byKey.get(`${viewport}:${cardIds[1]}`)!;
        const widthDifference = Math.abs(first.width - second.width);
        const heightDifference = Math.abs(first.height - second.height);
        maximumPairHeightDifferencePx = Math.max(maximumPairHeightDifferencePx, heightDifference);
        if (widthDifference > 1) errors.push(`${variantId} card widths differ by ${widthDifference}px at ${viewport}px.`);
        if (heightDifference > 1) errors.push(`${variantId} card heights differ by ${heightDifference}px at ${viewport}px.`);
        for (let row = 0; row < 3; row += 1) {
          const topDifference = Math.abs(first.rowTops[row] - second.rowTops[row]);
          const rowHeightDifference = Math.abs(first.rowHeights[row] - second.rowHeights[row]);
          maximumRowTopDifferencePx = Math.max(maximumRowTopDifferencePx, topDifference);
          maximumRowHeightDifferencePx = Math.max(maximumRowHeightDifferencePx, rowHeightDifference);
          if (topDifference > 1) errors.push(`${variantId} row ${row + 1} starts differ by ${topDifference}px at ${viewport}px.`);
          if (rowHeightDifference > 1) errors.push(`${variantId} row ${row + 1} heights differ by ${rowHeightDifference}px at ${viewport}px.`);
        }
        comparisons += 1;
      }
    }
  }
  return {
    valid: errors.length === 0,
    equivalent: errors.length === 0 && comparisons === 288,
    errors,
    counts: {
      viewports: new Set(options.measurements.map((item) => item.viewportWidth)).size,
      variants: expectedVariants.length,
      measurements: options.measurements.length,
      comparisons,
    },
    maximumPairHeightDifferencePx,
    maximumRowTopDifferencePx,
    maximumRowHeightDifferencePx,
  };
}
