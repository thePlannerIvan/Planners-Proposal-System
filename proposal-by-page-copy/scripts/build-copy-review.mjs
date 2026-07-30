#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { renderPageReviewHtml } from './lib/page-review-html.mjs';

function argsOf(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 2) out[argv[index]] = argv[index + 1];
  return out;
}
function clean(value) {
  return String(value ?? '').trim().replace(/^["']|["']$/g, '');
}
function scalar(frontmatter, key) {
  return clean(frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))?.[1] ?? '');
}
function splitPages(content) {
  return [...content.replace(/\r\n/g, '\n').matchAll(/(?:^|\n)---\n([\s\S]*?)\n---\n([\s\S]*?)(?=\n---\ncontract_version:|$)/g)]
    .map(match => ({ frontmatter: match[1], body: match[2] }));
}
function section(body, name, nextName = null) {
  const end = nextName ? `(?=\\n##\\s*${nextName})` : '$';
  return body.match(new RegExp(`##\\s*${name}\\s*\\n([\\s\\S]*?)${end}`, 'i'))?.[1]?.trim() ?? '';
}

const args = argsOf(process.argv.slice(2));
if (!args['--copy'] || !args['--output']) {
  throw new Error('用法：build-copy-review.mjs --copy <proposal-draft.md> --output <review/index.html> [--audit fact-audit.json] [--kind sample|final]');
}
const copyPath = resolve(args['--copy']);
const outputPath = resolve(args['--output']);
const kind = args['--kind'] || 'final';
if (!['sample', 'final'].includes(kind)) throw new Error('--kind 必须为 sample 或 final');
const copyRaw = readFileSync(copyPath, 'utf8');
const validation = spawnSync(process.execPath, [
  resolve(dirname(fileURLToPath(import.meta.url)), 'validate-by-page-copy-bundle.mjs'),
  copyPath,
], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
if (validation.status !== 0) throw new Error(`逐页文案验证失败：${validation.stdout || validation.stderr}`);

let auditRaw = '';
let audit = { facts: [] };
let factExceptions = [];
if (args['--audit']) {
  const auditPath = resolve(args['--audit']);
  if (!existsSync(auditPath)) throw new Error(`事实审计不存在：${auditPath}`);
  const auditValidation = spawnSync(process.execPath, [
    resolve(dirname(fileURLToPath(import.meta.url)), 'validate-fact-audit.mjs'),
    '--audit', auditPath, '--copy', copyPath, '--allow-human-review', 'true',
  ], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (auditValidation.status !== 0) {
    throw new Error(`事实语义核验尚未完成，不能构建终稿审阅：${auditValidation.stdout || auditValidation.stderr}`);
  }
  const auditResult = JSON.parse(auditValidation.stdout);
  factExceptions = auditResult.human_review_required || [];
  auditRaw = readFileSync(auditPath, 'utf8');
  audit = JSON.parse(auditRaw);
}
const sourceSha256 = createHash('sha256')
  .update(copyRaw)
  .update('\n---FACT-AUDIT---\n')
  .update(auditRaw)
  .digest('hex');
const auditByPage = new Map();
for (const fact of audit.facts || []) {
  const pageNumber = Number(fact.page_number);
  const values = auditByPage.get(pageNumber) || [];
  values.push(fact);
  auditByPage.set(pageNumber, values);
}
const exceptionsByPage = new Map();
for (const exception of factExceptions) {
  const values = exceptionsByPage.get(Number(exception.page_number)) || [];
  values.push(exception);
  exceptionsByPage.set(Number(exception.page_number), values);
}
const pages = splitPages(copyRaw).map(({ frontmatter, body }) => {
  const pageNumber = Number(scalar(frontmatter, 'page_number'));
  const facts = auditByPage.get(pageNumber) || [];
  const exceptions = exceptionsByPage.get(pageNumber) || [];
  return {
    page_number: pageNumber,
    title: scalar(frontmatter, 'page_title'),
    claim: scalar(frontmatter, 'main_claim'),
    requires_fact_decision: exceptions.length > 0,
    fact_exceptions: exceptions,
    meta: [
      { label: '所属章节', value: scalar(frontmatter, 'section_id') },
    ],
    sections: [
      {
        label: '页面主体内容',
        value: section(body, 'Page Content', 'Production Notes'),
        format: 'markdown',
      },
      {
        label: '制作说明',
        value: section(body, 'Production Notes'),
        collapsed: true,
      },
      {
        label: '最终实际使用事实',
        value: facts.length
          ? facts.map(item => {
            const sources = [...new Set((item.items || [])
              .map(number => `${number.source_id || number.source_path || '未指定'} ${number.locator || ''}`.trim()))];
            return `${item.fact_id} · ${item.semantic_status || 'pending'} · ${item.claim_text}\n数字：${(item.items || []).map(number => `${number.raw}（${number.kind}）`).join('、')}\n来源：${sources.join('；')}`;
          }).join('\n\n')
          : '本页没有需要外部核对的实际使用事实。',
        collapsed: true,
      },
    ],
  };
});
const html = renderPageReviewHtml({
  reviewKind: kind === 'sample' ? 'by_page_sample' : 'by_page_copy',
  title: kind === 'sample' ? '代表性样页校准' : '完整逐页文案审阅',
  subtitle: kind === 'sample'
    ? `请检查 ${pages.length} 张完整样页的语言、内容厚度、结构和页面容量。`
    : `请逐页检查 ${pages.length} 页的标题、核心判断、完整主体、表格、图表说明和图片。`,
  sourceSha256,
  pages,
  notice: factExceptions.length
    ? '普通页面默认通过；含事实例外的页面保持待决定，必须明确接受例外或要求修改。输入反馈后，本页自动切换为“需要修改”。'
    : '全部页面默认通过。输入任何反馈后，本页自动切换为“需要修改”。请把注意力放在标题和完整主体内容；内部工作信息默认收起。',
  allowUploads: kind === 'final',
});
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html);
process.stdout.write(`${JSON.stringify({ valid: true, kind, pages: pages.length, source_sha256: sourceSha256, output: outputPath })}\n`);
