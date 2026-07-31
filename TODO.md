# TODO

Known gaps and follow-ups. Each item says what the situation is, why it was left,
and what "done" looks like.

---

## 1. McClintock Letters sub-pages are listed as if they were initiatives

**Where:** `src/content/initiatives/mcclintock-letters-open-letter.md`,
`src/content/initiatives/mcclintock-letters-press-release.md`,
`src/pages/initiatives/mcclintock-letters.astro`

**Situation.** `/initiatives/` shows three cards under "Past work" for what is really
one initiative: *McClintock Letters*, *Open Letter: A Call to Preserve the Future of
American Science*, and *McClintock Letters Press Release*. The latter two are
sub-pages, not initiatives.

This is a migration artifact. On the old Jekyll site
(`~/Documents/GitHub/SNAPscipolorg.github.io`), sub-pages carried **no `category`**
in their frontmatter, and `_pages/initiatives.html` looped over categories — so they
were never listed. The redesign's schema makes `category` required, so whoever
ported them had to supply `category: past`, which put them on the index.

**Why it wasn't just fixed.** There is now an `unlisted: true` flag
(`src/content.config.ts`) that keeps an entry routed but off the index — it's what
the Congressional Visits one-pagers use. Setting it on these two would hide them,
**but `mcclintock-letters.astro` doesn't link to them anywhere**, so the index card
is currently their only route in. Unlisting them without adding links first would
orphan both pages.

**Done looks like:** add links to the open letter and press release somewhere in
`src/pages/initiatives/mcclintock-letters.astro` (the campaign page), *then* set
`unlisted: true` on both content files. Verify with `npm run build && npm run check:links`
that both pages are still reachable.

---

## 2. `links.yml` cannot catch broken internal links

**Where:** `.github/workflows/links.yml`, `scripts/check-links.mjs`

**Situation.** The lychee workflow runs over `./src/content/**/*.md`. That is the
wrong layer for internal links, for two structural reasons:

1. In source, an internal link is a bare root-relative path (`/initiatives/foo/`).
   The deployment base (`/snap-website-redesign/`) is applied at build time by the
   `remarkRebasePaths` plugin in `astro.config.mjs`, so the string lychee sees is
   never the string a visitor clicks.
2. Whether a path resolves depends on which *routes* exist — content collection
   entries, `[...slug]` filters, dedicated `.astro` pages — none of which is
   knowable from the markdown alone.

This is exactly why five 404s (`start-in-a-snap-faq`, `start-in-a-snap-missions`,
`start-in-a-snap-event-ideas`, `congressional-visits-one-pager-1`, `-2`) survived in
`main` for months with the workflow green.

It also only covers `src/content/`, so links written in `.astro` pages
(nav, footer, breadcrumbs, hand-built pages like the Stance state pages) were never
checked at all.

**What exists now.** `npm run check:links` (`scripts/check-links.mjs`) walks `dist/`
after a build and checks every internal `href`/`src` against the filesystem. It reads
the base from `astro.config.mjs`, so it survives the switch to the custom domain.

**Done looks like:** split the two concerns in CI —
- keep lychee for **external** links (`--exclude '^/'` or similar) on its weekly cron;
- add a build + `npm run check:links` step for **internal** links, on push/PR rather
  than weekly, since it's fast and deterministic.

Also note `links.yml` currently triggers on `push: branches: [source]` — a branch
that doesn't exist in this repo (it's the old Jekyll repo's default branch). It only
ever runs on the cron or manually. Fix the trigger while you're in there.

The "Create Issue From File" step is commented out, so even a lychee failure is
currently silent (`fail: false` too).

---

## 3. `src/content/initiatives/*.md` bodies that render nowhere

**Where:** `src/content/initiatives/mcclintock-letters.md`,
`src/content/initiatives/stance-on-science.md`

**Situation.** Both have a bespoke page in `src/pages/initiatives/` that takes route
priority. The markdown **frontmatter is still live** — the `/initiatives/` index reads
title, excerpt, date and category from it — but the **body is dead**. Both files now
carry an HTML comment saying so.

The bodies were left in place rather than deleted because each references an image
(`ML-header.png`, `STANCE_Logo.png`) that nothing else uses; stripping the bodies
would orphan those two assets.

**Done looks like:** either delete the bodies and the two now-unused images from
`src/assets/images/initiatives/`, or leave as-is. Low priority — it's inert either
way, the comment prevents the "why doesn't my edit show up" trap.

---

## 4. Course sub-pages are placeholders

**Where:** `src/content/courses/start-in-a-snap-{faq,missions,event-ideas}.md`

These were ported from the old site, where they are also "under construction"
placeholders. They exist so the *Helpful Resources* links on
`/courses/start-in-a-snap/` resolve. They're `unlisted: true`, so they don't appear
on `/courses/`. Real content still needs writing.
