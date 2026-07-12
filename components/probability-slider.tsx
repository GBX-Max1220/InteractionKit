'use client';

import { useState } from 'react';

interface Props {
  value: number | null;
  onChange: (value: number) => void;
  onSubmit: () => void;
}

export function ProbabilitySlider({ value, onChange, onSubmit }: Props) {
  const [interacted, setInteracted] = useState(false);

  // Use the last interacted value internally; fall back to parent value
  const currentValue = interacted ? (value ?? 50) : 50;
  const percent = Math.round(currentValue * 100);

  const handleChange = (newVal: number) => {
    setInteracted(true);
    onChange(newVal);
  };

  return (
    <div className="space-y-3 mt-4 pt-4 border-t border-gray-100">
      <p className="text-base font-semibold text-gray-800">
        What is the probability that the AI answer was CORRECT?
      </p>
      <p className="text-sm text-gray-500">
        Move the slider to indicate your estimate, then confirm
      </p>

      <div className="text-center">
        <span className="text-5xl font-bold text-blue-600">
          {interacted ? `${percent}%` : '—%'}
        </span>
      </div>

      <div className="space-y-2">
        <input
          type="range"
          min="0"
          max="100"
          value={percent}
          onChange={(e) => handleChange(Number(e.target.value) / 100)}
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="flex justify-between text-xs text-gray-500">
        <span>Definitely incorrect</span>
        <span>Definitely correct</span>
      </div>

      <div className="text-center pt-2">
        <button
          onClick={onSubmit}
          disabled={!interacted}
          className={`px-10 py-3 rounded-lg font-medium text-base transition-colors ${
            interacted
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {interacted ? `Confirm — ${percent}%` : 'Move the slider first'}
        </button>
      </div>
    </div>
  );
}
