import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { assert, jsonOutput, pass, runNode } from '../lib/assert.mjs';
import { checkReviewBehavior } from '../lib/review-behavior-suite.mjs';
import { numericTokens } from '../../proposal-by-page-copy/scripts/lib/final-fact-audit.mjs';

const root = resolve(import.meta.dirname, '../..');
const skillRoot = resolve(root, 'proposal-by-page-copy');
const template = resolve(skillRoot, 'templates/by-page-copy.md');
assert(jsonOutput(runNode(resolve(skillRoot, 'scripts/validate-by-page-copy-bundle.mjs'), [template])).valid, 'By-page 2.0 模板必须通过');
const normalizedNumbers = numericTokens('预算200万元，均互动1,221.3，增长-12.5%，目标40-50%。');
assert(normalizedNumbers[0].values[0] === 2_000_000, '万元必须归一为真实数值');
assert(normalizedNumbers[1].values[0] === 1221.3, '千分位必须作为一个数值');
assert(normalizedNumbers[2].values[0] === -12.5, '负数不能被误识别为区间');
assert(normalizedNumbers[3].values.length === 2 && normalizedNumbers[3].values[1] === 50, '百分比区间必须保留两个端点');

const temp = mkdtempSync(join(tmpdir(), 'proposal-by-page-'));
const sampleHtml = join(temp, 'sample/index.html');
runNode(resolve(skillRoot, 'scripts/build-copy-review.mjs'), ['--copy', template, '--kind', 'sample', '--output', sampleHtml]);
checkReviewBehavior(sampleHtml, { uploads: false });

const sourceRoot = join(temp, 'sources');
mkdirSync(sourceRoot, { recursive: true });
writeFileSync(join(sourceRoot, 'research.md'), [
  '# 研究摘要',
  '',
  '2025 年目标样本的转化率增长 12.5%，样本为 800 人，范围为中国市场。',
  '竞品 A 指标为 50，竞品 B 指标为 10。',
  '',
].join('\n'));
writeFileSync(join(sourceRoot, 'mismatch.md'), '# 研究摘要\n\n2025 年目标样本为 800 人，但没有页面声称的增长率。\n');
const sourceIndex = join(temp, 'source-index.json');
writeFileSync(sourceIndex, `${JSON.stringify({
  contract_version: 'test',
  sources: [
    { source_id: 'research', file_path: 'research.md' },
    { source_id: 'mismatch', file_path: 'mismatch.md' },
  ],
}, null, 2)}\n`);
const materials = join(temp, 'page-material-packs.json');
writeFileSync(materials, `${JSON.stringify({
  contract_version: 'test',
  packs: [{
    page_number: 1,
    claim: '用研究数据说明机会并提出首轮方案目标',
    materials: [{
      source: 'research',
      location: '研究摘要',
      excerpt: '2025 年增长 12.5%，样本 800 人；竞品 A 50，竞品 B 10。',
      supports: '增长数据与竞品差距',
      used_in: '页面事实与计算',
    }],
  }],
}, null, 2)}\n`);

const factCopy = join(temp, 'proposal-draft.md');
writeFileSync(factCopy, readFileSync(template, 'utf8').replace(
  /## Page Content[\s\S]*?## Production Notes/,
  `## Page Content

2025 年目标样本的转化率增长 12.5%，样本为 800 人。

竞品 A 指标为 50，竞品 B 指标为 10，差距至少 4 倍。

建议首轮预算的 60% 用于验证核心内容方向。

## Production Notes`,
));
assert(jsonOutput(runNode(resolve(skillRoot, 'scripts/validate-by-page-copy-bundle.mjs'), [factCopy])).valid, '带数字的完整页面必须通过文案格式校验');

