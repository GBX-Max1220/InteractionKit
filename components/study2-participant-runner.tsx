'use client';

import { useEffect, useRef, useState } from 'react';

import { Study2InterventionCard } from './study2-intervention-card';
import type { Study2RuntimeResponse } from '@/src/study2/runtime-service';
import type { Study2ParticipantAction } from '@/src/study2/runtime-boundary';

const TOKEN_KEY = 'interactionkit-study2-runtime-token';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/u;

async function runtimeRequest(token: string, init?: { revision: number; action: Study2ParticipantAction }): Promise<Study2RuntimeResponse> {
  const response = await fetch('/api/study2/runtime', {
    method: init ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init ? JSON.stringify({ expectedRevision: init.revision, action: init.action }) : undefined,
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  const value: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = typeof value === 'object' && value !== null && 'error' in value ? String((value as { error: unknown }).error) : `http_${response.status}`;
    throw new Error(code);
  }
  return value as Study2RuntimeResponse;
}

function Slider({ label, value, setValue, min = 0, max = 100 }: { label: string; value: number; setValue: (value: number) => void; min?: number; max?: number }) {
  return <label className="block space-y-2 font-medium"><span>{label}: {value}</span><input className="w-full" type="range" min={min} max={max} value={value} onChange={(event) => setValue(Number(event.target.value))} /></label>;
}

export function Study2ParticipantRunner() {
  const [token, setToken] = useState('');
  const [runtime, setRuntime] = useState<Study2RuntimeResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [consented, setConsented] = useState(false);
  const [decision, setDecision] = useState<'option_a' | 'option_b' | ''>('');
  const [confidence, setConfidence] = useState(50);
  const [familiarity, setFamiliarity] = useState(3);
  const [probability, setProbability] = useState(50);
  const [recognition, setRecognition] = useState<'numerical_support' | 'applicability_boundary' | 'unsure' | ''>('');
  const [comprehension, setComprehension] = useState({ timing: '', feedback: '', distinction: '' });
  const [profile, setProfile] = useState({ ageBracket: '', gender: '', aiFamiliarity: 3, exerciseExpertise: 3 });
  const [postTask, setPostTask] = useState({ numericalCardRelevance: 4, boundaryCardRelevance: 4, attentionResponse: '' });
  const phaseStartedAt = useRef(Date.now());
  const trialStartedAt = useRef(Date.now());

  const acceptRuntime = (next: Study2RuntimeResponse) => {
    setRuntime(next);
    phaseStartedAt.current = Date.now();
    if (next.view.phase === 'initial_response') trialStartedAt.current = Date.now();
    setDecision('');
    setConfidence(50);
    setFamiliarity(3);
    setProbability(50);
    setRecognition('');
    setComprehension({ timing: '', feedback: '', distinction: '' });
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const fragment = new URLSearchParams(window.location.hash.replace(/^#/u, ''));
        const fragmentToken = fragment.get('access_token') ?? '';
        const storedToken = window.sessionStorage.getItem(TOKEN_KEY) ?? '';
        const accessToken = fragmentToken || storedToken;
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
        if (!TOKEN_PATTERN.test(accessToken)) throw new Error('missing_or_invalid_access_link');
        window.sessionStorage.setItem(TOKEN_KEY, accessToken);
        const initial = await runtimeRequest(accessToken);
        if (!cancelled) {
          setToken(accessToken);
          acceptRuntime(initial);
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const elapsed = () => Math.max(0, Math.round(Date.now() - phaseStartedAt.current));
  const submit = async (action: Study2ParticipantAction) => {
    if (!runtime || !token || busy) return;
    setBusy(true);
    setError('');
    try {
      acceptRuntime(await runtimeRequest(token, { revision: runtime.revision, action }));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (message === 'runtime_conflict') {
        try { acceptRuntime(await runtimeRequest(token)); } catch { setError('runtime_reload_failed'); }
      } else setError(message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <main className="mx-auto max-w-2xl p-6"><div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-5"><h1 className="font-bold">Study unavailable</h1><p className="mt-2">{error}</p><p className="mt-2 text-sm">Do not create a second session. Contact the study team using the approved recruitment message.</p></div></main>;
  if (!runtime) return <main className="mx-auto max-w-2xl p-6" aria-busy="true">Loading the integrity-checked study phase…</main>;

  const { view } = runtime;
  const shell = (children: React.ReactNode) => <main className="mx-auto max-w-2xl space-y-5 p-5 sm:p-8">{view.trialIndex !== null && <p className="text-sm text-slate-500">Trial {view.trialIndex + 1} of {view.totalTrials}</p>}{children}{busy && <p role="status">Saving…</p>}</main>;
  const button = (label: string, action: Study2ParticipantAction, disabled = false) => <button className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-40" disabled={disabled || busy} onClick={() => void submit(action)}>{label}</button>;

  if (view.phase === 'consent') return shell(<><h1 className="text-2xl font-bold">Study consent</h1><p>Read the approved participant information before continuing.</p><label className="flex gap-3 rounded-lg border p-4"><input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} />I consent to participate.</label>{button('Begin study', { action: 'consent', consented: true }, !consented)}</>);
  if (view.phase === 'comprehension') return shell(<><h1 className="text-2xl font-bold">Comprehension check</h1><p>Attempt {view.comprehensionAttempt} of 2.</p>
    <label className="block">When is the initial decision collected?<select className="mt-1 w-full rounded border p-2" value={comprehension.timing} onChange={(event) => setComprehension({ ...comprehension, timing: event.target.value })}><option value="">Select…</option><option value="before_ai">Before the AI answer</option><option value="after_ai">After the AI answer</option></select></label>
    <label className="block">Is ground truth revealed after each trial?<select className="mt-1 w-full rounded border p-2" value={comprehension.feedback} onChange={(event) => setComprehension({ ...comprehension, feedback: event.target.value })}><option value="">Select…</option><option value="no_ground_truth">No</option><option value="ground_truth">Yes</option></select></label>
    <label className="block">Is displayed confidence the same as your probability response?<select className="mt-1 w-full rounded border p-2" value={comprehension.distinction} onChange={(event) => setComprehension({ ...comprehension, distinction: event.target.value })}><option value="">Select…</option><option value="different_judgments">No, they are different</option><option value="same_judgment">Yes</option></select></label>
    {button('Submit check', { action: 'submit_comprehension', attempt: view.comprehensionAttempt ?? 1, initialDecisionTiming: comprehension.timing as 'before_ai' | 'after_ai', trialFeedback: comprehension.feedback as 'no_ground_truth' | 'ground_truth', confidenceDistinction: comprehension.distinction as 'different_judgments' | 'same_judgment' }, Object.values(comprehension).some((value) => !value))}</>);
  if (view.phase === 'session_termination') return shell(<><h1 className="text-2xl font-bold">Study ended</h1><p>The comprehension criterion was not met within two attempts, so no trials will be shown.</p>{button('Record and exit', { action: 'terminate_after_comprehension' })}</>);
  if (view.phase === 'participant_profile') return shell(<><h1 className="text-2xl font-bold">About you</h1><label className="block">Age bracket<input className="mt-1 w-full rounded border p-2" value={profile.ageBracket} onChange={(event) => setProfile({ ...profile, ageBracket: event.target.value })} /></label><label className="block">Gender<input className="mt-1 w-full rounded border p-2" value={profile.gender} onChange={(event) => setProfile({ ...profile, gender: event.target.value })} /></label><Slider label="AI familiarity (1–5)" value={profile.aiFamiliarity} min={1} max={5} setValue={(value) => setProfile({ ...profile, aiFamiliarity: value })} /><Slider label="Exercise expertise (1–5)" value={profile.exerciseExpertise} min={1} max={5} setValue={(value) => setProfile({ ...profile, exerciseExpertise: value })} />{button('Continue', { action: 'submit_profile', ...profile }, !profile.ageBracket.trim() || !profile.gender.trim())}</>);
  if (view.phase === 'trial_transition') return shell(<><h1 className="text-2xl font-bold">Ready for the next trial</h1><p>Make your own decision before viewing the AI answer.</p>{button('Start trial', { action: 'start_trial' })}</>);

  const trial = view.trial;
  if (!trial) return shell(<div role="alert">Current trial material is unavailable.</div>);
  const scenario = <section className="space-y-3"><p className="text-sm text-slate-500">Target population: {trial.targetPopulation}</p><h1 className="text-xl font-bold">{trial.decisionPrompt}</h1><p><b>Option A:</b> {trial.optionA}</p><p><b>Option B:</b> {trial.optionB}</p></section>;
  const decisions = <><fieldset className="space-y-2"><legend className="font-semibold">Your decision</legend><label className="flex gap-2 rounded border p-3"><input type="radio" checked={decision === 'option_a'} onChange={() => setDecision('option_a')} />Option A</label><label className="flex gap-2 rounded border p-3"><input type="radio" checked={decision === 'option_b'} onChange={() => setDecision('option_b')} />Option B</label></fieldset><Slider label="Confidence (0–100)" value={confidence} setValue={setConfidence} /></>;
  if (view.phase === 'initial_response') return shell(<>{scenario}{decisions}<Slider label="Topic familiarity (1–5)" value={familiarity} min={1} max={5} setValue={setFamiliarity} />{button('Lock initial response', { action: 'submit_initial_response', decision: decision || 'option_a', confidence, familiarity, phaseDurationMs: elapsed() }, !decision)}</>);
  if (view.phase === 'ai_answer_transition') return shell(<>{scenario}{button('Show AI answer', { action: 'show_ai_answer' })}</>);
  const answer = <section className="space-y-2 rounded-xl border p-5"><div className="flex justify-between gap-3"><h2 className="font-bold">AI answer</h2><span className="font-semibold">AI confidence: {trial.displayedConfidence}%</span></div><p>{trial.answerText}</p></section>;
  if (view.phase === 'ai_answer_reading') return shell(<>{scenario}{answer}{button('Show evidence check', { action: 'show_evidence_check', aiReadingDurationMs: elapsed() })}</>);
  const card = <Study2InterventionCard card={trial.interventionCard} />;
  if (view.phase === 'post_ai_probability') return shell(<>{scenario}{answer}{card}<Slider label="Probability the AI recommendation is correct (0–100)" value={probability} setValue={setProbability} />{button('Continue', { action: 'submit_ai_probability', probabilityAiCorrect: probability, interventionReadingDurationMs: elapsed() })}</>);
  if (view.phase === 'final_response') return shell(<>{scenario}{answer}{card}{decisions}{button('Lock final response', { action: 'submit_final_response', decision: decision || 'option_a', confidence, phaseDurationMs: elapsed() }, !decision)}</>);
  if (view.phase === 'recognition_probe') return shell(<><h1 className="text-xl font-bold">Brief memory check</h1>{(['numerical_support', 'applicability_boundary', 'unsure'] as const).map((value) => <label className="flex gap-2 rounded border p-3" key={value}><input type="radio" checked={recognition === value} onChange={() => setRecognition(value)} />{value.replaceAll('_', ' ')}</label>)}{button('Continue', { action: 'submit_recognition_probe', emphasis: recognition || 'unsure', phaseDurationMs: elapsed() }, !recognition)}</>);
  if (view.phase === 'trial_completion') return shell(<><h1 className="text-xl font-bold">Response saved</h1>{button('Next', { action: 'complete_trial', totalTrialDurationMs: Math.max(0, Date.now() - trialStartedAt.current) })}</>);
  if (view.phase === 'post_task_response') return shell(<><h1 className="text-2xl font-bold">Final questions</h1><Slider label="Numerical-card relevance (1–7)" value={postTask.numericalCardRelevance} min={1} max={7} setValue={(value) => setPostTask({ ...postTask, numericalCardRelevance: value })} /><Slider label="Boundary-card relevance (1–7)" value={postTask.boundaryCardRelevance} min={1} max={7} setValue={(value) => setPostTask({ ...postTask, boundaryCardRelevance: value })} /><label className="block">Attention check: select “Passed”<select className="mt-1 w-full rounded border p-2" value={postTask.attentionResponse} onChange={(event) => setPostTask({ ...postTask, attentionResponse: event.target.value })}><option value="">Select…</option><option value="select_passed">Passed</option><option value="other">Other</option></select></label>{button('Submit', { action: 'submit_post_task', numericalCardRelevance: postTask.numericalCardRelevance, boundaryCardRelevance: postTask.boundaryCardRelevance, attentionResponse: (postTask.attentionResponse || 'other') as 'select_passed' | 'other' }, !postTask.attentionResponse)}</>);
  if (view.phase === 'session_completion') return shell(<><h1 className="text-2xl font-bold">Ready to finish</h1>{button('Complete study', { action: 'complete_session' })}</>);
  return shell(<><h1 className="text-2xl font-bold">{view.completionStatus === 'terminated' ? 'Study ended' : 'Study complete'}</h1><p>{view.completionStatus === 'completed' ? 'Thank you. Follow the approved debrief and completion instructions.' : 'No study trials were completed.'}</p></>);
}
