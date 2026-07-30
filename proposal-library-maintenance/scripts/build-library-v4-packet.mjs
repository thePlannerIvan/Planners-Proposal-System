#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { parseArtifact } from './lib/contract-validation.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i]] = process.argv[i + 1];
const stageTypes = { B2: 'semantic_unit_planning', B3a: 'recipe_discovery', B3b: 'lens_extraction', B3c: 'library_curation', B3d: 'wiki_alignment', B6: 'utility_test' };
for (const key of ['--stage', '--inputs', '--instruction', '--schema', '--output']) if (!args[key]) throw new Error(`Missing ${key}`);
if (!stageTypes[args['--stage']]) throw new Error('--stage 必须是 B2/B3a/B3b/B3c/B3d/B6');
const hash = value => createHash('sha256').update(value).digest('hex');
const inputs = args['--inputs'].split(',').map(value => resolve(value.trim())).map(path => {
  const raw = readFileSync(path, 'utf8');
  try {
    const parsed = parseArtifact(path);
    return { name: basename(path), sha256: hash(raw), format: parsed.format, records: parsed.records };
  } catch {
    return { name: basename(path), sha256: hash(raw), format: 'text', text: raw };
  }
});
const instructionPath = resolve(args['--instruction']);
const schemaPath = resolve(args['--schema']);
const instruction = readFileSync(instructionPath, 'utf8');
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const core = { stage: args['--stage'], task_type: stageTypes[args['--stage']], task_guide_zh: instruction, inputs, output_contract: schema };
const body = JSON.stringify(core);
const output = resolve(args['--output']);
mkdirSync(dirname(output), { recursive: true });
const packet = {
  contract_version: '2.0.0',
  task_id: `task_${hash(body).slice(0, 24)}`,
  input_sha256: hash(body),
  ...core,
  execution_rules_zh: [
    '只完成当前阶段，不提前完成后续阶段。',
    '语义判断由模型完成；脚本与 Contract 只校验结构和可追溯性。',
    '所有语义字段使用中文；不确定时如实使用允许的终态，禁止补造。',
    '输出只能是符合 output_contract 的 JSON 或 JSONL，不要输出解释性前后缀。'
  ]
};
writeFileSync(output, `${JSON.stringify(packet, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ valid: true, stage: args['--stage'], task_id: packet.task_id, output })}\n`);
