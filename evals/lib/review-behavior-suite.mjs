import { readFileSync } from 'node:fs';
import { assert } from './assert.mjs';

export function checkReviewBehavior(htmlPath, { uploads = false } = {}) {
  const html = readFileSync(htmlPath, 'utf8');
  assert(html.includes('全部页面默认通过') || html.includes('所有页面默认通过'), '页面必须说明默认通过');
  assert(
    html.includes("const decisions = new Map(REVIEW.pages.map(page => [page.page_number, 'approve']))")
      || html.includes("const decisions = new Map(REVIEW.pages.filter(page => !page.requires_fact_decision).map(page => [page.page_number, 'approve']))"),
    '普通页面必须默认通过，含事实例外的页面必须保持待决定',
  );
  assert(html.includes("document.querySelectorAll('[data-feedback]').forEach"), '输入反馈必须触发状态变化');
  assert(html.includes("field.value.trim() ? 'revise' : 'approve'"), '非空反馈必须自动切换 revise');
  assert(html.includes('返回 Codex') && html.includes('已完成'), '保存后必须提示返回 Codex');
  assert(html.includes('https://demyth.info'), '页眉页脚必须有 demyth.info');
  assert(html.includes('小红书：阿祖不看 TVC'), '页眉页脚必须有小红书标识');
  assert(html.includes('查看工作信息'), '工程字段必须折叠');
  assert(html.includes('font:16px/1.75'), '基础字号不得过小');
  if (uploads) {
    assert(html.includes('"allowUploads":true') && html.includes('/upload-asset'), '终稿审阅必须启用图片拖拽上传');
  } else {
    assert(html.includes('"allowUploads":false'), '非终稿审阅必须关闭图片上传');
  }
  return { html };
}
