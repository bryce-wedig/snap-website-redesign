#!/usr/bin/env node
/**
 * Caps the resolution of source images in src/assets/images/.
 *
 * Astro resizes images for delivery, so oversized sources don't reach visitors
 * directly — but Astro also emits the *original* of every imported image into
 * dist/_astro/, so a 8.8 MB 5475x8213 headshot inflates the deploy artifact and
 * the repo for no benefit. This caps each directory at a resolution comfortably
 * above how the images are actually displayed.
 *
 * Safe to re-run: files already at or below their cap are only rewritten if
 * re-encoding wins more than 5%, and animated images are skipped entirely
 * (sharp would flatten them to a single frame).
 *
 * Usage:
 *   node scripts/reencode-sources.mjs --dry    # report only
 *   node scripts/reencode-sources.mjs
 */

import sharp from 'sharp';
import { readdirSync, statSync, renameSync, unlinkSync } from 'node:fs';
import { join, relative, extname, sep } from 'node:path';

const ROOT = 'src/assets/images';
const DRY = process.argv.includes('--dry');

/** Long-edge cap per directory, set well above the largest rendered size. */
const CAPS = {
  team: 1200, // rendered at 120px (240 @2x)
  about: 600, // rendered at 72px (144 @2x)
  stance_teams: 1400, // rendered at 460px tall (920 @2x)
  blog: 1440, // 720px article column @2x
  newsletters: 1440,
  initiatives: 1600,
  home: 1600, // hero cards render at 194px, but these are full-bleed elsewhere
  _root: 1200,
};

function walk(dir) {
  let out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else out.push(p);
  }
  return out;
}

const ENCODERS = {
  '.jpg': (p) => p.jpeg({ quality: 86, mozjpeg: true }),
  '.jpeg': (p) => p.jpeg({ quality: 86, mozjpeg: true }),
  '.png': (p) => p.png({ compressionLevel: 9, palette: true }),
  '.webp': (p) => p.webp({ quality: 85, effort: 5 }),
};

let saved = 0;
let touched = 0;
let skipped = 0;

for (const file of walk(ROOT)) {
  const ext = extname(file).toLowerCase();
  const encode = ENCODERS[ext];
  if (!encode) { skipped++; continue; }

  const rel = relative(ROOT, file);
  const topDir = rel.includes(sep) ? rel.split(sep)[0] : '_root';
  const cap = CAPS[topDir] ?? 1600;

  let meta;
  try {
    meta = await sharp(file).metadata();
  } catch {
    console.log(`  ! unreadable, skipped: ${rel}`);
    skipped++;
    continue;
  }

  // Animated source (GIF, animated WebP) — sharp would keep only frame 1.
  if ((meta.pages ?? 1) > 1) { skipped++; continue; }

  const before = statSync(file).size;
  const long = Math.max(meta.width, meta.height);
  const tmp = file + '.tmp';

  let pipeline = sharp(file);
  if (long > cap) {
    pipeline = pipeline.resize({
      width: meta.width >= meta.height ? cap : undefined,
      height: meta.height > meta.width ? cap : undefined,
      withoutEnlargement: true,
    });
  }

  await encode(pipeline).toFile(tmp);
  const after = statSync(tmp).size;

  // Only accept a clear win, so re-runs don't churn files for nothing.
  if (after < before * 0.95) {
    saved += before - after;
    touched++;
    const pct = Math.round((1 - after / before) * 100);
    console.log(
      `  ${(before / 1048576).toFixed(2)}MB -> ${(after / 1048576).toFixed(2)}MB (-${pct}%)  ` +
        `${meta.width}x${meta.height}${long > cap ? ` -> cap ${cap}` : ''}  ${rel}`
    );
    if (DRY) unlinkSync(tmp);
    else renameSync(tmp, file);
  } else {
    unlinkSync(tmp);
  }
}

console.log(
  `\n${DRY ? '[dry run] ' : ''}rewrote ${touched} files, skipped ${skipped}, ` +
    `saved ${(saved / 1048576).toFixed(1)} MB`
);
