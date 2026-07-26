// Flat JSON feed of every candidate response. Consumed by stance-search.js on
// the global search page. Mirrors the old site's
// /initiatives/stance-on-science/responses.json Liquid endpoint: each entry
// carries the fields the search page filters/sorts on, plus the pre-rendered
// card HTML so the card markup has a single source of truth.
import type { APIRoute } from 'astro';
import {
  loadStates, loadFilters, loadQuestions, loadResponses,
  tagList, renderResponseCardHtml,
} from '../../../lib/stance';

export const GET: APIRoute = () => {
  const base = import.meta.env.BASE_URL;
  const states = loadStates();
  const filters = loadFilters();

  const responses: unknown[] = [];
  for (const s of states) {
    const rows = loadResponses(s.code);
    if (!rows.length) continue;
    const questions = loadQuestions(s.code);
    for (const r of rows) {
      const lq = questions.find((q) => q.id === r.question);
      responses.push({
        candidate: `${r.candidate_first_name} ${r.candidate_last_name}`,
        candidate_last_name: r.candidate_last_name,
        state: s.code,
        state_name: s.name,
        race: r.race,
        district: r.district != null && r.district !== '' ? String(r.district) : null,
        party: r.party ?? null,
        county_race: r.county_race ?? null,
        primary_candidate: !!r.primary_candidate,
        tag: tagList(lq),
        date: r.date ?? null,
        response_md: r.response,
        card_html: renderResponseCardHtml(r, questions, s.name),
      });
    }
  }

  const statesMeta: Record<string, { name: string; url: string }> = {};
  for (const s of states) {
    statesMeta[s.code] = {
      name: s.name,
      url: `${base}initiatives/stance-on-science/states/${s.code}/`,
    };
  }

  return new Response(
    JSON.stringify({
      responses,
      filters: {
        tags: filters.tags,
        races: filters.races,
        parties: filters.parties,
      },
      states: statesMeta,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
};
