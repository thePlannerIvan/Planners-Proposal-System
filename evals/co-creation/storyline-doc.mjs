import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { assert, pass } from '../lib/assert.mjs';
import { moduleScript } from '../../scripts/lib/planners-modules.mjs';

// 集成分支里的 planners-review-core 还没发布：PLANNERS_REVIEW_CORE_HOME 直接指向检出目录，
// 这里把它接进既有的 PLANNERS_MODULES_HOME 解析顺序；正式环境只靠 planners-modules 找模组。
const localCore = process.env.PLANNERS_REVIEW_CORE_HOME;
if (localCore) {
  const modulesHome = mkdtempSync(join(tmpdir(), 'proposal-core-modules-'));
  symlinkSync(resolve(localCore), join(modulesHome, 'planners-review-core'), 'dir');
  process.env.PLANNERS_MODULES_HOME = modulesHome;
  process.env.PLANNERS_NO_AUTO_INSTALL = '1';
}

const root = resolve(import.meta.dirname, '../..');
const skillRoot = root;
const validator = resolve(skillRoot, 'scripts/validate-storyline-doc.mjs');

function coreScript(relPath) {
  try {
    return moduleScript('planners-review-core', relPath);
  } catch (error) {
    throw new Error(`本测试依赖含 planners-doc/2 的 planners-review-core；`
      + `设 PLANNERS_REVIEW_CORE_HOME=<检出目录> 再跑。\n${error.message}`);
  }
}
const contractValidator = coreScript('scripts/validate-doc.mjs');
const template = resolve(skillRoot, 'templates/storyline.md');
const sample = resolve(root, 'evals/fixtures/labbrand-storyline.md');

