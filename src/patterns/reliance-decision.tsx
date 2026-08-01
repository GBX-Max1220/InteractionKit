'use client';

import { useMemo } from 'react';
import type { PatternRenderer } from '../types';
import { validatePatternOutput } from '../validation';

export interface RelianceDecisionInput {
  trialIndex: number;
  scenarioId: string;
  aiOutput: string;
  aiIsCorrect: boolean;
}

export interface RelianceDecisionParams {
  mode: 'binary';
}

export interface RelianceDecisionOutput {
  patternName: 'RelianceDecision';
  patternVersion: '1.0.0';
  trialIndex: number;
  scenarioId: string;
  aiIsCorrect: boolean;
  humanDecision: 'rely' | 'reject';
  decisionType: 'binary';
  responseTimeMs: number;
  isOptimalReliance: boolean;
  relianceClassification:
    | 'appropriate_reliance'
    | 'appropriate_rejection'
    | 'overreliance'
    | 'underreliance';
}

type RelianceDecisionState = RelianceDecisionInput &
  RelianceDecisionParams & {
    startedAt: number;
    humanDecision: 'rely' | 'reject';
  };

export const relianceDecisionRenderer: PatternRenderer<
  RelianceDecisionInput,
  RelianceDecisionOutput,
  RelianceDecisionParams,
  RelianceDecisionState
> = {
  setup(input, params) {
    return {
      ...input,
      ...params,
      startedAt: Date.now(),
      humanDecision: 'reject',
    };
  },
  collect(state) {
    const isOptimalReliance =
      (state.humanDecision === 'rely' && state.aiIsCorrect) ||
      (state.humanDecision === 'reject' && !state.aiIsCorrect);
    const relianceClassification = state.aiIsCorrect
      ? state.humanDecision === 'rely'
        ? 'appropriate_reliance'
        : 'underreliance'
      : state.humanDecision === 'rely'
        ? 'overreliance'
        : 'appropriate_rejection';

    return {
      patternName: 'RelianceDecision',
      patternVersion: '1.0.0',
      trialIndex: state.trialIndex,
      scenarioId: state.scenarioId,
      aiIsCorrect: state.aiIsCorrect,
      humanDecision: state.humanDecision,
      decisionType: 'binary',
      responseTimeMs: Math.max(0, Date.now() - state.startedAt),
      isOptimalReliance,
      relianceClassification,
    };
  },
  validate(output) {
    return validatePatternOutput('RelianceDecision', output);
  },
};

export function RelianceDecision({
  input,
  params,
  onComplete,
}: {
  input: RelianceDecisionInput;
  params: RelianceDecisionParams;
  onComplete: (output: RelianceDecisionOutput) => void;
}) {
  const initialState = useMemo(
    () => relianceDecisionRenderer.setup(input, params),
    [input, params],
  );

  const choose = (humanDecision: 'rely' | 'reject') => {
    const output = relianceDecisionRenderer.collect({
      ...initialState,
      humanDecision,
    });
    if (relianceDecisionRenderer.validate(output)) onComplete(output);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
        Reliance decision
      </p>
      <h2 className="mt-3 text-xl font-semibold text-slate-950">
        Will you use the AI recommendation?
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Choose the action you would take for this scenario.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          className="rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
          onClick={() => choose('rely')}
          type="button"
        >
          Rely on AI
        </button>
        <button
          className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          onClick={() => choose('reject')}
          type="button"
        >
          Reject recommendation
        </button>
      </div>
    </section>
  );
}
