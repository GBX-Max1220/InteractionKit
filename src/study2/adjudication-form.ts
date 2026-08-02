import type {
  AdjudicationMethod,
  AdjudicationQueue,
  AdjudicationResolution,
} from './adjudication';
import type { CandidateScenario } from './materials';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function reviewBlock(label: string, review: AdjudicationQueue['items'][number]['firstReview']): string {
  return `<div class="review"><h3>${escapeHtml(label)}</h3>
<dl><dt>Reviewer</dt><dd>${escapeHtml(review.reviewerId)}</dd><dt>Decision</dt><dd>${escapeHtml(review.binaryDecision)}</dd><dt>Support</dt><dd>${escapeHtml(review.supportLevel)}</dd><dt>Boundary</dt><dd>${escapeHtml(review.decisionBoundary)}</dd><dt>Granularity</dt><dd>${escapeHtml(review.numericalGranularity)}</dd><dt>Source concern</dt><dd>${escapeHtml(review.sourceConcern)}</dd><dt>Recommendation</dt><dd>${escapeHtml(review.recommendation)}</dd><dt>Rationale</dt><dd>${escapeHtml(review.rationale)}</dd></dl></div>`;
}

function radios(candidateId: string, field: string, options: Array<[string, string]>): string {
  return `<div class="radios">${options
    .map(
      ([value, label]) =>
        `<label><input type="radio" name="${escapeHtml(`${candidateId}-${field}`)}" value="${escapeHtml(value)}"> ${escapeHtml(label)}</label>`,
    )
    .join('')}</div>`;
}

export function buildAdjudicationTemplate(
  queue: AdjudicationQueue,
  method: AdjudicationMethod,
): AdjudicationResolution {
  const originalReviewerIds = [
    ...new Set(queue.items.flatMap((item) => [item.firstReview.reviewerId, item.secondReview.reviewerId])),
  ].sort();
  return {
    schemaVersion: 'study2-adjudication-resolution-v1',
    roundId: queue.roundId,
    materialVersion: queue.materialVersion,
    panelId: queue.panelId,
    method,
    resolverIds: method === 'reviewer_consensus_after_lock' ? originalReviewerIds : [],
    relevantQualifications: '',
    conflictOfInterestStatement: '',
    independenceAttestation: '',
    materialContributionConflict: true,
    adjudicatedAt: '',
    items: queue.items.map((item) => ({
      candidateId: item.candidateId,
      disposition: 'revise_and_re_review',
      finalBinaryDecision: 'unresolved',
      finalSupportLevel: 'unresolved',
      finalDecisionBoundary: '',
      finalNumericalGranularity: '',
      rationale: '',
    })),
  };
}

