'use client';

interface Props {
  value: number | null;
  onChange: (value: number) => void;
  onSubmit: () => void;
  isLastTrial: boolean;
}

export function FamiliarityRating({ value, onChange, onSubmit, isLastTrial }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 space-y-5">
      <div>
        <p className="text-base font-semibold text-gray-900 mb-1">
          How familiar were you with this topic before today?
        </p>
        <p className="text-sm text-gray-500">Rate your prior knowledge of this fitness topic</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 justify-center">
          {[1, 2, 3, 4, 5, 6, 7].map((val) => (
            <button
              key={val}
              onClick={() => onChange(val)}
              className={`w-12 h-12 rounded-full text-sm font-medium border transition-all ${
                value === val
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                  : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              {val}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-400 px-1">
          <span>Completely unfamiliar</span>
          <span>Very familiar</span>
        </div>
      </div>

      <div className="text-center pt-2">
        <button
          onClick={onSubmit}
          disabled={value === null}
          className={`px-8 py-3 rounded-lg font-medium text-base transition-colors ${
            value !== null
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isLastTrial ? 'Continue to Questionnaire' : 'Next Scenario'}
        </button>
      </div>
    </div>
  );
}
