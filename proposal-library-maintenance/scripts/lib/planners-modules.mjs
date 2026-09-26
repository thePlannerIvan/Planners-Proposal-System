/**
 * 公共模组的解析适配器（每个消费方一份，约 35 行）。
 *
 * 「公共模组单独发布成条目」意味着：发布后它们与本 Skill **平铺在同一个 skills 根下**，
 * 所以按名字找兄弟目录即可，不需要任何 runtime 专属路径。开发时它们还在 monorepo 里。
 *
 * 找的顺序（票 11 定的约定）：
 *   ① $PLANNERS_MODULES_HOME/<name>
 *   ② 本 Skill 目录的兄弟：<skills-root>/<name>          ← 发布后的主路径
 *   ③ monorepo：02-skills-library/<NN-分类>/<name>
 *   ④ 都没有 → 报错并给安装提示（**不许静默降级成"跳过校验"**）
 *
 * 自检：node scripts/lib/planners-modules.mjs --check
 */
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));   // <...>/scripts/lib

/** 从本文件往上每一级祖先（发布后的平铺布局与 monorepo 的嵌套布局都能覆盖）。 */
function ancestors(start, maxDepth = 6) {
  const out = [];
  let current = resolve(start);
  for (let depth = 0; depth < maxDepth; depth += 1) {
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
    out.push(current);
  }
  return out;
}

export function moduleCandidates(name) {
  const out = [];
  if (process.env.PLANNERS_MODULES_HOME) out.push(join(process.env.PLANNERS_MODULES_HOME, name));
  for (const dir of ancestors(HERE)) {
    out.push(join(dir, name));                                   // 平铺：<skills-root>/<name>
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        // monorepo：<repo>/<NN-分类>/<name>
        if (entry.isDirectory() && /^\d\d-/.test(entry.name)) out.push(join(dir, entry.name, name));
      }
    } catch { /* 读不了就跳过这一级 */ }
  }
  return [...new Set(out)];
}

export function resolveModule(name) {
  for (const candidate of moduleCandidates(name)) if (existsSync(candidate)) return candidate;
  throw new Error(
    `找不到公共模组 ${name}。找过：\n  ` + moduleCandidates(name).join('\n  ')
    + `\n装法：把 ${name} 放进同一个 skills 根目录，或设 PLANNERS_MODULES_HOME 指向它所在目录。`,
  );
}

/** 公共模组里的一个脚本的绝对路径 */
export function moduleScript(name, relPath) {
  const target = join(resolveModule(name), relPath);
  if (!existsSync(target)) throw new Error(`公共模组 ${name} 里没有这个脚本：${relPath}`);
  return target;
}

if (process.argv.includes('--check')) {
  for (const name of ['planners-source-index', 'planners-fact-check', 'planners-review-core']) {
    try {
      const dir = resolveModule(name);
      console.log(`✓ ${name} → ${dir}`);
    } catch (e) {
      console.log(`✗ ${name}：${String(e.message).split('\n')[0]}`);
    }
  }
  console.log('\n候选路径：');
  for (const c of moduleCandidates('planners-source-index')) console.log('  ' + c);
}
