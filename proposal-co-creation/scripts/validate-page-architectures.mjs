#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { isPlainObject, sortErrors, writeSummary } from './lib/validation-utils.mjs';

const CONTRACT = 'page-architecture/2.0.0';
const PJ_ID_RE = /^pj_[a-f0-9]{24}$/;
const SECTION_ID_RE = /^sec-[a-z0-9][a-z0-9-]{1,47}$/;
const FORMS = new Set([
  'paragraph', 'list', 'table', 'chart', 'image', 'comparison',
  'matrix', 'model', 'roadmap', 'timeline', 'case', 'freeform',
]);

function error(errors, code, field, message, recordId = null) {
  errors.push({ line: 1, record_id: recordId, code, field, message });
}
function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validate(document) {
  const errors = [];
  const recordId = PJ_ID_RE.test(document?.project_id || '') ? document.project_id : null;
  if (!isPlainObject(document)) {
    error(errors, 'invalid_type', null, '根节点必须是 JSON 对象');
    return errors;
  }
  const allowedRoot = new Set(['contract_version', 'project_id', 'storyline_thesis', 'sections', 'pages']);
  for (const key of Object.keys(document)) {
    if (!allowedRoot.has(key)) error(errors, 'extra_field', key, `不允许字段：${key}`, recordId);
  }
  if (document.contract_version !== '2.0.0') error(errors, 'invalid_const', 'contract_version', '必须为 2.0.0', recordId);
  if (!PJ_ID_RE.test(document.project_id || '')) error(errors, 'invalid_pattern', 'project_id', 'project_id 格式无效', recordId);
  if (!nonEmpty(document.storyline_thesis)) error(errors, 'invalid_value', 'storyline_thesis', '必须说明整份方案的说服主线', recordId);

  const sectionIds = new Set();
  if (!Array.isArray(document.sections) || document.sections.length === 0) {
    error(errors, 'min_items', 'sections', '至少需要一个认知阶段', recordId);
  } else {
    document.sections.forEach((section, index) => {
      const path = `sections[${index}]`;
      if (!isPlainObject(section)) return error(errors, 'invalid_type', path, '必须是对象', recordId);
      const allowed = new Set(['section_id', 'title', 'cognitive_job', 'transition']);
      for (const key of Object.keys(section)) if (!allowed.has(key)) error(errors, 'extra_field', `${path}.${key}`, '不允许字段', recordId);
      if (!SECTION_ID_RE.test(section.section_id || '')) error(errors, 'invalid_pattern', `${path}.section_id`, 'section_id 格式无效', recordId);
      else if (sectionIds.has(section.section_id)) error(errors, 'duplicate_id', `${path}.section_id`, 'section_id 重复', recordId);
      else sectionIds.add(section.section_id);
      for (const field of ['title', 'cognitive_job']) {
        if (!nonEmpty(section[field])) error(errors, 'invalid_value', `${path}.${field}`, '必须为非空中文任务描述', recordId);
      }
      if (typeof section.transition !== 'string') error(errors, 'wrong_type', `${path}.transition`, '必须是字符串，可为空', recordId);
    });
  }

  if (!Array.isArray(document.pages) || document.pages.length === 0) {
    error(errors, 'min_items', 'pages', '至少需要一页', recordId);
  } else {
    document.pages.forEach((page, index) => {
      const path = `pages[${index}]`;
      if (!isPlainObject(page)) return error(errors, 'invalid_type', path, '必须是对象', recordId);
      const allowed = new Set([
        'page_number', 'section_id', 'page_job', 'title_intent', 'claim',
        'content_blocks', 'evidence_needs', 'chart_brief', 'layout_direction', 'transition',
      ]);
      for (const key of Object.keys(page)) if (!allowed.has(key)) error(errors, 'extra_field', `${path}.${key}`, '不允许字段', recordId);
      if (page.page_number !== index + 1) error(errors, 'page_number_gap', `${path}.page_number`, `应为 ${index + 1}`, recordId);
      if (!sectionIds.has(page.section_id)) error(errors, 'missing_section', `${path}.section_id`, '必须引用已存在的 Section', recordId);
      for (const field of ['page_job', 'title_intent', 'claim']) {
        if (!nonEmpty(page[field])) error(errors, 'invalid_value', `${path}.${field}`, '必须为非空任务描述', recordId);
      }
      if (!Array.isArray(page.content_blocks) || page.content_blocks.length === 0) {
        error(errors, 'min_items', `${path}.content_blocks`, '每页至少需要一个完整内容块', recordId);
      } else {
        page.content_blocks.forEach((block, blockIndex) => {
          const blockPath = `${path}.content_blocks[${blockIndex}]`;
          if (!isPlainObject(block)) return error(errors, 'invalid_type', blockPath, '必须是对象', recordId);
          const allowedBlock = new Set(['block_title', 'role', 'content_requirement', 'suggested_form']);
          for (const key of Object.keys(block)) if (!allowedBlock.has(key)) error(errors, 'extra_field', `${blockPath}.${key}`, '不允许字段', recordId);
          for (const field of ['block_title', 'role', 'content_requirement']) {
            if (!nonEmpty(block[field])) error(errors, 'invalid_value', `${blockPath}.${field}`, '必须为非空内容要求', recordId);
          }
          if (block.suggested_form !== undefined && block.suggested_form !== null && !FORMS.has(block.suggested_form)) {
            error(errors, 'invalid_enum', `${blockPath}.suggested_form`, '未知的内容形式', recordId);
          }
        });
      }
      if (!Array.isArray(page.evidence_needs) || page.evidence_needs.some(item => !nonEmpty(item))) {
        error(errors, 'wrong_type', `${path}.evidence_needs`, '必须是字符串数组，可为空数组', recordId);
      }
      for (const field of ['chart_brief', 'layout_direction']) {
        if (page[field] !== undefined && page[field] !== null && !nonEmpty(page[field])) {
          error(errors, 'invalid_value', `${path}.${field}`, '只能省略、为 null 或为非空字符串', recordId);
        }
      }
      if (typeof page.transition !== 'string') error(errors, 'wrong_type', `${path}.transition`, '必须是字符串，可为空', recordId);
    });
  }
  sortErrors(errors);
  return errors;
}

function main() {
  const [filePath, ...rest] = process.argv.slice(2);
  if (!filePath || rest.length) {
    writeSummary({ contract: CONTRACT, valid: false, records: 0, errors: [{ line: 0, record_id: null, code: 'arg_error', field: null, message: '用法：validate-page-architectures.mjs <page-architecture.json>' }] });
    process.exit(2);
  }
  let document;
  try {
    document = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (readError) {
    writeSummary({ contract: CONTRACT, valid: false, records: 0, errors: [{ line: 0, record_id: null, code: 'file_error', field: null, message: readError.message }] });
    process.exit(2);
  }
  const errors = validate(document);
  writeSummary({ contract: CONTRACT, valid: errors.length === 0, records: 1, errors });
  process.exit(errors.length ? 1 : 0);
}

main();
