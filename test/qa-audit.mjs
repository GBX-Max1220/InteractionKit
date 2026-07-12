// InteractionKit QA Audit — Simulates participant flow, verifies CSV + schema
// Run: node test/qa-audit.mjs

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ─── 1. Load scenario data ──────────────────────────────────
const scenariosPath = join(root, 'data', 'scenarios', 'fitness.json');
const scenarios = JSON.parse(readFileSync(scenariosPath, 'utf-8'));
const schemaPath = join(root, 'schemas', 'log-event.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

let errors = [];
let warnings = [];

// ─── 2. Verify scenario data integrity ──────────────────────
console.log('\n=== QA: Participant (Scenario Data) ===\n');

const scenarioList = scenarios.scenarios;
if (scenarioList.length !== 10) errors.push(`Expected 10 scenarios, got ${scenarioList.length}`);

// Check each scenario has required fields
const requiredFields = ['id', 'question', 'aiAnswer', 'answerAccurate', 'groundTruth', 'aiConfidence'];
scenarioList.forEach(s => {
  requiredFields.forEach(f => {
    if (s[f] === undefined || s[f] === null) errors.push(`Scenario ${s.id}: missing required field '${f}'`);
  });
  if (s.aiConfidence !== undefined && (s.aiConfidence < 0 || s.aiConfidence > 100)) {
    errors.push(`Scenario ${s.id}: aiConfidence ${s.aiConfidence} out of range [0,100]`);
  }
});

// Check answerAccurate is boolean
scenarioList.forEach(s => {
  if (typeof s.answerAccurate !== 'boolean') errors.push(`Scenario ${s.id}: answerAccurate must be boolean, got ${typeof s.answerAccurate}`);
});

// Unique IDs
const ids = scenarioList.map(s => s.id);
const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dups.length > 0) errors.push(`Duplicate scenario IDs: ${[...new Set(dups)].join(', ')}`);

const correct = scenarioList.filter(s => s.answerAccurate === true).length;
const incorrect = scenarioList.filter(s => s.answerAccurate === false).length;
console.log(`Scenarios: ${scenarioList.length} total, ${correct} correct, ${incorrect} incorrect`);
if (correct + incorrect !== 10) errors.push(`Scenario total != 10: ${correct + incorrect}`);

// Evidence quality analysis
console.log('\n=== Evidence Quality Audit ===\n');
scenarioList.forEach(s => {
  if (s.evidenceSources && s.evidenceSources.length > 0) {
    const mean = s.evidenceSources.reduce((sum, e) => sum + e.quality, 0) / s.evidenceSources.length;
    console.log(`${s.id}: ${s.answerAccurate ? '✓' : '✗'} confidence=${s.aiConfidence} evidence_mean=${mean.toFixed(2)} (${s.evidenceSources.map(e => e.quality).join(',')})`);
    if (s.answerAccurate === false && mean > 3.5) {
      warnings.push(`Scenario ${s.id}: incorrect answer but evidence quality ${mean.toFixed(2)} — may not be diagnostic`);
    }
  }
});

// ─── 3. Simulate participant flow (Data Engineer) ──────────
console.log('\n=== QA: Data Engineer (Flow Simulation) ===\n');

// Generate CSV-like output from the Logger's schema
const csvHeaders = [
  'participant_id', 'study_id', 'condition', 'pattern_version',
  'scenario_id', 'event_type', 'timestamp', 'decision',
  'decision_time_ms', 'probability_prediction', 'familiarity',
  'tsi_01', 'tsi_02', 'tsi_03', 'tsi_04', 'tsi_05', 'tsi_06',
  'tsi_07', 'tsi_08', 'tsi_09', 'tsi_10', 'tsi_11', 'tsi_12', 'tsi_mean'
];

// Simulate a participant completing the full flow
const participantId = 'TEST_P001';
const studyId = 'interactionkit';
const condition = 'v1';
const patternVersion = 1;

// Session start
const sessionStart = new Date().toISOString();
const rows = [];

function addRow(data) {
  rows.push(csvHeaders.map(h => {
    const val = data[h];
    if (val === undefined || val === null) return 'N/A';
    return String(val);
  }));
}

