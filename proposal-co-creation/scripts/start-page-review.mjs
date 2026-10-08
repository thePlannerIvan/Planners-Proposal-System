#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { contextPath, openSurface, surfaceOnly, surfacePath } from './review-surface-support.mjs';

function argsOf(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key?.startsWith('--')) continue;
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; index += 1; }
  }
  return out;
}
function workbenchReport(reviewDir, sourceHash) {
  const context = JSON.parse(readFileSync(contextPath(reviewDir), 'utf8'));
  const canonical = context.files?.[0]?.path || context.architecturePath || null;
  return {
    workbench: true,
    review_context: contextPath(reviewDir),
    workbench_dir: resolve(reviewDir, 'workbench'),
    workbench_head: resolve(reviewDir, 'workbench/head.json'),
    canonical_path: canonical,
    source_hash: sourceHash,
    pending_tasks: resolve(reviewDir, 'workbench/head.json'),
  };
}
const args = argsOf(process.argv.slice(2));
if (!args['--architecture'] || !args['--review-dir']) {
  throw new Error('用法：start-page-review.mjs --architecture <page_architecture.json> --review-dir <目录> [--port 0] [--assets-dir <替换图落盘目录>] [--surface-only] [--no-open]');
}
const architecture = resolve(args['--architecture']);
const reviewDir = resolve(args['--review-dir']);
const port = args['--port'] === undefined ? 0 : Number(args['--port']);
const assetsDir = args['--assets-dir'] ? resolve(args['--assets-dir']) : null;
mkdirSync(reviewDir, { recursive: true });
const builder = resolve(dirname(fileURLToPath(import.meta.url)), 'build-page-review.mjs');
const previousRound = join(reviewDir, 'review-feedback.json');
const buildArgs = [builder, '--architecture', architecture, '--output', join(reviewDir, 'index.html')];
if (args['--legacy-review'] === 'true') buildArgs.push('--legacy-review', 'true');
if (existsSync(previousRound)) buildArgs.push('--previous', previousRound);
const built = spawnSync(process.execPath, buildArgs, { encoding: 'utf8' });
if (built.status !== 0) throw new Error(built.stderr || built.stdout);
const buildReport = JSON.parse(built.stdout.slice(built.stdout.indexOf('{')));
const sourceSha256 = buildReport.source_sha256;
// 收件层要知道的身份（哪份架构、哪个指纹、上传落到哪）：落在 surface 旁边，不进反馈文件。
writeFileSync(contextPath(reviewDir), JSON.stringify({
  ...JSON.parse(readFileSync(contextPath(reviewDir),'utf8')),
  sourceSha256,
  architecturePath: architecture,
  assetsDir: assetsDir || null,
  savedBy: 'start-page-review.mjs',
  generatedAt: new Date().toISOString(),
  priorRound: existsSync(previousRound) ? previousRound : null,
}, null, 2) + '\n', 'utf8');
// 起停宿主归公共模组（Node CLI）。这一份脚本不实现任何生命周期。
const shouldOpen = !process.argv.includes('--no-open') && process.env.REVIEW_TEST_NO_OPEN !== '1';

if (process.argv.includes('--surface-only') || process.argv.includes('--no-host')) {
  const surface = surfaceOnly(reviewDir, { uploads: !!assetsDir });
  const payload = { valid: true, status: 'surface_ready', ...surface, review_dir: reviewDir,
    asset_roots: assetsDir ? [assetsDir] : [] };
  if (args['--legacy-review'] === 'true') {
    payload.source_hash = sourceSha256;
    payload.feedback_path = join(reviewDir, 'review-feedback.json');
  } else Object.assign(payload, workbenchReport(reviewDir, sourceSha256));
  process.stdout.write(JSON.stringify(payload) + '\n');
  process.exit(0);
}
const state = await openSurface(reviewDir, { port, open: shouldOpen, uploads: !!assetsDir });
const payload = { valid: true, status: args['--legacy-review'] === 'true' ? 'waiting_for_human' : 'workbench_ready',
  opened: state.opened, url: state.url, started: state.started, reused: state.reused,
  surface: state.surface, review_dir: reviewDir };
if (args['--legacy-review'] === 'true') {
  Object.assign(payload, { source_hash: sourceSha256, feedback_path: join(reviewDir, 'review-feedback.json'),
    submissions_path: join(reviewDir, 'review-submissions.json'),
    next_action_zh: '请在网页提交；然后跑 scripts/review-inbox.mjs 收件，再跑 validate-page-review-feedback.mjs。' });
} else Object.assign(payload, workbenchReport(reviewDir, sourceSha256), {
  next_action_zh: '打开工作台后，先读取 review-context.json 与 canonical_path；保存主稿由工作台回写同一份 canonical 文件。需要处理用户反馈时读取 workbench/head.json 的 pending tasks，并按 task 的 revision/source_hash 修改；保存不是批准。'
});
process.stdout.write(JSON.stringify(payload) + '\n');
