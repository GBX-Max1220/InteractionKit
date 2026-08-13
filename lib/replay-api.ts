// Minimal fetch client for the replay viewer page.

import type {
  BackendEvent,
  BackendIntegrity,
  BackendSession,
} from './replay-view-model';
import { BACKEND_URL } from './sync-config';

export interface ReplayData {
  session: BackendSession;
  events: BackendEvent[];
  integrity: BackendIntegrity;
}

async function getJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`GET ${url} failed: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchReplay(
  sessionId: string,
  signal?: AbortSignal,
): Promise<ReplayData> {
  const base = BACKEND_URL;
  const [session, events, integrity] = await Promise.all([
    getJSON<BackendSession>(`${base}/sessions/${sessionId}`, signal),
    getJSON<BackendEvent[]>(`${base}/sessions/${sessionId}/events`, signal),
    getJSON<BackendIntegrity>(`${base}/sessions/${sessionId}/integrity`, signal),
  ]);
  return { session, events, integrity };
}
