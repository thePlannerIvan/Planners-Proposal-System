#!/usr/bin/env node
import { createHash } from 'node:crypto';
import {
  closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { relative, resolve, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { validateFile } from './lib/contract-validation.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i]] = process.argv[i + 1];
const fail = (message, code = 2) => { process.stderr.write(`${message}\n`); process.exit(code); };
const load = path => JSON.parse(readFileSync(path, 'utf8'));
const write = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const runDir = args['--run-dir'] ? resolve(args['--run-dir']) : null;
const action = args['--action'];
if (!runDir || !['start', 'status', 'block', 'verify', 'start-review-session'].includes(action)) fail('用法：--run-dir <目录> --action start|status|block|verify|start-review-session');
const statePath = join(runDir, 'run-state.json');
const stagesFor = intent => intent === 'upgrade'
  ? ['B1', 'B2', 'B3a', 'B3b', 'B3c', 'B3d', 'B4', 'B5', 'B6']
  : ['B1', 'B2', 'B3a', 'B3b', 'B3c', 'B4', 'B5', 'B6'];
const requiredValidator = {
  B1: 'validate-b1-output.mjs',
  B2: 'validate-semantic-unit-plans.mjs',
  B3a: 'validate-recipe-discoveries.mjs',
  B3b: 'validate-lens-extractions.mjs',
  B3c: 'validate-library-curations.mjs',
  B3d: 'validate-wiki-alignments.mjs',
  B4: 'validate-review-feedback.mjs',
  B5: 'validate-install-report.mjs',
  B6: 'validate-utility-test.mjs'
};
const stageFiles = {
  B1: 'B1-preparation.md',
  B2: 'B2-semantic-units.md',
  B3a: 'B3a-recipe-discovery.md',
  B3b: 'B3b-lens-extraction.md',
  B3c: 'B3c-internal-curation.md',
  B3d: 'B3d-wiki-alignment.md',
  B4: 'B4-full-review.md',
  B5: 'B5-installation.md',
  B6: 'B6-utility-test.md',
};
function stageInstruction(stage) {
  const path = resolve(import.meta.dirname, '../stages', stageFiles[stage]);
  return {
    stage,
    stage_file: path,
    task_zh: readFileSync(path, 'utf8'),
    required_validator: requiredValidator[stage],
  };
}
function publicState(state) {
  return {
    ...state,
    current_instruction: stageInstruction(state.current_stage),
  };
}

if (action === 'start') {
  if (!args['--intent-file']) fail('正式模式必须先由 Router 生成 --intent-file，调度器不得猜测新建或增补');
  const intentPath = resolve(args['--intent-file']);
  if (!existsSync(intentPath)) fail('intent 文件不存在');
  const intentCheck = validateFile(intentPath, resolve(import.meta.dirname, '../contracts/library-run-intent.schema.json'));
  if (!intentCheck.valid) fail(`intent Contract 无效：${intentCheck.errors.join('; ')}`);
  const record = load(intentPath);
  const intent = record.route === 'upgrade_existing' ? 'upgrade' : 'bootstrap';
  const activeWiki = record.active_wiki ? resolve(record.active_wiki) : null;
  if (intent === 'upgrade' && (!activeWiki || !existsSync(activeWiki))) fail('增补路线的 active_wiki 不存在');
  if (intent === 'bootstrap' && activeWiki !== null) fail('独立建库路线的 active_wiki 必须为 null');
  if (existsSync(statePath)) fail('run-state.json 已存在，禁止覆盖正式运行');
  mkdirSync(runDir, { recursive: true });
  const stages = Object.fromEntries(stagesFor(intent).map(stage => [stage, { status: 'pending', receipt: null }]));
  write(statePath, {
    contract_version: '4.0.0',
    intent,
    route: record.route,
    active_wiki: activeWiki,
    status: 'ready',
    current_stage: 'B1',
    stages,
    installation_permitted: false,
    review: null,
    blockers: []
  });
  process.stdout.write(`${JSON.stringify({
    valid: true,
    route: record.route,
    current_stage: 'B1',
    state_path: statePath,
    current_instruction: stageInstruction('B1'),
  })}\n`);
  process.exit(0);
}

if (!existsSync(statePath)) fail('缺少 run-state.json；必须先 start');
const state = load(statePath);
if (state.contract_version !== '4.0.0') fail('run-state 不是 v4');
if (action === 'status') {
  process.stdout.write(`${JSON.stringify(publicState(state), null, 2)}\n`);
  process.exit(0);
}
const stage = args['--stage'];
if (!stage || !state.stages[stage]) fail('stage 不在当前路线中');
if (action === 'block') {
  if (stage !== state.current_stage) fail(`当前阶段是 ${state.current_stage}`);
  const reason = args['--reason'] || '未说明阻塞原因';
  state.status = 'blocked';
  state.stages[stage].status = 'blocked';
  state.blockers.push(`${stage}: ${reason}`);
  write(statePath, state);
  process.stdout.write(`${JSON.stringify({ valid: true, status: 'blocked', stage, reason })}\n`);
  process.exit(0);
}
if (action === 'start-review-session') {
  if (stage !== 'B4' || state.current_stage !== 'B4') fail('只有当前 B4 可以打开审阅');
  const html = resolve(runDir, args['--html'] || '');
  const bundle = resolve(runDir, args['--bundle'] || '');
  const port = args['--port'] === undefined ? 0 : Number(args['--port']);
  if (!existsSync(html) || !html.endsWith('index.html')) fail('缺少 B4 index.html');
  if (!existsSync(bundle)) fail('缺少 review-bundle.json');
  if (!Number.isInteger(port) || (port !== 0 && (port < 1024 || port > 65535))) fail('端口必须为 0 或 1024–65535');
  const reviewDir = resolve(html, '..');
  const feedback = join(reviewDir, 'review-feedback.json');
  const ready = join(reviewDir, 'review-session.json');
  const log = join(reviewDir, 'review-session.log');
  if (existsSync(feedback)) unlinkSync(feedback);
  if (existsSync(ready)) unlinkSync(ready);
  const logFd = openSync(log, 'a');
  const child = spawn(
    process.execPath,
    [join(import.meta.dirname, 'review-session.mjs'), '--dir', reviewDir, '--feedback', feedback, '--port', String(port), '--ready-file', ready],
    { detached: true, stdio: ['ignore', logFd, logFd] },
  );
  closeSync(logFd);
  child.unref();
  for (let i = 0; i < 80 && !existsSync(ready); i++) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  if (!existsSync(ready)) {
    const details = existsSync(log) ? readFileSync(log, 'utf8').trim() : '';
    fail(`review server 未就绪${details ? `：${details}` : ''}`);
  }
  const session = load(ready);
  const opened = spawnSync('open', [session.url], { encoding: 'utf8' });
  if (opened.status !== 0) fail(`无法直接打开 review 页面：${opened.stderr || opened.stdout}`);
  state.status = 'waiting_for_human';
  state.review = {
    stage: 'B4',
    html: relative(runDir, html),
    html_sha256: sha(html),
    bundle: relative(runDir, bundle),
    bundle_sha256: sha(bundle),
    url: session.url,
    feedback_path: relative(runDir, feedback),
    opened_at: new Date().toISOString()
  };
  write(statePath, state);
  process.stdout.write(`${JSON.stringify({
    valid: true,
    status: 'waiting_for_human',
    opened: session.url,
    feedback_path: feedback,
    next_action_zh: '请在网页保存审阅，然后回到 Codex 发送“已完成”。',
  })}\n`);
  process.exit(0);
}

if (stage !== state.current_stage) fail(`当前阶段是 ${state.current_stage}，不能验证 ${stage}`);
if (!args['--receipt']) fail('verify 必须提供 --receipt');
const receiptPath = resolve(runDir, args['--receipt']);
if (!existsSync(receiptPath)) fail('回执不存在');
const receipt = load(receiptPath);
if (receipt.stage !== stage || !Array.isArray(receipt.artifacts) || !Array.isArray(receipt.validators)) fail('回执必须包含匹配的 stage、artifacts、validators');
const required = requiredValidator[stage];
if (!receipt.validators.some(item => item.script === required)) fail(`${stage} 回执必须运行 ${required}`);
const artifacts = receipt.artifacts.map(path => {
  const full = resolve(runDir, path);
  if (!full.startsWith(`${runDir}/`) || !existsSync(full)) fail(`产物不存在或越界：${path}`);
  return { path, sha256: sha(full) };
});
for (const validator of receipt.validators) {
  if (!validator || typeof validator.script !== 'string' || !Array.isArray(validator.args)) fail('validator 回执格式无效');
  if (!Object.values(requiredValidator).includes(validator.script)) fail(`不允许的 validator：${validator.script}`);
  const script = join(import.meta.dirname, validator.script);
  const resolvedArgs = validator.args.map(value => String(value).startsWith('--') ? String(value) : resolve(runDir, String(value)));
  const result = spawnSync(process.execPath, [script, ...resolvedArgs], { encoding: 'utf8' });
  if (result.status !== 0) fail(`${validator.script} 失败：${(result.stdout || result.stderr).trim()}`);
}
if (stage === 'B4') {
  if (!state.review) fail('B4 必须先 start-review-session 并直接打开页面');
  if (receipt.review_html_sha256 !== state.review.html_sha256 || receipt.review_bundle_sha256 !== state.review.bundle_sha256) fail('B4 回执未绑定实际打开的 HTML 与审阅包');
  const feedbackArtifact = artifacts.find(item => item.path === state.review.feedback_path);
  if (!feedbackArtifact) fail('B4 artifacts 必须包含本次 server 保存的 review-feedback.json');
}
state.stages[stage] = { status: 'passed', receipt: { verified_at: new Date().toISOString(), artifacts, validators: receipt.validators } };
const list = stagesFor(state.intent);
const next = list[list.indexOf(stage) + 1] || null;
state.current_stage = next || stage;
state.status = next ? 'in_progress' : 'complete';
state.review = null;
state.installation_permitted = next === 'B5'
  && ['B1', 'B2', 'B3a', 'B3b', 'B3c', 'B4'].every(name => state.stages[name]?.status === 'passed')
  && (state.intent === 'bootstrap' || state.stages.B3d?.status === 'passed');
write(statePath, state);
process.stdout.write(`${JSON.stringify({
  valid: true,
  verified: stage,
  next_stage: next,
  installation_permitted: state.installation_permitted,
  current_instruction: next ? stageInstruction(next) : null,
})}\n`);
