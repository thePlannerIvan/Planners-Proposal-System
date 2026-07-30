import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdtempSync, readFileSync, rmSync,
} from 'node:fs';
import { basename, extname, join } from 'node:path';
import { tmpdir } from 'node:os';

function decodeXml(value) {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function unzip(file, entry = null, list = false) {
  const args = list ? ['-Z1', file] : ['-p', file, entry];
  const result = spawnSync('unzip', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error((result.stderr || `无法读取 ${entry || file}`).trim());
  return result.stdout;
}

function attribute(tag, name) {
  return decodeXml(tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] || '');
}

function sharedStrings(file, entries) {
  if (!entries.has('xl/sharedStrings.xml')) return [];
  const xml = unzip(file, 'xl/sharedStrings.xml');
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)]
    .map(match => [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map(text => decodeXml(text[1]))
      .join(''));
}

function sheetDefinitions(file, entries) {
  const workbook = unzip(file, 'xl/workbook.xml');
  const relationships = unzip(file, 'xl/_rels/workbook.xml.rels');
  const targets = new Map(
    [...relationships.matchAll(/<Relationship\b[^>]*\/?>/g)]
      .map(match => [attribute(match[0], 'Id'), attribute(match[0], 'Target')]),
  );
  return [...workbook.matchAll(/<sheet\b[^>]*\/?>/g)].map(match => {
    const id = attribute(match[0], 'r:id');
    let target = targets.get(id) || '';
    if (target.startsWith('/')) target = target.slice(1);
    else if (!target.startsWith('xl/')) target = `xl/${target.replace(/^\.\//, '')}`;
    return { name: attribute(match[0], 'name'), target };
  }).filter(sheet => sheet.target && entries.has(sheet.target));
}

function cellValue(cellTag, body, strings) {
  const type = attribute(cellTag, 't');
  if (type === 'inlineStr') {
    return [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map(match => decodeXml(match[1]))
      .join('');
  }
  const raw = decodeXml(body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] || '');
  if (type === 's') return strings[Number(raw)] ?? raw;
  if (type === 'b') return raw === '1' ? 'TRUE' : 'FALSE';
  return raw;
}

function extractXlsx(file) {
  const entries = new Set(unzip(file, null, true).split(/\r?\n/).filter(Boolean));
  if (!entries.has('xl/workbook.xml') || !entries.has('xl/_rels/workbook.xml.rels')) {
    throw new Error('不是可解析的 Excel Open XML 工作簿');
  }
  const strings = sharedStrings(file, entries);
  const lines = [];
  const sheets = sheetDefinitions(file, entries);
  for (const sheet of sheets) {
    const xml = unzip(file, sheet.target);
    for (const match of xml.matchAll(/(<c\b[^>]*>)([\s\S]*?)<\/c>/g)) {
      const ref = attribute(match[1], 'r');
      const value = cellValue(match[1], match[2], strings);
      if (String(value).trim()) lines.push(`${sheet.name}\t${ref}\t${value}`);
    }
  }
  if (!lines.length) throw new Error('工作簿没有可读取的单元格值');
  return lines.join('\n');
}

function convertXls(file) {
  const temp = mkdtempSync(join(tmpdir(), 'proposal-xls-'));
  const profile = join(temp, 'profile');
  try {
    const commands = [
      'soffice',
      'libreoffice',
      '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    ];
    let result = null;
    for (const command of commands) {
      result = spawnSync(command, [
        '--headless',
        `-env:UserInstallation=file://${profile}`,
        '--convert-to', 'xlsx',
        '--outdir', temp,
        file,
      ], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
      if (!result.error && result.status === 0) break;
    }
    if (!result || result.error || result.status !== 0) {
      throw new Error((result?.stderr || result?.stdout || result?.error?.message
        || '找不到可用的 LibreOffice，无法转换旧 .xls').trim());
    }
    const output = join(temp, `${basename(file, extname(file))}.xlsx`);
    if (!existsSync(output)) throw new Error('LibreOffice 没有生成 xlsx');
    return extractXlsx(output);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

export function extractSpreadsheetText(file) {
  try {
    const extension = extname(file).toLowerCase();
    const text = extension === '.xlsx' || extension === '.xlsm'
      ? extractXlsx(file)
      : convertXls(file);
    return {
      ok: true,
      text,
      source_bytes: readFileSync(file),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      text: '',
      source_bytes: existsSync(file) ? readFileSync(file) : null,
      error: error.message,
    };
  }
}
