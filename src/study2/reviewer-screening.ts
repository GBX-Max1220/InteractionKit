import type { CandidateDomain } from './reviewer-roster';

export const REVIEW_PANEL_REQUIREMENTS = [
  {
    panelId: 'exercise-physiology',
    itemCount: 15,
    domains: ['exercise_training', 'recovery', 'environment'],
    qualificationSummary:
      'Graduate-level or active doctoral training, a regulated credential, or a documented research/practice record covering exercise physiology or strength and conditioning, with defensible coverage of recovery and environmental exercise claims.',
  },
  {
    panelId: 'sports-nutrition',
    itemCount: 8,
    domains: ['nutrition'],
    qualificationSummary:
      'Graduate-level or active doctoral training, a dietetics/nutrition credential, or a documented research/practice record in sports, exercise, or performance nutrition.',
  },
  {
    panelId: 'sports-medicine',
    itemCount: 4,
    domains: ['injury_risk'],
    qualificationSummary:
      'Clinical or research competence in exercise-related injury risk and urgent sport-health decisions, supported by a regulated credential, graduate/doctoral training, or a documented sports-medicine research record.',
  },
] as const satisfies readonly {
  panelId: string;
  itemCount: number;
  domains: readonly CandidateDomain[];
  qualificationSummary: string;
}[];

export type ReviewPanelId = (typeof REVIEW_PANEL_REQUIREMENTS)[number]['panelId'];
export type QualificationRoute =
  | 'graduate_training'
  | 'active_doctoral_training'
  | 'regulated_credential'
  | 'documented_research_or_practice';

export interface ReviewerScreeningResponse {
  schemaVersion: 'study2-reviewer-screening-v1';
  roundId: 'study2-domain-review-round-v2';
  panelId: ReviewPanelId;
  fullName: string;
  contact: string;
  institutionalAffiliation: string;
  qualificationRoute: QualificationRoute;
  qualificationDetails: string;
  publicCredentialUrl: string;
  claimedDomains: CandidateDomain[];
  conflictOfInterestStatement: string;
  materialContributionConflict: boolean;
  independenceAttestation: boolean;
  compensationStatementAccepted: boolean;
  outcomeContingentCompensation: boolean;
  disclosedCompensationStatement: string;
  submittedAt: string;
}

