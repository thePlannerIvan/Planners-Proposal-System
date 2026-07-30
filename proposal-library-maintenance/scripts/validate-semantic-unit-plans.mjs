#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateFile, parseArtifact } from './lib/contract-validation.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i]] = process.argv[i + 1];
if (!args['--plans'] || !args['--page-manifest']) process.exit(2);
const plansPath = resolve(args['--plans']);
const result = validateFile(plansPath, resolve(import.meta.dirname, '../contracts/semantic-unit-plan.schema.json'));
if (result.valid) {
  const pages = readFileSync(resolve(args['--page-manifest']), 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const byRecord = new Map();
  for (const page of pages) {
    if (!byRecord.has(page.source_record_id)) byRecord.set(page.source_record_id, []);
    byRecord.get(page.source_record_id).push(page);
  }
  for (const plan of parseArtifact(plansPath).records) {
    const source = byRecord.get(plan.source_record_id) || [];
    const sourceIds = new Set(source.map(page => page.page_id));
    const seen = new Set();
    if (plan.page_count !== source.length) result.errors.push(`${plan.source_record_id}: page_count 应为 ${source.length}`);
    for (const unit of plan.units) {
      if (unit.page_ids.length !== unit.page_numbers.length) result.errors.push(`${unit.unit_id}: page_ids 与 page_numbers 数量不一致`);
      for (const id of unit.support_page_ids || []) if (!unit.page_ids.includes(id)) result.errors.push(`${unit.unit_id}: support_page_ids 必须是本单元 page_ids 的子集`);
      unit.page_ids.forEach((id, index) => {
        const page = source.find(candidate => candidate.page_id === id && candidate.page_number === unit.page_numbers[index]);
        if (!page) result.errors.push(`${unit.unit_id}: 未知页 ${id}/${unit.page_numbers[index]}`);
        if (seen.has(id)) result.errors.push(`${plan.source_record_id}: 页面重复分配 ${id}`);
        seen.add(id);
      });
    }
    for (const item of plan.discarded_pages) {
      if (!sourceIds.has(item.page_id)) result.errors.push(`${plan.source_record_id}: 未知排除页 ${item.page_id}`);
      if (seen.has(item.page_id)) result.errors.push(`${plan.source_record_id}: 页面重复分配 ${item.page_id}`);
      seen.add(item.page_id);
    }
    if (seen.size !== source.length) result.errors.push(`${plan.source_record_id}: 页面覆盖 ${seen.size}/${source.length}`);
  }
}
result.valid = result.errors.length === 0;
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exit(result.valid ? 0 : 1);
