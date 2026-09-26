import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { assert, jsonOutput, pass, runNode } from '../lib/assert.mjs';
import { checkPageRendersOffline, checkSeamSurface, runPageOffline, settle } from '../lib/review-behavior-suite.mjs';
import { hostState, openReview, stopHost } from '../lib/review-host-bridge.mjs';

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
/* ================= B4 方法库审阅面：挂公共缝之后的行为（第一张网，与 C4 同一套桩） =================
 * 这一段跑的是**当前**代码（改前那一份冻结在 .scratch 里，用于红/绿对照，不进 Skill）。
 * 判据只从公共桩拿：`checkSeamSurface`（R3/R11/桥/旧端点/渲染先行）与 `runPageOffline`（验证 12/13/存储）。
 */
const b4SeamRoot = resolve(skillRoot, '..');
const b4Seam = resolve(b4SeamRoot, 'proposal-library-maintenance');
const b4SeamWork = mkdtempSync(join(tmpdir(), 'proposal-library-b4Seam-'));
const b4SeamB4 = join(b4SeamWork, 'B4');
const b4SeamReview = join(b4SeamB4, 'review');
mkdirSync(b4SeamReview, { recursive: true });
const b4SeamCuration = join(b4SeamWork, 'curation.json');
writeFileSync(b4SeamCuration, `${JSON.stringify({
  contract_version: '2.0.0',
  source_record_ids: [`cr_${'a'.repeat(24)}`],
  modules: [{
    module_id: 'mod_competitive-reading',
    title_zh: '竞品读法',
    stable_decision_zh: '两条轴分别判，不合并成一个总分。',
    unified_preconditions_zh: ['两家有可比的分母。'],
    lenses: [{
      lens_id: 'lens_two-axis-verdict',
      source_result_ids: [`le_${'a'.repeat(24)}`],
      source_unit_ids: [`su_${'c'.repeat(24)}`],
      source_page_ids: [`pg_${'d'.repeat(24)}`, `pg_${'e'.repeat(24)}`],
      name_zh: '双轴判决',
      question_zh: '这两家在两条轴上分别是什么形态？',
      aliases_zh: ['两条轴分开判'],
      use_conditions_zh: ['两家有可比的分母时。'],
      skip_conditions_zh: ['分母不可比时。'],
      required_inputs_zh: ['同一口径的公开数据。'],
      operations_zh: ['取同一分母', '各给一条判据', '分别写形态'],
      output_types_zh: ['一句话判决。'],
      failure_modes_zh: ['平均成一个总分。'],
      boundaries_zh: ['不做因果归因。'],
      page_structure: [1, 2].map((page) => ({
        page, title_zh: `第 ${page} 页`, purpose_zh: '把形态固定成一句话。', question_zh: '尺是一样的吗？',
        evidence_needed_zh: ['两家的分母量。'], information_relationship: page === 1 ? 'sequential' : 'comparative',
        from_previous_zh: '从品类总量进入。', to_next_zh: '把落差带到下一跳。', misuse_warning_zh: '不要用绝对量代替份额。',
      })),
      page_structure_check: { uncovered_operations_zh: [], uncovered_outputs_zh: [], coverage_rationale_zh: '三条操作各有承接。' },
      abstraction_check: { passed: true, project_residue: [], issues_zh: [] },
    }],
  }],
  recipes: [{
    recipe_id: 'recipe_two-axis-verdict',
    name_zh: '双轴判决',
    purpose_zh: '拆成两条轴分别判，再给方向。',
    source_recipe_ids: [`rcp_${'b'.repeat(24)}`],
    source_unit_ids: [`su_${'c'.repeat(24)}`],
    required_lens_ids: ['lens_two-axis-verdict'],
    optional_lens_ids: [],
    steps: [1, 2].map((step_index) => ({
      step_index, lens_id: 'lens_two-axis-verdict', role_zh: step_index === 1 ? '先判形态' : '再判方向',
      input_zh: ['上一步的输出'], output_zh: ['下一步的输入'], dependency_zh: step_index === 1 ? '无前置。' : '依赖第 1 步。',
    })),
    use_conditions_zh: ['有可比分母时。'], skip_conditions_zh: ['分母不可比时。'],
  }],
  rejected_recipes: [], terminal_results: [], curation_notes_zh: ['测试夹具。'],
}, null, 2)}\n`, 'utf8');
const b4SeamBundle = join(b4SeamB4, 'review-bundle.json');
runNode(resolve(b4Seam, 'scripts/build-review-bundle.mjs'), ['--curation', b4SeamCuration, '--route', 'isolated_bootstrap', '--output', b4SeamBundle]);
const b4SeamHtml = join(b4SeamReview, 'index.html');
runNode(resolve(b4Seam, 'scripts/build-review-page.mjs'), ['--bundle', b4SeamBundle, '--output', b4SeamHtml]);
checkSeamSurface(b4SeamHtml);
const b4SeamData = JSON.parse(readFileSync(b4SeamHtml, 'utf8').match(/const bundle=(\{[\s\S]*?\});\n/)[1]);
await checkPageRendersOffline(b4SeamHtml, { expectUnits: b4SeamData.items.length, dataMarker: 'const bundle=', mountId: 'navList', unitTag: 'li' });
// R7：加载后是干净的 0/N —— 决定只能由人的点击产生（页面不预置、也不从上一轮恢复）
const b4SeamFresh = await runPageOffline(b4SeamHtml, { dataMarker: 'const bundle=' });
assert(String(b4SeamFresh.made.progressText?.textContent) === `0/${b4SeamData.items.length} 已处置` && b4SeamFresh.made.save?.disabled === true,
  'B4：页面加载后必须是干净的未处置（不许预置任何决定）');
