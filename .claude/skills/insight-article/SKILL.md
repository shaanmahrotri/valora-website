---
name: insight-article
description: Turns a pasted article draft (plain text, possibly with an image) into a fully formatted Insights article for the Valora Astro website — correct frontmatter, real reading time, a slug, and body reformatted to match the site's editorial CSS. Use this whenever the user pastes or attaches article text meant for the site's Insights section, says things like "add this as an insight," "format this article for the site," "turn this into an insight piece," or hands over a draft + a photo for a new piece — even if they don't mention frontmatter, Astro, or markdown by name. Also use it when the user asks to re-order, re-feature, or fix the reading time on existing insights articles, since this skill owns that renumbering logic.
---

# Insight Article

Converts a raw article draft into a publish-ready Markdown file in `src/content/insights/`, matching the schema in `src/content/config.ts` and the styling actually implemented in `src/pages/insights/[slug].astro`.

**Why this exists:** the Insights page only renders a few Markdown elements with real styling — plain paragraphs, one `###` subheading, one `>` pull-quote. Everything else (bold, italic, links, lists) falls back to unstyled browser defaults and looks off-brand. Left to its own devices, a model asked to "format this article" will reach for bullet points and bold text because that's normal Markdown hygiene — here it's the opposite of what the design wants. This skill exists to override that instinct with what the site actually supports.

## Inputs

- Article text, pasted directly or as a file/note.
- Optionally, one image. **Default assumption: a pasted image is the article's lead photograph**, not a new author headshot — the two known authors' headshots already exist (see below), so there's rarely a reason for an image upload to be anything else. Only treat it differently if the user says so explicitly (e.g. "this is a headshot for a new contributor").

If the user gives you a date, a topic, or other frontmatter fields explicitly, use those verbatim instead of inferring.

## Step 1 — Resolve the author

