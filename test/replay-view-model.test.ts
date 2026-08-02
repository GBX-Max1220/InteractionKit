import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTimeline,
  buildWarnings,
  classifyEvent,
  verdictLabel,
  type BackendEvent,
  type BackendIntegrity,
} from '../lib/replay-view-model';

function ev(seq: number, eventType: string, clientTs = '2026-08-01T00:00:00Z'): BackendEvent {
  return {
    event_id: `e-${seq}`,
    study_id: 'demo',
    participant_id: 'P1',
    session_id: 's1',
    event_type: eventType,
    schema_version: 1,
    sequence_number: seq,
    client_timestamp: clientTs,
    server_timestamp: `2026-08-01T00:00:0${seq}Z`,
    condition: 'v1',
    payload: {},
    idempotency_key: `e-${seq}`,
    flags: [],
  };
}

test('buildTimeline sorts by sequence number', () => {
  const rows = buildTimeline([ev(2, 'session_complete'), ev(0, 'session_start'), ev(1, 'decision')]);
  assert.deepEqual(rows.map((r) => r.sequenceNumber), [0, 1, 2]);
  assert.deepEqual(rows.map((r) => r.eventType), ['session_start', 'decision', 'session_complete']);
});

test('buildTimeline marks flagged events as anomalies', () => {
  const flagged = ev(1, 'decision');
  flagged.flags = ['invalid_condition'];
  const rows = buildTimeline([ev(0, 'session_start'), flagged]);
  assert.equal(rows[1].isAnomaly, true);
  assert.equal(rows[0].isAnomaly, false);
});

test('classifyEvent maps known and unknown types', () => {
  assert.equal(classifyEvent('session_start'), 'session');
  assert.equal(classifyEvent('decision'), 'decision');
  assert.equal(classifyEvent('confidence'), 'confidence');
  assert.equal(classifyEvent('evidence_open'), 'evidence');
  assert.equal(classifyEvent('decision_revision'), 'revision');
  assert.equal(classifyEvent('outcome'), 'outcome');
  assert.equal(classifyEvent('tsi_response'), 'questionnaire');
  assert.equal(classifyEvent('something_new'), 'other');
});

test('buildWarnings flattens integrity issues', () => {
  const integrity: BackendIntegrity = {
    session_id: 's1',
    status: 'complete',
    verdict: 'warning',
    event_count: 3,
    duplicate_count: 1,
    rejected_count: 0,
    issues: [
      { category: 'duplicates', detail: '1 duplicate', event_ids: [] },
      { category: 'out_of_order', detail: 'out of order', event_ids: ['e-2'] },
    ],
  };
  const warnings = buildWarnings(integrity);
  assert.equal(warnings.length, 2);
  assert.equal(warnings[0].category, 'duplicates');
  assert.deepEqual(warnings[1].eventIds, ['e-2']);
});

test('verdictLabel renders all three states', () => {
  assert.equal(verdictLabel('ok'), 'OK');
  assert.equal(verdictLabel('warning'), 'WARNING');
  assert.equal(verdictLabel('corrupted'), 'CORRUPTED');
});
