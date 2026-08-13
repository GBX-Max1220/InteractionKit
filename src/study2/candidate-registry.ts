import { CandidateScenario } from './materials';
import { SupportLevel } from './types';
import { STUDY2_EVIDENCE_DOSSIERS } from './evidence-dossiers';

type Seed = Pick<
  CandidateScenario,
  | 'id'
  | 'domain'
  | 'decisionPrompt'
  | 'optionA'
  | 'optionB'
  | 'targetPopulation'
  | 'intendedDecisionBoundary'
  | 'intendedNumericalGranularity'
>;

function candidate(
  seed: Seed,
  support: SupportLevel,
  provisionalCorrectOption: CandidateScenario['provisionalCorrectOption'],
  flipOptions: boolean,
): CandidateScenario {
  const displayedOptionA = flipOptions ? seed.optionB : seed.optionA;
  const displayedOptionB = flipOptions ? seed.optionA : seed.optionB;
  const displayedCorrectOption =
    provisionalCorrectOption === 'unresolved' || !flipOptions
      ? provisionalCorrectOption
      : provisionalCorrectOption === 'option_a'
        ? 'option_b'
        : 'option_a';
  return {
    ...seed,
    optionA: displayedOptionA,
    optionB: displayedOptionB,
    materialVersion: 'study2-candidates-v0.6',
    status: 'candidate_unreviewed',
    provisionalSupportLevel: support,
    provisionalCorrectOption: displayedCorrectOption,
    evidenceSources: [],
    domainReviews: [],
    authoringNotes:
      'Candidate only. Requires at least two authoritative sources and two independent domain reviews.',
  };
}

