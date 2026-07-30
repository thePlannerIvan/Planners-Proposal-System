#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { renderPageReviewHtml } from './lib/page-review-html.mjs';

function argsOf(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 2) out[argv[index]] = argv[index + 1];
  return out;
}
const args = argsOf(process.argv.slice(2));
if (!args['--architecture'] || !args['--output']) {
  throw new Error('用法：build-page-review.mjs --architecture <page_architecture.json> --output <review/index.html>');
}
const architecturePath = resolve(args['--architecture']);
const outputPath = resolve(args['--output']);
const raw = readFileSync(architecturePath, 'utf8');
const validation = spawnSync(process.execPath, [
  resolve(dirname(fileURLToPath(import.meta.url)), 'validate-page-architectures.mjs'),
  architecturePath,
], { encoding: 'utf8' });
if (validation.status !== 0) throw new Error(`Page Architecture 验证失败：${validation.stdout || validation.stderr}`);
const architecture = JSON.parse(raw);
const sourceSha256 = createHash('sha256').update(raw).digest('hex');
const pages = architecture.pages.map(page => ({
  page_number: page.page_number,
  title: page.title_intent,
  claim: page.claim,
  points: page.content_blocks.map(block => `${block.block_title}：${block.content_requirement}`),
  meta: [
    { label: '页面任务', value: page.page_job },
    { label: '所属章节', value: page.section_id },
    { label: '后续取材', value: page.evidence_needs.length ? page.evidence_needs : ['本页暂未指定外部证据'] },
    { label: '进入下一页', value: page.transition || '本页为收束页' },
  ],
  sections: [],
}));
const html = renderPageReviewHtml({
  reviewKind: 'co_creation_page_architecture',
  title: 'Storyline 与页面结构审阅',
  subtitle: `请从整条说服路径判断 ${architecture.pages.length} 页是否完整、准确且有必要。一个 Storyline 节点可以展开为多页。`,
  sourceSha256,
  pages,
  notice: '所有页面默认通过。重点只看章节推进、标题、核心判断和分行内容块；图表、配图与版式通常留到 By-page Copy。输入任何反馈后，本页会自动切换为“需要修改”。',
});
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html);
process.stdout.write(`${JSON.stringify({ valid: true, pages: pages.length, source_sha256: sourceSha256, output: outputPath })}\n`);
