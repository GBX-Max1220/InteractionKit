import assert from 'node:assert/strict';
import test from 'node:test';
import { SyncedLogger, type KVStorage } from '../lib/sync';
import type { LogEvent } from '../types/log-event';

class MemoryStorage implements KVStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
}

interface FakeServer {
  fetchImpl: typeof fetch;
  storedEventIds: Set<string>;
  batchCalls: number;
  failNextBatch: () => void;
}

function makeFakeServer(): FakeServer {
  const storedEventIds = new Set<string>();
  let failNext = false;
  const server: FakeServer = {
    storedEventIds,
    batchCalls: 0,
    fetchImpl: (async (url: string, init?: RequestInit) => {
      if (typeof url === 'string' && url.endsWith('/sessions') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        return {
          ok: true,
          status: 201,
          json: async () => ({
            session_id: 'sess-1',
            study_id: body.study_id,
            participant_id: body.participant_id,
            condition: body.condition,
          }),
        } as Response;
      }
      if (typeof url === 'string' && url.endsWith('/events/batch')) {
        server.batchCalls += 1;
        if (failNext) {
          failNext = false;
          throw new Error('network down');
        }
        const body = JSON.parse(String(init?.body));
        const outcomes = body.events.map((e: { event_id: string }) => {
          if (storedEventIds.has(e.event_id)) {
            return { status: 'duplicate', event_id: e.event_id };
          }
          storedEventIds.add(e.event_id);
          return { status: 'accepted', event_id: e.event_id };
        });
        return {
          ok: true,
          status: 200,
          json: async () => ({ session_id: body.events[0].session_id, outcomes }),
        } as Response;
      }
      throw new Error('unexpected fetch: ' + url);
    }) as typeof fetch,
    failNextBatch: () => {
      failNext = true;
    },
  };
  return server;
}

function makeEvent(over: Partial<LogEvent> = {}): LogEvent {
  return {
    participantId: 'P1',
    studyId: 'interactionkit',
    condition: 'v1',
    patternVersion: 1,
    scenarioId: 'session',
    eventType: 'session_start',
    timestamp: '2026-08-01T00:00:00.000Z',
    decision: 'unsure',
    decisionTimeMs: -1,
    probabilityPrediction: -1,
    ...over,
  };
}

test('successful upload: buffered then acknowledged and removed', async () => {
  const server = makeFakeServer();
  const logger = new SyncedLogger({ url: 'http://backend', storage: new MemoryStorage(), fetchImpl: server.fetchImpl });

  await logger.startSession('demo', 'P1', 'v1');
  logger.push(makeEvent({ eventType: 'session_start' }));
  logger.push(makeEvent({ eventType: 'demographics', scenarioId: 'session' }));
  await logger.flush();

  assert.equal(server.batchCalls, 1);
  assert.equal(server.storedEventIds.size, 2);
  assert.equal(logger.pendingCount(), 0); // acked events removed from buffer
  assert.equal(logger.count(), 2); // CSV path intact
});

test('temporary network failure: events remain buffered and retry does not duplicate', async () => {
  const server = makeFakeServer();
  const logger = new SyncedLogger({ url: 'http://backend', storage: new MemoryStorage(), fetchImpl: server.fetchImpl });

  await logger.startSession('demo', 'P1', 'v1');

  // The push triggers an auto-flush; the server is down, so it fails.
  server.failNextBatch();
  logger.push(makeEvent({ eventType: 'session_start' }));
  await new Promise((r) => setTimeout(r, 0)); // let the auto-flush attempt run
  assert.equal(logger.pendingCount(), 1); // retained for retry

  // Explicit retry succeeds and stores exactly one row (no duplicates).
  const ok = await logger.flush();
  assert.equal(ok.ok, true);
  assert.equal(ok.acked, 1);
  assert.equal(server.storedEventIds.size, 1);
  assert.equal(logger.pendingCount(), 0);

  // A further flush sends nothing new; the server still holds exactly 1 row.
  await logger.flush();
  assert.equal(server.storedEventIds.size, 1);
});

