#!/usr/bin/env node
/**
 * Reports what each built page actually weighs, and optionally fails if any
 * page is over budget.
 *
 * "Weighs" means what one visitor downloads, not the sum of everything on disk:
 * one srcset candidate per image (the largest, i.e. what a 2x display picks) and
 * one encode per <video>, plus the HTML, stylesheets, and scripts it links.
 * Counting every file instead would triple-count responsive images and
 * double-count the MP4/WebM pair, which no browser ever fetches together — the
 * MP4 is only there for the browsers that cannot play the WebM.
 *
 * Run `npm run build` first; this reads dist/.
 *
 * Usage:
 *   node scripts/page-weight.mjs                 # the 10 heaviest pages
 *   node scripts/page-weight.mjs --top 25
 *   node scripts/page-weight.mjs --all
 *   node scripts/page-weight.mjs --max 1.7       # exit 1 if a page exceeds 1.7 MB
 *
 * See MEDIA.md for the budgets and why they are what they are.
 */

import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';

const DIST = 'dist';
const MiB = 1048576;

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const value = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1];
};

const max = value('--max') ? Number(value('--max')) : null;
const top = flag('--all') ? Infinity : Number(value('--top') ?? 10);

if (max !== null && !Number.isFinite(max)) {
  console.error('--max needs a number of MB, e.g. --max 1.7');
  process.exit(2);
}

if (!existsSync(DIST)) {
  console.error(`No ${DIST}/ directory — run \`npm run build\` first.`);
  process.exit(2);
}

function walk(dir) {
  let out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else out.push(p);
  }
  return out;
}

let unresolved = 0;

/**
 * Turn a URL from the HTML into a file in dist/, or null if it is remote.
 *
 * The site is served under a base path (/snap-website-redesign/) that is meant
 * to disappear when it moves to snapcoalition.org, so leading path segments are
 * dropped until something matches rather than assuming any particular base. A
 * hardcoded base would silently undercount every page the day it changed.
 */
function assetSize(url, pageDir) {
  if (!url) return 0;
  let clean = url.split('#')[0].split('?')[0];
  if (!clean || /^(https?:|data:|mailto:|tel:)/i.test(clean)) return 0;
  // Non-ASCII filenames (Saúl.webp) are percent-encoded in the HTML but plain
  // UTF-8 on disk, so they only match once decoded.
  try {
    clean = decodeURIComponent(clean);
  } catch {
    /* malformed escape — fall through and try the raw form */
  }

  const candidates = [];
  if (clean.startsWith('/')) {
    const parts = clean.replace(/^\/+/, '').split('/');
    for (let i = 0; i < parts.length; i++) candidates.push(parts.slice(i).join('/'));
  } else {
    candidates.push(relative(DIST, resolve(pageDir, clean)));
  }

  for (const c of candidates) {
    const f = resolve(DIST, c);
    if (existsSync(f) && statSync(f).isFile()) return statSync(f).size;
  }
  unresolved++;
  return 0;
}

const rows = [];

for (const page of walk(DIST).filter((f) => f.endsWith('.html'))) {
  const pageDir = dirname(page);
  const size = (u) => assetSize(u, pageDir);
  let html = readFileSync(page, 'utf8');
  let bytes = statSync(page).size;

  // One encode per <video> — the largest of the offered sources, since which
  // one a browser picks depends on its codec support. Consumed first so the
  // <source> tags inside are not double-counted by the <img>/src passes below.
  html = html.replace(/<video[\s\S]*?<\/video>/g, (tag) => {
    const sources = [...tag.matchAll(/<source[^>]+src="([^"]+)"/g)].map((m) => size(m[1]));
    if (sources.length) bytes += Math.max(...sources);
    bytes += size((tag.match(/poster="([^"]+)"/) || [])[1]);
    return '';
  });

  // One candidate per responsive image: the largest, which is what a 2x
  // display asks for and therefore the worst case we should budget against.
  html = html.replace(/<img[^>]*>/g, (tag) => {
    const srcset = (tag.match(/srcset="([^"]+)"/) || [])[1];
    bytes += srcset
      ? Math.max(...srcset.split(',').map((c) => size(c.trim().split(/\s+/)[0])))
      : size((tag.match(/src="([^"]+)"/) || [])[1]);
    return '';
  });

  for (const m of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) bytes += size(m[1]);
  for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) bytes += size(m[1]);

  rows.push({ bytes, path: page.replace(/^dist\//, '').replace(/index\.html$/, '') || '/' });
}

rows.sort((a, b) => b.bytes - a.bytes);

const over = max === null ? [] : rows.filter((r) => r.bytes > max * MiB);
const shown = rows.slice(0, top);

console.log(
  `\nDelivered page weight — HTML plus one srcset candidate per image and one encode per video.\n`
);
for (const r of shown) {
  const mb = (r.bytes / MiB).toFixed(2);
  const flagged = max !== null && r.bytes > max * MiB;
  console.log(`  ${flagged ? '!' : ' '} ${mb.padStart(6)} MB  ${r.path}`);
}
if (rows.length > shown.length) console.log(`  … ${rows.length - shown.length} more`);

console.log(`\n  ${rows.length} pages, heaviest ${(rows[0].bytes / MiB).toFixed(2)} MB`);
if (unresolved) {
  console.log(`  ${unresolved} referenced file(s) could not be found in ${DIST}/ and were not counted`);
}

if (max !== null) {
  if (over.length) {
    console.error(
      `\nOver the ${max} MB budget:\n` +
        over.map((r) => `  ${(r.bytes / MiB).toFixed(2)} MB  ${r.path}`).join('\n') +
        `\n\nSee MEDIA.md for how to bring a page back under budget.\n`
    );
    process.exit(1);
  }
  console.log(`  all pages within the ${max} MB budget\n`);
} else {
  console.log('');
}
