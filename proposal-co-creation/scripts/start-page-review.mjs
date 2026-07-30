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
if (!args['--architecture'] || !args['--review-dir']) {
  throw new Error('用法：start-page-review.mjs --architecture <page_architecture.json> --review-dir <目录> [--port 0]');
}
const architecture = resolve(args['--architecture']);
const reviewDir = resolve(args['--review-dir']);
const port = args['--port'] === undefined ? 0 : Number(args['--port']);
mkdirSync(reviewDir, { recursive: true });
const builder = resolve(dirname(fileURLToPath(import.meta.url)), 'build-page-review.mjs');
const built = spawnSync(process.execPath, [
  builder, '--architecture', architecture, '--output', join(reviewDir, 'index.html'),
], { encoding: 'utf8' });
if (built.status !== 0) throw new Error(built.stderr || built.stdout);
const session = launchReviewSession({
  reviewDir,
  feedbackPath: join(reviewDir, 'review-feedback.json'),
  port,
});
const started = {
  valid: true,
  status: 'waiting_for_human',
  opened: session.url,
  feedback_path: session.feedback_path,
  review_dir: reviewDir,
  next_action_zh: '请在网页保存审阅，然后回到 Codex 发送“已完成”。',
};
process.stdout.write(`${JSON.stringify(started)}\n`);