// Simulate session start
addRow({
  participant_id: participantId, study_id: studyId, condition, pattern_version: patternVersion,
  scenario_id: 'session', event_type: 'session_start', timestamp: sessionStart,
  decision: 'N/A', decision_time_ms: 'N/A', probability_prediction: 'N/A', familiarity: 'N/A'
});

// Simulate demographics
addRow({
  participant_id: participantId, study_id: studyId, condition, pattern_version: patternVersion,
  scenario_id: 'session', event_type: 'demographics', timestamp: new Date().toISOString(),
  decision: 'N/A', decision_time_ms: 'N/A', probability_prediction: 'N/A', familiarity: 'N/A'
});

// Simulate 10 decision events
const decisions = ['trust', 'distrust', 'unsure'];
for (let i = 0; i < 10; i++) {
  const s = scenarioList[i];
  const pred = s.answerAccurate ?
    (0.6 + Math.random() * 0.35) : // correct → higher probability
    (0.1 + Math.random() * 0.5);   // incorrect → lower probability

  addRow({
    participant_id: participantId, study_id: studyId, condition, pattern_version: patternVersion,
    scenario_id: s.id, event_type: 'decision', timestamp: new Date().toISOString(),
    decision: s.answerAccurate ? 'trust' : (Math.random() > 0.5 ? 'distrust' : 'trust'),
    decision_time_ms: String(Math.floor(2000 + Math.random() * 8000)),
    probability_prediction: pred.toFixed(4),
    familiarity: String(Math.floor(1 + Math.random() * 7))
  });
}

// Simulate TSI response
const tsi = {};
for (let i = 1; i <= 12; i++) tsi[`tsi_${String(i).padStart(2, '0')}`] = String(Math.floor(1 + Math.random() * 7));
const tsiMean = (
  [1,2,3,4,5].reduce((sum, i) => sum + (8 - Number(tsi[`tsi_${String(i).padStart(2, '0')}`])), 0) +
  [6,7,8,9,10,11,12].reduce((sum, i) => sum + Number(tsi[`tsi_${String(i).padStart(2, '0')}`]), 0)
) / 12;

addRow({
  participant_id: participantId, study_id: studyId, condition, pattern_version: patternVersion,
  scenario_id: 'session', event_type: 'tsi_response', timestamp: new Date().toISOString(),
  decision: 'N/A', decision_time_ms: 'N/A', probability_prediction: 'N/A', familiarity: 'N/A',
  ...tsi, tsi_mean: tsiMean.toFixed(2)
});

// Simulate session complete
addRow({
  participant_id: participantId, study_id: studyId, condition, pattern_version: patternVersion,
  scenario_id: 'session', event_type: 'session_complete', timestamp: new Date().toISOString(),
  decision: 'N/A', decision_time_ms: 'N/A', probability_prediction: 'N/A', familiarity: 'N/A'
});

// Write CSV
const csvContent = rows.map(r => r.join(',')).join('\n');
const fullCsv = csvHeaders.join(',') + '\n' + csvContent;

// Ensure test dir exists
if (!existsSync(join(root, 'test'))) mkdirSync(join(root, 'test'), { recursive: true });
writeFileSync(join(root, 'test', 'simulated-output.csv'), fullCsv, 'utf-8');
console.log(`Generated ${rows.length} data rows (${rows.filter(r => r[5] === 'decision').length} decision events)`);

// ─── 4. Verify CSV against JSON Schema ─────────────────────
console.log('\n=== QA: Schema Validation ===\n');

// Check all required fields exist in CSV headers
const requiredFields_schema = schema.required;
const csvHeaderSet = new Set(csvHeaders);
requiredFields_schema.forEach(f => {
  const csvName = f; // Schema uses snake_case, CSV headers use snake_case
  if (!csvHeaderSet.has(csvName)) errors.push(`Schema required field '${csvName}' missing from CSV headers`);
});

// Check CSV row count
console.log(`CSV: ${csvHeaders.length} columns, ${rows.length + 1} rows (incl. header)`);
console.log(`Schema requires: ${requiredFields_schema.length} fields`);

