#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i]] = process.argv[i + 1];
if (!args['--report'] || !args['--page-manifest']) process.exit(2);
const report = JSON.parse(readFileSync(resolve(args['--report']), 'utf8'));
const pages = readFileSync(resolve(args['--page-manifest']), 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
const errors = [];
if (report.blockers?.length) errors.push(...report.blockers);
if (report.pages !== pages.length) errors.push('report.pages 与 page-manifest 数量不一致');
for (const page of pages) if (page.normalization_state !== 'ready' || !page.text_path || !page.text_sha256) errors.push(`${page.page_id}: 页面不可读取或不可定位`);
process.stdout.write(`${JSON.stringify({ valid: errors.length === 0, records: pages.length, errors })}\n`);
process.exit(errors.length ? 1 : 0);
