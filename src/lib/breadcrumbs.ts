import { readdirSync } from 'fs';
import { join } from 'path';
import { getCollection } from 'astro:content';

export interface Crumb {
  label: string;
  /** Link target, or null for the current page (rendered as plain text). */
  href: string | null;
}

const PAGES_DIR = join(process.cwd(), 'src/pages');
const PAGE_FILE = /\.(astro|md|mdx)$/;

/** Collections routed at /<collection>/<entry id>/ by a [...slug] page. */
const ROUTED_COLLECTIONS = ['blog', 'courses', 'initiatives', 'newsletters'] as const;

/** Slugs whose casing can't be derived mechanically. */
const ACRONYMS: Record<string, string> = { faq: 'FAQ', snap: 'SNAP' };

/** Words that stay lowercase in title case unless they lead the phrase. */
const MINOR_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor',
  'of', 'on', 'or', 'the', 'to', 'vs',
]);

/** "stance-on-science" -> "Stance on Science". Used when nothing supplies a real title. */
function humanize(slug: string): string {
  return slug
    .split('-')
    .map((word, i) => {
      if (ACRONYMS[word]) return ACRONYMS[word];
      if (i > 0 && MINOR_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Every route a file under src/pages generates, as a base-relative path with no
 * surrounding slashes ('' for the home page). Dynamic routes are skipped — the
 * pages they generate are enumerated from their content collection instead.
 */
function staticPageRoutes(): Set<string> {
  const routes = new Set<string>();

  function walk(dir: string, prefix: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.includes('[')) continue;
      if (entry.isDirectory()) {
        walk(join(dir, entry.name), prefix ? `${prefix}/${entry.name}` : entry.name);
      } else if (PAGE_FILE.test(entry.name)) {
        const name = entry.name.replace(PAGE_FILE, '');
        routes.add(name === 'index' ? prefix : prefix ? `${prefix}/${name}` : name);
      }
    }
  }

  walk(PAGES_DIR, '');
  return routes;
}

// The route table is identical for every page, so build it once per run rather
// than once per page.
let siteRoutesCache: { routes: Set<string>; titles: Map<string, string> } | null = null;

async function siteRoutes() {
  if (siteRoutesCache) return siteRoutesCache;

  const routes = staticPageRoutes();
  const titles = new Map<string, string>();

  for (const collection of ROUTED_COLLECTIONS) {
    for (const entry of await getCollection(collection)) {
      const route = `${collection}/${entry.id}`;
      routes.add(route);
      titles.set(route, entry.data.title);
    }
  }

  siteRoutesCache = { routes, titles };
  return siteRoutesCache;
}

/**
 * Derives a breadcrumb trail from a URL, so no page has to declare its own
 * ancestry. Each ancestor segment is linked when a page actually exists at that
 * path and skipped otherwise — that keeps grouping-only segments such as the
 * /states/ level under Stance on Science out of the trail instead of emitting a
 * link that 404s.
 *
 * Labels prefer a real title (content collection frontmatter) and fall back to
 * a title-cased slug. `current` overrides the label of the final crumb, for
 * pages whose slug isn't presentable (e.g. /states/ga/ -> "Georgia").
 */
export async function buildCrumbs(
  pathname: string,
  base: string,
  current?: string
): Promise<Crumb[]> {
  const { routes, titles } = await siteRoutes();

  const relative = (pathname.startsWith(base) ? pathname.slice(base.length) : pathname)
    .replace(/^\/+|\/+$/g, '');
  const segments = relative ? relative.split('/') : [];

  const crumbs: Crumb[] = [];

  segments.forEach((segment, i) => {
    const route = segments.slice(0, i + 1).join('/');
    const label = titles.get(route) ?? humanize(segment);

    if (i === segments.length - 1) {
      crumbs.push({ label: current ?? label, href: null });
    } else if (routes.has(route)) {
      crumbs.push({ label, href: `${base}${route}/` });
    }
  });

  return crumbs;
}