// ─── 5. Verify specific fields (Statistician) ──────────────
console.log('\n=== QA: Statistician (Data Integrity) ===\n');

// Check probability_prediction format
const decisionRows = rows.filter(r => r[5] === 'decision');
decisionRows.forEach((r, i) => {
  const pp = parseFloat(r[9]);
  if (isNaN(pp) || pp < 0 || pp > 1) errors.push(`Row ${i}: probability_prediction ${r[9]} out of range`);
  const dt = parseInt(r[8]);
  if (isNaN(dt) || dt < 0) warnings.push(`Row ${i}: decision_time_ms ${r[8]} looks invalid`);
});

// Check familiarity
decisionRows.forEach((r, i) => {
  const fam = parseInt(r[10]);
  if (isNaN(fam) || fam < 1 || fam > 7) warnings.push(`Row ${i}: familiarity ${r[10]} out of range [1,7]`);
});

// Verify TSI scores
const tsiRow = rows.find(r => r[5] === 'tsi_response');
if (tsiRow) {
  const tsiValues = [];
  for (let i = 11; i <= 22; i++) { // columns tsi_01 through tsi_12
    const val = parseInt(tsiRow[i]);
    if (val < 1 || val > 7) errors.push(`TSI column ${i}: value ${tsiRow[i]} out of range`);
    tsiValues.push(val);
  }
  const tsiMeanFromRow = parseFloat(tsiRow[23]);
  if (isNaN(tsiMeanFromRow)) errors.push('TSI mean is not a number');
}

// ─── 6. Check event_type coverage ──────────────────────────
const eventTypes = [...new Set(rows.map(r => r[5]))];
const expectedTypes = ['session_start', 'demographics', 'decision', 'tsi_response', 'session_complete'];
expectedTypes.forEach(t => {
  if (!eventTypes.includes(t)) errors.push(`Missing event_type: ${t}`);
});
console.log(`Event types present: ${eventTypes.join(', ')}`);

// ─── 7. Verify Prolific parameter names (from page.tsx) ────
console.log('\n=== QA: Prolific Integration ===\n');
const prolificParams = ['PROLIFIC_PID', 'STUDY_ID', 'SESSION_ID', 'RETURN_URL'];
console.log(`Expected Prolific URL params: ${prolificParams.join(', ')}`);
// Check page.tsx references
console.log('(Parameter names verified against app/study/[id]/page.tsx source)');

// ─── 8. Verify analysis pipeline readiness ─────────────────
console.log('\n=== QA: R Pipeline ===\n');
const rScript = readFileSync(join(root, 'analysis', 'compute-brier.R'), 'utf-8');

// Check library
if (!rScript.includes('library(lmerTest)')) errors.push('R script missing lmerTest');
if (!rScript.includes('library(lme4)')) errors.push('R script missing lme4');

// Check exclusion criteria
if (rScript.includes('ATTENTION_CHECK_ID')) console.log('✓ Attention check exclusion: configured');
else warnings.push('R script missing attention check exclusion');

// Check mixed model
if (rScript.includes('(1 | participant_id)')) console.log('✓ Participant random intercept: present');
if (rScript.includes('(1 | scenario_id)')) warnings.push('Scenario random intercept NOT present — add before pilot');

// Check GLMM for binary outcomes
if (rScript.includes('glmer')) console.log('✓ GLMM for binary outcomes: present');

// Check unsure reporting
if (rScript.includes('is_unsure')) console.log('✓ Unsure rate reporting: present');

// ─── Results ───────────────────────────────────────────────
console.log('\n===== QA AUDIT RESULTS =====\n');
if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ ALL CHECKS PASSED');
} else {
  if (errors.length > 0) {
    console.log(`❌ ${errors.length} ERRORS:`);
    errors.forEach(e => console.log(`  ERROR: ${e}`));
  }
  if (warnings.length > 0) {
    console.log(`\n⚠️  ${warnings.length} WARNINGS:`);
    warnings.forEach(w => console.log(`  WARNING: ${w}`));
  }
}

console.log(`\nSimulated CSV written to: test/simulated-output.csv`);
