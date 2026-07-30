// Shared validation utilities for Planners-Proposal-System

export function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Return value if it's a string matching the given regex; otherwise null.
 */
export function safeId(value, regex) {
  return typeof value === 'string' && regex.test(value) ? value : null;
}

/**
 * Check relative path safety. Returns array with at most one 'unsafe_path' entry.
 * Rejects: leading /, Windows drive letter, backslash, empty segment, '.', '..'.
 */
export function checkSafeRelativePath(value) {
  if (typeof value !== 'string') return ['unsafe_path'];
  if (value.startsWith('/')) return ['unsafe_path'];
  if (/^[A-Za-z]:[\\/]/.test(value)) return ['unsafe_path'];
  if (value.includes('\\')) return ['unsafe_path'];
  const segments = value.split('/');
  for (const seg of segments) {
    if (seg === '' || seg === '.' || seg === '..') return ['unsafe_path'];
  }
  return [];
}

/**
 * Sort errors by (line, field, code) with ASCII comparison.
 */
export function sortErrors(errors) {
  errors.sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    const af = a.field ?? '';
    const bf = b.field ?? '';
    if (af < bf) return -1;
    if (af > bf) return 1;
    if (a.code < b.code) return -1;
    if (a.code > b.code) return 1;
    return 0;
  });
}

/**
 * Create a normalized error object. recordId is normalized via safeId with the given regex.
 */
export function makeError({ line, recordId, code, field, message }, idRegex) {
  return {
    line,
    record_id: safeId(recordId, idRegex),
    code,
    field: field ?? null,
    message,
  };
}

/**
 * Write a single-line JSON summary to stdout.
 */
export function writeSummary({ contract, valid, records, errors }) {
  const output = { contract, valid, records, errors };
  process.stdout.write(JSON.stringify(output) + '\n');
}
