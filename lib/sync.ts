// InteractionKit → study-backend sync layer.
//
// Preserves the existing local-first architecture: the in-memory Logger still
// owns CSV export, and a new persistent SyncBuffer (localStorage) owns
// reliable delivery. Design goals:
//
//   * every event is buffered locally before it is sent;
//   * a failed upload keeps the event buffered for retry;
//   * retry never duplicates stored events (server dedupes on event_id and
//     idempotency_key);
//   * a page reload resumes the backend session and replays the buffer;
//   * acknowledged events are removed from the pending buffer.
//
// The buffer and session state are injectable for tests (see test/sync.test.ts).

import type { LogEvent } from '../types/log-event';
import { Logger } from './logger';
import { BACKEND_URL } from './sync-config';

export const ENVELOPE_SCHEMA_VERSION = 1;

export const BUFFER_KEY = 'interactionkit-pending-buffer';
export const SESSION_KEY = 'interactionkit-backend-session';

export interface SyncEnvelope {
  event_id: string;
  study_id: string;
  participant_id: string;
  session_id: string;
  event_type: string;
  schema_version: number;
  sequence_number: number;
  client_timestamp: string;
  condition: string;
  payload: LogEvent;
  idempotency_key: string;
}

export interface BackendSession {
  session_id: string;
  study_id: string;
  participant_id: string;
  condition: string;
}

export interface SyncState {
  session: BackendSession | null;
  nextSequence: number;
}

export interface BatchOutcome {
  status: 'accepted' | 'duplicate' | 'rejected';
  event_id: string;
  reason?: string | null;
}

export interface BatchResponse {
  outcomes: BatchOutcome[];
}

export interface FlushResult {
  ok: boolean;
  sent: number;
  acked: number;
  kept: number;
  reason?: string;
}

/** Minimal storage abstraction so tests can run without a browser. */
export interface KVStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const browserStorage: KVStorage = {
  getItem: (k) => (typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null),
  setItem: (k, v) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(k, v);
  },
  removeItem: (k) => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(k);
  },
};

function parseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function newEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'evt-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

class SyncBuffer {
  constructor(
    private storage: KVStorage,
    private key: string = BUFFER_KEY,
  ) {}

  load(): SyncEnvelope[] {
    return parseJSON<SyncEnvelope[]>(this.storage.getItem(this.key), []);
  }

  push(envelope: SyncEnvelope): void {
    const all = this.load();
    if (all.some((e) => e.event_id === envelope.event_id)) return;
    all.push(envelope);
    this.storage.setItem(this.key, JSON.stringify(all));
  }

  removeByIds(ids: Iterable<string>): void {
    const removed = new Set(ids);
    const all = this.load().filter((e) => !removed.has(e.event_id));
    this.storage.setItem(this.key, JSON.stringify(all));
  }

  count(): number {
    return this.load().length;
  }

  clear(): void {
    this.storage.removeItem(this.key);
  }
}

export interface SyncedLoggerOptions {
  url?: string;
  storage?: KVStorage;
  fetchImpl?: typeof fetch;
}

export class SyncedLogger {
  private url: string;
  private buffer: SyncBuffer;
  private storage: KVStorage;
  private fetchImpl: typeof fetch;
  private logger: Logger;
  private state: SyncState;
  private flushChain: Promise<FlushResult> = Promise.resolve({
    ok: true, sent: 0, acked: 0, kept: 0,
  });

  constructor(opts: SyncedLoggerOptions = {}) {
    this.url = opts.url ?? BACKEND_URL;
    this.storage = opts.storage ?? browserStorage;
    this.buffer = new SyncBuffer(this.storage);
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.logger = new Logger();
    this.state = parseJSON<SyncState>(this.storage.getItem(SESSION_KEY), {
      session: null,
      nextSequence: 0,
    });
    this.rehydrateLoggerFromBuffer();
  }

  // ── delegated Logger API (CSV export path unchanged) ──────────────────

  get events(): readonly LogEvent[] {
    return this.logger.getAll();
  }

  getAll(): readonly LogEvent[] {
    return this.logger.getAll();
  }

  exportCsv(): string {
    return this.logger.exportCsv();
  }

  validate() {
    return this.logger.validate();
  }

  count(): number {
    return this.logger.count();
  }

  clear(): void {
    this.logger.clear();
    this.buffer.clear();
    this.state = { session: null, nextSequence: 0 };
    this.persistState();
  }

  // ── session lifecycle ─────────────────────────────────────────────────

