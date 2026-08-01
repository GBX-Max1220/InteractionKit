'use client';

import { useMemo } from 'react';
import type { PatternRenderer } from '../types';
import { validatePatternOutput } from '../validation';

export interface OutcomeFeedbackInput {
  trialIndex: number;
  scenarioId: string;
  humanDecision: 'rely' | 'reject';
  aiIsCorrect: boolean;
}

export interface OutcomeFeedbackParams {
  timing: 'immediate';
}

export interface OutcomeFeedbackOutput {
  patternName: 'OutcomeFeedback';
  patternVersion: '1.0.0';
  trialIndex: number;
  scenarioId: string;
  humanDecision: 'rely' | 'reject';
  aiIsCorrect: boolean;
  feedbackFormat: 'immediate';
  feedbackOutcome: 'correct' | 'incorrect';
  decisionCorrectness: boolean;
  feedbackShownAt: string;
}

type OutcomeFeedbackState = OutcomeFeedbackInput & OutcomeFeedbackParams;

export const outcomeFeedbackRenderer: PatternRenderer<
  OutcomeFeedbackInput,
  OutcomeFeedbackOutput,
  OutcomeFeedbackParams,
  OutcomeFeedbackState
> = {
  setup(input, params) {
    return { ...input, ...params };
  },
  collect(state) {
    const decisionCorrectness =
      (state.humanDecision === 'rely' && state.aiIsCorrect) ||
      (state.humanDecision === 'reject' && !state.aiIsCorrect);
    return {
      patternName: 'OutcomeFeedback',
      patternVersion: '1.0.0',
      trialIndex: state.trialIndex,
      scenarioId: state.scenarioId,
      humanDecision: state.humanDecision,
      aiIsCorrect: state.aiIsCorrect,
      feedbackFormat: 'immediate',
      feedbackOutcome: decisionCorrectness ? 'correct' : 'incorrect',
      decisionCorrectness,
      feedbackShownAt: new Date().toISOString(),
    };
  },
  validate(output) {
    return validatePatternOutput('OutcomeFeedback', output);
  },
};

export function OutcomeFeedback({
  input,
  params,
  onComplete,
}: {
  input: OutcomeFeedbackInput;
  params: OutcomeFeedbackParams;
  onComplete: (output: OutcomeFeedbackOutput) => void;
}) {
  const state = useMemo(
    () => outcomeFeedbackRenderer.setup(input, params),
    [input, params],
  );
  const output = outcomeFeedbackRenderer.collect(state);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
        Immediate outcome
      </p>
      <h2 className="mt-3 text-xl font-semibold text-slate-950">
        Your decision was {output.feedbackOutcome}.
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        The AI recommendation was {input.aiIsCorrect ? 'correct' : 'incorrect'}.
      </p>
      <button
        className="mt-6 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        onClick={() => {
          const acknowledged = outcomeFeedbackRenderer.collect(state);
          if (outcomeFeedbackRenderer.validate(acknowledged)) {
            onComplete(acknowledged);
          }
        }}
        type="button"
      >
        Record trial
      </button>
    </section>
  );
}
