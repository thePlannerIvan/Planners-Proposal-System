import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assert, pass } from '../lib/assert.mjs';

const root = resolve(import.meta.dirname, '../..');
const skill = readFileSync(resolve(root, 'SKILL.md'), 'utf8');
assert(skill.includes('name: planners-proposal-system'), '根 Skill 必须是唯一公开入口');
assert(skill.includes('Method Wiki') && skill.includes('proposal-library-maintenance/WORKFLOW.md'), '主入口必须识别 Library');
assert(skill.includes('proposal-co-creation/WORKFLOW.md') && skill.includes('proposal-by-page-copy/WORKFLOW.md'), '主入口必须串联 Mode A');
assert(skill.includes('.proposal-work/page-architecture.json'), 'Router 必须使用新结构接口');
assert(skill.includes('deliverable/proposal.md'), 'Router 必须声明干净交付');
assert(!skill.includes('evidence_ledger.jsonl'), 'Router 不得要求旧 Evidence Ledger');
assert(!skill.includes('workflow/run-protocol.md'), 'Router 不得引用旧运行协议');
assert(!skill.includes('Storyline 草案'), 'Router 不得保留单独 Storyline 文件门禁');
assert(skill.includes('不读取 `_internal/`'), '公开入口必须排除内部维护面');
for (const workflow of [
  'proposal-library-maintenance/WORKFLOW.md',
  'proposal-co-creation/WORKFLOW.md',
  'proposal-by-page-copy/WORKFLOW.md',
  'proposal-co-creation/stages/C4-structure-review.md',
  'proposal-by-page-copy/stages/P3-sample-calibration.md',
  'proposal-by-page-copy/stages/P5-fact-audit-and-review.md',
]) {
  const content = readFileSync(resolve(root, workflow), 'utf8');
  assert(!content.includes('<本 Skill 目录>/scripts/'), `${workflow} 不得把根 Skill 误作组件脚本目录`);
}
pass('单一安装入口与 Router');
