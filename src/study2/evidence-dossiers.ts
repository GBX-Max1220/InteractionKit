import type { CandidateScenario, EvidenceSourceRecord } from './materials';
import type { CandidateEvidencePath } from './evidence-paths';

type SupportMapping = 'yes' | 'partial' | 'no';

export interface DossierSource {
  id: string;
  fullCitation: string;
  doi: string;
  pmid: string;
  authorityType: EvidenceSourceRecord['authorityType'];
  populationAndSetting: string;
  supportsBinaryDecision: SupportMapping;
  supportsEvidenceLevel: SupportMapping;
  relevantFinding: string;
  limitationsForScenario: string;
  metadataVerifiedBy: string;
  metadataVerifiedAt: string;
}

export interface EvidenceDossier {
  candidateId: string;
  materialVersion: CandidateScenario['materialVersion'];
  dossierVersion: string;
  preparedBy: string;
  preparedAt: string;
  proposedCorrectOption: Exclude<CandidateScenario['provisionalCorrectOption'], 'unresolved'>;
  accuracyRationale: string;
  oppositeOptionConditions: string;
  classificationRationale: string;
  knownDisagreementOrHeterogeneity: string;
  decisionBoundary: string;
  numericalGranularity: string;
  sources: [DossierSource, DossierSource, ...DossierSource[]];
}

const verifiedBy = 'codex-pubmed-eutils';
const verifiedAt = '2026-08-02T00:00:00Z';

function source(
  id: string,
  fullCitation: string,
  doi: string,
  pmid: string,
  authorityType: DossierSource['authorityType'],
  populationAndSetting: string,
  supportsBinaryDecision: SupportMapping,
  supportsEvidenceLevel: SupportMapping,
  relevantFinding: string,
  limitationsForScenario: string,
): DossierSource {
  return {
    id,
    fullCitation,
    doi,
    pmid,
    authorityType,
    populationAndSetting,
    supportsBinaryDecision,
    supportsEvidenceLevel,
    relevantFinding,
    limitationsForScenario,
    metadataVerifiedBy: verifiedBy,
    metadataVerifiedAt: verifiedAt,
  };
}

function dossier(
  candidateId: string,
  proposedCorrectOption: EvidenceDossier['proposedCorrectOption'],
  accuracyRationale: string,
  oppositeOptionConditions: string,
  classificationRationale: string,
  knownDisagreementOrHeterogeneity: string,
  decisionBoundary: string,
  numericalGranularity: string,
  sources: EvidenceDossier['sources'],
): EvidenceDossier {
  return {
    candidateId,
    materialVersion: 'study2-candidates-v0.6',
    dossierVersion: 'study2-dossier-v0.1',
    preparedBy: 'Codex source-mapping pass; independent domain review pending',
    preparedAt: '2026-08-02T00:00:00Z',
    proposedCorrectOption,
    accuracyRationale,
    oppositeOptionConditions,
    classificationRationale,
    knownDisagreementOrHeterogeneity,
    decisionBoundary,
    numericalGranularity,
    sources,
  };
}

const acsm2026 = source(
  'acsm_rt_2026',
  'Currier BS, et al. American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews. Medicine & Science in Sports & Exercise. 2026. doi:10.1249/MSS.0000000000003897.',
  '10.1249/MSS.0000000000003897',
  '41843416',
  'position_stand',
  'Healthy adults completing resistance training for at least six weeks; overview of systematic reviews of randomized trials.',
  'yes',
  'yes',
  'Resistance-training prescription should match the desired adaptation, and progressive prescription is required to continue adaptation rather than leaving the program unchanged.',
  'The overview evaluates program variables and adaptations, not one universal week-to-week progression rule or every novice exercise context.',
);

const acsm2009 = source(
  'acsm_progression_2009',
  'American College of Sports Medicine. Progression models in resistance training for healthy adults. Medicine & Science in Sports & Exercise. 2009;41(3):687-708. doi:10.1249/MSS.0b013e3181915670.',
  '10.1249/MSS.0b013e3181915670',
  '19204579',
  'position_stand',
  'Healthy adults across novice, intermediate, and advanced resistance-training status.',
  'yes',
  'yes',
  'The position stand describes progressive overload and individualized changes to load, volume, frequency, rest, velocity, and exercise complexity as training status and goals change.',
  'Recommendations are population-level models, and the older statement does not establish a universal percentage increase for every trainee.',
);

