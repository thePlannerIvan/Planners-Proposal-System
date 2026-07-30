import {
  existsSync, mkdtempSync, readFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { assert, jsonOutput, pass, runNode } from '../lib/assert.mjs';
import { checkReviewBehavior } from '../lib/review-behavior-suite.mjs';

const root = resolve(import.meta.dirname, '../..');
const skillRoot = resolve(root, 'proposal-co-creation');
const template = resolve(skillRoot, 'templates/page-architecture.json');
const validation = jsonOutput(runNode(resolve(skillRoot, 'scripts/validate-page-architectures.mjs'), [template]));
assert(validation.valid, 'Page Architecture 2.0 模板必须通过');

const schema = JSON.parse(readFileSync(resolve(skillRoot, 'contracts/page-architecture.schema.json'), 'utf8'));
const pageProps = schema.properties.pages.items.properties;
assert(!Object.hasOwn(pageProps, 'asset_resolution'), 'Schema 不得含 asset_resolution');
assert(Object.hasOwn(pageProps, 'content_blocks'), 'Schema 必须使用 content_blocks');
assert(!Object.hasOwn(pageProps.content_blocks, 'maxItems'), 'content_blocks 不得设机械上限');

const reviewDir = mkdtempSync(join(tmpdir(), 'proposal-co-review-'));
const htmlPath = join(reviewDir, 'index.html');
runNode(resolve(skillRoot, 'scripts/build-page-review.mjs'), ['--architecture', template, '--output', htmlPath]);
const { html } = checkReviewBehavior(htmlPath);
assert(html.includes('Storyline 与页面结构审阅'), '结构审阅必须合并 Storyline 和页面');
assert(html.includes('一个 Storyline 节点可以展开为多页'), '审阅页面必须解释页数边界');

const liveDir = join(reviewDir, 'live');
const live = jsonOutput(runNode(resolve(skillRoot, 'scripts/start-page-review.mjs'), [
  '--architecture', template, '--review-dir', liveDir, '--port', '0',
], { env: { ...process.env, REVIEW_TEST_NO_OPEN: '1' } }));
const response = await fetch(live.opened);
assert(response.ok && (await response.text()).includes('Storyline 与页面结构审阅'), '真实 loopback server 必须提供审阅页面');
const sourceSha = JSON.parse(html.match(/const REVIEW = (\{.*\});/)?.[1] || '{}').sourceSha256;
const saved = await fetch(new URL('/save-feedback', live.opened), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    contract_version: '1.0.0',
    review_kind: 'co_creation_page_architecture',
    source_sha256: sourceSha,
    saved_at: new Date().toISOString(),
    overall_decision: 'approve',
    overall_feedback_zh: '',
    decisions: [{ page_number: 1, decision: 'approve', feedback_zh: '' }],
  }),
});
assert(saved.ok, `真实审阅反馈必须保存：${await saved.text()}`);
assert(existsSync(live.feedback_path), '审阅服务必须写出 feedback 文件');
assert(jsonOutput(runNode(resolve(skillRoot, 'scripts/validate-page-review-feedback.mjs'), [
  '--feedback', live.feedback_path, '--architecture', template,
])).valid, '真实保存的反馈必须通过 Hash Validator');

const c1 = readFileSync(resolve(skillRoot, 'stages/C1-project-understanding.md'), 'utf8');
const c2 = readFileSync(resolve(skillRoot, 'stages/C2-direction-loop.md'), 'utf8');
const c3 = readFileSync(resolve(skillRoot, 'stages/C3-storyline-page-architecture.md'), 'utf8');
const coSkill = readFileSync(resolve(skillRoot, 'WORKFLOW.md'), 'utf8');
assert(c1.includes('覆盖全文') && c1.includes('project-memory.md') && c1.includes('source-index.json'), 'C1 必须完整阅读并做工作记忆');
assert(c1.includes('阅读完成回执') && c1.includes('read_mode') && c1.includes('未读/失败'), 'C1 必须汇报可核对的阅读覆盖，不能只声称全部已读');
assert(c1.includes('提案语言基线') && c2.includes('提案语言基线') && c3.includes('提案语言基线'), '提案语言必须在 C1 建立并贯穿方向与 Storyline');
assert(c1.includes('Wiki 第一次介入'), 'C1 必须限量使用 Wiki');
assert(c1.includes('零结果') || c1.includes('返回 0 条'), 'C1 必须处理 Wiki 空结果，不能把空查询当完成');
assert(c2.includes('候选起点') && c2.includes('压力测试') && c2.includes('回退规则'), 'C2 必须把首个方向视为候选，并要求挑战、取舍与跳步回退');
assert(c2.includes('选择理由') && c2.includes('放弃项'), 'C2 锁定必须冻结选择与代价');
assert(c2.includes('提出问题后结束当前回合') && c2.includes('用户回答前'), 'C2 必须在提出高价值问题后停止并等待用户真实回答');
assert(c2.includes('交互证据') && c2.includes('回答怎样改变'), 'C2 必须记录问题、回答及其对方向的影响');
assert(c2.includes('冻结是改写当前工作记忆') && c2.includes('删除或改写'), 'C2 锁定后必须清除已经失效的开放问题，而不是继续追加');
assert(c2.includes('奥美三圈') && c2.includes('Brand Best Self') && c2.includes('消费者真正在意 × 竞品尚未可信占据 × 品牌有资格且有能力兑现'), 'C2 必须把消费者、竞品与 Brand Best Self 的核心交集作为方向门禁');
assert(c2.includes('只有两圈成立不够') && c2.includes('不得进入 C3'), '三圈任一不成立时不得锁定方向');
assert(c3.includes('Wiki 必须再次介入') && c3.includes('不是一一对应'), 'C3 必须用 Wiki 组织论述并允许节点展开多页');
assert(c3.includes('进入前检查') && c3.includes('回到 C2'), 'C3 必须拒绝接收未冻结方向');
assert(c3.includes('证明负担') && c3.includes('独立证明单元') && c3.includes('页面容量与冗余审计'), 'C3 必须完成 Storyline 到页面的四遍展开');
assert(c3.includes('真实问答证据'), 'C3 入口必须检查 C2 真实人机往返');
assert(c3.indexOf('## 先建立 Storyline') < c3.indexOf('## Storyline 完成后，Wiki 必须再次介入')
  && c3.indexOf('## Storyline 完成后，Wiki 必须再次介入') < c3.indexOf('## 从 Storyline 展开为 Page Architecture'), 'Wiki 必须在 Storyline 完成后、Page Architecture 开始前介入');
assert(c3.includes('Storyline 后 Wiki 补全') && c3.includes('实际改变'), 'Wiki 介入必须逐板块记录真实结构增量，不能只完成查询动作');
assert(c3.includes('不是提前写好的文章'), 'C3 必须保持 Page Architecture 为语义骨架');
assert(c3.includes('甲方、乙方') && c3.includes('不把同一个创意概念重复包装'), 'C3 必须阻止幕后称谓和概念重复包装');
assert(coSkill.includes('conversation-log.md') && coSkill.includes('没有下游消费者'), 'Co-creation 不得沉积额外会话和执行日志');
pass('Co-creation 结构、Prompt 和 Review');
