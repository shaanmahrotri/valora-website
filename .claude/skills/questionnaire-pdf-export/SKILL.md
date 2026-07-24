---
name: questionnaire-pdf-export
description: Renders a questionnaire_responses CSV exported from Supabase into one branded PDF per respondent, so Shaan and Tom can review leads without logging into Supabase or standing up the NocoDB CRM. Use this whenever the user asks to "turn the CSV into PDFs," "export questionnaire responses as PDF," "make lead PDFs from the export," or hands over a CSV downloaded from Supabase's Table Editor and asks for a spreadsheet/CSV export to become something reviewable. Not for any other kind of CSV or PDF task.
---

# Questionnaire PDF Export

Converts a `questionnaire_responses` CSV export (downloaded from the Supabase Table Editor - see `docs/questionnaire-data-requests.md`) into one readable, on-brand PDF per row. Each PDF shows the respondent's contact details, consent state, and every question/answer pair, formatted the same way `netlify/functions/submit-questionnaire.mjs`'s report email formats them - so this reads as the same document family, just for internal review rather than the respondent's inbox.

**Why this exists:** viewing leads in Supabase's raw Table Editor is workable but not pleasant, and the full NocoDB CRM (`docs/crm-setup.md`) needs a hosting decision and isn't deployed yet. This is the middle ground - no new infrastructure, no accounts, just a CSV in and a folder of PDFs out.

## Prerequisites (one-time)

A Python virtual environment is already set up at `.claude/skills/questionnaire-pdf-export/.venv/` with `reportlab` installed (see `scripts/requirements.txt`). It's gitignored - never committed, machine-specific. If it's ever missing (fresh clone, deleted by accident), rebuild it:

```bash
cd .claude/skills/questionnaire-pdf-export
python3 -m venv .venv
./.venv/bin/pip install -r scripts/requirements.txt
```

## Step 1 — Get the CSV

The user exports this themselves from Supabase (Table Editor → `questionnaire_responses` → "•••" menu → Download CSV), or via a filtered SQL Editor query if they only want a subset. It'll typically land in `~/Downloads/`. Ask where it saved if not given a path.

## Step 2 — Run the script

```bash
cd .claude/skills/questionnaire-pdf-export
./.venv/bin/python scripts/csv_to_pdf.py "/path/to/the/export.csv"
```

By default, output PDFs go into a `pdfs/` folder created **next to the input CSV** (not inside this repo) - e.g. `~/Downloads/pdfs/`. Override with `-o /some/other/folder` if the user wants them somewhere specific. One PDF per row, named `<date>_<name-or-email>.pdf`.

Report back to the user how many PDFs were written and where - don't just say "done."

## What each PDF contains

- Valora brand mark (slash + wordmark + gold rule), matching every other page/email on the site.
- Name, organisation, email, submission timestamp, questionnaire slug.
- Consent state: whether they want the report, marketing-consent status (confirmed vs. pending double opt-in), unsubscribed flag.
- `status`/`notes` (the CRM Tier 1 fields from `scripts/supabase-schema.sql`), if either is set.
- Every question and its formatted answer - grid answers join cells as `value (detail)`, multi-select/ranked answers join as a comma list, everything else prints as-is. Matches `formatAnswerValue()` in `submit-questionnaire.mjs` exactly, so a respondent's own report email and their internal PDF read the same answers the same way.

## PII handling - important

These CSVs and PDFs contain real names, emails, and personal responses. Never:
- Commit an export CSV or generated PDFs to this git repository (both are gitignored as a backstop - `.venv/`, `.claude/skills/*/output/`, `.claude/skills/*/pdfs/` - but don't rely on that; just don't put real exports inside this repo folder at all).
- Upload a real export anywhere (an artifact, a third-party tool, anywhere outside this local processing).

The bundled test fixture (`scripts/evals/test-fixtures/sample-export.csv`) is entirely fabricated - same fake-data convention as this repo's own Netlify function tests (`jane@example.com`, "Jane Prospect"). It's safe to keep in git and safe to use for testing changes to the script; never replace it with a real export.

## Testing a change to the script

```bash
cd .claude/skills/questionnaire-pdf-export
./.venv/bin/python scripts/csv_to_pdf.py scripts/evals/test-fixtures/sample-export.csv -o /tmp/pdf-export-test
```

The fixture covers: grid, single, multi (array), scale (numeric), and open-text answers; a row with every field populated and a deliberately sparse row (no name/org/email, empty consent); and XML-special characters (`&`, `<`, `>`, `"`) inside both a prompt and an answer value, to guard against reportlab markup-injection or silently dropped text. Verify output with `pypdf` (`./.venv/bin/pip install pypdf` if not already present) rather than eyeballing - `PdfReader(path).pages[0].extract_text()` and check the special characters and every answer type came through as literal, readable text.
