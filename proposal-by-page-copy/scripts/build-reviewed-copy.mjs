#!/usr/bin/env node
import {
  copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  basename, dirname, join, relative, resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';

function argsOf(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 2) out[argv[index]] = argv[index + 1];
  return out;
}
function splitPages(content) {
  const normalized = content.replace(/\r\n/g, '\n');
  return [...normalized.matchAll(/(?:^|\n)(---\n[\s\S]*?\n---\n[\s\S]*?)(?=\n---\ncontract_version:|$)/g)]
    .map(match => match[1].trimEnd());
}
function pageNumber(page) {
  return Number(page.match(/^page_number:\s*(\d+)\s*$/m)?.[1]);
}
function scalar(page, key) {
  return String(page.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))?.[1] || '')
    .trim().replace(/^["']|["']$/g, '');
}
function section(page, name, nextName = null) {
  const end = nextName ? `(?=\\n##\\s*${nextName})` : '$';
  return page.match(new RegExp(`##\\s*${name}\\s*\\n([\\s\\S]*?)${end}`, 'i'))?.[1]?.trim() || '';
}
function safeName(value) {
  return basename(value).replace(/[^\p{L}\p{N}._-]+/gu, '-') || 'image';
}
function copyAsset(source, assetsDir, pageNumber, outputPath) {
  if (!existsSync(source)) return null;
  const pageDir = resolve(assetsDir, `page-${String(pageNumber).padStart(2, '0')}`);
  mkdirSync(pageDir, { recursive: true });
  let destination = resolve(pageDir, safeName(source));
  for (let index = 2; existsSync(destination); index++) {
    const name = safeName(source);
    const dot = name.lastIndexOf('.');
    destination = resolve(pageDir, dot > 0 ? `${name.slice(0, dot)}-${index}${name.slice(dot)}` : `${name}-${index}`);
  }
  copyFileSync(source, destination);
  return relative(dirname(outputPath), destination).split('\\').join('/');
}
function localizeImages(markdown, copyPath, assetsDir, pageNumber, outputPath) {
  return String(markdown).replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (whole, alt, rawTarget) => {
    const target = rawTarget.trim().replace(/^<|>$/g, '');
    if (/^https?:\/\//i.test(target)) return whole;
    const localized = copyAsset(resolve(dirname(copyPath), target), assetsDir, pageNumber, outputPath);
    return localized ? `![${alt}](${localized})` : whole;
  });
}
function assetSection(attachments, feedbackPath, assetsDir, pageNumber, outputPath) {
  if (!attachments.length) return '';
  const lines = ['## Page Assets', ''];
  for (const asset of attachments) {
    const source = asset.url ? resolve(dirname(feedbackPath), asset.url) : null;
    const path = source ? copyAsset(source, assetsDir, pageNumber, outputPath) : null;
    if (!path) continue;
    lines.push(`![${asset.alt || '页面图片'}](${path})`);
    if ((asset.caption || '').trim()) lines.push('', `*${asset.caption.trim()}*`);
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

const args = argsOf(process.argv.slice(2));
for (const key of ['--copy', '--audit', '--feedback', '--output', '--assets-dir']) {
  if (!args[key]) throw new Error(`缺少 ${key}`);
}
const copyPath = resolve(args['--copy']);
const auditPath = resolve(args['--audit']);
const feedbackPath = resolve(args['--feedback']);
const outputPath = resolve(args['--output']);
const assetsDir = resolve(args['--assets-dir']);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const auditValidation = spawnSync(process.execPath, [
  resolve(scriptDir, 'validate-fact-audit.mjs'),
  '--audit', auditPath, '--copy', copyPath, '--allow-human-review', 'true',
], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
if (auditValidation.status !== 0) {
  throw new Error(`事实语义核验无效，不能生成交付物：${auditValidation.stdout || auditValidation.stderr}`);
}
const feedbackValidation = spawnSync(process.execPath, [
  resolve(scriptDir, 'validate-copy-review-feedback.mjs'),
  '--feedback', feedbackPath, '--copy', copyPath, '--audit', auditPath, '--kind', 'final',
], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
if (feedbackValidation.status !== 0) {
  throw new Error(`终稿反馈无效，不能生成交付物：${feedbackValidation.stdout || feedbackValidation.stderr}`);
}
const pages = splitPages(readFileSync(copyPath, 'utf8'));
const feedback = JSON.parse(readFileSync(feedbackPath, 'utf8'));
if (feedback.overall_decision !== 'approve') throw new Error('终稿仍有修改项，不能生成交付物');
const decisions = new Map((feedback.decisions || []).map(item => [item.page_number, item]));
if (pages.length === 0) throw new Error('Copy 中没有可解析页面');
const outputPages = pages.map(page => {
  const number = pageNumber(page);
  const attachments = decisions.get(number)?.attachments || [];
  const title = scalar(page, 'page_title') || `第 ${number} 页`;
  const claim = scalar(page, 'main_claim');
  const visibleCopy = localizeImages(
    section(page, 'Page Content', 'Production Notes'),
    copyPath,
    assetsDir,
    number,
    outputPath,
  );
  const assetMarkdown = assetSection(attachments, feedbackPath, assetsDir, number, outputPath);
  return [
    `## P${String(number).padStart(2, '0')}｜${title}`,
    '',
    claim ? `> ${claim}` : '',
    '',
    visibleCopy,
    assetMarkdown ? `\n${assetMarkdown}` : '',
  ].filter((line, index, values) => line !== '' || values[index - 1] !== '').join('\n').trim();
});
mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(assetsDir, { recursive: true });
writeFileSync(outputPath, `# 提案逐页内容稿\n\n${outputPages.join('\n\n---\n\n')}\n`);
process.stdout.write(`${JSON.stringify({
  valid: true,
  pages: outputPages.length,
  pages_with_assets: (feedback.decisions || []).filter(item => (item.attachments || []).length > 0).length,
  output: outputPath,
})}\n`);
