#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { contextPath, openSurface, surfaceOnly, surfacePath } from './review-surface-support.mjs';

function argsOf(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 2) out[argv[index]] = argv[index + 1];
  return out;
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
if (existsSync(previousRound)) buildArgs.push('--previous', previousRound);
const built = spawnSync(process.execPath, buildArgs, { encoding: 'utf8' });
if (built.status !== 0) throw new Error(built.stderr || built.stdout);
const buildReport = JSON.parse(built.stdout.slice(built.stdout.indexOf('{')));
const sourceSha256 = buildReport.source_sha256;
// 收件层要知道的身份（哪份架构、哪个指纹、上传落到哪）：落在 surface 旁边，不进反馈文件。
writeFileSync(contextPath(reviewDir), JSON.stringify({
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
  process.stdout.write(JSON.stringify({
    valid: true, status: 'surface_ready', ...surface,
    source_hash: sourceSha256, review_dir: reviewDir, feedback_path: join(reviewDir, 'review-feedback.json'),
    asset_roots: assetsDir ? [assetsDir] : [],
  }) + '\n');
  process.exit(0);
}
const state = await openSurface(reviewDir, { port, open: shouldOpen, uploads: !!assetsDir });
process.stdout.write(JSON.stringify({
  valid: true,
  status: 'waiting_for_human',
  opened: state.opened,
  url: state.url,
  started: state.started,
  reused: state.reused,
  surface: state.surface,
  source_hash: sourceSha256,
  feedback_path: join(reviewDir, 'review-feedback.json'),
  submissions_path: join(reviewDir, 'review-submissions.json'),
  review_dir: reviewDir,
  next_action_zh: '请在网页保存审阅；然后跑 scripts/review-inbox.mjs 收件（**收件之后**才跑 validate-page-review-feedback.mjs）。',
}) + '\n');
