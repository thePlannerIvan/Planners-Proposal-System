import {
  existsSync, mkdtempSync, readFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { assert, jsonOutput, pass, runNode } from '../lib/assert.mjs';
import { checkPageRendersOffline, checkReviewBehavior, checkSeamSurface } from '../lib/review-behavior-suite.mjs';
import { hostAlive, hostState, stopHost } from '../lib/review-host-bridge.mjs';

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
checkSeamSurface(htmlPath);
const reviewData = JSON.parse(html.match(/const REVIEW = (\{.*\});/)?.[1] || '{}');
await checkPageRendersOffline(htmlPath, { expectUnits: (reviewData.pages || []).length });
assert(html.includes('Storyline 与页面结构审阅'), '结构审阅必须合并 Storyline 和页面');
assert(html.includes('一个 Storyline 节点可以展开为多页'), '审阅页面必须解释页数边界');

const liveDir = join(reviewDir, 'live');
const live = jsonOutput(runNode(resolve(skillRoot, 'scripts/start-page-review.mjs'), [
  '--architecture', template, '--review-dir', liveDir, '--port', '0',
], { env: { ...process.env, REVIEW_TEST_NO_OPEN: '1' } }));
// 宿主一旦起来，就注册退出清理：**失败路径也不许留进程**（"摔掉套件"不该顺手留个服务器）。
process.once('exit', () => {
  // 退出钩子里不能 await，所以直接按宿主状态文件里的 pid 同步收（失败路径也不留进程）
  try {
    const state = JSON.parse(readFileSync(join(live.surface, '..', 'review_host.json'), 'utf8'));
    if (state && state.pid) process.kill(state.pid, 'SIGTERM');
  } catch { /* 退清理不许再抛 */ }
});
const response = await fetch(live.url);   // opened 现在是布尔（这次到底开没开浏览器），URL 在 url
assert(response.ok && (await response.text()).includes('Storyline 与页面结构审阅'), '真实 loopback server 必须提供审阅页面');
assert(live.opened === false, 'REVIEW_TEST_NO_OPEN=1 时不许开浏览器（opened 必须是布尔，不是 URL）');
const sourceSha = reviewData.sourceSha256;
// 缝上的写入口：宿主原样落盘（页面就是打这里）
const saved = await fetch(new URL('__review/write', live.url), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    pre_check: false,
    pre_check_note: '测试夹具声明：页面未做版本核对。',
    contract_version: '1.0.0',
    review_kind: reviewData.reviewKind,
    source_sha256: sourceSha,
    saved_at: new Date().toISOString(),
    overall_decision: 'approve',
    overall_feedback_zh: '',
    decisions: [{ page_number: 1, decision: 'approve', feedback_zh: '' }],
  }),
});
assert(saved.ok, '真实审阅宿主必须落盘这一份提交');
assert(existsSync(live.submissions_path), '宿主必须原样落盘提交文件');
// 收件之前跑门**必须失败**：门读的是收件层写出来的原生文件（顺序不是靠人记得）
// 门在收件之前必须**失败**：它读的是收件层写出来的原生文件。用一个 try 抓它，
// 抓不到就是顺序没被钉住（判据要报红，不是把套件摔掉）。
let gateFailedBeforeInbox = false;
let gateBeforeDetail = '';
try {
  runNode(resolve(skillRoot, 'scripts/validate-page-review-feedback.mjs'),
    ['--feedback', live.feedback_path, '--architecture', template]);
} catch (error) {
  gateFailedBeforeInbox = true;
  gateBeforeDetail = String(error.message).split('\n').slice(-1)[0].slice(0, 120);
}
assert(gateFailedBeforeInbox, '收件之前跑门必须失败（顺序被钉住：门读的是收件层写出来的原生文件）', gateBeforeDetail);
const receipt = jsonOutput(runNode(resolve(skillRoot, 'scripts/review-inbox.mjs'), ['--surface', live.surface]));
assert(receipt.ok && receipt.imported && receipt.imported.pages === 1, '收件层必须把提交翻译成原生形状', JSON.stringify(receipt.rejected));
assert(JSON.stringify(receipt.imported.dropped_submission_fields) === JSON.stringify(['pre_check', 'pre_check_note']),
  'R5b：页面报的前提进收据，不写进原生记录', JSON.stringify(receipt.imported.dropped_submission_fields));
assert(existsSync(live.feedback_path), '收件层必须写出原生 review-feedback.json');
assert(/收件完成/.test(receipt.next_action_zh) && /validate-page-review-feedback/.test(receipt.next_action_zh),
  '收据必须写明"先收件、再跑门"');
const nativeDoc = JSON.parse(readFileSync(live.feedback_path, 'utf8'));
assert(!('pre_check' in nativeDoc) && nativeDoc.review_kind === 'co_creation_page_architecture',
  '原生形状一个字段不多（预检字段被摘掉）', Object.keys(nativeDoc).join(','));
assert(jsonOutput(runNode(resolve(skillRoot, 'scripts/validate-page-review-feedback.mjs'), [
  '--feedback', live.feedback_path, '--architecture', template,
])).valid, '收件之后这一份反馈必须通过 Hash Validator');
// 停干净（判据归模组）
// 宿主生命周期统一从 review-host-bridge 拿（顶部已 import），这里不再重复声明
const state = hostState(live.surface);
if (state) await stopHost(state);
assert((await hostAlive(live.surface)) === null, '停完之后宿主判死');

const c1 = readFileSync(resolve(skillRoot, 'stages/C1-project-understanding.md'), 'utf8');
const c2 = readFileSync(resolve(skillRoot, 'stages/C2-direction-loop.md'), 'utf8');
const c3 = readFileSync(resolve(skillRoot, 'stages/C3-storyline-page-architecture.md'), 'utf8');
const coSkill = readFileSync(resolve(skillRoot, 'WORKFLOW.md'), 'utf8');
assert(c1.includes('覆盖全文') && c1.includes('project-memory.md') && c1.includes('source-index.json'), 'C1 必须完整阅读并做工作记忆');
assert(c1.includes('阅读完成回执') && c1.includes('coverage.status') && c1.includes('blind_spots'), 'C1 必须汇报可核对的阅读覆盖（coverage.status + blind_spots），不能只声称全部已读');
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
