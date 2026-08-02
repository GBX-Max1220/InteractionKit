import {
  readStudy2Runtime,
  submitStudy2RuntimeAction,
  type Study2RuntimeRepository,
} from './runtime-service';

export interface Study2RuntimeHttpResult {
  status: number;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

export const STUDY2_RUNTIME_MAX_BODY_BYTES = 16_384;

export function parseStudy2RuntimeRequestBody(rawBody: string):
  | { ok: true; body: unknown }
  | { ok: false; response: Study2RuntimeHttpResult } {
  if (new TextEncoder().encode(rawBody).byteLength > STUDY2_RUNTIME_MAX_BODY_BYTES) {
    return { ok: false, response: result(413, { error: 'request_too_large' }) };
  }
  try {
    return { ok: true, body: JSON.parse(rawBody) as unknown };
  } catch {
    return { ok: false, response: result(400, { error: 'invalid_json' }) };
  }
}

function result(status: number, body: Record<string, unknown>): Study2RuntimeHttpResult {
  return { status, headers: SECURITY_HEADERS, body };
}

function bearerToken(authorization: string | null): string {
  const match = authorization?.match(/^Bearer ([A-Za-z0-9_-]{32,256})$/u);
  if (!match) throw new Error('unauthorized');
  return match[1];
}

function exactRequest(value: unknown): value is { expectedRevision: number; action: unknown } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return keys.length === 2 && keys[0] === 'action' && keys[1] === 'expectedRevision';
}

function safeError(error: unknown): Study2RuntimeHttpResult {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'unauthorized' || /access token is malformed/u.test(message)) return result(401, { error: 'unauthorized' });
  if (/was not found/u.test(message)) return result(404, { error: 'runtime_not_found' });
  if (/revision conflict|Concurrent Study 2 action/u.test(message)) return result(409, { error: 'runtime_conflict', retry: 'reload_current_phase' });
  if (/Participant action|does not accept action|response is invalid|profile is incomplete|duration is invalid|Consent and server-known|Comprehension attempt|Expected runtime revision/u.test(message)) return result(400, { error: 'invalid_action' });
  return result(500, { error: 'runtime_integrity_failure' });
}

export async function handleStudy2RuntimeGet(options: {
  repository: Study2RuntimeRepository;
  authorization: string | null;
}): Promise<Study2RuntimeHttpResult> {
  try {
    const accessToken = bearerToken(options.authorization);
    return result(200, await readStudy2Runtime({ repository: options.repository, accessToken }) as unknown as Record<string, unknown>);
  } catch (error) {
    return safeError(error);
  }
}

export async function handleStudy2RuntimePost(options: {
  repository: Study2RuntimeRepository;
  authorization: string | null;
  contentLength: string | null;
  body: unknown;
  serverTimestamp?: string;
}): Promise<Study2RuntimeHttpResult> {
  try {
    const accessToken = bearerToken(options.authorization);
    const contentLength = options.contentLength === null ? null : Number(options.contentLength);
    if (contentLength !== null && (!Number.isInteger(contentLength) || contentLength < 0 || contentLength > STUDY2_RUNTIME_MAX_BODY_BYTES)) {
      return result(413, { error: 'request_too_large' });
    }
    if (!exactRequest(options.body) || !Number.isInteger(options.body.expectedRevision) || options.body.expectedRevision < 0) {
      return result(400, { error: 'invalid_request_envelope' });
    }
    const response = await submitStudy2RuntimeAction({
      repository: options.repository,
      accessToken,
      expectedRevision: options.body.expectedRevision,
      action: options.body.action,
      serverTimestamp: options.serverTimestamp ?? new Date().toISOString(),
    });
    return result(200, response as unknown as Record<string, unknown>);
  } catch (error) {
    return safeError(error);
  }
}
