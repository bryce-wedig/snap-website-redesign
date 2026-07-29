// Loader + helpers for the member publications register (/publications/).
//
// Data lives in src/data/publications.yaml, exported from the maintained Google
// Sheet with the sheet's own column names. Everything the page renders is
// derived here at build time: display dates, DOI links, the SNAPper-highlighted
// citation, and the word cloud's terms and sizes.

import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { join } from 'path';

/** One row of the sheet, as recorded. */
export interface RawPublication {
  author: string;
  title: string;
  journal: string;
  date: string;
  citation: string;
  doi: string;
  category: string;
  disciplines: string;
  summary: string;
  abstract: string;
}

export interface Publication {
  id: number;
  author: string;
  title: string;
  journal: string;
  citation: string;
  /** Citation with the SNAPper's own name wrapped in <mark class="pub-me">. */
  citationHtml: string;
  summary: string;
  abstract: string;
  /** Broad fields, primary first. */
  cats: string[];
  cat: string;
  disciplines: string[];
  year: string | null;
  /** Display date: "May 2024", "March 2023", "In press · 2025". */
  when: string;
  /** Resolved DOI link, or null when the sheet has no usable one. */
  url: string | null;
  /** Pill tone class for the primary field. */
  tone: string;
  /** Cloud term keys this paper matches — the whole of the filter's runtime work. */
  keys: string[];
}

export type CloudKind = 'disc' | 'cat' | 'word';

export interface CloudTerm {
  key: string;
  label: string;
  kind: CloudKind;
  weight: number;
  /** Papers the term appears in (fields/disciplines) — shown in the tooltip. */
  count: number;
  /** Total occurrences across summaries and abstracts (prose terms only). */
  mentions: number;
  /** Computed font size in px, 15–55. */
  size: number;
}

/* Field -> pill tone. "orange" is the default .pill, the rest are modifiers. */
const CAT_TONE: Record<string, string> = {
  'Biological and Chemical Sciences': 'navy',
  Neuroscience: 'plum',
  Ecology: 'olive',
  'Public Health': 'orange',
  Psychology: 'navy',
  Physics: 'navy',
  'Chemical Engineering': 'olive',
  Chemistry: 'orange',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/* Generic and academic filler that would otherwise dominate the cloud. */
const CLOUD_STOP = new Set([
  'study', 'studies', 'these', 'those', 'which', 'their', 'while', 'there', 'were', 'have',
  'been', 'with', 'that', 'this', 'from', 'also', 'more', 'than', 'when', 'both', 'such',
  'they', 'each', 'into', 'over', 'other', 'using', 'used', 'found', 'shown', 'showed',
  'higher', 'lower', 'could', 'would', 'after', 'before', 'between', 'because', 'however',
  'therefore', 'people', 'participants', 'results', 'result', 'analysis', 'levels', 'level',
  'effects', 'effect', 'increased', 'decreased', 'associated', 'compared', 'significantly',
  'significant', 'suggest', 'suggests', 'potential', 'important', 'through', 'across',
  'within', 'during', 'often', 'first', 'second', 'about', 'above', 'among', 'whether',
  'measured', 'observed', 'greater', 'reduced', 'well', 'like', 'time', 'times', 'test',
  'tested', 'data',
]);

/** "5/1/2024" -> "May 2024"; free text passes through; empty/"In Press" -> "In press · {year}". */
export function formatWhen(raw: string, year: string | null): string {
  const s = (raw || '').trim();
  if (!s || /in press/i.test(s)) return year ? `In press · ${year}` : 'In press';
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return `${MONTHS[+slash[1] - 1]} ${slash[3]}`;
  return s;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Wraps the SNAPper's own name inside an APA citation string so the member is
 * unmissable. The sheet's citations use several byline conventions, so three
 * patterns are tried in order: "First M. Last", "Last, X. Y.", bare surname.
 */
export function markAuthor(citation: string, author: string): string {
  if (!citation) return '';
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = author.trim().split(/\s+/);
  const first = esc(parts[0]);
  const sur = esc(parts[parts.length - 1]);
  const re = new RegExp(
    '(' +
      [
        `${first}(?:\\s+[A-Z]\\.?)*\\s+${sur}`,
        `${sur},?\\s*(?:[A-Z]\\.\\s*)+`,
        sur,
      ].join('|') +
      ')',
    'g'
  );
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(citation)) !== null) {
    if (!m[0].length) break;
    out += escapeHtml(citation.slice(last, m.index));
    out += `<mark class="pub-me">${escapeHtml(m[0])}</mark>`;
    last = m.index + m[0].length;
  }
  return out + escapeHtml(citation.slice(last));
}

/**
 * The page's idea: one cloud built from the register itself. Disciplines carry
 * the most signal, then the broad field, then words that recur across the
 * plain-language summaries and abstracts. Terms are keyed by lowercased label,
 * so a word that is both a field and a discipline (Physics, Psychology,
 * Ecology) merges into one word whose weights sum.
 */
