'use client';

interface EvidenceSource {
  title: string;
  quality: number;
}

interface Props {
  aiConfidence: number;
  calibrationExplanation: string;
  evidenceSources: EvidenceSource[];
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500 text-sm tracking-wider">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}

export function EvidenceAugmented({ aiConfidence, calibrationExplanation, evidenceSources }: Props) {
  return (
    <div className="space-y-3">
      {/* Confidence badge */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <p className="text-sm font-medium text-gray-500 mb-1">AI Confidence</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold text-blue-600">{aiConfidence}%</span>
          <span className="text-sm text-gray-500">confidence</span>
        </div>
      </div>

      {/* Calibration explanation */}
      <div className="bg-blue-50/40 border border-blue-100 rounded-xl p-5">
        <p className="text-sm font-semibold text-gray-700 mb-2">Why this confidence</p>
        <p className="text-sm leading-relaxed text-gray-600">
          {calibrationExplanation}
        </p>
      </div>

      {/* Evidence sources */}
      <div className="border border-gray-200 rounded-xl p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">Evidence Sources</p>
        <ul className="space-y-2.5">
          {evidenceSources.map((source, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <span className="text-blue-500 mt-0.5 shrink-0">•</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{source.title}</p>
                <Stars rating={source.quality} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
