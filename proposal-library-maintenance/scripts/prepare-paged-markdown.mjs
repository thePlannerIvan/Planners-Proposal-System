#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i]] = process.argv[i + 1];
for (const key of ['--text-root', '--corpus-id', '--output-dir']) if (!args[key]) {
  process.stderr.write('用法：prepare-paged-markdown.mjs --text-root <分页 Markdown 目录> --corpus-id <id> --output-dir <目录>\n');
  process.exit(2);
}
const root = resolve(args['--text-root']);
const out = resolve(args['--output-dir']);
if (!existsSync(root)) throw new Error(`目录不存在：${root}`);
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) files.push(full);
  }
}
walk(root);
files.sort();
if (!files.length) throw new Error('没有找到 Markdown；先用 PDF/PPTX 读取工具生成保留分页的 Markdown');
const sha = value => createHash('sha256').update(value).digest('hex');
const corpus = [];
const pages = [];
const blockers = [];
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const rel = relative(root, file).split('\\').join('/');
  const parts = content.split('\f');
  if (parts.length === 1 && Buffer.byteLength(content) > 12000) blockers.push(`${rel}: 超过 12000 字节但没有换页符 \\f`);
  const recordId = `cr_${sha(`${args['--corpus-id']}:${rel}:${sha(content)}`).slice(0, 24)}`;
  corpus.push({ contract_version: '1.0.0', record_id: recordId, corpus_id: args['--corpus-id'], relative_path: rel, format: 'md', source_sha256: sha(content), page_count: parts.length, processing_state: 'ready' });
  parts.forEach((text, index) => pages.push({
    contract_version: '1.0.0',
    page_id: `pg_${sha(`${recordId}:${index + 1}`).slice(0, 24)}`,
    corpus_id: args['--corpus-id'],
    source_record_id: recordId,
    source_sha256: sha(content),
    page_number: index + 1,
    page_count: parts.length,
    boundary_method: parts.length > 1 ? 'form_feed' : 'explicit_single_page',
    text_path: rel,
    text_sha256: sha(text),
    char_count: text.length,
    visual_status: 'not_checked',
    normalization_state: 'ready',
    warnings: []
  }));
}
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'corpus-manifest.jsonl'), `${corpus.map(JSON.stringify).join('\n')}\n`);
writeFileSync(join(out, 'page-manifest.jsonl'), `${pages.map(JSON.stringify).join('\n')}\n`);
writeFileSync(join(out, 'b1-report.json'), `${JSON.stringify({ contract_version: '1.0.0', files: files.length, pages: pages.length, blockers }, null, 2)}\n`);
if (blockers.length) {
  process.stderr.write(`${blockers.join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`${JSON.stringify({ valid: true, files: files.length, pages: pages.length, output_dir: out })}\n`);
