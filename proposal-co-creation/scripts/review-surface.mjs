#!/usr/bin/env node
/**
 * C4 结构审阅面的 **surface 文档**（业务）＋写盘＋校验。宿主生命周期不在这里（模组 Node CLI）。
 *
 * 这一家的原生记录叫 `review-feedback.json`，形状是
 * `{contract_version, review_kind:'co_creation_page_architecture', source_sha256, overall_decision, decisions[]}`。
 * 页面提交落在 `review-submissions.json`（**提交文件**），由收件层翻译回原生形状 —— 形状一层不动。
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { moduleScript } from './lib/planners-modules.mjs';

export const SURFACE_REL = 'review-surface.json';
export const SUBMISSIONS_REL = 'review-submissions.json';
export const FEEDBACK_REL = 'review-feedback.json';
export const CONTEXT_REL = 'review-context.json';
export const ID = 'planners-proposal-system/structure';

/** `<project>/.proposal-work/reviews/<kind>`：审阅目录上一级的上一级是 `.proposal-work`，再上一级是项目。 */
export function projectRootRel(reviewDir) {
  const parts = resolve(reviewDir).split(/[\\/]/).filter(Boolean);
  return parts.at(-2) === 'reviews' ? '../../..' : '..';
}

export const surfacePath = (reviewDir) => join(resolve(reviewDir), SURFACE_REL);
export const submissionsPath = (reviewDir) => join(resolve(reviewDir), SUBMISSIONS_REL);
export const feedbackPath = (reviewDir) => join(resolve(reviewDir), FEEDBACK_REL);
export const contextPath = (reviewDir) => join(resolve(reviewDir), CONTEXT_REL);

export function surfaceDocument(reviewDir, options = {}) {
  // 上传只有在**真的有落盘目标**时才声明：老入口从不传 assets 目录，那时旧 handler 直接 404，
  // 所以"不声明"才是现状的忠实翻译（不摆一个按下去会失败的控件）。
  const capabilities = options.uploads ? ['asset-upload','draft'] : ['draft'];
  return {
    contract_version: 'review-surface/2.0.0',
    id: ID,
    title: options.title || 'Page Architecture 共创审阅',
    description: '逐页确认结构：页序、每页任务、上屏主张与配图；可上传替换图，最后给一个整体意见。',
    project_root: projectRootRel(reviewDir),
    dir: '.',
    entry: 'index.html',
    feedback: SUBMISSIONS_REL,
    draft: existsSync(contextPath(reviewDir)) ? JSON.parse(readFileSync(contextPath(reviewDir),'utf8')).draftPath || 'draft.json' : 'draft.json',
    watch: ['review-snapshot.json'],
    wake: {
      // 插话（steer → next-step），不进持久队列：提交的语义是"现在就收件"。声明 queue 会排到
      // 当前回合之后 —— 模型正忙时它躺在队列里，界面上同时出现「已送达」与「排队中」两份。
      mode: 'steer',
      text: '结构审阅有新的提交（{unit}）：先跑 scripts/review-inbox.mjs 收件'
        + '（它把提交翻译成 review-feedback.json，并把页面报上来的前提带进收据），'
        + '**收件之后**再跑 scripts/validate-page-review-feedback.mjs（门在收件之后，顺序被钉住），'
        + '然后按根 SKILL.md 的「审阅与修改」处理。',
    },
    capabilities,
  };
}

export function writeSurface(reviewDir, options) {
  const target = surfacePath(reviewDir);
  mkdirSync(dirname(target), { recursive: true });
  const payload = JSON.stringify(surfaceDocument(reviewDir, options), null, 2) + '\n';
  if (!existsSync(target) || readFileSync(target, 'utf8') !== payload) writeFileSync(target, payload, 'utf8');
  return target;
}

export function validateSurface(reviewDir) {
  const target = surfacePath(reviewDir);
  if (!existsSync(target)) throw new Error('还没有审阅面：先写 surface，写出 ' + target);
  const result = spawnSync(process.execPath,
    [moduleScript('planners-review-core', 'scripts/validate-surface.mjs'), target, '--text'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('审阅面不合规（' + target + '）：\n' + (result.stdout || result.stderr).trim());
  return { ok: true, output: (result.stdout || '').trim() };
}

export function surfaceOnly(reviewDir, options) {
  const target = writeSurface(reviewDir, options);
  const report = validateSurface(reviewDir);
  return {
    status: 'surface_ready',
    surface: resolve(target),
    entry: resolve(reviewDir, 'index.html'),
    submissions: submissionsPath(reviewDir),
    host_started: false,
    validator: report.output.split('\n').at(-1),
    next_action_zh: '把 surface 的绝对路径交给宿主的 review_open 工具（有插件时）；没有那个工具时用模组的无插件宿主起本地服务。',
  };
}

export function main(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i]] = argv[i + 1];
  if (!args['--review-dir']) {
    process.stdout.write(JSON.stringify({ ok: false, error: '用法：review-surface.mjs --review-dir <审阅目录> [--uploads]' }) + '\n');
    return 2;
  }
  try {
    const result = surfaceOnly(resolve(args['--review-dir']), { uploads: argv.includes('--uploads') || !!args['--assets-dir'] });
    process.stdout.write(JSON.stringify({ ok: true, ...result }, null, 1) + '\n');
    return 0;
  } catch (error) {
    process.stdout.write(JSON.stringify({ ok: false, error: String(error.message || error) }, null, 1) + '\n');
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) process.exit(main());

export function resolveSurfacePaths(surfaceFile) {
  const surface = resolve(surfaceFile);
  const doc = JSON.parse(readFileSync(surface, 'utf8'));
  const base = dirname(surface);
  const dir = resolve(base, String(doc.dir || '.'));
  return {
    surface,
    doc,
    dir,
    entry: resolve(dir, String(doc.entry)),
    submissions: doc.feedback ? resolve(base, String(doc.feedback)) : null,
    feedback: doc.feedback ? resolve(base, String(doc.feedback)) : null,
    projectRoot: resolve(base, String(doc.project_root || '.')),
    contentHash: createHash('sha256').update(readFileSync(surface)).digest('hex').slice(0, 12),
  };
}
