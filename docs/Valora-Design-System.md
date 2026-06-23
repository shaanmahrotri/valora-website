# Valora — Design System

**Direction 04 · The Panel**
Insights redesign, first pass. This document records the tokens, type, layout, imagery and components used across the Valora site so anyone can build to it consistently.

> Tokens are taken from the current warm-sand, gold-accented identity. No new brand colour or typeface is introduced. The typeface is substituted with Albert Sans for licensing; production licenses the real face (Proxima Nova).

---

## 1. Colour

### Ink & text
| Token | Hex | Use |
|---|---|---|
| Ink | `#3A3827` | Headlines, primary text, wordmark |
| Body | `#43412F` | Long-form article body |
| Muted | `#5C5A48` | Secondary paragraphs, inactive nav |
| Faint | `#8F8B79` | Meta, captions, timestamps |
| Faint (alt) | `#9A917D` | Toolbar labels, muted UI text |

### Grounds
| Token | Hex | Use |
|---|---|---|
| Sand | `#E6DDD0` | Primary page background, left panel |
| Paper | `#EFE9DE` | Insights summary section background, search input fill |
| Divider | `#CEC6B6` | Hairlines, borders, 1px rules |
| Chrome dark | `#2E2C20` | Mobile floating pill, review banner |
| On-dark text | `#CFC6B4` | Text on chrome dark |

### Accent — gold, used sparingly
| Token | Hex | Use |
|---|---|---|
| Gold | `#FEAD00` | The 40×3 rule, kickers, active underline, dots, gold tick |
| Gold deep | `#B89026` | Small gold labels on light, hover for gold |
| Gold ink | `#8A6E1E` | Caption labels inside image plates |

**The gold rule.** A `40 × 3px` solid gold bar (`#FEAD00`) is the signature mark — under the wordmark, opening maxims, and as the active-state underline. Use it deliberately; gold should never fill an area, only mark one.

### Image placeholders
Flat editorial stand-ins until real photography lands: warm neutral `#D7CBB4` with a faint 135° hatch (`repeating-linear-gradient(135deg, rgba(58,56,39,0.05) 0 1px, transparent 1px 11px)`) and a caption (gold-ink label + intended-shot note). Each maps to a swappable `<Plate>` component in the Astro build.

---

## 2. Typography

**Primary:** Proxima Nova *(substituted with Albert Sans)* — Light 300 / Regular 400 / Medium 500 / Semibold 600 / Bold 700.
**Editorial accent:** Newsreader (serif) — Light 300, used italic for pull quotes and as the drop cap only.

Restraint is the rule: headings are **Light (300)**, weight is reserved for small uppercase kickers (700).

| Role | Size | Weight | Tracking | Notes |
|---|---|---|---|---|
| Page H1 (hero) | 42px | 300 | -0.2px | line-height 1.28 |
| Article H1 | 46px | 300 | -0.5px | centred hero |
| Section kicker | 19px | 700 | 0.25em | uppercase, gold |
| H2 statement | 32–34px | 300 | -0.3px–-0.4px | max-width ~14–18em |
| H2 statement (tight) | 30px | 300 | -0.3px | insights summary variant |
| H3 | 21–26px | 300 | -0.3px | feature/card titles |
| Lead title (insights index) | 32px | 300 | -0.3px | |
| Verdict / callout | 22px | 300 | -0.2px | line-height 1.5, approach section sign-off |
| Body | 16px | 300 | — | line-height 1.9 |
| Article body | 18px | 300 | — | line-height 1.85, measure ~680px |
| Pull quote | 25px | 300 italic | -0.2px | Newsreader serif |
| Drop cap | 68px | 300 | — | Newsreader serif, float left |
| Row title (insights list) | 21px | 300 | -0.2px | line-height 1.3 |
| Row numeral | 30px | 300 | -1px | color `#C2B79D` |
| Partner name | 16px | 400 | 0.2em | uppercase |
| Hero maxim | 14px | 400 | 0.08em | ink colour, one-line closing statement |
| Meta / caption | 13px | 400 | 0.04em | Faint |
| Summary row title | 18px | 300 | -0.2px | line-height 1.32 |
| Micro label | 10–11px | 600–700 | 0.2–0.35em | uppercase |
| Wordmark | 26px | 400 | 0.4em | uppercase |

---

## 3. Layout & spacing

| Token | Value |
|---|---|
| Max site width | `1320px` |
| Left panel width | `280px` (sticky, full height) |
| Panel padding | `52px 44px` |
| Content padding (x) | `80px` (24px mobile) |
| Section padding (y) | `64px` (home — tightened so the hero fits above the fold on common laptop viewports), `80px` (insights) |
| Reading measure | `680px` article body, `760px` article hero |
| Gold rule | `40 × 3px` |
| Gold tick | `24 × 2px` — used inline beside kicker text in feature meta |
| Hairline | `1px solid #CEC6B6` |
| Avatar radius | `50%` (all portraits circular) |
| Mobile breakpoint | `900px` |