const auditPath = join(temp, 'fact-audit.json');
const missingMaterialsPrepare = spawnSync(process.execPath, [
  resolve(skillRoot, 'scripts/audit-final-copy.mjs'),
  '--mode', 'prepare', '--copy', factCopy, '--source-index', sourceIndex,
  '--materials', join(temp, 'missing-materials.json'), '--source-root', sourceRoot,
  '--audit', join(temp, 'missing-materials-audit.json'),
], { encoding: 'utf8' });
assert(missingMaterialsPrepare.status !== 0
  && missingMaterialsPrepare.stdout.includes('page-material-packs 不存在'),
'P5 缺少逐页材料包时必须返回 P2，不能退化为全库数字碰撞');
const prepared = jsonOutput(runNode(resolve(skillRoot, 'scripts/audit-final-copy.mjs'), [
  '--mode', 'prepare',
  '--copy', factCopy,
  '--source-index', sourceIndex,
  '--materials', materials,
  '--source-root', sourceRoot,
  '--audit', auditPath,
]));
assert(prepared.summary.total_numbers === 7, '单一入口必须覆盖标题与可见正文中的全部数字');
assert(existsSync(prepared.review_queue), 'prepare 必须生成给模型使用的短审阅队列');
const preparedQueue = JSON.parse(readFileSync(prepared.review_queue, 'utf8'));
assert([...preparedQueue.blocking_queue, ...preparedQueue.semantic_review_queue]
  .every(fact => fact.numbers.every(item => item.token_id)), '短队列中的每个数字必须带可回写 token_id');
assert([...preparedQueue.blocking_queue, ...preparedQueue.semantic_review_queue]
  .every(fact => fact.evidence_candidates.length <= 2), '每条模糊事实最多提供两个证据切片');
let audit = JSON.parse(readFileSync(auditPath, 'utf8'));
const decisionsPath = join(temp, 'fact-audit-decisions.json');
writeFileSync(decisionsPath, `${JSON.stringify({
  contract_version: 'fact-audit-decisions/1.0.0',
  copy_sha256: audit.copy_sha256,
  decisions: audit.facts.map(fact => ({
    fact_id: fact.fact_id,
    status: fact.items.some(item => item.kind === 'proposal_value') ? 'qualified' : 'verified',
    note_zh: fact.items.some(item => item.kind === 'proposal_value')
      ? '该数字是本方案提出的目标或建议。'
      : '指标、对象、样本、时间、地域、单位与计算口径一致。',
    items: fact.items.filter(item => item.kind === 'derived_fact').map(item => ({
      token_id: item.token_id,
      derivation: {
        operands: [50, 10],
        operator: 'divide',
        displayed_value: 4,
        comparison: 'at_least',
        tolerance: 0.01,
      },
    })),
  })),
}, null, 2)}\n`);
assert(jsonOutput(runNode(resolve(skillRoot, 'scripts/audit-final-copy.mjs'), [
  '--mode', 'resolve', '--copy', factCopy, '--audit', auditPath, '--decisions', decisionsPath,
])).valid, '模型决定必须由 resolve 合并，不能要求模型修补完整审计 JSON');
audit = JSON.parse(readFileSync(auditPath, 'utf8'));
assert(jsonOutput(runNode(resolve(skillRoot, 'scripts/audit-final-copy.mjs'), [
  '--mode', 'check', '--copy', factCopy, '--audit', auditPath,
])).valid, '来源事实、衍生事实和方案数字完成语义判断后必须通过');

const pendingReview = spawnSync(process.execPath, [
  resolve(skillRoot, 'scripts/start-copy-review.mjs'),
  '--copy', factCopy, '--audit', join(temp, 'missing-audit.json'),
  '--review-dir', join(temp, 'pending-review'), '--kind', 'final', '--port', '0',
], { encoding: 'utf8', env: { ...process.env, REVIEW_TEST_NO_OPEN: '1' } });
assert(pendingReview.status !== 0, '事实审计缺失或未通过时必须阻止终稿审阅');

