import type { ReviewerPacket } from './review-packets';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function radioGroup(
  blindId: string,
  field: string,
  legend: string,
  options: Array<[string, string]>,
): string {
  return `<fieldset><legend>${escapeHtml(legend)}</legend><div class="radios">${options
    .map(
      ([value, label], index) =>
        `<label><input type="radio" name="${escapeHtml(`${blindId}-${field}`)}" value="${escapeHtml(value)}"${index === 0 ? ' required' : ''}> ${escapeHtml(label)}</label>`,
    )
    .join('')}</div></fieldset>`;
}

export function renderReviewerForm(packet: ReviewerPacket): string {
  const cards = packet.items
    .map((item, index) => {
      const sources = item.evidenceSources
        .map(
          (source) =>
            `<li><span class="type">${escapeHtml(source.authorityType)}</span> ${escapeHtml(source.citation)} <a href="${escapeHtml(source.urlOrDoi)}" target="_blank" rel="noopener noreferrer">Open source</a></li>`,
        )
        .join('');
      return `<section class="card" data-blind-id="${escapeHtml(item.blindId)}">
  <h2>${index + 1}. ${escapeHtml(item.blindId)} <span>${escapeHtml(item.domain.replaceAll('_', ' '))}</span></h2>
  <p class="prompt">${escapeHtml(item.decisionPrompt)}</p>
  <div class="option"><strong>Option A</strong>${escapeHtml(item.optionA)}</div>
  <div class="option"><strong>Option B</strong>${escapeHtml(item.optionB)}</div>
  <p><strong>Target population:</strong> ${escapeHtml(item.targetPopulation)}</p>
  <details><summary>Evidence sources (${item.evidenceSources.length})</summary><ol>${sources}</ol></details>
  ${radioGroup(item.blindId, 'binaryDecision', 'Binary decision', [
    ['option_a', 'Option A'],
    ['option_b', 'Option B'],
    ['unresolved', 'Unresolved'],
  ])}
  ${radioGroup(item.blindId, 'supportLevel', 'Evidence support', [
    ['strong_consensus', 'Strong consensus'],
    ['mixed_or_conditional', 'Mixed or conditional'],
    ['unresolved', 'Unresolved'],
  ])}
  <label>Decision boundary<textarea data-field="decisionBoundary" required></textarea></label>
  <label>Maximum defensible numerical granularity<textarea data-field="numericalGranularity" required></textarea></label>
  ${radioGroup(item.blindId, 'sourceConcernIdentified', 'Missing or conflicting source concern identified?', [
    ['true', 'Yes — concern identified'],
    ['false', 'No concern identified'],
  ])}
  <label>Missing or conflicting source concern <small>Enter “None identified” when there is none.</small><textarea data-field="sourceConcern" required></textarea></label>
  ${radioGroup(item.blindId, 'recommendation', 'Material recommendation', [
    ['retain', 'Retain'],
    ['revise', 'Revise'],
    ['reject', 'Reject'],
  ])}
  <label>Rationale tied to the supplied sources<textarea data-field="rationale" required></textarea></label>
</section>`;
    })
    .join('\n');

  const packetJson = JSON.stringify(packet).replaceAll('<', '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; form-action 'none'; base-uri 'none'">
<title>Study 2 domain review — ${escapeHtml(packet.reviewerId)}</title>
<style>
:root{font:16px/1.5 system-ui,sans-serif;color:#172033;background:#eef2f7}body{margin:0}main{max-width:940px;margin:auto;padding:32px 20px 100px}header,.card,.actions{background:#fff;border:1px solid #ccd5e1;border-radius:12px;padding:22px;margin:0 0 18px}.notice{border-left:5px solid #ba5d00;background:#fff8e8;padding:12px 16px}h1{margin-top:0}h2{font-size:1.15rem;border-bottom:1px solid #e2e8f0;padding-bottom:10px}h2 span,.type{font-size:.75rem;font-weight:600;text-transform:uppercase;color:#526174;background:#edf2f7;border-radius:4px;padding:3px 6px}.prompt{font-size:1.08rem;font-weight:650}.option{display:grid;grid-template-columns:90px 1fr;gap:8px;background:#f5f7fa;padding:11px;margin:8px 0;border-radius:6px}details{margin:16px 0}li{margin:9px 0}fieldset{border:1px solid #d7dee8;border-radius:7px;margin:15px 0;padding:12px}legend,label{font-weight:650}.radios{display:flex;flex-wrap:wrap;gap:18px}.radios label{font-weight:400}textarea,input[type=text]{box-sizing:border-box;width:100%;border:1px solid #9aa8ba;border-radius:5px;padding:9px;font:inherit}textarea{display:block;min-height:76px;margin:6px 0 14px}small{font-weight:400;color:#526174}.actions{position:sticky;bottom:10px;display:flex;gap:10px;align-items:center;box-shadow:0 4px 18px #7a879944}button{border:0;border-radius:6px;padding:11px 16px;font-weight:700;cursor:pointer}.primary{background:#1769aa;color:white}.secondary{background:#e3e9f1}.status{margin-left:auto;font-size:.9rem;color:#405169}@media(max-width:650px){.radios{display:grid}.actions{position:static;flex-wrap:wrap}.status{width:100%}}
</style>
</head>
<body><main>
<header>
  <h1>Independent domain review</h1>
  <p><strong>Assignment:</strong> ${escapeHtml(packet.reviewerId)} · <strong>Materials:</strong> ${escapeHtml(packet.materialVersion)}</p>
  <p class="notice">Complete this form independently. Do not seek the author-side labels or another reviewer’s judgments. “Unresolved” is preferable to forced agreement. This file sends no data to a server.</p>
  <label>Relevant expertise<input type="text" id="expertise" required></label>
  <label>Conflict-of-interest statement<input type="text" id="coi" required></label>
</header>
<form id="review-form">${cards}</form>
<div class="actions"><button type="button" class="secondary" id="save">Save browser draft</button><button type="button" class="secondary" id="clear">Clear browser draft</button><button type="button" class="primary" id="download">Validate and download JSON</button><span class="status" id="status" aria-live="polite"></span></div>
</main>
<script>
'use strict';
const packet=${packetJson};
const storageKey='study2-review-draft:'+packet.reviewerId+':'+packet.packetSeed;
const form=document.getElementById('review-form');
const status=document.getElementById('status');
function collect(requireComplete){
  if(requireComplete&&!form.reportValidity())return null;
  const expertise=document.getElementById('expertise');
  const coi=document.getElementById('coi');
  if(requireComplete&&(!expertise.reportValidity()||!coi.reportValidity()))return null;
  const items=packet.items.map(item=>{
    const card=form.querySelector('[data-blind-id="'+item.blindId+'"]');
    const chosen=field=>card.querySelector('input[name="'+item.blindId+'-'+field+'"]:checked')?.value||'unresolved';
    const text=field=>card.querySelector('[data-field="'+field+'"]').value.trim();
    const sourceConcernChoice=chosen('sourceConcernIdentified');
    return {blindId:item.blindId,binaryDecision:chosen('binaryDecision'),supportLevel:chosen('supportLevel'),decisionBoundary:text('decisionBoundary'),numericalGranularity:text('numericalGranularity'),sourceConcernIdentified:sourceConcernChoice==='true'?true:sourceConcernChoice==='false'?false:null,sourceConcern:text('sourceConcern'),recommendation:chosen('recommendation'),rationale:text('rationale')};
  });
  if(requireComplete){
    const impossible=items.find(item=>item.recommendation==='retain'&&(item.binaryDecision==='unresolved'||item.supportLevel==='unresolved'));
    if(impossible){status.textContent=impossible.blindId+' cannot be retained with an unresolved judgment.';return null;}
    const concernConflict=items.find(item=>item.sourceConcernIdentified&&item.recommendation==='retain');
    if(concernConflict){status.textContent=concernConflict.blindId+' cannot be retained while a source concern is identified.';return null;}
    const concernTextConflict=items.find(item=>{const normalized=item.sourceConcern.toLowerCase().replace(/[.!]$/,'');return item.sourceConcernIdentified?normalized==='none identified':normalized!=='none identified';});
    if(concernTextConflict){status.textContent=concernTextConflict.blindId+' source-concern flag and explanation do not match.';return null;}
  }
  return {schemaVersion:'study2-domain-review-submission-v3',materialVersion:packet.materialVersion,reviewerId:packet.reviewerId,packetSeed:packet.packetSeed,relevantExpertise:expertise.value.trim(),conflictOfInterestStatement:coi.value.trim(),submittedAt:requireComplete?new Date().toISOString():'',items};
}
function restore(value){
  document.getElementById('expertise').value=value.relevantExpertise||'';document.getElementById('coi').value=value.conflictOfInterestStatement||'';
  for(const item of value.items||[]){const card=form.querySelector('[data-blind-id="'+item.blindId+'"]');if(!card)continue;for(const field of ['binaryDecision','supportLevel','sourceConcernIdentified','recommendation']){const input=card.querySelector('input[name="'+item.blindId+'-'+field+'"][value="'+item[field]+'"]');if(input)input.checked=true;}for(const field of ['decisionBoundary','numericalGranularity','sourceConcern','rationale']){card.querySelector('[data-field="'+field+'"]').value=item[field]||'';}}
}
document.getElementById('save').addEventListener('click',()=>{localStorage.setItem(storageKey,JSON.stringify(collect(false)));status.textContent='Draft saved only in this browser.';});
document.getElementById('clear').addEventListener('click',()=>{if(confirm('Clear every response in this form?')){localStorage.removeItem(storageKey);form.reset();document.getElementById('expertise').value='';document.getElementById('coi').value='';status.textContent='Draft cleared.';}});
document.getElementById('download').addEventListener('click',()=>{const submission=collect(true);if(!submission){status.textContent=status.textContent||'Complete every required field.';return;}const blob=new Blob([JSON.stringify(submission,null,2)+'\\n'],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=packet.reviewerId+'.completed-submission.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);status.textContent='Validated JSON downloaded. Send that file to the protocol maintainer.';});
try{const saved=localStorage.getItem(storageKey);if(saved)restore(JSON.parse(saved));}catch{status.textContent='A saved draft could not be restored.';}
</script></body></html>\n`;
}
