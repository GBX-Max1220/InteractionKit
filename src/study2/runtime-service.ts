import type { Study2DeliveryMaterials } from './delivery-materials';
import type { FrozenStudy2MaterialsArtifact } from './frozen-materials';
import {
  appendStudy2RunnerEvent,
  deriveStudy2RunnerStep,
  type Study2SessionIdentity,
} from './runner-machine';
import {
  deriveStudy2PublicRuntimeView,
  mapStudy2ParticipantAction,
  type Study2PublicRuntimeView,
} from './runtime-boundary';
import {
  auditStudy2SessionStore,
  type Study2SessionStore,
} from './session-store';
import type { Study2Allocation } from './types';

export interface Study2ServerRuntimeState {
  schemaVersion: 'study2-server-runtime-state-v1';
  allocation: Study2Allocation;
  bundle: Study2DeliveryMaterials;
  frozen: FrozenStudy2MaterialsArtifact;
  identity: Study2SessionIdentity;
  recruitmentSource: string;
  store: Study2SessionStore;
}

export interface VersionedStudy2RuntimeState {
  revision: number;
  state: Study2ServerRuntimeState;
}

export interface Study2RuntimeRepository {
  loadByAccessToken(accessToken: string): Promise<VersionedStudy2RuntimeState | null>;
  compareAndSwap(options: {
    accessToken: string;
    expectedRevision: number;
    nextState: Study2ServerRuntimeState;
  }): Promise<boolean>;
}

export interface Study2RuntimeResponse {
  schemaVersion: 'study2-runtime-response-v1';
  revision: number;
  view: Study2PublicRuntimeView;
  receipt: { eventCount: number; chainTipHash: string };
}

function validateAccessToken(accessToken: string): void {
  if (!/^[A-Za-z0-9_-]{32,256}$/u.test(accessToken)) throw new Error('Study access token is malformed.');
}

async function responseFor(
  versioned: VersionedStudy2RuntimeState,
): Promise<Study2RuntimeResponse> {
  const { state } = versioned;
  const audit = await auditStudy2SessionStore(state.store, state.allocation);
  if (!audit.valid) throw new Error(`Server runtime store failed integrity audit:\n${audit.errors.join('\n')}`);
  const step = await deriveStudy2RunnerStep({
    store: state.store,
    allocation: state.allocation,
    bundle: state.bundle,
    frozen: state.frozen,
  });
  const comprehensionCount = state.store.records.filter((record) => record.event.eventType === 'comprehension_attempt').length;
  const lastEventType = state.store.records.at(-1)?.event.eventType;
  const response: Study2RuntimeResponse = {
    schemaVersion: 'study2-runtime-response-v1',
    revision: versioned.revision,
    view: deriveStudy2PublicRuntimeView(step, {
      comprehensionAttempt: step.phase === 'comprehension' ? (Math.min(2, comprehensionCount + 1) as 1 | 2) : null,
      completionStatus: lastEventType === 'session_completed'
        ? 'completed'
        : lastEventType === 'session_terminated'
          ? 'terminated'
          : 'in_progress',
    }),
    receipt: { eventCount: audit.eventCount, chainTipHash: audit.chainTipHash },
  };
  const serialized = JSON.stringify(response);
  for (const forbidden of [
    'allocation', 'bundle', 'frozen', 'store', 'participantId', 'sessionId',
    'variantId', 'cardId', 'scenarioId', 'failureFamily', 'interventionType',
    'accuracy', 'supportLevel', 'matchStatus', 'finalBinaryDecision',
  ]) {
    if (serialized.includes(forbidden)) throw new Error(`Runtime response contains forbidden server field ${forbidden}.`);
  }
  return response;
}

export async function readStudy2Runtime(options: {
  repository: Study2RuntimeRepository;
  accessToken: string;
}): Promise<Study2RuntimeResponse> {
  validateAccessToken(options.accessToken);
  const versioned = await options.repository.loadByAccessToken(options.accessToken);
  if (!versioned) throw new Error('Study runtime session was not found.');
  return responseFor(versioned);
}

export async function submitStudy2RuntimeAction(options: {
  repository: Study2RuntimeRepository;
  accessToken: string;
  expectedRevision: number;
  action: unknown;
  serverTimestamp: string;
}): Promise<Study2RuntimeResponse> {
  validateAccessToken(options.accessToken);
  if (!Number.isInteger(options.expectedRevision) || options.expectedRevision < 0) throw new Error('Expected runtime revision must be a nonnegative integer.');
  if (!Number.isFinite(Date.parse(options.serverTimestamp))) throw new Error('Server timestamp must be valid ISO-8601.');
  const versioned = await options.repository.loadByAccessToken(options.accessToken);
  if (!versioned) throw new Error('Study runtime session was not found.');
  if (versioned.revision !== options.expectedRevision) throw new Error('Study runtime revision conflict; reload the current phase before retrying.');
  const { state } = versioned;
  const step = await deriveStudy2RunnerStep({ store: state.store, allocation: state.allocation, bundle: state.bundle, frozen: state.frozen });
  const mapped = mapStudy2ParticipantAction({ step, value: options.action, recruitmentSource: state.recruitmentSource });
  const nextStore = await appendStudy2RunnerEvent({
    store: state.store,
    allocation: state.allocation,
    bundle: state.bundle,
    frozen: state.frozen,
    identity: state.identity,
    eventType: mapped.eventType,
    payload: mapped.payload,
    timestamp: options.serverTimestamp,
  });
  const nextState: Study2ServerRuntimeState = { ...state, store: nextStore };
  const saved = await options.repository.compareAndSwap({
    accessToken: options.accessToken,
    expectedRevision: versioned.revision,
    nextState,
  });
  if (!saved) throw new Error('Concurrent Study 2 action detected; no duplicate event was accepted.');
  return responseFor({ revision: versioned.revision + 1, state: nextState });
}