const originalAudit = JSON.parse(readFileSync(auditPath, 'utf8'));
const changedCopy = readFileSync(factCopy, 'utf8').replace('预算的 60%', '预算的 65%');
writeFileSync(factCopy, changedCopy);
const incremental = jsonOutput(runNode(resolve(skillRoot, 'scripts/audit-final-copy.mjs'), [
  '--mode', 'prepare',
  '--copy', factCopy,
  '--source-index', sourceIndex,
  '--materials', materials,
  '--source-root', sourceRoot,
  '--audit', auditPath,
]));
assert(incremental.summary.carried_unchanged >= 2 && incremental.summary.changed === 1, '文案局部修改必须保留未变化事实，只重查变化事实');
audit = JSON.parse(readFileSync(auditPath, 'utf8'));
const changedFact = audit.facts.find(fact => fact.claim_text.includes('65%'));
assert(changedFact?.semantic_status === 'pending' && changedFact.items[0].kind === 'proposal_value', '变化事实应继承数字性质但重新进行语义核对');
changedFact.semantic_status = 'qualified';
changedFact.semantic_notes_zh = '65%是更新后的方案预算建议。';
writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
assert(jsonOutput(runNode(resolve(skillRoot, 'scripts/validate-fact-audit.mjs'), [
  '--audit', auditPath, '--copy', factCopy,
])).valid, '增量修改完成核对后必须重新通过');

const forgedPath = join(temp, 'forged-audit.json');
const forged = JSON.parse(readFileSync(auditPath, 'utf8'));
const sourcedItem = forged.facts.flatMap(fact => fact.items).find(item => item.kind === 'sourced_fact');
sourcedItem.source_id = 'mismatch';
sourcedItem.source_path = 'mismatch.md';
sourcedItem.mechanical_status = 'located_exact';
sourcedItem.matched_numeric_tokens = [sourcedItem.raw];
writeFileSync(forgedPath, `${JSON.stringify(forged, null, 2)}\n`);
const forgedValidation = spawnSync(process.execPath, [
  resolve(skillRoot, 'scripts/validate-fact-audit.mjs'), '--audit', forgedPath, '--copy', factCopy,
], { encoding: 'utf8' });
assert(forgedValidation.status !== 0, 'Validator 必须从真实来源复算，不能相信手写的机械通过状态');

const exceptionPath = join(temp, 'reviewable-exception-audit.json');
const reviewableException = JSON.parse(readFileSync(auditPath, 'utf8'));
const exceptionFact = reviewableException.facts.find(fact => fact.items.some(item => item.raw === '12.5%'));
const exceptionItem = exceptionFact.items.find(item => item.raw === '12.5%');
exceptionFact.semantic_status = 'user_review_required';
exceptionFact.semantic_notes_zh = '来源存在，但该文件没有可机械定位的同口径数值，请用户决定是否保留。';
exceptionItem.kind = 'sourced_fact';
exceptionItem.source_id = 'mismatch';
exceptionItem.source_path = 'mismatch.md';
exceptionItem.locator = '研究摘要';
writeFileSync(exceptionPath, `${JSON.stringify(reviewableException, null, 2)}\n`);
runNode(resolve(skillRoot, 'scripts/audit-final-copy.mjs'), [
  '--mode', 'confirm', '--copy', factCopy, '--audit', exceptionPath,
]);
const reviewableValidation = spawnSync(process.execPath, [
  resolve(skillRoot, 'scripts/validate-fact-audit.mjs'),
  '--audit', exceptionPath, '--copy', factCopy, '--allow-human-review', 'true',
], { encoding: 'utf8' });
assert(reviewableValidation.status === 0, '来源存在但机器无法定位的少数事实应允许进入人工审阅');
const reviewableResult = jsonOutput(reviewableValidation);
assert(reviewableResult.reviewable && reviewableResult.requires_human_review, '可审阅例外必须与自动通过区分');
const exceptionHtml = join(temp, 'exception-review/index.html');
runNode(resolve(skillRoot, 'scripts/build-copy-review.mjs'), [
  '--copy', factCopy, '--audit', exceptionPath, '--kind', 'final', '--output', exceptionHtml,
]);
const exceptionHtmlRaw = readFileSync(exceptionHtml, 'utf8');
assert(exceptionHtmlRaw.includes('需要你决定的事实例外')
  && exceptionHtmlRaw.includes('接受事实例外并通过'), '事实例外必须在终稿页面要求用户明确决定');
