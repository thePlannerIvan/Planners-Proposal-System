import {
  existsSync, mkdtempSync, readFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { assert, jsonOutput, pass, runNode } from '../lib/assert.mjs';
import {spawnSync} from 'node:child_process';
import {moduleScript} from '../../proposal-co-creation/scripts/lib/planners-modules.mjs';
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
const html = readFileSync(htmlPath,'utf8');
const reviewData = JSON.parse(html.match(/<script id="reviewData" type="application\/json">([\s\S]*?)<\/script>/)[1]);
assert(reviewData.sections.length > 0 && reviewData.pages.length > 0,'结构审阅需要章节与页面');
assert(reviewData.feedbackContractVersion === '1.0.0','原生反馈版本保持 1.0.0');
assert(html.split('\n').filter(l => l.trim() === '{{REVIEW_BRIDGE}}').length === 1,'一个裸桥注入点');
const rendered = spawnSync(process.env.PLAYWRIGHT_PYTHON || 'python3',[moduleScript('planners-review-core','evals/check-content-render.py'),'--html',htmlPath],{encoding:'utf8'});
assert(rendered.status === 0,'真实浏览器离线及握手超时渲染',rendered.stdout+rendered.stderr);

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

const skill = readFileSync(resolve(root, 'SKILL.md'), 'utf8');
assert(skill.includes('先收件，再校验反馈'), '主流程必须说明真实提交的收件顺序');
assert(skill.includes('`valid` 只表示反馈有效') && skill.includes('`overall_decision`'), '有效反馈不能替代用户批准');
assert(skill.includes('使用回写后的正式结构继续'), '人工编辑后的正式产物必须成为后续输入');
pass('Co-creation 结构与真实 Review；主文件交接约定');
