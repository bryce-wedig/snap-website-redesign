// Shared loaders + helpers for the Stance on Science pages.
//
// Data lives in src/data: stance_states.yaml (the per-state registry),
// stance_filters.yaml (filter vocabulary), stance_questions/<code>.yaml,
// stance_responses/<code>.yaml, and stance_team/<code>.yaml.

import { readFileSync, existsSync } from 'fs';
import { parse } from 'yaml';
import { join } from 'path';
import { micromark } from 'micromark';

export interface StanceState {
  code: string;
  name: string;
  demonym_plural: string;
  team_email: string;
  ballot_lookup_url?: string;
  ballot_lookup_label?: string;
  instagram_url?: string;
  facebook_url?: string;
  tiktok_url?: string;
  x_url?: string;
  bluesky_url?: string;
  reddit_url?: string;
  heading?: string;
  last_updated?: string;
  hub_blurb?: string;
}

export interface Question {
  id: string;
  question: string;
  tag: string | string[];
}

export interface Response {
  candidate_first_name: string;
  candidate_last_name: string;
  state: string;
  race: string;
  district?: number | string | null;
  party: string;
  question: string;
  date?: string | null;
  response: string;
  county_race?: string | null;
  primary_candidate?: boolean;
}

export interface Filters {
  tags: string[];
  races: string[];
  parties: string[];
}

export interface TeamItem {
  image?: string;
  alt?: string;
  instagram?: string;
}

const dataDir = join(process.cwd(), 'src/data');

export function loadStates(): StanceState[] {
  return parse(readFileSync(join(dataDir, 'stance_states.yaml'), 'utf-8')) as StanceState[];
}

export function loadFilters(): Filters {
  return parse(readFileSync(join(dataDir, 'stance_filters.yaml'), 'utf-8')) as Filters;
}

export function loadQuestions(code: string): Question[] {
  const p = join(dataDir, `stance_questions/${code}.yaml`);
  if (!existsSync(p)) return [];
  return (parse(readFileSync(p, 'utf-8')) ?? []) as Question[];
}

export function loadResponses(code: string): Response[] {
  const p = join(dataDir, `stance_responses/${code}.yaml`);
  if (!existsSync(p)) return [];
  return (parse(readFileSync(p, 'utf-8')) ?? []) as Response[];
}

export function loadTeam(code: string): TeamItem[] {
  const p = join(dataDir, `stance_team/${code}.yaml`);
  if (!existsSync(p)) return [];
  return (parse(readFileSync(p, 'utf-8')) ?? []) as TeamItem[];
}

/* ── Helpers (mirroring the old site's Liquid filters) ─────────────────── */

export const md = (s?: string | null): string => micromark(s ?? '');

export const mdInline = (s?: string | null): string =>
  md(s).replace(/^<p>/, '').replace(/<\/p>\s*$/, '').trim();

export const tagList = (q?: Question | null): string[] =>
  q && q.tag ? (Array.isArray(q.tag) ? q.tag : [q.tag]) : [];

export const raceLabel = (r?: string): string => (r ?? '').replace(' [All]', '');

export const partySlug = (p?: string): string => (p ?? '').toLowerCase().replace(/ /g, '-');

export const fullName = (r: Response): string =>
  `${r.candidate_first_name} ${r.candidate_last_name}`;