export function buildCloud(papers: Array<Pick<Publication, 'cats' | 'disciplines' | 'summary' | 'abstract'>>): CloudTerm[] {
  const terms = new Map<string, CloudTerm>();
  const add = (key: string, label: string, kind: CloudKind, weight: number) => {
    const k = key.toLowerCase();
    if (!terms.has(k)) terms.set(k, { key: k, label, kind, weight: 0, count: 0, mentions: 0, size: 0 });
    const t = terms.get(k)!;
    t.weight += weight;
    t.count += 1;
    if (kind === 'disc' || (kind === 'cat' && t.kind === 'word')) {
      t.kind = kind;
      t.label = label;
    }
    return t;
  };

  papers.forEach((p) => {
    p.cats.forEach((c) => add(c, c, 'cat', 3.2));
    p.disciplines.forEach((d) => add(d, d, 'disc', 4.4));
  });

  const words = new Map<string, { n: number; docs: number }>();
  papers.forEach((p) => {
    const seen = new Set<string>();
    `${p.summary} ${p.abstract}`
      .toLowerCase()
      .replace(/[^a-z\s-]/g, ' ')
      .split(/\s+/)
      .forEach((w) => {
        if (w.length < 5 || CLOUD_STOP.has(w)) return;
        const e = words.get(w) || { n: 0, docs: 0 };
        e.n += 1;
        if (!seen.has(w)) {
          e.docs += 1;
          seen.add(w);
        }
        words.set(w, e);
      });
  });

  Array.from(words.entries())
    .filter(([, e]) => e.docs >= 4)
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 12)
    .forEach(([w, e]) => {
      const t = add(w, w, 'word', 0.6 + Math.min(e.n, 22) / 9);
      t.mentions = e.n;
    });

  const list = Array.from(terms.values()).sort((a, b) => b.weight - a.weight);
  const max = list.length ? list[0].weight : 1;
  list.forEach((t) => {
    t.size = 15 + 40 * Math.pow(t.weight / max, 0.7);
  });

  // Deterministic spread so the heavy terms don't all pile up at the start:
  // walk the sorted list with a stride of 7, skipping indices already taken.
  // Not a shuffle — the cloud is identical on every build.
  const n = list.length;
  const used = new Array(n).fill(false);
  const out: CloudTerm[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    while (used[j]) j = (j + 1) % n;
    used[j] = true;
    out.push(list[j]);
    j = (j + 7) % n;
  }
  return out;
}

/** Does this paper belong under this cloud term? */
function matches(p: Publication, t: CloudTerm): boolean {
  if (t.kind === 'word') {
    return `${p.title} ${p.summary} ${p.abstract}`.toLowerCase().includes(t.key);
  }
  return (
    p.cats.some((c) => c.toLowerCase() === t.key) ||
    p.disciplines.some((d) => d.toLowerCase() === t.key)
  );
}

/** One summary begins with a Canva infographic URL followed by " - ". */
export function cleanBlurb(s: string): string {
  return (s || '').replace(/^https?:\/\/\S+\s*-\s*/, '');
}

export function loadPublications(): {
  papers: Publication[];
  cloud: CloudTerm[];
  authorCount: number;
} {
  const raw = parse(
    readFileSync(join(process.cwd(), 'src/data/publications.yaml'), 'utf-8')
  ) as RawPublication[];

  const papers: Publication[] = raw.map((p, i) => {
    const cats = (p.category || '').split(',').map((s) => s.trim()).filter(Boolean);

    let year: string | null = null;
    const fromDate = (p.date || '').match(/(19|20)\d{2}/);
    if (fromDate) year = fromDate[0];
    else {
      const fromCite = (p.citation || '').match(/((19|20)\d{2})/);
      if (fromCite) year = fromCite[1];
    }

    let url: string | null = (p.doi || '').trim();
    if (/^10\./.test(url)) url = `https://doi.org/${url}`;
    if (!/^https?:/.test(url)) url = null;

    // The sheet mixes "Drug Delivery" with "bioelectronics", and separates with
    // either a semicolon or a comma.
    const disciplines = (p.disciplines || '')
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((d) => d.charAt(0).toUpperCase() + d.slice(1));

    return {
      id: i,
      author: (p.author || '').trim(),
      title: p.title || '',
      journal: (p.journal || '').trim(),
      citation: p.citation || '',
      citationHtml: markAuthor(p.citation || '', (p.author || '').trim()),
      summary: p.summary || '',
      abstract: p.abstract || '',
      cats,
      cat: cats[0] || 'Other',
      disciplines,
      year,
      when: formatWhen(p.date, year),
      url,
      tone: CAT_TONE[cats[0]] || 'navy',
      keys: [],
    };
  });

  const cloud = buildCloud(papers);

  // Resolve every term/paper pair now so the browser only has to compare keys.
  papers.forEach((p) => {
    p.keys = cloud.filter((t) => matches(p, t)).map((t) => t.key);
  });

  const authorCount = new Set(papers.map((p) => p.author)).size;

  return { papers, cloud, authorCount };
}
