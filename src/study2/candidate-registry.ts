import { CandidateScenario } from './materials';
import { SupportLevel } from './types';

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
    materialVersion: 'study2-candidates-v0.1',
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
  { id: 'strong_03', domain: 'recovery', decisionPrompt: 'When sleep is repeatedly restricted, should recovery and performance be expected to remain unaffected?', optionA: 'Expect meaningful costs.', optionB: 'Expect no meaningful costs.', targetPopulation: 'Adult recreational and competitive athletes', intendedDecisionBoundary: 'Magnitude varies by task, duration, and individual.', intendedNumericalGranularity: 'Directional claim only.' },
  { id: 'strong_04', domain: 'nutrition', decisionPrompt: 'Is adequate total daily protein relevant to adaptation from resistance training?', optionA: 'Treat adequate daily protein as relevant.', optionB: 'Treat daily protein as irrelevant.', targetPopulation: 'Healthy resistance-training adults', intendedDecisionBoundary: 'Needs vary with size, energy intake, age, and training.', intendedNumericalGranularity: 'Use a range only after evidence review.' },
  { id: 'strong_05', domain: 'nutrition', decisionPrompt: 'Is creatine monohydrate generally evidence-supported for healthy adults pursuing strength?', optionA: 'Consider it evidence-supported when no contraindication applies.', optionB: 'Treat it as unsupported.', targetPopulation: 'Healthy adults without relevant contraindications', intendedDecisionBoundary: 'Medical status, pregnancy, medication, and product quality matter.', intendedNumericalGranularity: 'No exact effect or mandatory loading dose.' },
  { id: 'strong_06', domain: 'injury_risk', decisionPrompt: 'An adult develops new chest pain during exercise without a known benign explanation. What is the better immediate action?', optionA: 'Stop exercise and seek an appropriate assessment.', optionB: 'Reduce intensity and finish the session while monitoring the pain.', targetPopulation: 'Adults without a known benign explanation', intendedDecisionBoundary: 'Emergency escalation depends on accompanying symptoms.', intendedNumericalGranularity: 'No probability estimate.' },
  { id: 'strong_07', domain: 'injury_risk', decisionPrompt: 'A person exercising in the heat develops symptoms compatible with heat illness. What is the better immediate action?', optionA: 'Stop exercise and begin appropriate cooling or escalation.', optionB: 'Rest briefly, drink fluid, and resume if the person feels somewhat better.', targetPopulation: 'People exercising in heat with compatible symptoms', intendedDecisionBoundary: 'Emergency signs require immediate professional response.', intendedNumericalGranularity: 'No universal safe duration.' },
  { id: 'strong_08', domain: 'environment', decisionPrompt: 'An athlete is preparing for repeated exercise in the heat. Which preparation is more likely to reduce physiological strain?', optionA: 'Use a structured period of repeated, managed heat exposure.', optionB: 'Use one hard heat session shortly before the event.', targetPopulation: 'Healthy adults training in heat', intendedDecisionBoundary: 'Protocol, hydration, illness, and tolerance matter.', intendedNumericalGranularity: 'No universal number of days.' },
  { id: 'strong_09', domain: 'exercise_training', decisionPrompt: 'A generally healthy inactive adult wants to improve cardiorespiratory fitness. Which plan is better?', optionA: 'Begin repeated aerobic training at an appropriate dose.', optionB: 'Use flexibility sessions as the main fitness stimulus.', targetPopulation: 'Generally healthy adults', intendedDecisionBoundary: 'Mode and dose must match health and baseline fitness.', intendedNumericalGranularity: 'No universal improvement percentage.' },
  { id: 'strong_10', domain: 'recovery', decisionPrompt: 'After unaccustomed hard exercise, symptoms become severe and continue to worsen. What is the better next step?', optionA: 'Stop training and seek assessment for possible red flags.', optionB: 'Use light active recovery and reassess after the next session.', targetPopulation: 'Adults after unaccustomed strenuous exercise', intendedDecisionBoundary: 'Red flags, swelling, weakness, duration, and urine changes matter.', intendedNumericalGranularity: 'No universal pain threshold.' },
  { id: 'strong_11', domain: 'injury_risk', decisionPrompt: 'Should a novice increase load when a complex exercise cannot be performed with controlled technique?', optionA: 'Establish control before increasing load.', optionB: 'Increase load despite loss of control.', targetPopulation: 'Novice resistance-training participants', intendedDecisionBoundary: 'Acceptable variation depends on exercise and anatomy.', intendedNumericalGranularity: 'No universal load increment.' },
  { id: 'strong_12', domain: 'nutrition', decisionPrompt: 'An adult wants exercise-related body-mass reduction. Which nutritional strategy is more likely to matter over time?', optionA: 'Maintain an appropriate, sustained energy deficit.', optionB: 'Change meal timing while keeping total energy intake above expenditure.', targetPopulation: 'Adults pursuing body-mass reduction', intendedDecisionBoundary: 'Medical and eating-disorder risks require individualized care.', intendedNumericalGranularity: 'No universal daily deficit.' },
  { id: 'strong_13', domain: 'injury_risk', decisionPrompt: 'An athlete is recovering after sport-related concussion. Which return-to-sport approach is better?', optionA: 'Use a staged progression with symptom monitoring and appropriate professional oversight.', optionB: 'Resume full training once resting symptoms have improved, then monitor the response.', targetPopulation: 'Athletes with suspected or diagnosed concussion', intendedDecisionBoundary: 'Clinical protocol and urgent red flags govern decisions.', intendedNumericalGranularity: 'No universal recovery duration.' },
  { id: 'strong_14', domain: 'exercise_training', decisionPrompt: 'An older adult without a contraindication wants to improve physical function. Which program is better?', optionA: 'Include appropriately prescribed progressive resistance training.', optionB: 'Use aerobic and mobility training without a resistance component.', targetPopulation: 'Older adults without contraindications', intendedDecisionBoundary: 'Health, supervision, and capacity shape prescription.', intendedNumericalGranularity: 'No universal functional gain.' },
  { id: 'strong_15', domain: 'environment', decisionPrompt: 'A low-altitude resident develops substantial symptoms and reduced exercise tolerance soon after arriving at altitude. What is the better training response?', optionA: 'Temporarily reduce training load and respond to the symptoms.', optionB: 'Maintain the planned sea-level workload to accelerate adaptation.', targetPopulation: 'Low-altitude residents newly exposed to altitude', intendedDecisionBoundary: 'Altitude, ascent rate, illness, and severity matter.', intendedNumericalGranularity: 'No universal load reduction.' },
  { id: 'strong_16', domain: 'injury_risk', decisionPrompt: 'An adult has an acute traumatic musculoskeletal injury with immediate loss of function. What is the better next step?', optionA: 'Stop or modify loading and obtain an appropriate assessment.', optionB: 'Restore range of motion and resume loading as pain permits.', targetPopulation: 'Adults with acute traumatic musculoskeletal injury', intendedDecisionBoundary: 'Severity and red flags determine urgency.', intendedNumericalGranularity: 'No universal waiting period.' },
];

