'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { StudyId, ConditionId } from '@/types/log-event';
import type { Scenario, StudyConfig } from '@/types/log-event';
import { Logger } from '@/lib/logger';
import { assignCondition, fisherYatesShuffle } from '@/lib/randomize';
import { saveCheckpoint, loadCheckpoint, clearCheckpoint, createCheckpoint } from '@/lib/checkpoint';
import { ConsentScreen } from '@/components/consent-screen';
import { ConfidenceOnly } from '@/components/confidence-only';
import { EvidenceAugmented } from '@/components/evidence-augmented';
import { ProbabilitySlider } from '@/components/probability-slider';
import { GroundTruthReveal } from '@/components/ground-truth-reveal';
import { FamiliarityRating } from '@/components/familiarity-rating';
import { TSIQuestionnaire } from '@/components/tsi-questionnaire';
import { DebriefScreen } from '@/components/debrief-screen';

type Phase =
  | 'consent'
  | 'demographics'
  | 'trial-intro'
  | 'trial-confidence'
  | 'trial-decision'
  | 'trial-reveal'
  | 'trial-familiarity'
  | 'tsi'
  | 'debrief';

interface Props {
  config: StudyConfig;
  scenarios: Scenario[];
  prolificPid?: string | null;
  returnUrl?: string | null;
}

const TSI_ITEMS = [
  { id: '1', reversed: true }, { id: '2', reversed: true },
  { id: '3', reversed: true }, { id: '4', reversed: true },
  { id: '5', reversed: true }, { id: '6', reversed: false },
  { id: '7', reversed: false }, { id: '8', reversed: false },
  { id: '9', reversed: false }, { id: '10', reversed: false },
  { id: '11', reversed: false }, { id: '12', reversed: false },
];

