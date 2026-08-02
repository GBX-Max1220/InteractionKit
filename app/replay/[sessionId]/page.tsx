'use client';

// Internal session replay page. Loads one session from the study backend and
// renders it with the ReplayViewer.

import { useState, useEffect } from 'react';
import { ReplayViewer } from '@/components/replay-viewer';
import { fetchReplay, type ReplayData } from '@/lib/replay-api';
import { BACKEND_URL } from '@/lib/sync-config';

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default function ReplayPage({ params }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [data, setData] = useState<ReplayData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    params
      .then(async (p) => {
        const sid = p.sessionId;
        if (cancelled) return;
        setSessionId(sid);
        try {
          const replay = await fetchReplay(sid, controller.signal);
          if (!cancelled) setData(replay);
        } catch (err) {
          if (!cancelled && !controller.signal.aborted) {
            setError(err instanceof Error ? err.message : String(err));
          }
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [params]);

  if (error) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <h1 className="text-xl font-bold text-red-600">Could not load session</h1>
        <p className="text-sm text-gray-500 mt-2">{error}</p>
        <p className="text-xs text-gray-400 mt-4">
          Backend URL: <span className="font-mono">{BACKEND_URL}</span>
        </p>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <p className="text-gray-500">Loading session…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <p className="text-gray-500">
          Fetching session <span className="font-mono text-xs">{sessionId}</span>…
        </p>
      </div>
    );
  }

  return <ReplayViewer session={data.session} events={data.events} integrity={data.integrity} />;
}
