import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  STUDY2_CARD_PRESENTATION_CSS,
  Study2InterventionCard,
} from '../components/study2-intervention-card';
import {
  auditCardPresentationGeometry,
  CARD_PRESENTATION_VIEWPORTS,
  type CardGeometryMeasurement,
} from '../src/study2/card-presentation-audit';
import type { DeliveryInterventionCard } from '../src/study2/delivery-materials';

function card(cardId: string, labels: string[]): DeliveryInterventionCard {
  return {
    cardId,
    interventionType: cardId.endsWith('n') ? 'numerical_warrant_card' : 'boundary_condition_card',
    citationSourceId: 'private-source-id',
    rows: labels.map((label, index) => ({ label, text: `Participant-visible evidence statement ${index + 1}.` })),
  };
}

test('canonical Study 2 card renderer exposes no condition identity or type-specific styling', () => {
  const numerical = card('internal-n', ['Claimed value', 'Evidence-supported value', 'Source']);
  const boundary = card('internal-b', ['Default applies when', 'Recommendation changes when', 'Source']);
  const numericalMarkup = renderToStaticMarkup(<Study2InterventionCard card={numerical} />);
  const boundaryMarkup = renderToStaticMarkup(<Study2InterventionCard card={boundary} />);
  for (const markup of [numericalMarkup, boundaryMarkup]) {
    assert.doesNotMatch(markup, /internal-[nb]|private-source-id|numerical_warrant|boundary_condition/);
    assert.match(markup, /aria-label="Evidence check"/);
    assert.equal((markup.match(/class="s2-intervention-card__row"/g) ?? []).length, 3);
  }
  assert.doesNotMatch(STUDY2_CARD_PRESENTATION_CSS, /numerical|boundary|nth-child|data-/i);
  assert.match(STUDY2_CARD_PRESENTATION_CSS, /container-type:inline-size/);
  assert.match(STUDY2_CARD_PRESENTATION_CSS, /@container\(max-width:30rem\)/);
});

function completeGeometry(): {
  measurements: CardGeometryMeasurement[];
  expectedVariantCardIds: Map<string, string[]>;
} {
  const expectedVariantCardIds = new Map<string, string[]>();
  const measurements: CardGeometryMeasurement[] = [];
  for (let variantIndex = 1; variantIndex <= 96; variantIndex += 1) {
    const variantId = `variant-${variantIndex}`;
    const cardIds = [`${variantId}-n`, `${variantId}-b`];
    expectedVariantCardIds.set(variantId, cardIds);
    for (const viewportWidth of CARD_PRESENTATION_VIEWPORTS) {
      for (const cardId of cardIds) {
        measurements.push({
          viewportWidth,
          variantId,
          cardId,
          width: Math.min(672, viewportWidth - 32),
          height: 310,
          clientWidth: Math.min(672, viewportWidth - 32),
          scrollWidth: Math.min(672, viewportWidth - 32),
          rowTops: [60, 140, 220],
          rowHeights: [70, 70, 70],
        });
      }
    }
  }
  return { measurements, expectedVariantCardIds };
}

test('geometry contract requires exact pair equivalence across all three viewports', () => {
  const fixture = completeGeometry();
  const audit = auditCardPresentationGeometry(fixture);
  assert.equal(audit.valid, true, audit.errors.join('\n'));
  assert.equal(audit.equivalent, true);
  assert.deepEqual(audit.counts, { viewports: 3, variants: 96, measurements: 576, comparisons: 288 });
});

test('geometry contract rejects missing cards, overflow, and one-pixel-exceeding pair drift', () => {
  const fixture = completeGeometry();
  fixture.measurements.shift();
  fixture.measurements[0].scrollWidth += 2;
  fixture.measurements[1].height += 2;
  const audit = auditCardPresentationGeometry(fixture);
  assert.equal(audit.valid, false);
  assert.equal(audit.equivalent, false);
  assert.match(audit.errors.join('\n'), /Missing 375px geometry/);
  assert.match(audit.errors.join('\n'), /horizontally overflows/);
});
