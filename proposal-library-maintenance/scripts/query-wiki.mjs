#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { moduleScript } from '../../proposal-co-creation/scripts/lib/planners-modules.mjs';

// Keep legacy callers working without keeping a second library or implementation.
try {
  const script = moduleScript('planners-method-wiki', 'scripts/query-wiki.mjs');
  const result = spawnSync(process.execPath, [script, ...process.argv.slice(2)], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
}
