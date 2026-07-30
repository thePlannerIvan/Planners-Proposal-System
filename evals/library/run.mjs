import {
  mkdtempSync, readFileSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { assert, jsonOutput, pass, runNode } from '../lib/assert.mjs';

const root = resolve(import.meta.dirname, '../..');
const skillRoot = resolve(root, 'proposal-library-maintenance');
const dispatcher = resolve(skillRoot, 'scripts/library-dispatch.mjs');

const bootstrap = mkdtempSync(join(tmpdir(), 'proposal-library-bootstrap-'));
const bootstrapIntent = join(bootstrap, 'intent.json');
writeFileSync(bootstrapIntent, `${JSON.stringify({
  contract_version: '1.0.0',
  route: 'isolated_bootstrap',
  active_wiki: null,
  selected_by: 'human',
  selected_at: '2026-07-29T12:00:00Z',
})}\n`);
const started = jsonOutput(runNode(dispatcher, ['--run-dir', join(bootstrap, 'run'), '--action', 'start', '--intent-file', bootstrapIntent]));
assert(started.current_stage === 'B1', '新建路线必须从 B1 开始');
assert(started.current_instruction.task_zh.includes('准备可信的分页语料'), 'Dispatcher 必须直接披露完整 Stage');
assert(started.current_instruction.required_validator === 'validate-b1-output.mjs', 'Dispatcher 必须披露强制 Validator');

const upgrade = mkdtempSync(join(tmpdir(), 'proposal-library-upgrade-'));
const upgradeIntent = join(upgrade, 'intent.json');
writeFileSync(upgradeIntent, `${JSON.stringify({
  contract_version: '1.0.0',
  route: 'upgrade_existing',
  active_wiki: resolve(skillRoot, 'base-wiki'),
  selected_by: 'human',
  selected_at: '2026-07-29T12:00:00Z',
})}\n`);
runNode(dispatcher, ['--run-dir', join(upgrade, 'run'), '--action', 'start', '--intent-file', upgradeIntent]);
const state = JSON.parse(readFileSync(join(upgrade, 'run/run-state.json'), 'utf8'));
assert(Object.hasOwn(state.stages, 'B3d'), '增补路线必须包含 B3d');
assert(!Object.hasOwn(JSON.parse(readFileSync(join(bootstrap, 'run/run-state.json'), 'utf8')).stages, 'B3d'), '新建路线不得包含 B3d');

const query = jsonOutput(runNode(resolve(skillRoot, 'scripts/query-wiki.mjs'), ['--query', '竞品 沟通策略 定位', '--limit', '3']));
assert(query.returned > 0 && query.returned <= 3, 'Wiki 查询必须限量返回');
assert(query.results[0].analysis_operations.length > 0, 'Wiki 查询必须返回完整方法操作，不只返回标题');

const b2 = readFileSync(resolve(skillRoot, 'stages/B2-semantic-units.md'), 'utf8');
const b3b = readFileSync(resolve(skillRoot, 'stages/B3b-lens-extraction.md'), 'utf8');
const b4 = readFileSync(resolve(skillRoot, 'stages/B4-full-review.md'), 'utf8');
const b4Builder = readFileSync(resolve(skillRoot, 'scripts/build-review-page.mjs'), 'utf8');
assert(b2.includes('不创建 B2 人工审阅') && b2.includes('团队介绍'), 'B2 必须无人审并允许丢弃明确无价值页');
assert(b3b.includes('去项目化是硬门槛') && b3b.includes('slogan'), 'B3b 必须恢复去项目化 learning');
assert(b4.includes('独立新建库') && b4.includes('绝不显示“合并到已有 Lens”'), 'B4 必须区分新建和增补');
assert(b4Builder.includes("const routeIsUpgrade=bundle.route==='upgrade_existing'"), 'B4 页面必须按路线切换逻辑');
assert(b4Builder.includes("if(!routeIsUpgrade)return ''"), '新建库页面必须隐藏既有库比较与目标选择');
assert(b4Builder.includes("本路线没有合并到已有 Lens 的选项"), '新建库页面必须向用户说明没有合并');
assert(b4Builder.includes('合并、变体、修订和补来源必须明确目标'), '增补库页面必须说明目标 Lens');
assert(!b4Builder.includes('id=\"reviewer\"'), 'B4 页面不得要求审阅人');
assert(b4Builder.includes('https://demyth.info') && b4Builder.includes('小红书：阿祖不看 TVC'), 'B4 页眉页脚必须带开源标识');
assert(!readFileSync(resolve(skillRoot, 'WORKFLOW.md'), 'utf8').includes('run-protocol.md'), 'Library 工作流不得要求第二套运行协议');
pass('Library Dispatcher、路线和语义 Stage');