**Structure.** Two columns: a fixed/sticky left panel (wordmark, gold rule, nav, copyright) and a scrolling content column. Sections are separated by full-width top hairlines, not cards. The Insights summary section uses `background: var(--paper)` as the only section-level background change.

---

## 4. Imagery

All imagery is warm, architectural, restrained — interiors, materials, still life. **No people** except partner headshots. Each plate carries a caption label (gold-ink, uppercase) describing the intended shot.

Recommended export sizes are **2× the display box** for retina. Deliver as optimised JPEG (quality ~80), sRGB.

| Slot | Aspect | Display | Export (2×) | Notes |
|---|---|---|---|---|
| Hero plate | fills column | ~620 × 720+ | **1600 × 1800** | `fill={true}` in Plate — no fixed ratio, fills hero height; min 520px tall |
| Approach material study | 9:22 | ~450 × 1100 | **900 × 2200** | Tall side-panel crop, sized to match the copy column's height (re-tuned from the original 4:5 — see note below) |
| Insights — featured | 7:5 | ~560 × 400 | **1400 × 1000** | Used on homepage summary AND insights index — one file serves both |
| Insights — list thumbnail | 5:4 | ~150 × 120 | **300 × 240** | Numbered list rows; cropped from the article lead image via `object-fit: cover` |
| Article — lead plate | 21:9 | ~1100 × 470 | **2100 × 900** | Full-width cinematic banner; set via `leadImage` frontmatter |
| Partner headshot | 1:1 | 90 × 90 | **180 × 180** | Circular crop, on sand |
| Author avatar (byline) | 1:1 | 30 × 30 | **92 × 92** | Circular |
| Author avatar (footer) | 1:1 | 46 × 46 | **92 × 92** | Circular |

> **Note on thumbnails.** The insights list passes no `ratio` or `src` to `<Plate>` for row thumbnails — the 5:4 ratio and 150px display width are defined by the grid column (`grid-template-columns: 64px 150px minmax(0,1fr) auto`). When `leadImage` is set on an article, the same image is used at both 21:9 (lead) and 5:4 (thumbnail) — the `object-fit: cover` handles the reframe.

> **Note on the approach material study's ratio.** 9:22 is tuned to match the height of the approach section's text column at common laptop widths (≥1320px content area), not a fixed editorial choice — if that copy gets noticeably longer or shorter, the ratio may need re-measuring. On mobile (`≤900px`) it's overridden to a normal 4:5 portrait crop via `#approach :global(.plate) { aspect-ratio: 4 / 5 !important; }` in `index.astro` — the 9:22 side-panel ratio is sized for sitting next to a desktop text column and becomes an excessively tall image at full mobile width otherwise. The `:global()` is required because `.plate`'s own scoped styles live in `Plate.astro`, a different component than the page applying the override.

---

## 5. Components

### Wordmark
Two-part lockup: a large `/` slash mark (`font-size: 67px; font-weight: 700; opacity: 0.65; color: var(--ink)`) stacked above the word `VALORA` (`font-size: 31px; font-weight: 400; letter-spacing: 0.4em; text-transform: uppercase`). The gold rule sits immediately below. Sized up ~20% from the original scaffold values (56px/26px) for stronger brand presence. On mobile, the slash scales to 22px / opacity 0.55 and the word to 14px / letter-spacing 0.36em (also ~20% up from the original 18px/12px).

### Left nav
Text buttons, uppercase 11px, 0.25em tracking. Active = gold underline (`border-bottom: 2px solid var(--gold)`). Inactive: `color: var(--muted)` → `var(--ink)` on hover.

### Insights nav (collapsible)
`<details>` element. Chevron (9×9px, gold-deep, 45° rotated border) toggles a sub-panel with `border-left: 2px solid var(--gold)` and `padding-left: 14px`. Reveals a "Latest" micro-label and the three most recent articles, then "All insights →". Open on the insights section, closed elsewhere.

### InsightsBar (sticky toolbar)
Sticky top bar inside Insights pages (`top: 0; z-index: 5; background: var(--sand); border-bottom: 1px solid var(--divider)`). Contains: *Back to main · sep · Insights home · search input*. In article view, also shows *‹ position › prev/next* nav. Search input: `background: var(--paper); border: 1px solid var(--divider); padding: 7px 14px; min-width: 230px`. On mobile: sits at `top: 56px` (below the sticky header); prev/next position indicator hidden.

### Filter bar
Hairline top and bottom. Author / Sort label groups (`font-size: 10px; font-weight: 600; letter-spacing: 0.2em`). Options at 13px regular; active option gets `font-weight: 500; color: var(--ink); border-bottom: 2px solid var(--gold)`. Currently visual only — live filtering is wired to the search input in the InsightsBar.

### `<Plate>` component
Swappable image slot (`src/components/Plate.astro`). Props:
- `src` — optional path in `/public`; when set, renders a real `<img>`
- `ratio` — CSS aspect-ratio string, e.g. `"7 / 5"`. Ignored when `fill` is true
- `fill` — boolean; stretches to 100% of parent height (used on hero)
- `label` / `note` / `spec` — caption parts shown on the placeholder; `label` is gold-ink uppercase 11px, `note` is 12.5px body, `spec` is 10.5px gold-ink

