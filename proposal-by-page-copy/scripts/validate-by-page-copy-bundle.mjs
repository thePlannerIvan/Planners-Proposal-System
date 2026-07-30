#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CONTRACT = 'by-page-copy-bundle/2.0.0';
function output(valid, records, errors, code = null) {
  process.stdout.write(`${JSON.stringify({ contract: CONTRACT, valid, records, errors })}\n`);
  process.exit(code ?? (valid ? 0 : 1));
}
function scalar(frontmatter, key) {
  return String(frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))?.[1] || '')
    .trim().replace(/^["']|["']$/g, '');
}
function splitPages(content) {
  return [...content.replace(/\r\n/g, '\n').matchAll(/(?:^|\n)---\n([\s\S]*?)\n---\n([\s\S]*?)(?=\n---\ncontract_version:|$)/g)]
    .map(match => ({ frontmatter: match[1], body: match[2] }));
}
function section(body, name, nextName = null) {
  const end = nextName ? `(?=\\n##\\s*${nextName})` : '$';
  return body.match(new RegExp(`##\\s*${name}\\s*\\n([\\s\\S]*?)${end}`, 'i'))?.[1]?.trim() || '';
}
const [input, ...rest] = process.argv.slice(2);
if (!input || rest.length) output(false, 0, [{ page: null, code: 'arg_error', message: '用法：validate-by-page-copy-bundle.mjs <proposal-draft.md>' }], 2);
let raw;
try {
  raw = readFileSync(resolve(input), 'utf8');
} catch (error) {
  output(false, 0, [{ page: null, code: 'file_error', message: error.message }], 2);
}
const pages = splitPages(raw);
const errors = [];
if (!pages.length) errors.push({ page: null, code: 'min_pages', message: '至少需要一页' });
pages.forEach(({ frontmatter, body }, index) => {
  const expected = index + 1;
  const number = Number(scalar(frontmatter, 'page_number'));
  if (scalar(frontmatter, 'contract_version') !== '2.0.0') errors.push({ page: number || null, code: 'contract_version', message: 'contract_version 必须为 2.0.0' });
  if (number !== expected) errors.push({ page: number || null, code: 'page_number_sequence', message: `第 ${expected} 个页面的 page_number 应为 ${expected}` });
  for (const field of ['section_id', 'page_title', 'main_claim']) {
    if (!scalar(frontmatter, field)) errors.push({ page: number || null, code: 'missing_field', field, message: `${field} 不能为空` });
  }
  const content = section(body, 'Page Content', 'Production Notes');
  if (!content) errors.push({ page: number || null, code: 'empty_content', message: 'Page Content 不能为空' });
  if (/(?:待补充|待定|待确认|放图|做表格)|\b(?:TBD|TODO|XX+)\b/i.test(content)) errors.push({ page: number || null, code: 'placeholder_content', message: 'Page Content 仍含占位语，必须补齐或明确删除' });
  if (!/^##\s+Production Notes\s*$/mi.test(body)) errors.push({ page: number || null, code: 'missing_section', message: '缺少 Production Notes' });
});
output(errors.length === 0, pages.length, errors);
