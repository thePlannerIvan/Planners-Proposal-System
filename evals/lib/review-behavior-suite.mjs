import { readFileSync } from 'node:fs';
import { assert } from './assert.mjs';

export function checkReviewBehavior(htmlPath, { uploads = false } = {}) {
  const html = readFileSync(htmlPath, 'utf8');
  assert(html.includes('全部页面默认通过') || html.includes('所有页面默认通过'), '页面必须说明默认通过');
  // 迁移（2026-09-26，上缝那一轮）：默认值不再是无条件的 'approve'，而是**产出方给的**
  // `page.default_decision`；必须由人决定的页（事实例外 / 上一轮要求修改）为 null。
  // 守住的行为没变（普通页默认通过、例外页保持待决定），并且更强：默认值必须来自产出方。
  assert(
    html.includes('REVIEW.pages.filter(page => page.default_decision !== null)')
      && html.includes("page.default_decision || 'approve'"),
    '普通页面必须默认通过，必须由人决定的页（事实例外 / 上一轮要求修改）必须保持待决定',
  );
  assert(html.includes("document.querySelectorAll('[data-feedback]').forEach"), '输入反馈必须触发状态变化');
  assert(html.includes("field.value.trim() ? 'revise' : 'approve'"), '非空反馈必须自动切换 revise');
  assert(html.includes('返回 Codex') && html.includes('已完成'), '保存后必须提示返回 Codex');
  assert(html.includes('https://demyth.info'), '页眉页脚必须有 demyth.info');
  assert(html.includes('小红书：阿祖不看 TVC'), '页眉页脚必须有小红书标识');
  assert(html.includes('查看工作信息'), '工程字段必须折叠');
  assert(html.includes('font:16px/1.75'), '基础字号不得过小');
  if (uploads) {
    assert(html.includes('"allowUploads":true') && html.includes('/upload-asset'), '终稿审阅必须启用图片拖拽上传');
  } else {
    assert(html.includes('"allowUploads":false'), '非终稿审阅必须关闭图片上传');
  }
  return { html };
}

