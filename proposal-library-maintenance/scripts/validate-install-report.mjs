#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const input = process.argv[2];
if (!input) process.exit(2);
try {
  const report = JSON.parse(readFileSync(resolve(input), 'utf8'));
  const valid = report.contract_version === '1.0.0'
    && typeof report.installed_at === 'string'
    && Array.isArray(report.touched_modules)
    && Array.isArray(report.decisions)
    && report.integrity?.valid === true
    && Array.isArray(report.integrity?.errors)
    && report.integrity.errors.length === 0;
  process.stdout.write(`${JSON.stringify({ valid, records: 1, errors: valid ? [] : ['安装报告字段不完整或 Wiki 引用图未通过完整性检查'] })}\n`);
  process.exit(valid ? 0 : 1);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ valid: false, records: 0, errors: [error.message] })}\n`);
  process.exit(2);
}
