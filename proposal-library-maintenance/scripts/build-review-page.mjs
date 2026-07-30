#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { validateFile } from './lib/contract-validation.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i]] = process.argv[i + 1];
if (!args['--bundle'] || !args['--output']) throw new Error('用法：build-review-page.mjs --bundle <review-bundle.json> --output <review/index.html>');
const bundlePath = resolve(args['--bundle']);
const raw = readFileSync(bundlePath, 'utf8');
const bundleCheck = validateFile(bundlePath, resolve(import.meta.dirname, '../contracts/review-bundle.schema.json'));
if (!bundleCheck.valid) throw new Error(`review-bundle Contract 失败：${bundleCheck.errors.join('; ')}`);
const bundle = JSON.parse(raw);
const bundleHash = createHash('sha256').update(raw).digest('hex');
const data = JSON.stringify(bundle).replace(/</g, '\\u003c');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>B4 方法库完整审阅</title>
<style>
:root{
  --ink:#25231f;--paper:#f3efe6;--card:#fffdf8;--muted:#746f65;--line:#d8d0c3;
  --soft:#ebe5da;--accent:#bd4b32;--accent-soft:#f6e5df;--ok:#267158;--ok-soft:#e2f1eb;
  --warn:#9a671d;--warn-soft:#fbf0d4;--bad:#a13d36;--bad-soft:#f7e3e0;--blue:#315f80;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--paper);color:var(--ink);font-family:"Avenir Next","PingFang SC","Noto Sans CJK SC",sans-serif}
button,input,select,textarea{font:inherit}
button{cursor:pointer}
.topbar{min-height:72px;background:var(--ink);color:#fff;display:flex;align-items:center;gap:22px;padding:12px 28px;position:sticky;top:0;z-index:20}
.brand{font-family:"Songti SC","Noto Serif CJK SC",serif;font-size:21px;font-weight:700;white-space:nowrap}
.route{font-size:12px;padding:5px 10px;border:1px solid #5d5a53;border-radius:999px;color:#e7e0d3}
.project-origin{margin-left:auto;display:flex;align-items:center;gap:9px;color:#aaa49a;font-size:12px;letter-spacing:.04em;white-space:nowrap}
.project-origin b{color:#f0ebe2}.project-origin a{color:#d7a38e;text-decoration:none;border-bottom:1px solid #76594d}
.progress-wrap{margin-left:auto;display:flex;align-items:center;gap:12px}
.progress-track{width:180px;height:5px;border-radius:5px;background:#55514a;overflow:hidden}
.progress-fill{height:100%;width:0;background:#e5a487;transition:width .2s}
.progress-text{font-variant-numeric:tabular-nums;font-size:13px}
.shell{display:grid;grid-template-columns:310px minmax(0,1fr);min-height:calc(100vh - 72px)}
.sidebar{border-right:1px solid var(--line);background:#ebe5da;padding:22px 16px 120px;position:sticky;top:72px;height:calc(100vh - 72px);overflow:auto}
.sidebar h2{font-family:"Songti SC","Noto Serif CJK SC",serif;font-size:18px;margin:0 8px 15px}
.field-label{display:block;font-size:13px;font-weight:700;letter-spacing:.05em;color:var(--muted);margin-bottom:6px}
.note,.target-select,.module-select{width:100%;border:1px solid var(--line);border-radius:6px;background:var(--card);padding:9px 10px;color:var(--ink)}
.filters{display:flex;gap:5px;margin:0 8px 14px}
.filter{border:1px solid var(--line);background:transparent;border-radius:999px;padding:7px 11px;font-size:12px;color:var(--muted)}
.filter.active{background:var(--ink);border-color:var(--ink);color:white}
.batch-tools{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:0 8px 14px}
.batch-tools button{border:1px solid var(--line);background:var(--card);border-radius:6px;padding:8px 7px;font-size:12px;color:var(--ink)}
.batch-tools button.danger{color:var(--bad);border-color:#d7aaa5}
.nav-list{list-style:none;margin:0;padding:0}
.nav-item{margin:3px 0}
.nav-row{display:grid;grid-template-columns:22px 1fr;align-items:center}
.nav-check{width:16px;height:16px;accent-color:var(--accent)}
.nav-button{width:100%;border:0;background:transparent;border-radius:7px;padding:9px 8px;display:grid;grid-template-columns:26px 1fr auto;gap:8px;text-align:left;align-items:start;color:var(--ink)}
.nav-button:hover{background:rgba(255,255,255,.55)}
.nav-button.active{background:var(--card);box-shadow:0 1px 0 rgba(0,0,0,.05)}
.nav-num{font-family:Georgia,serif;color:var(--accent);font-weight:700}
.nav-copy strong{display:block;font-size:14px;line-height:1.4}
.nav-copy span{display:block;color:var(--muted);font-size:11px;margin-top:3px}
.state-dot{width:8px;height:8px;border:1px solid #999;border-radius:50%;margin-top:4px}
.state-dot.done{border-color:var(--ok);background:var(--ok)}
.state-dot.defer{border-color:var(--warn);background:var(--warn)}
.main{padding:36px clamp(24px,4vw,70px) 140px;max-width:1320px;width:100%;margin:auto}
.notice{border-left:4px solid var(--accent);background:var(--card);padding:15px 18px;margin-bottom:25px;display:flex;gap:14px;align-items:flex-start}
.notice strong{font-size:16px}.notice p{margin:3px 0 0;color:var(--muted);font-size:14px;line-height:1.7}
.eyebrow{font-size:13px;letter-spacing:.08em;color:var(--accent);font-weight:800}
.title-row{display:flex;align-items:flex-start;gap:18px;margin:8px 0 22px}
.title-row h1{font-family:"Songti SC","Noto Serif CJK SC",serif;font-size:34px;line-height:1.2;margin:0;letter-spacing:-.02em}
.kind{margin-left:auto;border:1px solid var(--line);border-radius:999px;padding:5px 10px;color:var(--muted);font-size:11px;white-space:nowrap}
.question{font-family:"Songti SC","Noto Serif CJK SC",serif;font-size:21px;line-height:1.7;border-left:3px solid var(--ink);padding:5px 0 5px 17px;margin:0 0 28px}
.section{border-top:1px solid var(--line);padding-top:19px;margin-top:24px}
.section-head{display:flex;align-items:center;gap:12px;margin-bottom:13px}
.section-head h2{font-family:"Songti SC","Noto Serif CJK SC",serif;font-size:20px;margin:0}
.section-head span{font-size:12px;color:var(--muted)}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.panel{background:var(--card);border:1px solid var(--line);border-radius:9px;padding:16px}
.panel h3{font-size:11px;letter-spacing:.06em;color:var(--muted);margin:0 0 10px;text-transform:uppercase}
.tag-row{display:flex;flex-wrap:wrap;gap:6px}
.tag{background:var(--soft);border-radius:4px;padding:5px 8px;font-size:11px}
.clean-list{margin:0;padding-left:19px;font-size:15px;line-height:1.8}
.operations{counter-reset:step;list-style:none;padding:0;margin:0;display:grid;gap:9px}
.operations li{counter-increment:step;display:grid;grid-template-columns:30px 1fr;gap:10px;align-items:start;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:13px 15px;font-size:15px;line-height:1.65}
.operations li:before{content:counter(step,decimal-leading-zero);font-family:Georgia,serif;color:var(--accent);font-weight:700}
.page-flow{display:grid;grid-template-columns:repeat(auto-fit,minmax(225px,1fr));gap:10px}
.page-card{background:var(--card);border:1px solid var(--line);border-radius:9px;padding:15px;position:relative;overflow:hidden}
.page-card:before{content:"";position:absolute;inset:0 auto 0 0;width:4px;background:var(--accent)}
.page-num{font:700 12px Georgia,serif;color:var(--accent)}
.page-card h3{font-family:"Songti SC","Noto Serif CJK SC",serif;font-size:15px;margin:7px 0}
.page-card p{font-size:14px;line-height:1.65;color:var(--muted);margin:6px 0}
.relationship{display:inline-block;margin-top:7px;font-size:9px;padding:3px 6px;border-radius:3px;background:var(--soft)}
.comparison{background:#efe9dd;border:1px solid var(--line);border-radius:10px;padding:18px}
.recommendation{display:flex;gap:12px;align-items:flex-start;border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:14px}
.rec-badge{background:var(--warn-soft);color:var(--warn);border-radius:4px;padding:5px 8px;font-size:10px;font-weight:800;white-space:nowrap}
.recommendation strong{font-size:16px}.recommendation p{font-size:14px;color:var(--muted);line-height:1.65;margin:4px 0 0}
.compare-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.compare-cell{background:rgba(255,255,255,.58);padding:10px;border-radius:6px}
.compare-cell b{font-size:12px;color:var(--muted);display:block;margin-bottom:4px}
.compare-cell span{font-size:14px;line-height:1.65}
.target-preview{margin-top:14px;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:14px}
.target-preview.empty{color:var(--bad);background:var(--bad-soft)}
.target-preview h3{font-size:16px;margin:0 0 8px}.target-preview p{font-size:14px;line-height:1.65;margin:5px 0;color:var(--muted)}
.dependency-list{display:grid;gap:7px}.dependency-row{display:grid;grid-template-columns:1fr auto;gap:12px;padding:10px 12px;border-radius:6px;background:var(--card);border:1px solid var(--line);font-size:11px}.dependency-row.ok{border-color:#9dc7b7;background:var(--ok-soft)}.dependency-row.missing{border-color:#d7aaa5;background:var(--bad-soft)}.dependency-row.pending{border-color:#dbc28f;background:var(--warn-soft)}
.decision-panel{margin-top:28px;background:var(--ink);color:#fff;border-radius:11px;padding:20px}
.decision-panel h2{font-family:"Songti SC","Noto Serif CJK SC",serif;margin:0 0 5px;font-size:18px}
.decision-panel>.hint{color:#bdb7ae;font-size:13px;line-height:1.6;margin:0 0 15px}
.decision-options{display:flex;flex-wrap:wrap;gap:7px}
.decision-btn{border:1px solid #67625a;background:transparent;color:#eee;border-radius:999px;padding:9px 14px;font-size:13px}
.decision-btn:hover{border-color:#fff}
.decision-btn.selected{background:#fff;color:var(--ink);border-color:#fff;font-weight:800}
.decision-btn[data-decision="reject"].selected{background:#f0a49d;border-color:#f0a49d}
.decision-btn[data-decision="defer"].selected{background:#e5c98d;border-color:#e5c98d}
.decision-details{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:15px}
.decision-details label{font-size:10px;color:#c6c0b7}
.decision-details select,.decision-details textarea{margin-top:6px}
.note{min-height:72px;resize:vertical}
.editor-wrap{display:none;margin-top:13px}
.editor-wrap.open{display:block}
.editor-tools{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.editor-tools span{font-size:10px;color:#c6c0b7}
.load-proposal{border:1px solid #777168;color:#fff;background:transparent;border-radius:4px;padding:5px 8px;font-size:10px}
.json-editor{width:100%;min-height:260px;border:1px solid #777168;border-radius:6px;background:#151412;color:#eee;padding:12px;font:11px/1.5 "SFMono-Regular",Consolas,monospace;resize:vertical}
details.tech{margin-top:22px;color:var(--muted);font-size:11px}
details.tech pre{white-space:pre-wrap;word-break:break-word;background:#e9e3d8;border:1px solid var(--line);padding:12px;border-radius:6px;max-height:320px;overflow:auto}
.bottom-bar{position:fixed;left:310px;right:0;bottom:0;background:rgba(255,253,248,.96);backdrop-filter:blur(10px);border-top:1px solid var(--line);padding:12px clamp(24px,4vw,70px);display:flex;align-items:center;gap:10px;z-index:18}
.prev,.next{border:1px solid var(--line);background:transparent;border-radius:5px;padding:8px 11px}
.save{margin-left:auto;border:0;background:var(--accent);color:#fff;border-radius:6px;padding:10px 16px;font-weight:800}
.save:disabled{opacity:.45;cursor:not-allowed}
.save-status{font-size:11px;color:var(--muted)}
.toast{position:fixed;right:24px;bottom:80px;padding:10px 14px;border-radius:6px;color:#fff;background:var(--ink);z-index:50;font-size:12px;box-shadow:0 10px 30px rgba(0,0,0,.2)}
.toast.error{background:var(--bad)}
.project-credit{margin-left:310px;padding:30px 24px 105px;text-align:center;color:#8a847a;font-size:11px;font-weight:700;letter-spacing:.02em}
.project-credit a{color:#5f5a52;text-decoration:none;border-bottom:1px solid #c8c0b5}
.project-credit .xhs{margin-left:8px;color:#9b5a48}
.completion{position:fixed;inset:0;background:rgba(37,35,31,.78);display:none;place-items:center;padding:24px;z-index:100;backdrop-filter:blur(8px)}
.completion.open{display:grid}
.completion-card{width:min(620px,100%);background:var(--card);border-radius:16px;padding:34px;text-align:center;box-shadow:0 28px 90px rgba(0,0,0,.3)}
.completion-mark{width:58px;height:58px;margin:0 auto 17px;border-radius:50%;display:grid;place-items:center;background:var(--ok-soft);color:var(--ok);font-size:30px;font-weight:800}
.completion-card h2{font:700 30px/1.3 "Songti SC","Noto Serif CJK SC",serif;margin:0 0 10px}
.completion-card p{font-size:16px;line-height:1.8;color:var(--muted);margin:0 auto 18px}
.completion-path{font:12px/1.6 "SFMono-Regular",Consolas,monospace;background:#eee8dc;border-radius:7px;padding:9px 11px;word-break:break-all;text-align:left;margin-bottom:18px}
.completion-actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}
.completion-actions button{border:1px solid var(--line);border-radius:7px;background:white;padding:10px 15px}
.completion-actions .primary{background:var(--ok);border-color:var(--ok);color:white;font-weight:800}
.hidden{display:none!important}
@media(max-width:900px){
  .shell{grid-template-columns:1fr}.sidebar{position:static;height:auto;border-right:0;border-bottom:1px solid var(--line);padding-bottom:18px}
  .topbar{flex-wrap:wrap}.project-origin{order:3;margin-left:0;width:100%}.progress-wrap{margin-left:auto}
  .nav-list{display:flex;overflow:auto}.nav-item{min-width:190px}.main{padding-top:24px}.bottom-bar{left:0}.project-credit{margin-left:0}.two-col,.compare-grid,.decision-details{grid-template-columns:1fr}
}
</style>
</head>
<body>
<header class="topbar">
  <div class="brand">B4 方法库审阅</div>
  <div class="route" id="routeLabel"></div>
  <div class="project-origin"><b>OPEN SOURCE WORKFLOW</b><a href="https://demyth.info" target="_blank" rel="noreferrer">demyth.info</a><span>小红书：阿祖不看 TVC</span></div>
  <div class="progress-wrap">
    <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
    <span class="progress-text" id="progressText">0/0 已处置</span>
  </div>
</header>
<div class="shell">
  <aside class="sidebar">
    <h2>审阅清单</h2>
    <div class="filters">
      <button class="filter active" data-filter="all">全部</button>
      <button class="filter" data-filter="pending">未处置</button>
      <button class="filter" data-filter="done">已处置</button>
    </div>
    <div class="batch-tools">
      <button id="selectPending">勾选未处置</button>
      <button class="danger" id="rejectSelected">批量拒绝</button>
    </div>
    <ol class="nav-list" id="navList"></ol>
  </aside>
  <main class="main">
    <div class="notice">
      <strong id="noticeTitle"></strong>
      <p id="noticeText"></p>
    </div>
    <article id="reviewCard"></article>
  </main>
</div>
<footer class="project-credit">Planners-Proposal-System © 2026 阿祖不看 TVC · <a href="https://demyth.info" target="_blank" rel="noreferrer">demyth.info</a><span class="xhs">小红书：阿祖不看 TVC</span></footer>
<div class="bottom-bar">
  <button class="prev" id="prev">← 上一项</button>
  <button class="next" id="next">下一项 →</button>
  <span class="save-status" id="saveStatus">决定会自动保存在本机草稿中</span>
  <button class="save" id="save" disabled>保存全部审阅决定</button>
</div>
<div class="completion" id="completion" role="dialog" aria-modal="true" aria-labelledby="completionTitle">
  <div class="completion-card">
    <div class="completion-mark">✓</div>
    <h2 id="completionTitle">反馈已保存</h2>
    <p>请返回 Codex 对话，并发送「已完成」。模型会验证本轮决定并继续安装或修改。</p>
    <div class="completion-path" id="completionPath"></div>
    <div class="completion-actions">
      <button class="primary" id="copyCompleted">复制「已完成」</button>
      <button id="closeCompletion">继续查看页面</button>
    </div>
  </div>
</div>
<script>
const bundle=${data};
const bundleHash=${JSON.stringify(bundleHash)};
const storageKey='library-b4-review:'+bundleHash;
const labels={approve:'批准',revise:'修改后批准',new:'作为新方法',merge:'合并到已有 Lens',variant:'作为已有 Lens 变体',revision:'修订已有方法',add_source:'仅补充来源',reroute:'改到其他 Module',no_change:'无变化',reject:'拒绝',defer:'暂缓'};
const comparisonLabels={question_zh:'解决的问题',operations_zh:'操作链',inputs_outputs_zh:'输入与输出',boundaries_zh:'适用边界',page_structure_zh:'页面结构'};
let decisions={};
let activeIndex=0;
let filter='all';
let selectedIds=new Set();
try{const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');if(saved&&typeof saved==='object')decisions=saved}catch{}

const esc=value=>String(value??'').replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
const list=value=>Array.isArray(value)?value:[];
const proposalName=item=>item.proposal.name_zh||item.proposal.name||item.source_id;
const moduleName=item=>item.module_meta?.title_zh||item.source_module_id||'跨 Module Recipe';
const persist=()=>{localStorage.setItem(storageKey,JSON.stringify(decisions));updateChrome()};
const decisionFor=item=>decisions[item.item_id]||null;
const current=()=>bundle.items[activeIndex];
const routeIsUpgrade=bundle.route==='upgrade_existing';
function isCompleteDecision(item,draft){
  if(!draft?.decision)return false;
  if(['merge','variant','revision','add_source','no_change'].includes(draft.decision)&&!draft.target_id)return false;
  if(draft.decision==='reroute'&&!draft.target_module_id)return false;
  if(['revise','merge','revision'].includes(draft.decision)){
    if(!draft.edited_text)return false;
    try{
      const edited=JSON.parse(draft.edited_text);
      const idKey=item.method_kind==='lens'?'lens_id':'recipe_id';
      if(edited[idKey]!==item.source_id)return false;
    }catch{return false}
  }
  if(item.method_kind==='recipe'&&['approve','revise','new','revision'].includes(draft.decision)&&recipeDependencies(item).some(dependency=>dependency.state!=='ok'))return false;
  return item.allowed_decisions.includes(draft.decision);
}

function renderList(){
  const nav=document.querySelector('#navList');nav.innerHTML='';
  bundle.items.forEach((item,index)=>{
    const decision=decisionFor(item);const complete=isCompleteDecision(item,decision);
    const visible=filter==='all'||(filter==='pending'&&!complete)||(filter==='done'&&complete);
    const li=document.createElement('li');li.className='nav-item'+(visible?'':' hidden');
    li.innerHTML='<div class="nav-row"><input class="nav-check" type="checkbox" aria-label="选择 '+esc(proposalName(item))+'" '+(selectedIds.has(item.item_id)?'checked':'')+'><button class="nav-button '+(index===activeIndex?'active':'')+'" data-index="'+index+'"><span class="nav-num">'+String(index+1).padStart(2,'0')+'</span><span class="nav-copy"><strong>'+esc(proposalName(item))+'</strong><span>'+esc(moduleName(item))+' · '+esc(item.method_kind)+'</span></span><span class="state-dot '+(complete?(decision.decision==='defer'?'defer':'done'):'')+'"></span></button></div>';
    li.querySelector('.nav-check').onchange=event=>{if(event.target.checked)selectedIds.add(item.item_id);else selectedIds.delete(item.item_id)};
    li.querySelector('.nav-button').onclick=()=>{activeIndex=index;render()};
    nav.appendChild(li);
  });
}

function tags(values){
  return list(values).length?'<div class="tag-row">'+list(values).map(value=>'<span class="tag">'+esc(value)+'</span>').join('')+'</div>':'<span class="muted">—</span>';
}
function bullets(values){
  return list(values).length?'<ul class="clean-list">'+list(values).map(value=>'<li>'+esc(value)+'</li>').join('')+'</ul>':'<span>—</span>';
}
function operations(item){
  const values=item.proposal.operations_zh||item.proposal.analysis_operations||[];
  return list(values).length?'<ol class="operations">'+list(values).map(value=>'<li>'+esc(value)+'</li>').join('')+'</ol>':'<p>没有操作步骤。</p>';
}
function pages(item){
  const values=list(item.proposal.page_structure);
  if(!values.length)return '<div class="panel">没有页面结构，不能作为完整 Lens 批准。</div>';
  return '<div class="page-flow">'+values.map((page,index)=>{
    const number=page.page||index+1;
    const title=page.title_zh||page.title||('第 '+number+' 页');
    const purpose=page.purpose_zh||page.purpose||page.content||'';
    const question=page.question_zh||page.question||'';
    const evidence=page.evidence_needed_zh||page.required_evidence||[];
    const relation=page.information_relationship||page.information_relationship_zh||'';
    const from=page.from_previous_zh||page.connects_from||'';
    const to=page.to_next_zh||page.connects_to||'';
    const misuse=page.misuse_warning_zh||page.common_misuse||'';
    return '<div class="page-card"><span class="page-num">P'+esc(number)+'</span><h3>'+esc(title)+'</h3><p>'+esc(purpose)+'</p>'+(question?'<p><b>回答：</b>'+esc(question)+'</p>':'')+(list(evidence).length?'<p><b>证据：</b>'+esc(list(evidence).join('；'))+'</p>':'')+(from||to?'<p><b>推进：</b>'+esc(from||'起点')+' → '+esc(to||'终点')+'</p>':'')+(misuse?'<p><b>避免：</b>'+esc(misuse)+'</p>':'')+(relation?'<span class="relationship">'+esc(relation)+'</span>':'')+'</div>';
  }).join('')+'</div>';
}
function recipeSteps(item){
  const steps=list(item.proposal.steps);
  return steps.length?'<ol class="operations">'+steps.map(step=>'<li><div><b>'+esc(step.role_zh||'步骤')+'</b><br><span>'+esc(list(step.input_zh).join('、'))+' → '+esc(list(step.output_zh).join('、'))+'</span><br><small>'+esc(step.dependency_zh||'')+'</small></div></li>').join('')+'</ol>':'<p>没有 Recipe 步骤。</p>';
}
function resolvedLensId(lensId){
  const item=bundle.items.find(candidate=>candidate.method_kind==='lens'&&candidate.source_id===lensId);
  if(!item)return null;
  const decision=decisionFor(item);
  if(!decision?.decision)return null;
  if(['reject','defer'].includes(decision.decision))return null;
  if(['merge','variant','revision','add_source','no_change'].includes(decision.decision))return decision.target_id||null;
  const edited=decision.edited_text?(()=>{try{return JSON.parse(decision.edited_text)}catch{return null}})():null;
  return edited?.lens_id||item.proposal.lens_id;
}
function effectiveProposal(item){
  const decision=decisionFor(item);
  if(decision?.edited_text){
    try{return JSON.parse(decision.edited_text)}catch{}
  }
  return item.proposal;
}
function recipeDependencies(item){
  const proposal=effectiveProposal(item);
  const ids=[...new Set([...(proposal.required_lens_ids||[]),...(proposal.optional_lens_ids||[]),...list(proposal.steps).map(step=>step.lens_id)])];
  return ids.map(lensId=>{
    const lensItem=bundle.items.find(candidate=>candidate.method_kind==='lens'&&candidate.source_id===lensId);
    const decision=lensItem?decisionFor(lensItem):null;
    const resolved=resolvedLensId(lensId);
    return {lensId,resolved,state:resolved?'ok':(decision?.decision&&['reject','defer'].includes(decision.decision)?'missing':'pending')};
  });
}
function recipeDependencyPanel(item){
  if(item.method_kind!=='recipe')return '';
  const rows=recipeDependencies(item).map(dependency=>'<div class="dependency-row '+dependency.state+'"><span>'+esc(dependency.lensId)+'</span><b>'+(dependency.state==='ok'?'将引用 '+esc(dependency.resolved):dependency.state==='missing'?'已拒绝/暂缓':'等待 Lens 决定')+'</b></div>').join('');
  return '<section class="section"><div class="section-head"><h2>Lens 依赖状态</h2><span>先审 Lens，再批准 Recipe</span></div><div class="dependency-list">'+rows+'</div></section>';
}
function targetFor(item,targetId){
  return list(item.merge_targets).find(target=>target.target_id===targetId)||null;
}
function targetAsProposal(item,target){
  const value=target?.target||{};
  if(item.method_kind==='recipe')return {
    ...item.proposal,
    name_zh:value.name||item.proposal.name_zh,
    purpose_zh:value.purpose||item.proposal.purpose_zh,
    required_lens_ids:value.required_lens_ids||item.proposal.required_lens_ids,
    optional_lens_ids:value.optional_lens_ids||item.proposal.optional_lens_ids,
    steps:list(value.steps).map(step=>({step_index:step.step_index,lens_id:step.lens_id,role_zh:step.role||step.role_zh,input_zh:step.input||step.input_zh||[],output_zh:step.output||step.output_zh||[],dependency_zh:step.dependency||step.dependency_zh})),
    use_conditions_zh:value.use_conditions||item.proposal.use_conditions_zh,
    skip_conditions_zh:value.skip_conditions||item.proposal.skip_conditions_zh
  };
  return {
    ...item.proposal,
    name_zh:value.name||item.proposal.name_zh,
    aliases_zh:value.aliases||item.proposal.aliases_zh,
    question_zh:value.question||item.proposal.question_zh,
    use_conditions_zh:value.use_conditions||item.proposal.use_conditions_zh,
    skip_conditions_zh:value.skip_conditions||item.proposal.skip_conditions_zh,
    required_inputs_zh:value.required_inputs||item.proposal.required_inputs_zh,
    operations_zh:value.analysis_operations||item.proposal.operations_zh,
    output_types_zh:value.output_types||item.proposal.output_types_zh,
    failure_modes_zh:value.failure_modes||item.proposal.failure_modes_zh,
    boundaries_zh:value.boundaries||item.proposal.boundaries_zh,
    page_structure:list(value.page_structure).map((page,index)=>({
      page:page.page||index+1,
      title_zh:page.title||page.title_zh,
      purpose_zh:page.purpose||page.purpose_zh||page.content||'',
      question_zh:page.question||page.question_zh||'',
      evidence_needed_zh:page.required_evidence||page.evidence_needed_zh||[],
      information_relationship:page.information_relationship||'',
      from_previous_zh:page.connects_from||page.from_previous_zh||'',
      to_next_zh:page.connects_to||page.to_next_zh||'',
      misuse_warning_zh:page.common_misuse||page.misuse_warning_zh||''
    }))
  };
}
function matchedTargets(item){
  const ids=list(item.comparison?.matched_ids);
  return ids.map(id=>targetFor(item,id)).filter(Boolean);
}
function targetOptions(item,decision){
  const matchedIds=new Set(list(item.comparison?.matched_ids));
  const recommended=list(item.merge_targets).filter(target=>matchedIds.has(target.target_id));
  const remaining=list(item.merge_targets).filter(target=>!matchedIds.has(target.target_id));
  const option=target=>'<option value="'+esc((target.module_id||'')+'|'+target.target_id)+'" '+(decision?.target_id===target.target_id?'selected':'')+'>'+esc((target.label_zh||target.target_id)+(target.question_zh?'｜'+target.question_zh:''))+'</option>';
  let html=recommended.length?'<optgroup label="★ B3d 候选（优先核验）">'+recommended.map(option).join('')+'</optgroup>':'';
  const groups=new Map();
  remaining.forEach(target=>{
    const label=target.module_title_zh||target.module_id||'Recipe';
    if(!groups.has(label))groups.set(label,[]);
    groups.get(label).push(target);
  });
  for(const [label,targets] of groups)html+='<optgroup label="'+esc(label)+'">'+targets.map(option).join('')+'</optgroup>';
  return html;
}
function targetPreview(item,target){
  if(!routeIsUpgrade)return '';
  if(!target)return '<div class="target-preview empty"><h3>没有可核验的既有目标</h3><p>当前对照没有绑定具体 Lens/Recipe。请不要仅凭比较摘要批准合并、变体、修订或补来源。</p></div>';
  const value=target.target||{};
  const name=value.name||value.name_zh||target.label_zh||target.target_id;
  const question=value.question||value.question_zh||value.purpose||value.purpose_zh||'';
  const ops=value.analysis_operations||value.operations_zh||value.steps||[];
  return '<div class="target-preview"><h3>'+esc(target.label_zh||name)+'</h3>'+(question?'<p><b>问题/目的：</b>'+esc(question)+'</p>':'')+(list(ops).length?'<p><b>操作/步骤：</b>'+esc(list(ops).map(op=>typeof op==='string'?op:(op.role||op.role_zh||'步骤')).join('；'))+'</p>':'')+'<p><b>ID：</b>'+esc(target.target_id)+'</p></div>';
}
function comparison(item,decision){
  if(!routeIsUpgrade)return '';
  const align=item.comparison;
  if(!align)return '<section class="section"><div class="comparison"><div class="target-preview empty">缺少 B3d 对照结果，不能完成增补审阅。</div></div></section>';
  const rec=labels[item.recommended_action]||item.recommended_action||'无';
  const cells=Object.entries(align.comparison||{}).map(([key,value])=>'<div class="compare-cell"><b>'+esc(comparisonLabels[key]||key)+'</b><span>'+esc(value)+'</span></div>').join('');
  const selectedTarget=decision?.target_id?targetFor(item,decision.target_id):targetFor(item,align.target_id);
  const matched=matchedTargets(item);
  const preview=selectedTarget?targetPreview(item,selectedTarget):(matched.length?matched.map(target=>targetPreview(item,target)).join(''):targetPreview(item,null));
  return '<section class="section"><div class="section-head"><h2>与已有 Wiki 对照</h2><span>核验差异后再决定</span></div><div class="comparison"><div class="recommendation"><span class="rec-badge">模型建议（仅供参考）</span><div><strong>'+esc(rec)+' · 置信度 '+Math.round((align.confidence||0)*100)+'%</strong><p>'+esc(align.rationale_zh||'')+'</p><p><b>语义增量：</b>'+esc(align.semantic_delta_zh||'')+'</p></div></div><div class="compare-grid">'+cells+'</div>'+preview+'</div></section>';
}
function decisionPanel(item,decision){
  const selected=decision?.decision||'';
  const buttons=item.allowed_decisions.map(value=>'<button class="decision-btn '+(selected===value?'selected':'')+'" data-decision="'+esc(value)+'">'+esc(labels[value]||value)+'</button>').join('');
  const needsTarget=['merge','variant','revision','add_source','no_change'].includes(selected);
  const needsModule=selected==='reroute';
  const needsEdited=['revise','merge','revision'].includes(selected);
  const targets=targetOptions(item,decision);
  const modules=list(item.module_targets).map(target=>'<option value="'+esc(target.module_id)+'" '+(decision?.target_module_id===target.module_id?'selected':'')+'>'+esc(target.label_zh||target.module_id)+'</option>').join('');
  return '<section class="decision-panel"><h2>你的决定</h2><p class="hint">模型建议不会自动选中；只有你的点击才计入已处置。合并和修订必须提交人工确认后的完整最终方法，安装器不会自动拼接或覆盖。</p><div class="decision-options">'+buttons+'</div><div class="decision-details '+((needsTarget||needsModule)?'':'hidden')+'"><label class="'+(needsTarget?'':'hidden')+'">明确目标方法<select class="target-select"><option value="">请选择目标</option>'+targets+'</select></label><label class="'+(needsModule?'':'hidden')+'">目标 Module<select class="module-select"><option value="">请选择 Module</option>'+modules+'</select></label></div><label class="field-label" style="margin-top:14px;color:#c6c0b7">审阅备注</label><textarea class="note" placeholder="说明判断依据、修改要求或拒绝原因">'+esc(decision?.note_zh||'')+'</textarea><div class="editor-wrap '+(needsEdited?'open':'')+'"><div class="editor-tools"><span>提交完整最终 proposal JSON；ID 保持冻结 ID 不变</span><span><button class="load-proposal">载入新提案</button> <button class="load-target">载入既有目标</button></span></div><textarea class="json-editor" spellcheck="false" placeholder="载入一个对象作为起点，完成语义合并或修订后再批准">'+esc(decision?.edited_text||'')+'</textarea></div></section>';
}
function renderCard(){
  const item=current();const decision=decisionFor(item);
  const isLens=item.method_kind==='lens';
  const title=proposalName(item);
  const question=item.proposal.question_zh||item.proposal.purpose_zh||'';
  const inputs=item.proposal.required_inputs_zh||[];
  const outputs=item.proposal.output_types_zh||[];
  const use=item.proposal.use_conditions_zh||[];
  const skip=item.proposal.skip_conditions_zh||[];
  const failures=item.proposal.failure_modes_zh||[];
  const boundaries=item.proposal.boundaries_zh||[];
  document.querySelector('#reviewCard').innerHTML='<div class="eyebrow">'+esc(moduleName(item))+(item.source_module_id?' · '+esc(item.source_module_id):'')+' · '+esc(item.source_id)+'</div><div class="title-row"><h1>'+esc(title)+'</h1><span class="kind">'+(isLens?'Lens':'Recipe')+'</span></div>'+(question?'<p class="question">'+esc(question)+'</p>':'')+'<section class="section"><div class="section-head"><h2>'+(isLens?'方法骨架':'推导链')+'</h2><span>检查是否可执行、可复用</span></div>'+(isLens?operations(item):recipeSteps(item))+'</section>'+(isLens?'<section class="section"><div class="section-head"><h2>输入与输出</h2></div><div class="two-col"><div class="panel"><h3>需要资料</h3>'+tags(inputs)+'</div><div class="panel"><h3>输出类型</h3>'+tags(outputs)+'</div></div></section><section class="section"><div class="section-head"><h2>页面论证结构</h2><span>检查能否形成递进论证</span></div>'+pages(item)+'</section>':'')+recipeDependencyPanel(item)+'<section class="section"><div class="section-head"><h2>适用边界</h2></div><div class="two-col"><div class="panel"><h3>何时使用</h3>'+bullets(use)+'</div><div class="panel"><h3>何时跳过</h3>'+bullets(skip)+'</div><div class="panel"><h3>失败模式</h3>'+bullets(failures)+'</div><div class="panel"><h3>其他边界</h3>'+bullets(boundaries)+'</div></div></section>'+comparison(item,decision)+decisionPanel(item,decision)+'<details class="tech"><summary>技术详情与来源 ID</summary><pre>'+esc(JSON.stringify(item.proposal,null,2))+'</pre></details>';
  bindCard(item);
}
function bindCard(item){
  document.querySelectorAll('.decision-btn').forEach(button=>button.onclick=()=>{
    const value=button.dataset.decision;
    const previous=decisionFor(item)||{};
    decisions[item.item_id]={decision:value,target_module_id:null,target_id:null,note_zh:previous.note_zh||'',edited_text:['revise','merge','revision'].includes(value)?(previous.edited_text||''):''};
    persist();render();
  });
  const target=document.querySelector('.target-select');
  if(target)target.onchange=()=>{
    const [moduleId,targetId]=target.value?target.value.split('|'):['',''];
    const decision=decisionFor(item);decision.target_module_id=moduleId||null;decision.target_id=targetId||null;persist();renderCard();
  };
  const module=document.querySelector('.module-select');
  if(module)module.onchange=()=>{const decision=decisionFor(item);decision.target_module_id=module.value||null;persist()};
  const note=document.querySelector('.note');
  note.oninput=()=>{const decision=decisionFor(item);if(decision){decision.note_zh=note.value;persist()}};
  const loader=document.querySelector('.load-proposal');
  if(loader)loader.onclick=event=>{event.preventDefault();const editor=document.querySelector('.json-editor');editor.value=JSON.stringify(item.proposal,null,2);const decision=decisionFor(item);decision.edited_text=editor.value;persist()};
  const targetLoader=document.querySelector('.load-target');
  if(targetLoader)targetLoader.onclick=event=>{event.preventDefault();const decision=decisionFor(item);const target=targetFor(item,decision?.target_id);if(!target?.target){toast('请先选择包含完整对象的既有目标',true);return}const editor=document.querySelector('.json-editor');editor.value=JSON.stringify(targetAsProposal(item,target),null,2);decision.edited_text=editor.value;persist()};
  const editor=document.querySelector('.json-editor');
  if(editor)editor.oninput=()=>{const decision=decisionFor(item);decision.edited_text=editor.value;persist()};
}
function updateChrome(){
  const done=bundle.items.filter(item=>isCompleteDecision(item,decisionFor(item))).length;
  document.querySelector('#progressText').textContent=done+'/'+bundle.items.length+' 已处置';
  document.querySelector('#progressFill').style.width=(bundle.items.length?done/bundle.items.length*100:0)+'%';
  document.querySelector('#save').disabled=done!==bundle.items.length;
  renderList();
}
function render(){
  renderList();renderCard();updateChrome();
  document.querySelector('#prev').disabled=activeIndex===0;
  document.querySelector('#next').disabled=activeIndex===bundle.items.length-1;
}
function toast(message,error=false){
  const el=document.createElement('div');el.className='toast'+(error?' error':'');el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),3200);
}
function showCompletion(path){
  document.querySelector('#completionPath').textContent=path||'review-feedback.json';
  document.querySelector('#completion').classList.add('open');
}
document.querySelector('#copyCompleted').onclick=async()=>{
  try{await navigator.clipboard.writeText('已完成');document.querySelector('#copyCompleted').textContent='已复制'}catch{window.prompt('复制下面的文字并发送给 Codex','已完成')}
};
document.querySelector('#closeCompletion').onclick=()=>document.querySelector('#completion').classList.remove('open');
document.querySelector('#routeLabel').textContent=routeIsUpgrade?'增补已有库':'独立新建库';
document.querySelector('#noticeTitle').textContent=routeIsUpgrade?'增补已有方法库':'建立独立方法库';
document.querySelector('#noticeText').textContent=routeIsUpgrade?'逐项核验新方法与既有 Wiki 的真实差异。合并、变体、修订和补来源必须明确目标。':'逐项审阅完整 Lens 与 Recipe。本路线没有合并到已有 Lens 的选项。';
document.querySelectorAll('.filter').forEach(button=>button.onclick=()=>{filter=button.dataset.filter;document.querySelectorAll('.filter').forEach(item=>item.classList.toggle('active',item===button));renderList()});
document.querySelector('#selectPending').onclick=()=>{
  selectedIds=new Set(bundle.items.filter(item=>!isCompleteDecision(item,decisionFor(item))).map(item=>item.item_id));
  renderList();
};
document.querySelector('#rejectSelected').onclick=()=>{
  if(!selectedIds.size){toast('请先勾选需要拒绝的方法',true);return}
  if(!window.confirm('确认拒绝已勾选的 '+selectedIds.size+' 项？保存前仍可逐项改回。'))return;
  bundle.items.filter(item=>selectedIds.has(item.item_id)).forEach(item=>{
    const previous=decisionFor(item)||{};
    decisions[item.item_id]={decision:'reject',target_module_id:null,target_id:null,note_zh:previous.note_zh||'批量拒绝',edited_text:''};
  });
  selectedIds.clear();persist();render();toast('已批量标记为拒绝');
};
document.querySelector('#prev').onclick=()=>{if(activeIndex>0){activeIndex--;render();window.scrollTo(0,0)}};
document.querySelector('#next').onclick=()=>{if(activeIndex<bundle.items.length-1){activeIndex++;render();window.scrollTo(0,0)}};
document.querySelector('#save').onclick=async()=>{
  try{
    const output=[];
    for(const item of bundle.items){
      const draft=decisionFor(item);
      if(!draft)throw new Error(proposalName(item)+' 尚未处置');
      if(['merge','variant','revision','add_source','no_change'].includes(draft.decision)&&!draft.target_id)throw new Error(proposalName(item)+' 必须选择明确目标');
      if(draft.decision==='reroute'&&!draft.target_module_id)throw new Error(proposalName(item)+' 必须选择目标 Module');
      let edited_proposal=null;
      if(['revise','merge','revision'].includes(draft.decision)){
        if(!draft.edited_text)throw new Error(proposalName(item)+' 必须载入并修改完整提案');
        try{edited_proposal=JSON.parse(draft.edited_text)}catch{throw new Error(proposalName(item)+' 的修改提案不是合法 JSON')}
        const idKey=item.method_kind==='lens'?'lens_id':'recipe_id';
        if(edited_proposal[idKey]!==item.source_id)throw new Error(proposalName(item)+' 必须保留冻结 '+idKey+'：'+item.source_id);
      }
      output.push({item_id:item.item_id,decision:draft.decision,target_module_id:draft.target_module_id||null,target_id:draft.target_id||null,edited_proposal,note_zh:draft.note_zh||''});
    }
    const payload={contract_version:'1.0.0',review_bundle_sha256:bundleHash,route:bundle.route,saved_at:new Date().toISOString(),reviewer:'B4 人工审阅',decisions:output};
    const response=await fetch('/save-feedback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'保存失败');
    document.querySelector('#saveStatus').textContent='已保存：'+result.feedback_path;
    toast('全部审阅决定已保存');
    showCompletion(result.feedback_path);
  }catch(error){toast(error.message,true)}
};
render();
</script>
</body>
</html>`;

const output = resolve(args['--output']);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, html);
process.stdout.write(`${JSON.stringify({ valid: true, items: bundle.items.length, output, review_bundle_sha256: bundleHash })}\n`);
