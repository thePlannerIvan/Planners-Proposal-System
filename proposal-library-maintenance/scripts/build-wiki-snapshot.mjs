#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i]] = process.argv[i + 1];
if (!args['--wiki-dir'] || !args['--output']) throw new Error('用法：build-wiki-snapshot.mjs --wiki-dir <active Wiki> --output <snapshot.json>');
const wiki = resolve(args['--wiki-dir']);
const hash = value => createHash('sha256').update(value).digest('hex');
const files = ['wiki-index.json', ...readdirSync(join(wiki, 'modules')).filter(name => name.endsWith('.json')).sort().map(name => `modules/${name}`)];
try { readFileSync(join(wiki, 'wiki-recipes.json')); files.push('wiki-recipes.json'); } catch {}
const artifacts = files.map(path => {
  const raw = readFileSync(join(wiki, path), 'utf8');
  return { path, sha256: hash(raw), content: JSON.parse(raw) };
});
const output = resolve(args['--output']);
writeFileSync(output, `${JSON.stringify({ contract_version: '1.0.0', wiki_root_sha256: hash(artifacts.map(item => `${item.path}:${item.sha256}`).join('\n')), artifacts }, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ valid: true, files: artifacts.length, output })}\n`);
