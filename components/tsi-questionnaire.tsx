'use client';

const TSI_ITEMS = [
  { id: 1, text: 'The system is deceptive', reversed: true },
  { id: 2, text: 'The system behaves in an underhanded manner', reversed: true },
  { id: 3, text: "I am suspicious of the system's intent, action, or outputs", reversed: true },
  { id: 4, text: 'I am wary of the system', reversed: true },
  { id: 5, text: "The system's actions will have a harmful or injurious outcome", reversed: true },
  { id: 6, text: 'I am confident in the system', reversed: false },
  { id: 7, text: 'The system provides security', reversed: false },
  { id: 8, text: 'The system has integrity', reversed: false },
  { id: 9, text: 'The system is dependable', reversed: false },
  { id: 10, text: 'The system is reliable', reversed: false },
  { id: 11, text: 'I can trust the system', reversed: false },
  { id: 12, text: 'I am familiar with the system', reversed: false },
];

interface Props {
  responses: Record<string, number>;
  onResponse: (itemId: string, value: number) => void;
  onSubmit: () => void;
}

export function TSIQuestionnaire({ responses, onResponse, onSubmit }: Props) {
  const answeredCount = TSI_ITEMS.filter((item) => responses[item.id] !== undefined).length;
  const allAnswered = answeredCount === TSI_ITEMS.length;

  return (
    <div className="max-w-2xl mx-auto py-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 space-y-6">
        <div>
          <h2 className="text-xl font-bold">Questionnaire</h2>
          <p className="text-sm text-gray-500 mt-1">
            Please rate the following statements about the AI system you just interacted with.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            {answeredCount} of {TSI_ITEMS.length} answered
          </p>
        </div>

        <div className="space-y-5">
          {TSI_ITEMS.map((item) => (
            <div key={item.id} className="pb-5 border-b border-gray-100 last:border-0 last:pb-0">
              <p className="text-sm font-medium text-gray-800 mb-3">{item.text}</p>
              <div>
                <div className="flex items-center gap-2 justify-center mb-1.5">
                  {[1, 2, 3, 4, 5, 6, 7].map((val) => (
                    <button
                      key={val}
                      onClick={() => onResponse(String(item.id), val)}
                      className={`w-10 h-10 rounded-full text-sm font-medium border transition-all ${
                        responses[item.id] === val
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                          : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-[11px] text-gray-400 px-1">
                  <span>Not at all</span>
                  <span>Extremely</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center pt-4">
          <button
            onClick={onSubmit}
            disabled={!allAnswered}
            className={`inline-flex items-center justify-center px-10 py-3 font-medium rounded-lg transition-colors text-base ${
              allAnswered
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {allAnswered ? 'Submit Questionnaire' : `Please answer all ${TSI_ITEMS.length} items`}
          </button>
        </div>
      </div>
    </div>
  );
}
