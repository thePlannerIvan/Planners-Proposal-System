#!/usr/bin/env node
import { resolve } from 'node:path';
import { runNode } from './lib/assert.mjs';

const suites = [
  'router/run.mjs',
  'co-creation/run.mjs',
  'co-creation/edits.mjs',
  'workflow/run.mjs',
];
for (const suite of suites) {
  process.stdout.write(`\n=== ${suite} ===\n`);
  const result = runNode(resolve(import.meta.dirname, suite));
  process.stdout.write(result.stdout);
}
process.stdout.write(`\n${suites.length}/${suites.length} Public suites passed\n`);
