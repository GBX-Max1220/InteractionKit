'use client';

interface Props {
  participantEstimate: number;
  answerAccurate: boolean;
  groundTruth: string;
}

export function GroundTruthReveal({ participantEstimate, answerAccurate, groundTruth }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 space-y-5">
      <h3 className="text-xl font-bold">Ground Truth</h3>

      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${
        answerAccurate
          ? 'bg-green-50 text-green-700 border-green-200'
          : 'bg-red-50 text-red-700 border-red-200'
      }`}>
        <span className="text-lg">{answerAccurate ? '✓' : '✗'}</span>
        <span>
          {answerAccurate
            ? 'The AI answer was CORRECT'
            : 'The AI answer was INCORRECT'}
        </span>
      </div>

      <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Correct information
        </p>
        <p className="text-[15px] leading-relaxed text-gray-800">{groundTruth}</p>
      </div>

      <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
          Your estimate
        </p>
        <div className="flex items-center gap-4">
          <span className={`text-3xl font-bold ${
            answerAccurate ? 'text-green-600' : 'text-red-600'
          }`}>
            {Math.round(participantEstimate * 100)}%
          </span>
          <span className="text-sm text-gray-500">
            {answerAccurate
              ? 'Your estimate reflected the correct outcome.'
              : 'The actual outcome differed from your estimate.'}
          </span>
        </div>
      </div>
    </div>
  );
}
