import {mkdtempSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {assert,jsonOutput,pass,runNode} from '../lib/assert.mjs';
import {moduleScript} from '../../proposal-co-creation/scripts/lib/planners-modules.mjs';

// 新工作台 UI 的真实浏览器验收：行内编辑、行内批注卡、悬停拖动把手、按页自动保存、
// 以及「模型改了这一页 → 冲突卡 → 保留我的」这条按页协议链路。HTTP 与不透明 iframe 各跑一遍。
const root = resolve(import.meta.dirname, '../..');
const python = process.env.PLAYWRIGHT_PYTHON || 'python3';
const template = JSON.parse(readFileSync(resolve(root, 'proposal-co-creation/templates/page-architecture.json'), 'utf8'));
template.pages.push({...structuredClone(template.pages[0]), page_number: 2, claim: '第二页主张'});
const quote = value => "'" + String(value).replace(/'/g, "'\\''") + "'";

function buildFixture(name) {
  const dir = mkdtempSync(join(tmpdir(), `proposal-workbench-ui-${name}-`));
  const architecture = join(dir, 'architecture.json'), reviewDir = join(dir, 'review');
  writeFileSync(architecture, JSON.stringify(template, null, 2));
  const surface = jsonOutput(runNode(resolve(root, 'proposal-co-creation/scripts/start-page-review.mjs'), [
    '--architecture', architecture, '--review-dir', reviewDir, '--surface-only',
  ])).surface;
  return {dir, architecture, reviewDir, surface};
}

const first = buildFixture('http');
// 离线（没有桥）与握手超时（桥不 resolve）都必须在握手之前把工作台画出来
const rendered = spawnSync(python, [moduleScript('planners-review-core', 'evals/check-content-render.py'),
  '--html', join(first.reviewDir, 'index.html')], {encoding: 'utf8'});
assert(rendered.status === 0, '工作台离线及握手超时渲染', rendered.stdout + rendered.stderr);

// 钩子模拟「模型只改了第一页」；随后浏览器流程会在同一页上制造一次 deferred 冲突。
function hookCommand(fixture) {
  const hookScript = join(fixture.dir, 'model-edit.cjs');
  writeFileSync(hookScript, [
    "const {readFileSync, writeFileSync} = require('fs');",
    'const file = process.argv[2];',
    "const doc = JSON.parse(readFileSync(file, 'utf8'));",
    "doc.pages[0].supports.push('模型补充的验证要求');",
    'writeFileSync(file, JSON.stringify(doc, null, 2));',
  ].join('\n'));
  return [process.execPath, hookScript, fixture.architecture].map(quote).join(' ');
}

for (const opaque of [false, true]) {
  const fixture = opaque ? buildFixture('opaque') : first;
  const args = [moduleScript('planners-review-core', 'evals/exercise-content-review.py'), '--surface', fixture.surface];
  if (opaque) args.push('--opaque');
  else args.push('--hook-cmd', hookCommand(fixture));
  const browser = spawnSync(python, args, {encoding: 'utf8'});
  assert(browser.status === 0, `${opaque ? '不透明 iframe' : 'HTTP'} 新工作台真实浏览器行为`, browser.stdout + browser.stderr);

  const head = JSON.parse(readFileSync(join(fixture.reviewDir, 'workbench/head.json'), 'utf8'));
  const pending = (head.tasks ?? []).filter(task => task.status === 'pending');
  assert(pending.some(task => task.scope === 'page' && Array.isArray(task.page_keys) && task.page_keys.length),
    '行内批注卡必须提交按页绑定的任务', JSON.stringify(pending));
  assert(pending.some(task => task.scope === 'annotations' && task.page_hashes && Object.keys(task.page_hashes).length),
    '#pageTaskButton 必须提交带页指纹的 annotations 任务', JSON.stringify(pending));
  assert(pending.every(task => typeof task.created_at === 'string'), '任务必须带 created_at', JSON.stringify(pending));
  assert(JSON.stringify(head.deferred?.pages) === '[]', '「保留我的」之后 deferred 必须清空', JSON.stringify(head.deferred));
  assert(JSON.stringify(head.state.page_order) === '[2,1]', '拖动排序必须写进 head', JSON.stringify(head.state.page_order));
  assert(head.page_mapping['1'] === 2 && head.page_mapping['2'] === 1, '排序后页映射必须跟随', JSON.stringify(head.page_mapping));
  assert(head.page_versions['1'] > 0, '人的编辑必须累计页版本', JSON.stringify(head.page_versions));

  const actual = JSON.parse(readFileSync(fixture.architecture, 'utf8'));
  assert(actual.pages.length === 2, '主稿页数不变');
  assert(actual.pages[0].claim === '第二页主张', '拖动后第 1 页应是原来的第 2 页', JSON.stringify(actual.pages.map(p => p.claim)));
  // 只有 HTTP 那一轮跑了「模型改页 → 冲突卡 → 保留我的」；opaque 轮验证的是传输层。
  assert(actual.pages[1].claim === (opaque ? 'Human "title"' : 'After model update'),
    '第一页的标题编辑必须落盘', JSON.stringify(actual.pages[1].claim));
  assert(actual.pages[1].supports[0] === 'Human expanded support', '行内支撑修改必须落盘', JSON.stringify(actual.pages[1].supports));
  assert(actual.pages[1].notes === 'Human content notes', '行内注记修改必须落盘', actual.pages[1].notes);
  assert(actual.storyline_thesis === 'Human thesis', '核心判断必须可改', actual.storyline_thesis);
  assert(actual.sections[0].title === 'Human chapter', '章节标题必须可改', actual.sections[0].title);
  assert(!existsSync(join(fixture.reviewDir, 'review-submissions.json')), '工作台保存不是 legacy 提交');
  if (!opaque) assert(!existsSync(join(fixture.reviewDir, 'wake-log.jsonl')), 'HTTP 工作台保存不应唤醒模型');
}
pass('新工作台 UI：行内编辑/批注、悬停拖动、按页自动保存、冲突卡与保留我的、离线渲染；HTTP 与不透明 iframe');