export function formatDate(d?: string | null): string {
  if (!d) return '';
  // Parse as a plain calendar date (avoid TZ shifting an ISO date back a day).
  const dt = new Date(`${d}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function joinWithAnd(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function groupBy<T>(arr: T[], keyFn: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of arr) {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(x);
  }
  return m;
}

// Natural district order: numeric ascending (2 before 10), a lettered variant
// right after its number ("14" before "14A"), non-numeric values first then
// alphabetically. Mirrors the old site's sort_districts Liquid filter.
export function sortDistricts(districts: Array<number | string | null | undefined>): string[] {
  return [...new Set(
    districts
      .filter((d): d is number | string => d != null && String(d).trim() !== '')
      .map((d) => String(d))
  )].sort((a, b) => {
    const ai = parseInt(a, 10) || 0;
    const bi = parseInt(b, 10) || 0;
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });
}

/* ── Response card HTML (global search feed) ───────────────────────────── */

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Renders one candidate response as a stance-response-card, matching the
 * markup the state pages' topic view emits. Used to pre-render `card_html`
 * for responses.json so stance-search.js can insert cards verbatim
 * (equivalent of the old site's _includes/stance/response_card.html with
 * show_state=true and interactive_tags=true).
 */
export function renderResponseCardHtml(
  r: Response,
  questions: Question[],
  stateName: string,
): string {
  const lq = questions.find((q) => q.id === r.question);
  const tags = tagList(lq);
  const tagAttr = tags.join('|');
  const district = r.district != null && r.district !== '' ? String(r.district) : '';
  const qNum = lq ? questions.indexOf(lq) + 1 : 0;

  const metaBadges: string[] = [];
  metaBadges.push(
    `<span class="stance-badge stance-badge--state" data-state="${esc(r.state)}" data-filter="state" role="button" tabindex="0" aria-label="Filter by ${esc(stateName)}">${esc(stateName)}</span>`
  );
  metaBadges.push(
    `<span class="stance-badge stance-badge--race" data-race="${esc(r.race)}" data-filter="race" role="button" tabindex="0" aria-label="Filter by ${esc(r.race)}">${esc(r.race)}</span>`
  );
  if (district) {
    metaBadges.push(
      `<span class="stance-badge stance-badge--dist" data-district="${esc(district)}" data-filter="district" role="button" tabindex="0" aria-label="Filter by District ${esc(district)}">District ${esc(district)}</span>`
    );
  }
  if (r.county_race) {
    metaBadges.push(
      `<span class="stance-badge stance-badge--county-race" data-county_race="${esc(r.county_race)}" data-filter="county_race" role="button" tabindex="0" aria-label="Filter by ${esc(r.county_race)}">${esc(r.county_race)}</span>`
    );
  }
  if (r.party) {
    metaBadges.push(
      `<span class="stance-badge stance-badge--party stance-badge--party-${partySlug(r.party)}" data-party="${esc(r.party)}" data-filter="party" role="button" tabindex="0" aria-label="Filter by ${esc(r.party)}">${esc(r.party)}</span>`
    );
  }
  for (const t of tags) {
    metaBadges.push(
      `<span class="stance-badge stance-badge--tag" data-tag="${esc(t)}" data-filter="tag" role="button" tabindex="0" aria-label="Filter by ${esc(t)}">${esc(t)}</span>`
    );
  }

  const questionHtml = lq
    ? `<p class="stance-response-card__question"><span class="stance-response-card__qn">Q${qNum}</span> ${mdInline(lq.question)}</p>`
    : '';
  const footer = r.date
    ? `<footer class="stance-response-card__footer"><small>Submitted ${formatDate(r.date)}</small></footer>`
    : '';

  return (
    `<article class="stance-response-card"` +
    ` data-candidate="${esc(r.candidate_last_name.toLowerCase())}"` +
    ` data-date="${esc(r.date ?? '')}"` +
    ` data-state="${esc(r.state.toLowerCase())}"` +
    ` data-tag="${esc(tagAttr)}"` +
    ` data-race="${esc(r.race)}"` +
    ` data-district="${esc(district)}"` +
    ` data-party="${esc(r.party ?? '')}"` +
    ` data-county-race="${esc(r.county_race ?? '')}"` +
    ` data-primary-candidate="${r.primary_candidate ? 'true' : 'false'}">` +
    `<header class="stance-response-card__header">` +
    `<h4 class="stance-response-card__candidate">${esc(fullName(r))}</h4>` +
    `<div class="stance-response-card__meta">${metaBadges.join('')}</div>` +
    `</header>` +
    `<div class="stance-response-card__body">${questionHtml}${md(r.response)}</div>` +
    footer +
    `</article>`
  );
}
