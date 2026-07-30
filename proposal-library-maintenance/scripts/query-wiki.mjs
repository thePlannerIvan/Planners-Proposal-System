#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) values[argv[index]] = argv[index + 1];
  return values;
}
function textOf(lens, module) {
  return [
    module.module_id, module.title, lens.lens_id, lens.name, lens.question,
    ...(lens.aliases || []), ...(lens.use_conditions || []), ...(lens.required_inputs || []),
    ...(lens.analysis_operations || []), ...(lens.output_types || []), ...(lens.boundaries || []),
  ].filter(Boolean).join('\n').toLowerCase();
}
function termsOf(query) {
  return [...new Set(String(query).toLowerCase().split(/[\s,，、；;|/]+/).map(item => item.trim()).filter(Boolean))];
}

const args = parseArgs(process.argv.slice(2));
if (!args['--query']) {
  process.stderr.write('用法：query-wiki.mjs --query <问题或关键词> [--wiki-dir <目录>] [--limit 5]\n');
  process.exit(2);
}
const wikiDir = resolve(args['--wiki-dir'] || resolve(import.meta.dirname, '../base-wiki'));
const limit = args['--limit'] === undefined ? 5 : Number(args['--limit']);
if (!Number.isInteger(limit) || limit < 1 || limit > 12) {
  process.stderr.write('--limit 必须为 1–12；生产共创默认只读取 5 个结果\n');
  process.exit(2);
}
const indexPath = join(wikiDir, 'wiki-index.json');
if (!existsSync(indexPath)) {
  process.stderr.write(`Wiki 不存在：${wikiDir}\n`);
  process.exit(2);
}
const index = JSON.parse(readFileSync(indexPath, 'utf8'));
const moduleFiles = Array.isArray(index.modules)
  ? index.modules.map(item => item.path || item.file || (item.module_id ? `modules/${item.module_id}.json` : null)).filter(Boolean)
  : [];
const terms = termsOf(args['--query']);
const results = [];
for (const relativePath of moduleFiles) {
  const modulePath = resolve(wikiDir, relativePath);
  if (!modulePath.startsWith(`${wikiDir}/`) || !existsSync(modulePath)) continue;
  const module = JSON.parse(readFileSync(modulePath, 'utf8'));
  for (const lens of module.lens_catalog || []) {
    const haystack = textOf(lens, module);
    const matched = terms.filter(term => haystack.includes(term));
    const score = matched.reduce((total, term) => total + (haystack.split(term).length - 1), 0);
    if (!score) continue;
    results.push({
      score,
      matched_terms: matched,
      module_id: module.module_id,
      module_name_zh: module.title,
      lens_id: lens.lens_id,
      name_zh: lens.name,
      question_zh: lens.question,
      use_conditions: lens.use_conditions || [],
      analysis_operations: lens.analysis_operations || [],
      output_types: lens.output_types || [],
      boundaries: lens.boundaries || [],
      page_structure: lens.page_structure || [],
      source_path: relativePath,
    });
  }
}
results.sort((a, b) => b.score - a.score || a.lens_id.localeCompare(b.lens_id));
process.stdout.write(`${JSON.stringify({
  query: args['--query'],
  terms,
  limit,
  returned: Math.min(limit, results.length),
  results: results.slice(0, limit),
  note_zh: '只读检索结果用于刺激问题定义或论述结构；不得替代项目资料生成答案。',
}, null, 2)}\n`);
