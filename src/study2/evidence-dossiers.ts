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
