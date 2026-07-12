'use client';

import { useState, useEffect } from 'react';
import type { StudyConfig, Scenario } from '@/types/log-event';
import { ScenarioRunner } from '@/components/scenario-runner';

import studyConfigData from '@/data/studies/confidence-v1-v2.json';
import fitnessScenarios from '@/data/scenarios/fitness.json';

interface Props {
  params: Promise<{ id: string }>;
}

export default function StudyPage({ params }: Props) {
  const [studyId, setStudyId] = useState<string | null>(null);
  const [prolificPid, setProlificPid] = useState<string | null>(null);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const resolved = await params;
        setStudyId(resolved.id);

        // Read Prolific URL parameters
        if (typeof window !== 'undefined') {
          const searchParams = new URLSearchParams(window.location.search);
          const pid = searchParams.get('PROLIFIC_PID');
          const retUrl = searchParams.get('RETURN_URL');
          if (pid) setProlificPid(pid);
          if (retUrl) setReturnUrl(retUrl);
        }
      } catch {
        setError('Invalid study URL');
      }
    }
    load();
  }, [params]);

  if (error) {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <h1 className="text-xl font-bold text-red-600">{error}</h1>
      </div>
    );
  }

  if (!studyId) {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <p className="text-gray-500">Loading study...</p>
      </div>
    );
  }

  const config = studyConfigData as unknown as StudyConfig;
  const scenarios = fitnessScenarios.scenarios as unknown as Scenario[];

  if (!config || !scenarios.length) {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <h1 className="text-xl font-bold text-red-600">Study configuration not found</h1>
        <p className="text-gray-500 mt-2">Could not load study: {studyId}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="text-center mb-6">
          <p className="text-xs text-gray-400">
            InteractionKit v0.3.0 — Study: {studyId}
          </p>
        </div>
        <ScenarioRunner
          config={config}
          scenarios={scenarios}
          prolificPid={prolificPid}
          returnUrl={returnUrl}
        />
      </div>
    </div>
  );
}
