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
  const scenarios = placeholderScenarioPool('v0');
  const first = generateAllocation({ participants: 24, scenarios, seed: 'a', materialVersion: 'v0' });
  const second = generateAllocation({ participants: 24, scenarios, seed: 'b', materialVersion: 'v0' });

  assert.notDeepEqual(
    first.trials.map((trial) => trial.scenarioId),
    second.trials.map((trial) => trial.scenarioId),
  );
  assert.equal(auditAllocation(first).valid, true);
  assert.equal(auditAllocation(second).valid, true);
});

test('allocation rejects a scenario pool from a different material version', () => {
  assert.throws(
    () => generateAllocation({
      participants: 24,
      scenarios: placeholderScenarioPool('materials-v1'),
      seed: 'lineage',
      materialVersion: 'materials-v2',
    }),
    /match the allocation material version/,
  );
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

test('every participant order satisfies the frozen run-length and half-session constraints', () => {
  const allocation = generateAllocation({
    participants: 240,
    scenarios: placeholderScenarioPool('study2-candidates-v0.6'),
    seed: 'study2-order-constraints-v1',
    materialVersion: 'study2-candidates-v0.6',
  });
  const audit = auditAllocation(allocation);
  assert.equal(audit.valid, true, audit.errors.join('\n'));
  for (let participantIndex = 0; participantIndex < 240; participantIndex += 1) {
    const trials = allocation.trials
      .filter((trial) => trial.participantIndex === participantIndex)
      .sort((first, second) => first.trialIndex - second.trialIndex);
    for (const field of ['accuracy', 'interventionType'] as const) {
      let run = 1;
      for (let index = 1; index < trials.length; index += 1) {
        run = trials[index][field] === trials[index - 1][field] ? run + 1 : 1;
        assert.ok(run <= 3, `${participantIndex} ${field} run ${run}`);
      }
    }
    assert.equal(trials.slice(0, 8).filter((trial) => trial.matchStatus === 'matched').length, 4);
    assert.equal(trials.slice(8).filter((trial) => trial.matchStatus === 'matched').length, 4);
  }
});

test('allocation audit rejects an order that violates frozen sequence constraints', () => {
  const allocation = generateAllocation({
    participants: 24,
    scenarios: placeholderScenarioPool('study2-candidates-v0.6'),
    seed: 'study2-order-tamper-v1',
    materialVersion: 'study2-candidates-v0.6',
  });
  const firstParticipant = allocation.trials
    .filter((trial) => trial.participantIndex === 0)
    .sort((first, second) => first.accuracy.localeCompare(second.accuracy));
  firstParticipant.forEach((trial, trialIndex) => {
    trial.trialIndex = trialIndex;
  });
  const audit = auditAllocation(allocation);
  assert.equal(audit.valid, false);
  assert.match(audit.errors.join('\n'), /more than three consecutive answers/);
});
