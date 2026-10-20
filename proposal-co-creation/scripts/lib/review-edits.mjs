import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { moduleScript } from './planners-modules.mjs';
import { validateStoryline } from './storyline.mjs';
const {sha256,contentHash,contentProjection,validateChanges,writeReviewContext} = await import(pathToFileURL(moduleScript('planners-review-core','scripts/content-review-contract.mjs')));
export {sha256,contentHash,contentProjection,writeReviewContext};

export function prepareEdits(submission,reviewDir) {
  if (!submission.review_changes) return null;
  const context = JSON.parse(readFileSync(join(reviewDir,'review-context.json'),'utf8'));
  if (context.reviewKind !== submission.review_kind || context.sourceSha256 !== submission.source_sha256) throw Error('提交属于旧版审阅，修改已保留，请先核对版本');
  const changes = validateChanges(submission.review_changes,context,submission);
  const source = context.files[0], raw = readFileSync(source.path,'utf8');
  if (sha256(raw) !== source.sha256) throw Error('原文已有外部修改，未覆盖任何内容：'+source.path);
  const next = applyContentChanges(raw, changes);
  return {context,changes,source,raw,next,changed:next !== raw,sourceHash:sha256(next),mapping:new Map(changes.page_order.map((id,i) => [Number(id),i+1]))};
}

function applyStoryline(raw, changes) {
  const doc = JSON.parse(raw), pages = new Map(doc.pages.map(p => [String(p.page_number), p]));
  const sections = new Map(doc.sections.map(s => [s.section_id,s]));
  for (const [id, item] of Object.entries(changes.added_pages ?? {})) pages.set(id, {page_number:Number(id), section_id:item.section_id, claim:item.title, supports:[]});
  if ('thesis' in changes.edits) doc.storyline_thesis = changes.edits.thesis;
  for (const [id, patch] of Object.entries(changes.edits.sections ?? {})) {
    if (Object.keys(patch).some(k => k !== 'title')) throw Error('主线章节只编辑标题');
    if ('title' in patch) sections.get(id).title = patch.title;
  }
  for (const [id, patch] of Object.entries(changes.edits.pages ?? {})) {
    const p = pages.get(id);
    if ('claim' in patch) p.claim = patch.claim;
    if ('title' in patch) p.claim = patch.title;
    if ('notes' in patch) p.notes = patch.notes;
    if (Array.isArray(patch.blocks)) p.supports = patch.blocks.map(s => s.trim()).filter(Boolean);
    else for (const [index, block] of Object.entries(patch.blocks ?? {})) {
      if ('text' in block) p.supports[Number(index)] = block.text;
    }
  }
  doc.sections = changes.section_order.map(id => sections.get(id));
  doc.pages = changes.page_order.map((id,i) => ({...pages.get(String(id)),page_number:i+1}));
  const errors = validateStoryline(doc);
  if (errors.length) throw Error(errors.map(e => e.field + ': ' + e.message).join('；'));
  return contentHash(doc) === contentHash(JSON.parse(raw)) ? raw : JSON.stringify(doc,null,2)+'\n';
}
export function applyContentChanges(raw, changes) {
  if (JSON.parse(raw).contract_version === '3.0.0') return applyStoryline(raw, changes);
  const doc = JSON.parse(raw), pages = new Map(doc.pages.map(p => [String(p.page_number),p]));
  const sections = new Map(doc.sections.map(s => [s.section_id,s]));
  for (const [id, item] of Object.entries(changes.added_pages ?? {})) pages.set(id, {
    page_number: Number(id), section_id: item.section_id, title_intent: item.title, claim: item.title,
    page_job: item.title, content_blocks: [{block_title: item.title, role: item.title, content_requirement: item.title, suggested_form: 'paragraph'}],
    evidence_needs: [], chart_brief: null, layout_direction: null, transition: '',
  });
  if ('thesis' in changes.edits) doc.storyline_thesis = changes.edits.thesis;
  for (const [id,patch] of Object.entries(changes.edits.sections ?? {})) for (const [key,value] of Object.entries(patch)) sections.get(id)[key === 'lead' ? 'cognitive_job' : key] = value;
  for (const [id,patch] of Object.entries(changes.edits.pages ?? {})) {
    const p = pages.get(id);
    if ('title' in patch) p.title_intent = patch.title;
    if ('claim' in patch) p.claim = patch.claim;
    if (Array.isArray(patch.blocks)) {
      // 上游一行一条：改字合并保留 role/form，新增条目的语义字段留给模型补
      const previous = p.content_blocks ?? [];
      const next = patch.blocks.map(text => String(text || '').trim()).filter(Boolean);
      if (next.length) {
        p.content_blocks = next.map((text, index) => {
          const before = previous[index] ?? {};
          return {
            block_title: before.block_title || text.slice(0, 24),
            role: before.role || '待模型补写',
            content_requirement: text,
            suggested_form: before.suggested_form ?? null,
          };
        });
      }
    } else {
      for (const [index,b] of Object.entries(patch.blocks ?? {})) {
        if ('title' in b) p.content_blocks[index].block_title = b.title;
        if ('text' in b) p.content_blocks[index].content_requirement = b.text;
      }
    }
  }
  doc.sections = changes.section_order.map(id => sections.get(id));
  doc.pages = changes.page_order.map((id,i) => ({...pages.get(String(id)),page_number:i+1}));
  for (const s of doc.sections) if (Array.isArray(s.page_numbers)) s.page_numbers = doc.pages.filter(p => p.section_id === s.section_id).map(p => p.page_number);
  return contentHash(doc) === contentHash(JSON.parse(raw)) ? raw : JSON.stringify(doc,null,2)+'\n';
}
export function commitEdits(prepared,reviewDir) {
  if (!prepared?.changed) return;
  const archive = join(reviewDir,'history','sources'); mkdirSync(archive,{recursive:true});
  const backup = join(archive,prepared.source.sha256+'.json');
  if (!existsSync(backup)) writeFileSync(backup,prepared.raw);
  const temporary = prepared.source.path+'.review-edit.tmp'; writeFileSync(temporary,prepared.next); renameSync(temporary,prepared.source.path);
  writeFileSync(join(reviewDir,'review-snapshot.json'),JSON.stringify({source_sha256:prepared.sourceHash})+'\n');
}
