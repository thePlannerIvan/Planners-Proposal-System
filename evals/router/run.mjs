import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assert, pass } from '../lib/assert.mjs';

const root = resolve(import.meta.dirname, '../..');
const skill = readFileSync(resolve(root, 'SKILL.md'), 'utf8');
assert(skill.includes('name: planners-proposal-system'), '根 Skill 必须是唯一公开入口');
assert(skill.includes('planners-method-wiki'), '主流程调用独立方法库 Skill');
assert(skill.includes('planners-bypage') && skill.includes('讨论并形成判断'), '主入口负责共创并交接 By-page');
assert(skill.includes('.planners/storyline.md'), 'Router 必须指向 Storyline 文档工作稿');
assert(skill.includes('proposal-co-creation/templates/storyline.md'), 'Router 必须给出 Storyline 模板');
assert(skill.includes('validate-storyline-doc.mjs') && skill.includes('doc-workbench.mjs'), 'Router 必须指向文档校验器与工作台');
assert(skill.includes('page-architecture.json') && skill.includes('只读'), '旧 JSON 主稿只作只读兼容');
assert(skill.includes('完整页面内容、素材、事实核查和终稿'), '完整内容由下游负责');
assert(!skill.includes('evidence_ledger.jsonl'), 'Router 不得要求旧 Evidence Ledger');
assert(!skill.includes('workflow/run-protocol.md'), 'Router 不得引用旧运行协议');
assert(!skill.includes('stages/C'), '主入口不再路由到旧阶段门槛');
for (const name of ['sparkling', 'storytelling', 'slide-copy']) {
  assert(skill.includes('`' + name + '`'), `主入口明确使用原子方法 ${name}`);
}
for (const script of ['validate-storyline-doc.mjs', 'validate-page-architectures.mjs']) {
  assert(existsSync(resolve(root, 'proposal-co-creation/scripts', script)), `校验调用 ${script} 必须真实存在`);
}
assert(existsSync(resolve(root, 'proposal-co-creation/templates/storyline.md')), 'Storyline 模板必须真实存在');
assert(!skill.includes('content_blocks') && !skill.includes('suggested_form'), 'Router 不再描述页级 JSON 字段');
assert(!existsSync(resolve(root, 'proposal-library-maintenance/base-wiki')), 'Proposal 不再维护第二份 Wiki');
assert(!existsSync(resolve(root, 'proposal-library-maintenance/WORKFLOW.md')), '旧维护入口已退役');
pass('单一写方案主入口与真实工具指针');
