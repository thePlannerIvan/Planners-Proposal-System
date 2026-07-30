function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function renderPageReviewHtml({
  reviewKind,
  title,
  subtitle,
  sourceSha256,
  pages,
  notice,
  allowUploads = false,
}) {
  const data = safeJson({ reviewKind, sourceSha256, pages, allowUploads });
  const safeTitle = String(title).replace(/[<>&"]/g, char => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;',
  })[char]);
  const safeSubtitle = String(subtitle).replace(/[<>&"]/g, char => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;',
  })[char]);
  const safeNotice = String(notice).replace(/[<>&"]/g, char => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;',
  })[char]);

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title>
<style>
:root{
  --ink:#24231f;--paper:#f2eee5;--card:#fffdf8;--muted:#756f65;--line:#d7cfc1;
  --accent:#b84c34;--accent-soft:#f4e3dc;--ok:#247158;--ok-soft:#e0f0e9;
  --warn:#96631e;--warn-soft:#fbefd2;--shadow:0 16px 42px rgba(58,48,36,.08);
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.75 "Avenir Next","PingFang SC","Noto Sans CJK SC",sans-serif}
button,textarea{font:inherit}
button{cursor:pointer}
.topbar{min-height:74px;background:var(--ink);color:white;padding:13px 28px;display:flex;align-items:center;gap:18px;position:sticky;top:0;z-index:20}
.brand{font-family:"Songti SC","Noto Serif CJK SC",serif;font-weight:700;font-size:20px;white-space:nowrap}
.kind{font-size:13px;border:1px solid #5e5a53;border-radius:999px;padding:5px 9px;color:#ded7cc}
.origin{margin-left:auto;display:flex;gap:9px;align-items:center;font-size:10px;color:#aaa49a;white-space:nowrap}
.origin b{color:#f0ebe2}.origin a{color:#d8a58e;text-decoration:none;border-bottom:1px solid #76594d}
.progress{display:flex;align-items:center;gap:10px;margin-left:8px}
.track{width:145px;height:5px;background:#55514a;border-radius:6px;overflow:hidden}
.fill{height:100%;width:0;background:#e5a487;transition:width .2s}
.shell{display:grid;grid-template-columns:310px minmax(0,1fr);min-height:calc(100vh - 74px)}
.sidebar{position:sticky;top:74px;height:calc(100vh - 74px);overflow:auto;border-right:1px solid var(--line);padding:22px 16px 120px;background:#eae4d9}
.sidebar h2{font:700 17px "Songti SC","Noto Serif CJK SC",serif;margin:0 8px 14px}
.nav{display:grid;gap:4px}
.nav a{display:grid;grid-template-columns:30px 1fr 10px;gap:7px;text-decoration:none;color:var(--ink);padding:9px 8px;border-radius:7px}
.nav a:hover{background:rgba(255,255,255,.6)}
.nav-num{font:700 14px Georgia,serif;color:var(--accent)}
.nav-title{font-size:14px;line-height:1.5}
.dot{width:8px;height:8px;border-radius:50%;border:1px solid #9e978d;margin-top:4px}
.dot.done{background:var(--ok);border-color:var(--ok)}.dot.revise{background:var(--warn);border-color:var(--warn)}
.main{width:100%;max-width:1180px;margin:auto;padding:38px clamp(24px,5vw,72px) 150px}
.hero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:28px;align-items:end;margin-bottom:24px}
.eyebrow{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);font-weight:800}
h1{font:700 clamp(30px,4vw,48px)/1.15 "Songti SC","Noto Serif CJK SC",serif;margin:8px 0 10px;letter-spacing:-.02em}
.subtitle{color:var(--muted);font-size:16px;line-height:1.75;max-width:760px}
.count{font:700 52px/1 Georgia,serif;color:var(--accent)}
.notice{border-left:4px solid var(--accent);background:var(--card);padding:16px 19px;margin:0 0 28px;font-size:15px;line-height:1.75;box-shadow:0 1px 0 rgba(0,0,0,.03)}
.page{scroll-margin-top:96px;background:var(--card);border:1px solid var(--line);border-radius:12px;margin:0 0 22px;box-shadow:var(--shadow);overflow:hidden}
.page-head{padding:19px 22px 17px;border-bottom:1px solid var(--line);display:grid;grid-template-columns:54px minmax(0,1fr);gap:16px}
.page-no{font:700 24px Georgia,serif;color:var(--accent)}
.page-head h2{font:700 28px/1.4 "Songti SC","Noto Serif CJK SC",serif;margin:0}
.claim{font:700 20px/1.7 "Songti SC","Noto Serif CJK SC",serif;padding:19px 22px;background:#f1ebdf;border-bottom:1px solid var(--line)}
.points{margin:0;padding:20px 28px 20px 46px;display:grid;gap:12px;border-bottom:1px solid var(--line)}
.points li{padding-left:5px;font-size:17px;line-height:1.75}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1px;background:var(--line);border-bottom:1px solid var(--line)}
.meta-item{background:var(--card);padding:13px 16px}
.label{display:block;font-size:12px;letter-spacing:.06em;color:var(--muted);font-weight:800;margin-bottom:6px}
.value{font-size:14px;line-height:1.7;white-space:pre-wrap}
.sections{padding:22px;display:grid;gap:18px}
.section{border-top:1px solid var(--line);padding-top:13px}
.section:first-child{border-top:0;padding-top:0}
.section h3{font-size:14px;letter-spacing:.04em;color:var(--muted);margin:0 0 10px}
.section-content{font-size:16px;line-height:1.85;white-space:pre-wrap}
.rich-copy h3,.rich-copy h4{font:700 20px/1.5 "Songti SC","Noto Serif CJK SC",serif;margin:20px 0 8px}
.rich-copy p{margin:0 0 14px}.rich-copy ul,.rich-copy ol{margin:0 0 16px;padding-left:25px;display:grid;gap:7px}
.rich-copy strong{font-weight:800}.rich-copy table{width:100%;border-collapse:collapse;margin:12px 0 20px;font-size:14px}
.rich-copy th,.rich-copy td{border:1px solid var(--line);padding:10px 12px;text-align:left;vertical-align:top}.rich-copy th{background:#eee7db}
.rich-copy img,.asset-preview img{display:block;max-width:100%;max-height:640px;object-fit:contain;margin:14px auto;border-radius:8px;border:1px solid var(--line);background:white}
.details{margin:0 22px 20px;border:1px solid var(--line);border-radius:8px;background:#f8f4ec}
.details summary{cursor:pointer;padding:12px 15px;font-size:13px;color:var(--muted);font-weight:700}.details-body{padding:0 15px 15px}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
.tag{font-size:10px;padding:4px 7px;border-radius:4px;background:#eee7db;color:#5f594f}
.tag.exact{background:var(--ok-soft);color:var(--ok)}.tag.approximate,.tag.unresolved{background:var(--warn-soft);color:var(--warn)}
.review{padding:18px 22px 22px;background:#faf6ee;border-top:1px solid var(--line)}
.review-actions{display:flex;gap:8px;margin-bottom:10px}
.decision{border:1px solid var(--line);background:var(--card);border-radius:6px;padding:9px 15px;font-size:14px;color:var(--muted)}
.decision[data-value="approve"].active{background:var(--ok);border-color:var(--ok);color:white}
.decision[data-value="revise"].active{background:var(--warn);border-color:var(--warn);color:white}
textarea{width:100%;min-height:92px;resize:vertical;border:1px solid var(--line);border-radius:7px;background:white;padding:11px 13px;font-size:15px;line-height:1.7;color:var(--ink)}
.dropzone{border:1.5px dashed #b7ad9e;border-radius:8px;padding:15px;margin:0 0 13px;text-align:center;color:var(--muted);font-size:14px;background:rgba(255,255,255,.55)}
.dropzone.drag{border-color:var(--accent);background:var(--accent-soft);color:var(--accent)}.dropzone input{display:none}
.asset-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:14px}.asset-preview{border:1px solid var(--line);border-radius:8px;padding:9px;background:white}.asset-preview img{height:130px;margin:0 0 7px}.asset-preview input{width:100%;border:1px solid var(--line);border-radius:5px;padding:7px;font-size:12px}.asset-preview button{border:0;background:transparent;color:var(--warn);font-size:12px;padding:5px 0}
.save-panel{margin-top:30px;background:var(--ink);color:white;border-radius:10px;padding:15px 17px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:end;box-shadow:0 14px 40px rgba(0,0,0,.2)}
.save-panel label{font-size:11px;color:#d7d0c5}.save-panel textarea{margin-top:6px;min-height:58px;background:#34322d;border-color:#55514a;color:white}
.save{border:0;border-radius:7px;background:var(--accent);color:white;padding:11px 18px;font-weight:800}
.save:disabled{opacity:.5;cursor:not-allowed}
.status{font-size:11px;margin-top:6px;color:#d7d0c5}
footer{text-align:center;padding:24px;color:var(--muted);font-size:10px}
footer a{color:var(--accent)}
.completion{position:fixed;inset:0;background:rgba(36,35,31,.76);display:none;place-items:center;padding:24px;z-index:100;backdrop-filter:blur(8px)}
.completion.open{display:grid}
.completion-card{width:min(620px,100%);background:var(--card);border-radius:16px;padding:34px;box-shadow:0 28px 90px rgba(0,0,0,.3);text-align:center}
.completion-mark{width:58px;height:58px;margin:0 auto 17px;border-radius:50%;display:grid;place-items:center;background:var(--ok-soft);color:var(--ok);font-size:30px;font-weight:800}
.completion-card h2{font:700 30px/1.3 "Songti SC","Noto Serif CJK SC",serif;margin:0 0 10px}
.completion-card p{margin:0 auto 18px;color:var(--muted);font-size:16px;line-height:1.8}
.completion-path{font:12px/1.6 "SFMono-Regular",Consolas,monospace;background:#eee8dc;border-radius:7px;padding:9px 11px;word-break:break-all;text-align:left;margin:0 0 18px}
.completion-actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}
.completion-actions button{border:1px solid var(--line);border-radius:7px;background:white;padding:10px 15px}
.completion-actions .primary{background:var(--ok);border-color:var(--ok);color:white;font-weight:800}
@media(max-width:820px){
  .shell{display:block}.sidebar{display:none}.origin{display:none}.track{width:90px}.main{padding:28px 15px 120px}
  .hero{grid-template-columns:1fr}.count{font-size:36px}.page-head{grid-template-columns:40px 1fr}.save-panel{grid-template-columns:1fr}
}
</style>
</head>
<body>
<header class="topbar">
  <div class="brand">Proposal Review</div>
  <div class="kind">${safeTitle}</div>
  <div class="origin"><b>OPEN SOURCE WORKFLOW</b><a href="https://demyth.info" target="_blank" rel="noreferrer">demyth.info</a><span>小红书：阿祖不看 TVC</span></div>
  <div class="progress"><div class="track"><div class="fill" id="progressFill"></div></div><span id="progressText">0/${pages.length}</span></div>
</header>
<div class="shell">
  <aside class="sidebar">
    <h2>页面目录</h2>
    <nav class="nav" id="nav"></nav>
  </aside>
  <main class="main">
    <section class="hero">
      <div><div class="eyebrow">${reviewKind}</div><h1>${safeTitle}</h1><div class="subtitle">${safeSubtitle}</div></div>
      <div class="count">${pages.length}</div>
    </section>
    <div class="notice">${safeNotice}</div>
    <div id="pages"></div>
    <section class="save-panel">
      <div><label for="overallFeedback">整体验收意见</label><textarea id="overallFeedback" placeholder="只记录跨页节奏、整体内容或语言问题；可留空。"></textarea><div class="status" id="saveStatus">全部页面默认通过，只需标记有问题的页面。</div></div>
      <button class="save" id="saveButton">保存完整审阅</button>
    </section>
    <footer>Planners-Proposal-System © 2026 阿祖不看 TVC · <a href="https://demyth.info" target="_blank" rel="noreferrer">demyth.info</a> · 小红书：阿祖不看 TVC</footer>
  </main>
</div>
<div class="completion" id="completion" role="dialog" aria-modal="true" aria-labelledby="completionTitle">
  <div class="completion-card">
    <div class="completion-mark">✓</div>
    <h2 id="completionTitle">反馈已保存</h2>
    <p>请返回 Codex 对话，并发送「已完成」。模型会读取本次反馈并继续处理。</p>
    <div class="completion-path" id="completionPath"></div>
    <div class="completion-actions">
      <button class="primary" id="copyCompleted">复制「已完成」</button>
      <button id="closeCompletion">继续查看页面</button>
    </div>
  </div>
</div>
<script>
const REVIEW = ${data};
const decisions = new Map(REVIEW.pages.map(page => [page.page_number, 'approve']));
const attachments = new Map(REVIEW.pages.map(page => [page.page_number, []]));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list = value => Array.isArray(value) ? value.join('\\n') : String(value ?? '');
const safeUrl = value => /^(?:assets\\/|\\.?\\.?\\/|https?:\\/\\/)/.test(String(value || '')) ? String(value) : '';
function inline(value){
  return esc(value).replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>').replace(/\\*(.+?)\\*/g,'<em>$1</em>');
}
function markdown(value){
  const lines=String(value||'').split('\\n');let html='';let index=0;
  while(index<lines.length){
    const line=lines[index].trim();
    if(!line){index++;continue}
    const image=line.match(/^!\\[(.*?)\\]\\((.*?)\\)$/);
    if(image){const url=safeUrl(image[2]);if(url)html+='<figure><img src="'+esc(url)+'" alt="'+esc(image[1])+'"></figure>';index++;continue}
    const heading=line.match(/^(#{3,4})\\s+(.+)$/);
    if(heading){html+='<h'+heading[1].length+'>'+inline(heading[2])+'</h'+heading[1].length+'>';index++;continue}
    if(line.includes('|')&&index+1<lines.length&&/^\\s*\\|?\\s*:?-+/.test(lines[index+1])){
      const rows=[];const cells=text=>text.replace(/^\\||\\|$/g,'').split('|').map(cell=>cell.trim());
      rows.push(cells(line));index+=2;while(index<lines.length&&lines[index].includes('|')&&lines[index].trim()){rows.push(cells(lines[index]));index++}
      html+='<table><thead><tr>'+rows[0].map(cell=>'<th>'+inline(cell)+'</th>').join('')+'</tr></thead><tbody>'+rows.slice(1).map(row=>'<tr>'+row.map(cell=>'<td>'+inline(cell)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';continue
    }
    if(/^[-*]\\s+/.test(line)){const items=[];while(index<lines.length&&/^\\s*[-*]\\s+/.test(lines[index])){items.push(lines[index].replace(/^\\s*[-*]\\s+/,''));index++}html+='<ul>'+items.map(item=>'<li>'+inline(item)+'</li>').join('')+'</ul>';continue}
    if(/^\\d+[.)]\\s+/.test(line)){const items=[];while(index<lines.length&&/^\\s*\\d+[.)]\\s+/.test(lines[index])){items.push(lines[index].replace(/^\\s*\\d+[.)]\\s+/,''));index++}html+='<ol>'+items.map(item=>'<li>'+inline(item)+'</li>').join('')+'</ol>';continue}
    const paragraph=[];while(index<lines.length&&lines[index].trim()&&!/^(#{3,4}|[-*]\\s+|\\d+[.)]\\s+|!\\[)/.test(lines[index].trim())){paragraph.push(lines[index].trim());index++}
    html+='<p>'+paragraph.map(part=>inline(part)).join('<br>')+'</p>';
  }
  return html;
}

function render(){
  const nav = document.getElementById('nav');
  const root = document.getElementById('pages');
  REVIEW.pages.forEach(page => {
    const a = document.createElement('a');
    a.href = '#page-' + page.page_number;
    a.innerHTML = '<span class="nav-num">' + String(page.page_number).padStart(2,'0') + '</span><span class="nav-title">' + esc(page.title) + '</span><span class="dot" id="dot-' + page.page_number + '"></span>';
    nav.appendChild(a);

    const article = document.createElement('article');
    article.className = 'page';
    article.id = 'page-' + page.page_number;
    const meta = (page.meta || []).map(item => '<div class="meta-item"><span class="label">' + esc(item.label) + '</span><div class="value">' + esc(list(item.value)) + '</div></div>').join('');
    const primary = (page.sections || []).filter(item => !item.collapsed).map(item => '<section class="section"><h3>' + esc(item.label) + '</h3><div class="section-content '+(item.format==='markdown'?'rich-copy':'')+'">' + (item.format==='markdown'?markdown(item.value):esc(list(item.value))) + '</div>' + ((item.tags || []).length ? '<div class="tags">' + item.tags.map(tag => '<span class="tag ' + esc(tag.tone || '') + '">' + esc(tag.label) + '</span>').join('') + '</div>' : '') + '</section>').join('');
    const secondary = (page.sections || []).filter(item => item.collapsed).map(item => '<section class="section"><h3>' + esc(item.label) + '</h3><div class="section-content '+(item.format==='markdown'?'rich-copy':'')+'">' + (item.format==='markdown'?markdown(item.value):esc(list(item.value))) + '</div></section>').join('');
    const points = (page.points || []).length ? '<ul class="points">'+page.points.map(point=>'<li>'+esc(point)+'</li>').join('')+'</ul>' : '';
    const upload = REVIEW.allowUploads ? '<div class="dropzone" data-dropzone="'+page.page_number+'">拖拽图片到这里，或点击选择<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple data-file="'+page.page_number+'"></div><div class="asset-list" data-assets="'+page.page_number+'"></div>' : '';
    article.innerHTML =
      '<header class="page-head"><div class="page-no">' + String(page.page_number).padStart(2,'0') + '</div><h2>' + esc(page.title) + '</h2></header>' +
      '<div class="claim">' + esc(page.claim || '') + '</div>' +
      points +
      '<div class="sections">' + primary + '</div>' +
      ((meta||secondary)?'<details class="details"><summary>查看工作信息</summary><div class="details-body">'+(meta?'<div class="meta">'+meta+'</div>':'')+secondary+'</div></details>':'') +
      '<div class="review">'+upload+'<span class="label">本页决定（默认通过）</span><div class="review-actions"><button class="decision active" data-page="' + page.page_number + '" data-value="approve">通过</button><button class="decision" data-page="' + page.page_number + '" data-value="revise">需要修改</button></div><textarea data-feedback="' + page.page_number + '" placeholder="仅在本页有问题时填写：标题、内容、数据、图片或表达应该如何调整。"></textarea></div>';
    root.appendChild(article);
  });
  REVIEW.pages.forEach(page=>{document.getElementById('dot-'+page.page_number).className='dot done'});
  document.querySelectorAll('.decision').forEach(button => button.addEventListener('click', () => {
    const page = Number(button.dataset.page);
    decisions.set(page, button.dataset.value);
    document.querySelectorAll('.decision[data-page="' + page + '"]').forEach(other => other.classList.toggle('active', other === button));
    const dot = document.getElementById('dot-' + page);
    dot.className = 'dot ' + (button.dataset.value === 'approve' ? 'done' : 'revise');
    updateProgress();
  }));
  document.querySelectorAll('[data-feedback]').forEach(field => field.addEventListener('input', () => {
    const page = Number(field.dataset.feedback);
    const value = field.value.trim() ? 'revise' : 'approve';
    decisions.set(page, value);
    document.querySelectorAll('.decision[data-page="' + page + '"]').forEach(button => button.classList.toggle('active', button.dataset.value === value));
    document.getElementById('dot-' + page).className = 'dot ' + (value === 'approve' ? 'done' : 'revise');
    updateProgress();
  }));
  if(REVIEW.allowUploads) bindUploads();
  document.getElementById('saveButton').addEventListener('click', save);
}
function bindUploads(){
  document.querySelectorAll('[data-dropzone]').forEach(zone=>{
    const page=Number(zone.dataset.dropzone);const input=document.querySelector('[data-file="'+page+'"]');
    zone.addEventListener('click',()=>input.click());
    input.addEventListener('change',()=>uploadFiles(page,[...input.files]));
    for(const event of ['dragenter','dragover'])zone.addEventListener(event,e=>{e.preventDefault();zone.classList.add('drag')});
    for(const event of ['dragleave','drop'])zone.addEventListener(event,e=>{e.preventDefault();zone.classList.remove('drag')});
    zone.addEventListener('drop',event=>uploadFiles(page,[...event.dataTransfer.files]));
  });
}
async function uploadFiles(page,files){
  const zone=document.querySelector('[data-dropzone="'+page+'"]');
  for(const file of files){
    if(!file.type.startsWith('image/'))continue;
    zone.textContent='正在上传 '+file.name+'…';
    const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file)});
    const response=await fetch('/upload-asset',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({page_number:page,filename:file.name,mime:file.type,data_base64:data})});
    const result=await response.json();if(!response.ok||!result.ok){zone.textContent='上传失败：'+(result.error||file.name);continue}
    attachments.get(page).push({path:result.markdown_path,url:result.url,alt:file.name.replace(/\\.[^.]+$/,''),caption:''});renderAssets(page);
  }
  zone.innerHTML='拖拽图片到这里，或点击选择<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple data-file="'+page+'">';
  const input=zone.querySelector('input');input.addEventListener('change',()=>uploadFiles(page,[...input.files]));
}
function renderAssets(page){
  const root=document.querySelector('[data-assets="'+page+'"]');root.innerHTML='';
  attachments.get(page).forEach((asset,index)=>{
    const card=document.createElement('div');card.className='asset-preview';card.innerHTML='<img src="'+esc(asset.url)+'" alt="'+esc(asset.alt)+'"><input value="'+esc(asset.caption)+'" placeholder="图片说明（可选）"><button>移除</button>';
    card.querySelector('input').oninput=event=>{asset.caption=event.target.value};
    card.querySelector('button').onclick=()=>{attachments.get(page).splice(index,1);renderAssets(page)};
    root.appendChild(card);
  });
}
function updateProgress(){
  const done = decisions.size;
  document.getElementById('progressFill').style.width = (REVIEW.pages.length ? done / REVIEW.pages.length * 100 : 0) + '%';
  document.getElementById('progressText').textContent = done + '/' + REVIEW.pages.length;
  document.getElementById('saveButton').disabled = false;
  const revisions=[...decisions.values()].filter(value=>value==='revise').length;
  document.getElementById('saveStatus').textContent = revisions ? revisions+' 页标记为需要修改。' : '全部页面当前为通过；只需标记有问题的页面。';
}
function showCompletion(path){
  document.getElementById('completionPath').textContent=path||'review-feedback.json';
  document.getElementById('completion').classList.add('open');
}
document.getElementById('copyCompleted').onclick=async()=>{
  try{await navigator.clipboard.writeText('已完成');document.getElementById('copyCompleted').textContent='已复制'}catch{window.prompt('复制下面的文字并发送给 Codex','已完成')}
};
document.getElementById('closeCompletion').onclick=()=>document.getElementById('completion').classList.remove('open');
async function save(){
  const button = document.getElementById('saveButton');
  button.disabled = true;
  const pageDecisions = REVIEW.pages.map(page => ({
    page_number: page.page_number,
    decision: decisions.get(page.page_number),
    feedback_zh: document.querySelector('[data-feedback="' + page.page_number + '"]').value.trim(),
    ...(REVIEW.allowUploads ? {attachments: attachments.get(page.page_number) || []} : {}),
  }));
  const payload = {
    contract_version: REVIEW.reviewKind === 'by_page_copy' ? '1.1.0' : '1.0.0',
    review_kind: REVIEW.reviewKind,
    source_sha256: REVIEW.sourceSha256,
    saved_at: new Date().toISOString(),
    overall_decision: pageDecisions.every(item => item.decision === 'approve') ? 'approve' : 'revise',
    overall_feedback_zh: document.getElementById('overallFeedback').value.trim(),
    decisions: pageDecisions,
  };
  const status = document.getElementById('saveStatus');
  try {
    const response = await fetch('/save-feedback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const result = await response.json();
    if(!response.ok || !result.ok) throw new Error(result.error || '保存失败');
    status.textContent = '已保存：' + result.feedback_path;
    showCompletion(result.feedback_path);
  } catch(error) {
    status.textContent = '保存失败：' + error.message;
    button.disabled = false;
  }
}
render();
updateProgress();
</script>
</body>
</html>`;
}
