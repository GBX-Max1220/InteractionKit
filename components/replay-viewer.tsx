'use client';

// Internal session replay viewer — inspection/debugging only, not
// participant-facing. Pure presentational component: all logic lives in
// lib/replay-view-model.ts so this can be rendered server-side in tests.

import { Fragment } from 'react';
import type {
  BackendEvent,
  BackendIntegrity,
  BackendSession,
  TimelineRow,
  Warning,
} from '../lib/replay-view-model';
import {
  buildTimeline,
  buildWarnings,
  CATEGORY_LABELS,
  formatTimestamp,
  verdictLabel,
} from '../lib/replay-view-model';

interface Props {
  session: BackendSession;
  events: BackendEvent[];
  integrity: BackendIntegrity;
}

const CATEGORY_COLORS: Record<string, string> = {
  session: 'bg-slate-100 text-slate-700',
  decision: 'bg-blue-100 text-blue-700',
  confidence: 'bg-indigo-100 text-indigo-700',
  evidence: 'bg-violet-100 text-violet-700',
  revision: 'bg-amber-100 text-amber-700',
  outcome: 'bg-emerald-100 text-emerald-700',
  questionnaire: 'bg-teal-100 text-teal-700',
  other: 'bg-gray-100 text-gray-600',
};

function verdictColor(verdict: string): string {
  if (verdict === 'ok') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (verdict === 'warning') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

function payloadRows(payload: Record<string, unknown>): Array<[string, string]> {
  return Object.entries(payload).map(([k, v]) => [
    k,
    typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v),
  ]);
}

export function ReplayViewer({ session, events, integrity }: Props) {
  const timeline: TimelineRow[] = buildTimeline(events);
  const warnings: Warning[] = buildWarnings(integrity);
  const hasWarnings = warnings.length > 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 font-sans">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Session Replay</h1>
          <span
            className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold border ${verdictColor(integrity.verdict)}`}
          >
            {verdictLabel(integrity.verdict)}
          </span>
          <span
            className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold border ${
              session.status === 'complete'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {session.status === 'complete' ? 'COMPLETE' : 'INCOMPLETE'}
          </span>
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <dt className="text-xs uppercase tracking-wide text-gray-400">Session</dt>
            <dd className="font-mono text-gray-800 break-all">{session.session_id}</dd>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <dt className="text-xs uppercase tracking-wide text-gray-400">Participant</dt>
            <dd className="font-mono text-gray-800">{session.participant_id}</dd>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <dt className="text-xs uppercase tracking-wide text-gray-400">Condition</dt>
            <dd className="font-mono text-gray-800">{session.condition}</dd>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <dt className="text-xs uppercase tracking-wide text-gray-400">Events</dt>
            <dd className="font-mono text-gray-800">
              {integrity.event_count}
              {integrity.duplicate_count > 0 && (
                <span className="ml-1 text-amber-600">({integrity.duplicate_count} dup)</span>
              )}
            </dd>
          </div>
        </dl>
      </header>

      {hasWarnings && (
        <section className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-2">
          <h2 className="text-sm font-bold text-amber-800 uppercase tracking-wide">
            Integrity Warnings
          </h2>
          <ul className="space-y-1.5">
            {warnings.map((w, i) => (
              <li key={i} className="text-sm text-amber-900 flex items-start gap-2">
                <span className="font-mono text-xs bg-amber-200 text-amber-900 rounded px-1.5 py-0.5 shrink-0">
                  {w.category}
                </span>
                <span>
                  {w.detail}
                  {w.eventIds.length > 0 && (
                    <span className="font-mono text-xs text-amber-700 ml-2">
                      {w.eventIds.join(', ')}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!hasWarnings && (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
          No integrity warnings.
        </div>
      )}

      <section>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">
          Event Timeline ({timeline.length})
        </h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No events recorded.</p>
        ) : (
          <ol className="space-y-2">
            {timeline.map((row) => (
              <li key={row.eventId} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 bg-white px-3 py-2">
                  <span
                    className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded ${
                      CATEGORY_COLORS[row.category]
                    }`}
                  >
                    {CATEGORY_LABELS[row.category]}
                  </span>
                  <span className="font-mono text-xs text-gray-700">{row.eventType}</span>
                  <span className="font-mono text-xs text-gray-400">#{row.sequenceNumber}</span>
                  {row.isAnomaly && (
                    <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700">
                      flagged
                    </span>
                  )}
                  <span className="ml-auto font-mono text-xs text-gray-400">
                    {formatTimestamp(row.serverTimestamp)}
                  </span>
                </div>
                <div className="bg-gray-50 px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
                  <div>
                    <span className="text-gray-400">client: </span>
                    <span className="text-gray-700">{formatTimestamp(row.clientTimestamp)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">condition: </span>
                    <span className="text-gray-700">{row.condition}</span>
                  </div>
                  {row.flags.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-gray-400">flags: </span>
                      <span className="text-red-600">{row.flags.join(', ')}</span>
                    </div>
                  )}
                </div>
                <details className="bg-white border-t border-gray-100">
                  <summary className="px-3 py-1.5 text-xs text-gray-500 cursor-pointer select-none">
                    payload
                  </summary>
                  <dl className="px-3 py-2 grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-1 text-xs font-mono">
                    {payloadRows(row.payload).map(([k, v]) => (
                      <Fragment key={k}>
                        <dt className="text-gray-400">{k}</dt>
                        <dd className="text-gray-700 break-all">{v}</dd>
                      </Fragment>
                    ))}
                  </dl>
                </details>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
