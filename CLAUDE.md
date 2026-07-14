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
- Server-side logic lives entirely in `netlify/functions/*.mjs` (plain
  Netlify Functions, not an Astro/SSR concern) - questionnaire submission,
  the report/confirmation emails, double opt-in, self-serve unsubscribe,
  and a Supabase keepalive ping. No shared modules between them by
  convention (each file is self-contained, duplicating small helpers
  rather than importing across functions). See
  `docs/questionnaire-data-requests.md` for env vars and setup.
- Git branch `astro-rebuild` is the active branch. It's staged on Netlify as
  a **branch deploy**, separate from whatever production currently is. This
  is intentionally a **permanent pre-production staging site**, not a
  temporary branch to be merged away once production launches - it stays
  the place to review changes before they go live, indefinitely.

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
- `legal` - one flat YAML file per legal page at
  `src/content/legal/<slug>.yaml` (`privacy`, `cookies`, `terms`,
  `disclaimer`). Each is `{ title, lastUpdated, sections: [{ heading,
  paragraphs: [...] }] }`. Paragraphs are rendered with `set:html` in the
  page templates (`src/pages/privacy.astro` etc.), so they're authored as
  raw HTML, not escaped text or markdown - several already contain inline
  `<a href="...">` links and `<br>` line breaks that need to render as
  real markup.
- `questionnaires` - one flat YAML file per survey at
  `src/content/questionnaires/<slug>.yaml`, rendered by
  `src/pages/questionnaire/[slug].astro`. Supports rating scales,
  multi-select with a max-pick cap, ranked picks, Yes/No/Not-sure grids
  with per-row follow-ups, conditional reveals, and an opt-in gate question
  (asked first) that decides whether a closing contact-capture step even
  appears. `closing.offerMarketingConsent` (per-questionnaire boolean)
  turns on a second, independent consent checkbox for ongoing marketing
  contact - separate from the report-request consent captured by the gate.
  Submission, the report/confirmation emails, the double opt-in flow, and
  self-serve unsubscribe are all Netlify Functions - see
  `docs/questionnaire-data-requests.md` for the full setup, env vars, and
  data-request handling, and `docs/crm-setup.md` for the NocoDB lead-view
  companion.

## Local CMS (Decap)

