# Valora Website

Astro rebuild of the Valora marketing site. Lives in `Supporting/` per the
main Valora project's file-organisation rules (it's infrastructure, not core
IP) — see `../../CLAUDE.md` for the business context, brand voice and the
print/deck design system; this file's own "Visual design (site)" section
below is a different, unrelated system.

## Stack

- **Astro 4.16**, static output (`output: 'static'` by default in
  `astro.config.mjs`) — deploys to Netlify, no adapter, no SSR.
- Content lives in `src/content/` as Astro content collections, schema in
  `src/content/config.ts`.
- Git branch `astro-rebuild` is the active branch. It's staged on Netlify as
  a **branch deploy**, separate from whatever production currently is.

## Content architecture

- `hero`, `approach`, `contact`, `partnersSection`, `settings` — singleton
  "data" collections, one YAML file each at `src/content/<name>/index.yaml`.
  Back the homepage sections in `src/pages/index.astro`.
- `partners` — one flat YAML file per partner at
  `src/content/partners/<slug>.yaml` (flat, not nested — matches Decap's
  folder-collection convention).
- `insights` — one Markdown file per article at
  `src/content/insights/<slug>.md`. `order` controls position (`1` = newest
  in the listing); `featured: true` only ever on whichever entry is
  `order: 1`. See `.claude/skills/insight-article/SKILL.md` for the full
  authoring rules (reading-time math, slug conventions, what markdown the
  site's CSS actually styles).
- Every insight has a **`published`** boolean (default `true`). Unchecking
  it in the admin pulls that one article off the live site - gone from the
  homepage block, the Insights index, and its own route stops building
  entirely - without deleting anything.
- `settings.insightsEnabled` (boolean, default `true`) is a **site-wide**
  switch: off means the entire Insights section disappears - nav (desktop +
  mobile), the homepage's "Latest insights" block, and every article route
  - leaving a clean `noindex` redirect at `/insights`. Independent of the
  per-article toggle above.

## Local CMS (Decap)

Content is editable locally via [Decap CMS](https://decapcms.org) without
touching code:

- Admin lives at `/admin` — a plain Astro page (`src/pages/admin/index.astro`)
  that imports `decap-cms-app` as a normal ESM module. Bundled by Vite like
  any other dependency; **no Astro framework-renderer integration needed**
  (deliberately avoided - see "Why not Keystatic" below).
- Config: `public/admin/config.yml`.
- Backend is Decap's `proxy` mode via `decap-server` - edits write straight
  to local files, no GitHub/Netlify auth needed for local use. (A hosted
  `git-gateway` + Netlify Identity setup is possible later if browser-based
  editing without a local server is ever wanted - not built yet.)

**To run it:** `npm run cms` starts both the dev server and the local
proxy together - no need to run `npx decap-server` separately.
Or double-click the Desktop shortcut (`Supporting/Open Valora CMS.command`)
- same script, opens the browser automatically once the server actually
responds (not on a fixed timer, since Astro's dev server restarts itself
once on a cold start).

Local edits only ever touch files on this machine. They do **not** appear
on the Netlify staging URL until committed and pushed - there's no
auto-deploy hook from local edits.

### Why not Keystatic

Tried first; rejected. It needs `output: 'hybrid'` + `@astrojs/react`
registered as an Astro integration even for local-only use (the Netlify
adapter is only needed for a separately-hosted CMS deploy, not local dev -
that part of the popular write-up pattern was confirmed). With
`@astrojs/react` active, the dev server threw an esbuild parse error
unrelated to any real file content, reproduced across two `@astrojs/react`
majors. Decap's admin page is a plain static page with a vanilla script tag
- it never asks Astro to render a framework component, so it's structurally
immune to that whole failure class.

## Visual design (site)

`docs/Valora-Design-System.md` - "Direction 04 · The Panel": warm sand/gold
palette, Albert Sans, the gold-rule/vertical-divider motifs. Distinct from
the print/deck design system in the parent `CLAUDE.md` (different palette,
for PPTX/Word client deliverables, not this site).

## Conventions worth knowing

- Section vertical padding is intentionally tight (`.hero` 40px,
  `.section` 64px) so the hero fits above the fold on common laptop
  viewports (1366×768) without scrolling - don't casually re-loosen this.
- The header logo (wordmark + slash glyph) was sized up ~20% from the
  original scaffold values - both desktop sidebar and mobile header.
- Real photos go flat in `public/<slug>.jpg` and get wired into a `Plate`
  component (`src/components/Plate.astro`) via its `src` prop - no manual
  cropping needed, it crops via `object-fit: cover` inside a CSS
  `aspect-ratio` box. If a `Plate`'s ratio looks visibly mismatched against
  its neighbouring copy after a copy change, remeasure rather than guess -
  text reflow doesn't scale linearly with column width.
- Don't trust a third-party package's README against its currently
  published version without checking - this bit us twice this session
  (`astro-decap-cms`'s wrapper logic, and Decap's own React peer
  dependency). `npm view <pkg> peerDependencies` and reading the actual
  installed `.d.ts`/source is faster than re-guessing.
