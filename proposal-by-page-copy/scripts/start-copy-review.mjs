#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launchReviewSession } from './lib/review-launcher.mjs';

function argsOf(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 2) out[argv[index]] = argv[index + 1];
  return out;
}
const args = argsOf(process.argv.slice(2));
for (const key of ['--copy', '--review-dir']) if (!args[key]) throw new Error(`缺少 ${key}`);
const kind = args['--kind'] || 'final';
if (!['sample', 'final'].includes(kind)) throw new Error('--kind 必须为 sample 或 final');
if (kind === 'final' && !args['--audit']) throw new Error('final 审阅必须提供 --audit');
const reviewDir = resolve(args['--review-dir']);
const copyPath = resolve(args['--copy']);
const finalMdPath = args['--final-md'] ? resolve(args['--final-md']) : null;
mkdirSync(reviewDir, { recursive: true });
const builder = resolve(dirname(fileURLToPath(import.meta.url)), 'build-copy-review.mjs');
if (kind === 'final') {
  const auditPath = resolve(args['--audit']);
  const auditValidation = spawnSync(process.execPath, [
    resolve(dirname(fileURLToPath(import.meta.url)), 'validate-fact-audit.mjs'),
    '--audit', auditPath, '--copy', copyPath, '--allow-human-review', 'true',
  ], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (auditValidation.status !== 0) {
    throw new Error(`事实语义核验尚未完成，不能启动终稿审阅：${auditValidation.stdout || auditValidation.stderr}`);
  }
}
const builderArgs = [
  builder, '--copy', copyPath, '--output', join(reviewDir, 'index.html'), '--kind', kind,
];
if (args['--audit']) builderArgs.push('--audit', resolve(args['--audit']));
const built = spawnSync(process.execPath, builderArgs, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
if (built.status !== 0) throw new Error(built.stderr || built.stdout);
const session = launchReviewSession({
  reviewDir,
  feedbackPath: join(reviewDir, 'review-feedback.json'),
  port: args['--port'] === undefined ? 0 : Number(args['--port']),
  assetsDir: kind === 'final' ? join(reviewDir, 'uploads') : null,
  finalMdPath,
});
process.stdout.write(`${JSON.stringify({
  valid: true,
  kind,
  status: 'waiting_for_human',
  opened: session.url,
  feedback_path: session.feedback_path,
  review_dir: reviewDir,
  planned_final_md_path: finalMdPath,
  next_action_zh: '请在网页保存审阅，然后回到 Codex 发送“已完成”。',
})}\n`);