export const STUDY2_EVIDENCE_DOSSIERS: EvidenceDossier[] = [
  dossier(
    'strong_01',
    'option_a',
    'After adaptation to an unchanged workload, a monitored increase in training demand is the evidence-aligned direction for continued strength development.',
    'Maintaining the current workload can be appropriate during deloading, technique consolidation, illness, inadequate recovery, or when the trainee has not actually adapted to it.',
    'Two professional position stands converge on progressive and individualized resistance-training prescription; the direction is strong even though the exact progression is conditional.',
    'The optimal progression variable and rate differ by training status, exercise, recovery, adherence, and goal.',
    'Increase demand only when technique, recovery, and observed response justify progression.',
    'Direction only; no universal weekly percentage or load increment.',
    [acsm2026, acsm2009],
  ),
  dossier(
    'strong_02',
    'option_b',
    'A program intended to develop general whole-body fitness should include training stimuli for all major muscle groups rather than systematically omitting the lower body.',
    'Temporary regional emphasis or omission can be justified by injury, rehabilitation, disability, sport periodization, equipment access, or a deliberately narrow goal.',
    'Professional resistance-training guidance consistently treats balanced major-muscle-group coverage as part of a general program.',
    'Exercise selection and dose differ with capacity and goals; neither source requires the same exercise list for every person.',
    'The claim applies to general whole-body fitness, not a specialized block or a medically constrained program.',
    'No fixed number of exercises or sets.',
    [
      { ...acsm2026, id: 'acsm_rt_2026_strong_02', relevantFinding: 'The position stand synthesizes resistance-training prescription across muscle function, hypertrophy, and physical performance and supports comprehensive program design rather than relying on incidental daily activity for an omitted region.' },
      { ...acsm2009, id: 'acsm_progression_2009_strong_02', relevantFinding: 'The progression model addresses single- and multiple-joint exercise selection and program organization across training levels, supporting deliberate coverage of the musculature targeted by a whole-body goal.' },
    ],
  ),
  dossier(
    'strong_04',
    'option_b',
    'The displayed options are flipped in the registry: treating adequate daily protein as relevant is the proposed correct decision for resistance-training adaptation.',
    'Additional protein may add little when total intake is already sufficient, and individual needs change with age, energy balance, body size, training load, and clinical status.',
    'A professional position stand and a large meta-analysis both link protein provision with resistance-training adaptation while rejecting unlimited benefit.',
    'Benefits vary with baseline intake and diminish once intake is sufficient; supplementation is not synonymous with dietary adequacy.',
    'Judge adequacy in the context of total daily intake and the individual rather than inferring that a supplement or one exact dose is required.',
    'A defensible range may be used after review; no single universal threshold.',
    [
      source('issn_protein_2017', 'Jäger R, et al. International Society of Sports Nutrition Position Stand: protein and exercise. Journal of the International Society of Sports Nutrition. 2017;14:20. doi:10.1186/s12970-017-0177-8.', '10.1186/s12970-017-0177-8', '28642676', 'position_stand', 'Healthy exercising adults, including resistance-trained populations.', 'yes', 'yes', 'Adequate protein intake supports training adaptation, with requirements and useful timing considered in the context of total daily intake.', 'A society position stand is not a substitute for individualized clinical nutrition advice and includes authors active in sports-nutrition research.'),
      source('morton_protein_2018', 'Morton RW, et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. British Journal of Sports Medicine. 2018;52(6):376-384. doi:10.1136/bjsports-2017-097608.', '10.1136/bjsports-2017-097608', '28698222', 'meta_analysis', 'Healthy adults undertaking prolonged resistance training in randomized trials.', 'yes', 'yes', 'Protein supplementation produced additional gains in muscle mass and strength during resistance training, with diminishing benefit as total intake approached sufficiency.', 'Included trials varied in training status, supplement protocol, and baseline intake; the synthesis does not validate a universal requirement for supplementation.'),
    ],
  ),
  dossier(
    'strong_05',
    'option_a',
    'Creatine monohydrate is evidence-supported for healthy adults pursuing strength when contraindications and product-quality concerns do not apply.',
    'Avoidance or clinician consultation can be appropriate with relevant disease, medication, pregnancy, intolerance, contamination risk, or a preference not to supplement.',
    'The position stand addresses efficacy and safety, and the strength-specific meta-analysis directly evaluates creatine added to resistance training.',
    'Effects vary across individuals and the strength synthesis reports sex imbalance and heterogeneous protocols; evidence support does not make supplementation mandatory.',
    'The recommendation is limited to creatine monohydrate in healthy adults without a relevant contraindication.',
    'No guaranteed effect, mandatory loading phase, or universal dose.',
    [
      source('issn_creatine_2017', 'Kreider RB, et al. International Society of Sports Nutrition position stand: safety and efficacy of creatine supplementation in exercise, sport, and medicine. Journal of the International Society of Sports Nutrition. 2017;14:18. doi:10.1186/s12970-017-0173-z.', '10.1186/s12970-017-0173-z', '28615996', 'position_stand', 'Healthy and athletic populations using creatine, with safety and performance evidence reviewed across settings.', 'yes', 'yes', 'Creatine monohydrate has substantial evidence for improving high-intensity exercise capacity and training adaptation and is generally well tolerated in studied healthy populations.', 'The statement spans multiple outcomes and populations and cannot rule out individual contraindications, product contamination, or all long-term clinical contexts.'),
      source('wang_creatine_strength_2024', 'Wang Z, et al. Effects of Creatine Supplementation and Resistance Training on Muscle Strength Gains in Adults <50 Years of Age: A Systematic Review and Meta-Analysis. Nutrients. 2024;16(21):3665. doi:10.3390/nu16213665.', '10.3390/nu16213665', '39519498', 'meta_analysis', 'Adults younger than 50 years completing resistance training in 23 controlled studies.', 'yes', 'yes', 'Creatine combined with resistance training increased pooled upper- and lower-body strength compared with placebo plus training.', 'Most included participants were male, protocols varied, and subgroup estimates do not justify a guaranteed individual response or one dose.'),
    ],
  ),
  dossier(
    'strong_13',
    'option_a',
    'Return to sport after concussion should use a staged progression with symptom monitoring and appropriate healthcare oversight rather than immediate full training after resting symptoms improve.',
    'Progression can move faster or slower according to clinical assessment and symptom response, but the opposite option is not appropriate as an unsupervised one-step return.',
    'An international consensus statement and its supporting systematic review converge on graduated return and clinical management.',
    'Recovery trajectories vary, evidence for exact timing is heterogeneous, and suspected concussion with emergency red flags requires a different urgent pathway.',
    'Apply the staged decision only after acute red flags are addressed and under the applicable clinical protocol.',
    'No universal number of recovery days.',
    [
      source('amsterdam_concussion_2023', 'Patricios JS, et al. Consensus statement on concussion in sport: the 6th International Conference on Concussion in Sport—Amsterdam, October 2022. British Journal of Sports Medicine. 2023;57(11):695-711. doi:10.1136/bjsports-2023-106898.', '10.1136/bjsports-2023-106898', '37316210', 'position_stand', 'Children and adults with sport-related concussion across community and elite sport.', 'yes', 'yes', 'The consensus specifies a graduated return-to-sport strategy, symptom-limited progression, and healthcare-professional determination before stages involving risk of head impact.', 'Consensus recommendations integrate heterogeneous evidence and require adaptation to age, setting, access to care, and local rules.'),
      source('putukian_recovery_2023', 'Putukian M, et al. Clinical recovery from concussion—return to school and sport: a systematic review and meta-analysis. British Journal of Sports Medicine. 2023;57(12):798-809. doi:10.1136/bjsports-2022-106682.', '10.1136/bjsports-2022-106682', '37316183', 'meta_analysis', 'Athletes recovering from sport-related concussion, including return-to-school and return-to-sport outcomes.', 'yes', 'yes', 'The synthesis supports active, monitored recovery and informs staged return rather than using resting-symptom improvement as the sole clearance criterion.', 'Definitions, age groups, outcome measures, and study quality vary; pooled recovery evidence does not provide one safe timeline for every athlete.'),
    ],
  ),
  dossier(
    'strong_03',
    'option_a',
    'Substantial acute sleep loss before exercise is expected to impair at least some dimensions of physical or sport performance rather than leave recovery and performance unaffected.',
    'Minimal or no detectable cost remains possible for a particular task, athlete, sleep-loss pattern, or test time; that variability does not support the categorical no-cost option.',
    'Two systematic meta-analyses converge on an adverse overall direction across physical and sport outcomes after acute sleep loss.',
    'Effect magnitude differs by total versus partial loss, early versus late restriction, time of testing, task domain, and athlete characteristics.',
    'The scenario concerns substantial sleep loss during the immediately preceding night, not chronic sleep disorders or a precise individual prediction.',
    'Directional conclusion only; no universal percentage decrement.',
    [
      source('craven_sleep_2022', 'Craven J, et al. Effects of Acute Sleep Loss on Physical Performance: A Systematic and Meta-Analytical Review. Sports Medicine. 2022. doi:10.1007/s40279-022-01706-y.', '10.1007/s40279-022-01706-y', '35708888', 'meta_analysis', 'Healthy participants exposed to acute sleep-deprivation or sleep-restriction protocols before physical-performance testing.', 'yes', 'yes', 'Acute sleep loss produced an overall adverse effect on physical performance, with protocol and test timing examined as moderators.', 'Included studies used heterogeneous sleep-loss protocols and performance tasks, so the pooled direction cannot predict every task or athlete.'),
      source('gong_sleep_2024', 'Gong M, et al. Effects of Acute Sleep Deprivation on Sporting Performance in Athletes: A Comprehensive Systematic Review and Meta-Analysis. Nature and Science of Sleep. 2024;16:935-948. doi:10.2147/NSS.S467531.', '10.2147/NSS.S467531', '39006249', 'meta_analysis', 'Athletes undergoing acute total or partial sleep deprivation before sport-performance assessment.', 'yes', 'yes', 'The synthesis reported impaired overall sporting performance and adverse effects across several performance domains after acute sleep deprivation.', 'The included evidence varied by deprivation timing, outcome, sport, and study quality; some subgroup effects were smaller or uncertain.'),
    ],
  ),
  dossier(
    'strong_07',
    'option_a',
    'Altered mental status and collapse during strenuous exercise in heat indicate suspected exertional heat stroke, for which rapid cooling and emergency activation take priority.',
    'A brief rest-and-resume approach may fit minor heat discomfort without central nervous system dysfunction, but not the emergency signs fixed in this scenario.',
    'An ACSM expert statement and a prehospital consensus directly converge on rapid recognition, cessation, cooling, and emergency management.',
    'Exact cooling method, transport sequence, available equipment, and local emergency protocol vary by setting.',
    'The binary decision depends on altered mental status and collapse during heat exposure; it should not be generalized to every mild heat symptom.',
    'No universal cooling duration, target temperature, or safe return time.',
    [
      source('acsm_heat_2023', 'Roberts WO, et al. ACSM Expert Consensus Statement on Exertional Heat Illness: Recognition, Management, and Return to Activity. Current Sports Medicine Reports. 2023;22(4):134-149. doi:10.1249/JSR.0000000000001058.', '10.1249/JSR.0000000000001058', '37036463', 'position_stand', 'People developing exertional heat illness during physical activity, including recognition, acute management, and return.', 'yes', 'yes', 'Central nervous system dysfunction during heat exposure is a defining emergency concern, and immediate cooling is central to management of suspected exertional heat stroke.', 'The consensus covers a spectrum of heat illness; operational procedures depend on resources, differential diagnosis, and local emergency systems.'),
      source('belval_heat_2018', 'Belval LN, et al. Consensus Statement—Prehospital Care of Exertional Heat Stroke. Prehospital Emergency Care. 2018;22(3):392-397. doi:10.1080/10903127.2017.1392666.', '10.1080/10903127.2017.1392666', '29336710', 'position_stand', 'Prehospital recognition and treatment of exertional heat stroke in active populations.', 'yes', 'yes', 'The consensus supports immediate whole-body cooling and coordinated emergency care when exertional heat stroke is suspected.', 'It addresses prehospital heat-stroke management rather than all causes of collapse or every mild heat-related symptom.'),
    ],
  ),
  dossier(
    'strong_08',
    'option_b',
    'The displayed options are flipped: a structured period of repeated, managed heat exposure is better supported than one hard heat session immediately before an event.',
    'A single exposure may be the only feasible familiarization opportunity, but it should not be represented as equivalent to a managed acclimation period.',
    'Consensus recommendations and a quantitative synthesis converge on repeated heat exposure as the basis of heat acclimation and reduced physiological strain.',
    'Adaptation magnitude and time course vary by protocol, environment, training status, sex, fitness, and measurement outcome.',
    'Exposure must be progressive and managed with attention to hydration, illness, recovery, and individual tolerance.',
    'No universal number of days, temperature, or expected percentage improvement.',
    [
      source('racinais_heat_2015', 'Racinais S, et al. Consensus recommendations on training and competing in the heat. British Journal of Sports Medicine. 2015;49(18):1164-1173. doi:10.1136/bjsports-2015-094915.', '10.1136/bjsports-2015-094915', '26069301', 'position_stand', 'Athletes preparing to train or compete in hot environmental conditions.', 'yes', 'yes', 'The consensus recommends planned heat acclimatization or acclimation using repeated exposure before competition in the heat.', 'The appropriate protocol depends on sport, climate, access, health, and individual response; the statement is not one fixed prescription.'),
      source('brown_heat_2024', 'Brown HA, et al. Quantifying Exercise Heat Acclimatisation in Athletes and Military Personnel: A Systematic Review and Meta-analysis. Sports Medicine. 2024. doi:10.1007/s40279-023-01972-4.', '10.1007/s40279-023-01972-4', '38051495', 'meta_analysis', 'Athletes and military personnel completing repeated exercise-heat acclimation protocols.', 'yes', 'yes', 'Repeated heat-acclimation protocols improved physiological responses associated with reduced heat strain.', 'Protocols and outcomes were heterogeneous, and evidence from military or predominantly male samples may not transfer uniformly to every athlete.'),
    ],
  ),
  dossier(
    'strong_09',
    'option_a',
    'For an inactive healthy adult seeking cardiorespiratory fitness, repeated aerobic training provides a task-matched stimulus; flexibility alone is not an equivalent primary stimulus.',
    'Flexibility work can be appropriate as an adjunct or temporary starting activity when health, pain, mobility, or adherence limits aerobic exercise.',
    'Global physical-activity guidance and an exercise synthesis support aerobic activity for health and cardiorespiratory fitness in inactive adults.',
    'Mode, intensity, adherence, baseline fitness, and comparator programs vary, and the evidence does not establish one best aerobic modality.',
    'The claim is limited to aerobic training versus flexibility as the main cardiorespiratory stimulus in generally healthy adults.',
    'No universal dose or improvement percentage.',
    [
      source('who_activity_2020', 'Bull FC, et al. World Health Organization 2020 guidelines on physical activity and sedentary behaviour. British Journal of Sports Medicine. 2020;54(24):1451-1462. doi:10.1136/bjsports-2020-102955.', '10.1136/bjsports-2020-102955', '33239350', 'guideline', 'Children, adults, and older adults across the general population, with population-specific physical-activity recommendations.', 'yes', 'yes', 'The guideline recommends regular aerobic physical activity for adults and distinguishes aerobic, strength, and other activity components.', 'Population guidance does not prescribe one mode or directly quantify improvement for a specific inactive individual.'),
      source('huang_sedentary_2025', 'Huang T, et al. Effects of exercise on body fat percentage and cardiorespiratory fitness in sedentary adults: a systematic review and network meta-analysis. Frontiers in Public Health. 2025;13:1624562. doi:10.3389/fpubh.2025.1624562.', '10.3389/fpubh.2025.1624562', '40746688', 'meta_analysis', 'Sedentary adults enrolled in exercise interventions reporting body-fat or cardiorespiratory-fitness outcomes.', 'yes', 'yes', 'Exercise interventions improved cardiorespiratory fitness in sedentary adults, with effects differing across exercise modalities.', 'Network comparisons depend on heterogeneous doses and populations and do not prove universal superiority of one aerobic program.'),
    ],
  ),
  dossier(
    'strong_11',
    'option_a',
    'For a supervised adolescent novice who cannot maintain stable technique at the current load, returning to a manageable load with instruction is preferable to adding load.',
    'Load can progress once technique and capacity are adequate; the recommendation does not require perfect uniform form or prohibit individualized exercise variation.',
    'Two youth resistance-training position statements converge on qualified supervision, appropriate technique, individualized loading, and gradual progression.',
    'The evidence base combines experimental evidence and expert consensus, and maturity, exercise complexity, and supervision quality alter implementation.',
    'The item applies to healthy adolescent novices in supervised resistance training, not trained adults or unsupervised rehabilitation.',
    'No universal starting load or increment.',
    [
      source('nsca_youth_2009', 'Faigenbaum AD, et al. Youth resistance training: updated position statement paper from the National Strength and Conditioning Association. Journal of Strength and Conditioning Research. 2009;23(5 Suppl):S60-S79. doi:10.1519/JSC.0b013e31819df407.', '10.1519/JSC.0b013e31819df407', '19620931', 'position_stand', 'Children and adolescents participating in resistance training for health, fitness, or sport.', 'yes', 'yes', 'The statement emphasizes qualified instruction, correct technique, appropriate loads, and gradual progression for youth resistance training.', 'Recommendations cover a broad developmental range and rely partly on expert synthesis rather than direct trials of this exact binary choice.'),
      source('youth_consensus_2014', 'Lloyd RS, et al. Position statement on youth resistance training: the 2014 International Consensus. British Journal of Sports Medicine. 2014;48(7):498-505. doi:10.1136/bjsports-2013-092952.', '10.1136/bjsports-2013-092952', '24055781', 'position_stand', 'Children and adolescents undertaking developmentally appropriate resistance training.', 'yes', 'yes', 'The international consensus endorses supervised, technically appropriate, individualized progression in youth resistance training.', 'Implementation depends on biological maturity, training age, competence, equipment, and coaching context.'),
    ],
  ),
  dossier(
    'strong_12',
    'option_b',
    'The displayed options are flipped: sustained energy intake below expenditure is the relevant long-term mechanism for body-mass reduction, whereas meal timing with energy surplus is not an equivalent strategy.',
    'Meal timing can affect adherence, hunger, metabolic markers, or sport scheduling, and a deficit may be inappropriate with eating-disorder risk, pregnancy, illness, or inadequate fueling.',
    'A clinical guideline and a randomized-trial network meta-analysis converge on energy restriction as the central driver while showing that schedule is not independently decisive.',
    'Weight response varies and intermittent-fasting patterns differ in adherence and metabolic outcomes; clinical populations require individualized care.',
    'The scenario concerns adult body-mass reduction over time and excludes medical or eating-disorder contexts needing specialist management.',
    'No universal daily deficit, weekly loss, or expected percentage.',
    [
      source('aha_obesity_2014', 'Jensen MD, et al. 2013 AHA/ACC/TOS guideline for the management of overweight and obesity in adults. Circulation. 2014;129(25 Suppl 2):S102-S138. doi:10.1161/01.cir.0000437739.71477.ee.', '10.1161/01.cir.0000437739.71477.ee', '24222017', 'guideline', 'Adults with overweight or obesity receiving lifestyle or clinical weight-management interventions.', 'yes', 'yes', 'The guideline supports dietary energy reduction as a core component of effective lifestyle weight-loss interventions.', 'Clinical guidance for overweight and obesity does not specify one safe deficit for every adult and requires attention to comorbidity and treatment context.'),
      source('wu_restriction_2026', 'Wu X, et al. Comparison of Different Intermittent Fasting Patterns or Different Extents of Calorie Restriction for Weight Loss and Metabolic Improvement in Adults: A Systematic Review and Network Meta-Analysis of Randomized Controlled Trials. Nutrition Reviews. 2026. doi:10.1093/nutrit/nuaf056.', '10.1093/nutrit/nuaf056', '40367516', 'meta_analysis', 'Adults in randomized trials comparing intermittent-fasting schedules or degrees of continuous calorie restriction.', 'yes', 'yes', 'Across dietary schedules, weight-loss effectiveness primarily tracked the extent of energy restriction rather than timing alone.', 'Interventions, durations, adherence, and populations varied, and indirect network comparisons do not prescribe one eating schedule.'),
    ],
  ),
  dossier(
    'strong_14',
    'option_b',
    'The displayed options are flipped: an older adult seeking physical function should include appropriately prescribed progressive resistance training rather than omit resistance work.',
    'Aerobic and mobility-only programming can be temporarily appropriate when resistance training is contraindicated or unavailable, and both remain valuable complements.',
    'Two large evidence syntheses directly support resistance training for strength and physical-function outcomes in older adults.',
    'Effects vary by baseline function, supervision, volume, intensity, frailty, health status, and the specific functional outcome.',
    'The decision is to include an appropriate resistance component, not to replace aerobic activity or prescribe identical training to all older adults.',
    'No universal number of sets or guaranteed functional gain.',
    [
      source('radaelli_older_2025', 'Radaelli R, et al. Effects of Resistance Training Volume on Physical Function, Lean Body Mass and Lower-Body Muscle Hypertrophy and Strength in Older Adults: A Systematic Review and Network Meta-analysis of 151 Randomised Trials. Sports Medicine. 2025. doi:10.1007/s40279-024-02123-z.', '10.1007/s40279-024-02123-z', '39405023', 'meta_analysis', 'Older adults in 151 randomized resistance-training trials reporting function, lean mass, hypertrophy, or strength.', 'yes', 'yes', 'Resistance training improved strength and physical-function outcomes, with dose comparisons informing but not fixing prescription.', 'Trial populations and protocols varied, and network estimates do not establish one optimal volume for every health or frailty profile.'),
      source('lai_older_2018', 'Lai CC, et al. Effects of resistance training, endurance training and whole-body vibration on lean body mass, muscle strength and physical performance in older people: a systematic review and network meta-analysis. Age and Ageing. 2018;47(3):367-373. doi:10.1093/ageing/afy009.', '10.1093/ageing/afy009', '29471456', 'meta_analysis', 'Older people participating in resistance, endurance, or whole-body-vibration interventions.', 'yes', 'yes', 'Resistance training improved muscle strength and contributed to physical-performance outcomes in older adults.', 'Comparative effects differ by outcome and intervention; the evidence supports inclusion, not rejection of endurance or mobility exercise.'),
    ],
  ),
  dossier(
    'strong_15',
    'option_a',
    'A low-altitude resident with substantial symptoms and reduced exercise tolerance soon after ascent should reduce training load and respond to symptoms rather than force the planned sea-level workload.',
    'Maintaining more of the planned load can become appropriate after uncomplicated acclimatization and symptom resolution; severe or worsening illness may require descent and medical care rather than load adjustment alone.',
    'Clinical altitude guidance and athlete consensus both support symptom-responsive management and modified training during acute altitude exposure.',
    'Responses vary by altitude, ascent rate, prior acclimatization, illness phenotype, fitness, and individual susceptibility.',
    'The item addresses substantial new symptoms soon after ascent; emergency signs and suspected high-altitude cerebral or pulmonary edema require urgent escalation.',
    'No universal percentage load reduction or acclimatization duration.',
    [
      source('wms_altitude_2024', 'Luks AM, et al. Wilderness Medical Society Clinical Practice Guidelines for the Prevention, Diagnosis, and Treatment of Acute Altitude Illness: 2024 Update. Wilderness & Environmental Medicine. 2024. doi:10.1016/j.wem.2023.05.013.', '10.1016/j.wem.2023.05.013', '37833187', 'guideline', 'Low-altitude residents ascending to altitude and people with acute altitude illness.', 'yes', 'yes', 'The guideline supports symptom-based recognition and management, avoidance of further ascent with illness, and escalation or descent according to severity.', 'Clinical altitude-illness recommendations do not directly prescribe sport training loads and must be combined with athlete-specific judgment.'),
      source('ioc_altitude_2012', 'Bergeron MF, et al. International Olympic Committee consensus statement on thermoregulatory and altitude challenges for high-level athletes. British Journal of Sports Medicine. 2012;46(11):770-779. doi:10.1136/bjsports-2012-091296.', '10.1136/bjsports-2012-091296', '22685119', 'position_stand', 'High-level athletes training or competing under altitude and environmental stress.', 'yes', 'yes', 'The consensus describes reduced exercise capacity during initial altitude exposure and supports planned acclimatization and adjusted preparation.', 'The statement focuses on high-level athletes and predates newer altitude guidance; it does not determine the clinical severity of an individual case.'),
    ],
  ),
];

