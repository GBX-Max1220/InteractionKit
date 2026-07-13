import type { LogEvent, ValidationResult } from '@/types/log-event';

const CSV_HEADERS = [
  'participant_id', 'study_id', 'condition', 'pattern_version',
  'scenario_id', 'event_type', 'timestamp', 'decision',
  'decision_time_ms', 'probability_prediction', 'familiarity',
  'age', 'gender', 'ai_familiarity',
  'tsi_01', 'tsi_02', 'tsi_03', 'tsi_04', 'tsi_05', 'tsi_06',
  'tsi_07', 'tsi_08', 'tsi_09', 'tsi_10', 'tsi_11', 'tsi_12', 'tsi_mean',
];

function escapeCsv(value: unknown): string {
  if (value === undefined || value === null) return 'N/A';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export class Logger {
  private events: LogEvent[] = [];

  push(event: LogEvent): void {
    this.events.push({ ...event });
  }

  getAll(): readonly LogEvent[] {
    return this.events;
  }

  count(): number {
    return this.events.length;
  }

  exportCsv(): string {
    const rows = [CSV_HEADERS.join(',')];

    for (const event of this.events) {
      const row = CSV_HEADERS.map((header) => {
        const camelKey = header.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        const value = (event as unknown as Record<string, unknown>)[camelKey];
        return escapeCsv(value);
      });
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  validate(): ValidationResult {
    const errors: string[] = [];

    for (let i = 0; i < this.events.length; i++) {
      const e = this.events[i];
      if (!e.participantId) errors.push(`Row ${i}: missing participantId`);
      if (!['v1', 'v2'].includes(e.condition)) errors.push(`Row ${i}: invalid condition`);
      if (![1, 2].includes(e.patternVersion)) errors.push(`Row ${i}: invalid patternVersion`);
      if (!e.scenarioId) errors.push(`Row ${i}: missing scenarioId`);
      if (!['decision', 'demographics', 'tsi_response', 'session_start', 'session_complete'].includes(e.eventType)) {
        errors.push(`Row ${i}: invalid eventType`);
      }
      if (e.eventType === 'decision') {
        if (!['trust', 'distrust', 'unsure'].includes(e.decision)) {
          errors.push(`Row ${i}: invalid decision`);
        }
        if (typeof e.probabilityPrediction !== 'number' || e.probabilityPrediction < 0 || e.probabilityPrediction > 1) {
          errors.push(`Row ${i}: probabilityPrediction out of range`);
        }
      }
    }

    return { valid: errors.length === 0, errors, eventCount: this.events.length };
  }

  clear(): void {
    this.events = [];
  }
}