/** 上缝之后的新判据（一次覆盖两个面）：R3 / R11 / 缝的写入口 / 不许留旧端点 / 定义不许重复 / 渲染先行。 */
export function checkSeamSurface(htmlPath) {
  const html = readFileSync(htmlPath, 'utf8');
  const markerLines = html.split('\n').filter((line) => line.trim() === '{{REVIEW_BRIDGE}}');
  assert(markerLines.length === 1 && !/src="\{\{REVIEW_BRIDGE\}\}"/.test(html), 'R3：入口只有一个裸着独占一行的注入点');
  assert(html.includes('id="reload"'), 'R11：页面必须有永久可见的刷新出口');
  assert(html.includes('review.write(') && html.includes('review.wake('), '保存与唤醒必须走桥');
  assert(!html.includes('/save-feedback') && !html.includes('/upload-asset'),
    '页面不许再引用自建服务端的端点（那些端点必须由宿主/收件层接过来）');
  // 这一条是被真事逼出来的：模板里曾经有**两份** save()，后一份静默生效，
  // 于是"改了第一份"看起来改好了、其实没生效（判据也跟着假绿）。
  const saves = (html.match(/async function save\(/g) || []).length;
  const completions = (html.match(/function showCompletion\(/g) || []).length;
  assert(saves === 1 && completions === 1,
    '同一个函数不许定义两份（后一份会静默覆盖前一份）', 'save=' + saves + ' showCompletion=' + completions);
  const boot = html.slice(html.indexOf('(async function boot(){'));
  assert(boot.indexOf('render()') < boot.indexOf('await'),
    '渲染必须排在第一个 await 之前（桥是增强，不是氧气）');
  return { html };
}

/**
 * 把页面脚本拿到 node vm 里跑一遍，DOM 换成**会记账的桩**。
 *
 * `localStorage` / `sessionStorage` **一碰就抛**，并记进 `touched`
 * （照抄不透明源 iframe 的真实行为：有插件时页面就在那种帧里）。
 * 返回 `{ made, error, touched, sandbox }`：`made` 是"按 id 记下来的 DOM 桩"，
 * 所以判据可以数真正画出来的节点、可以看某个容器的 innerHTML，也可以按 id 取回控件再点它。
 *
 * 这是**唯一**一份离线渲染桩 —— C4 与 B4 的验收都从这里拿（不各写一份）。
 */
export async function runPageOffline(htmlPath, { bridge = null, dataMarker = 'const REVIEW' } = {}) {
  const vm = await import('node:vm');
  const html = readFileSync(htmlPath, 'utf8');
  const script = (html.match(/<script>([\s\S]*?)<\/script>/g) || [])
    .map((block) => block.replace(/^<script>/, '').replace(/<\/script>$/, ''))
    .find((body) => body.includes(dataMarker));
  if (!script) return { made: {}, error: `页面里找不到内联数据（marker=${dataMarker}）`, touched: [], sandbox: null };
  const made = {};
  const touched = [];
  const stub = (tag) => {
    const target = { tag: tag || null, children: [], innerHTML: '', textContent: '', value: '', disabled: false,
      className: '', id: '', style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {}, contains: () => false } };
    return new Proxy(target, {
      get(t, key) {
        if (key === 'appendChild') return (node) => { t.children.push(node); return node; };
        if (key === 'insertAdjacentHTML') return (where, value) => { t.innerHTML += String(value); };
        if (key === 'querySelectorAll') return () => [];
        if (key === 'querySelector') return (selector) => bySelector(selector);
        if (key === 'addEventListener' || key === 'setAttribute' || key === 'getAttribute'
          || key === 'removeAttribute' || key === 'focus') return () => null;
        if (key in t) return t[key];
        return () => undefined;
      },
      set(t, key, value) {
        // `innerHTML=''` 在真 DOM 里会清空子节点；桩不这么做的话，
        // "重画"会被数成"多画了几项"（判据就变成永远为假的假红）。
        if (key === 'innerHTML' && String(value) === '') t.children.length = 0;
        t[key] = value; return true;
      },
    });
  };
  /** `#id` 走记账表（同一个 id 拿到同一个桩），其它选择器给一次性的桩。 */
  const bySelector = (selector) => (String(selector).startsWith('#') ? (made[String(selector).slice(1)] = made[String(selector).slice(1)] || stub()) : stub());
  const storage = (name) => new Proxy({}, {
    get(_t, key) {
      if (key === 'then') return undefined;
      touched.push(name);
      throw new Error(`Failed to read the '${name}' property: sandboxed and lacks allow-same-origin`);
    },
  });
  const sandbox = {
    document: { getElementById: (id) => (made[id] = made[id] || stub()), querySelectorAll: () => [],
      querySelector: (selector) => bySelector(selector), createElement: (tag) => stub(tag), addEventListener: () => {}, body: stub() },
    window: { get localStorage() { touched.push('window.localStorage'); throw new Error("Failed to read the 'localStorage' property: sandboxed and lacks allow-same-origin"); },
      get sessionStorage() { touched.push('window.sessionStorage'); throw new Error("Failed to read the 'sessionStorage' property: sandboxed and lacks allow-same-origin"); },
      addEventListener: () => {}, location: { reload: () => {} } },
    get localStorage() { touched.push('localStorage'); throw new Error("Failed to read the 'localStorage' property: sandboxed and lacks allow-same-origin"); },
    get sessionStorage() { touched.push('sessionStorage'); throw new Error("Failed to read the 'sessionStorage' property: sandboxed and lacks allow-same-origin"); },
    setTimeout, clearTimeout, requestAnimationFrame: () => 0, console, structuredClone, TextEncoder, URL,
  };
  if (bridge) { sandbox.window.ReviewBridge = bridge; sandbox.ReviewBridge = bridge; }
  try {
    vm.runInNewContext(script, sandbox, { timeout: 5000 });
    return { made, error: null, touched, sandbox };
  } catch (error) {
    return { made, error: String(error.message || error), touched, sandbox };
  }
}

/** 让页面 boot 里的异步握手走完（页面用 setTimeout 兜底，这里等微任务 + 一轮定时器）。 */
export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * 验证 12/13：页面必须能"没有桥也把自己画出来"。
 * 正面对照（没有桥）+ **反面对照**（握手永不返回）都必须完整画出 `units` 个节点。
 * `dataMarker` / `mountId` / `unitTag` 默认是 C4 那面的形状；B4 面传自己的（`const bundle=` / `navList` / `li`）。
 */
export async function checkPageRendersOffline(htmlPath, {
  expectUnits, dataMarker = 'const REVIEW', mountId = 'pages', unitTag = 'article',
} = {}) {
  const units = (run) => ((run.made[mountId] || {}).children || []).filter((node) => node.tag === unitTag).length;
  const offline = await runPageOffline(htmlPath, { dataMarker });
  const expected = expectUnits === undefined ? null : expectUnits;
  assert(!offline.error && units(offline) > 0 && (expected === null || units(offline) === expected),
    '页面必须能"没有桥也把自己画出来"',
    offline.error ? (`脚本当场抛：${offline.error}`) : (`units=${units(offline)}`));
  const stuck = await runPageOffline(htmlPath, { dataMarker, bridge: { connect: () => new Promise(() => {}), transport: 'postMessage' } });
  assert(!stuck.error && units(stuck) > 0 && (expected === null || units(stuck) === expected),
    '反面对照：握手永不返回时页面仍然必须完整画出来',
    stuck.error ? (`脚本当场抛：${stuck.error}`) : (`units=${units(stuck)}`));
  assert(offline.touched.length === 0 && stuck.touched.length === 0,
    '不透明源里不许读 localStorage / sessionStorage（页面少存状态，R7）',
    `碰过：${[...offline.touched, ...stuck.touched].join(', ')}`);
  return { units: units(offline), made: offline.made };
}