When `src` is absent, renders the warm neutral hatch placeholder (`var(--plate)` background + `var(--plate-hatch)`) with the caption absolutely positioned at bottom-left.

### Featured card (homepage + insights index)
7:5 plate + gold-tick + topic micro-label + Light H3 + excerpt + meta line. On the insights index, a "Featured" badge (`background: rgba(230,221,208,0.82); font-size: 10px`) is absolutely positioned top-left of the plate.

### Gold tick
`24 × 2px` gold bar (`background: var(--gold)`). Used inline alongside the topic kicker in featured article meta rows.

### Numbered row (insights list)
`grid-template-columns: 64px 150px minmax(0,1fr) auto`. Numeral at 30px Light, `#C2B79D`. Thumbnail via `<Plate ratio="5/4">`. Title + topic label. Right-aligned meta. Hover: very subtle ink wash (`rgba(58,56,39,0.022)`). On mobile: collapses to `44px 1fr`; thumbnail and meta hidden.

### Pull quote
`3px` gold left rule, Newsreader italic, 25px.

### Drop cap
Newsreader 68px, float left, `margin: 6px 14px 0 0`, applied via `::first-letter` on the first `<p>` in `.prose`.

### Article author footer
Flex row: 46×46 circular avatar · name (14px weight 500) · role (11px weight 600 uppercase gold) · "← All insights" link right-aligned. Sits below the article prose, above the prev/next nav, with a hairline top border.

### Prev/next article nav
Full-width 2-column grid separated by a 1px gold-deep divider. Each cell: label (10px uppercase `--faint-alt`) + title (16px Light). Inactive ends at `opacity: 0.32`. Hover: subtle ink wash.

### Pagination (insights index)
Centred numerals (13px), active one has `border-bottom: 2px solid var(--gold)`.

### Contact links
Email with `border-bottom: 1px solid var(--divider)` → `border-color: var(--gold)` on hover.

### Approach verdict block
Gold rule above, then a 22px / weight 300 / line-height 1.5 closing statement. Max-width ~40em. Sits below a hairline in the approach section.

---

## 6. Mobile patterns

**Breakpoint:** `900px`. The left panel is hidden; the shell becomes a single content column.

### Sticky mobile header
`height: 56px; background: var(--sand); border-bottom: 1px solid var(--divider); position: sticky; top: 0; z-index: 200`. Centred wordmark lockup at reduced scale (slash 22px, word 14px / 0.36em).

### Floating pill
Fixed bottom-centre (`bottom: 28px`). Dark chrome background (`#2E2C20`), `border-radius: 100px`, `padding: 13px 24px`. Contents: 6px gold dot · "Sections" label (11px / 0.2em / uppercase / `#F4EFE6`) · small `▴` arrow (`#9A917D`). Opens the bottom sheet.

### Bottom sheet nav
Full-screen with scrim (`rgba(21,20,15,0.45)`). Sheet slides up from bottom (`transform: translateY(100%)` → `translateY(0)`, 300ms cubic-bezier). `border-radius: 28px 28px 0 0`. Handle: 36×4px rounded bar in `--divider`. Nav items: 13px / 0.2em / uppercase / `padding: 15px 24px`, separated by `#DCD3C4` hairlines. Active state: `font-weight: 500`; active Insights item gets `border-left: 3px solid var(--gold)` + gold-tinted background.

---

## 7. Motion (notes, not yet built)

- Headline lines settle up 10px, fade in, 80ms stagger on load.
- Hero image fades up over ~900ms, then a slow ken-burns (1.0 → 1.03).
- Active nav gold underline slides between items as sections scroll into view.
- Insights nav sub-panel slides open (max-height, 220ms); rows fade in with a 40ms stagger.
- Filter/search changes: dropped rows fade + collapse over ~240ms, the rest reflow with no layout jump.
- Article lead image fades up once on entry, then holds — the only motion in the article body.

---

## 8. Content schema (Astro)

Each article in `src/content/insights/` carries these frontmatter fields:

| Field | Type | Notes |
|---|---|---|
| `title` | string | |
| `topic` | string | Governance / Succession / Foundations / etc. |
| `excerpt` | string | Used in featured card and `<meta description>` |
| `author` | string | Full name |
| `role` | string | Shown in article author footer |
| `authorImg` | string | Path in `/public` |
| `read` | string | e.g. `"9 min read"` |
| `date` | string | e.g. `"June 2026"` |
| `dateShort` | string | e.g. `"Jun 26"` — used in nav sub-panel |
| `order` | number | 1 = newest / featured |
| `featured` | boolean | Default false |
| `leadCaption` | string | Intended photograph description — shown on the plate placeholder |
| `leadImage` | string (optional) | Path in `/public`, e.g. `/images/article-lead.jpg` — activates real image |

---

*© Valora 2026 · Insights redesign, first pass.*
