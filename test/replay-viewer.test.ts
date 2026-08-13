import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { ReplayViewer } from '../components/replay-viewer';
import type {
  BackendEvent,
  BackendIntegrity,
  BackendSession,
} from '../lib/replay-view-model';

const session: BackendSession = {
  session_id: 'sess-abc',
  study_id: 'demo',
  participant_id: 'P001',
  condition: 'v1',
  status: 'complete',
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:01:00Z',
  completed_at: '2026-08-01T00:01:00Z',
  accepted_event_count: 3,
  duplicate_event_count: 1,
  rejected_event_count: 0,
};

const events: BackendEvent[] = [
  {
    event_id: 'e0', study_id: 'demo', participant_id: 'P001', session_id: 'sess-abc',
    event_type: 'session_start', schema_version: 1, sequence_number: 0,
    client_timestamp: '2026-08-01T00:00:00Z', server_timestamp: '2026-08-01T00:00:00Z',
    condition: 'v1', payload: {}, idempotency_key: 'e0', flags: [],
  },
  {
    event_id: 'e1', study_id: 'demo', participant_id: 'P001', session_id: 'sess-abc',
    event_type: 'decision', schema_version: 1, sequence_number: 1,
    client_timestamp: '2026-08-01T00:00:30Z', server_timestamp: '2026-08-01T00:00:30Z',
    condition: 'v1',
    payload: {
      decision: 'trust', probabilityPrediction: 0.8, scenarioId: 'fitness-1', decisionTimeMs: 1200,
    },
    idempotency_key: 'e1', flags: [],
  },
  {
    event_id: 'e2', study_id: 'demo', participant_id: 'P001', session_id: 'sess-abc',
    event_type: 'decision_revision', schema_version: 1, sequence_number: 2,
    client_timestamp: '2026-08-01T00:01:00Z', server_timestamp: '2026-08-01T00:01:00Z',
    condition: 'v1',
    payload: { initialDecision: 'trust', finalDecision: 'distrust', scenarioId: 'fitness-1' },
    idempotency_key: 'e2', flags: [],
  },
];

const integrity: BackendIntegrity = {
  session_id: 'sess-abc',
  status: 'complete',
  verdict: 'warning',
  event_count: 3,
  duplicate_count: 1,
  rejected_count: 0,
  issues: [
    { category: 'duplicates', detail: '1 event re-insertion(s) detected and skipped', event_ids: [] },
  ],
};

function renderViewer(s: BackendSession, e: BackendEvent[], i: BackendIntegrity): string {
  return renderToString(createElement(ReplayViewer, { session: s, events: e, integrity: i }));
}

test('viewer renders session metadata and status', () => {
  const html = renderViewer(session, events, integrity);
  assert.match(html, /Session Replay/);
  assert.match(html, /sess-abc/);
  assert.match(html, /P001/);
  assert.match(html, /COMPLETE/);
  assert.match(html, /WARNING/);
});

test('viewer renders integrity warnings', () => {
  const html = renderViewer(session, events, integrity);
  assert.match(html, /Integrity Warnings/);
  assert.match(html, /duplicates/);
  assert.match(html, /re-insertion/);
});

test('viewer renders decision + revision events with payload detail', () => {
  const html = renderViewer(session, events, integrity);
  assert.match(html, /decision/);
  assert.match(html, /Decision Revision/);
  assert.match(html, /fitness-1/);
  assert.match(html, /probabilityPrediction/);
  assert.match(html, /0\.8/);
});

test('viewer shows no-warning state for an ok session', () => {
  const okIntegrity: BackendIntegrity = { ...integrity, verdict: 'ok', issues: [], duplicate_count: 0 };
  const html = renderViewer(session, events, okIntegrity);
  assert.match(html, /No integrity warnings/);
  assert.match(html, />OK</);
});

test('viewer handles an empty event list', () => {
  const html = renderViewer(session, [], { ...integrity, event_count: 0 });
  assert.match(html, /No events recorded/);
});
