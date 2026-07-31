import type { ImageMetadata } from 'astro';

type GlobMap = Record<string, { default: ImageMetadata }>;

/**
 * Resolves a filename coming from a YAML data file to an imported image asset.
 *
 * Images named in data (members.yaml, member_orgs.yaml, …) can't be imported
 * statically, so callers pass an `import.meta.glob(..., { eager: true })` map
 * and this looks the file up in it.
 *
 * Filenames are compared after Unicode NFC normalization: macOS stores names
 * decomposed (NFD), so "Saúl.png" on disk and "Saúl.png" in the YAML can be
 * byte-different while looking identical. A miss throws rather than returning
 * undefined — a silently broken image is much harder to notice than a failed
 * build, and the casing traps here are real ("Jordan.JPG").
 */
export function resolveImage(glob: GlobMap, dir: string, filename: string): ImageMetadata {
  const want = `${dir}/${filename}`.normalize('NFC');

  for (const [key, mod] of Object.entries(glob)) {
    if (key.normalize('NFC') === want) return mod.default;
  }

  const available = Object.keys(glob)
    .map((k) => k.slice(dir.length + 1))
    .sort()
    .join(', ');
  throw new Error(
    `Image "${filename}" not found in ${dir}.\nAvailable files: ${available}`
  );
}