const exceptionFeedbackPath = join(temp, 'exception-feedback.json');
const exceptionAuditRaw = readFileSync(exceptionPath, 'utf8');
const exceptionFeedback = {
  contract_version: '1.1.0',
  review_kind: 'by_page_copy',
  source_sha256: createHash('sha256')
    .update(readFileSync(factCopy, 'utf8'))
    .update('\n---FACT-AUDIT---\n')
    .update(exceptionAuditRaw)
    .digest('hex'),
  overall_decision: 'approve',
  overall_feedback_zh: '',
  decisions: [{
    page_number: 1,
    decision: 'approve',
    fact_exception_decision: 'accept',
    feedback_zh: '',
    attachments: [],
  }],
};
writeFileSync(exceptionFeedbackPath, `${JSON.stringify(exceptionFeedback, null, 2)}\n`);
assert(jsonOutput(runNode(resolve(skillRoot, 'scripts/validate-copy-review-feedback.mjs'), [
  '--feedback', exceptionFeedbackPath, '--copy', factCopy, '--audit', exceptionPath, '--kind', 'final',
])).valid, '用户明确接受事实例外后，反馈必须能够通过');
delete exceptionFeedback.decisions[0].fact_exception_decision;
writeFileSync(exceptionFeedbackPath, `${JSON.stringify(exceptionFeedback, null, 2)}\n`);
const implicitExceptionDecision = spawnSync(process.execPath, [
  resolve(skillRoot, 'scripts/validate-copy-review-feedback.mjs'),
  '--feedback', exceptionFeedbackPath, '--copy', factCopy, '--audit', exceptionPath, '--kind', 'final',
], { encoding: 'utf8' });
assert(implicitExceptionDecision.status !== 0, '事实例外不能用普通默认通过代替用户明确决定');

const badFormulaPath = join(temp, 'bad-formula-audit.json');
const badFormulaCopy = join(temp, 'bad-formula-copy.md');
writeFileSync(badFormulaCopy, readFileSync(factCopy, 'utf8').replace('差距至少 4 倍', '差距至少 9 倍'));
runNode(resolve(skillRoot, 'scripts/audit-final-copy.mjs'), [
  '--mode', 'prepare', '--copy', badFormulaCopy, '--source-index', sourceIndex,
  '--materials', materials, '--source-root', sourceRoot, '--audit', badFormulaPath,
]);
runNode(resolve(skillRoot, 'scripts/audit-final-copy.mjs'), [
  '--mode', 'confirm', '--copy', badFormulaCopy, '--audit', badFormulaPath,
]);
const badFormulaValidation = spawnSync(process.execPath, [
  resolve(skillRoot, 'scripts/validate-fact-audit.mjs'),
  '--audit', badFormulaPath, '--copy', badFormulaCopy, '--allow-human-review', 'true',
], { encoding: 'utf8' });
assert(badFormulaValidation.status !== 0, '计算错误必须保持硬阻断，不能提交用户代替复算');

const missingFactPath = join(temp, 'missing-fact-audit.json');
const missingFact = JSON.parse(readFileSync(auditPath, 'utf8'));
missingFact.facts.pop();
writeFileSync(missingFactPath, `${JSON.stringify(missingFact, null, 2)}\n`);
const missingValidation = spawnSync(process.execPath, [
  resolve(skillRoot, 'scripts/validate-fact-audit.mjs'), '--audit', missingFactPath, '--copy', factCopy,
], { encoding: 'utf8' });
assert(missingValidation.status !== 0, '删除任一自动事实后必须重新生成 pending 条目并阻塞');

