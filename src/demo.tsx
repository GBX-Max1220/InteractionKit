'use client';

import { useMemo, useState } from 'react';
import { validate } from './composition';
import { serialize } from './log';
import {
  ConfidenceDisplay,
  OutcomeFeedback,
  RelianceDecision,
  type ConfidenceDisplayOutput,
  type OutcomeFeedbackOutput,
  type RelianceDecisionOutput,
} from './patterns';
import type { PatternOutput, SequenceComposition } from './types';

export const demoComposition: SequenceComposition = {
  kind: 'sequence',
  id: 'confidence-reliance-feedback-demo',
  version: '1.0.0',
  initialInput: {
    type: 'object',
    properties: {
      trialIndex: { type: 'integer' },
      scenarioId: { type: 'string' },
      aiOutput: { type: 'string' },
      aiIsCorrect: { type: 'boolean' },
      confidenceRangeLower: { type: ['number', 'null'] },
      confidenceRangeUpper: { type: ['number', 'null'] },
    },
    required: [
      'trialIndex',
      'scenarioId',
      'aiOutput',
      'aiIsCorrect',
      'confidenceRangeLower',
      'confidenceRangeUpper',
    ],
    additionalProperties: false,
  },
  patterns: [
    {
      id: 'uncertainty',
      pattern: 'ConfidenceDisplay',
      version: '1.0.0',
      params: { format: 'range' },
    },
    {
      id: 'reliance',
      pattern: 'RelianceDecision',
      version: '1.0.0',
      params: { mode: 'binary' },
    },
    {
      id: 'feedback',
      pattern: 'OutcomeFeedback',
      version: '1.0.0',
      params: { timing: 'immediate' },
    },
  ],
};

const scenario = {
  trialIndex: 0,
  scenarioId: 'demo-knee-load-01',
  aiOutput: 'Reduce training load by 20% for the next seven days.',
  aiIsCorrect: false,
  confidenceRangeLower: 0.68,
  confidenceRangeUpper: 0.88,
};

type DemoOutput =
  | ConfidenceDisplayOutput
  | RelianceDecisionOutput
  | OutcomeFeedbackOutput;

export default function PatternDemo() {
  const [outputs, setOutputs] = useState<DemoOutput[]>([]);
  const validation = useMemo(() => validate(demoComposition), []);
  const confidenceOutput = outputs[0] as ConfidenceDisplayOutput | undefined;
  const decisionOutput = outputs[1] as RelianceDecisionOutput | undefined;
  const jsonl =
    outputs.length === 3
      ? serialize(outputs as PatternOutput[], demoComposition)
      : '';

  const append = (output: DemoOutput) => {
    setOutputs((current) => [...current, output]);
  };

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-950">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
            InteractionKit Pattern System v1
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Composable reliance trial
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                ConfidenceDisplay(range) → RelianceDecision(binary) →
                OutcomeFeedback(immediate)
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                validation.valid
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              Composition {validation.valid ? 'valid' : 'invalid'}
            </span>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            {outputs.length === 0 && (
              <ConfidenceDisplay
                input={scenario}
                onComplete={append}
                params={{ format: 'range' }}
              />
            )}
            {outputs.length === 1 && confidenceOutput && (
              <RelianceDecision
                input={{
                  trialIndex: confidenceOutput.trialIndex,
                  scenarioId: confidenceOutput.scenarioId,
                  aiOutput: confidenceOutput.aiOutput,
                  aiIsCorrect: confidenceOutput.aiIsCorrect,
                }}
                onComplete={append}
                params={{ mode: 'binary' }}
              />
            )}
            {outputs.length === 2 && decisionOutput && (
              <OutcomeFeedback
                input={{
                  trialIndex: decisionOutput.trialIndex,
                  scenarioId: decisionOutput.scenarioId,
                  humanDecision: decisionOutput.humanDecision,
                  aiIsCorrect: decisionOutput.aiIsCorrect,
                }}
                onComplete={append}
                params={{ timing: 'immediate' }}
              />
            )}
            {outputs.length === 3 && (
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Trial complete
                </p>
                <h2 className="mt-3 text-xl font-semibold text-emerald-950">
                  Three schema-valid pattern rows recorded.
                </h2>
                <button
                  className="mt-6 rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
                  onClick={() => setOutputs([])}
                  type="button"
                >
                  Reset demo
                </button>
              </section>
            )}

            {!validation.valid && (
              <pre className="mt-4 overflow-auto rounded-xl bg-rose-950 p-4 text-xs text-rose-50">
                {validation.errors.join('\n')}
              </pre>
            )}
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-slate-100 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">
                  Experiment log
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {outputs.length}/3 pattern rows
                </p>
              </div>
              {jsonl && (
                <button
                  className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold hover:bg-slate-800"
                  onClick={() => navigator.clipboard.writeText(jsonl)}
                  type="button"
                >
                  Copy JSONL
                </button>
              )}
            </div>
            <pre className="mt-4 max-h-[36rem] min-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/30 p-4 font-mono text-[11px] leading-5 text-slate-300">
              {jsonl ||
                outputs
                  .map((output) => JSON.stringify(output, null, 2))
                  .join('\n')}
              {outputs.length === 0 &&
                'Complete the interaction to generate a self-describing header and one row per pattern.'}
            </pre>
          </aside>
        </div>

        <details className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <summary className="cursor-pointer text-sm font-semibold">
            Inspect derived composition schema
          </summary>
          <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-slate-100 p-4 text-xs text-slate-700">
            {JSON.stringify(validation.derivedSchema, null, 2)}
          </pre>
        </details>
      </div>
    </main>
  );
}
