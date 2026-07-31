#!/usr/bin/env node
/**
 * Verifies that every internal link in the built site resolves to a real file.
 *
 * Walks dist/ and checks each href/src pointing at the deployment base
 * (e.g. /snap-website-redesign/...) against what is actually on disk, mirroring
 * how a static host serves it: a directory path serves its index.html. Fragments
 * and query strings are stripped, and percent-encoding is decoded, so
 * /blog/caf%C3%A9/ is checked as the directory it really is.
 *
 * This catches what the lychee workflow structurally cannot: lychee runs over
 * src/content/*.md, where an internal link is still a bare root-relative path
 * that no base has been applied to and no route has been generated for yet.
 * Only the built output knows which routes exist.
 *
 * The base is read from astro.config.mjs, so this keeps working after a switch
 * to the custom domain (base '/').
 *
 * Run `npm run build` first; this reads dist/.
 *
 * Usage:
 *   npm run check:links
 *   node scripts/check-links.mjs            # exits 1 if anything is broken
 */

import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DIST = 'dist';

const dist = resolve(DIST);
if (!existsSync(dist)) {
  console.error(`No ${DIST}/ directory — run \`npm run build\` first.`);
  process.exit(1);
}

const { default: astroConfig } = await import(
  pathToFileURL(resolve('astro.config.mjs')).href
);
const base = astroConfig.base ?? '/';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (name.endsWith('.html')) out.push(path);
  }
  return out;
}

/** Does this site-absolute path resolve the way a static host would serve it? */
function resolves(pathname) {
  const onDisk = join(dist, decodeURIComponent(pathname.slice(base.length)));
  if (existsSync(onDisk) && statSync(onDisk).isFile()) return true;
  if (existsSync(join(onDisk, 'index.html'))) return true;
  if (existsSync(`${onDisk}.html`)) return true;
  return false;
}

const pages = walk(dist);
const broken = new Map(); // target -> Set of pages linking to it
let checked = 0;

for (const page of pages) {
  const html = readFileSync(page, 'utf-8');
  for (const [, target] of html.matchAll(/(?:href|src)="([^"]*)"/g)) {
    if (!target.startsWith(base)) continue;
    const path = target.split('#')[0].split('?')[0];
    if (!path) continue;
    checked++;
    if (resolves(path)) continue;
    if (!broken.has(path)) broken.set(path, new Set());
    broken.get(path).add(page.slice(dist.length + 1));
  }
}

console.log(
  `Scanned ${pages.length} page(s), ${checked} internal link(s) under ${base}\n`
);

if (broken.size === 0) {
  console.log('✓ No broken internal links.');
  process.exit(0);
}

console.log(`✗ ${broken.size} broken target(s):\n`);
for (const [target, sources] of [...broken].sort()) {
  console.log(`  ${target}`);
  for (const source of [...sources].sort()) console.log(`      ← ${source}`);
}
process.exit(1);
