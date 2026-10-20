#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {moduleScript} from './lib/planners-modules.mjs';
const args = {};
for (let i=2;i<process.argv.length;i+=2) args[process.argv[i]]=process.argv[i+1];
if (!['--review-dir','--task-id','--revision','--source-hash'].every(k=>args[k])) throw Error('用法：--review-dir <目录> --task-id <id> --revision <处理前 revision> --source-hash <处理前 source_hash>');
const path = resolve(args['--review-dir'],'review-surface.json');
const data = JSON.parse(readFileSync(path,'utf8'));
const surface = {dir:resolve(dirname(path),data.dir),projectRoot:resolve(dirname(path),data.project_root)};
const {runContentCommand} = await import(pathToFileURL(moduleScript('planners-review-core','scripts/content-workbench.mjs')));
const result = await runContentCommand(surface,{op:'resolve',task_ids:[args['--task-id']],base_revision:args['--revision'],source_hash:args['--source-hash']});
console.log(JSON.stringify(result));
if (!result.ok) process.exitCode=1;