export interface EvidenceDossierAudit {
  valid: boolean;
  errors: string[];
  counts: { complete: number; strong: number; mixed: number };
}

export function auditEvidenceDossiers(
  dossiers: EvidenceDossier[],
  candidates: CandidateScenario[],
  paths: CandidateEvidencePath[],
): EvidenceDossierAudit {
  const errors: string[] = [];
  const candidatesById = new Map(candidates.map((item) => [item.id, item]));
  const pathsById = new Map(paths.map((item) => [item.candidateId, item]));
  const dossierIds = new Set<string>();
  let strong = 0;
  let mixed = 0;

  for (const item of dossiers) {
    if (dossierIds.has(item.candidateId)) errors.push(`Duplicate dossier for ${item.candidateId}.`);
    dossierIds.add(item.candidateId);
    const candidate = candidatesById.get(item.candidateId);
    const evidencePath = pathsById.get(item.candidateId);
    if (!candidate) {
      errors.push(`Unknown dossier candidate ${item.candidateId}.`);
      continue;
    }
    if (!evidencePath) errors.push(`${item.candidateId} has no registered evidence path.`);
    if (item.materialVersion !== candidate.materialVersion) errors.push(`${item.candidateId} dossier uses a stale material version.`);
    if (item.proposedCorrectOption !== candidate.provisionalCorrectOption) errors.push(`${item.candidateId} dossier answer disagrees with the candidate registry.`);
    if (candidate.provisionalSupportLevel === 'strong_consensus') strong += 1;
    else mixed += 1;

    const sourceIds = new Set(item.sources.map((entry) => entry.id));
    const dois = new Set(item.sources.map((entry) => entry.doi.toLowerCase()));
    const pmids = new Set(item.sources.map((entry) => entry.pmid));
    if (item.sources.length < 2 || sourceIds.size < 2 || dois.size < 2 || pmids.size < 2) {
      errors.push(`${item.candidateId} does not have two distinct dossier sources.`);
    }
    const registeredPairs = new Set(evidencePath?.sources.map((entry) => `${entry.doi.toLowerCase()}|${entry.pmid}`) ?? []);
    for (const entry of item.sources) {
      if (!registeredPairs.has(`${entry.doi.toLowerCase()}|${entry.pmid}`)) errors.push(`${item.candidateId} dossier source ${entry.id} is absent from the provenance registry.`);
      if (entry.supportsBinaryDecision === 'no' || entry.supportsEvidenceLevel === 'no') errors.push(`${item.candidateId} counts a non-supporting source.`);
      if (![entry.fullCitation, entry.populationAndSetting, entry.relevantFinding, entry.limitationsForScenario].every((value) => typeof value === 'string' && value.trim())) errors.push(`${item.candidateId} has an incomplete source-to-claim mapping.`);
      if (!entry.metadataVerifiedBy || !Number.isFinite(Date.parse(entry.metadataVerifiedAt))) errors.push(`${item.candidateId} has unverified dossier metadata.`);
    }
    if (![item.accuracyRationale, item.oppositeOptionConditions, item.classificationRationale, item.knownDisagreementOrHeterogeneity, item.decisionBoundary, item.numericalGranularity].every((value) => typeof value === 'string' && value.trim())) errors.push(`${item.candidateId} has an incomplete decision mapping.`);
  }

  return { valid: errors.length === 0, errors, counts: { complete: dossiers.length, strong, mixed } };
}
