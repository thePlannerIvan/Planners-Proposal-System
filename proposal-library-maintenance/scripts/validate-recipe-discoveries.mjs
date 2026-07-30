#!/usr/bin/env node
import { resolve } from 'node:path';
import { validateFile, parseArtifact } from './lib/contract-validation.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i]] = process.argv[i + 1];
const input = args['--input'];
if (!input) process.exit(2);
const schema = resolve(import.meta.dirname, '../contracts/recipe-discovery.schema.json');
const result = validateFile(resolve(input), schema);
if (result.valid) {
  for (const record of parseArtifact(resolve(input)).records) {
    for (const recipe of record.recipes) {
      const indices = recipe.steps.map(step => step.step_index);
      if (indices.some((value, index) => value !== index + 1)) result.errors.push(`${recipe.recipe_id}: step_index 必须从 1 连续递增`);
      const sources = new Set(recipe.source_unit_ids);
      for (const step of recipe.steps) for (const id of step.source_unit_ids) if (!sources.has(id)) result.errors.push(`${recipe.recipe_id}: 步骤引用了 Recipe 外的语义单元 ${id}`);
    }
  }
  if (args['--units']) {
    const expected = new Set(parseArtifact(resolve(args['--units'])).records.map(unit => unit.source_record_id));
    const actual = new Set(parseArtifact(resolve(input)).records.map(record => record.source_record_id));
    for (const id of expected) if (!actual.has(id)) result.errors.push(`缺少 Deck Recipe 记录：${id}；零 Recipe 也必须输出记录`);
    for (const id of actual) if (!expected.has(id)) result.errors.push(`未知 source_record_id：${id}`);
  }
}
result.valid = result.errors.length === 0;
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exit(result.valid ? 0 : 1);