const mixed: Seed[] = [
  { id: 'mixed_01', domain: 'exercise_training', decisionPrompt: 'A healthy adult combines endurance and resistance exercise in the same session, with strength as the current priority. Which order is preferable?', optionA: 'Perform resistance exercise before endurance exercise.', optionB: 'Perform endurance exercise before resistance exercise.', targetPopulation: 'Healthy adults performing concurrent training', intendedDecisionBoundary: 'Primary goal, fatigue, and scheduling alter the recommendation.', intendedNumericalGranularity: 'No universal performance penalty.' },
  { id: 'mixed_02', domain: 'recovery', decisionPrompt: 'During a normal hypertrophy-training week with no urgent need to compete again, which immediate recovery approach is preferable?', optionA: 'Use cold-water immersion after the session.', optionB: 'Use passive recovery without cold-water immersion.', targetPopulation: 'Healthy resistance-trained adults', intendedDecisionBoundary: 'Competition recovery and chronic adaptation goals may conflict.', intendedNumericalGranularity: 'No universal temperature or duration.' },
  { id: 'mixed_03', domain: 'nutrition', decisionPrompt: 'A resistance-trained adult meets daily protein needs and ate a protein-containing meal two hours before training. Which post-training plan is preferable?', optionA: 'Consume another protein serving within 30 minutes.', optionB: 'Consume protein with the next planned meal.', targetPopulation: 'Healthy resistance-training adults', intendedDecisionBoundary: 'Total intake, meal timing, age, and training state matter.', intendedNumericalGranularity: 'Reject an exact universal deadline.' },
  { id: 'mixed_04', domain: 'recovery', decisionPrompt: 'Before a session emphasizing sprint and jump performance, which warm-up emphasis is preferable?', optionA: 'Use prolonged static stretching immediately before the task.', optionB: 'Use a dynamic, task-specific warm-up.', targetPopulation: 'Healthy adult exercisers', intendedDecisionBoundary: 'Stretch duration, task, and accompanying warm-up matter.', intendedNumericalGranularity: 'No universal effect size.' },
  { id: 'mixed_05', domain: 'recovery', decisionPrompt: 'For an uncomplicated musculoskeletal complaint, which plan should provide the main rehabilitation stimulus?', optionA: 'Foam rolling directed at the symptomatic area.', optionB: 'Progressive exercise, with foam rolling used only as an adjunct if helpful.', targetPopulation: 'Adults with uncomplicated musculoskeletal complaints', intendedDecisionBoundary: 'Diagnosis, symptoms, and rehabilitation goals matter.', intendedNumericalGranularity: 'No exact recovery acceleration.' },
  { id: 'mixed_06', domain: 'exercise_training', decisionPrompt: 'For a volume-matched hypertrophy program, which effort strategy is preferable for most working sets?', optionA: 'Reach momentary muscular failure on each set.', optionB: 'Finish most sets close to failure while managing fatigue.', targetPopulation: 'Healthy adults training for hypertrophy', intendedDecisionBoundary: 'Training status, exercise safety, volume, and recovery matter.', intendedNumericalGranularity: 'No universal repetitions-in-reserve target.' },
  { id: 'mixed_07', domain: 'exercise_training', decisionPrompt: 'During heavy multi-joint resistance exercise for strength, which inter-set rest plan is preferable?', optionA: 'Use approximately one minute between sets.', optionB: 'Use approximately three minutes between sets.', targetPopulation: 'Healthy resistance-training adults', intendedDecisionBoundary: 'Load, set duration, status, and time constraints matter.', intendedNumericalGranularity: 'Reject one universal minute value.' },
  { id: 'mixed_08', domain: 'nutrition', decisionPrompt: 'Two aerobic fat-loss programs have the same weekly exercise and energy intake. Which feeding schedule is preferable?', optionA: 'Perform the sessions fasted.', optionB: 'Choose fasted or fed sessions according to adherence and tolerance.', targetPopulation: 'Healthy adults pursuing fat loss', intendedDecisionBoundary: 'Medical status, training quality, and adherence matter.', intendedNumericalGranularity: 'No universal extra fat-loss percentage.' },
  { id: 'mixed_09', domain: 'recovery', decisionPrompt: 'Which signal is more useful for judging whether a training program is working over several weeks?', optionA: 'The amount of next-day muscle soreness.', optionB: 'Changes in performance and progress toward the program goal.', targetPopulation: 'Healthy adult exercisers', intendedDecisionBoundary: 'Novelty, sensitivity, and exercise type affect soreness.', intendedNumericalGranularity: 'No soreness threshold establishes effectiveness.' },
  { id: 'mixed_10', domain: 'exercise_training', decisionPrompt: 'A healthy beginner can adhere to either interval or continuous aerobic training. Which should be the default starting plan?', optionA: 'High-intensity interval training.', optionB: 'Moderate-intensity continuous training.', targetPopulation: 'Healthy adults beginning aerobic training', intendedDecisionBoundary: 'Baseline fitness, preference, health, and dose matter.', intendedNumericalGranularity: 'No universal superiority percentage.' },
  { id: 'mixed_11', domain: 'nutrition', decisionPrompt: 'An athlete who is caffeine-sensitive is competing in the evening. Which pre-exercise strategy is preferable?', optionA: 'Use a standard performance-oriented caffeine dose.', optionB: 'Use a lower dose or avoid caffeine to protect sleep and tolerability.', targetPopulation: 'Adult athletes considering caffeine', intendedDecisionBoundary: 'Habitual use, anxiety, sleep, medication, pregnancy, and timing matter.', intendedNumericalGranularity: 'Avoid a universal dose.' },
  { id: 'mixed_12', domain: 'recovery', decisionPrompt: 'After a demanding team-sport match, which recovery plan is preferable when comfort is the main outcome?', optionA: 'Wear compression garments during recovery.', optionB: 'Recover without compression garments.', targetPopulation: 'Healthy adult athletes', intendedDecisionBoundary: 'Outcome, pressure, exercise type, and expectation may matter.', intendedNumericalGranularity: 'No universal recovery percentage.' },
  { id: 'mixed_13', domain: 'exercise_training', decisionPrompt: 'With weekly resistance-training volume held constant, which schedule is preferable for hypertrophy?', optionA: 'Distribute the volume across two sessions per muscle group.', optionB: 'Distribute the volume across four sessions per muscle group.', targetPopulation: 'Healthy resistance-trained adults', intendedDecisionBoundary: 'Volume, recovery, schedule, and exercise selection matter.', intendedNumericalGranularity: 'No universal sessions-per-week rule.' },
  { id: 'mixed_14', domain: 'injury_risk', decisionPrompt: 'An adult has mild non-specific low-back pain, no red flags, and tolerates modified movement. Which training response is preferable?', optionA: 'Temporarily stop loaded trunk and lower-body exercise.', optionB: 'Continue symptom-guided training with modified load and range.', targetPopulation: 'Adults with non-specific low-back pain and no emergency signs', intendedDecisionBoundary: 'Red flags, diagnosis, and symptom response alter advice.', intendedNumericalGranularity: 'No universal activity dose.' },
  { id: 'mixed_15', domain: 'environment', decisionPrompt: 'For a long endurance event in variable weather, which hydration strategy is preferable?', optionA: 'Follow a precomputed drinking plan based on expected sweat loss.', optionB: 'Drink according to thirst during the event.', targetPopulation: 'Adult athletes during exercise', intendedDecisionBoundary: 'Heat, duration, sweat rate, hyponatremia risk, and access matter.', intendedNumericalGranularity: 'Reject a universal hourly volume.' },
  { id: 'mixed_16', domain: 'nutrition', decisionPrompt: 'A healthy athlete with an adequate diet begins a new endurance-training block. Which antioxidant strategy is preferable?', optionA: 'Add a high-dose antioxidant supplement immediately after training.', optionB: 'Rely on dietary sources unless a specific deficiency or indication is identified.', targetPopulation: 'Healthy adult athletes', intendedDecisionBoundary: 'Nutrient status, dose, and training goal matter.', intendedNumericalGranularity: 'No universal dose or adaptation effect.' },
];

export const STUDY2_CANDIDATES: CandidateScenario[] = [
  ...strong.map((seed, index) => candidate(seed, 'strong_consensus', 'option_a', index % 2 === 1)),
  ...mixed.map((seed, index) =>
    candidate(
      seed,
      'mixed_or_conditional',
      [
        'option_a',
        'option_b',
        'option_b',
        'option_b',
        'option_b',
        'option_b',
        'option_b',
        'option_b',
        'option_b',
        'unresolved',
        'option_b',
        'option_a',
        'unresolved',
        'option_b',
        'unresolved',
        'option_b',
      ][index] as CandidateScenario['provisionalCorrectOption'],
      index % 2 === 1,
    ),
  ),
];
