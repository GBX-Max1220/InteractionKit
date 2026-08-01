'use client';

import { useMemo } from 'react';
import type { PatternRenderer } from '../types';
import { validatePatternOutput } from '../validation';

export type ConfidenceFormat = 'point_only' | 'range' | 'calibrated_badge';

export interface ConfidenceDisplayInput {
  trialIndex: number;
  scenarioId: string;
  aiOutput: string;
  aiIsCorrect: boolean;
  confidencePoint?: number | null;
  confidenceRangeLower?: number | null;
  confidenceRangeUpper?: number | null;
  calibratedAccuracy?: number | null;
}

export interface ConfidenceDisplayParams {
  format: ConfidenceFormat;
}

export interface ConfidenceDisplayOutput {
  patternName: 'ConfidenceDisplay';
  patternVersion: '1.0.0';
  trialIndex: number;
  scenarioId: string;
  aiOutput: string;
  aiIsCorrect: boolean;
  displayFormat: ConfidenceFormat;
  confidenceVisible: true;
  confidenceSignalType: 'point' | 'interval' | 'calibration_summary';
  confidencePoint: number | null;
  confidenceRangeLower: number | null;
  confidenceRangeUpper: number | null;
  calibratedAccuracy: number | null;
}

type ConfidenceDisplayState = ConfidenceDisplayInput & ConfidenceDisplayParams;

export const confidenceDisplayRenderer: PatternRenderer<
  ConfidenceDisplayInput,
  ConfidenceDisplayOutput,
  ConfidenceDisplayParams,
  ConfidenceDisplayState
> = {
  setup(input, params) {
    return { ...input, ...params };
  },
  collect(state) {
    return {
      patternName: 'ConfidenceDisplay',
      patternVersion: '1.0.0',
      trialIndex: state.trialIndex,
      scenarioId: state.scenarioId,
      aiOutput: state.aiOutput,
      aiIsCorrect: state.aiIsCorrect,
      displayFormat: state.format,
      confidenceVisible: true,
      confidenceSignalType:
        state.format === 'point_only'
          ? 'point'
          : state.format === 'range'
            ? 'interval'
            : 'calibration_summary',
      confidencePoint:
        state.format === 'point_only' ? (state.confidencePoint ?? null) : null,
      confidenceRangeLower:
        state.format === 'range'
          ? (state.confidenceRangeLower ?? null)
          : null,
      confidenceRangeUpper:
        state.format === 'range'
          ? (state.confidenceRangeUpper ?? null)
          : null,
      calibratedAccuracy:
        state.format === 'calibrated_badge'
          ? (state.calibratedAccuracy ?? null)
          : null,
    };
  },
  validate(output) {
    return validatePatternOutput('ConfidenceDisplay', output);
  },
};

export function ConfidenceDisplay({
  input,
  params,
  onComplete,
}: {
  input: ConfidenceDisplayInput;
  params: ConfidenceDisplayParams;
  onComplete: (output: ConfidenceDisplayOutput) => void;
}) {
  const state = useMemo(
    () => confidenceDisplayRenderer.setup(input, params),
    [input, params],
  );
  const output = confidenceDisplayRenderer.collect(state);
  const signal =
    params.format === 'point_only'
      ? `${Math.round((input.confidencePoint ?? 0) * 100)}% confidence`
      : params.format === 'range'
        ? `${Math.round((input.confidenceRangeLower ?? 0) * 100)}–${Math.round((input.confidenceRangeUpper ?? 0) * 100)}% plausible confidence range`
        : `${Math.round((input.calibratedAccuracy ?? 0) * 100)}% historically correct at this confidence`;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
        AI recommendation
      </p>
      <h2 className="mt-3 text-xl font-semibold text-slate-950">
        {input.aiOutput}
      </h2>
      <div className="mt-5 rounded-xl bg-indigo-50 p-4 text-indigo-950">
        <p className="text-sm font-medium">{signal}</p>
        {params.format === 'range' && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-indigo-100">
            <div className="ml-[68%] h-full w-[20%] rounded-full bg-indigo-500" />
          </div>
        )}
      </div>
      <button
        className="mt-6 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        onClick={() => {
          if (confidenceDisplayRenderer.validate(output)) onComplete(output);
        }}
        type="button"
      >
        Continue
      </button>
    </section>
  );
}