test('local buffering: events pushed before flush are buffered, not sent', async () => {
  const server = makeFakeServer();
  const logger = new SyncedLogger({ url: 'http://backend', storage: new MemoryStorage(), fetchImpl: server.fetchImpl });

  await logger.startSession('demo', 'P1', 'v1');
  logger.push(makeEvent({ eventType: 'session_start' }));
  logger.push(makeEvent({ eventType: 'demographics' }));
  assert.equal(server.batchCalls, 0); // nothing sent yet
  assert.equal(logger.pendingCount(), 2);

  await logger.flush();
  assert.equal(server.batchCalls, 1);
  assert.equal(logger.pendingCount(), 0);
});

test('page reload resumes session and buffer (nextSequence continues)', async () => {
  const server = makeFakeServer();
  const storage = new MemoryStorage();

  // First page load: session created, one event buffered, delivery fails.
  const logger1 = new SyncedLogger({ url: 'http://backend', storage, fetchImpl: server.fetchImpl });
  await logger1.startSession('demo', 'P1', 'v1');
  server.failNextBatch();
  logger1.push(makeEvent({ eventType: 'session_start' }));
  await new Promise((r) => setTimeout(r, 0)); // auto-flush fails; event stays buffered
  assert.equal(logger1.pendingCount(), 1);

  // "Reload": a fresh SyncedLogger over the same storage restores session+buffer.
  const logger2 = new SyncedLogger({ url: 'http://backend', storage, fetchImpl: server.fetchImpl });
  const restored = logger2.restore();
  assert.equal(restored.session?.session_id, 'sess-1');
  assert.equal(logger2.pendingCount(), 1);

  // New event continues the sequence and flushes both with no duplicates.
  logger2.push(makeEvent({ eventType: 'demographics' }));
  await logger2.flush();
  assert.equal(server.storedEventIds.size, 2);
  assert.equal(logger2.pendingCount(), 0);
});

test('rehydrated logger exposes buffered events for CSV export after reload', async () => {
  const server = makeFakeServer();
  const storage = new MemoryStorage();

  const logger1 = new SyncedLogger({ url: 'http://backend', storage, fetchImpl: server.fetchImpl });
  await logger1.startSession('demo', 'P1', 'v1');
  server.failNextBatch();
  logger1.push(makeEvent({ eventType: 'session_start' }));
  await new Promise((r) => setTimeout(r, 0)); // auto-flush fails; event stays buffered

  // "Reload": the new instance rehydrates its in-memory Logger from the buffer.
  const logger2 = new SyncedLogger({ url: 'http://backend', storage, fetchImpl: server.fetchImpl });
  logger2.restore();
  const csv = logger2.exportCsv();
  assert.match(csv, /session_start/);
  assert.equal(logger2.count(), 1);
  assert.equal(logger2.pendingCount(), 1);
});

test('push before a session exists stays local (no crash, local CSV only)', async () => {
  const server = makeFakeServer();
  const logger = new SyncedLogger({ url: 'http://backend', storage: new MemoryStorage(), fetchImpl: server.fetchImpl });
  logger.push(makeEvent({ eventType: 'session_start' })); // no session yet
  assert.equal(logger.pendingCount(), 0);
  assert.equal(logger.count(), 1); // CSV still records it
  assert.equal(server.batchCalls, 0);
});

test('resetSession clears session and buffer', async () => {
  const server = makeFakeServer();
  const logger = new SyncedLogger({ url: 'http://backend', storage: new MemoryStorage(), fetchImpl: server.fetchImpl });
  await logger.startSession('demo', 'P1', 'v1');
  logger.push(makeEvent({ eventType: 'session_start' }));
  assert.equal(logger.getSession()?.session_id, 'sess-1');
  logger.resetSession();
  assert.equal(logger.getSession(), null);
  assert.equal(logger.pendingCount(), 0);
});
