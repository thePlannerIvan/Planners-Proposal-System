#!/usr/bin/env node
/**
 * Serves one generated B4 review directory on loopback and persists its
 * browser feedback. It is intentionally generic: HTML generation remains a
 * separate production step, while this script owns the runtime review session.
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';

function argsOf(argv) { const out = {}; for (let i = 0; i < argv.length; i += 2) out[argv[i]] = argv[i + 1]; return out; }
function fail(message) { process.stderr.write(`${message}\n`); process.exit(2); }
const args = argsOf(process.argv.slice(2));
for (const key of ['--dir', '--feedback', '--ready-file']) if (!args[key]) fail(`Missing ${key}`);
const dir = resolve(args['--dir']); const feedbackPath = resolve(args['--feedback']); const readyPath = resolve(args['--ready-file']);
const port = args['--port'] === undefined ? 0 : Number(args['--port']);
if (!Number.isInteger(port) || (port !== 0 && (port < 1024 || port > 65535))) fail('--port 必须为 0 或 1024–65535 的整数');
if (!existsSync(resolve(dir, 'index.html'))) fail(`审阅页不存在：${resolve(dir, 'index.html')}`);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  if (req.method === 'POST' && url.pathname === '/save-feedback') {
    let body = '';
    req.setEncoding('utf8'); req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const feedback = JSON.parse(body);
        if (!feedback || typeof feedback !== 'object' || !feedback.saved_at || !feedback.decisions) throw new Error('反馈缺少 saved_at 或 decisions');
        mkdirSync(resolve(feedbackPath, '..'), { recursive: true });
        writeFileSync(feedbackPath, `${JSON.stringify(feedback, null, 2)}\n`);
        res.writeHead(200, {'content-type': 'application/json; charset=utf-8'}); res.end(JSON.stringify({ ok: true, feedback_path: feedbackPath }));
        setTimeout(() => server.close(() => process.exit(0)), 150);
      } catch (error) { res.writeHead(400, {'content-type': 'application/json; charset=utf-8'}); res.end(JSON.stringify({ ok: false, error: error.message })); }
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  const requested = url.pathname === '/' ? 'index.html' : basename(url.pathname);
  const file = resolve(dir, requested);
  if (!file.startsWith(`${dir}/`) || !existsSync(file)) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, {'content-type': MIME[extname(file)] || 'application/octet-stream'});
  if (req.method === 'HEAD') res.end(); else res.end(readFileSync(file));
});
server.listen(port, '127.0.0.1', () => {
  const actualPort = server.address().port;
  const session = { pid: process.pid, port: actualPort, url: `http://127.0.0.1:${actualPort}/index.html`, feedback_path: feedbackPath, started_at: new Date().toISOString() };
  mkdirSync(resolve(readyPath, '..'), { recursive: true }); writeFileSync(readyPath, `${JSON.stringify(session, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(session)}\n`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