const strong: Seed[] = [
  { id: 'strong_01', domain: 'exercise_training', decisionPrompt: 'A healthy beginner has adapted to the same resistance-training workload for several weeks. Which progression is better for continued strength development?', optionA: 'Increase training demands gradually while monitoring technique and recovery.', optionB: 'Keep the original workload until progress has clearly stopped.', targetPopulation: 'Healthy adults beginning resistance training', intendedDecisionBoundary: 'Progression depends on technique, recovery, and response.', intendedNumericalGranularity: 'Direction only; no universal weekly percentage.' },
  { id: 'strong_02', domain: 'exercise_training', decisionPrompt: 'For general whole-body fitness, which resistance-training plan is better?', optionA: 'Train all major muscle groups across the program.', optionB: 'Prioritize upper-body muscle groups and rely on daily activity for the lower body.', targetPopulation: 'Generally healthy adults seeking whole-body fitness', intendedDecisionBoundary: 'Exercise selection depends on ability, goals, and limitations.', intendedNumericalGranularity: 'No fixed exercise count.' },
  { id: 'strong_03', domain: 'recovery', decisionPrompt: 'After substantial sleep loss during the preceding night, should an athlete expect recovery and performance to remain unaffected?', optionA: 'Expect meaningful costs.', optionB: 'Expect no meaningful costs.', targetPopulation: 'Adult recreational and competitive athletes after acute sleep loss', intendedDecisionBoundary: 'Magnitude varies by the sleep-loss pattern, task, test timing, and individual.', intendedNumericalGranularity: 'Directional claim only.' },
  { id: 'strong_04', domain: 'nutrition', decisionPrompt: 'Is adequate total daily protein relevant to adaptation from resistance training?', optionA: 'Treat adequate daily protein as relevant.', optionB: 'Treat daily protein as irrelevant.', targetPopulation: 'Healthy resistance-training adults', intendedDecisionBoundary: 'Needs vary with size, energy intake, age, and training.', intendedNumericalGranularity: 'Use a range only after evidence review.' },
  { id: 'strong_05', domain: 'nutrition', decisionPrompt: 'Is creatine monohydrate generally evidence-supported for healthy adults pursuing strength?', optionA: 'Consider it evidence-supported when no contraindication applies.', optionB: 'Treat it as unsupported.', targetPopulation: 'Healthy adults without relevant contraindications', intendedDecisionBoundary: 'Medical status, pregnancy, medication, and product quality matter.', intendedNumericalGranularity: 'No exact effect or mandatory loading dose.' },
  { id: 'strong_06', domain: 'injury_risk', decisionPrompt: 'An adult develops new chest pain during exercise without a known benign explanation. What is the better immediate action?', optionA: 'Stop exercise and seek an appropriate assessment.', optionB: 'Reduce intensity and finish the session while monitoring the pain.', targetPopulation: 'Adults without a known benign explanation', intendedDecisionBoundary: 'Emergency escalation depends on accompanying symptoms.', intendedNumericalGranularity: 'No probability estimate.' },
  { id: 'strong_07', domain: 'injury_risk', decisionPrompt: 'During strenuous exercise in the heat, a person becomes confused and collapses. What is the better immediate action?', optionA: 'Stop exercise, begin rapid cooling, and activate emergency care.', optionB: 'Move to shade, offer fluid, and resume if alertness improves.', targetPopulation: 'People with altered mental status and collapse during strenuous exercise in heat', intendedDecisionBoundary: 'Immediate cooling and emergency activation should not be delayed; local protocols govern transport and cooling procedures.', intendedNumericalGranularity: 'No universal cooling duration or temperature estimate.' },
  { id: 'strong_08', domain: 'environment', decisionPrompt: 'An athlete is preparing for repeated exercise in the heat. Which preparation is more likely to reduce physiological strain?', optionA: 'Use a structured period of repeated, managed heat exposure.', optionB: 'Use one hard heat session shortly before the event.', targetPopulation: 'Healthy adults training in heat', intendedDecisionBoundary: 'Protocol, hydration, illness, and tolerance matter.', intendedNumericalGranularity: 'No universal number of days.' },
  { id: 'strong_09', domain: 'exercise_training', decisionPrompt: 'A generally healthy inactive adult wants to improve cardiorespiratory fitness. Which plan is better?', optionA: 'Begin repeated aerobic training at an appropriate dose.', optionB: 'Use flexibility sessions as the main fitness stimulus.', targetPopulation: 'Generally healthy adults', intendedDecisionBoundary: 'Mode and dose must match health and baseline fitness.', intendedNumericalGranularity: 'No universal improvement percentage.' },
  { id: 'strong_10', domain: 'recovery', decisionPrompt: 'After unaccustomed hard exercise, symptoms become severe and continue to worsen. What is the better next step?', optionA: 'Stop training and seek assessment for possible red flags.', optionB: 'Use light active recovery and reassess after the next session.', targetPopulation: 'Adults after unaccustomed strenuous exercise', intendedDecisionBoundary: 'Red flags, swelling, weakness, duration, and urine changes matter.', intendedNumericalGranularity: 'No universal pain threshold.' },
  { id: 'strong_11', domain: 'injury_risk', decisionPrompt: 'A novice adolescent cannot perform a resistance exercise with stable technique at the current load. Which progression is preferable?', optionA: 'Use a manageable load with qualified instruction until technique is consistent.', optionB: 'Increase the load and correct technique during the heavier attempts.', targetPopulation: 'Healthy adolescent novices participating in supervised resistance training', intendedDecisionBoundary: 'Exercise complexity, maturity, supervision, and individual capacity determine the manageable load and progression rate.', intendedNumericalGranularity: 'No universal load or increment.' },
  { id: 'strong_12', domain: 'nutrition', decisionPrompt: 'An adult wants exercise-related body-mass reduction. Which nutritional strategy is more likely to matter over time?', optionA: 'Maintain an appropriate, sustained energy deficit.', optionB: 'Change meal timing while keeping total energy intake above expenditure.', targetPopulation: 'Adults pursuing body-mass reduction', intendedDecisionBoundary: 'Medical and eating-disorder risks require individualized care.', intendedNumericalGranularity: 'No universal daily deficit.' },
  { id: 'strong_13', domain: 'injury_risk', decisionPrompt: 'An athlete is recovering after sport-related concussion. Which return-to-sport approach is better?', optionA: 'Use a staged progression with symptom monitoring and appropriate professional oversight.', optionB: 'Resume full training once resting symptoms have improved, then monitor the response.', targetPopulation: 'Athletes with suspected or diagnosed concussion', intendedDecisionBoundary: 'Clinical protocol and urgent red flags govern decisions.', intendedNumericalGranularity: 'No universal recovery duration.' },
  { id: 'strong_14', domain: 'exercise_training', decisionPrompt: 'An older adult without a contraindication wants to improve physical function. Which program is better?', optionA: 'Include appropriately prescribed progressive resistance training.', optionB: 'Use aerobic and mobility training without a resistance component.', targetPopulation: 'Older adults without contraindications', intendedDecisionBoundary: 'Health, supervision, and capacity shape prescription.', intendedNumericalGranularity: 'No universal functional gain.' },
  { id: 'strong_15', domain: 'environment', decisionPrompt: 'A low-altitude resident develops substantial symptoms and reduced exercise tolerance soon after arriving at altitude. What is the better training response?', optionA: 'Temporarily reduce training load and respond to the symptoms.', optionB: 'Maintain the planned sea-level workload to accelerate adaptation.', targetPopulation: 'Low-altitude residents newly exposed to altitude', intendedDecisionBoundary: 'Altitude, ascent rate, illness, and severity matter.', intendedNumericalGranularity: 'No universal load reduction.' },
  { id: 'strong_16', domain: 'injury_risk', decisionPrompt: 'An adult has an acute traumatic musculoskeletal injury with immediate loss of function. What is the better next step?', optionA: 'Stop or modify loading and obtain an appropriate assessment.', optionB: 'Restore range of motion and resume loading as pain permits.', targetPopulation: 'Adults with acute traumatic musculoskeletal injury', intendedDecisionBoundary: 'Severity and red flags determine urgency.', intendedNumericalGranularity: 'No universal waiting period.' },
];