export function ScenarioRunner({ config, scenarios, prolificPid, returnUrl }: Props) {
  const loggerRef = useRef(new Logger());
  const timerStartRef = useRef<number>(0);

  const [phase, setPhase] = useState<Phase>('consent');
  const [participantId, setParticipantId] = useState('');
  const [studyId] = useState<StudyId>('interactionkit');
  const [condition, setCondition] = useState<ConditionId>('v1');
  const [scenarioOrder, setScenarioOrder] = useState<Scenario[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [decisionTimer, setDecisionTimer] = useState(0);
  const [probability, setProbability] = useState<number | null>(null);
  const [decision, setDecision] = useState<'trust' | 'distrust' | 'unsure' | null>(null);
  const [familiarity, setFamiliarity] = useState<number | null>(null);
  const [tsiResponses, setTsiResponses] = useState<Record<string, number>>({});
  const [csvContent, setCsvContent] = useState('');
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);

  const currentScenario = scenarioOrder[currentIdx];
  const isV2 = condition === 'v2';
  const progressPct = Math.round((currentIdx / config.scenariosPerParticipant) * 100);

  useEffect(() => {
    const cp = loadCheckpoint();
    if (cp && cp.completedScenariosCount < config.scenariosPerParticipant) {
      setShowContinuePrompt(true);
    }
  }, [config.scenariosPerParticipant]);

  useEffect(() => {
    if (phase === 'trial-intro') {
      timerStartRef.current = Date.now();
    }
  }, [phase]);

  const startNewSession = useCallback(() => {
    const cond = assignCondition();
    const shuffled = fisherYatesShuffle([...scenarios]).slice(0, config.scenariosPerParticipant);
    const pid = prolificPid || 'P' + crypto.randomUUID().slice(0, 8).toUpperCase();
    setCondition(cond);
    setScenarioOrder(shuffled);
    setParticipantId(pid);
    setCurrentIdx(0);
    saveCheckpoint(createCheckpoint(pid, cond, studyId, shuffled.map((s) => s.id)));
    loggerRef.current.push({
      participantId: pid, studyId, condition: cond,
      patternVersion: cond === 'v1' ? 1 : 2,
      scenarioId: 'session', eventType: 'session_start',
      timestamp: new Date().toISOString(), decision: 'unsure',
      decisionTimeMs: -1, probabilityPrediction: -1,
    });
    setPhase('demographics');
    setShowContinuePrompt(false);
  }, [scenarios, config.scenariosPerParticipant, studyId, prolificPid]);

  const resumeSession = useCallback(() => {
    const cp = loadCheckpoint();
    if (!cp) return;
    setParticipantId(cp.participantId);
    setCondition(cp.condition);
    const ordered = cp.scenarioOrderIds
      .map((id) => scenarios.find((s) => s.id === id))
      .filter((s): s is Scenario => s !== undefined);
    setScenarioOrder(ordered);
    setCurrentIdx(cp.currentScenarioIndex);
    setPhase('trial-intro');
    setShowContinuePrompt(false);
  }, [scenarios]);

  const logAllEventsAndAdvance = useCallback(() => {
    if (!currentScenario || probability === null || !decision) return;
    const logger = loggerRef.current;

    // Log decision event with ALL trial data
    logger.push({
      participantId, studyId, condition,
      patternVersion: condition === 'v1' ? 1 : 2,
      scenarioId: currentScenario.id, eventType: 'decision',
      timestamp: new Date().toISOString(),
      decision,
      decisionTimeMs: decisionTimer,
      probabilityPrediction: probability,
      familiarity: familiarity || undefined,
    });

    setProbability(null);
    setDecision(null);
    setFamiliarity(null);

    const next = currentIdx + 1;
    const cp = loadCheckpoint();
    if (cp) { cp.completedScenariosCount = next; cp.currentScenarioIndex = next; saveCheckpoint(cp); }
    if (next >= config.scenariosPerParticipant) setPhase('tsi');
    else { setCurrentIdx(next); setPhase('trial-intro'); }
  }, [currentScenario, probability, decision, decisionTimer, familiarity, currentIdx, participantId, studyId, condition, config.scenariosPerParticipant]);

  const finish = useCallback(() => {
    const logger = loggerRef.current;
    const reversed = TSI_ITEMS.map((item) => {
      const v = tsiResponses[item.id];
      if (v === undefined) return undefined;
      return item.reversed ? 8 - v : v;
    }).filter((v): v is number => v !== undefined);
    const tsiMean = reversed.length === 12
      ? Math.round((reversed.reduce((a, b) => a + b, 0) / 12) * 100) / 100 : 0;
    logger.push({
      participantId, studyId, condition,
      patternVersion: condition === 'v1' ? 1 : 2,
      scenarioId: 'session', eventType: 'tsi_response',
      timestamp: new Date().toISOString(), decision: 'unsure',
      decisionTimeMs: -1, probabilityPrediction: -1,
      tsi_01: tsiResponses['1'], tsi_02: tsiResponses['2'],
      tsi_03: tsiResponses['3'], tsi_04: tsiResponses['4'],
      tsi_05: tsiResponses['5'], tsi_06: tsiResponses['6'],
      tsi_07: tsiResponses['7'], tsi_08: tsiResponses['8'],
      tsi_09: tsiResponses['9'], tsi_10: tsiResponses['10'],
      tsi_11: tsiResponses['11'], tsi_12: tsiResponses['12'], tsiMean,
    });
    logger.push({
      participantId, studyId, condition,
      patternVersion: condition === 'v1' ? 1 : 2,
      scenarioId: 'session', eventType: 'session_complete',
      timestamp: new Date().toISOString(), decision: 'unsure',
      decisionTimeMs: -1, probabilityPrediction: -1,
    });
    setCsvContent(logger.exportCsv());
    clearCheckpoint();
    setPhase('debrief');
  }, [tsiResponses, participantId, studyId, condition]);

  // ─── RESUME PROMPT ────────────────────────────────────
  if (showContinuePrompt) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-md w-full p-8 text-center space-y-6">
          <h2 className="text-xl font-bold">Resume Session?</h2>
          <p className="text-gray-500">You have an incomplete session. Continue where you left off?</p>
          <div className="flex justify-center gap-4">
            <button onClick={resumeSession} className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700">Resume</button>
            <button onClick={() => { clearCheckpoint(); setShowContinuePrompt(false); }}
              className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200">Start Fresh</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── CONSENT ──────────────────────────────────────────
  if (phase === 'consent') return <ConsentScreen onAgree={startNewSession} onDecline={() => {}} />;

  // ─── DEMOGRAPHICS ─────────────────────────────────────
  if (phase === 'demographics') {
    const [age, setAge] = useState<string>('');
    const [gender, setGender] = useState<string>('');
    const [aiFamiliarity, setAiFamiliarity] = useState<number>(0);
    const canProceed = age !== '' && gender !== '' && aiFamiliarity > 0;
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-lg w-full p-8 space-y-5">
          <h2 className="text-xl font-bold">Before we begin</h2>
          <p className="text-sm text-gray-500">Please tell us a little about yourself.</p>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Age</label>
            <select value={age} onChange={(e) => setAge(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">Select...</option>
              <option value="18-24">18-24</option>
              <option value="25-34">25-34</option>
              <option value="35-44">35-44</option>
              <option value="45-54">45-54</option>
              <option value="55+">55+</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Gender</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">Select...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non-binary">Non-binary</option>
              <option value="prefer-not-to-say">Prefer not to say</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">How familiar are you with AI assistants? (1 = not at all, 5 = very familiar)</label>
            <div className="flex gap-2 justify-center">
              {[1,2,3,4,5].map((n) => (
                <button key={n} onClick={() => setAiFamiliarity(n)}
                  className={`w-10 h-10 rounded-full text-sm font-medium border transition-colors ${
                    aiFamiliarity === n ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}>{n}</button>
              ))}
            </div>
          </div>

          <button onClick={() => {
            loggerRef.current.push({
              participantId, studyId, condition,
              patternVersion: condition === 'v1' ? 1 : 2,
              scenarioId: 'session', eventType: 'demographics',
              timestamp: new Date().toISOString(), decision: 'unsure',
              decisionTimeMs: 0, probabilityPrediction: 0,
              age, gender, aiFamiliarity,
            });
            setPhase('trial-intro');
          }} disabled={!canProceed}
            className={`w-full px-6 py-2.5 font-medium rounded-lg transition-colors ${
              canProceed ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}>
            Start Experiment
          </button>
        </div>
      </div>
    );
  }

  // ─── TRIAL INTRO (Question + AI Answer) ──────────────
  if (phase === 'trial-intro' && currentScenario) {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-800">Scenario {currentIdx + 1} of {config.scenariosPerParticipant}</span>
            <span className="text-gray-500">{isV2 ? 'Evidence-Augmented' : 'Confidence Only'}</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 space-y-5">
          <p className="text-xl font-semibold leading-snug text-gray-900">{currentScenario.question}</p>
          <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">AI Answer</p>
            <p className="text-[15px] leading-relaxed text-gray-800">{currentScenario.aiAnswer}</p>
          </div>
          <div className="text-center pt-2">
            <button onClick={() => { setPhase('trial-confidence'); }}
              className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 text-base">
              Show Confidence Information
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── TRIAL CONFIDENCE (Pattern + Slider FIRST) ───────
  if (phase === 'trial-confidence' && currentScenario) {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-800">Scenario {currentIdx + 1} of {config.scenariosPerParticipant}</span>
            <span className="text-gray-500">{isV2 ? 'Evidence-Augmented' : 'Confidence Only'}</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 space-y-5">
          <p className="text-xl font-semibold leading-snug text-gray-900">{currentScenario.question}</p>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">AI Answer (repeated)</p>
            <p className="text-sm leading-relaxed text-gray-700">{currentScenario.aiAnswer}</p>
          </div>
          {isV2 && currentScenario.evidenceSources ? (
            <EvidenceAugmented aiConfidence={currentScenario.aiConfidence} calibrationExplanation={currentScenario.calibrationExplanation || ''} evidenceSources={currentScenario.evidenceSources} />
          ) : (
            <ConfidenceOnly aiConfidence={currentScenario.aiConfidence} />
          )}

          {/* Probability slider FIRST */}
          <ProbabilitySlider
            value={probability}
            onChange={setProbability}
            onSubmit={() => setPhase('trial-decision')}
          />
        </div>
      </div>
    );
  }

  // ─── TRIAL DECISION (Trust/Don't Trust/Unsure SECOND) ─
  if (phase === 'trial-decision' && currentScenario) {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-800">Scenario {currentIdx + 1} of {config.scenariosPerParticipant}</span>
            <span className="text-gray-500">{isV2 ? 'Evidence-Augmented' : 'Confidence Only'}</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 space-y-5">
          <p className="text-xl font-semibold leading-snug text-gray-900">{currentScenario.question}</p>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <p className="text-sm leading-relaxed text-gray-700">{currentScenario.aiAnswer}</p>
          </div>

          {/* Show user's estimate */}
          <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-100">
            <p className="text-sm text-gray-500 mb-1">Your estimate: probability AI answer is correct</p>
            <p className="text-2xl font-bold text-blue-600">{probability !== null ? Math.round(probability * 100) : '—'}%</p>
          </div>

          {/* Trust decision SECOND */}
          <div className="pt-2">
            <p className="text-base font-semibold text-gray-800 mb-4 text-center">Do you trust this AI advice?</p>
            <div className="flex flex-wrap gap-3 justify-center">
              {(['trust', 'distrust', 'unsure'] as const).map((d) => {
                const colors = d === 'trust'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : d === 'distrust'
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-amber-500 hover:bg-amber-600 text-white';
                return (
                  <button key={d} onClick={() => {
                    setDecisionTimer(Date.now() - timerStartRef.current);
                    setDecision(d);
                    setPhase('trial-reveal');
                  }} className={`px-8 py-3.5 rounded-xl font-semibold text-base transition-colors shadow-sm ${colors}`}>
                    {d === 'trust' ? 'Trust' : d === 'distrust' ? "Don't Trust" : 'Unsure'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── TRIAL REVEAL (Ground truth + Familiarity) ───────
  if (phase === 'trial-reveal' && currentScenario) {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-800">Scenario {currentIdx + 1} of {config.scenariosPerParticipant}</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <GroundTruthReveal
          participantEstimate={probability ?? 0.5}
          answerAccurate={currentScenario.answerAccurate}
          groundTruth={currentScenario.groundTruth}
        />
        <FamiliarityRating
          value={familiarity}
          onChange={setFamiliarity}
          onSubmit={logAllEventsAndAdvance}
          isLastTrial={currentIdx + 1 >= config.scenariosPerParticipant}
        />
      </div>
    );
  }

  // ─── TSI ──────────────────────────────────────────────
  if (phase === 'tsi') {
    return (
      <TSIQuestionnaire
        responses={tsiResponses}
        onResponse={(id, v) => setTsiResponses(p => ({ ...p, [id]: v }))}
        onSubmit={finish}
      />
    );
  }

  // ─── DEBRIEF ──────────────────────────────────────────
  if (phase === 'debrief') {
    return (
      <DebriefScreen
        participantId={participantId}
        condition={condition}
        scenarioCount={config.scenariosPerParticipant}
        csvContent={csvContent}
        returnUrl={returnUrl || undefined}
      />
    );
  }

  return null;
}