export function renderAdjudicationForm(options: {
  queue: AdjudicationQueue;
  candidates: CandidateScenario[];
  method: AdjudicationMethod;
}): string {
  const candidateById = new Map(options.candidates.map((candidate) => [candidate.id, candidate]));
  const originalReviewerIds = [
    ...new Set(
      options.queue.items.flatMap((item) => [item.firstReview.reviewerId, item.secondReview.reviewerId]),
    ),
  ].sort();
  const cards = options.queue.items
    .map((item, index) => {
      const candidate = candidateById.get(item.candidateId);
      if (!candidate) throw new Error(`Adjudication form is missing ${item.candidateId}.`);
      const sources = candidate.evidenceSources
        .map(
          (source) =>
            `<li>${escapeHtml(source.citation)} <a href="${escapeHtml(source.urlOrDoi)}" target="_blank" rel="noopener noreferrer">Open source</a></li>`,
        )
        .join('');
      const sourceConcern = item.triggers.sourceConcernIdentified ? 'true' : 'false';
      return `<section class="card" data-candidate-id="${escapeHtml(item.candidateId)}" data-source-concern="${sourceConcern}">
<h2>${index + 1}. ${escapeHtml(item.candidateId)} <span>${escapeHtml(candidate.domain.replaceAll('_', ' '))}</span></h2>
<p class="prompt">${escapeHtml(candidate.decisionPrompt)}</p><div class="option"><b>Option A</b>${escapeHtml(candidate.optionA)}</div><div class="option"><b>Option B</b>${escapeHtml(candidate.optionB)}</div>
<p><b>Target population:</b> ${escapeHtml(candidate.targetPopulation)}</p><details><summary>Evidence sources</summary><ol>${sources}</ol></details>
<div class="reviews">${reviewBlock('Locked review 1', item.firstReview)}${reviewBlock('Locked review 2', item.secondReview)}</div>
<p class="trigger"><b>Recorded triggers:</b> ${escapeHtml(Object.entries(item.triggers).filter(([, active]) => active).map(([name]) => name).join(', '))}</p>
<fieldset><legend>Disposition</legend>${radios(item.candidateId, 'disposition', [
        ['retain_without_change', 'Retain without change'],
        ['revise_and_re_review', 'Revise and independently re-review'],
        ['reject', 'Reject'],
      ])}</fieldset>
<fieldset><legend>Final binary decision (retention only)</legend>${radios(item.candidateId, 'finalBinaryDecision', [['option_a', 'Option A'], ['option_b', 'Option B']])}</fieldset>
<fieldset><legend>Final support level (retention only)</legend>${radios(item.candidateId, 'finalSupportLevel', [['strong_consensus', 'Strong consensus'], ['mixed_or_conditional', 'Mixed or conditional']])}</fieldset>
<label>Canonical decision boundary<textarea data-field="finalDecisionBoundary"></textarea></label><label>Canonical numerical granularity<textarea data-field="finalNumericalGranularity"></textarea></label><label>Resolution rationale<textarea data-field="rationale" required></textarea></label>
</section>`;
    })
    .join('\n');
  const queueJson = JSON.stringify(options.queue).replaceAll('<', '\\u003c');
  const fixedResolvers = options.method === 'reviewer_consensus_after_lock' ? originalReviewerIds : [];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; form-action 'none'; base-uri 'none'"><title>Study 2 adjudication — ${escapeHtml(options.queue.panelId)}</title>
<style>:root{font:16px/1.5 system-ui,sans-serif;color:#172033;background:#eef2f7}body{margin:0}main{max-width:1050px;margin:auto;padding:30px 18px 90px}header,.card,.actions{background:#fff;border:1px solid #ccd5e1;border-radius:12px;padding:22px;margin-bottom:18px}.notice,.trigger{border-left:5px solid #a95700;background:#fff7e7;padding:11px}.prompt{font-weight:700}.option{display:grid;grid-template-columns:90px 1fr;gap:8px;background:#f5f7fa;padding:10px;margin:8px 0}.reviews{display:grid;grid-template-columns:1fr 1fr;gap:12px}.review{background:#f7f9fc;border:1px solid #d8e0eb;padding:12px}.review h3{margin-top:0}dl{display:grid;grid-template-columns:110px 1fr;gap:5px}dt{font-weight:700}dd{margin:0;overflow-wrap:anywhere}fieldset{margin:14px 0;border:1px solid #ccd5e1}.radios{display:flex;flex-wrap:wrap;gap:16px}label{display:block;font-weight:650;margin:10px 0}textarea,input[type=text]{box-sizing:border-box;width:100%;padding:8px;font:inherit}textarea{min-height:70px}.actions{position:sticky;bottom:8px;display:flex;gap:10px;box-shadow:0 4px 18px #74809655}button{padding:10px 15px;border:0;border-radius:6px;font-weight:700}.primary{background:#1769aa;color:#fff}.status{margin-left:auto}@media(max-width:760px){.reviews{grid-template-columns:1fr}.actions{position:static;flex-wrap:wrap}.status{width:100%}}</style></head><body><main><header><h1>Locked-review adjudication</h1><p><b>Panel:</b> ${escapeHtml(options.queue.panelId)} · <b>Method:</b> ${escapeHtml(options.method)}</p><p class="notice">The two original judgments were locked before adjudication. Resolve only the recorded disagreements. A source concern cannot be erased through discussion; revise and re-review or reject that item. This file sends no data to a server.</p>
<label>Resolver IDs (comma-separated)<input type="text" id="resolvers" value="${escapeHtml(fixedResolvers.join(', '))}" ${fixedResolvers.length ? 'readonly' : ''} required></label><label>Relevant qualifications<input type="text" id="qualifications" required></label><label>Conflict-of-interest statement<input type="text" id="coi" required></label><label>Independence attestation<input type="text" id="independence" required></label><label><input type="checkbox" id="no-contribution" required> I did not author or materially contribute to these scenarios or dossiers.</label></header><form id="form">${cards}</form><div class="actions"><button type="button" id="save">Save browser draft</button><button type="button" id="clear">Clear draft</button><button type="button" class="primary" id="download">Validate and download JSON</button><span class="status" id="status" aria-live="polite"></span></div></main>
<script>'use strict';const queue=${queueJson};const method=${JSON.stringify(options.method)};const form=document.getElementById('form');const status=document.getElementById('status');const storageKey='study2-adjudication:'+queue.roundId+':'+queue.panelId+':'+method;
function chosen(card,id,field){return card.querySelector('input[name="'+id+'-'+field+'"]:checked')?.value||''}function text(card,field){return card.querySelector('[data-field="'+field+'"]').value.trim()}
function collect(requireComplete){if(requireComplete&&!form.reportValidity())return null;const resolverIds=document.getElementById('resolvers').value.split(',').map(v=>v.trim()).filter(Boolean);const qualifications=document.getElementById('qualifications').value.trim();const coi=document.getElementById('coi').value.trim();const independence=document.getElementById('independence').value.trim();const noContribution=document.getElementById('no-contribution').checked;if(requireComplete&&(!resolverIds.length||!qualifications||!coi||!independence||!noContribution)){status.textContent='Complete all resolver attestations.';return null}const items=queue.items.map(item=>{const card=form.querySelector('[data-candidate-id="'+item.candidateId+'"]');const disposition=chosen(card,item.candidateId,'disposition');const retaining=disposition==='retain_without_change';return{candidateId:item.candidateId,disposition,finalBinaryDecision:retaining?chosen(card,item.candidateId,'finalBinaryDecision'):'unresolved',finalSupportLevel:retaining?chosen(card,item.candidateId,'finalSupportLevel'):'unresolved',finalDecisionBoundary:retaining?text(card,'finalDecisionBoundary'):'',finalNumericalGranularity:retaining?text(card,'finalNumericalGranularity'):'',rationale:text(card,'rationale')}});if(requireComplete){const missing=items.find(item=>!item.disposition||!item.rationale||(item.disposition==='retain_without_change'&&(!item.finalBinaryDecision||!item.finalSupportLevel||!item.finalDecisionBoundary||!item.finalNumericalGranularity)));if(missing){status.textContent=missing.candidateId+' has an incomplete resolution.';return null}const sourceConflict=items.find(item=>item.disposition==='retain_without_change'&&queue.items.find(q=>q.candidateId===item.candidateId).triggers.sourceConcernIdentified);if(sourceConflict){status.textContent=sourceConflict.candidateId+' cannot be retained while a source concern exists.';return null}}return{schemaVersion:'study2-adjudication-resolution-v1',roundId:queue.roundId,materialVersion:queue.materialVersion,panelId:queue.panelId,method,resolverIds,relevantQualifications:qualifications,conflictOfInterestStatement:coi,independenceAttestation:independence,materialContributionConflict:!noContribution,adjudicatedAt:requireComplete?new Date().toISOString():'',items}}
function restore(v){document.getElementById('resolvers').value=(v.resolverIds||[]).join(', ');document.getElementById('qualifications').value=v.relevantQualifications||'';document.getElementById('coi').value=v.conflictOfInterestStatement||'';document.getElementById('independence').value=v.independenceAttestation||'';document.getElementById('no-contribution').checked=v.materialContributionConflict===false;for(const item of v.items||[]){const card=form.querySelector('[data-candidate-id="'+item.candidateId+'"]');if(!card)continue;for(const field of ['disposition','finalBinaryDecision','finalSupportLevel']){const input=card.querySelector('input[name="'+item.candidateId+'-'+field+'"][value="'+item[field]+'"]');if(input)input.checked=true}for(const field of ['finalDecisionBoundary','finalNumericalGranularity','rationale'])card.querySelector('[data-field="'+field+'"]').value=item[field]||''}}
document.getElementById('save').addEventListener('click',()=>{localStorage.setItem(storageKey,JSON.stringify(collect(false)));status.textContent='Draft saved only in this browser.'});document.getElementById('clear').addEventListener('click',()=>{if(confirm('Clear every adjudication response?')){localStorage.removeItem(storageKey);location.reload()}});document.getElementById('download').addEventListener('click',()=>{const value=collect(true);if(!value)return;const blob=new Blob([JSON.stringify(value,null,2)+'\\n'],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=queue.panelId+'.adjudication-resolution.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);status.textContent='Validated resolution downloaded.'});try{const saved=localStorage.getItem(storageKey);if(saved)restore(JSON.parse(saved))}catch{status.textContent='A saved draft could not be restored.'}</script></body></html>\n`;
}
