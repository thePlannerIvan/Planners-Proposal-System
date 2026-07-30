import { createHash } from 'node:crypto';
import {
  existsSync, readFileSync, readdirSync, statSync,
} from 'node:fs';
import { extname, resolve } from 'node:path';
import { extractSpreadsheetText } from './spreadsheet-text.mjs';

const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json', '.jsonl', '.csv', '.tsv', '.yaml', '.yml', '.html']);
const SPREADSHEET_EXTENSIONS = new Set(['.xlsx', '.xlsm', '.xls']);
const SEARCHABLE_EXTENSIONS = new Set([...TEXT_EXTENSIONS, ...SPREADSHEET_EXTENSIONS]);
const FACT_KINDS = new Set(['sourced_fact', 'derived_fact', 'proposal_value', 'non_factual']);
const SEMANTIC_STATUSES = new Set(['pending', 'verified', 'qualified', 'fix_required', 'user_review_required']);
const NUMBER_ATOM = '(?:\\d{1,3}(?:[,，]\\d{3})+|\\d+)(?:\\.\\d+)?';
const UNIT_ATOM = '(?:个百分点|万元|亿元|个月|小时|分钟|公里|m²|km|kg|ml|㎡|%|％|万|亿|元|人|个|家|篇|次|倍|年|月|日|天|周|岁|款|组|项|页|章|阶段|轮|级|分|g|l)';
const NUMBER_PATTERN = new RegExp(
  `[+-]?${NUMBER_ATOM}(?:\\s*${UNIT_ATOM})?(?:\\s*[-–—~至]\\s*[+-]?${NUMBER_ATOM}(?:\\s*${UNIT_ATOM})?)?`,
  'giu',
);
const DERIVED_CUES = /倍|增长率|下降率|百分点|占比|平均|合计|同比|环比|转化率|互动率|评论\/赞|收藏\/赞/;
const SOURCE_CUES = /当前|现状|数据显示|报告|样本|均互动|评论|得分|占比|统计|截至|历史|同比|环比/;
const SPREADSHEET_CACHE = new Map();
const SOURCE_CONTENT_CACHE = new Map();
const GENERIC_TERMS = new Set([
  '当前', '内容', '品牌', '目标', '提升', '方案', '用户', '方向', '系统', '建设',
  '核心', '需要', '表现', '数据', '分析', '报告', '通过', '证明', '说明', '整体',
  '进行', '来自', '其中', '可以', '已经', '一个', '这个', '达到', '增长',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function cleanScalar(value) {
  return String(value ?? '').trim().replace(/^["']|["']$/g, '');
}

function scalar(frontmatter, key) {
  return cleanScalar(frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))?.[1] ?? '');
}

function section(body, name, nextName = null) {
  const end = nextName ? `(?=\\n##\\s*${nextName})` : '$';
  return body.match(new RegExp(`##\\s*${name}\\s*\\n([\\s\\S]*?)${end}`, 'i'))?.[1]?.trim() ?? '';
}

export function splitVisiblePages(raw) {
  return [...raw.replace(/\r\n/g, '\n').matchAll(/(?:^|\n)---\n([\s\S]*?)\n---\n([\s\S]*?)(?=\n---\ncontract_version:|$)/g)]
    .map(match => ({
      page_number: Number(scalar(match[1], 'page_number')),
      title: scalar(match[1], 'page_title'),
      content: section(match[2], 'Page Content', 'Production Notes'),
    }))
    .filter(page => Number.isInteger(page.page_number) && page.page_number > 0);
}

function canonicalUnit(unit) {
  const normalized = String(unit || '').normalize('NFKC').toLowerCase();
  if (normalized === '％') return '%';
  if (normalized === 'km') return '公里';
  return normalized;
}

function multiplier(unit) {
  if (unit === '万' || unit === '万元') return 10_000;
  if (unit === '亿' || unit === '亿元') return 100_000_000;
  return 1;
}

function parseNumberPart(raw, unit) {
  const value = Number(String(raw).replace(/[,，]/g, ''));
  return Number.isFinite(value) ? value * multiplier(unit) : null;
}

function adjacentIdentifier(text, start, end) {
  const before = text[start - 1] || '';
  const after = text[end] || '';
  return /[A-Za-z]/.test(before) || /[A-Za-z]/.test(after);
}

export function numericTokens(text) {
  const tokens = [];
  for (const match of String(text).matchAll(NUMBER_PATTERN)) {
    const raw = match[0].replace(/\s+/g, '').normalize('NFKC');
    const parsed = raw.match(new RegExp(
      `^([+-]?${NUMBER_ATOM})(${UNIT_ATOM})?(?:[-–—~至]([+-]?${NUMBER_ATOM})(${UNIT_ATOM})?)?$`,
      'iu',
    ));
    const unit = canonicalUnit(parsed?.[4] || parsed?.[2] || '');
    const firstUnit = canonicalUnit(parsed?.[2] || unit);
    const secondUnit = canonicalUnit(parsed?.[4] || unit);
    const values = parsed
      ? [
        parseNumberPart(parsed[1], firstUnit),
        parsed[3] ? parseNumberPart(parsed[3], secondUnit) : null,
      ].filter(value => value !== null)
      : [];
    tokens.push({
      raw,
      values,
      unit,
      range: values.length === 2,
      identifier_like: adjacentIdentifier(String(text), match.index, match.index + match[0].length),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return tokens;
}

function normalizedText(value) {
  return String(value)
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(/[“”‘’]/g, '"')
    .trim();
}

function contentSegments(content) {
  const segments = [];
  const blocks = String(content).split(/\n\s*\n/).map(block => block.trim()).filter(Boolean);
  for (const block of blocks) {
    if (/^\|/.test(block)) {
      for (const row of block.split('\n').map(line => line.trim())) {
        if (!row || /^\|?\s*:?-{3,}/.test(row)) continue;
        segments.push(row);
      }
      continue;
    }
    if (/^(?:[-*+]|\d+\.)\s+/.test(block)) {
      segments.push(...block.split('\n').map(line => line.trim()).filter(Boolean));
      continue;
    }
    const sentences = block.split(/(?<=[。！？；])\s*/).map(item => item.trim()).filter(Boolean);
    segments.push(...sentences);
  }
  return segments;
}

export function extractVisibleFacts(copyRaw) {
  const facts = [];
  for (const page of splitVisiblePages(copyRaw)) {
    const candidates = [
      { area: 'title', text: page.title },
      ...contentSegments(page.content).map(text => ({ area: 'content', text })),
    ];
    const areaCounts = new Map();
    for (const candidate of candidates) {
      const tokens = numericTokens(candidate.text);
      if (!tokens.length) continue;
      const sequence = (areaCounts.get(candidate.area) || 0) + 1;
      areaCounts.set(candidate.area, sequence);
      const exactKey = `${page.page_number}\n${candidate.area}\n${normalizedText(candidate.text)}`;
      const lineageKey = `${page.page_number}\n${candidate.area}\n${sequence}`;
      facts.push({
        fact_id: `fact_${sha256(exactKey).slice(0, 16)}`,
        fingerprint: sha256(exactKey),
        lineage_id: `lineage_${sha256(lineageKey).slice(0, 16)}`,
        page_number: page.page_number,
        area: candidate.area,
        claim_text: candidate.text,
        numeric_tokens: tokens,
      });
    }
  }
  return facts;
}

function loadJson(path, fallback) {
  if (!path || !existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function sourceEntries(index) {
  const entries = Array.isArray(index) ? index : index?.sources || index?.files || [];
  return new Map(entries
    .map(item => {
      const sourceId = item.source_id || item.id || sourcePathOf(item);
      return sourceId ? [sourceId, { ...item, source_id: sourceId }] : null;
    })
    .filter(Boolean));
}

function materialPacks(materials) {
  const packs = Array.isArray(materials) ? materials : materials?.packs || [];
  return new Map(packs.map(pack => [Number(pack.page_number), pack]));
}

function sourcePathOf(entry) {
  return entry?.file_path || entry?.path || entry?.relative_path || null;
}

function safeResolve(root, sourcePath) {
  if (!sourcePath || typeof sourcePath !== 'string' || sourcePath.includes('\\')) return null;
  const full = resolve(root, sourcePath);
  return full === root || full.startsWith(`${root}/`) ? full : null;
}

function listTextFiles(path) {
  if (!existsSync(path)) return [];
  const stat = statSync(path);
  if (stat.isFile()) return TEXT_EXTENSIONS.has(extname(path).toLowerCase()) ? [path] : [];
  if (!stat.isDirectory()) return [];
  const files = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) files.push(...listTextFiles(child));
    else if (entry.isFile() && TEXT_EXTENSIONS.has(extname(child).toLowerCase())) files.push(child);
  }
  return files;
}

function sameValue(left, right) {
  return Math.abs(left - right) <= Math.max(1e-9, Math.abs(left) * 1e-8);
}

function roundingTolerance(token) {
  if (token.range || token.values.length !== 1) return 0;
  const normalized = token.raw.normalize('NFKC').replace(/[,，]/g, '');
  const numeric = normalized.match(/[+-]?(\d+)(?:\.(\d+))?/)?.[0] || '';
  const decimals = numeric.includes('.') ? numeric.split('.')[1].length : 0;
  return 0.5 * (10 ** -decimals) * multiplier(token.unit);
}

function unitsCompatible(expected, actual) {
  if (!expected || !actual) return true;
  if (expected === actual) return true;
  if (new Set([expected, actual]).size === 2
    && (new Set([expected, actual]).has('万') && new Set([expected, actual]).has('万元'))) return true;
  if (new Set([expected, actual]).size === 2
    && (new Set([expected, actual]).has('亿') && new Set([expected, actual]).has('亿元'))) return true;
  if (expected === '%' || actual === '%') return false;
  return false;
}

function tokenMatch(expected, actualTokens) {
  for (const actual of actualTokens) {
    if (expected.values.length !== actual.values.length) continue;
    const exact = expected.values.every((value, index) => sameValue(value, actual.values[index]));
    const tolerance = roundingTolerance(expected);
    const rounded = !exact && tolerance > 0
      && expected.values.every((value, index) => {
        const difference = Math.abs(value - actual.values[index]);
        return difference <= tolerance;
      });
    if (!exact && !rounded) continue;
    if (unitsCompatible(expected.unit, actual.unit)) {
      return {
        matched: true,
        rounded,
        exact_unit: expected.unit === actual.unit || (!expected.unit && !actual.unit),
      };
    }
  }
  return { matched: false, rounded: false, exact_unit: false };
}

function contextScoreForToken(rows, token, contextText) {
  if (!contextText) return 0;
  const immediateAnchor = Number.isInteger(token.start)
    ? contextText.slice(Math.max(0, token.start - 8), token.start)
      .match(/[\u3400-\u9fffA-Za-z]+$/)?.[0]?.slice(-4) || ''
    : '';
  let best = 0;
  rows.forEach((row, index) => {
    if (!tokenMatch(token, row.tokens).matched) return;
    const nearby = rows.slice(Math.max(0, index - 1), Math.min(rows.length, index + 2))
      .map(item => item.text)
      .join('\n');
    const anchorBonus = immediateAnchor && nearby.includes(immediateAnchor) ? 4 : 0;
    best = Math.max(best, distinctiveOverlap(contextText, nearby) + anchorBonus);
  });
  return best;
}

function evidenceExcerptForToken(rows, token, contextText) {
  let best = { score: -1, excerpt: '' };
  rows.forEach((row, index) => {
    if (!tokenMatch(token, row.tokens).matched) return;
    const excerpt = rows.slice(Math.max(0, index - 1), Math.min(rows.length, index + 2))
      .map(item => item.text)
      .join('\n')
      .trim()
      .slice(0, 240);
    const score = distinctiveOverlap(contextText, excerpt);
    if (score > best.score) best = { score, excerpt };
  });
  return best.excerpt;
}

function loadSourceContent(fullPath) {
  if (SOURCE_CONTENT_CACHE.has(fullPath)) return SOURCE_CONTENT_CACHE.get(fullPath);
  if (!fullPath || !existsSync(fullPath)) {
    const missing = { ok: false, status: 'source_missing', source_sha256: null };
    SOURCE_CONTENT_CACHE.set(fullPath, missing);
    return missing;
  }
  const stat = statSync(fullPath);
  const extension = extname(fullPath).toLowerCase();
  let combined = '';
  let sourceHash = null;
  let extractionError = null;
  if (stat.isFile() && SPREADSHEET_EXTENSIONS.has(extension)) {
    const extracted = SPREADSHEET_CACHE.get(fullPath) || extractSpreadsheetText(fullPath);
    SPREADSHEET_CACHE.set(fullPath, extracted);
    if (!extracted.ok) {
      const failed = {
        ok: false,
        status: 'binary_requires_visual_check',
        source_sha256: extracted.source_bytes ? sha256(extracted.source_bytes) : null,
        extraction_error: extracted.error,
      };
      SOURCE_CONTENT_CACHE.set(fullPath, failed);
      return failed;
    }
    combined = extracted.text;
    sourceHash = sha256(extracted.source_bytes);
  } else if (stat.isFile() && !TEXT_EXTENSIONS.has(extension)) {
    const failed = { ok: false, status: 'binary_requires_visual_check', source_sha256: null };
    SOURCE_CONTENT_CACHE.set(fullPath, failed);
    return failed;
  } else {
    const files = listTextFiles(fullPath);
    if (!files.length) {
      const failed = { ok: false, status: 'not_found', source_sha256: null };
      SOURCE_CONTENT_CACHE.set(fullPath, failed);
      return failed;
    }
    combined = files.map(file => readFileSync(file, 'utf8')).join('\n');
    sourceHash = sha256(combined);
  }
  const rows = combined.replace(/\r\n/g, '\n').split('\n')
    .map(text => ({ text, tokens: numericTokens(text) }));
  const loaded = {
    ok: true,
    combined,
    rows,
    sourceTokens: rows.flatMap(row => row.tokens),
    source_sha256: sourceHash,
    extraction_error: extractionError,
  };
  SOURCE_CONTENT_CACHE.set(fullPath, loaded);
  return loaded;
}

function verifyAgainstPath(fullPath, tokens, contextText = '') {
  const loaded = loadSourceContent(fullPath);
  if (!loaded.ok) {
    return {
      status: loaded.status,
      source_sha256: loaded.source_sha256,
      matched: [],
      missing: tokens.map(token => token.raw),
      extraction_error: loaded.extraction_error || null,
    };
  }
  const sourceTokens = loaded.sourceTokens;
  const results = tokens.map(token => ({ token, result: tokenMatch(token, sourceTokens) }));
  const matched = results.filter(item => item.result.matched).map(item => item.token.raw);
  const missing = results.filter(item => !item.result.matched).map(item => item.token.raw);
  const anyRounded = results.some(item => item.result.rounded);
  const allExactUnit = results.filter(item => item.result.matched).every(item => item.result.exact_unit);
  return {
    status: missing.length === 0 ? (anyRounded ? 'located_rounded'
      : (allExactUnit ? 'located_exact' : 'located_value_unit_context'))
      : matched.length ? 'partial_match' : 'not_found',
    source_sha256: loaded.source_sha256,
    matched,
    missing,
    context_score: Math.max(0, ...tokens.map(token => contextScoreForToken(loaded.rows, token, contextText))),
    evidence_excerpt: tokens.map(token => evidenceExcerptForToken(loaded.rows, token, contextText))
      .filter(Boolean)
      .join('\n---\n')
      .slice(0, 480),
    extraction_error: loaded.extraction_error,
  };
}

function overlapCount(tokens, text) {
  const other = numericTokens(text);
  return tokens.filter(token => tokenMatch(token, other).matched).length;
}

function lexicalTerms(text) {
  const normalized = String(text).normalize('NFKC').toLowerCase();
  const terms = new Set(normalized.match(/[a-z]{3,}|\d+(?:\.\d+)?/g) || []);
  for (const sequence of normalized.match(/[\u3400-\u9fff]{2,}/g) || []) {
    for (let index = 0; index < sequence.length - 1; index += 1) terms.add(sequence.slice(index, index + 2));
  }
  return terms;
}

function lexicalOverlap(left, right) {
  const leftTerms = lexicalTerms(left);
  const rightTerms = lexicalTerms(right);
  let count = 0;
  for (const term of leftTerms) if (rightTerms.has(term)) count += 1;
  return count;
}

function distinctiveOverlap(left, right) {
  const leftTerms = lexicalTerms(left);
  const rightTerms = lexicalTerms(right);
  let count = 0;
  for (const term of leftTerms) {
    if (/^\d/.test(term) || GENERIC_TERMS.has(term)) continue;
    if (rightTerms.has(term)) count += 1;
  }
  return count;
}

function candidatesForToken(fact, token, pack, entries, sourceRoot) {
  const candidates = [];
  const companionTokens = fact.numeric_tokens.filter(item => item !== token && !item.identifier_like);
  for (const material of pack?.materials || []) {
    const sourceId = material.source || material.source_id;
    const entry = entries.get(sourceId);
    const sourcePath = sourcePathOf(entry);
    if (!entry || !sourcePath) continue;
    const excerptText = [
      material.excerpt, material.location, material.supports, material.used_in, material.note,
    ].filter(Boolean).join('\n');
    const excerptMatches = overlapCount([token], excerptText);
    const fullPath = safeResolve(sourceRoot, sourcePath);
    const sourceIsDirectory = Boolean(fullPath && existsSync(fullPath) && statSync(fullPath).isDirectory());
    const mechanical = verifyAgainstPath(fullPath, [token], fact.claim_text);
    const companionMatches = companionTokens.length
      ? verifyAgainstPath(fullPath, companionTokens).matched.length
      : 0;
    const localCompanionMatches = companionTokens.length
      ? overlapCount(companionTokens, mechanical.evidence_excerpt || '')
      : 0;
    const locatedCount = mechanical.matched.length;
    const termMatches = distinctiveOverlap(pack?.claim || '', excerptText);
    if (!excerptMatches
      && !(locatedCount && (mechanical.context_score >= 2 || termMatches >= 2 || companionMatches >= 1))) continue;
    candidates.push({
      source_id: sourceId,
      source_path: sourcePath,
      locator: material.location || '',
      excerpt_matches: excerptMatches,
      mechanical_status: mechanical.status,
      matched_numeric_tokens: mechanical.matched,
      missing_numeric_tokens: mechanical.missing,
      source_sha256: mechanical.source_sha256,
      context_score: mechanical.context_score,
      evidence_excerpt: mechanical.evidence_excerpt,
      companion_matches: companionMatches,
      local_companion_matches: localCompanionMatches,
      source_is_directory: sourceIsDirectory,
      score: excerptMatches * 20 + mechanical.context_score * 5 + termMatches * 2
        + locatedCount + Math.min(companionMatches, 3) * 2
        + Math.min(localCompanionMatches, 3) * 10 + (sourceIsDirectory ? 0 : 3),
    });
  }
  for (const [sourceId, entry] of entries) {
    const sourcePath = sourcePathOf(entry);
    const fullPath = safeResolve(sourceRoot, sourcePath);
    const sourceIsDirectory = Boolean(fullPath && existsSync(fullPath) && statSync(fullPath).isDirectory());
    const extension = extname(sourcePath || '').toLowerCase();
    const searchable = fullPath && existsSync(fullPath)
      && (statSync(fullPath).isDirectory() || SEARCHABLE_EXTENSIONS.has(extension));
    if (!sourcePath || !searchable) continue;
    if (['unread', 'duplicate_or_derived'].includes(entry.read_mode)) continue;
    const mechanical = verifyAgainstPath(fullPath, [token], fact.claim_text);
    if (!['located_exact', 'located_value_unit_context', 'located_rounded'].includes(mechanical.status)) continue;
    const companionMatches = companionTokens.length
      ? verifyAgainstPath(fullPath, companionTokens).matched.length
      : 0;
    const localCompanionMatches = companionTokens.length
      ? overlapCount(companionTokens, mechanical.evidence_excerpt || '')
      : 0;
    const indexContext = [
      entry.scope,
      entry.note,
      entry.key_data,
      entry.key_findings,
      ...(entry.answers || []),
    ].filter(Boolean).join('\n');
    const indexMatches = distinctiveOverlap(fact.claim_text, indexContext);
    if ((mechanical.context_score || 0) < 2 && indexMatches < 2 && companionMatches < 1) continue;
    candidates.push({
      source_id: sourceId,
      source_path: sourcePath,
      locator: entry.locator || entry.scope || '',
      excerpt_matches: 0,
      mechanical_status: mechanical.status,
      matched_numeric_tokens: mechanical.matched,
      missing_numeric_tokens: mechanical.missing,
      source_sha256: mechanical.source_sha256,
      context_score: mechanical.context_score,
      evidence_excerpt: mechanical.evidence_excerpt,
      companion_matches: companionMatches,
      local_companion_matches: localCompanionMatches,
      source_is_directory: sourceIsDirectory,
      score: 10 + (mechanical.context_score || 0) * 5 + indexMatches * 2
        + Math.min(companionMatches, 3) * 2
        + Math.min(localCompanionMatches, 3) * 10 + (sourceIsDirectory ? 0 : 3),
    });
  }
  const bySource = new Map();
  for (const candidate of candidates) {
    const previous = bySource.get(candidate.source_id);
    if (!previous || candidate.score > previous.score) bySource.set(candidate.source_id, candidate);
  }
  return [...bySource.values()].sort((left, right) => right.score - left.score);
}

function classificationForToken(fact, token, tokenPosition, candidates) {
  const escaped = token.raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const productIdentifier = new RegExp(`(?:pi\\s*plus|astro\\s*plus|speed|q)\\s*${escaped}(?:k)?`, 'i').test(fact.claim_text);
  if (token.identifier_like || productIdentifier || /^\s*(?:step\s*)?\d+[.、)]/i.test(fact.claim_text)
    || /双\s*11|618|说「|写「/.test(fact.claim_text)) {
    return { kind: 'non_factual', confidence: 'high', locked: false, reason: '名称、编号或示例数字' };
  }
  if (token.unit === '个百分点') {
    return { kind: 'derived_fact', confidence: 'high', locked: true, reason: '百分点必须由基线和目标复算' };
  }
  const tokenIndex = Number.isInteger(token.start) ? token.start : fact.claim_text.indexOf(token.raw);
  const tokenContext = tokenIndex >= 0
    ? fact.claim_text.slice(Math.max(0, tokenIndex - 18), Math.min(fact.claim_text.length, token.end + 12))
    : fact.claim_text;
  const before = tokenIndex >= 0 ? fact.claim_text.slice(0, tokenIndex) : '';
  const after = tokenIndex >= 0 ? fact.claim_text.slice(token.end) : '';
  const proposalTransition = /目标|建议|计划|预计|争取|做到|应|需|将|希望|控制|提升|增长|增加/.test(fact.claim_text);
  const fromAt = proposalTransition ? before.lastIndexOf('从') : -1;
  const transitionMatch = fromAt >= 0
    ? fact.claim_text.slice(fromAt).match(/提升(?:到|至)|增长(?:到|至)|增加(?:到|至)|降(?:到|至)|控制(?:到|至)|到|至/)
    : null;
  const transitionAt = transitionMatch ? fromAt + transitionMatch.index : -1;
  if (transitionAt >= 0 && token.end <= transitionAt) {
    return { kind: 'sourced_fact', confidence: 'high', locked: false, reason: '从A到B关系中的当前基线' };
  }
  if (transitionAt >= 0 && tokenIndex > transitionAt) {
    return { kind: 'proposal_value', confidence: 'high', locked: false, reason: '从A到B关系中的目标值' };
  }
  if (/目标不是|并非目标|不是目标/.test(before.slice(-24))) {
    const best = candidates[0];
    if (best) return { kind: 'sourced_fact', confidence: 'high', locked: false, reason: '目标反例中的外部参照值' };
  }
  if (/(?:目标|建议|计划|预计|争取|做到|控制在|周更|月更|预算侧重|预算建议)(?:[^，。；|]{0,12})$/.test(before)) {
    return { kind: 'proposal_value', confidence: 'high', locked: false, reason: '数字直接受目标或建议谓语支配' };
  }
  if (/(?:当前|现有|目前|截至)(?:[^，。；|]{0,16})$/.test(before)) {
    return { kind: 'sourced_fact', confidence: 'high', locked: false, reason: '数字直接受当前事实谓语支配' };
  }
  if (/^(?:当前|现有|目前|截至)/.test(fact.claim_text) && candidates[0]) {
    return { kind: 'sourced_fact', confidence: 'high', locked: false, reason: '整条陈述描述当前事实且存在候选来源' };
  }
  if (fact.claim_text.includes(`${token.raw}+`) && /意味着|代表|基准|目标/.test(fact.claim_text)) {
    return { kind: 'proposal_value', confidence: 'high', locked: false, reason: '方案阈值的后续解释' };
  }
  const inferred = inferDerivation(fact, token, tokenPosition);
  if (inferred && (/合计|共计|总计|倍|百分点/.test(tokenContext) || token.range)) {
    return { kind: 'derived_fact', confidence: 'high', locked: true, reason: '存在可机械复算的显式计算关系' };
  }
  if (token.values.length === 1
    && fact.numeric_tokens.slice(0, tokenPosition).some(item => item.range)
    && /共|合计|总计|历时|持续/.test(fact.claim_text)) {
    return { kind: 'derived_fact', confidence: 'high', locked: true, reason: '区间数量可机械复算' };
  }
  const best = candidates[0];
  const allLocated = best
    && (best.excerpt_matches > 0 || best.context_score >= 2
      || (best.local_companion_matches >= 1 && !best.source_is_directory))
    && ['located_exact', 'located_value_unit_context', 'located_rounded'].includes(best.mechanical_status);
  if (allLocated && best.missing_numeric_tokens.length === 0) {
    const structuralMatch = !best.source_is_directory
      && fact.numeric_tokens.length > 1
      && best.local_companion_matches >= fact.numeric_tokens.length - 1;
    const strongContext = best.excerpt_matches > 0 || best.context_score >= 4 || structuralMatch;
    return {
      kind: 'sourced_fact',
      confidence: strongContext ? 'high' : 'medium',
      locked: false,
      reason: strongContext ? '来源中找到数值与明确相关语境' : '来源中找到数值，但语境仍需确认',
    };
  }
  if (DERIVED_CUES.test(tokenContext)
    && (tokenPosition >= 2 || /倍|百分点|合计/.test(tokenContext))) {
    return { kind: 'derived_fact', confidence: 'medium', locked: false, reason: '局部语境包含计算关系' };
  }
  if (SOURCE_CUES.test(tokenContext) && best) {
    return { kind: 'sourced_fact', confidence: 'medium', locked: false, reason: '事实谓语且存在候选来源' };
  }
  if (after.startsWith('+') && /目标|阈值|基准/.test(fact.claim_text)) {
    return { kind: 'proposal_value', confidence: 'medium', locked: false, reason: '方案阈值' };
  }
  return { kind: 'pending', confidence: 'low', locked: false, reason: '脚本无法确定语义角色' };
}

function itemDecisionFields(previous) {
  if (!previous) return {};
  return {
    kind: previous.kind,
    source_id: previous.source_id,
    source_path: previous.source_path,
    locator: previous.locator,
    derivation: previous.derivation,
  };
}

function selectCandidate(candidates, prior, preserveRequested = false) {
  const requestedPath = prior?.source_path;
  if (requestedPath) {
    const selected = candidates.find(candidate => candidate.source_path === requestedPath);
    if (preserveRequested) return selected || null;
    const best = candidates[0];
    if (selected && (!best || selected.score + 15 >= best.score)) return selected;
  }
  return candidates[0] || null;
}

function derivationResult(derivation) {
  if (!derivation || !Array.isArray(derivation.operands) || derivation.operands.length < 2) return null;
  const operands = derivation.operands.map(Number);
  if (operands.some(value => !Number.isFinite(value))) return null;
  const [left, right] = operands;
  let calculated;
  if (derivation.operator === 'add') calculated = operands.reduce((sum, value) => sum + value, 0);
  else if (derivation.operator === 'subtract') calculated = operands.slice(1).reduce((value, next) => value - next, left);
  else if (derivation.operator === 'multiply') calculated = operands.reduce((value, next) => value * next, 1);
  else if (derivation.operator === 'divide' && right !== 0) calculated = left / right;
  else if (derivation.operator === 'inclusive_range_count') calculated = Math.abs(right - left) + 1;
  else return null;
  const displayed = Number(derivation.displayed_value);
  if (!Number.isFinite(displayed)) return { calculated, valid: false };
  const tolerance = Number.isFinite(Number(derivation.tolerance)) ? Number(derivation.tolerance) : Math.max(0.01, Math.abs(displayed) * 0.01);
  let valid;
  if (derivation.comparison === 'at_least') valid = calculated + tolerance >= displayed;
  else if (derivation.comparison === 'at_most') valid = calculated - tolerance <= displayed;
  else valid = Math.abs(calculated - displayed) <= tolerance;
  return { calculated, valid };
}

function inferDerivation(fact, token, tokenIndex) {
  if (token.values.length !== 1) return null;
  const displayedValue = token.values[0];
  const earlier = fact.numeric_tokens.slice(0, tokenIndex);
  const range = [...earlier].reverse().find(item => item.range && item.values.length === 2);
  if (range && /共|合计|总计|个月|天数|周数/.test(fact.claim_text)) {
    return {
      operands: range.values,
      operator: 'inclusive_range_count',
      displayed_value: displayedValue,
      comparison: 'equal',
    };
  }
  const sameUnit = earlier.filter(item => item.values.length === 1 && item.unit === token.unit);
  const singles = sameUnit.length >= 2 ? sameUnit : earlier.filter(item => item.values.length === 1);
  if (singles.length < 2) return null;
  const [leftToken, rightToken] = singles.slice(-2);
  if (token.unit === '个百分点') {
    return {
      operands: [rightToken.values[0], leftToken.values[0]],
      operator: 'subtract',
      displayed_value: displayedValue,
      comparison: /约|左右/.test(fact.claim_text) ? 'equal' : 'equal',
      tolerance: /约|左右/.test(fact.claim_text) ? 1 : 0.01,
    };
  }
  const leftAt = fact.claim_text.lastIndexOf(leftToken.raw);
  const targetAt = fact.claim_text.lastIndexOf(token.raw);
  const expression = leftAt >= 0 && targetAt > leftAt
    ? fact.claim_text.slice(leftAt, targetAt + token.raw.length)
    : fact.claim_text;
  let operator = null;
  if (/[+＋加]/.test(expression) || /合计|共计|总计/.test(expression)) operator = 'add';
  else if (/[-−－减]/.test(expression)) operator = 'subtract';
  else if (/[×*乘]/.test(expression)) operator = 'multiply';
  else if (/[÷/]/.test(expression) || /倍/.test(token.raw)) operator = 'divide';
  if (!operator) return null;
  return {
    operands: [leftToken.values[0], rightToken.values[0]],
    operator,
    displayed_value: displayedValue,
    comparison: /至少|以上|超过/.test(expression) ? 'at_least'
      : (/至多|以下|不超过/.test(expression) ? 'at_most' : 'equal'),
  };
}

function derivationInputsTraceable(fact, item) {
  const operands = item.derivation?.operands || [];
  const otherValues = (fact.items || [])
    .filter(other => other.token_id !== item.token_id)
    .flatMap(other => other.values || []);
  const visibleInFact = operands
    .every(operand => otherValues.some(value => sameValue(Number(operand), Number(value))));
  const locatedInSource = Boolean(item.source_path)
    && item.missing_numeric_tokens?.length === 0
    && ['located_exact', 'located_value_unit_context', 'located_rounded'].includes(item.mechanical_status);
  return visibleInFact || locatedInSource;
}

export function semanticReviewReasons(fact) {
  const reasons = new Set();
  const kinds = new Set((fact.items || []).map(item => item.kind).filter(kind => FACT_KINDS.has(kind)));
  if (kinds.size > 1) reasons.add('同一陈述混合了来源事实、方案数字或衍生数字');
  for (const item of fact.items || []) {
    if (item.kind_locked && item.kind !== item.suggested_kind) reasons.add(`${item.raw} 的计算性质被覆盖`);
    if (item.suggested_kind !== 'pending' && item.kind !== item.suggested_kind) {
      reasons.add(`${item.raw} 的最终分类与脚本建议不同`);
    }
    if (item.classification_confidence === 'medium') {
      reasons.add(`${item.raw} 的数字性质只有中等置信，需要结合整句确认`);
    }
    const chosen = (item.source_candidates || []).find(candidate => candidate.source_path === item.source_path)
      || item.source_candidates?.[0];
    if (item.kind === 'sourced_fact'
      && item.mechanical_status === 'located_value_unit_context'
      && (chosen?.context_score || 0) < 4) {
      reasons.add(`${item.raw} 只定位到数值，指标或单位语境较弱`);
    }
    if (item.kind === 'sourced_fact' && chosen && (chosen.context_score || 0) < 2
      && !(chosen.excerpt_matches > 0)) {
      reasons.add(`${item.raw} 的来源语义匹配较弱`);
    }
  }
  const hasExternallyCheckableFact = (fact.items || [])
    .some(item => item.kind === 'sourced_fact' || item.kind === 'derived_fact');
  if (hasExternallyCheckableFact
    && /证明|意味着|必然|高度一致|最高|最低|最强|领先|远未触及/.test(fact.claim_text)) {
    reasons.add('数字被用于较强的因果、比较或判断结论');
  }
  return [...reasons];
}

export function buildAudit({
  copyPath, sourceIndexPath, materialsPath, sourceRoot, previousAuditPath,
}) {
  const copyRaw = readFileSync(copyPath, 'utf8');
  const index = loadJson(sourceIndexPath, { sources: [] });
  const materials = loadJson(materialsPath, { packs: [] });
  const entries = sourceEntries(index);
  const packs = materialPacks(materials);
  const previous = loadJson(previousAuditPath, { facts: [] });
  const previousExact = new Map((previous.facts || []).map(fact => [fact.fingerprint, fact]));
  const previousLineage = new Map((previous.facts || []).map(fact => [fact.lineage_id, fact]));

  const facts = extractVisibleFacts(copyRaw).map(fact => {
    const exactPrior = previousExact.get(fact.fingerprint);
    const lineagePrior = exactPrior || previousLineage.get(fact.lineage_id);
    const exactUnchanged = Boolean(exactPrior);
    const priorItems = new Map((lineagePrior?.items || []).map(item => [item.token_id || item.raw, item]));
    let sourceUnchanged = true;
    let classificationChanged = false;
    const items = fact.numeric_tokens.map((token, index) => {
      const tokenId = `token_${sha256(`${fact.fingerprint}\n${index}\n${token.raw}`).slice(0, 16)}`;
      const lineageTokenId = `${index}:${token.raw}`;
      const prior = priorItems.get(tokenId)
        || priorItems.get(lineageTokenId)
        || (lineagePrior?.items || [])[index]
        || null;
      const inherited = itemDecisionFields(prior);
      const candidates = candidatesForToken(fact, token, packs.get(fact.page_number), entries, sourceRoot);
      const selected = selectCandidate(
        candidates,
        prior,
        lineagePrior?.semantic_status === 'user_review_required',
      );
      const classification = classificationForToken(fact, token, index, candidates);
      const suggestion = classification.kind;
      const inheritedKind = FACT_KINDS.has(inherited.kind) ? inherited.kind : null;
      const kind = classification.locked || !inheritedKind
        ? (FACT_KINDS.has(suggestion) ? suggestion : 'pending')
        : inheritedKind;
      if (inheritedKind && inheritedKind !== kind) classificationChanged = true;
      const inheritedEntry = inherited.source_id ? entries.get(inherited.source_id) : null;
      const chosenPath = kind === 'sourced_fact'
        ? (selected?.source_path || inherited.source_path || sourcePathOf(inheritedEntry) || null)
        : (kind === 'derived_fact'
          ? (inherited.source_path || sourcePathOf(inheritedEntry) || null)
          : null);
      let chosenCandidate = chosenPath
        ? candidates.find(candidate => candidate.source_path === chosenPath) || selected
        : selected;
      if (chosenPath && (!chosenCandidate || chosenCandidate.source_path !== chosenPath)) {
        const mechanical = verifyAgainstPath(safeResolve(sourceRoot, chosenPath), [token]);
        chosenCandidate = {
          source_id: inherited.source_id || null,
          source_path: chosenPath,
          locator: inherited.locator || '',
          excerpt_matches: 0,
          mechanical_status: mechanical.status,
          matched_numeric_tokens: mechanical.matched,
          missing_numeric_tokens: mechanical.missing,
          source_sha256: mechanical.source_sha256,
          score: 0,
        };
      }
      const inferredDerivation = kind === 'derived_fact' ? inferDerivation(fact, token, index) : null;
      const inheritedDerivation = inherited.derivation || null;
      const derivation = derivationResult(inheritedDerivation)?.valid
        ? inheritedDerivation
        : inferredDerivation;
      if (kind === 'derived_fact' && chosenPath && Array.isArray(derivation?.operands)) {
        const operandTokens = derivation.operands.map(value => ({
          raw: String(value),
          values: [Number(value)],
          unit: '',
          range: false,
          identifier_like: false,
        }));
        const mechanical = verifyAgainstPath(safeResolve(sourceRoot, chosenPath), operandTokens);
        chosenCandidate = {
          ...(chosenCandidate || {}),
          source_id: inherited.source_id || chosenCandidate?.source_id || null,
          source_path: chosenPath,
          locator: inherited.locator || chosenCandidate?.locator || '',
          mechanical_status: mechanical.status,
          matched_numeric_tokens: mechanical.matched,
          missing_numeric_tokens: mechanical.missing,
          source_sha256: mechanical.source_sha256,
        };
      }
      if (exactPrior && ['sourced_fact', 'derived_fact'].includes(kind)
        && prior?.source_path && prior?.source_sha256
        && lineagePrior?.semantic_status !== 'user_review_required') {
        if (chosenCandidate?.source_path !== prior.source_path) sourceUnchanged = false;
        if (!chosenCandidate?.source_sha256 || prior.source_sha256 !== chosenCandidate.source_sha256) {
          sourceUnchanged = false;
        }
      }
      return {
        token_id: tokenId,
        lineage_token_id: lineageTokenId,
        ...token,
        suggested_kind: suggestion,
        classification_reason: classification.reason,
        classification_confidence: classification.confidence,
        kind_locked: classification.locked,
        kind,
        source_id: chosenCandidate?.source_id || inherited.source_id || null,
        source_path: chosenPath,
        locator: inherited.locator || chosenCandidate?.locator || '',
        source_candidates: candidates.slice(0, 5),
        mechanical_status: ['proposal_value', 'non_factual'].includes(kind)
          ? 'not_applicable'
          : chosenCandidate?.mechanical_status || 'unresolved',
        matched_numeric_tokens: chosenCandidate?.matched_numeric_tokens || [],
        missing_numeric_tokens: chosenCandidate?.missing_numeric_tokens || [token.raw],
        source_sha256: chosenCandidate?.source_sha256 || null,
        derivation,
        derivation_result: kind === 'derived_fact' ? derivationResult(derivation) : null,
      };
    });
    let semanticStatus = SEMANTIC_STATUSES.has(lineagePrior?.semantic_status)
      ? lineagePrior.semantic_status : 'pending';
    let carryState = 'new';
    if (exactUnchanged && sourceUnchanged) carryState = 'unchanged';
    else if (lineagePrior) {
      carryState = 'changed_needs_semantic_recheck';
      semanticStatus = 'pending';
    }
    if (exactPrior && !sourceUnchanged) {
      carryState = 'source_changed_needs_semantic_recheck';
      semanticStatus = 'pending';
    }
    if (classificationChanged) {
      carryState = 'classification_changed_needs_semantic_recheck';
      semanticStatus = 'pending';
    }
    const builtFact = {
      ...fact,
      items,
      semantic_status: semanticStatus,
      semantic_notes_zh: lineagePrior?.semantic_notes_zh || '',
      carry_state: carryState,
    };
    const semanticReasons = semanticReviewReasons(builtFact);
    const policyChanged = previous.audit_policy_version !== 'strict-three-exit/1.1.0';
    if (policyChanged && semanticReasons.length) {
      builtFact.semantic_status = 'pending';
      builtFact.semantic_notes_zh = '';
      builtFact.carry_state = 'policy_changed_needs_semantic_recheck';
    }
    builtFact.semantic_review_reasons = semanticReasons;
    return builtFact;
  });

  const summary = summarizeFacts(facts);
  return {
    contract_version: '2.0.0',
    audit_policy_version: 'strict-three-exit/1.1.0',
    generated_at: new Date().toISOString(),
    copy_path: copyPath,
    copy_sha256: sha256(copyRaw),
    source_index_path: sourceIndexPath,
    materials_path: materialsPath,
    source_root: sourceRoot,
    summary,
    facts,
    instructions_zh: '脚本完成数字覆盖、Excel/文本回源、候选证据与简单公式复算。模型只处理 fact-audit-review-queue：查证后确认、加限定、修改文案，或标记 user_review_required 交给用户。不得改 kind 绕过计算，不使用 Python 补机械字段。',
  };
}

export function summarizeFacts(facts) {
  const items = facts.flatMap(fact => fact.items || []);
  return {
    total_facts: facts.length,
    total_numbers: items.length,
    pending_classification: items.filter(item => item.kind === 'pending').length,
    pending_semantic: facts.filter(fact => fact.semantic_status === 'pending').length,
    needs_attention: items.filter(item => ['unresolved', 'source_missing', 'not_found', 'partial_match'].includes(item.mechanical_status)).length,
    carried_unchanged: facts.filter(fact => fact.carry_state === 'unchanged').length,
    changed: facts.filter(fact => fact.carry_state !== 'unchanged' && fact.carry_state.includes('changed')).length,
    by_suggested_kind: Object.fromEntries(
      [...new Set(items.map(item => item.suggested_kind))]
        .sort()
        .map(kind => [kind, items.filter(item => item.suggested_kind === kind).length]),
    ),
  };
}

export function classifyAuditIssues(current) {
  const hardErrors = [];
  const humanReviewRequired = [];
  const addHumanReview = (fact, item, reason) => {
    humanReviewRequired.push({
      fact_id: fact.fact_id,
      page_number: fact.page_number,
      claim_text: fact.claim_text,
      raw: item.raw,
      reason,
      source_id: item.source_id || null,
      source_path: item.source_path || null,
      locator: item.locator || '',
      mechanical_status: item.mechanical_status,
    });
  };
  for (const fact of current.facts || []) {
    const label = `${fact.fact_id}（P${fact.page_number}）`;
    if (!SEMANTIC_STATUSES.has(fact.semantic_status) || fact.semantic_status === 'pending') {
      hardErrors.push(`${label}: 尚未完成语义核对`);
    }
    if (fact.semantic_status === 'fix_required') hardErrors.push(`${label}: 文案或来源仍需修正`);
    if (fact.semantic_status === 'user_review_required') {
      if (!(fact.semantic_notes_zh || '').trim()) {
        hardErrors.push(`${label}: 提交用户决定时必须简要说明不确定点`);
      } else {
        const representative = (fact.items || []).find(item => item.source_path) || {};
        addHumanReview(fact, {
          raw: (fact.items || []).map(item => item.raw).join('、'),
          source_id: representative.source_id || null,
          source_path: representative.source_path || null,
          locator: representative.locator || '',
          mechanical_status: 'semantic_user_review',
        }, fact.semantic_notes_zh.trim());
      }
    }
    if ((fact.semantic_review_reasons || []).length
      && ['verified', 'qualified'].includes(fact.semantic_status)
      && !(fact.semantic_notes_zh || '').trim()) {
      hardErrors.push(`${label}: 高风险语义项必须记录简短判断`);
    }
    for (const item of fact.items || []) {
      const itemLabel = `${label}/${item.raw}`;
      if (!FACT_KINDS.has(item.kind)) hardErrors.push(`${itemLabel}: 尚未确认数字性质`);
      if (item.kind_locked && item.kind !== item.suggested_kind) {
        hardErrors.push(`${itemLabel}: 计算性质由脚本锁定，不能通过改 kind 绕过`);
      }
      if (item.kind === 'proposal_value'
        && !['qualified', 'user_review_required'].includes(fact.semantic_status)) {
        hardErrors.push(`${itemLabel}: 含方案数字的事实必须标为 qualified`);
      }
      if (item.kind === 'sourced_fact') {
        if (!item.source_path) {
          hardErrors.push(`${itemLabel}: 来源事实缺少 source_path`);
        } else if (item.mechanical_status === 'source_missing') {
          hardErrors.push(`${itemLabel}: 来源文件不存在`);
        } else if (['not_found', 'partial_match', 'unresolved'].includes(item.mechanical_status)
          && fact.semantic_status !== 'user_review_required') {
          hardErrors.push(`${itemLabel}: 指定来源无法支持该数值（${item.mechanical_status}）`);
        } else if (!['located_exact', 'located_value_unit_context'].includes(item.mechanical_status)
          && fact.semantic_status !== 'user_review_required') {
          addHumanReview(
            fact,
            item,
            item.mechanical_status === 'binary_requires_visual_check'
              ? '来源为二进制文件，脚本无法直接读取该数值'
              : `脚本未能在来源文件中直接定位该数值（${item.mechanical_status}）`,
          );
        }
      }
      if (item.kind === 'derived_fact') {
        if (!item.derivation_result?.valid) hardErrors.push(`${itemLabel}: 衍生数字缺少可复算公式或计算不成立`);
        if (!derivationInputsTraceable(fact, item)) {
          hardErrors.push(`${itemLabel}: 衍生公式输入未在同一事实或指定来源中出现`);
        }
        if (item.source_path && item.mechanical_status === 'source_missing') {
          hardErrors.push(`${itemLabel}: 衍生公式来源文件不存在`);
        } else if (item.source_path
          && !['located_exact', 'located_value_unit_context'].includes(item.mechanical_status)
          && fact.semantic_status !== 'user_review_required') {
          addHumanReview(fact, item, `脚本未能在衍生公式来源中直接定位全部输入（${item.mechanical_status}）`);
        }
      }
    }
  }
  return {
    hard_errors: [...new Set(hardErrors)],
    human_review_required: humanReviewRequired,
  };
}

export function validateAudit(current) {
  const issues = classifyAuditIssues(current);
  return [
    ...issues.hard_errors,
    ...issues.human_review_required.map(item => (
      `${item.fact_id}（P${item.page_number}）/${item.raw}: ${item.reason}，必须提交人工审阅`
    )),
  ];
}
