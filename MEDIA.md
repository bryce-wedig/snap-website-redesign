# Media Guide

How to add images, animations, and video to this site without making a page
slow. Read this before committing any media file over about 1 MB.

The short version:

- Content media goes in **`src/assets/`**, never `public/`.
- Use **`<Figure>`** for images, **`<Video>`** for anything that moves.
- **Convert any animated GIF over ~1 MB** to MP4 + WebM.
- Aim to keep each page's delivered weight **around 1.5 MB**.

Those last two are targets, not gates. CI is deliberately generous and only
fails on genuinely large files — see [CI enforces this](#ci-enforces-this).

---

## Why this matters

### Page weight is load time

Every byte on a page is a byte a visitor waits for. The site is statically
hosted, so there is no server-side compression of media and no image CDN doing
the work for us — whatever is committed is what gets shipped.

Transfer time for a whole page, at two connection speeds:

| Page weight | 5 Mbps (typical mobile) | 1.6 Mbps (weak signal) |
| ----------- | ----------------------- | ---------------------- |
| 20.5 MB     | ~33 s                   | ~103 s                 |
| 2.5 MB      | ~4 s                    | ~13 s                  |
| 1.5 MB      | ~2.4 s                  | ~8 s                   |

That is transfer arithmetic only — real load time is worse once latency,
round-trips, and rendering are included. It is meant to show the shape of the
problem, not to be a benchmark.

This audience matters here. SNAP's readers are researchers, students, and
policy staff, often on phones, conference wifi, or institutional networks. A
30-second page is a page nobody reads.

### It also bloats the repository

Astro emits the **original** of every imported image into `dist/`, alongside the
resized variants it generates. An oversized source therefore costs twice: once
in the repo, once in the deploy artifact. This is the same reason
`scripts/reencode-sources.mjs` exists.

Git also keeps every version of a binary forever. A 19 MB file committed once is
19 MB in every future clone, even after it is deleted. Getting media right the
first time is much cheaper than fixing it later.

GitHub Pages additionally has a recommended site-size limit and a soft monthly
bandwidth limit; check GitHub's current documentation for the figures. We are
nowhere near them, and the point is to stay that way.

### What actually happened

A member profile post included a 246-frame microscopy timelapse as an **18.9 MB
GIF**. That one file made the post **20.5 MB** — more than ten times heavier
than any other page on the site, which all sat under 1.7 MB.

The instinct is to re-compress the GIF. That was tried and does not work:

| Attempt                        | Result                                |
| ------------------------------ | ------------------------------------- |
| GIF, 400px wide, 64 colours    | 5.8 MB, and visibly degraded          |
| Animated WebP, q45             | 6.8 MB                                |
| **MP4 + WebM**                 | **854 KB + 555 KB, no visible loss**  |

Converting to video cut the page to **1.53 MB delivered** — a 93% reduction,
with the scientific content intact. See
[Animated GIFs must become video](#animated-gifs-must-become-video) for the
recipe and the trap that makes a naive conversion fail.

---

## Quick reference

| What you have                       | What to do                                                  |
| ----------------------------------- | ----------------------------------------------------------- |
| Photo / diagram / chart             | `src/assets/images/…`, use `<Figure>`                        |
| Animated GIF **under ~1 MB**        | `src/assets/images/…`, use `<Figure>` (passed through as-is) |
| Animated GIF **over ~1 MB**         | Convert to MP4 + WebM, use `<Video>`                         |
| Video from a camera, screen capture | Encode to MP4 + WebM, use `<Video>`                          |
| PDF, slide deck, downloadable file  | `public/files/`, link to it normally                         |
| Anything with audio that matters    | Ask first — `<Video>` is built for silent, looping clips     |

**Budgets come in two tiers, on purpose.**

- **Aim** for pages under ~1.5 MB delivered, and treat any single asset over
  ~1 MB as something to justify. That is where the rest of the site sits, and
  it is what the advice in this guide is written against.
- **CI fails** only far above that: a 5 MB GIF, a 10 MB asset, a 10 MB page.
  It is a backstop against an accidental upload — a raw camera dump, a screen
  recording, a GIF nobody converted — not a style guide. Passing CI does not
  mean a file was a good idea.

"Delivered" means what one browser actually downloads: one `srcset` candidate
per image, one encode per video — not the sum of every file on disk.

---

## Where files go, and why

**Content media belongs in `src/assets/`.** Files there are processed by Astro's
asset pipeline: converted to WebP, resized into a responsive `srcset`, given
intrinsic `width`/`height` so the page doesn't shift as they load, and
fingerprinted for cache-busting.

**`public/` is copied verbatim** — no conversion, no resizing, no fingerprint. It
is right for PDFs and downloads, and wrong for content images.

There is a second reason, specific to this repo. The site deploys under a base
path (`/snap-website-redesign/`), and `astro.config.mjs` rewrites root-relative
*link* paths to match. It deliberately does **not** rewrite image paths, because
assets under `src/assets/` are referenced by a path relative to the post and
resolved by the pipeline itself. A `/images/…` path pointing at `public/` will
break when the base path changes. Import the file instead:

```mdx
import fig from '../../assets/images/blog/your_figure.webp';
```

---

## Images

Put the file in `src/assets/images/blog/` (or `newsletters/`, `initiatives/`)
and use `<Figure>`. Full authoring instructions are in the README under
[Adding Images to Posts](README.md#adding-images-to-posts).

After adding large photos, cap their resolution:

```bash
node scripts/reencode-sources.mjs --dry   # report first
node scripts/reencode-sources.mjs
```

The script resizes each directory to a cap set well above how the images are
actually displayed, and re-encodes them. It is safe to re-run: files already at
or below their cap are only rewritten if re-encoding wins more than 5%.

It **skips animated images**, because sharp would flatten them to a single
frame. Animations are the case this guide exists for.

---

## Animated GIFs must become video

`<Figure>` special-cases animated GIFs and ships them **untouched at full size**,
because the image pipeline would destroy them. Nothing shrinks them for you.
That is fine for a small reaction GIF and ruinous for a long clip.

### The trap: re-encoding a GIF naively makes it *bigger*

This is the part worth understanding, because the obvious approach fails
loudly and the reason is not obvious.

Encoding that 18.9 MB microscopy GIF straight to h264 produced a **25.7 MB**
file at crf 16 — larger than the GIF it came from. Even at crf 23 it was 11.4 MB.

The cause was in the source. A GIF holds at most 256 colours per frame, and this
one had been quantized to a coarse 8×8×4 colour cube — **69 unique colours** in
frame 0, with values stepping by 36 in red and green. To fake a smooth
fluorescence gradient out of that, the encoder that made the GIF applied
error-diffusion dithering: a fine, near-random crosshatch across every dark
region, differing completely from frame to frame.

Video codecs compress by predicting each frame from the previous one. Dither
noise is uncorrelated between frames, so there is nothing to predict, and the
codec spends its entire bitrate encoding the noise. Measured frame-to-frame
difference was 5.0 for the raw GIF and 2.8 after the dither was removed —
roughly half the apparent "motion" was dither churn.

**The fix is to undither before encoding.** Dithering preserves the local
average, so averaging it back out recovers the underlying image rather than
degrading it. The undithered result is arguably *closer* to the original
microscopy than the GIF was, since the dither was never real data.

Two details that matter:

- **Filter in `yuv420p`.** Doing the same work in RGB produced a file roughly
  twice as large. Most of the dither lives in the chroma planes, which
  `yuv420p` denoises at half resolution.
- **Skip the undither step for footage that was never a GIF.** There is no
  dither to undo, and you would only be throwing away real detail.

### The recipe

ffmpeg is not a project dependency — install it once:

```bash
brew install ffmpeg
```

Then:

```bash
IN=source.gif
NAME=2026-05-12_your_clip

# 1. Undither into a lossless master. Doing this once means you can try
#    different quality settings in step 2 without re-running the slow filter.
ffmpeg -i "$IN" -vf "format=yuv420p,nlmeans=s=6:p=7:r=15,hqdn3d=0:0:5:5" \
  -c:v ffv1 -pix_fmt yuv420p clean.mkv

# 2. Encode both formats from the cleaned master.
ffmpeg -i clean.mkv -c:v libx264 -preset veryslow -crf 25 -pix_fmt yuv420p \
  -profile:v high -level 4.0 -an -movflags +faststart \
  "src/assets/videos/blog/$NAME.mp4"
ffmpeg -i clean.mkv -c:v libvpx-vp9 -crf 33 -b:v 0 -row-mt 1 -pix_fmt yuv420p \
  -an "src/assets/videos/blog/$NAME.webm"

# 3. Poster frame. It supplies the intrinsic size, so the page never shifts,
#    and it is what shows if autoplay is blocked (iOS Low Power Mode).
ffmpeg -i clean.mkv -frames:v 1 poster.png
node -e "require('sharp')('poster.png').webp({quality:82,effort:6})
  .toFile('src/assets/images/blog/${NAME}_poster.webp')"

rm clean.mkv poster.png
```

Then delete the original GIF. It stays recoverable from git history.

### Why those flags

| Flag                        | Why                                                        |
| --------------------------- | ---------------------------------------------------------- |
| `-crf 25` / `-crf 33`       | Quality dial. **Raise to shrink, lower to sharpen.**        |
| `-pix_fmt yuv420p`          | Required for Safari and older Android to play the file      |
| `-profile:v high -level 4.0`| Broadly supported hardware decode profile                   |
| `-movflags +faststart`      | Moves the index to the front so playback starts while loading |
| `-an`                       | Drops audio — `<Video>` clips are silent by design          |
| `-preset veryslow`          | Slower encode, smaller file. Runs once, so it's free        |

### When to skip WebM

WebM/VP9 is usually ~35% smaller than h264 and is offered first. But VP9 has
fixed overhead that a very short clip cannot amortize. A 19-frame, 0.57-second
GIF in this repo encoded to **55 KB as MP4 and 84 KB as WebM** — the WebM was
*larger*.

So: encode both, compare, and if WebM isn't smaller, ship MP4 alone. The `webm`
prop on `<Video>` is optional for exactly this reason.

---

## Using `<Video>`

```mdx
import Video from '../../components/Video.astro';
import clipMp4 from '../../assets/videos/blog/2026-05-12_your_clip.mp4';
import clipWebm from '../../assets/videos/blog/2026-05-12_your_clip.webm';
import clipPoster from '../../assets/images/blog/2026-05-12_your_clip_poster.webp';

<Video mp4={clipMp4} webm={clipWebm} poster={clipPoster}
       alt="What the footage shows, for screen readers">
  Optional caption. Markdown works here, same as <Figure>.
</Video>
```

| Prop     | Required | Notes                                                     |
| -------- | -------- | --------------------------------------------------------- |
| `mp4`    | yes      | The fallback every browser understands                     |
| `webm`   | no       | Offered first when present; omit if it isn't smaller       |
| `poster` | yes      | Also supplies intrinsic size, preventing layout shift      |
| `alt`    | yes      | Describe the footage, as you would an image                |
| `square` | no       | Square corners instead of the default rounded ones         |

The clip autoplays muted, loops, and plays inline on mobile Safari — `muted` and
`playsinline` are both required for iOS to autoplay, and the component sets
them. Visitors who ask for reduced motion get the poster frame and playback
controls instead, which satisfies WCAG 2.2.2 for motion lasting over five
seconds. A GIF could not offer that.

---

## Check your work

### Look at the result before trusting a number

A smaller file is not automatically an acceptable one, and this is especially
true for scientific imagery, where "noise" may be data. Export a frame from the
encode and compare it against the same frame of the source — including a
high-motion frame, where compression artifacts and any denoising ghosts show up
first:

```bash
# Find the highest-motion frames in the source
ffmpeg -i source.gif -vf "tblend=all_mode=difference,signalstats,\
metadata=print:key=lavfi.signalstats.YAVG" -f null - 2>&1 \
  | grep -oE "YAVG=[0-9.]+" | cut -d= -f2 | nl | sort -k2 -gr | head -5

# Export that frame from both, side by side (N = the frame number)
ffmpeg -i source.gif -vf "select='eq(n\,N)'" -vsync 0 a.png
ffmpeg -i encoded.mp4 -vf "select='eq(n\,N)'" -vsync 0 b.png
ffmpeg -i a.png -i b.png -filter_complex "[0:v][1:v]hstack" compare.png
```

If a structure that matters is gone, lower the `-crf` or weaken the denoise
(`nlmeans=s=6` → `s=4`) and re-encode. When in doubt on someone's research
image, **ask them** before shipping a degraded version.

### Measure the page

Build, then run the page-weight script. It reports what a browser actually
downloads — one `srcset` candidate per image, one encode per video, plus the
HTML and anything it links:

```bash
npm run build
node scripts/page-weight.mjs                # the 10 heaviest pages
node scripts/page-weight.mjs --all
node scripts/page-weight.mjs --max 10       # exit 1 if any page is over the CI limit
```

### CI enforces this

You do not have to remember. The **Media Budget** workflow
(`.github/workflows/media.yml`) runs only when a media file actually changes —
ordinary content and code PRs skip it entirely — and fails if any single asset
or any built page is over the limit. Failures show up as annotations on the
offending file in the pull request.

The limits live in one `env:` block at the top of that workflow:

| Variable       | Default | Caps                           |
| -------------- | ------- | ------------------------------ |
| `MAX_GIF_MB`   | 5       | Any single GIF                 |
| `MAX_ASSET_MB` | 10      | Any other image, video, or PDF |
| `MAX_PAGE_MB`  | 10      | Delivered weight of one page   |

These are set to catch an accident, not to enforce the targets above. For
scale: the largest file in the repo today is a 4.6 MB PDF, the heaviest page is
1.5 MB, and the 18.9 MB GIF that prompted all of this would fail the GIF limit
nearly four times over. A file that trips one of these is genuinely large, not
merely untidy — which is what makes the failure worth acting on rather than
routine to wave through.

Edit them there to change the limits permanently, or override them for one run
from the Actions tab via "Run workflow" — useful for seeing what a stricter
limit would flag before committing to it.

---

## Before you commit

- [ ] Media is in `src/assets/`, not `public/` (unless it's a download)
- [ ] No animated GIF over ~1 MB
- [ ] Ran `node scripts/reencode-sources.mjs` if you added photos
- [ ] Video has a poster, and `alt` describes the footage
- [ ] Compared a high-motion frame against the source
- [ ] `npm run build` passes and the page is roughly in line with the rest of
      the site (~1.5 MB) — CI only fails you well above that
- [ ] Deleted the source GIF once its replacement works
