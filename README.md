# SNAP Website Redesign

This is the redesigned SNAP website, built with [Astro](https://astro.build/) — a modern static site generator.

## Tech Stack

| Technology | Purpose |
|---|---|
| [Astro](https://astro.build/) | Static site generator (zero JS by default, fast builds) |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe content schemas and components |
| CSS Custom Properties | Styling system based on the SNAP Style Guide |
| [Leaflet.js](https://leafletjs.com/) | Interactive member/organization map (bundled locally, not from a CDN) |
| [Font Awesome](https://fontawesome.com/) | Icons — self-hosted, subset to only the icons in use |
| [Open Sans](https://fonts.google.com/specimen/Open+Sans) / [Montserrat](https://fonts.google.com/specimen/Montserrat) | Typography (per Style Guide), latin subsets only |
| YAML + Markdown/MDX | Content management (data files and content collections) |

Everything the site loads is served from its own origin, apart from Google
Analytics and the map's basemap tiles. Third-party stylesheets block rendering,
so new dependencies should be added via npm rather than a CDN `<link>`.

## Project Structure

```
astro-site/
├── public/                      # Static assets (copied as-is, never optimized)
│   ├── favicon.ico
│   ├── data/                    # GeoJSON etc.
│   ├── files/                   # Downloadable PDFs
│   └── scripts/                 # Standalone client scripts
│
├── scripts/                     # Build-time maintenance tools (run by hand)
│   ├── build-icon-subset.mjs    # Regenerates the Font Awesome subset
│   └── reencode-sources.mjs     # Caps the resolution of source images
│
├── src/
│   ├── assets/                  # Images and fonts processed by Astro
│   │   ├── fonts/               # Font Awesome subset (generated)
│   │   └── images/
│   │       ├── home/            # Home page hero photos
│   │       ├── about/           # Member organization logos
│   │       ├── team/            # Team member headshots
│   │       ├── initiatives/     # Initiative page images
│   │       ├── blog/            # Blog post figures
│   │       └── newsletters/     # Newsletter images
│   │
│   ├── components/              # Reusable Astro components
│   │   ├── Header.astro         # Site navigation bar
│   │   ├── Footer.astro         # Site footer
│   │   ├── Figure.astro         # Post image + caption (optimized)
│   │   ├── HomeHero.astro       # Home page hero (interactive Leaflet.js map)
│   │   └── stance/              # Stance on Science state explorer
│   │
│   ├── content/                 # Content collections (Markdown / MDX files)
│   │   ├── blog/                # Blog posts
│   │   ├── newsletters/         # Monthly newsletters
│   │   ├── initiatives/         # Initiative pages
│   │   └── courses/             # Educational course content
│   │
│   ├── data/                    # YAML data files
│   │   ├── site.yaml            # Site-wide configuration (nav, social links, etc.)
│   │   ├── members.yaml         # Team member profiles
│   │   ├── member_orgs.yaml     # Member organization details
│   │   ├── press.yaml           # Press mentions
│   │   ├── mcclintock_letters.yaml  # Published McClintock Letters by state
│   │   ├── map_markers.yaml     # Map pins (member cities + organizations)
│   │   ├── home_hero.yaml       # Home page hero slides and copy
│   │
│   ├── layouts/                 # Page layout templates
│   │   ├── BaseLayout.astro     # Root HTML template (head, meta, analytics)
│   │   ├── PageLayout.astro     # Standard page with header/footer
│   │   └── PostLayout.astro     # Blog/newsletter/initiative post layout
│   │
│   ├── pages/                   # File-based routing (each file = a page)
│   │   ├── index.astro          # Home page
│   │   ├── about.astro          # About / Member Organizations
│   │   ├── team.astro           # Team member directory
│   │   ├── press.astro          # Press mentions list
│   │   ├── join.astro           # Get Involved page
│   │   ├── 404.astro            # 404 error page
│   │   ├── blog/
│   │   │   ├── index.astro      # Blog listing page
│   │   │   └── [...slug].astro  # Individual blog post pages
│   │   ├── newsletters/
│   │   │   ├── index.astro      # Newsletter listing page
│   │   │   └── [...slug].astro  # Individual newsletter pages
│   │   ├── initiatives/
│   │   │   ├── index.astro      # Initiatives listing page
│   │   │   └── [...slug].astro  # Individual initiative pages
│   │   └── courses/
│   │       ├── index.astro      # Courses listing page
│   │       └── [...slug].astro  # Individual course pages
│   │
│   ├── styles/
│   │   └── global.css           # Global styles, colors, typography, components
│   │
│   └── content.config.ts        # Content collection schemas (type validation)
│
├── astro.config.mjs             # Astro configuration
├── tsconfig.json                # TypeScript configuration
├── package.json                 # Dependencies and scripts
└── README.md                    # This file
```

## Building Locally

### Prerequisites

- [Node.js](https://nodejs.org/) v18+ (LTS recommended)
- npm (comes with Node.js)

If you are developing in VSCode, the [Astro extension for VSCode](https://marketplace.visualstudio.com/items?itemName=astro-build.astro-vscode) is useful.

### Setup

```bash
# Navigate to the astro-site directory
cd astro-site

# Install dependencies
npm install

# Start the development server
npm run dev
```

The site will be available at `http://localhost:4321` with hot-reload.

### Other Commands

```bash
# Build for production
npm run build

# Preview the production build locally
npm run preview
```

### Maintenance Scripts

Two scripts in `scripts/` are run by hand, not during the build — the deploy
workflow is Node-only, and these need extra tooling. Their output is committed.

```bash
# Cap the resolution of source images. Run after adding large photos.
# Astro resizes images for delivery, but it also emits the original of every
# image it imports, so oversized sources bloat the deploy artifact.
node scripts/reencode-sources.mjs --dry   # report first
node scripts/reencode-sources.mjs
```

```bash
# Regenerate the Font Awesome subset. Run after using an icon not already
# included — an icon that isn't in the subset renders as a blank box.
# Add its name to the ICONS list in the script first.
pip install fonttools brotli                # once
node scripts/build-icon-subset.mjs
```

## How Content is Organized

### Data Files (YAML)

Data files live in `src/data/` and contain structured information that is displayed on pages. These are plain YAML files — no special syntax needed.

### Content Collections (Markdown)

Content collections live in `src/content/` and are Markdown files with YAML frontmatter. Astro validates their frontmatter against the schemas defined in `src/content.config.ts`, so if a required field is missing, the build will fail with a clear error message.

---

## How to Make Common Updates

### Adding a Team Member

1. Add the member's headshot photo to `src/assets/images/team/`
2. Add a new entry to `src/data/members.yaml`:

```yaml
- name: Jane Doe
  pronouns: she/her
  photo: Jane.jpg
  info: Jane is a PhD student at Example University studying...
  email: jane@example.edu
  bluesky: janedoe.bsky.social
  medium:
  instagram:
  linkedin: janedoe
  twitter:
  website: https://janedoe.com
```

> **Note:** Members are listed alphabetically by first name. For `instagram`, `twitter`, `linkedin`, and `bluesky`, only the handle is needed (not the full URL).

### Adding a Member Organization

1. Add the organization's logo to `src/assets/images/about/`
2. Add a new entry to `src/data/member_orgs.yaml`:

```yaml
- name: Example Science Policy Group
  photo: example_logo.png
  email: contact@example.edu
  bluesky: example.bsky.social
  instagram: examplegroup
  linkedin: example-science-policy
  website: https://example.edu/policy
```

3. Add the organization's location to the map by appending an entry to the `orgs` list in `src/data/map_markers.yaml`:

```yaml
  - { lat: 40.44, lng: -79.95, name: "Organization Name", location: "University Name" }
```

> **Note:** Organizations are listed alphabetically. For `instagram` and `linkedin`, only the handle is needed.

### Adding a Press Mention

1. Add a new entry to `src/data/press.yaml` (entries are listed in descending order by date):

```yaml
- headline: "Article Title Here"
  source: Publication Name
  date: 2026-03-15
  website: https://example.com/article
  category: 'McClintock Letters'
```

> **Note:** The `category` field links the press mention to an initiative page. To see which category strings are used, check the initiative Markdown files. You can link to multiple initiatives:
> ```yaml
> category:
>   - Congressional Visits
>   - McClintock Letters
> ```

### Adding a Newsletter

1. Create a new Markdown file in `src/content/newsletters/` following the naming convention: `YYYY-MM-DD-monthly-newsletter.md`
2. Add the required frontmatter:

```markdown
---
title: "SNAP Monthly Newsletter - March 2026"
date: 2026-03-15
---

Your newsletter content here in Markdown...
```

3. To add images, see [Adding Images to Posts](#adding-images-to-posts) below.

### Adding a Blog Post

1. Create a new Markdown file in `src/content/blog/`. The filename becomes the URL slug (e.g., `my-post-title.md` → `/blog/my-post-title/`).
2. Add the required frontmatter:

```markdown
---
title: "Your Blog Post Title"
date: 2026-03-15
author: "Author Name"
excerpt: "A brief description for the listing page."
---

Your post content here in Markdown...
```

3. For images, see [Adding Images to Posts](#adding-images-to-posts) below.

### Adding Images to Posts

Post images go through Astro's asset pipeline, which converts them to WebP,
generates a responsive `srcset`, and sets `width`/`height` so the page doesn't
shift as they load. That only works for images under `src/assets/`, referenced by
a path relative to the post — **not** `public/`, and **not** a `/images/...` path.

1. Put the image in `src/assets/images/blog/` (or `newsletters/`, `initiatives/`).
2. Give the post a `.mdx` extension rather than `.md`, import the image, and use
   the `<Figure>` component:

```mdx
---
title: "Your Blog Post Title"
date: 2026-03-15
---

import Figure from '../../components/Figure.astro';
import seedBank from '../../assets/images/blog/your_figure.webp';

<Figure src={seedBank} alt="What the image shows, for screen readers">
  Optional caption. Markdown works here, including [links](https://example.org).
</Figure>
```

Add `square` (`<Figure src={…} alt="…" square>`) for square corners instead of
the default rounded ones. Omit the children entirely for an uncaptioned image.

A few MDX gotchas, since `.mdx` is stricter than `.md`:

- Bare URLs in angle brackets (`<https://example.org>`) are not valid — write
  them as `[https://example.org](https://example.org)`.
- Stray `{` or `}` in body text must be escaped as `\{` / `\}`.
- Raw HTML must be well-formed and self-closing (`<br />`, not `<br>`).

Posts with no images can stay as plain `.md`.

Animated GIFs are the one exception to the pipeline: sharp would flatten them to
a single frame, so `<Figure>` detects them and ships the original untouched.
Keep them small.

### Adding a New Initiative

1. Create a new Markdown file in `src/content/initiatives/`:

```markdown
---
title: "New Initiative Name"
date: 2026-03-15
category: current
excerpt: "Brief description of the initiative."
---

## Initiative Name

Your initiative content here in Markdown...
```

> **Valid categories:** `current`, `past`, `upcoming`

### Updating the Navigation

Edit `src/data/site.yaml` and modify the `nav` list:

```yaml
nav:
  - name: About
    href: /about/
  - name: New Page
    href: /new-page/
```

### Adding a New Member City to the Map

Append a new entry to the `cities` list in `src/data/map_markers.yaml`:

```yaml
  - { lat: 38.876933, lng: -77.089309, name: "City, State" }
```

You can find coordinates using [Google Maps](https://maps.google.com) (right-click → "What's here?").

## Style Guide

The website follows the official SNAP Style Guide:

### Colors
| Color | Hex | Usage |
|---|---|---|
| Navy | `#213863` | Primary brand color, headings, nav |
| Orange | `#E89142` | Accent, CTAs, highlights |
| Slate | `#687DA2` | Secondary text, accents |
| Peach | `#F4D294` | Soft accents |
| Yellow Light | `#F2F493` | Highlight backgrounds |
| Olive | `#C2C354` | Accent |
| Plum | `#310A45` | Accent |

### Typography
- **Headings:** Open Sans Semibold
- **Body:** Open Sans Regular
- **Subtitles / Quotes:** Montserrat Medium or Bold

## Deployment

The site is deployed to GitHub Pages via `.github/workflows/deploy.yml`, which builds and publishes on every push to `main`. Enable it in **Settings → Pages → Source → GitHub Actions**.

The site is currently served at `https://bryce-wedig.github.io/snap-website-redesign/` (GitHub Pages).

### Switching to snapcoalition.org

When ready to serve from the custom domain instead of the github.io URL:

1. **`astro.config.mjs`** — update `site` and remove `base`:
   ```js
   site: 'https://snapcoalition.org',
   // base: '/snap-website-redesign',  ← delete this line
   ```
2. **`public/CNAME`** — create this file containing just:
   ```
   snapcoalition.org
   ```
3. **`remarkRebasePaths`** in `astro.config.mjs` — delete the plugin and its
   `remarkPlugins` entry. It exists only to prefix root-relative *link* paths
   (`/initiatives/...`) with the base path; without a `base`, they work as-is.
   Content images need no change — they are referenced by paths relative to the
   post and resolved by Astro's asset pipeline, which is independent of `base`.
4. **DNS** — point your domain to GitHub Pages. For an apex domain, add four `A` records pointing to GitHub's IPs (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`). For `www`, add a `CNAME` record pointing to `bryce-wedig.github.io`.
5. In **Settings → Pages**, set the custom domain to `snapcoalition.org` and enable **Enforce HTTPS**.

### GitHub Actions Workflow

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd astro-site && npm ci && npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: astro-site/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

## Content Validation

Astro content collections validate every Markdown file's frontmatter at build time. If a required field is missing or has the wrong type, the build will fail with a descriptive error. The schemas are defined in `src/content.config.ts`.

For example, if you create a blog post without a `title` field, you'll see:
```
[content] Invalid frontmatter in "blog/my-post.md"
  title: Required
```

This prevents broken content from reaching production.
