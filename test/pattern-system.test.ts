import assert from 'node:assert/strict';
import test from 'node:test';
import Ajv from 'ajv';
import { validate } from '../src/composition';
import { demoComposition } from '../src/demo';
import { serialize } from '../src/log';
import {
  confidenceDisplayRenderer,
  outcomeFeedbackRenderer,
  relianceDecisionRenderer,
} from '../src/patterns';
import { patternRegistry } from '../src/specs';
import type {
  ChoiceComposition,
  PatternOutput,
  SequenceComposition,
} from '../src/types';

const confidenceInput = {
  trialIndex: 0,
  scenarioId: 'test-01',
  aiOutput: 'Use the AI recommendation.',
  aiIsCorrect: true,
  confidencePoint: 0.8,
  confidenceRangeLower: 0.7,
  confidenceRangeUpper: 0.9,
  calibratedAccuracy: 0.76,
};

test('Pattern specs use the standardized measurement model contract', () => {
  const allowedRoles = new Set(['manipulated', 'measured', 'outcome']);

  for (const spec of Object.values(patternRegistry)) {
    assert.deepEqual(Object.keys(spec.measurementModel).sort(), [
      'intendedConstruct',
      'role',
    ]);
    assert.ok(spec.measurementModel.intendedConstruct.trim().length > 0);
    assert.equal(allowedRoles.has(spec.measurementModel.role), true);
  }
});

test('ConfidenceDisplay variants emit invariant output columns', () => {
  const formats = ['point_only', 'range', 'calibrated_badge'] as const;
  const outputs = formats.map((format) =>
    confidenceDisplayRenderer.collect(
      confidenceDisplayRenderer.setup(confidenceInput, { format }),
    ),
  );
  const referenceColumns = Object.keys(outputs[0]).sort();

  for (const output of outputs) {
    assert.deepEqual(Object.keys(output).sort(), referenceColumns);
    assert.equal(confidenceDisplayRenderer.validate(output), true);
  }
});

test('Sequence validates and derives a schema with column origins', () => {
  const result = validate(demoComposition);

  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.ok(result.derivedSchema.properties.humanDecision);
  assert.ok(result.derivedSchema.properties.feedbackOutcome);
  assert.deepEqual(
    result.derivedSchema.properties.scenarioId[
      'x-interactionkit-origin'
    ],
    [
      'ConfidenceDisplay@1.0.0#uncertainty',
      'RelianceDecision@1.0.0#reliance',
      'OutcomeFeedback@1.0.0#feedback',
    ],
  );
});

test('Sequence rejects missing inputs and disallowed ordering', () => {
  const invalid: SequenceComposition = {
    ...demoComposition,
    initialInput: {
      type: 'object',
      properties: {},
      required: [],
    },
    patterns: [...demoComposition.patterns].reverse(),
  };
  const result = validate(invalid);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('not allowed')));
  assert.ok(result.errors.some((error) => error.includes('requires input')));
});

test('Choice requires branches to emit the same columns', () => {
  const shorter: SequenceComposition = {
    ...demoComposition,
    id: 'short-branch',
    patterns: demoComposition.patterns.slice(0, 2),
  };
  const choice: ChoiceComposition = {
    kind: 'choice',
    id: 'choice-test',
    version: '1.0.0',
    branches: [
      { id: 'full', composition: demoComposition },
      { id: 'short', composition: shorter },
    ],
  };
  const result = validate(choice);

  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((error) => error.includes('different output columns')),
  );
  assert.ok(result.derivedSchema.properties.choiceBranch);
});

test('Choice accepts schema-equivalent branches and adds a branch indicator', () => {
  const alternative: SequenceComposition = {
    ...demoComposition,
    id: 'alternative-branch',
    patterns: demoComposition.patterns.map((pattern) =>
      pattern.pattern === 'ConfidenceDisplay'
        ? { ...pattern, id: 'alternative-uncertainty' }
        : { ...pattern, id: `alternative-${pattern.id}` },
    ),
  };
  const choice: ChoiceComposition = {
    kind: 'choice',
    id: 'valid-choice-test',
    version: '1.0.0',
    branches: [
      { id: 'range-a', composition: demoComposition },
      { id: 'range-b', composition: alternative },
    ],
  };
  const result = validate(choice);

  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.deepEqual(result.derivedSchema.properties.choiceBranch.enum, [
    'range-a',
    'range-b',
  ]);
});

test('JSONL contains one self-describing header and one row per pattern', () => {
  const confidence = confidenceDisplayRenderer.collect(
    confidenceDisplayRenderer.setup(confidenceInput, { format: 'range' }),
  );
  const reliance = relianceDecisionRenderer.collect({
    ...relianceDecisionRenderer.setup(confidenceInput, { mode: 'binary' }),
    humanDecision: 'rely',
  });
  const feedback = outcomeFeedbackRenderer.collect(
    outcomeFeedbackRenderer.setup(
      {
        trialIndex: reliance.trialIndex,
        scenarioId: reliance.scenarioId,
        humanDecision: reliance.humanDecision,
        aiIsCorrect: reliance.aiIsCorrect,
      },
      { timing: 'immediate' },
    ),
  );
  const jsonl = serialize(
    [confidence, reliance, feedback] as PatternOutput[],
    demoComposition,
  );
  const records = jsonl.split('\n').map((line) => JSON.parse(line));

  assert.equal(records.length, 4);
  assert.equal(records[0].recordType, 'interactionkit_header');
  assert.equal(records[0].rowSemantics.includes('per pattern instance'), true);
  assert.equal(records[0].patternDefinitions.length, 3);
  assert.deepEqual(
    records.slice(1).map((row) => row.patternInstanceId),
    ['uncertainty', 'reliance', 'feedback'],
  );

  const ajv = new Ajv({ strict: false, validateFormats: false });
  const validateRow = ajv.compile(records[0].rowSchema);
  for (const row of records.slice(1)) {
    assert.equal(validateRow(row), true, ajv.errorsText(validateRow.errors));
  }
});
