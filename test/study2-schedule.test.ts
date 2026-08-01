import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditAllocation,
  generateAllocation,
  placeholderScenarioPool,
} from '../src/study2/schedule';

test('Study 2 allocation exactly balances the frozen 240-participant design', () => {
  const allocation = generateAllocation({
    participants: 240,
    scenarios: placeholderScenarioPool(),
    seed: 'study2-allocation-v1',
    materialVersion: 'study2-materials-draft-v0',
  });
  const audit = auditAllocation(allocation);

  assert.equal(audit.valid, true, audit.errors.join('\n'));
  assert.equal(audit.participants, 240);
  assert.equal(audit.trials, 3840);
  assert.equal(Object.keys(audit.fullCellCounts).length, 32);
  assert.deepEqual(new Set(Object.values(audit.fullCellCounts)), new Set([120]));
  assert.equal(Object.keys(audit.scenarioExposureCounts).length, 24);
  assert.deepEqual(new Set(Object.values(audit.scenarioExposureCounts)), new Set([160]));
  assert.equal(audit.designRank, 7);
});

test('allocation generation is deterministic for a fixed seed', () => {
  const options = {
    participants: 24,
    scenarios: placeholderScenarioPool(),
    seed: 'reproducible-seed',
    materialVersion: 'study2-materials-draft-v0',
  };
  assert.deepEqual(generateAllocation(options), generateAllocation(options));
});

test('different seeds change trial order without changing balance', () => {
  const scenarios = placeholderScenarioPool();
  const first = generateAllocation({ participants: 24, scenarios, seed: 'a', materialVersion: 'v0' });
  const second = generateAllocation({ participants: 24, scenarios, seed: 'b', materialVersion: 'v0' });

  assert.notDeepEqual(
    first.trials.map((trial) => trial.scenarioId),
    second.trials.map((trial) => trial.scenarioId),
  );
  assert.equal(auditAllocation(first).valid, true);
  assert.equal(auditAllocation(second).valid, true);
});

test('participant counts that cannot guarantee exact balance are rejected', () => {
  assert.throws(
    () =>
      generateAllocation({
        participants: 25,
        scenarios: placeholderScenarioPool(),
        seed: 'invalid',
        materialVersion: 'v0',
      }),
    /multiple of 24/,
  );
});
