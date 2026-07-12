'use client';

interface Props {
  aiConfidence: number;
}

export function ConfidenceOnly({ aiConfidence }: Props) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
      <p className="text-sm font-medium text-gray-500 mb-1">AI Confidence</p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold text-blue-600">{aiConfidence}%</span>
        <span className="text-sm text-gray-500">confidence</span>
      </div>
    </div>
  );
}