Valora currently has exactly two contributors. Match the byline (or ask "whose piece is this?" if it's not obvious from the text):

| Author | role | authorImg |
|---|---|---|
| Tom Rutherford | `Family Office and Trust Advisor` | `/tom-rutherford.jpg` |
| Shaan Mahrotri | `Strategic Advisor and Investor` | `/shaan-mahrotri.jpg` |

Both images already exist in `public/`. If the article is from someone outside this list, stop and ask for their role and a headshot — don't invent either.

## Step 2 — Draft the editorial fields

Infer these from the article text, then **show them to the user as part of your summary** rather than asking up front — they're quick to fix after the fact and asking first just slows down what's meant to be a fast workflow:

- **title** — the article's headline, as given.
- **topic** — a single category word/short phrase in the house style: `Governance`, `Oversight`, `Succession`, `Operations`, `Foundations` are the existing tags. Reuse one if it fits; coin a similarly terse new one if it doesn't.
- **excerpt** — one sentence, analytical and declarative, in Valora's voice. Several existing excerpts use a "the case for X" / "a practical view of X" shape — that's a reasonable default, not a rule.
- **leadCaption** — even when a real photo is supplied, write this properly (don't leave it blank). It's required by the schema, and `Plate.astro` only *displays* it when there's no real image — but if the photo is ever swapped out later, this is what readers see in the meantime. Style: warm, architectural, restrained, no people except headshots — see existing captions for tone (e.g. *"A desk with a single open ledger under a reading lamp. Scrutiny, attention, the close read."*).

## Step 3 — Reformat the body

Read `src/pages/insights/[slug].astro` if you want to confirm this yourself, but the styled elements are exactly:

| Markdown | Effect | How often |
|---|---|---|
| Plain paragraph | Normal body text. The *first* paragraph automatically gets a large decorative drop-cap — don't add one manually, it's pure CSS (`::first-letter`). | as many as needed |
| `### Subheading` | A styled section break | exactly one, at the article's natural turn (mirrors all 5 existing articles) |
| `> Quote` | Gold-rule serif italic pull-quote | exactly one |
| Bold, italic, links, lists | No CSS targets them at all — they render in plain browser-default styling and look out of place next to the rest | avoid generating these |

Defaults, in order of how much they change the source text:

1. **Plain prose stays plain prose.** Don't add anything.
2. **The pull-quote is a distilled verdict line, not a copy-pasted sentence.** Look at the existing five articles — none of their pull-quotes are lifted verbatim from the surrounding paragraphs. Each is a short, aphoristic restatement of the article's core point, written fresh (e.g. *"A handover done in haste is remembered as a rupture. Done slowly, it is barely remembered at all."*). Write one in that spirit; place it after the section it caps, the same way the existing articles do.
3. **The subheading marks the one real turn in the argument** — where the piece pivots from "here's the problem" to "here's the practical answer," or similar. Pick the single best spot. Only add a second subheading if the piece is meaningfully longer than the existing articles (roughly 2x+) and genuinely has two distinct turns — don't add one just to break up a long piece visually.
4. **Bold/italic emphasis in the source:** just strip the markup, keep the words. Low stakes, no information lost.
5. **Links in the source:** keep them. They're not styled specially, but they still work and inherit readable color — stripping a useful URL is worse than leaving it slightly plain.
6. **Lists in the source:** short, simple lists (roughly ≤4 short items) — fold into a flowing sentence. Longer or more structurally important lists (step-by-step instructions, genuinely parallel items a reader would scan) — **flag it to the user** and ask whether to force it into prose or leave it as a list, rather than silently deciding either way. This is the one place worth pausing, because the conversion can be lossy and the right call depends on what the list is actually for. If a list does stay a list, write it as plain Markdown (`- item` lines) rather than raw HTML `<ul>`/`<li>` tags — both render fine, but mixing HTML into an otherwise-Markdown file is inconsistent with every other piece in `src/content/insights/`.

## Step 4 — Reading time

Count words in the body (excluding frontmatter) and divide by 225 words/minute (a standard adult silent-reading rate), rounding up, minimum "1 min read". Use the real number — don't anchor on the existing articles' `read` fields, which were placeholder guesses typed in by hand and don't correspond to their actual word counts (a 134-word piece is currently labeled "5 min read"; at 225 wpm that's well under a minute). Format as `"<N> min read"`.

## Step 5 — Slug and filename

Filenames double as the URL slug (`src/pages/insights/[slug].astro` uses Astro's content-collection slug, which comes from the filename). House convention is a **short, distilled** kebab-case slug, not a mechanical full-title slugify — look at the existing files:

- Title *"The quiet handover: preparing the next generation without rushing them"* → `the-quiet-handover.md` (just the lead clause)
- Title *"A governance calendar that families actually keep to"* → `a-governance-calendar.md` (shortened further still)

Pick 3–6 words that capture the headline's core, kebab-case, `.md` extension. Show the resulting filename/URL in your summary so the user can rename it if they'd pick differently.

## Step 6 — Date

If the user gives a publish date, use it (set both `date`, e.g. `"July 2026"`, and `dateShort`, e.g. `"Jul 26"`). Otherwise default to the current month/year.

## Step 7 — Renumber order and featured

List every file in `src/content/insights/` and sort by date (newest first), inserting the new article in its correct chronological position. The `date` field only has month-level precision, so a new article can tie with an existing one (both "July 2026", say) — when that happens, treat the one you're adding right now as the more recent of the two and place it first among the tied group. It's the piece that was actually just written, even if an older draft happens to share a frontmatter month.

Then:

- Renumber `order` sequentially from `1`, with no gaps, so `order: 1` is always the most recent piece.
- Set `featured: true` **only** on whichever article is now `order: 1`; `featured: false` on every other article — this matches the current state of all five existing articles exactly.

This means adding a new, newer article will change the `order`/`featured` values on one or more *existing* files, not just create a new one — that's expected, edit them in place.

Exception: if the user tells you they want to manually pin an older piece as featured (e.g. for a campaign), don't override that — leave its `featured: true` alone and ask how they want the rest of the sequence handled instead of forcing the default rule.

## Step 8 — The image

If an image was supplied:
- Place it in `public/` using the article's slug as the filename, e.g. `public/the-quiet-handover.jpg` — flat in `public/`, matching the existing convention (no subfolders).
- Set `leadImage: "/<slug>.jpg"` in the frontmatter.
- You don't need to crop or resize it to the 21:9 lead-plate ratio yourself — `Plate.astro` renders it with `object-fit: cover` inside an `aspect-ratio` box, so the browser crops automatically. Only worry about the file if it's unusually large (several MB+) — in that case, mention it, and you can downsize with `sips` (built into macOS) if asked, e.g. `sips -Z 1800 input.jpg --out public/slug.jpg`.

If no image was supplied, leave `leadImage` unset (omit the key entirely — it's optional in the schema) and rely on `leadCaption` for the placeholder.

## Step 9 — Write and summarize, don't publish

Write the new `.md` file, plus the renumbered `order`/`featured` edits to existing files, plus the image if any. Then summarize for the user:

- The new file's path and the fields you inferred (title/topic/excerpt/leadCaption/read time), flagged clearly as drafts they should skim.
- Which existing articles got renumbered, and how.
- Any list-conversion question from Step 3.6, if it came up.

**Stop there. Do not run `git add`, `git commit`, or `git push`.** This site stages to a shared Netlify URL on push — the user reviews locally (or on the dev server) and asks for the commit/push as a separate, explicit step once they're happy with the draft.
