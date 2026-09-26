/**
 * 公共模组的解析适配器（每个消费方一份，约 35 行）。
 *
 * 「公共模组单独发布成条目」意味着：发布后它们与本 Skill **平铺在同一个 skills 根下**，
 * 所以按名字找兄弟目录即可，不需要任何 runtime 专属路径。开发时它们还在 monorepo 里。
 *
 * 找的顺序（票 11 定的约定）：
 *   ① $PLANNERS_MODULES_HOME/<name>
 *   ② 本 Skill 目录的兄弟：<skills-root>/<name>          ← 发布后的主路径
 *   ③ monorepo：02-skills-library/00-system/<name>
 *   ④ 用户级兜底：<安装根>/<name>（$PLANNERS_MODULES_INSTALL_DIR → $PLANNERS_MODULES_HOME
 *      → 默认 ~/.planners-modules；库外，绝不写进 02-skills-library）
 *   ⑤ 都没有 → **自动装**进安装根，装完复验再重解析；装不成才报错
 *      （PLANNERS_NO_AUTO_INSTALL=1 → 只报不装；契约见 planners-modules-install.mjs）
 *
 * 自检：node scripts/lib/planners-modules.mjs --check
 */
import { existsSync, readdirSync } from 'node:fs';
import { LIBRARY_DIR_NAME, ensureModule, installRootFor, moduleNotFound }
  from './planners-modules-install.mjs';
import { dirname, join, resolve, sep } from 'node:path';
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

/**
 * 从 start 往上找 02-skills-library 工作树根（找不到返回 null）。
 * 拿它做硬约束：自动安装的目标**不得位于库工作树内**（否则会再造一个嵌套仓库）。
 */
export function libraryRootFor(start) {
  let current = resolve(start);
  for (let depth = 0; depth < 12; depth += 1) {
    // ① 名字就是库目录（目录被改名也不影响这条之外的判据）
    // ② 这一层**装着**一个叫 02-skills-library 的子目录（不依赖本文件在库里的深度）
    // ③ 这一层同时住着本 Skill 与已知公共模组分发目录（说明它就是 skills 根）
    const subdirs = (() => {
      try {
        return new Set(readdirSync(current));
      } catch {
        return new Set();
      }
    })();
    if (current.endsWith(sep + LIBRARY_DIR_NAME) || subdirs.has(LIBRARY_DIR_NAME)) return current;
    if (subdirs.has('planners-review-core') && subdirs.has('planners-source-index')) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
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
  // ⑤ 兜底（最后一条，绝不遮蔽上面任何一条）：缺依赖时自动装到「库外用户级」安装根；
  //    只报不装（PLANNERS_NO_AUTO_INSTALL=1）时这一条通常是空的。
  out.push(join(installRootFor({ name }).root, name));
  return [...new Set(out)];
}

export function resolveModule(name) {
  for (const c of moduleCandidates(name)) if (existsSync(c)) return c;
  return installModuleThenResolve(name);
}

/**
 * 本地一条都没命中 → 自动装（契约见 planners-modules-install.mjs）。
 * 装失败时错误信息里带着「缺哪个、找过哪些路径、手动怎么装（可复制）」。
 */
function installModuleThenResolve(name) {
  const candidates = moduleCandidates(name);
  const libraryRoot = libraryRootFor(HERE);
  try {
    ensureModule(name, {
      candidates,
      libraryRoot,
      verifyPath: probeName => (existsSync(join(installRootFor({ name: probeName }).root, probeName))
        ? join(installRootFor({ name: probeName }).root, probeName)
        : null),
    });
  } catch (error) {
    // 安装器的错误信息本身已经说清了「缺哪个、找过哪些路径、手动怎么装」，
    // 再套一层只会把它埋掉 —— 原样抛出，另加一句上下文。
    throw new Error(`公共模组 ${name} 不在本地，自动安装也没成功。\n${error.message}`);
  }
  for (const c of moduleCandidates(name)) if (existsSync(c)) return c;
  throw moduleNotFound(name, candidates);
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
