#!/usr/bin/env node
import { resolve } from 'node:path';
import { validateFile, parseArtifact } from './lib/contract-validation.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i]] = process.argv[i + 1];
const input = args['--input'];
if (!input) process.exit(2);
const result = validateFile(resolve(input), resolve(import.meta.dirname, '../contracts/lens-extraction.schema.json'));
if (result.valid) {
  const ids = new Set();
  for (const record of parseArtifact(resolve(input)).records) {
    for (const item of record.results) {
      if (ids.has(item.result_id)) result.errors.push(`重复 result_id：${item.result_id}`);
      ids.add(item.result_id);
      const shouldHaveLens = ['lens_candidate', 'new_module_candidate'].includes(item.terminal_state);
      if (shouldHaveLens !== (item.lens !== null)) result.errors.push(`${item.result_id}: terminal_state 与 lens 是否为空不一致`);
      if (item.lens && (!item.lens.abstraction_check.passed || item.lens.abstraction_check.project_residue.length)) result.errors.push(`${item.result_id}: 项目残留未清零，不能进入候选`);
    }
  }
  if (args['--units']) {
    const units = parseArtifact(resolve(args['--units'])).records;
    const expected = new Set(units.map(unit => unit.unit_id));
    const records = parseArtifact(resolve(input)).records;
    const actual = new Set(records.map(record => record.source_unit_id));
    for (const id of expected) if (!actual.has(id)) result.errors.push(`缺少语义单元提取记录：${id}`);
    for (const id of actual) if (!expected.has(id)) result.errors.push(`未知 source_unit_id：${id}`);
    for (const record of records) {
      const unit = units.find(item => item.unit_id === record.source_unit_id);
      const allowedPages = new Set((unit?.pages || []).map(page => page.page_id));
      for (const item of record.results) for (const pageId of item.source_page_ids) if (!allowedPages.has(pageId)) result.errors.push(`${item.result_id}: 引用了语义单元外页面 ${pageId}`);
    }
  }
}
result.valid = result.errors.length === 0;
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exit(result.valid ? 0 : 1);
