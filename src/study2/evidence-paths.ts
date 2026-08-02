import { CandidateScenario } from './materials';

export type SourceMapping = 'direct' | 'bounded' | 'adjacent';

export interface EvidenceLocator {
  doi: string;
  pmid: string;
  authorityType: 'guideline' | 'position_stand' | 'systematic_review' | 'meta_analysis';
  mapping: SourceMapping;
  metadataVerifiedBy: string;
  metadataVerifiedAt: string;
}

export interface CandidateEvidencePath {
  candidateId: string;
  materialVersion: CandidateScenario['materialVersion'];
  sources: [EvidenceLocator, EvidenceLocator, ...EvidenceLocator[]];
  mappingNote: string;
}

const verifiedBy = 'codex-pubmed-eutils';
const verifiedAt = '2026-08-02T00:00:00Z';

function source(
  doi: string,
  pmid: string,
  authorityType: EvidenceLocator['authorityType'],
  mapping: SourceMapping = 'direct',
): EvidenceLocator {
  return { doi, pmid, authorityType, mapping, metadataVerifiedBy: verifiedBy, metadataVerifiedAt: verifiedAt };
}

function path(
  candidateId: string,
  sources: CandidateEvidencePath['sources'],
  mappingNote: string,
): CandidateEvidencePath {
  return { candidateId, materialVersion: 'study2-candidates-v0.6', sources, mappingNote };
}

export const STUDY2_EVIDENCE_PATHS: CandidateEvidencePath[] = [
  path('strong_01', [source('10.1249/MSS.0000000000003897', '41843416', 'position_stand'), source('10.1249/MSS.0b013e3181915670', '19204579', 'position_stand')], 'Resistance-training progression in healthy adults.'),
  path('strong_02', [source('10.1249/MSS.0000000000003897', '41843416', 'position_stand'), source('10.1249/MSS.0b013e3181915670', '19204579', 'position_stand')], 'Whole-body resistance-training prescription.'),
  path('strong_03', [source('10.1007/s40279-022-01706-y', '35708888', 'meta_analysis'), source('10.2147/NSS.S467531', '39006249', 'meta_analysis')], 'Acute sleep loss and physical or sporting performance.'),
  path('strong_04', [source('10.1186/s12970-017-0177-8', '28642676', 'position_stand'), source('10.1136/bjsports-2017-097608', '28698222', 'meta_analysis')], 'Daily protein and resistance-training adaptation.'),
  path('strong_05', [source('10.1186/s12970-017-0173-z', '28615996', 'position_stand'), source('10.3390/nu16213665', '39519498', 'meta_analysis')], 'Creatine monohydrate and resistance-training strength gains in healthy adults.'),
  path('strong_07', [source('10.1249/JSR.0000000000001058', '37036463', 'guideline'), source('10.1080/10903127.2017.1392666', '29336710', 'position_stand')], 'Recognition and immediate management of suspected exertional heat stroke.'),
  path('strong_08', [source('10.1136/bjsports-2015-094915', '26069301', 'position_stand'), source('10.1007/s40279-023-01972-4', '38051495', 'meta_analysis')], 'Repeated managed heat exposure and physiological strain.'),
  path('strong_09', [source('10.1136/bjsports-2020-102955', '33239350', 'guideline'), source('10.3389/fpubh.2025.1624562', '40746688', 'meta_analysis', 'bounded')], 'Aerobic activity for inactive adults; modality claims remain bounded.'),
  path('strong_11', [source('10.1519/JSC.0b013e31819df407', '19620931', 'position_stand'), source('10.1136/bjsports-2013-092952', '24055781', 'position_stand')], 'Technique, qualified supervision, and gradual progression in adolescent resistance training.'),
  path('strong_12', [source('10.1161/01.cir.0000437739.71477.ee', '24222017', 'guideline'), source('10.1093/nutrit/nuaf056', '40367516', 'meta_analysis')], 'Sustained energy restriction and weight loss.'),
  path('strong_13', [source('10.1136/bjsports-2023-106898', '37316210', 'position_stand'), source('10.1136/bjsports-2022-106682', '37316183', 'meta_analysis')], 'Staged return after sport-related concussion.'),
  path('strong_14', [source('10.1007/s40279-024-02123-z', '39405023', 'meta_analysis'), source('10.1093/ageing/afy009', '29471456', 'meta_analysis')], 'Resistance training for strength and function in older adults.'),
  path('strong_15', [source('10.1016/j.wem.2023.05.013', '37833187', 'guideline'), source('10.1136/bjsports-2012-091296', '22685119', 'position_stand', 'bounded')], 'Altitude illness guidance plus athlete-specific altitude consensus.'),
  path('mixed_01', [source('10.1007/s40279-017-0784-1', '28917030', 'meta_analysis'), source('10.1007/s40279-021-01426-9', '33751469', 'meta_analysis', 'bounded')], 'Concurrent-training order when strength is prioritized.'),
  path('mixed_02', [source('10.1080/17461391.2022.2033851', '35068365', 'meta_analysis'), source('10.1186/s13102-026-01653-5', '41845491', 'meta_analysis')], 'Cold-water recovery benefits versus chronic resistance adaptation.'),
  path('mixed_03', [source('10.1186/s12970-017-0189-4', '28919842', 'position_stand'), source('10.1016/j.jand.2015.12.006', '26920240', 'position_stand')], 'Rapid carbohydrate refueling when recovery is shorter than four hours.'),
  path('mixed_04', [source('10.1139/apnm-2015-0235', '26642915', 'systematic_review'), source('10.1186/s13102-023-00703-6', '37644585', 'meta_analysis')], 'Static versus dynamic warm-up for sprint and jump outcomes.'),
  path('mixed_06', [source('10.1016/j.jshs.2021.01.007', '33497853', 'meta_analysis'), source('10.1007/s40279-022-01784-y', '36334240', 'meta_analysis')], 'Failure versus near-failure hypertrophy training.'),
  path('mixed_07', [source('10.1007/s40279-017-0788-x', '28933024', 'systematic_review'), source('10.2165/11315230-000000000-00000', '19691365', 'systematic_review')], 'Inter-set rest duration for heavy strength work.'),
  path('mixed_08', [source('10.1111/sms.13054', '29315892', 'meta_analysis'), source('10.1249/MSS.0000000000000852', '26891166', 'position_stand', 'bounded')], 'Pre-exercise feeding for prolonged aerobic performance.'),
  path('mixed_09', [source('10.1136/bjsports-2022-106355', '36690376', 'meta_analysis'), source('10.1007/s40279-021-01482-1', '34043185', 'systematic_review')], 'Timed daytime nap after partial sleep restriction.'),
  path('mixed_11', [source('10.1186/s12970-020-00383-4', '33388079', 'position_stand'), source('10.1016/j.smrv.2023.101764', '36870101', 'meta_analysis')], 'Caffeine performance benefit versus sleep and tolerability costs.'),
  path('mixed_12', [source('10.1007/s40279-017-0728-9', '28434152', 'meta_analysis'), source('10.3389/fphys.2018.00403', '29755363', 'meta_analysis')], 'Compression garments when perceived recovery is the target.'),
  path('mixed_13', [source('10.1055/a-1790-8546', '35255509', 'meta_analysis'), source('10.3389/fphys.2021.651112', '33776802', 'meta_analysis')], 'Autoregulated versus fixed loading for trained athletes pursuing strength.'),
  path('mixed_14', [source('10.1007/s00586-018-5673-2', '29971708', 'systematic_review'), source('10.1080/09638288.2025.2566275', '41065407', 'meta_analysis')], 'Exercise for chronic non-specific low-back pain without red flags.'),
  path('mixed_15', [source('10.1186/s12970-017-0189-4', '28919842', 'position_stand'), source('10.3390/nu13124223', '34959776', 'meta_analysis')], 'Carbohydrate intake during prolonged endurance performance.'),
  path('mixed_16', [source('10.2174/1381612825666190701164923', '31267859', 'systematic_review'), source('10.1186/s13102-025-01381-2', '41219818', 'meta_analysis', 'bounded')], 'High-dose antioxidants, recovery, and training adaptation.'),
];

