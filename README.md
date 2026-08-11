# Valora — Insights (Astro)

Deployable scaffold for **Direction 04 · The Panel**. A faithful port of the design into a real, file-based [Astro](https://astro.build) site: a scrolling homepage, an Insights index with live search, and Markdown-driven articles with prev/next.

## Run it

```bash
npm install
npm run dev        # http://localhost:4321
```

```bash
npm run build      # static output → dist/
npm run preview    # preview the production build
```

> Requires Node 18.17+ (or 20+). The project is static — no server or adapter needed.

## Structure

```
src/
  layouts/Base.astro            page shell: <head>, fonts, left panel, <main>
  components/
    LeftPanel.astro             wordmark, gold rule, nav (Insights collapses via <details>)
    InsightsBar.astro           sticky toolbar: back to main · insights home · search · ‹ ›
    Plate.astro                 swappable image slot (placeholder OR real photo)
  content/
    config.ts                   the `insights` collection schema
    insights/*.md               one Markdown file per article
  pages/
    index.astro                 homepage (hero · approach · partners · insights summary · contact)
    insights/index.astro        the Insights index (filter bar + featured + numbered list + search)
    insights/[slug].astro       a single article (drop cap, pull quote, prev/next)
  styles/global.css             colour, type and layout tokens (CSS custom properties)
public/
    shaan-mahrotri.jpg, tom-rutherford.jpg   partner / author photos
```

## Add or edit an article

Drop a new Markdown file in `src/content/insights/`. The filename becomes the URL slug.

```md
---
title: "Your headline"
topic: "Governance"
excerpt: "One-line summary for the index."
author: "Shaan Mahrotri"
role: "Strategic Advisor and Operator"
authorImg: "/shaan-mahrotri.jpg"
read: "6 min read"
date: "July 2026"
dateShort: "Jul 26"
order: 0            # 0 = newest; lower numbers sort first / become featured
featured: true
leadCaption: "The intended photograph for the lead plate."
# leadImage: "/images/your-photo.jpg"   # uncomment once you have the real photo
---

Opening paragraph (gets the drop cap)...

### A subheading

More copy...

> A pull quote, set in the serif.

Closing paragraph.
```

The first article by `order` is treated as **featured** on both the homepage summary and the index.

## Swap the placeholders for real photos

Every image is a `<Plate />`. Each currently shows a flat editorial placeholder with its caption and the recommended export size. To drop in a real photo:

1. Put the file in `public/` (e.g. `public/images/hero.jpg`).
2. Pass it to the plate:
   ```astro
   <Plate ratio="7 / 5" src="/images/hero.jpg" alt="…" />
   ```
   For an article lead, set `leadImage: "/images/…"` in that article's frontmatter instead.

Recommended export sizes (2× the display box, JPEG ~80, sRGB):

| Slot | Aspect | Export |
|---|---|---|
| Hero plate | ~8:9 | 1600 × 1800 |
| Approach material | 4:5 | 1100 × 1375 |
| Insights featured | 7:5 | 1400 × 1000 |
| List thumbnail | 5:4 | 600 × 480 |
| Article lead | 21:9 | 2100 × 900 |
| Partner / author | 1:1 | 180 × 180 |

## Brand notes

- **Type:** Albert Sans (substituting Proxima Nova — license the real face for production) + Newsreader for pull quotes and drop caps.
- **Accent:** gold `#FEAD00`, the 40 × 3px rule. Used sparingly — it marks, never fills.
- All tokens live in `src/styles/global.css`. See the full reference in `Valora-Design-System.md`.

## Deploy

Static output works anywhere. Set your production URL in `astro.config.mjs` (`site`).

- **Netlify** — build `npm run build`, publish `dist`.
- **Vercel** — auto-detected; or `npm run build`, output `dist`.
- **Cloudflare Pages** — build `npm run build`, output `dist`.
- **GitHub Pages** — see Astro's [GitHub Pages guide](https://docs.astro.build/en/guides/deploy/github/) (set `site` + `base`).
