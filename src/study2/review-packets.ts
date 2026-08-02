import { CandidateScenario } from './materials';
import { seededShuffle } from './random';

export interface BlindedEvidenceSource {
  citation: string;
  urlOrDoi: string;
  authorityType: CandidateScenario['evidenceSources'][number]['authorityType'];
}

export interface BlindedReviewItem {
  blindId: string;
  domain: CandidateScenario['domain'];
  decisionPrompt: string;
  optionA: string;
  optionB: string;
  targetPopulation: string;
  evidenceSources: BlindedEvidenceSource[];
}

export interface ReviewerPacket {
  schemaVersion: 'study2-domain-review-packet-v1';
  materialVersion: CandidateScenario['materialVersion'];
  reviewerId: string;
  packetSeed: string;
  items: BlindedReviewItem[];
}

export interface ReviewerCrosswalkItem {
  blindId: string;
  candidateId: string;
}

export function generateReviewerPacket(options: {
  candidates: CandidateScenario[];
  reviewerId: string;
  seed: string;
}): { packet: ReviewerPacket; crosswalk: ReviewerCrosswalkItem[] } {
  const { candidates, reviewerId, seed } = options;
  if (!reviewerId.trim()) throw new Error('Reviewer ID is required.');
  if (!seed.trim()) throw new Error('Packet seed is required.');
  if (candidates.length !== 32) throw new Error('A reviewer packet requires exactly 32 candidates.');
  if (new Set(candidates.map((candidate) => candidate.id)).size !== candidates.length) {
    throw new Error('Candidate IDs must be unique.');
  }

  const ordered = seededShuffle(candidates, `${seed}:reviewer:${reviewerId}`);
  const crosswalk: ReviewerCrosswalkItem[] = [];
  const items = ordered.map((candidate, index) => {
    const blindId = `S${String(index + 1).padStart(2, '0')}`;
    crosswalk.push({ blindId, candidateId: candidate.id });
    return {
      blindId,
      domain: candidate.domain,
      decisionPrompt: candidate.decisionPrompt,
      optionA: candidate.optionA,
      optionB: candidate.optionB,
      targetPopulation: candidate.targetPopulation,
      evidenceSources: candidate.evidenceSources.map((source) => ({
        citation: source.citation,
        urlOrDoi: source.urlOrDoi,
        authorityType: source.authorityType,
      })),
    } satisfies BlindedReviewItem;
  });

  return {
    packet: {
      schemaVersion: 'study2-domain-review-packet-v1',
      materialVersion: candidates[0].materialVersion,
      reviewerId,
      packetSeed: seed,
      items,
    },
    crosswalk,
  };
}