export interface EvidencePathAudit {
  valid: boolean;
  errors: string[];
  counts: { registered: number; readyForDossier: number; sourceGap: number };
  sourceGapCandidateIds: string[];
}

export function auditEvidencePaths(
  paths: CandidateEvidencePath[],
  candidates: CandidateScenario[],
): EvidencePathAudit {
  const errors: string[] = [];
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const pathIds = new Set<string>();
  const sourceGapCandidateIds: string[] = [];

  for (const evidencePath of paths) {
    if (pathIds.has(evidencePath.candidateId)) errors.push(`Duplicate evidence path for ${evidencePath.candidateId}.`);
    pathIds.add(evidencePath.candidateId);
    if (!candidateIds.has(evidencePath.candidateId)) errors.push(`Unknown candidate ${evidencePath.candidateId}.`);
    if (evidencePath.materialVersion !== 'study2-candidates-v0.6') errors.push(`${evidencePath.candidateId} uses a stale material version.`);
    if (evidencePath.sources.length < 2) errors.push(`${evidencePath.candidateId} has fewer than two source locators.`);

    const dois = new Set(evidencePath.sources.map((item) => item.doi.toLowerCase()));
    const pmids = new Set(evidencePath.sources.map((item) => item.pmid));
    if (dois.size !== evidencePath.sources.length || pmids.size !== evidencePath.sources.length) {
      errors.push(`${evidencePath.candidateId} repeats a DOI or PMID within its source path.`);
    }
    for (const item of evidencePath.sources) {
      if (!/^10\.\d{4,9}\/.+/.test(item.doi)) errors.push(`${evidencePath.candidateId} has malformed DOI ${item.doi}.`);
      if (!/^\d{7,9}$/.test(item.pmid)) errors.push(`${evidencePath.candidateId} has malformed PMID ${item.pmid}.`);
      if (!item.metadataVerifiedBy || !Number.isFinite(Date.parse(item.metadataVerifiedAt))) {
        errors.push(`${evidencePath.candidateId} has unverified source metadata.`);
      }
    }

    const hasDirectSource = evidencePath.sources.some((item) => item.mapping === 'direct');
    const hasAdjacentSource = evidencePath.sources.some((item) => item.mapping === 'adjacent');
    if (!hasDirectSource || hasAdjacentSource) sourceGapCandidateIds.push(evidencePath.candidateId);
  }

  sourceGapCandidateIds.sort();
  return {
    valid: errors.length === 0,
    errors,
    counts: {
      registered: paths.length,
      readyForDossier: paths.length - sourceGapCandidateIds.length,
      sourceGap: sourceGapCandidateIds.length,
    },
    sourceGapCandidateIds,
  };
}
