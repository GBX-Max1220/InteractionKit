// Replay-viewer types and pure view-model builders.
//
// The viewer is a debugging/inspection tool, not participant-facing analytics.
// All data comes from the backend; this module only reshapes it for display,
// keeping the React component free of logic (so it is trivially testable).

export interface BackendEvent {
  event_id: string;
  study_id: string;
  participant_id: string;
  session_id: string;
  event_type: string;
  schema_version: number;
  sequence_number: number;
  client_timestamp: string;
  server_timestamp: string;
  condition: string;
  payload: Record<string, unknown>;
  idempotency_key: string;
  flags: string[];
}

export interface BackendSession {
  session_id: string;
  study_id: string;
  participant_id: string;
  condition: string;
  status: 'in_progress' | 'complete';
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  accepted_event_count: number;
  duplicate_event_count: number;
  rejected_event_count: number;
}

export interface BackendIntegrity {
  session_id: string;
  status: 'in_progress' | 'complete';
  verdict: 'ok' | 'warning' | 'corrupted';
  event_count: number;
  duplicate_count: number;
  rejected_count: number;
  issues: Array<{ category: string; detail: string; event_ids: string[] }>;
}

export type EventCategory =
  | 'session'
  | 'decision'
  | 'confidence'
  | 'evidence'
  | 'revision'
  | 'outcome'
  | 'questionnaire'
  | 'other';

export interface TimelineRow {
  eventId: string;
  eventType: string;
  sequenceNumber: number;
  clientTimestamp: string;
  serverTimestamp: string;
  condition: string;
  flags: string[];
  payload: Record<string, unknown>;
  category: EventCategory;
  isAnomaly: boolean;
}

export function classifyEvent(eventType: string): EventCategory {
  switch (eventType) {
    case 'session_start':
    case 'session_complete':
      return 'session';
    case 'decision':
      return 'decision';
    case 'confidence':
      return 'confidence';
    case 'evidence_open':
      return 'evidence';
    case 'decision_revision':
      return 'revision';
    case 'outcome':
      return 'outcome';
    case 'demographics':
    case 'tsi_response':
    case 'familiarity':
      return 'questionnaire';
    default:
      return 'other';
  }
}

/** Order events by sequence number (stable tie-break on client timestamp). */
export function buildTimeline(events: BackendEvent[]): TimelineRow[] {
  return events
    .slice()
    .sort((a, b) => {
      if (a.sequence_number !== b.sequence_number) {
        return a.sequence_number - b.sequence_number;
      }
      return a.client_timestamp.localeCompare(b.client_timestamp);
    })
    .map((e) => ({
      eventId: e.event_id,
      eventType: e.event_type,
      sequenceNumber: e.sequence_number,
      clientTimestamp: e.client_timestamp,
      serverTimestamp: e.server_timestamp,
      condition: e.condition,
      flags: e.flags ?? [],
      payload: e.payload ?? {},
      category: classifyEvent(e.event_type),
      isAnomaly: (e.flags ?? []).length > 0,
    }));
}

export interface Warning {
  category: string;
  detail: string;
  eventIds: string[];
}

/** Convert an integrity report into a flat list of display warnings. */
export function buildWarnings(integrity: BackendIntegrity): Warning[] {
  return (integrity.issues ?? []).map((i) => ({
    category: i.category,
    detail: i.detail,
    eventIds: i.event_ids ?? [],
  }));
}

export function formatTimestamp(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function verdictLabel(verdict: BackendIntegrity['verdict']): string {
  if (verdict === 'ok') return 'OK';
  if (verdict === 'warning') return 'WARNING';
  return 'CORRUPTED';
}

/** Human label for event categories shown in the timeline. */
export const CATEGORY_LABELS: Record<EventCategory, string> = {
  session: 'Session',
  decision: 'Decision',
  confidence: 'Confidence',
  evidence: 'Evidence Open',
  revision: 'Decision Revision',
  outcome: 'Outcome',
  questionnaire: 'Questionnaire',
  other: 'Other',
};
