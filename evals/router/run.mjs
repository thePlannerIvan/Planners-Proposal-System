import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assert, pass } from '../lib/assert.mjs';

const root = resolve(import.meta.dirname, '../..');
const skill = readFileSync(resolve(root, 'SKILL.md'), 'utf8');
assert(skill.includes('name: planners-proposal-system'), '根 Skill 必须是唯一公开入口');
assert(skill.includes('Method Wiki') && skill.includes('query-wiki.mjs'), '主流程明确使用只读 Wiki 查询');
assert(skill.includes('planners-bypage') && skill.includes('共创关键判断'), '主入口负责共创并交接 By-page');
assert(skill.includes('.proposal-work/page-architecture.json'), 'Router 必须使用新结构接口');
assert(skill.includes('完整页面内容、素材、事实核查和终稿'), '完整内容由下游负责');
assert(!skill.includes('evidence_ledger.jsonl'), 'Router 不得要求旧 Evidence Ledger');
assert(!skill.includes('workflow/run-protocol.md'), 'Router 不得引用旧运行协议');
assert(!skill.includes('stages/C'), '主入口不再路由到旧阶段门槛');
for (const name of ['sparkling', 'storytelling', 'slide-copy']) {
  assert(skill.includes('`' + name + '`'), `主入口明确使用原子方法 ${name}`);
}
for (const script of ['validate-page-architectures.mjs', 'start-page-review.mjs', 'review-inbox.mjs', 'validate-page-review-feedback.mjs']) {
  assert(existsSync(resolve(root, 'proposal-co-creation/scripts', script)), `审阅调用 ${script} 必须真实存在`);
}
const libraryWorkflow = readFileSync(resolve(root, 'proposal-library-maintenance/WORKFLOW.md'), 'utf8');
assert(!libraryWorkflow.includes('<本 Skill 目录>/scripts/'), 'Library 工作流不得把根 Skill 误作组件脚本目录');
pass('单一写方案主入口与真实工具指针');