const placeholderCopy = join(temp, 'placeholder.md');
writeFileSync(placeholderCopy, readFileSync(factCopy, 'utf8').replace('建议首轮预算', '[待补充团队案例]\\n\\n建议首轮预算'));
assert(spawnSync(process.execPath, [
  resolve(skillRoot, 'scripts/validate-by-page-copy-bundle.mjs'), placeholderCopy,
], { encoding: 'utf8' }).status !== 0, '正文中夹带待补充占位语时必须阻塞');

const finalHtml = join(temp, 'final/index.html');
runNode(resolve(skillRoot, 'scripts/build-copy-review.mjs'), ['--copy', factCopy, '--audit', auditPath, '--kind', 'final', '--output', finalHtml]);
const finalReview = checkReviewBehavior(finalHtml, { uploads: true });
assert(finalReview.html.includes('12.5%') && finalReview.html.includes('derived_fact'), '终稿审阅必须展示实际使用事实及其数字性质');

const feedbackDir = join(temp, 'live-final');
const live = jsonOutput(runNode(resolve(skillRoot, 'scripts/start-copy-review.mjs'), [
  '--copy', factCopy, '--audit', auditPath, '--review-dir', feedbackDir,
  '--final-md', join(temp, 'deliverable/proposal.md'), '--kind', 'final', '--port', '0',
], { env: { ...process.env, REVIEW_TEST_NO_OPEN: '1' } }));
assert((await fetch(live.opened)).ok, 'By-page loopback server 必须提供终稿页面');
const uploaded = await fetch(new URL('/upload-asset', live.opened), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    page_number: 1,
    filename: 'example.png',
    mime: 'image/png',
    data_base64: Buffer.from('test-image').toString('base64'),
  }),
});
assert(uploaded.ok, '图片上传必须成功');
const uploadedAsset = await uploaded.json();
const copyRaw = readFileSync(factCopy, 'utf8');
const auditRaw = readFileSync(auditPath, 'utf8');
const saved = await fetch(new URL('/save-feedback', live.opened), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    contract_version: '1.1.0',
    review_kind: 'by_page_copy',
    source_sha256: createHash('sha256').update(copyRaw).update('\n---FACT-AUDIT---\n').update(auditRaw).digest('hex'),
    saved_at: new Date().toISOString(),
    overall_decision: 'approve',
    overall_feedback_zh: '',
    decisions: [{
      page_number: 1,
      decision: 'approve',
      feedback_zh: '',
      attachments: [{
        path: uploadedAsset.markdown_path,
        url: uploadedAsset.url,
        alt: '示例图',
        caption: '示例说明',
      }],
    }],
  }),
});
assert(saved.ok, 'By-page 反馈保存必须成功');
const feedbackPath = live.feedback_path;
const delivery = join(temp, 'deliverable');
runNode(resolve(skillRoot, 'scripts/build-reviewed-copy.mjs'), [
  '--copy', factCopy, '--audit', auditPath, '--feedback', feedbackPath,
  '--output', join(delivery, 'proposal.md'), '--assets-dir', join(delivery, 'assets'),
]);
assert(existsSync(join(delivery, 'proposal.md')), '必须生成最终 Markdown');
assert(existsSync(join(delivery, 'assets/page-01/example.png')), '批准的图片必须进入 deliverable/assets');

const p1 = readFileSync(resolve(skillRoot, 'stages/P1-handoff-and-style.md'), 'utf8');
const p5 = readFileSync(resolve(skillRoot, 'stages/P5-fact-audit-and-review.md'), 'utf8');
const byPageSkill = readFileSync(resolve(skillRoot, 'WORKFLOW.md'), 'utf8');
assert(p1.includes('继承') && p1.includes('提案语言基线'), 'P1 必须继承上游语言而不是从零开始');
assert(p5.includes('单一审计入口') && p5.includes('增量恢复') && p5.includes('derived_fact'), 'P5 必须解释单入口、增量恢复与衍生事实');
assert(byPageSkill.includes('conversation-log.md') && byPageSkill.includes('没有下游消费者'), 'By-page 不得沉积额外会话和执行日志');
pass('By-page 写作格式、增量事实审计、Review 和交付');