  /** Create a backend session; resolves to the session or null on failure. */
  async startSession(
    studyId: string,
    participantId: string,
    condition: string,
  ): Promise<BackendSession | null> {
    try {
      const res = await this.fetchImpl(`${this.url}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ study_id: studyId, participant_id: participantId, condition }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as BackendSession;
      this.state = { session: data, nextSequence: 0 };
      this.persistState();
      return data;
    } catch {
      return null; // backend unavailable → run local-first
    }
  }

  /** Restore a persisted session + buffer after a page reload. */
  restore(): SyncState {
    this.state = parseJSON<SyncState>(this.storage.getItem(SESSION_KEY), {
      session: null,
      nextSequence: 0,
    });
    this.rehydrateLoggerFromBuffer();
    return this.state;
  }

  resetSession(): void {
    this.state = { session: null, nextSequence: 0 };
    this.buffer.clear();
    this.persistState();
  }

  getSession(): BackendSession | null {
    return this.state.session;
  }

  pendingCount(): number {
    return this.buffer.count();
  }

  // ── event push + reliable delivery ────────────────────────────────────

  push(event: LogEvent): void {
    this.logger.push(event);
    const session = this.state.session;
    if (!session) return; // no backend session yet → local CSV only
    const envelope = this.toEnvelope(session, event);
    this.buffer.push(envelope);
    void this.flush();
  }

  flush(): Promise<FlushResult> {
    // Serialize flushes on a promise chain: if a push-triggered flush is in
    // flight, this one waits for it, then drains whatever is still buffered.
    this.flushChain = this.flushChain.then(() => this.drainBuffer());
    return this.flushChain;
  }

  /** Send everything currently buffered in a single batch attempt. */
  private async drainBuffer(): Promise<FlushResult> {
    const session = this.state.session;
    if (!session) return { ok: true, sent: 0, acked: 0, kept: this.buffer.count() };
    const envelopes = this.buffer.load();
    if (envelopes.length === 0) {
      return { ok: true, sent: 0, acked: 0, kept: 0 };
    }
    return this.sendBatch(session.session_id, envelopes);
  }

  private async sendBatch(sessionId: string, envelopes: SyncEnvelope[]): Promise<FlushResult> {
    try {
      const res = await this.fetchImpl(`${this.url}/events/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: envelopes }),
      });
      if (!res.ok) {
        // HTTP-level failure: nothing was decided server-side, keep everything.
        return {
          ok: false, sent: envelopes.length, acked: 0,
          kept: this.buffer.count(), reason: `HTTP ${res.status}`,
        };
      }
      const data = (await res.json()) as BatchResponse;
      const stored = data.outcomes
        .filter((o) => o.status === 'accepted' || o.status === 'duplicate')
        .map((o) => o.event_id);
      // The batch response is the server's definitive per-event decision.
      // Acknowledged (accepted/duplicate) events are removed; rejected events
      // are removed too so a permanently-refused event cannot loop forever —
      // they remain in the in-memory Logger for local CSV export.
      this.buffer.removeByIds(envelopes.map((e) => e.event_id));
      return {
        ok: true, sent: envelopes.length, acked: stored.length, kept: this.buffer.count(),
      };
    } catch (err) {
      // Network failure: the batch never reached the server; retain everything.
      return {
        ok: false, sent: envelopes.length, acked: 0,
        kept: this.buffer.count(),
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── internals ─────────────────────────────────────────────────────────

  private toEnvelope(session: BackendSession, event: LogEvent): SyncEnvelope {
    const eventId = newEventId();
    const seq = this.state.nextSequence;
    this.state.nextSequence = seq + 1;
    this.persistState();
    return {
      event_id: eventId,
      study_id: session.study_id,
      participant_id: session.participant_id,
      session_id: session.session_id,
      event_type: event.eventType,
      schema_version: ENVELOPE_SCHEMA_VERSION,
      sequence_number: seq,
      client_timestamp: event.timestamp,
      condition: session.condition,
      payload: event,
      idempotency_key: eventId,
    };
  }

  private persistState(): void {
    this.storage.setItem(SESSION_KEY, JSON.stringify(this.state));
  }

  /** Rebuild the in-memory Logger from the pending buffer after a reload so
   *  the local CSV export reflects buffered (not-yet-acked) events. */
  private rehydrateLoggerFromBuffer(): void {
    const buffered = this.buffer.load();
    if (buffered.length === 0) return;
    const seqs = buffered.map((e) => e.sequence_number);
    const nextSeq = seqs.length > 0 ? Math.max(...seqs) + 1 : 0;
    if (this.state.nextSequence < nextSeq) {
      this.state.nextSequence = nextSeq;
      this.persistState();
    }
    for (const e of buffered) {
      if (!this.logger.getAll().some((le) => le.timestamp === e.payload.timestamp)) {
        this.logger.push(e.payload);
      }
    }
  }
}
