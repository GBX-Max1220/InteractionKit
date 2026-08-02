import {
  auditStudy2Session,
  auditStudy2SessionPrefix,
  type Study2Event,
  type Study2EventType,
} from './events';
import type { Study2Allocation } from './types';

const GENESIS_HASH = '0'.repeat(64);

export interface StoredStudy2Event {
  previousHash: string;
  eventHash: string;
  event: Study2Event;
}

export interface Study2SessionStore {
  schemaVersion: 'study2-session-store-v1';
  participantIndex: number;
  allocationSha256: string;
  records: StoredStudy2Event[];
}

export interface Study2SessionStoreAudit {
  valid: boolean;
  errors: string[];
  eventCount: number;
  chainTipHash: string;
  nextEventType: Study2EventType | null;
  nextTrialIndex: number | null;
}

export interface Study2CompletedSessionExport {
  schemaVersion: 'study2-completed-session-export-v1';
  protocolVersion: 'study2-protocol-v1';
  participantIndex: number;
  allocationSha256: string;
  chainTipHash: string;
  exportedAt: string;
  events: Study2Event[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export async function sha256(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function participantAllocationProjection(
  allocation: Study2Allocation,
  participantIndex: number,
): unknown {
  return {
    schemaVersion: allocation.schemaVersion,
    materialVersion: allocation.materialVersion,
    seed: allocation.seed,
    participantIndex,
    trials: allocation.trials
      .filter((trial) => trial.participantIndex === participantIndex)
      .sort((first, second) => first.trialIndex - second.trialIndex),
  };
}

export async function participantAllocationSha256(
  allocation: Study2Allocation,
  participantIndex: number,
): Promise<string> {
  return sha256(canonicalJson(participantAllocationProjection(allocation, participantIndex)));
}

async function eventHash(previousHash: string, event: Study2Event): Promise<string> {
  return sha256(canonicalJson({ previousHash, event }));
}

export async function createStudy2SessionStore(
  allocation: Study2Allocation,
  participantIndex: number,
): Promise<Study2SessionStore> {
  const allocationSha256 = await participantAllocationSha256(allocation, participantIndex);
  const prefix = auditStudy2SessionPrefix({ events: [], allocation, participantIndex });
  if (!prefix.valid) throw new Error(prefix.errors.join('\n'));
  return {
    schemaVersion: 'study2-session-store-v1',
    participantIndex,
    allocationSha256,
    records: [],
  };
}

export async function auditStudy2SessionStore(
  value: unknown,
  allocation: Study2Allocation,
): Promise<Study2SessionStoreAudit> {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return {
      valid: false,
      errors: ['Session store must be a JSON object.'],
      eventCount: 0,
      chainTipHash: GENESIS_HASH,
      nextEventType: null,
      nextTrialIndex: null,
    };
  }
  if (value.schemaVersion !== 'study2-session-store-v1') errors.push('Unsupported session-store schema.');
  const participantIndex =
    Number.isInteger(value.participantIndex) && Number(value.participantIndex) >= 0
      ? Number(value.participantIndex)
      : -1;
  if (participantIndex < 0) errors.push('Session store requires a nonnegative participant index.');
  const expectedAllocationHash =
    participantIndex >= 0
      ? await participantAllocationSha256(allocation, participantIndex)
      : '';
  if (value.allocationSha256 !== expectedAllocationHash) {
    errors.push('Session store allocation fingerprint does not match.');
  }
  const rawRecords = Array.isArray(value.records) ? value.records : [];
  if (!Array.isArray(value.records)) errors.push('Session store records must be an array.');
  const events: Study2Event[] = [];
  let previousHash = GENESIS_HASH;
  for (const [index, rawRecord] of rawRecords.entries()) {
    if (!isRecord(rawRecord) || !isRecord(rawRecord.event)) {
      errors.push(`Stored event ${index} is malformed.`);
      continue;
    }
    if (rawRecord.previousHash !== previousHash) {
      errors.push(`Stored event ${index} does not continue the hash chain.`);
    }
    const expectedEventHash = await eventHash(previousHash, rawRecord.event as unknown as Study2Event);
    if (rawRecord.eventHash !== expectedEventHash) {
      errors.push(`Stored event ${index} hash does not match its content.`);
    }
    if (typeof rawRecord.eventHash === 'string') previousHash = rawRecord.eventHash;
    events.push(rawRecord.event as unknown as Study2Event);
  }
  if (participantIndex >= 0) {
    const prefix = auditStudy2SessionPrefix({ events, allocation, participantIndex });
    errors.push(...prefix.errors);
    return {
      valid: errors.length === 0,
      errors,
      eventCount: events.length,
      chainTipHash: previousHash,
      nextEventType: errors.length === 0 ? prefix.nextEventType : null,
      nextTrialIndex: errors.length === 0 ? prefix.nextTrialIndex : null,
    };
  }
  return {
    valid: false,
    errors,
    eventCount: events.length,
    chainTipHash: previousHash,
    nextEventType: null,
    nextTrialIndex: null,
  };
}

export async function appendStudy2Event(options: {
  store: Study2SessionStore;
  event: Study2Event;
  allocation: Study2Allocation;
}): Promise<Study2SessionStore> {
  const currentAudit = await auditStudy2SessionStore(options.store, options.allocation);
  if (!currentAudit.valid) throw new Error(`Cannot append to invalid session store:\n${currentAudit.errors.join('\n')}`);
  const previousHash = currentAudit.chainTipHash;
  const record: StoredStudy2Event = {
    previousHash,
    eventHash: await eventHash(previousHash, options.event),
    event: structuredClone(options.event),
  };
  const nextStore: Study2SessionStore = {
    ...options.store,
    records: [...options.store.records, record],
  };
  const nextAudit = await auditStudy2SessionStore(nextStore, options.allocation);
  if (!nextAudit.valid) throw new Error(`Event append violates the runtime protocol:\n${nextAudit.errors.join('\n')}`);
  return nextStore;
}

function activeKey(key: string): string {
  return `${key}:active`;
}

function pendingKey(key: string): string {
  return `${key}:pending`;
}

export function persistStudy2SessionStore(
  storage: StorageLike,
  key: string,
  store: Study2SessionStore,
): void {
  const serialized = JSON.stringify(store);
  storage.setItem(pendingKey(key), serialized);
  storage.setItem(activeKey(key), serialized);
  storage.removeItem(pendingKey(key));
}

export async function loadStudy2SessionStore(options: {
  storage: StorageLike;
  key: string;
  allocation: Study2Allocation;
}): Promise<{ store: Study2SessionStore; recoveredFrom: 'active' | 'pending'; audit: Study2SessionStoreAudit } | null> {
  const candidates: Array<{
    recoveredFrom: 'active' | 'pending';
    store: Study2SessionStore;
    audit: Study2SessionStoreAudit;
  }> = [];
  for (const recoveredFrom of ['active', 'pending'] as const) {
    const serialized = options.storage.getItem(
      recoveredFrom === 'active' ? activeKey(options.key) : pendingKey(options.key),
    );
    if (!serialized) continue;
    try {
      const store = JSON.parse(serialized) as Study2SessionStore;
      const audit = await auditStudy2SessionStore(store, options.allocation);
      if (audit.valid) candidates.push({ recoveredFrom, store, audit });
    } catch {
      // Corrupt slots are ignored; a separately valid journal slot may still recover the session.
    }
  }
  candidates.sort((first, second) =>
    second.audit.eventCount - first.audit.eventCount ||
    Number(second.recoveredFrom === 'active') - Number(first.recoveredFrom === 'active'),
  );
  return candidates[0] ?? null;
}

export async function buildCompletedSessionExport(options: {
  store: Study2SessionStore;
  allocation: Study2Allocation;
  exportedAt: string;
}): Promise<Study2CompletedSessionExport> {
  if (!Number.isFinite(Date.parse(options.exportedAt))) throw new Error('Export timestamp must be valid ISO-8601.');
  const storeAudit = await auditStudy2SessionStore(options.store, options.allocation);
  if (!storeAudit.valid) throw new Error(`Cannot export invalid session store:\n${storeAudit.errors.join('\n')}`);
  const events = options.store.records.map((record) => structuredClone(record.event));
  const sessionAudit = auditStudy2Session({
    events,
    allocation: options.allocation,
    participantIndex: options.store.participantIndex,
  });
  if (!sessionAudit.valid) throw new Error(`Cannot export incomplete session:\n${sessionAudit.errors.join('\n')}`);
  return {
    schemaVersion: 'study2-completed-session-export-v1',
    protocolVersion: 'study2-protocol-v1',
    participantIndex: options.store.participantIndex,
    allocationSha256: options.store.allocationSha256,
    chainTipHash: storeAudit.chainTipHash,
    exportedAt: options.exportedAt,
    events,
  };
}
