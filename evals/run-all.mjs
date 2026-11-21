#!/usr/bin/env node
import { resolve } from 'node:path';
import { runNode } from './lib/assert.mjs';

const suites = [
  'co-creation/storyline-doc.mjs',
  '../scripts/lib/planners-modules-install.test.mjs',
];
for (const suite of suites) {
  process.stdout.write(`\n=== ${suite} ===\n`);
  const args = suite.endsWith('.test.mjs') ? ['--test', resolve(import.meta.dirname, suite)] : [resolve(import.meta.dirname, suite)];
  const result = runNode(args[0], args.slice(1));
  process.stdout.write(result.stdout);
}
process.stdout.write(`\n${suites.length}/${suites.length} planners-proposal suites passed\n`);
