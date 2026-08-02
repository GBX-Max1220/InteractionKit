import { randomBytes } from 'node:crypto';

import { resolveStudy2ParticipantTrial } from './runner-machine';
import { auditAllocation } from './schedule';
import { canonicalJson, createStudy2SessionStore, sha256 } from './session-store';
import type { Study2DeliveryMaterials } from './delivery-materials';
import type { FrozenStudy2MaterialsArtifact } from './frozen-materials';
import type { Study2ServerRuntimeState } from './runtime-service';
import type { Study2Allocation } from './types';

const SHA256 = /^[a-f0-9]{64}$/u;

export interface Study2RuntimeDeploymentGate {
  schemaVersion: 'study2-runtime-deployment-gate-v1';
  authorizationStatus: 'approved_for_pilot';
  authorizedBy: string;
  authorizedAt: string;
  ethicsApprovalReference: string;
  preregistrationReference: string;
  recruitmentSource: string;
  studyBaseUrl: string;
  allocationSha256: string;
  deliveryBundleSha256: string;
  frozenMaterialsSha256: string;
  taxonomyFinalizationSha256: string;
  cardSafetyFinalizationSha256: string;
  presentationAuditSha256: string;
}

export interface Study2RuntimeSeed {
  participantIndex: number;
  accessToken: string;
  accessUrl: string;
  state: Study2ServerRuntimeState;
}

function opaqueId(prefix: string): string {
  return `${prefix}_${randomBytes(24).toString('base64url')}`;
}

function validateGate(gate: Study2RuntimeDeploymentGate): URL {
  if (gate.schemaVersion !== 'study2-runtime-deployment-gate-v1' || gate.authorizationStatus !== 'approved_for_pilot') {
    throw new Error('Study 2 deployment gate is not explicitly approved for pilot use.');
  }
  for (const [label, value] of [
    ['authorizedBy', gate.authorizedBy],
    ['ethicsApprovalReference', gate.ethicsApprovalReference],
    ['preregistrationReference', gate.preregistrationReference],
    ['recruitmentSource', gate.recruitmentSource],
  ] as const) {
    if (!value.trim()) throw new Error(`Study 2 deployment gate ${label} is required.`);
  }
  if (!Number.isFinite(Date.parse(gate.authorizedAt))) throw new Error('Study 2 deployment authorization time is invalid.');
  for (const [label, value] of [
    ['allocationSha256', gate.allocationSha256],
    ['deliveryBundleSha256', gate.deliveryBundleSha256],
    ['frozenMaterialsSha256', gate.frozenMaterialsSha256],
    ['taxonomyFinalizationSha256', gate.taxonomyFinalizationSha256],
    ['cardSafetyFinalizationSha256', gate.cardSafetyFinalizationSha256],
    ['presentationAuditSha256', gate.presentationAuditSha256],
  ] as const) {
    if (!SHA256.test(value)) throw new Error(`Study 2 deployment gate ${label} must be a SHA-256 digest.`);
  }
  const baseUrl = new URL(gate.studyBaseUrl);
  if (baseUrl.protocol !== 'https:' || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new Error('Study 2 base URL must be credential-free HTTPS without query or fragment data.');
  }
  return baseUrl;
}

async function assertArtifactHash(label: string, value: unknown, expected: string): Promise<void> {
  const actual = await sha256(canonicalJson(value));
  if (actual !== expected) throw new Error(`${label} no longer matches the pilot deployment gate.`);
}

export async function prepareStudy2RuntimeSeeds(options: {
  allocation: Study2Allocation;
  bundle: Study2DeliveryMaterials;
  frozen: FrozenStudy2MaterialsArtifact;
  gate: Study2RuntimeDeploymentGate;
  taxonomyFinalization: unknown;
  cardSafetyFinalization: unknown;
  presentationAudit: unknown;
  tokenFactory?: (participantIndex: number) => string;
}): Promise<Study2RuntimeSeed[]> {
  const baseUrl = validateGate(options.gate);
  await Promise.all([
    assertArtifactHash('Allocation', options.allocation, options.gate.allocationSha256),
    assertArtifactHash('Delivery bundle', options.bundle, options.gate.deliveryBundleSha256),
    assertArtifactHash('Frozen materials', options.frozen, options.gate.frozenMaterialsSha256),
    assertArtifactHash('Taxonomy finalization', options.taxonomyFinalization, options.gate.taxonomyFinalizationSha256),
    assertArtifactHash('Card-safety finalization', options.cardSafetyFinalization, options.gate.cardSafetyFinalizationSha256),
    assertArtifactHash('Presentation audit', options.presentationAudit, options.gate.presentationAuditSha256),
  ]);

  const allocationAudit = auditAllocation(options.allocation);
  if (!allocationAudit.valid) throw new Error(`Study 2 allocation is invalid:\n${allocationAudit.errors.join('\n')}`);
  if (options.allocation.participants !== 240) throw new Error('Pilot deployment requires the frozen 240-participant allocation.');
  if (
    options.allocation.materialVersion !== options.frozen.materialVersion ||
    options.bundle.frozenMaterialVersion !== options.frozen.materialVersion
  ) throw new Error('Allocation, delivery bundle, and frozen materials versions do not match.');

  for (let participantIndex = 0; participantIndex < options.allocation.participants; participantIndex += 1) {
    for (let trialIndex = 0; trialIndex < 16; trialIndex += 1) {
      resolveStudy2ParticipantTrial({
        allocation: options.allocation,
        bundle: options.bundle,
        frozen: options.frozen,
        participantIndex,
        trialIndex,
      });
    }
  }

  const tokenFactory = options.tokenFactory ?? (() => randomBytes(32).toString('base64url'));
  const tokens = new Set<string>();
  const seeds: Study2RuntimeSeed[] = [];
  for (let participantIndex = 0; participantIndex < options.allocation.participants; participantIndex += 1) {
    const accessToken = tokenFactory(participantIndex);
    if (!/^[A-Za-z0-9_-]{32,256}$/u.test(accessToken) || tokens.has(accessToken)) {
      throw new Error('Study 2 token factory produced a malformed or duplicate access token.');
    }
    tokens.add(accessToken);
    const state: Study2ServerRuntimeState = {
      schemaVersion: 'study2-server-runtime-state-v1',
      allocation: options.allocation,
      bundle: options.bundle,
      frozen: options.frozen,
      identity: {
        sessionId: opaqueId('s2s'),
        participantId: opaqueId('s2p'),
        participantIndex,
      },
      recruitmentSource: options.gate.recruitmentSource,
      store: await createStudy2SessionStore(options.allocation, participantIndex),
    };
    const accessUrl = new URL(baseUrl);
    accessUrl.hash = new URLSearchParams({ access_token: accessToken }).toString();
    seeds.push({ participantIndex, accessToken, accessUrl: accessUrl.toString(), state });
  }
  return seeds;
}
