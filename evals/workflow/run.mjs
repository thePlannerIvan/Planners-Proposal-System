#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { assert, pass } from '../lib/assert.mjs';
import { hostAlive, hostState, stopHost } from '../lib/review-host-bridge.mjs';
import { moduleScript } from '../../proposal-co-creation/scripts/lib/planners-modules.mjs';

const skill = resolve(import.meta.dirname, '../..');
const c = join(skill, 'proposal-co-creation/scripts');
const wikiQuery = moduleScript('planners-method-wiki', 'scripts/query-wiki.mjs');
const sourceValidator = moduleScript('planners-source-index', 'scripts/validate-source-index.mjs');
const project = mkdtempSync(join(tmpdir(), 'proposal-workflow-fixture-'));
const work = join(project, '.proposal-work');
const sources = join(project, 'sources');
const architecturePath = join(work, 'page-architecture.json');
const indexPath = join(work, 'source-index.json');
const memoryPath = join(work, 'project-memory.md');
const evidence = [];
const hosts = new Set();
const hash = value => createHash('sha256').update(value).digest('hex');
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');

// These are test submissions, not evidence of real client approval.
function run(script, args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 30000,
    env: { ...process.env, REVIEW_TEST_NO_OPEN: '1', PLANNERS_NO_AUTO_INSTALL: '1' },
  });
  assert(result.status === expectedStatus,
    `${script}: expected exit ${expectedStatus}, got ${result.status}\n${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout.trim());
}

function check(condition, label, details = null) {
  assert(condition, label);
  evidence.push({ label, passed: true, ...(details === null ? {} : { details }) });
  pass(label);
}

function sourcePaths(indexFile) {
  const index = readJson(indexFile);
  return index.sources.map(source => resolve(dirname(indexFile), index.source_root, source.origin.path));
}

function validFeedback(reviewDir, expectedStatus = 0) {
  return run(join(c, 'validate-page-review-feedback.mjs'), [
    '--feedback', join(reviewDir, 'review-feedback.json'), '--architecture', architecturePath,
  ], expectedStatus);
}

function canHandoff(reviewDir) {
  const files = [memoryPath, indexPath, architecturePath, join(reviewDir, 'review-feedback.json')];
  if (!files.every(path => isAbsolute(path) && existsSync(path))) return false;
  const index = run(sourceValidator, [indexPath]);
  if (!index.valid || !sourcePaths(indexPath).every(existsSync)) return false;
  const result = spawnSync(process.execPath, [join(c, 'validate-page-review-feedback.mjs'),
    '--feedback', files[3], '--architecture', architecturePath], { encoding: 'utf8' });
  return result.status === 0 && JSON.parse(result.stdout).valid
    && readJson(files[3]).overall_decision === 'approve';
}

async function startReview(name) {
  const reviewDir = join(work, 'reviews', name);
  const surface = run(join(c, 'start-page-review.mjs'), [
    '--architecture', architecturePath, '--review-dir', reviewDir, '--surface-only',
  ]);
  check(surface.status === 'surface_ready' && surface.host_started === false,
    `${name}: surface-only delegates hosting without opening a browser`);
  hosts.add(surface.surface);
  const live = run(join(c, 'start-page-review.mjs'), [
    '--architecture', architecturePath, '--review-dir', reviewDir, '--port', '0', '--no-open',
  ]);
  check(live.status === 'waiting_for_human' && live.opened === false,
    `${name}: real host waits for a submission`);
  const page = await fetch(live.url, { signal: AbortSignal.timeout(5000) });
  check(page.ok && (await page.text()).includes('reviewData'), `${name}: host serves the adapter output`);
  return { ...live, reviewDir };
}

async function submit(live, overall, edits = null) {
  const architecture = readJson(architecturePath);
  const submission = {
    contract_version: '1.0.0', review_kind: 'co_creation_page_architecture',
    source_sha256: live.source_hash, saved_at: new Date().toISOString(),
    overall_decision: overall, overall_feedback_zh: 'TEST FIXTURE: simulated reviewer, not client approval.',
    decisions: architecture.pages.map(page => ({
      page_number: page.page_number,
      decision: overall === 'revise' && page.page_number === 1 ? 'revise' : 'approve',
      feedback_zh: overall === 'revise' && page.page_number === 1
        ? 'TEST FIXTURE: keep the consumer-sample limitation explicit.' : '',
    })),
    ...(edits ? { review_changes: edits } : {}),
  };
  const response = await fetch(new URL('__review/write', live.url), {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(submission), signal: AbortSignal.timeout(5000),
  });
  check(response.ok && existsSync(live.submissions_path), `${overall}: test submission saved through real host`);
  check(readJson(live.submissions_path).overall_feedback_zh.startsWith('TEST FIXTURE'),
    `${overall}: simulated approval remains visibly labelled`);
  return run(join(c, 'review-inbox.mjs'), ['--review-dir', live.reviewDir]);
}

process.once('exit', () => {
  for (const surface of hosts) {
    const state = hostState(surface);
    try { if (state?.pid) process.kill(state.pid, 'SIGTERM'); } catch { /* Host already stopped. */ }
  }
});

try {
  mkdirSync(work, { recursive: true });
  mkdirSync(sources, { recursive: true });
  const briefFile = join(sources, 'brief.md');
  const feedbackFile = join(sources, 'consumer-feedback.md');
  writeFileSync(briefFile, '# TEST FIXTURE: product proposal\n\n## Decision\nChoose one pilot priority for a commuter bag.\n\n## Design assumption\nThe team expects more external pockets to improve daily use.\n\n## Boundaries\nBudget permits one pilot; there is no market-wide survey or production commitment.\n');
  writeFileSync(feedbackFile, '# TEST FIXTURE: six interviews\n\n## Observations\nFour of six interviewees report the shoulder strap rubbing during a 20-minute commute.\nTwo mention insufficient external pockets.\nThis purposive sample does not estimate population prevalence.\n');
  const brief = readFileSync(briefFile, 'utf8');
  const feedback = readFileSync(feedbackFile, 'utf8');
  check(brief.includes('one pilot') && feedback.includes('Four of six'), 'Read actual fixture source bytes before indexing');
  writeJson(indexPath, {
    contract_version: 'source-index/2.0.0', source_root: '../sources',
    sources: [briefFile, feedbackFile].map((file, index) => ({
      source_id: index ? 'src-feedback' : 'src-brief',
      origin: { path: relative(sources, file), sha256: hash(readFileSync(file)), bytes: readFileSync(file).length },
      kind: 'document', role: index ? 'Pilot hypothesis and sample limitations' : 'Project decision and budget',
      audit_layer: { mode: 'source_file' }, coverage: { status: 'full', scope: 'All Markdown lines' },
      anchors: [{ kind: 'heading', value: index ? 'Observations' : 'Decision' }],
    })), blind_spots: [],
  });
  const indexed = run(sourceValidator, [indexPath]);
  check(indexed.valid && indexed.warnings.length === 0 && sourcePaths(indexPath).every(existsSync),
    'Source-index public validator accepts actual sources with resolvable relative paths', indexed.checked);

  const defaultWiki = run(wikiQuery, ['--query', '消费者', '--limit', '5']);
  check(defaultWiki.returned > 0 && defaultWiki.results.some(lens => lens.analysis_operations.length),
    'Default Wiki query returns actionable Lens operations');
  const customWiki = join(project, 'specified-wiki');
  mkdirSync(join(customWiki, 'modules'), { recursive: true });
  writeJson(join(customWiki, 'wiki-index.json'), { modules: [{ module_id: 'mod_fixture-pilot', path: 'modules/pilot.json', lenses: [{ lens_id: 'lens_fixture-pilot' }] }] });
  writeJson(join(customWiki, 'modules/pilot.json'), {
    contract_version: '1.0.0', wiki_module_id: `wm_${hash('pilot').slice(0, 24)}`,
    module_id: 'mod_fixture-pilot', title: 'Test pilot decision', stable_decision: 'Choose a pilot', unified_preconditions: ['Feedback available'],
    wiki_version: '1.0.0', status: 'active', approval: { human_approved: false, reviewer_note: 'Test fixture only', approved_at: null },
    deletion: { deleted: false, reason: null, replaced_by: null }, created_from_hash: hash('fixture'),
    source_module_instance_ids: [`mi_${hash('pilot-source').slice(0, 24)}`], recipes: [], page_expression_options: [], lens_catalog: [{
      lens_id: 'lens_fixture-pilot', name: 'Commuter discomfort hypothesis', aliases: [], question: 'Which pilot is worth testing?',
      use_conditions: ['Commuter feedback is available'], analysis_operations: ['Compare design assumptions with reported discomfort'],
      skip_conditions: ['No feedback'], required_inputs: ['Feedback'], failure_modes: ['Overgeneralization'], variants: [],
      source_module_instance_ids: [`mi_${hash('pilot-source').slice(0, 24)}`],
      output_types: ['Pilot hypothesis'], boundaries: ['Interview counts do not estimate market prevalence'],
    }],
  });
  const specified = run(wikiQuery, ['--wiki-dir', customWiki, '--query', 'commuter', '--limit', '5']);
  check(specified.returned === 1 && specified.results[0].lens_id === 'lens_fixture-pilot'
    && specified.results[0].boundaries.length === 1, 'Specified Wiki query reads only the selected library');
  const zero = run(wikiQuery, ['--wiki-dir', customWiki, '--query', 'unsupported-fixture-term', '--limit', '5']);
  check(zero.returned === 0 && zero.results.length === 0, 'Zero-result Wiki query remains empty, not invented evidence');
  const missing = spawnSync(process.execPath, [wikiQuery, '--wiki-dir', join(project, 'missing-wiki'), '--query', 'commuter'], { encoding: 'utf8' });
  check(missing.status === 2 && JSON.parse(missing.stdout || missing.stderr).ok === false, 'Unavailable Wiki reports a real failure');

  writeFileSync(memoryPath, `# TEST FIXTURE: project memory\n\nDecision: select one pilot, not a production rollout.\nEvidence: brief.md#Decision; consumer-feedback.md#Observations.\nWiki application: ${specified.results[0].analysis_operations[0]}; ${specified.results[0].boundaries[0]}.\nSimulated question: prioritize strap testing or pocket testing?\nSimulated input: prioritize strap testing; retain a no-market-prevalence caveat.\nOpen issue: effectiveness and costs need a pilot; no market-wide claim.\n`);
  const page = (number, title, claim, requirement, transition) => ({
    page_number: number, section_id: 'sec-pilot', page_job: 'Support the one-pilot decision without a population claim',
    title_intent: title, claim,
    content_blocks: [{ block_title: 'Evidence and limit', role: 'Bound the recommendation', content_requirement: requirement, suggested_form: 'comparison' }],
    evidence_needs: ['src-brief: Decision', 'src-feedback: Observations'], chart_brief: null, layout_direction: null, transition,
  });
  writeJson(architecturePath, {
    contract_version: '2.0.0', project_id: 'pj_000000000000000000000008',
    storyline_thesis: 'The six interviews justify testing strap comfort first, not claiming a market-wide need.',
    sections: [{ section_id: 'sec-pilot', title: 'Select a testable priority', cognitive_job: 'Accept a bounded pilot recommendation', transition: 'Validate before production' }],
    pages: [
      page(1, 'Test strap comfort before adding pockets', 'Four of six interviewees reported strap rubbing; two mentioned pocket capacity.',
        'Compare the team assumption with both observed issues, stating six purposively selected interviews.', 'The pattern supports a pilot hypothesis, not a rollout.'),
      page(2, 'A small pilot must test comfort and cost', 'The approved project scope allows only one pilot.',
        'Describe the pilot questions and evidence still needed; do not fabricate budgets or success thresholds.', 'Ask for pilot resources only after validating cost and feasibility.'),
    ],
  });
  check(run(join(c, 'validate-page-architectures.mjs'), [architecturePath]).valid,
    'Authored two-page structure passes the actual 2.0 contract');

  const revision = await startReview('revision');
  const noSubmission = run(join(c, 'review-inbox.mjs'), ['--review-dir', revision.reviewDir]);
  check(noSubmission.ok && noSubmission.skipped && !existsSync(revision.feedback_path),
    'No submission produces no approval or native feedback');
  check(validFeedback(revision.reviewDir, 2).valid === false && !canHandoff(revision.reviewDir),
    'No submission cannot be handed off as approved');
  const revisionReceipt = await submit(revision, 'revise');
  check(revisionReceipt.imported.overall_decision === 'revise' && validFeedback(revision.reviewDir).valid,
    'Revise can have valid=true: validity is not approval');
  check(!canHandoff(revision.reviewDir), 'Revise remains blocked from approved handoff');

  const approval = await startReview('structure');
  const before = readJson(architecturePath);
  const approvalReceipt = await submit(approval, 'approve', {
    contract_version: 'content-review-edits/1.0.0',
    page_order: before.pages.map(item => item.page_number), section_order: before.sections.map(item => item.section_id),
    edits: { pages: { '1': { title: 'Six interviews support a strap-comfort pilot' } }, sections: {} },
  });
  check(approvalReceipt.ok && approvalReceipt.content_changed
    && readJson(architecturePath).pages[0].title_intent === 'Six interviews support a strap-comfort pilot',
    'Inbox applies a simulated reviewer edit to the formal structure');
  check(validFeedback(approval.reviewDir).valid
    && readJson(approval.feedback_path).source_sha256 === hash(readFileSync(architecturePath)),
    'Approval binds to the edited current structure, not the pre-review hash');
  check(run(join(c, 'validate-page-architectures.mjs'), [architecturePath]).valid
    && canHandoff(approval.reviewDir), 'Approved fixture is eligible for complete downstream handoff');

  const files = [memoryPath, indexPath, architecturePath, approval.feedback_path];
  writeFileSync(join(project, 'handoff.md'), `# TEST FIXTURE: simulated handoff to planners-bypage\n\nProject: ${project}\n\n${files.map(path => '- ' + path).join('\n')}\n\nConfirmed in this simulation: prioritize a strap-comfort pilot.\nEvidence limit: six interviews; no market-prevalence claim.\nUnresolved: cost, feasibility and effectiveness; test these before production.\nDownstream scope: page splitting, evidence gathering and copy; material strategy changes return to discussion.\nContinue content expansion; do not repeat the confirmed discussion.\n`);
  check(files.length === 4 && files.every(path => isAbsolute(path) && existsSync(path))
    && sourcePaths(files[1]).every(existsSync), 'Handoff carries all four real files and working source paths');

  const approvedBytes = readFileSync(architecturePath);
  const stale = readJson(architecturePath);
  stale.storyline_thesis += ' External test-only revision.';
  writeJson(architecturePath, stale);
  check(validFeedback(approval.reviewDir, 1).errors.some(error => error.includes('page_architecture.json'))
    && !canHandoff(approval.reviewDir), 'Stale approval fails against a changed structure');
  writeFileSync(architecturePath, approvedBytes);

  const movedDir = join(project, 'moved', 'deep');
  mkdirSync(movedDir, { recursive: true });
  const movedIndex = join(movedDir, 'source-index.json');
  writeFileSync(movedIndex, readFileSync(indexPath));
  const movedCheck = run(sourceValidator, [movedIndex]);
  check(movedCheck.valid && movedCheck.warnings.some(warning => warning.code === 'origin_file_absent')
    && !sourcePaths(movedIndex).every(existsSync),
    'Moving an index breaks source paths even when the public validator returns valid=true', movedCheck.warnings);
  const repaired = readJson(movedIndex);
  repaired.source_root = relative(movedDir, sources);
  writeJson(movedIndex, repaired);
  check(run(sourceValidator, [movedIndex]).warnings.length === 0 && sourcePaths(movedIndex).every(existsSync),
    'Repairing source_root restores the moved index');
  writeFileSync(feedbackFile, feedback + '\nTEST-ONLY source mutation.\n');
  check(run(sourceValidator, [indexPath], 1).errors.some(error => error.code === 'origin_hash_mismatch'),
    'Changed source bytes fail the recorded source hash');
  writeFileSync(feedbackFile, feedback);
  check(canHandoff(approval.reviewDir), 'Final fixture handoff is still current after negative tests');
} finally {
  for (const surface of hosts) {
    const state = hostState(surface);
    if (state) await stopHost(state);
    check((await hostAlive(surface)) === null, 'Test host is stopped', surface);
  }
  writeJson(join(project, 'workflow-test-report.json'), {
    fixture_only: true, real_user_approval: false, project, evidence,
    limitations: ['This suite tests interfaces and simulated choices, not final client semantic acceptance.'],
  });
  process.stdout.write(`Workflow evidence: ${join(project, 'workflow-test-report.json')}\n`);
}
