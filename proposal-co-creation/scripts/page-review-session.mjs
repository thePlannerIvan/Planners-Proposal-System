#!/usr/bin/env node
import { createServer } from 'node:http';
import {
  existsSync, mkdirSync, readFileSync, writeFileSync,
} from 'node:fs';
import {
  dirname, extname, relative, resolve,
} from 'node:path';

function argsOf(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 2) out[argv[index]] = argv[index + 1];
  return out;
}
function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

const args = argsOf(process.argv.slice(2));
for (const key of ['--dir', '--feedback', '--ready-file']) if (!args[key]) fail(`缺少 ${key}`);
const dir = resolve(args['--dir']);
const feedbackPath = resolve(args['--feedback']);
const readyPath = resolve(args['--ready-file']);
const assetsDir = args['--assets-dir'] ? resolve(args['--assets-dir']) : null;
const finalMdPath = args['--final-md'] ? resolve(args['--final-md']) : null;
const port = args['--port'] === undefined ? 0 : Number(args['--port']);
if (!Number.isInteger(port) || (port !== 0 && (port < 1024 || port > 65535))) fail('--port 必须为 0 或 1024–65535');
if (!existsSync(resolve(dir, 'index.html'))) fail('审阅目录缺少 index.html');

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};
function readBody(request, maxBytes = 25 * 1024 * 1024) {
  return new Promise((resolveBody, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => {
      body += chunk;
      if (Buffer.byteLength(body) > maxBytes) reject(new Error('请求内容过大'));
    });
    request.on('end', () => resolveBody(body));
    request.on('error', reject);
  });
}
const server = createServer((request, response) => {
  const url = new URL(request.url || '/', 'http://127.0.0.1');
  if (request.method === 'POST' && url.pathname === '/upload-asset') {
    if (!assetsDir) {
      response.writeHead(404);
      response.end();
      return;
    }
    readBody(request).then(body => {
      try {
        const payload = JSON.parse(body);
        if (!Number.isInteger(payload.page_number) || payload.page_number < 1) throw new Error('page_number 无效');
        const allowed = new Map([
          ['image/png', '.png'], ['image/jpeg', '.jpg'], ['image/webp', '.webp'], ['image/gif', '.gif'],
        ]);
        if (!allowed.has(payload.mime)) throw new Error('只允许 PNG、JPEG、WEBP 或 GIF');
        if (typeof payload.data_base64 !== 'string' || !payload.data_base64) throw new Error('图片内容为空');
        const buffer = Buffer.from(payload.data_base64, 'base64');
        if (!buffer.length || buffer.length > 20 * 1024 * 1024) throw new Error('图片必须小于 20MB');
        const original = String(payload.filename || 'image').replace(/\.[^.]+$/, '');
        const safeStem = original.replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(0, 80) || 'image';
        const pageDir = resolve(assetsDir, `page-${String(payload.page_number).padStart(2, '0')}`);
        mkdirSync(pageDir, { recursive: true });
        let file = resolve(pageDir, `${safeStem}${allowed.get(payload.mime)}`);
        for (let index = 2; existsSync(file); index++) file = resolve(pageDir, `${safeStem}-${index}${allowed.get(payload.mime)}`);
        writeFileSync(file, buffer);
        const urlPath = relative(dir, file).split('\\').join('/');
        const markdownPath = finalMdPath
          ? relative(dirname(finalMdPath), file).split('\\').join('/')
          : urlPath;
        response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ ok: true, url: urlPath, markdown_path: markdownPath }));
      } catch (error) {
        response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ ok: false, error: error.message }));
      }
    }).catch(error => {
      response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: false, error: error.message }));
    });
    return;
  }
  if (request.method === 'POST' && url.pathname === '/save-feedback') {
    readBody(request, 5 * 1024 * 1024).then(body => {
      try {
        const feedback = JSON.parse(body);
        const valid = feedback
          && ['1.0.0', '1.1.0'].includes(feedback.contract_version)
          && typeof feedback.review_kind === 'string'
          && /^[a-f0-9]{64}$/.test(feedback.source_sha256 || '')
          && ['approve', 'revise'].includes(feedback.overall_decision)
          && typeof feedback.saved_at === 'string'
          && Array.isArray(feedback.decisions)
          && feedback.decisions.length > 0
          && feedback.decisions.every(item => Number.isInteger(item.page_number)
            && ['approve', 'revise'].includes(item.decision)
            && typeof item.feedback_zh === 'string'
            && (item.attachments === undefined || (Array.isArray(item.attachments)
              && item.attachments.every(asset => typeof asset.path === 'string'
                && typeof asset.alt === 'string'
                && typeof asset.caption === 'string'))));
        if (!valid) throw new Error('反馈格式无效或存在未处置页面');
        mkdirSync(resolve(feedbackPath, '..'), { recursive: true });
        writeFileSync(feedbackPath, `${JSON.stringify(feedback, null, 2)}\n`);
        response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({
          ok: true,
          feedback_path: feedbackPath,
          planned_final_md_path: finalMdPath,
        }));
        setTimeout(() => server.close(() => process.exit(0)), 150);
      } catch (error) {
        response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ ok: false, error: error.message }));
      }
    }).catch(error => {
      response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: false, error: error.message }));
    });
    return;
  }
  if (!['GET', 'HEAD'].includes(request.method || '')) {
    response.writeHead(405);
    response.end();
    return;
  }
  const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = resolve(dir, requested);
  if ((file !== resolve(dir, 'index.html') && !file.startsWith(`${dir}/`)) || !existsSync(file)) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
  if (request.method === 'HEAD') response.end();
  else response.end(readFileSync(file));
});

server.listen(port, '127.0.0.1', () => {
  const actualPort = server.address().port;
  const session = {
    pid: process.pid,
    port: actualPort,
    url: `http://127.0.0.1:${actualPort}/index.html`,
    feedback_path: feedbackPath,
    started_at: new Date().toISOString(),
  };
  mkdirSync(resolve(readyPath, '..'), { recursive: true });
  writeFileSync(readyPath, `${JSON.stringify(session, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(session)}\n`);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
