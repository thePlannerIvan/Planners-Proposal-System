import { readFileSync } from 'node:fs';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function resolveRef(root, ref) {
  if (!ref.startsWith('#/')) return null;
  return ref.slice(2).split('/').reduce((node, raw) => {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    return node?.[key];
  }, root);
}

function sameValue(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function validateAgainstSchema(value, schema, root = schema, path = '$', errors = []) {
  if (schema.$ref) {
    const target = resolveRef(root, schema.$ref);
    if (!target) errors.push(`${path}: 无法解析 $ref ${schema.$ref}`);
    else validateAgainstSchema(value, target, root, path, errors);
    return errors;
  }
  if (schema.const !== undefined && !sameValue(value, schema.const)) errors.push(`${path}: 必须等于 ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some(item => sameValue(value, item))) errors.push(`${path}: 不在允许枚举中`);
  const types = schema.type ? (Array.isArray(schema.type) ? schema.type : [schema.type]) : [];
  if (types.length) {
    const ok = types.some(type => {
      if (type === 'null') return value === null;
      if (type === 'object') return isObject(value);
      if (type === 'array') return Array.isArray(value);
      if (type === 'integer') return Number.isInteger(value);
      if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
      return typeof value === type;
    });
    if (!ok) {
      errors.push(`${path}: 类型应为 ${types.join('|')}`);
      return errors;
    }
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: 字符数少于 ${schema.minLength}`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path}: 字符数超过 ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: 不匹配 ${schema.pattern}`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: 小于 ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: 大于 ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: 项数少于 ${schema.minItems}`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path}: 项数超过 ${schema.maxItems}`);
    if (schema.uniqueItems && new Set(value.map(item => JSON.stringify(item))).size !== value.length) errors.push(`${path}: 含重复项`);
    if (schema.items) value.forEach((item, index) => validateAgainstSchema(item, schema.items, root, `${path}[${index}]`, errors));
  }
  if (isObject(value)) {
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) errors.push(`${path}.${key}: 缺少必填字段`);
    if (schema.additionalProperties === false && schema.properties) {
      for (const key of Object.keys(value)) if (!Object.hasOwn(schema.properties, key)) errors.push(`${path}.${key}: 不允许的字段`);
    }
    for (const [key, childSchema] of Object.entries(schema.properties || {})) {
      if (Object.hasOwn(value, key)) validateAgainstSchema(value[key], childSchema, root, `${path}.${key}`, errors);
    }
    if (isObject(schema.additionalProperties)) {
      for (const [key, child] of Object.entries(value)) {
        if (!schema.properties || !Object.hasOwn(schema.properties, key)) validateAgainstSchema(child, schema.additionalProperties, root, `${path}.${key}`, errors);
      }
    }
  }
  return errors;
}

export function parseArtifact(path) {
  const content = readFileSync(path, 'utf8');
  try {
    return { records: [JSON.parse(content)], format: 'json' };
  } catch {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    return { records: lines.map((line, index) => {
      try { return JSON.parse(line); }
      catch (error) { throw new Error(`第 ${index + 1} 行不是合法 JSON：${error.message}`); }
    }), format: 'jsonl' };
  }
}

export function validateFile(inputPath, schemaPath) {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const { records, format } = parseArtifact(inputPath);
  const errors = [];
  records.forEach((record, index) => {
    validateAgainstSchema(record, schema, schema, records.length > 1 ? `$[${index}]` : '$', errors);
  });
  return { valid: errors.length === 0, records: records.length, format, errors };
}
