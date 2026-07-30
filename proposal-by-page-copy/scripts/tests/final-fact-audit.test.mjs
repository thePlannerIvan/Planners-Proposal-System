import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  buildAudit,
  classifyAuditIssues,
  numericTokens,
} from '../lib/final-fact-audit.mjs';

test('数字提取把带单位区间保留为一个 token', () => {
  const tokens = numericTokens('占比10%-15%，周期1-3个月，另有3个百分点。');
  assert.deepEqual(tokens.map(item => ({
    raw: item.raw,
    values: item.values,
    unit: item.unit,
    range: item.range,
  })), [
    { raw: '10%-15%', values: [10, 15], unit: '%', range: true },
    { raw: '1-3个月', values: [1, 3], unit: '个月', range: true },
    { raw: '3个百分点', values: [3], unit: '个百分点', range: false },
  ]);
});

test('审计器保守地区分来源、目标、派生和模糊数字', () => {
  const root = mkdtempSync(join(tmpdir(), 'proposal-fact-audit-'));
  try {
    const sourcePath = join(root, 'source.md');
    const sourceIndexPath = join(root, 'source-index.json');
    const materialsPath = join(root, 'materials.json');
    const copyPath = join(root, 'proposal.md');
    writeFileSync(sourcePath, '当前样本100条，转化率42.2%。\n');
    writeFileSync(sourceIndexPath, JSON.stringify({
      files: [{ path: 'source.md', read_mode: 'full', scope: '当前样本与转化率' }],
    }));
    writeFileSync(materialsPath, JSON.stringify({ packs: [] }));
    writeFileSync(copyPath, `---
contract_version: by-page-copy/1.0.0
page_number: 1
page_title: 数字机制测试
---
## Page Content

当前样本100条，转化率42.2%。

年底目标提升至60%。

占比从42.2%提升至60%，增长17.8个百分点。

待讨论额度200万元。

## Production Notes

测试。
`);

    const audit = buildAudit({
      copyPath,
      sourceIndexPath,
      materialsPath,
      sourceRoot: root,
      previousAuditPath: null,
    });
    const itemByRaw = new Map(audit.facts.flatMap(fact => fact.items).map(item => [item.raw, item]));
    assert.equal(itemByRaw.get('100').kind, 'sourced_fact');
    assert.equal(itemByRaw.get('42.2%').kind, 'sourced_fact');
    assert.equal(itemByRaw.get('60%').kind, 'proposal_value');
    assert.equal(itemByRaw.get('17.8个百分点').kind, 'derived_fact');
    assert.equal(itemByRaw.get('17.8个百分点').kind_locked, true);
    assert.equal(itemByRaw.get('17.8个百分点').derivation_result.valid, true);
    assert.equal(itemByRaw.get('200万元').kind, 'pending');

    const ambiguousFact = audit.facts.find(fact => fact.items.some(item => item.raw === '200万元'));
    ambiguousFact.items[0].kind = 'sourced_fact';
    ambiguousFact.items[0].source_id = 'source.md';
    ambiguousFact.items[0].source_path = 'source.md';
    ambiguousFact.semantic_status = 'user_review_required';
    ambiguousFact.semantic_notes_zh = '来源存在，但当前口径无法可靠确认，请用户决定是否保留。';
    const fallbackIssues = classifyAuditIssues({ facts: [ambiguousFact] });
    assert.equal(fallbackIssues.hard_errors.length, 0);
    assert.ok(fallbackIssues.human_review_required.length >= 1);

    const derivedFact = audit.facts.find(fact => fact.items.some(item => item.raw === '17.8个百分点'));
    const lockedItem = derivedFact.items.find(item => item.raw === '17.8个百分点');
    lockedItem.kind = 'proposal_value';
    derivedFact.semantic_status = 'qualified';
    derivedFact.semantic_notes_zh = '试图通过改类型绕过计算。';
    const bypassIssues = classifyAuditIssues({ facts: [derivedFact] });
    assert.ok(bypassIssues.hard_errors.some(error => error.includes('不能通过改 kind 绕过')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
