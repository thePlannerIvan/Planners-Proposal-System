#!/usr/bin/env node
import { resolve } from 'node:path';
import { validateFile, parseArtifact } from './lib/contract-validation.mjs';
const input = process.argv[2];
if (!input) process.exit(2);
const result = validateFile(resolve(input), resolve(import.meta.dirname, '../contracts/utility-test.schema.json'));
if (result.valid) {
  const record = parseArtifact(resolve(input)).records[0];
  if (record.status === 'tested' && !record.brief_id) result.errors.push('tested 必须提供真实 brief_id');
  if (record.status === 'pending_input' && record.conclusion_zh.includes('已验证')) result.errors.push('pending_input 不能声称已验证');
}
result.valid = result.errors.length === 0;
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exit(result.valid ? 0 : 1);