// R10：一个方法都不处置，也要能把一句整体意见交出去
const b4SeamWritten = [];
const b4SeamWakes = [];
const b4SeamLink = { transport: 'http', capabilities: [], write: async (p) => { b4SeamWritten.push(p); },
  wake: async (p) => { b4SeamWakes.push(p); return { woke: false }; }, readText: async () => { throw new Error('stub'); }, on: () => () => {} };
const b4SeamLive = await runPageOffline(b4SeamHtml, { dataMarker: 'const bundle=', bridge: { connect: () => Promise.resolve(b4SeamLink), transport: 'http' } });
await settle();
b4SeamLive.sandbox.document.querySelector('#overallNote').value = '这批方法整体不对。';
await b4SeamLive.made.submitOverall.onclick();
await settle();
assert(b4SeamWritten.length === 1 && b4SeamWritten[0].decisions.length === 0 && b4SeamWritten[0].overall_note_zh === '这批方法整体不对。' && b4SeamWakes.length === 1,
  'B4 R10：整体意见必须能在不处置任何方法时交出去');
assert(String(b4SeamLive.made.progressText?.textContent) === `0/${b4SeamData.items.length} 已处置`, 'B4 R10：交整体意见不该改变逐项进度');
// 缝上的写入口 → 收件层 → 门（顺序被钉住）
const b4SeamSurface = jsonOutput(runNode(resolve(b4Seam, 'scripts/review-surface.mjs'), ['--review-dir', b4SeamReview]));
const b4SeamHost = await openReview(b4SeamSurface.surface, 0, false);
process.once('exit', () => { try { const state = hostState(b4SeamSurface.surface); if (state?.pid) process.kill(state.pid, 'SIGTERM'); } catch { /* 退清理不许再抛 */ } });
const b4SeamSha = createHash('sha256').update(readFileSync(b4SeamBundle)).digest('hex');
const b4SeamPayload = {
  contract_version: '1.0.0', review_bundle_sha256: b4SeamSha, route: b4SeamData.route, saved_at: '2026-09-26T00:00:00.000Z',
  reviewer: 'B4 人工审阅', pre_check: false, pre_check_note: '测试夹具声明：页面未做版本核对。',
  overall_note_zh: '这批方法整体不对。',
  decisions: b4SeamData.items.map((item) => ({ item_id: item.item_id, decision: 'approve', target_module_id: null, target_id: null, edited_proposal: item.proposal, note_zh: '' })),
};
assert((await fetch(new URL('/__review/write', b4SeamHost.url), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b4SeamPayload) })).ok,
  'B4：宿主必须收下这一份提交');
assert(!existsSync(join(b4SeamReview, 'review-feedback.json')), 'B4：收件之前原生记录不许存在（顺序不是靠人记得）');
const b4SeamReceipt = jsonOutput(runNode(resolve(b4Seam, 'scripts/review-inbox.mjs'), ['--surface', b4SeamSurface.surface]));
assert(JSON.stringify(b4SeamReceipt.imported.dropped_submission_fields) === JSON.stringify(['pre_check', 'pre_check_note', 'overall_note_zh']),
  'B4 R5b/R10：前提与整体意见进收据，不许写进原生记录');
const b4SeamNative = JSON.parse(readFileSync(join(b4SeamReview, 'review-feedback.json'), 'utf8'));
assert(!('pre_check' in b4SeamNative) && !('overall_note_zh' in b4SeamNative) && Object.keys(b4SeamNative).length === 6,
  'B4：原生形状一个字段不多', Object.keys(b4SeamNative).join(','));
assert(jsonOutput(runNode(resolve(b4Seam, 'scripts/validate-review-feedback.mjs'),
  ['--feedback', join(b4SeamReview, 'review-feedback.json'), '--bundle', b4SeamBundle])).valid, 'B4：收件之后这一份反馈必须过门');
// 验证 24 的第一关：扫描范围要 ≥ 标志物可能出现的地方 —— 只扫"页面 + 生成器"会漏掉新加的文件。
// 所以扫**整棵 B4 工作流树**；真植入反向验在 tools/b4_last_mile_probe.mjs 里（写进文档正文必须红）。
const b4EndpointHits = [];
{
  const walkTree = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) { if (!['node_modules', '.git'].includes(entry.name)) walkTree(path); continue; }
      let body = '';
      try { body = readFileSync(path, 'utf8'); } catch { continue; }
      body.split('\n').forEach((line, index) => { if (/\/save-feedback|\/upload-asset/.test(line)) b4EndpointHits.push(`${path}:${index + 1}`); });
    }
  };
  walkTree(b4Seam);
}
assert(b4EndpointHits.length === 0, 'B4：整棵工作流树里不许再出现自建端点', b4EndpointHits.slice(0, 3).join(', '));
assert(existsSync(join(b4Seam, 'scripts', 'review-surface.mjs')) && !existsSync(join(b4Seam, 'scripts', 'review-session.mjs')),
  'B4：宿主生命周期只有公共模组一份（自带的那一份必须已经删掉）');
await stopHost(hostState(b4SeamSurface.surface));
pass('B4 方法库审阅面（缝上的写入口 / 收件层 / 门 / R7 / R10）');
