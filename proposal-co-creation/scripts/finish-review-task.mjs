#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {moduleScript} from './lib/planners-modules.mjs';
const args = {};
for (let i=2;i<process.argv.length;i+=2) args[process.argv[i]]=process.argv[i+1];
// --revision / --source-hash 仍是可选兼容项：resolve 已不再要求整份文件基线一致，
// 只按任务与页绑定判断，stale_pages 仅作提示。
if (!['--review-dir','--task-id'].every(k=>args[k])) throw Error('用法：--review-dir <目录> --task-id <id> [--revision <兼容项，可省略>] [--source-hash <兼容项，可省略>]');
const path = resolve(args['--review-dir'],'review-surface.json');
const data = JSON.parse(readFileSync(path,'utf8'));
const surface = {dir:resolve(dirname(path),data.dir),projectRoot:resolve(dirname(path),data.project_root)};
const {runContentCommand} = await import(pathToFileURL(moduleScript('planners-review-core','scripts/content-workbench.mjs')));
const command = {op:'resolve',task_ids:[args['--task-id']]};
if (args['--revision'] !== undefined) command.base_revision = args['--revision'];
if (args['--source-hash'] !== undefined) command.source_hash = args['--source-hash'];
const result = await runContentCommand(surface,command);
console.log(JSON.stringify(result));
if (!result.ok) process.exitCode=1;