const mixed: Seed[] = [
  { id: 'mixed_01', domain: 'exercise_training', decisionPrompt: 'A healthy adult combines endurance and resistance exercise in the same session, with strength as the current priority. Which order is preferable?', optionA: 'Perform resistance exercise before endurance exercise.', optionB: 'Perform endurance exercise before resistance exercise.', targetPopulation: 'Healthy adults performing concurrent training', intendedDecisionBoundary: 'Primary goal, fatigue, and scheduling alter the recommendation.', intendedNumericalGranularity: 'No universal performance penalty.' },
  { id: 'mixed_02', domain: 'recovery', decisionPrompt: 'During a normal hypertrophy-training week with no urgent need to compete again, which immediate recovery approach is preferable?', optionA: 'Use cold-water immersion after the session.', optionB: 'Use passive recovery without cold-water immersion.', targetPopulation: 'Healthy resistance-trained adults', intendedDecisionBoundary: 'Competition recovery and chronic adaptation goals may conflict.', intendedNumericalGranularity: 'No universal temperature or duration.' },
  { id: 'mixed_03', domain: 'nutrition', decisionPrompt: 'An endurance athlete finishes a glycogen-depleting session and must train again in less than four hours. Which recovery plan is preferable?', optionA: 'Begin carbohydrate-focused refueling promptly after the first session.', optionB: 'Wait until the regular evening meal to begin carbohydrate refueling.', targetPopulation: 'Healthy endurance athletes with less than four hours between demanding sessions', intendedDecisionBoundary: 'Rapid refueling matters when recovery time is short; total daily intake dominates when recovery time is long.', intendedNumericalGranularity: 'Use an evidence-supported range rather than one exact universal dose.' },
  { id: 'mixed_04', domain: 'recovery', decisionPrompt: 'Before a session emphasizing sprint and jump performance, which warm-up emphasis is preferable?', optionA: 'Use prolonged static stretching immediately before the task.', optionB: 'Use a dynamic, task-specific warm-up.', targetPopulation: 'Healthy adult exercisers', intendedDecisionBoundary: 'Stretch duration, task, and accompanying warm-up matter.', intendedNumericalGranularity: 'No universal effect size.' },
  { id: 'mixed_05', domain: 'recovery', decisionPrompt: 'For an uncomplicated musculoskeletal complaint, which plan should provide the main rehabilitation stimulus?', optionA: 'Foam rolling directed at the symptomatic area.', optionB: 'Progressive exercise, with foam rolling used only as an adjunct if helpful.', targetPopulation: 'Adults with uncomplicated musculoskeletal complaints', intendedDecisionBoundary: 'Diagnosis, symptoms, and rehabilitation goals matter.', intendedNumericalGranularity: 'No exact recovery acceleration.' },
  { id: 'mixed_06', domain: 'exercise_training', decisionPrompt: 'For a volume-matched hypertrophy program, which effort strategy is preferable for most working sets?', optionA: 'Reach momentary muscular failure on each set.', optionB: 'Finish most sets close to failure while managing fatigue.', targetPopulation: 'Healthy adults training for hypertrophy', intendedDecisionBoundary: 'Training status, exercise safety, volume, and recovery matter.', intendedNumericalGranularity: 'No universal repetitions-in-reserve target.' },
  { id: 'mixed_07', domain: 'exercise_training', decisionPrompt: 'During heavy multi-joint resistance exercise for strength, which inter-set rest plan is preferable?', optionA: 'Use approximately one minute between sets.', optionB: 'Use approximately three minutes between sets.', targetPopulation: 'Healthy resistance-training adults', intendedDecisionBoundary: 'Load, set duration, status, and time constraints matter.', intendedNumericalGranularity: 'Reject one universal minute value.' },
  { id: 'mixed_08', domain: 'nutrition', decisionPrompt: 'An endurance athlete can tolerate food before a prolonged morning performance session. Which preparation is preferable?', optionA: 'Eat an appropriate pre-exercise meal.', optionB: 'Begin the session after an overnight fast.', targetPopulation: 'Healthy endurance athletes preparing for a prolonged aerobic performance session', intendedDecisionBoundary: 'Session duration, gastrointestinal tolerance, carbohydrate availability, and whether performance or metabolic adaptation is prioritized alter the recommendation.', intendedNumericalGranularity: 'No universal meal size, timing, or performance gain.' },
  { id: 'mixed_09', domain: 'recovery', decisionPrompt: 'A young athlete slept substantially less than usual and has an evening performance test. Which afternoon recovery plan is preferable?', optionA: 'Take a 30-to-60-minute nap ending more than one hour before the test.', optionB: 'Remain awake to avoid possible post-nap grogginess.', targetPopulation: 'Young adult athletes after partial sleep restriction', intendedDecisionBoundary: 'Nap duration, timing, sleep inertia, prior sleep, and individual response matter.', intendedNumericalGranularity: 'Use a duration range and timing boundary rather than a guaranteed effect size.' },
  { id: 'mixed_10', domain: 'exercise_training', decisionPrompt: 'A healthy beginner can adhere to either interval or continuous aerobic training. Which should be the default starting plan?', optionA: 'High-intensity interval training.', optionB: 'Moderate-intensity continuous training.', targetPopulation: 'Healthy adults beginning aerobic training', intendedDecisionBoundary: 'Baseline fitness, preference, health, and dose matter.', intendedNumericalGranularity: 'No universal superiority percentage.' },
  { id: 'mixed_11', domain: 'nutrition', decisionPrompt: 'An athlete who is caffeine-sensitive is competing in the evening. Which pre-exercise strategy is preferable?', optionA: 'Use a standard performance-oriented caffeine dose.', optionB: 'Use a lower dose or avoid caffeine to protect sleep and tolerability.', targetPopulation: 'Adult athletes considering caffeine', intendedDecisionBoundary: 'Habitual use, anxiety, sleep, medication, pregnancy, and timing matter.', intendedNumericalGranularity: 'Avoid a universal dose.' },
  { id: 'mixed_12', domain: 'recovery', decisionPrompt: 'After a demanding team-sport match, which recovery plan is preferable when comfort is the main outcome?', optionA: 'Wear compression garments during recovery.', optionB: 'Recover without compression garments.', targetPopulation: 'Healthy adult athletes', intendedDecisionBoundary: 'Outcome, pressure, exercise type, and expectation may matter.', intendedNumericalGranularity: 'No universal recovery percentage.' },
  { id: 'mixed_13', domain: 'exercise_training', decisionPrompt: 'A trained athlete has a strength-focused program and day-to-day readiness varies. Which loading method is preferable?', optionA: 'Adjust working loads with predefined performance-feedback rules.', optionB: 'Use the scheduled percentage loads without a session-level adjustment.', targetPopulation: 'Resistance-trained adult athletes pursuing maximal strength', intendedDecisionBoundary: 'Training status, exercise, feedback method, measurement quality, and program duration alter the expected advantage.', intendedNumericalGranularity: 'No universal effect size or adjustment threshold.' },
  { id: 'mixed_14', domain: 'injury_risk', decisionPrompt: 'An adult has chronic non-specific low-back pain, no red flags, and tolerates modified movement. Which training response is preferable?', optionA: 'Continue symptom-guided training with modified load and range.', optionB: 'Temporarily stop loaded trunk and lower-body exercise.', targetPopulation: 'Adults with chronic non-specific low-back pain and no emergency signs', intendedDecisionBoundary: 'Red flags, diagnosis, symptom response, and prior loading tolerance alter advice.', intendedNumericalGranularity: 'No universal activity dose or pain threshold.' },
  { id: 'mixed_15', domain: 'nutrition', decisionPrompt: 'An endurance athlete prioritizes performance in an event lasting more than 90 minutes and tolerates carbohydrate during exercise. Which fueling plan is preferable?', optionA: 'Consume carbohydrate during the event.', optionB: 'Use water without carbohydrate during the event.', targetPopulation: 'Healthy endurance athletes in prolonged performance events who tolerate carbohydrate intake', intendedDecisionBoundary: 'Event duration and intensity, gastrointestinal tolerance, pre-event nutrition, and carbohydrate form alter the plan.', intendedNumericalGranularity: 'Use an evidence-supported range after individualization; no universal intake rate.' },
  { id: 'mixed_16', domain: 'nutrition', decisionPrompt: 'A healthy athlete with an adequate diet begins a new endurance-training block. Which antioxidant strategy is preferable?', optionA: 'Add a high-dose antioxidant supplement immediately after training.', optionB: 'Rely on dietary sources unless a specific deficiency or indication is identified.', targetPopulation: 'Healthy adult athletes', intendedDecisionBoundary: 'Nutrient status, dose, and training goal matter.', intendedNumericalGranularity: 'No universal dose or adaptation effect.' },
];

