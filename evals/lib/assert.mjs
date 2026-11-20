import { spawnSync } from 'node:child_process';

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function runNode(script, args = [], options = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${script} 失败\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  }
  return result;
}

/** 从 `text` 的第一个 `{` 起按大括号深度截出一个完整对象；字符串里的括号不算。 */
function balancedObject(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}' && (depth -= 1) === 0) return text.slice(start, index + 1);
  }
  return null;
}

/**
 * 解析子进程输出里的 JSON 对象。
 *
 * stdout 前面可能先有 node 自己的提示（例如带代理环境时的
 * `(node:123) [UNDICI-EHPA] Warning: …`），它们不以 `{` 开头，会被跳过；
 * 从第一个以 `{` 开头的行起取第一个能解析的对象。
 *
 * 一个都解析不了就抛错，并把完整 stdout / stderr 带上 —— 不把真正的失败吞成别的样子。
 */
export function firstJsonObject(text, { stdout = text, stderr = '' } = {}) {
  const source = String(text ?? '');
  const lines = source.split(/\r?\n/);
  let offset = 0;
  for (const line of lines) {
    const lead = line.length - line.trimStart().length;
    if (line.trimStart().startsWith('{')) {
      const candidate = balancedObject(source.slice(offset + lead));
      if (candidate !== null) {
        try {
          return JSON.parse(candidate);
        } catch {
          // 这个 `{` 起的不是合法 JSON：试下一个候选行。
        }
      }
    }
    offset += line.length + 1;
  }
  throw new Error(`子进程输出里没有可解析的 JSON 对象\nstdout:\n${stdout}\nstderr:\n${stderr}`);
}

export function jsonOutput(result) {
  return firstJsonObject(result.stdout, { stdout: result.stdout, stderr: result.stderr });
}

export function pass(name, details = '') {
  process.stdout.write(`✓ ${name}${details ? ` — ${details}` : ''}\n`);
}