export interface ScreeningValidation {
  valid: boolean;
  errors: string[];
  requiresManualIdentityAndConflictVerification: true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

const candidateDomains = new Set<CandidateDomain>([
  'exercise_training',
  'recovery',
  'nutrition',
  'injury_risk',
  'environment',
]);

export function panelRequirement(panelId: string) {
  return REVIEW_PANEL_REQUIREMENTS.find((panel) => panel.panelId === panelId);
}

export function validateReviewerScreeningResponse(
  value: unknown,
  options: { expectedPanelId?: ReviewPanelId; expectedCompensationStatement?: string } = {},
): ScreeningValidation {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return {
      valid: false,
      errors: ['Screening response must be a JSON object.'],
      requiresManualIdentityAndConflictVerification: true,
    };
  }
  if (value.schemaVersion !== 'study2-reviewer-screening-v1') {
    errors.push('Unsupported reviewer-screening schema version.');
  }
  if (value.roundId !== 'study2-domain-review-round-v2') {
    errors.push('Screening response round ID is incorrect.');
  }
  const panel = panelRequirement(String(value.panelId));
  if (!panel) errors.push('Screening response has an unknown expertise panel.');
  if (options.expectedPanelId && value.panelId !== options.expectedPanelId) {
    errors.push('Screening response does not match the dispatched panel.');
  }
  for (const field of [
    'fullName',
    'contact',
    'institutionalAffiliation',
    'qualificationDetails',
    'conflictOfInterestStatement',
    'disclosedCompensationStatement',
  ] as const) {
    if (!nonEmptyString(value[field])) errors.push(`Screening response is missing ${field}.`);
  }
  if (
    ![
      'graduate_training',
      'active_doctoral_training',
      'regulated_credential',
      'documented_research_or_practice',
    ].includes(String(value.qualificationRoute))
  ) {
    errors.push('Screening response has an invalid qualification route.');
  }
  if (
    !nonEmptyString(value.publicCredentialUrl) ||
    !/^https:\/\//i.test(value.publicCredentialUrl)
  ) {
    errors.push('A public HTTPS credential or institutional profile URL is required.');
  }
  const claimedDomains = Array.isArray(value.claimedDomains)
    ? value.claimedDomains.filter(
        (domain): domain is CandidateDomain =>
          typeof domain === 'string' && candidateDomains.has(domain as CandidateDomain),
      )
    : [];
  if (
    !Array.isArray(value.claimedDomains) ||
    claimedDomains.length !== value.claimedDomains.length ||
    new Set(claimedDomains).size !== claimedDomains.length
  ) {
    errors.push('Claimed domains must be an array of domain identifiers.');
  }
  if (panel) {
    for (const domain of panel.domains) {
      if (!claimedDomains.includes(domain)) errors.push(`Screening response does not attest ${domain} coverage.`);
    }
  }
  if (value.materialContributionConflict !== false) {
    errors.push('A material contributor is ineligible for this review round.');
  }
  if (value.independenceAttestation !== true) {
    errors.push('Reviewer must attest independent completion before paired responses are locked.');
  }
  if (value.compensationStatementAccepted !== true) {
    errors.push('Reviewer must accept the disclosed fixed or voluntary compensation terms.');
  }
  if (value.outcomeContingentCompensation !== false) {
    errors.push('Compensation cannot depend on agreement or retention outcomes.');
  }
  if (
    options.expectedCompensationStatement &&
    value.disclosedCompensationStatement !== options.expectedCompensationStatement
  ) {
    errors.push('Screening response does not match the dispatched compensation statement.');
  }
  if (!nonEmptyString(value.submittedAt) || !Number.isFinite(Date.parse(value.submittedAt))) {
    errors.push('Screening response requires a valid submission timestamp.');
  }
  return {
    valid: errors.length === 0,
    errors,
    requiresManualIdentityAndConflictVerification: true,
  };
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

export function renderRecruitmentInvitation(options: {
  panelId: ReviewPanelId;
  compensationStatement: string;
  returnContact: string;
}): string {
  const panel = panelRequirement(options.panelId)!;
  return `Subject: Independent expert review invitation — Study 2 ${panel.panelId}\n\nWe are recruiting an independent domain expert to review ${panel.itemCount} candidate decision scenarios for an HCI study about calibrated reliance on AI-generated sport and exercise guidance.\n\nThe task is to judge each scenario's defensible binary decision, evidence-support level, decision boundary, numerical granularity, source adequacy, and retain/revise/reject recommendation. You will work independently and will not receive author-side provisional labels or the paired reviewer's responses. Unresolved and revise judgments are explicitly acceptable.\n\nMinimum panel qualification: ${panel.qualificationSummary}\n\nCompensation: ${options.compensationStatement}\n\nParticipation requires identity/qualification verification, conflict disclosure, confirmation that you did not materially contribute to the reviewed materials, and an agreement that compensation is independent of judgments and outcomes. Recruitment or participation does not imply endorsement of the study.\n\nIf interested, complete the attached offline screening form and return the downloaded JSON to: ${options.returnContact}\n`;
}

export function renderReviewerScreeningForm(options: {
  panelId: ReviewPanelId;
  compensationStatement: string;
}): string {
  const panel = panelRequirement(options.panelId)!;
  const panelJson = JSON.stringify(panel).replaceAll('<', '\\u003c');
  const compensationJson = JSON.stringify(options.compensationStatement).replaceAll('<', '\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; form-action 'none'; base-uri 'none'"><title>Study 2 reviewer screening</title><style>:root{font:16px/1.5 system-ui,sans-serif;color:#172033;background:#eef2f7}main{max-width:760px;margin:auto;padding:30px}header,form{background:white;border:1px solid #ccd5e1;border-radius:12px;padding:22px;margin-bottom:18px}.notice{border-left:5px solid #a95700;background:#fff7e7;padding:12px}label{display:block;font-weight:650;margin:14px 0}input,select,textarea{box-sizing:border-box;width:100%;padding:9px;font:inherit}input[type=checkbox],input[type=radio]{width:auto}textarea{min-height:80px}.checks label{font-weight:400}button{background:#1769aa;color:#fff;border:0;border-radius:6px;padding:11px 16px;font-weight:700}.status{margin-left:12px}</style></head><body><main><header><h1>Independent reviewer screening</h1><p><b>Panel:</b> ${escapeHtml(panel.panelId)} · <b>Burden disclosed:</b> ${panel.itemCount} scenarios</p><p>${escapeHtml(panel.qualificationSummary)}</p><p><b>Compensation:</b> ${escapeHtml(options.compensationStatement)}</p><p class="notice">This form runs entirely in your browser and sends no data to a server. The downloaded JSON contains personal information; return it only to the study contact and do not post it publicly. Completing screening does not guarantee eligibility.</p></header><form id="form"><label>Full name<input id="fullName" required></label><label>Preferred contact<input id="contact" required></label><label>Institutional or professional affiliation<input id="affiliation" required></label><label>Primary qualification route<select id="route" required><option value="">Select one</option><option value="graduate_training">Graduate-level training</option><option value="active_doctoral_training">Active doctoral training</option><option value="regulated_credential">Regulated professional credential</option><option value="documented_research_or_practice">Documented research or practice record</option></select></label><label>Qualification details<textarea id="details" required></textarea></label><label>Public HTTPS credential, institutional profile, ORCID, or publication-profile URL<input id="credential" type="url" pattern="https://.*" required></label><fieldset class="checks"><legend>Required domain coverage</legend>${panel.domains.map((domain) => `<label><input type="checkbox" data-domain="${escapeHtml(domain)}" required> I can defensibly review ${escapeHtml(domain.replaceAll('_', ' '))} claims.</label>`).join('')}</fieldset><label>Conflict-of-interest disclosure<textarea id="coi" required></textarea></label><div class="checks"><label><input type="checkbox" id="noContribution" required> I did not author or materially edit any candidate scenario, evidence dossier, provisional label, or review code.</label><label><input type="checkbox" id="independent" required> I will complete the review independently and avoid the paired reviewer's responses until both submissions are locked.</label><label><input type="checkbox" id="compensation" required> I accept the disclosed compensation terms.</label><label><input type="checkbox" id="notOutcomeContingent" required> I understand compensation does not depend on agreement, recommendations, retention outcomes, or target distributions.</label></div><button type="button" id="download">Validate and download private JSON</button><span id="status" class="status" aria-live="polite"></span></form></main><script>'use strict';const panel=${panelJson};const compensation=${compensationJson};const form=document.getElementById('form');const status=document.getElementById('status');document.getElementById('download').addEventListener('click',()=>{if(!form.reportValidity()){status.textContent='Complete every required field.';return}const response={schemaVersion:'study2-reviewer-screening-v1',roundId:'study2-domain-review-round-v2',panelId:panel.panelId,fullName:document.getElementById('fullName').value.trim(),contact:document.getElementById('contact').value.trim(),institutionalAffiliation:document.getElementById('affiliation').value.trim(),qualificationRoute:document.getElementById('route').value,qualificationDetails:document.getElementById('details').value.trim(),publicCredentialUrl:document.getElementById('credential').value.trim(),claimedDomains:[...document.querySelectorAll('[data-domain]:checked')].map(input=>input.dataset.domain),conflictOfInterestStatement:document.getElementById('coi').value.trim(),materialContributionConflict:!document.getElementById('noContribution').checked,independenceAttestation:document.getElementById('independent').checked,compensationStatementAccepted:document.getElementById('compensation').checked,outcomeContingentCompensation:!document.getElementById('notOutcomeContingent').checked,submittedAt:new Date().toISOString(),disclosedCompensationStatement:compensation};const blob=new Blob([JSON.stringify(response,null,2)+'\\n'],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=panel.panelId+'.reviewer-screening.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);status.textContent='Private screening response downloaded.'});</script></body></html>\n`;
}
