'use client';

interface Props {
  participantId: string;
  condition: string;
  scenarioCount: number;
  csvContent: string;
  returnUrl?: string;
}

function validateProlificUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && parsed.hostname.endsWith('.prolific.com')) {
      return url;
    }
    // Also allow same-origin absolute paths only (not protocol-relative URLs)
    if (url.startsWith('/') && !url.startsWith('//')) return url;
    return null;
  } catch {
    return null;
  }
}

export function DebriefScreen({ participantId, condition, scenarioCount, csvContent, returnUrl }: Props) {
  const safeReturnUrl = returnUrl ? validateProlificUrl(returnUrl) : null;
  const handleDownload = () => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interactionkit-${participantId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-8">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-lg w-full p-8 space-y-6 text-center">
        <div className="space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 text-3xl mx-auto">
            ✓
          </div>
          <h1 className="text-2xl font-bold">Experiment Complete</h1>
          <p className="text-gray-500">Thank you for your participation!</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-5 border border-gray-100 text-left space-y-2 text-sm">
          <p>
            <span className="text-gray-500">Participant ID:</span>{' '}
            <span className="font-semibold text-gray-800">{participantId}</span>
          </p>
          <p>
            <span className="text-gray-500">Condition:</span>{' '}
            <span className="font-semibold text-gray-800">
              {condition === 'v1' ? 'Confidence Only' : 'Evidence-Augmented'}
            </span>
          </p>
          <p>
            <span className="text-gray-500">Scenarios completed:</span>{' '}
            <span className="font-semibold text-gray-800">{scenarioCount}</span>
          </p>
        </div>

        <button
          onClick={handleDownload}
          className="w-full px-8 py-3.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-base"
        >
          Download My Data (CSV)
        </button>

        <p className="text-xs text-gray-400">
          Your data exists only in this browser session.
          Download the CSV before closing this page.
        </p>

        {safeReturnUrl && (
          <div className="pt-2">
            <a
              href={safeReturnUrl}
              rel="noopener noreferrer"
              className="inline-block px-8 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              Return to Prolific
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