Content is editable locally via [Decap CMS](https://decapcms.org) without
touching code:

- Admin lives at `/admin` — a plain Astro page (`src/pages/admin/index.astro`)
  that imports `decap-cms-app` as a normal ESM module. Bundled by Vite like
  any other dependency; **no Astro framework-renderer integration needed**
  (deliberately avoided - see "Why not Keystatic" below).
- Config: `public/admin/config.yml`.
- Backend is Decap's `proxy` mode via `decap-server` - edits write straight
  to local files, no GitHub/Netlify auth needed for local use. (Hosted
  editing without a local server is the Stage B roadmap item below.)

**To run it:** `npm run cms` starts both the dev server and the local
proxy together - no need to run `npx decap-server` separately.
Or double-click the Desktop shortcut (`Supporting/Open Valora CMS.command`)
- same script, opens the browser automatically once the server actually
responds (not on a fixed timer, since Astro's dev server restarts itself
once on a cold start).

Local edits only ever touch files on this machine. They do **not** appear
on the Netlify staging URL until committed and pushed - there's no
auto-deploy hook from local edits.

**Slug/filename safety, confirmed from Decap's own source
(`decap-cms-core/src/backend.ts`, `persistEntry`):** editing any field on an
*existing* entry - including the title - never recomputes its slug or
renames its file. The slug is only ever computed once, at creation, from
a `newRecord` flag; existing entries reuse the path/slug already stored on
them regardless of what changes. The one real risk is renaming or moving
content files manually (Finder, terminal) while the admin has that
collection loaded - it trusts what it already loaded, not a fresh disk
scan - so refresh the collection list in the admin after any external file
change before editing that entry again.

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

## Roadmap - not yet built

- ~~**Confirm the Supabase keepalive pinger is actually configured.**~~
  Flagged 090726 after an unrelated free-tier Supabase project (not
  Valora's) got auto-paused for 7 days of inactivity. Investigated and
  found no evidence the documented external-uptime-pinger step
  (UptimeRobot/cron-job.org hitting `/.netlify/functions/keepalive`) had
  ever actually been completed - only the doc instruction and the function
  existed. When setting one up, the external service's free tier turned
  out to gate plain GET monitoring behind a paid plan. **Resolved 090726
  by switching `keepalive.mjs` to a Netlify Scheduled Function** instead
  (`export const config = { schedule: '0 6 * * *' }`) - Netlify's own
  cron now calls it once a day, no third-party account or free-tier gate
  involved. This required the newer Request/Response handler shape
  (`export default async () => new Response(...)`) instead of this repo's
  usual classic `handler(event)` shape - a Netlify requirement for
  scheduled functions specifically, not a stylistic drift; the other three
  functions are unaffected and unchanged. `docs/questionnaire-data-requests.md`
  step 6 updated to match. **Shipped to production 090726** (`main` @
  `9ea4569`) - confirmed via the Netlify CLI (`netlify api getDeploy`,
  `function_schedules` field) that the schedule registered correctly on
  both the staging and production deploys: `{"cron":"0 6 * * *",
  "name":"keepalive"}`. The one thing that still can't be checked from a
  build artefact - whether it actually *fires* on schedule, not just
  registers - only becomes checkable after the first scheduled run;
  Netlify UI -> Functions -> keepalive should show an invocation log
  within 24h of this shipping. **Netlify CLI is now installed globally**
  on this machine (`netlify-cli`, logged in as Shaan, linked to site
  `admirable-yeot-4e5bde`) - prefer `netlify api <method>` for this kind
  of live-state verification going forward over guessing at dashboard
  navigation, which was the friction that prompted installing it.
- **Hosted CMS ("Stage B").** Decided (250626): use Decap's `github`
  backend, not `git-gateway`. Git Gateway is Netlify-deprecated - confirmed
  directly against Netlify's own docs: still functions, security issues
  still get fixed, but no further bug fixes, and "new Git Gateway
  configurations are not recommended." The `github` backend instead rides
  on a separate, non-deprecated Netlify feature - Netlify facilitates the
  GitHub OAuth handshake automatically for any site it hosts, no Identity
  involved, no extra cost. Commits land under each editor's own GitHub
  identity rather than one shared one, which is also better attribution.
  Steps, not yet executed:
  1. GitHub -> Settings -> Developer settings -> OAuth Apps -> New OAuth
     App. Authorization callback URL must be exactly
     `https://api.netlify.com/auth/done`.
  2. Netlify -> Project configuration -> Access & security -> OAuth ->
     Install Provider -> GitHub -> paste the Client ID/Secret from step 1.
  3. Swap `public/admin/config.yml`'s `backend` block to:
     ```
     backend:
       name: github
       repo: shaanmahrotri/valora-website
       branch: astro-rebuild
     ```
     (drops `proxy_url` entirely - this path has nothing to do with the
     local `proxy` backend or Netlify Identity.)
  4. Add each editor (Tom) as a GitHub collaborator with **Write** access
     on the repo itself - this backend rides on each person's real GitHub
     permissions, there's no separate invite-by-email step the way
     Identity has one.
  Same end goal as the original plan (editing from any browser, no
  `npm run cms` locally) via a current, supported mechanism instead of a
  deprecated one. Planned to start in a fresh session.
- ~~**Production launch decision.**~~ Decided and executed 080726: `main`
  now reflects `astro-rebuild` as of that date (25 commits merged,
  `e610508`) - the full questionnaire feature (submission, report email,
  double opt-in marketing consent, self-serve opt-out) plus CRM Tier 1
  (NocoDB) setup docs are live in production for the first time. Insights
  launched separately earlier (`1b5eeb7`). This does **not** retire
  `astro-rebuild` - per the permanent-staging note above, it stays the
  ongoing place to build and review the next round of changes before they
  get merged to `main` the same way.
- ~~**Branch-naming: rename `astro-rebuild` to `staging`?**~~ Considered and
  declined 090726. Investigated the real coupling: **nothing in
  `netlify.toml` is name-bound**; the only functional repo reference is
  `public/admin/config.yml`'s `branch:` field; everything else is docs and
  test fixtures. The actual cost of a rename lives in the Netlify dashboard
  (the branch-deploy target list, and the branch-context `DEPLOY_BASE_URL`
  whose value tracks the `<branch>--<site>.netlify.app` preview URL) plus a
  now-dead old preview URL - a coordinated multi-system change for purely
  cosmetic clarity. **Decided: leave it as `astro-rebuild`.** It remains the
  permanent staging branch; treat "staging" as its role, not its name.
- **Git workflow visual walkthrough - to do in a fresh session.** A
  plain-English, **diagram-led** walk-through (Shaan learns visually) of how
  to use short-lived feature branches, pull requests and git worktrees for
  feature work on this repo specifically: branch off `astro-rebuild`
  (staging) -> PR back into `astro-rebuild` -> merge to `main` to promote to
  production, and when a worktree beats a branch. The deliverable should be
  actual diagrams of the branch/PR/worktree flow, not prose. This was
  "Phase 3" of the 2026-07 audit engagement, deferred to its own session on
  request.

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
- Any CSS meant to style elements inside content rendered via `set:html`
  (legal pages' paragraphs, the questionnaire's consent note) needs
  `:global()` around the selector - Astro's scoped-style compiler never
  sees raw injected HTML at build time, so it can't stamp the scoped
  attribute onto those elements, and a plain scoped selector silently
  never matches. Confirmed twice now: the questionnaire consent-note link,
  and all four legal pages' `.legal__link` (fixed by wrapping both the
  base and `:hover` rules in `:global()`) - check for this class of bug
  wherever new `set:html` content gets its own styling.
