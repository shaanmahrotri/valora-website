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
| Paper | `#EFE9DE` | Raised sections (Insights summary), input fields |
| Divider | `#CEC6B6` | Hairlines, borders, 1px rules |
| Chrome dark | `#2E2C20` | Review banner only (not part of the brand) |
| On-dark text | `#CFC6B4` | Text on chrome dark |

### Accent — gold, used sparingly
| Token | Hex | Use |
|---|---|---|
| Gold | `#FEAD00` | The 40×3 rule, kickers, active underline, dots |
| Gold deep | `#B89026` | Small gold labels on light, hover for gold |
| Gold ink | `#8A6E1E` | Caption labels inside image plates |

**The gold rule.** A `40 × 3px` solid gold bar (`#FEAD00`) is the signature mark — under the wordmark, opening maxims, and as the active-state underline. Use it deliberately; gold should never fill an area, only mark one.

### Image placeholders
Flat editorial stand-ins until real photography lands: warm neutral `#D7CBB4` with a faint 135° hatch and a caption (gold-ink label + intended-shot note). Each maps to a swappable `<Image>` slot in the Astro build.

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
| H2 statement | 30–34px | 300 | -0.3px | max-width ~16–18em |
| H3 | 21–22px | 400 | -0.2px | |
| Body | 16px | 300 | — | line-height 1.9 |
| Article body | 18px | 300 | — | line-height 1.85, measure ~680px |
| Pull quote | 25px | 300 italic | -0.2px | Newsreader serif |
| Drop cap | 68px | 300 | — | Newsreader serif |
| Meta / caption | 13px | 400 | 0.04em | Faint |
| Micro label | 10–11px | 600–700 | 0.2–0.35em | uppercase |
| Wordmark | 26px | 400 | 0.4em | uppercase |

---

## 3. Layout & spacing

| Token | Value |
|---|---|
| Max site width | `1320px` |
| Left panel width | `280px` (sticky, full height) |
| Panel padding | `52px 44px` |
| Content padding (x) | `80px` |
| Section padding (y) | `104px` (home), `80px` (insights) |
| Reading measure | `680px` article body, `760px` article hero |
| Gold rule | `40 × 3px` |
| Hairline | `1px solid #CEC6B6` |
| Avatar radius | `50%` (all portraits circular) |

**Structure.** Two columns: a fixed/sticky left panel (wordmark, gold rule, nav, copyright) and a scrolling content column. Sections are separated by full-width top hairlines, not cards.

---

## 4. Imagery

All imagery is warm, architectural, restrained — interiors, materials, still life. **No people** except partner headshots. Each plate carries a caption label (gold-ink, uppercase) describing the intended shot.

Recommended export sizes are **2× the display box** for retina. Deliver as optimised JPEG (quality ~80), sRGB.

| Slot | Aspect | Display | Export (2×) | Notes |
|---|---|---|---|---|
| Hero plate | ~8:9 (fills column) | ~620 × 720+ | **1600 × 1800** | Fills hero height, min 520px tall |
| Approach material study | 4:5 | ~440 × 550 | **1100 × 1375** | Single material detail, raking light |
| Insights — featured | 7:5 | ~560 × 400 | **1400 × 1000** | Index + homepage summary |
| Insights — list thumbnail | 5:4 | ~150 × 120 | **600 × 480** | Numbered list rows |
| Article — lead plate | 21:9 | ~1100 × 470 | **2100 × 900** | Cinematic, near full width |
| Partner headshot | 1:1 | 90 × 90 | **180 × 180** | Circular crop, on sand |
| Author avatar (byline) | 1:1 | 30 × 30 | **92 × 92** | Circular |
| Author avatar (footer) | 1:1 | 46 × 46 | **92 × 92** | Circular |

---

## 5. Components

- **Left nav** — text buttons, uppercase 11px, 0.25em tracking. Active = gold underline. Inactive ink `#5C5A48` → `#3A3827` on hover.
- **Insights nav (collapsible)** — chevron toggles a sub-panel with a left gold rule; reveals a "Latest" label and the three most recent articles, then "All insights →". Collapsed by default.
- **Insights toolbar** — sticky top bar inside the Insights section: *Back to main · Insights home · Search · article ‹ ›* prev/next with position. Appears only in the Insights section.
- **Filter bar** — Author / Sort selectors, hairline top & bottom. Active option carries the gold underline.
- **Featured card** — 7:5 plate + kicker (gold rule + topic), Light H3, excerpt, meta line.
- **Numbered row** — `64px` numeral (Light, faint) · `150px` thumb · title · right-aligned meta. Subtle ink wash on hover.
- **Pull quote** — `3px` gold left rule, Newsreader italic, 25px.
- **Drop cap** — Newsreader 68px, floated, on the first article paragraph.
- **Pagination** — centred numerals, active one underlined gold.
- **Contact links** — email with hairline underline → gold on hover.
- **Buttons** — type-led, no fills. Hierarchy via colour and the gold underline, never solid backgrounds.

---

## 6. Motion (notes, not yet built)

- Headline lines settle up 10px, fade in, 80ms stagger on load.
- Hero image fades up over ~900ms, then a slow ken-burns (1.0 → 1.03).
- Active nav gold underline slides between items as sections scroll into view.
- Insights nav sub-panel slides open (max-height, 220ms); rows fade in with a 40ms stagger.
- Filter/search changes: dropped rows fade + collapse over ~240ms, the rest reflow with no layout jump.
- Article lead image fades up once on entry, then holds — the only motion in the article body.

---

*© Valora 2026 · Insights redesign, first pass.*
