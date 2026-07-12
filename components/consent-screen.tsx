'use client';

interface Props {
  onAgree: () => void;
  onDecline: () => void;
}

export function ConsentScreen({ onAgree, onDecline }: Props) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center py-8">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-xl w-full p-8 space-y-6">
        <h1 className="text-2xl font-bold">Informed Consent</h1>

        <div className="space-y-4 text-[15px] leading-relaxed text-gray-700">
          <p>
            You are invited to participate in a research study about how people
            interact with AI-generated fitness advice.
          </p>
          <p>
            <span className="font-semibold text-gray-900">What you will do:</span> You will read 10 fitness-related
            questions and AI-generated answers. For each, you will rate your trust
            in the answer and estimate the probability that it is correct.
          </p>
          <p>
            <span className="font-semibold text-gray-900">Time required:</span> Approximately 10–15 minutes.
          </p>
          <p>
            <span className="font-semibold text-gray-900">Data collected:</span> Your trust decisions, response times,
            probability estimates, and a brief questionnaire. No personally
            identifying information will be collected beyond basic demographics.
          </p>
          <p>
            <span className="font-semibold text-gray-900">Your rights:</span> Participation is voluntary. You may
            withdraw at any time without penalty.
          </p>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            onClick={onAgree}
            className="inline-flex items-center justify-center px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-base"
          >
            I Agree — Begin Experiment
          </button>
          <button
            onClick={onDecline}
            className="inline-flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors text-base"
          >
            I Do Not Agree
          </button>
        </div>
      </div>
    </div>
  );
}
