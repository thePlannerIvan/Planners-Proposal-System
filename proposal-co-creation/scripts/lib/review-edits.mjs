import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { moduleScript } from './planners-modules.mjs';
const {sha256,contentHash,validateChanges,writeReviewContext} = await import(pathToFileURL(moduleScript('planners-review-core','scripts/content-review-contract.mjs')));
export {sha256,contentHash,writeReviewContext};

export function prepareEdits(submission,reviewDir) {
  if (!submission.review_changes) return null;
  const context = JSON.parse(readFileSync(join(reviewDir,'review-context.json'),'utf8'));
  if (context.reviewKind !== submission.review_kind || context.sourceSha256 !== submission.source_sha256) throw Error('提交属于旧版审阅，修改已保留，请先核对版本');
  const changes = validateChanges(submission.review_changes,context,submission);
  const source = context.files[0], raw = readFileSync(source.path,'utf8');
  if (sha256(raw) !== source.sha256) throw Error('原文已有外部修改，未覆盖任何内容：'+source.path);
  const doc = JSON.parse(raw), pages = new Map(doc.pages.map(p => [String(p.page_number),p]));
  const sections = new Map(doc.sections.map(s => [s.section_id,s]));
  if ('thesis' in changes.edits) doc.storyline_thesis = changes.edits.thesis;
  for (const [id,patch] of Object.entries(changes.edits.sections ?? {})) for (const [key,value] of Object.entries(patch)) sections.get(id)[key === 'lead' ? 'cognitive_job' : key] = value;
  for (const [id,patch] of Object.entries(changes.edits.pages ?? {})) {
    const p = pages.get(id);
    if ('title' in patch) p.title_intent = patch.title;
    if ('claim' in patch) p.claim = patch.claim;
    for (const [index,b] of Object.entries(patch.blocks ?? {})) {
      if ('title' in b) p.content_blocks[index].block_title = b.title;
      if ('text' in b) p.content_blocks[index].content_requirement = b.text;
    }
  }
  doc.sections = changes.section_order.map(id => sections.get(id));
  doc.pages = changes.page_order.map((id,i) => ({...pages.get(String(id)),page_number:i+1}));
  for (const s of doc.sections) if (Array.isArray(s.page_numbers)) s.page_numbers = doc.pages.filter(p => p.section_id === s.section_id).map(p => p.page_number);
  const changed = contentHash(changes.edits) !== contentHash({pages:{},sections:{}})
    || JSON.stringify(changes.page_order) !== JSON.stringify(context.pages.map(p => p.page_number))
    || JSON.stringify(changes.section_order) !== JSON.stringify(context.sections.map(s => s.section_id));
  const next = changed ? JSON.stringify(doc,null,2)+'\n' : raw;
  return {context,changes,source,raw,next,changed:next !== raw,sourceHash:sha256(next),mapping:new Map(changes.page_order.map((id,i) => [Number(id),i+1]))};
}
export function commitEdits(prepared,reviewDir) {
  if (!prepared?.changed) return;
  const archive = join(reviewDir,'history','sources'); mkdirSync(archive,{recursive:true});
  const backup = join(archive,prepared.source.sha256+'.json');
  if (!existsSync(backup)) writeFileSync(backup,prepared.raw);
  const temporary = prepared.source.path+'.review-edit.tmp'; writeFileSync(temporary,prepared.next); renameSync(temporary,prepared.source.path);
  writeFileSync(join(reviewDir,'review-snapshot.json'),JSON.stringify({source_sha256:prepared.sourceHash})+'\n');
}
