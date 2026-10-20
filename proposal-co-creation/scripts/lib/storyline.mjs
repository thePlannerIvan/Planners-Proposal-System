// Proposal 3: the editable words are the canonical content.
export function validateStoryline(doc, {ready = false} = {}) {
  const errors = [];
  const fail = (field, message) => errors.push({line:1, record_id:doc?.project_id ?? null, code:'storyline', field, message});
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const text = value => typeof value === 'string' && Boolean(value.trim());
  const fields = (value, allowed, path) => {
    if (!object(value)) { fail(path, '必须是对象'); return false; }
    for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(path + '.' + key, '不支持的字段');
    return true;
  };
  if (!fields(doc, ['contract_version','project_id','storyline_thesis','sections','pages'], '')) return errors;
  if (doc.contract_version !== '3.0.0') fail('contract_version', '必须为 3.0.0');
  if (!/^pj_[a-f0-9]{24}$/.test(doc.project_id || '')) fail('project_id', '项目身份无效');
  if (!text(doc.storyline_thesis)) fail('storyline_thesis', '整案主张不能为空');
  const ids = new Set();
  if (!Array.isArray(doc.sections) || !doc.sections.length) fail('sections', '至少一个章节；短稿可只用一个');
  else doc.sections.forEach((s, i) => {
    const path = `sections[${i}]`;
    if (!fields(s, ['section_id','title'], path)) return;
    if (!/^sec-[a-z0-9][a-z0-9-]{1,47}$/.test(s.section_id || '') || ids.has(s.section_id)) fail(path+'.section_id','章节身份无效或重复');
    ids.add(s.section_id);
    if (!text(s.title)) fail(path+'.title','章节标题不能为空');
  });
  if (!Array.isArray(doc.pages) || !doc.pages.length) fail('pages','至少一页');
  else doc.pages.forEach((p, i) => {
    const path = `pages[${i}]`;
    if (!fields(p, ['page_number','section_id','claim','supports','notes'], path)) return;
    if (p.page_number !== i + 1) fail(path+'.page_number','页号必须连续');
    if (!ids.has(p.section_id)) fail(path+'.section_id','章节不存在');
    if (!text(p.claim)) fail(path+'.claim','主张不能为空');
    if (!Array.isArray(p.supports) || p.supports.some(s => !text(s))) fail(path+'.supports','支撑必须为非空文本列表');
    else if (ready && !p.supports.length) fail(path+'.supports','交接前补齐本页支撑判断');
    if (p.notes !== undefined && typeof p.notes !== 'string') fail(path+'.notes','备注必须是文本');
  });
  return errors;
}