const candidatePool: CandidateScenario[] = [
  ...strong.map((seed, index) => candidate(seed, 'strong_consensus', 'option_a', index % 2 === 1)),
  ...mixed.map((seed, index) =>
    candidate(
      seed,
      'mixed_or_conditional',
      [
        'option_a',
        'option_b',
        'option_a',
        'option_b',
        'option_b',
        'option_b',
        'option_b',
        'option_a',
        'option_a',
        'unresolved',
        'option_b',
        'option_a',
        'option_a',
        'option_a',
        'option_a',
        'option_b',
      ][index] as CandidateScenario['provisionalCorrectOption'],
      index % 2 === 1,
    ),
  ),
];

const dossiersByCandidateId = new Map(
  STUDY2_EVIDENCE_DOSSIERS.map((dossier) => [dossier.candidateId, dossier]),
);

export const STUDY2_CANDIDATES: CandidateScenario[] = candidatePool.map((scenario) => {
  const dossier = dossiersByCandidateId.get(scenario.id);
  if (!dossier) return scenario;
  return {
    ...scenario,
    status: 'source_dossier_complete',
    evidenceSources: dossier.sources.map((source) => ({
      id: source.id,
      citation: source.fullCitation,
      urlOrDoi: `https://doi.org/${source.doi}`,
      authorityType: source.authorityType,
      supportsBinaryDecision: source.supportsBinaryDecision !== 'no',
      supportsEvidenceLevel: source.supportsEvidenceLevel !== 'no',
      verifiedBy: source.metadataVerifiedBy,
      verifiedAt: source.metadataVerifiedAt,
    })),
    authoringNotes:
      'Source dossier complete. Requires two independent blinded domain reviews before retention.',
  };
});
