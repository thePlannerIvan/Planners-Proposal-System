import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {assert,jsonOutput,runNode,pass} from '../lib/assert.mjs';
import {moduleScript} from '../../proposal-co-creation/scripts/lib/planners-modules.mjs';
const root = resolve(import.meta.dirname,'../../proposal-co-creation');
const run = (script,args) => jsonOutput(runNode(join(root,'scripts',script),args));
for (const opaque of [false,true]) {
  const dir = mkdtempSync(join(tmpdir(),'proposal-edit-')), architecture = join(dir,'architecture.json'), reviewDir = join(dir,'review');
  const fixture = JSON.parse(readFileSync(join(root,'templates/page-architecture.json'),'utf8'));
  fixture.pages.push({...structuredClone(fixture.pages[0]),page_number:2,section_id:fixture.sections[1].section_id,title_intent:'Second page'});
  writeFileSync(architecture,JSON.stringify(fixture,null,2));
  const surface = run('start-page-review.mjs',['--architecture',architecture,'--review-dir',reviewDir,'--surface-only']).surface;
  const browser = spawnSync(process.env.PLAYWRIGHT_PYTHON || 'python3',[moduleScript('planners-review-core','evals/exercise-content-review.py'),'--surface',surface,...(opaque ? ['--opaque'] : [])],{encoding:'utf8'});
  assert(browser.status === 0,'browser behavior: '+browser.stdout+browser.stderr);
  const result = run('review-inbox.mjs',['--surface',surface]);
  assert(result.ok && result.content_changed,'Human changes must apply');
  const actual = JSON.parse(readFileSync(architecture,'utf8'));
  assert(actual.storyline_thesis === 'Human thesis' && actual.sections[1].title === 'Human chapter','Chapter and thesis edits reach native structure');
  assert(actual.pages[1].title_intent === 'Human "title"' && actual.pages[1].content_blocks[0].content_requirement === 'Human expanded block','Page/block edits and order reach native structure');
  assert(run('validate-page-architectures.mjs',[architecture]).valid,'Edited architecture contract remains valid');
  assert(run('validate-page-review-feedback.mjs',['--feedback',join(reviewDir,'review-feedback.json'),'--architecture',architecture]).valid,'Approval binds to human-edited source');
  assert(run('review-inbox.mjs',['--surface',surface]).skipped,'Duplicate intake is idempotent');
  run('start-page-review.mjs',['--architecture',architecture,'--review-dir',reviewDir,'--surface-only']);
}
pass('正式 Proposal 编辑/拖动 → 原生结构 → 批准绑定；HTTP 与不透明 iframe');