function run(script, args, status) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: process.env });
  assert(result.status === status,
    `${script.split('/').pop()} 退出码应为 ${status}，实际 ${result.status}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
const validate = (file, status = 0) => JSON.parse(run(validator, [file], status));

// 页的正文到第一个 `###` 标题块为止；主张与支撑只在这一段里数。
function mapPageBody(text, title, change) {
  const start = text.indexOf(`## ${title}`);
  assert(start >= 0, `样例里找不到页「${title}」`);
  const next = text.indexOf('\n## ', start + 3);
  const end = next === -1 ? text.length : next;
  const body = text.slice(start, end);
  const cut = body.search(/^#{3,6} /m);
  const head = cut === -1 ? body : body.slice(0, cut);
  const tail = cut === -1 ? '' : body.slice(cut);
  return text.slice(0, start) + change(head) + tail + text.slice(end);
}

// 1. 模板与真实样例都先过 planners-doc/2 的结构校验：提案规则不另造解析器。
for (const file of [template, sample]) run(contractValidator, [file], 0);

// 2. 模板：每页一句主张、两三条支撑，页末可选出处（页末连续的引用）。
const templateReceipt = validate(template);
assert(templateReceipt.contract === 'planners-doc/2' && templateReceipt.valid === true,
  '模板必须通过提案校验', JSON.stringify(templateReceipt.errors));
assert(templateReceipt.checked.doc === 'storyline' && templateReceipt.checked.project,
  '模板文档头要有 doc 与 project');
assert(templateReceipt.checked.pages === 3, '模板展示 2 章 3 页', JSON.stringify(templateReceipt.checked));
assert(templateReceipt.checked.claims === templateReceipt.checked.pages, '模板每页都要有主张');
assert(templateReceipt.checked.supports >= templateReceipt.checked.pages * 2, '模板每页至少两条支撑');

// 3. 真实样例：LabbrandCaseStudy 的 10 页主线，每页一句主张加支撑，页末连续的引用即出处。
const sampleReceipt = validate(sample);
assert(sampleReceipt.valid === true, '真实样例必须通过提案校验', JSON.stringify(sampleReceipt.errors));
assert(sampleReceipt.checked.chapters === 5, '样例是 5 章', JSON.stringify(sampleReceipt.checked));
assert(sampleReceipt.checked.pages === 10, '样例是 10 页', JSON.stringify(sampleReceipt.checked));
assert(sampleReceipt.checked.claims === 10, '每页恰好一句主张', JSON.stringify(sampleReceipt.checked));
assert(sampleReceipt.checked.supports === 30, '每页三条支撑', JSON.stringify(sampleReceipt.checked));
const sampleText = readFileSync(sample, 'utf8');
for (const phrase of ['植物节律液（Botanical Circadian Elixir）', '微季候 / MIKORA', '> 笔试任务书：']) {
  assert(sampleText.includes(phrase), `样例要保留真实项目的判断与页末出处：「${phrase}」`);
}
assert(!/^#### /m.test(sampleText), '页是 ##，页内标题块是 ### 起，样例不再有 #### 结构');

// 4. 提案自己的规则：删掉某页支撑 → 被拒；删掉主张 → 被拒；一页两句主张 → 被拒。
const dir = mkdtempSync(join(tmpdir(), 'proposal-storyline-doc-'));
const pageTitle = '用工程链把「有效」做成可交付';

const noSupportPath = join(dir, 'storyline-no-support.md');
writeFileSync(noSupportPath, mapPageBody(sampleText, pageTitle,
  (head) => head.replace(/^- .*$/gm, '').replace(/\n{3,}/g, '\n\n')));
const noSupport = validate(noSupportPath, 1);
const supportError = noSupport.errors.find((error) => error.code === 'page_support_missing');
assert(supportError, '删掉整页支撑必须报 page_support_missing', JSON.stringify(noSupport.errors));
assert(supportError.page.includes(pageTitle), '错误必须点名是哪一页', supportError.page);

const noClaimPath = join(dir, 'storyline-no-claim.md');
writeFileSync(noClaimPath, mapPageBody(sampleText, pageTitle, (head) => head.replace(/^主张：.*$/m, '')));
const noClaim = validate(noClaimPath, 1);
assert(noClaim.errors.some((error) => error.code === 'page_claim_missing'),
  '删掉整页主张必须报 page_claim_missing', JSON.stringify(noClaim.errors));

const doubleClaimPath = join(dir, 'storyline-double-claim.md');
writeFileSync(doubleClaimPath, mapPageBody(sampleText, pageTitle,
  (head) => `${head.trimEnd()}\n\n主张：再补一句不该出现的主张。\n`));
const doubleClaim = validate(doubleClaimPath, 1);
assert(doubleClaim.errors.some((error) => error.code === 'page_claim_multiple'),
  '一页两句主张必须被拒', JSON.stringify(doubleClaim.errors));

// 5. 工作台：真实打开样例，按块读出 10 页；缺锚点由工作台补写并落盘。
const { startDocWorkbench } = await import(pathToFileURL(coreScript('scripts/doc-workbench.mjs')));
const projectDir = mkdtempSync(join(tmpdir(), 'proposal-storyline-workbench-'));
const docPath = join(projectDir, '.planners', 'storyline.md');
mkdirSync(join(projectDir, '.planners'), { recursive: true });
writeFileSync(docPath, sampleText);
const workbench = await startDocWorkbench({ docPath, port: 0 });
try {
  const home = await fetch(workbench.url);
  assert(home.ok && (await home.text()).includes('文字工作台'), '工作台页面必须能打开');
  const response = await fetch(`${workbench.url}/api/doc`);
  assert(response.ok, 'GET /api/doc 必须返回 200');
  const snapshot = await response.json();
  assert(snapshot.contract === 'planners-doc/2' && snapshot.doc === 'storyline' && snapshot.project,
    '工作台要读出文档头三元组');
  assert(snapshot.pages.length === 10, '工作台要按页读出 10 页', JSON.stringify(snapshot.pages.length));
  assert(snapshot.blocks.length >= 40, '工作台要按块读出页与块', JSON.stringify(snapshot.blocks.length));
  for (const page of snapshot.pages) {
    const blocks = snapshot.blocks.filter((block) => block.page.key === page.key);
    assert(blocks.length > 0, `页「${page.title}」必须能按块读出`);
    assert(blocks.some((block) => block.type === 'paragraph'), `页「${page.title}」要读出主张段`);
  }
  assert(snapshot.blocks.every((block) => block.anchor), '打开后每个块都要有锚点');
  assert(workbench.repairs.length > 0, '样例不手写锚点，工作台打开时补写');
  const repairedOnDisk = readFileSync(docPath, 'utf8');
  assert(repairedOnDisk.includes('<!-- b:'), '补写的锚点必须落盘');

  // 在工作台里真的改一块：只换这一块的 raw，落盘后仍然是合规文档。
  const target = snapshot.pages.find((page) => page.title === '微季候 / MIKORA：与节气同频的掌心微节律');
  const claim = snapshot.blocks.find((block) => block.page.key === target.key && block.type === 'paragraph');
  const edited = '主张：微季候 / MIKORA 是三选一的首选推荐：把日常饮升格为与自然节气同频的掌心微节律，支撑 15 元全时段溢价（工作台已改）。';
  const saved = await fetch(`${workbench.url}/api/block`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      anchor: claim.anchor, content: edited, base_sha256: snapshot.sha256, base_block_sha256: claim.sha256,
    }),
  });
  assert(saved.ok, '工作台必须能按块保存这次修改', await saved.text());
  const afterEdit = readFileSync(docPath, 'utf8');
  assert(afterEdit.includes('（工作台已改）'), '修改必须落盘');
  assert(afterEdit.includes('主张：微季候 / MIKORA'), '只改这一块，块内容按主张重新写');
  validate(docPath); // 改完仍要过提案校验
} finally {
  await workbench.close();
}

// 6. SKILL 只描述文档形态与交互；旧 JSON 主稿只作只读兼容。
const skill = readFileSync(resolve(root, 'SKILL.md'), 'utf8');
for (const needle of [
  '.planners/storyline.md',
  'templates/storyline.md',
  'validate-storyline-doc.mjs',
  'doc-workbench.mjs',
]) assert(skill.includes(needle), `SKILL 必须指向新入口：${needle}`);
for (const legacy of ['content_blocks', 'suggested_form', 'contract_version', 'page_number', 'title_intent']) {
  assert(!skill.includes(legacy), `SKILL 不再描述页级 JSON 字段：${legacy}`);
}
assert(skill.includes('page-architecture.json') && skill.includes('只读'),
  'SKILL 要写明旧 page-architecture.json 不再作为新项目入口、旧项目只读');

pass('Storyline 文档：模板与真实样例过校验、删支撑/删主张被拒、工作台按块读出并改通、SKILL 走文档形态');
