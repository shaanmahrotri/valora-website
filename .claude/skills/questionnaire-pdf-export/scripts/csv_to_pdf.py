#!/usr/bin/env python3
"""Render a questionnaire_responses CSV export (from Supabase) into one
branded PDF per respondent.

Mirrors the answer-formatting logic in
netlify/functions/submit-questionnaire.mjs's formatAnswerValue(), and the
colour palette in docs/Valora-Design-System.md, so a PDF reads as the same
document family as the site's own report emails - just for internal review
rather than the respondent's inbox.
"""
import argparse
import csv
import json
import re
import sys
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer

# Valora brand tokens (docs/Valora-Design-System.md)
INK = colors.HexColor("#3A3827")
BODY = colors.HexColor("#5C5A48")
FAINT = colors.HexColor("#8F8B79")
DIVIDER = colors.HexColor("#CEC6B6")
GOLD = colors.HexColor("#FEAD00")
GOLD_INK = colors.HexColor("#8A6E1E")

TRUE_STRINGS = {"true", "t", "1", "yes"}


def is_true(value):
    return str(value).strip().lower() in TRUE_STRINGS


def format_answer(value, atype, detail=None):
    """Mirrors formatAnswerValue() in submit-questionnaire.mjs. Returns
    reportlab-safe text (XML-escaped) - the caller must NOT escape again."""
    if value is None or value == "":
        text = "(no answer)"
    elif atype == "grid" and isinstance(value, dict):
        parts = []
        for cell in value.values():
            if isinstance(cell, dict) and cell.get("value"):
                v = cell["value"]
                d = cell.get("detail")
                parts.append(f"{v}{f' ({d})' if d else ''}")
        text = "; ".join(parts) if parts else "(no answer)"
    elif isinstance(value, list):
        text = ", ".join(str(v) for v in value) if value else "(no answer)"
    else:
        text = str(value)

    text = escape(text)
    if detail and atype != "grid":
        text += f" — {escape(str(detail))}"
    return text


def make_styles():
    base = getSampleStyleSheet()
    return {
        "brand": ParagraphStyle(
            "brand", parent=base["Normal"], fontName="Helvetica", fontSize=10,
            textColor=INK, spaceAfter=2, alignment=TA_LEFT,
        ),
        "title": ParagraphStyle(
            "title", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=20,
            textColor=INK, spaceAfter=4,
        ),
        "subtitle": ParagraphStyle(
            "subtitle", parent=base["Normal"], fontName="Helvetica", fontSize=12,
            textColor=BODY, spaceAfter=6,
        ),
        "meta": ParagraphStyle(
            "meta", parent=base["Normal"], fontName="Helvetica", fontSize=9,
            textColor=FAINT, spaceAfter=4, leading=13,
        ),
        "consent": ParagraphStyle(
            "consent", parent=base["Normal"], fontName="Helvetica", fontSize=9,
            textColor=GOLD_INK, spaceAfter=4, leading=13,
        ),
        "question": ParagraphStyle(
            "question", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=11,
            textColor=INK, spaceAfter=4, leading=14,
        ),
        "answer": ParagraphStyle(
            "answer", parent=base["Normal"], fontName="Helvetica", fontSize=10.5,
            textColor=BODY, leading=15,
        ),
    }


def slugify(text, max_len=40):
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text or "respondent").strip("-").lower()
    return text[:max_len] or "respondent"


def build_pdf(row, out_path, styles):
    doc = SimpleDocTemplate(
        str(out_path), pagesize=A4,
        leftMargin=22 * mm, rightMargin=22 * mm,
        topMargin=20 * mm, bottomMargin=20 * mm,
    )
    story = []

    story.append(Paragraph("/&nbsp;&nbsp;VALORA", styles["brand"]))
    story.append(HRFlowable(width="15%", thickness=2, color=GOLD, spaceBefore=6, spaceAfter=14, hAlign="LEFT"))

    name = escape(row.get("name") or "(no name given)")
    org = row.get("organisation") or ""
    email = row.get("email") or ""
    slug = row.get("questionnaire_slug", "")
    created = (row.get("created_at") or "")[:19].replace("T", " ")

    story.append(Paragraph(name, styles["title"]))
    if org:
        story.append(Paragraph(escape(org), styles["subtitle"]))

    meta_bits = [escape(b) for b in [email, created, f"Questionnaire: {slug}" if slug else ""] if b]
    if meta_bits:
        story.append(Paragraph(" &nbsp;&middot;&nbsp; ".join(meta_bits), styles["meta"]))

    consent_bits = []
    if is_true(row.get("wants_report")):
        consent_bits.append("Wants report: yes")
    if is_true(row.get("marketing_consent")):
        confirmed = row.get("marketing_consent_confirmed_at")
        consent_bits.append(f"Marketing consent: {'confirmed' if confirmed else 'pending confirmation'}")
    if row.get("unsubscribed_at"):
        consent_bits.append("Unsubscribed")
    if consent_bits:
        story.append(Paragraph(" &nbsp;&middot;&nbsp; ".join(consent_bits), styles["consent"]))

    status = row.get("status")
    notes = row.get("notes")
    if status or notes:
        story.append(Spacer(1, 4))
        if status:
            story.append(Paragraph(f"<b>Status:</b> {escape(status)}", styles["meta"]))
        if notes:
            story.append(Paragraph(f"<b>Notes:</b> {escape(notes)}", styles["meta"]))

    story.append(Spacer(1, 14))
    story.append(HRFlowable(width="100%", thickness=0.5, color=DIVIDER, spaceAfter=16))

    answers_raw = row.get("answers") or "[]"
    try:
        answers = json.loads(answers_raw) if isinstance(answers_raw, str) else answers_raw
    except (json.JSONDecodeError, TypeError):
        answers = []

    if not answers:
        story.append(Paragraph("(no answers recorded)", styles["answer"]))
    for i, a in enumerate(answers):
        prompt = escape(a.get("prompt") or a.get("id") or "")
        value_text = format_answer(a.get("value"), a.get("type"), a.get("detail"))
        story.append(Paragraph(prompt, styles["question"]))
        story.append(Paragraph(value_text, styles["answer"]))
        if i < len(answers) - 1:
            story.append(HRFlowable(width="100%", thickness=0.5, color=DIVIDER, spaceBefore=10, spaceAfter=10))

    doc.build(story)


def main():
    parser = argparse.ArgumentParser(
        description="Render a questionnaire_responses CSV export into one branded PDF per respondent."
    )
    parser.add_argument("csv_path", help="Path to the exported CSV")
    parser.add_argument(
        "-o", "--output-dir", default=None,
        help='Output directory (default: a "pdfs" folder next to the CSV)',
    )
    args = parser.parse_args()

    csv_path = Path(args.csv_path).expanduser().resolve()
    if not csv_path.exists():
        print(f"CSV not found: {csv_path}", file=sys.stderr)
        sys.exit(1)

    out_dir = (
        Path(args.output_dir).expanduser().resolve()
        if args.output_dir
        else csv_path.parent / "pdfs"
    )
    out_dir.mkdir(parents=True, exist_ok=True)

    styles = make_styles()

    count = 0
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            created_date = (row.get("created_at") or "")[:10]
            ident = row.get("name") or row.get("email") or (row.get("id") or "")[:8]
            base = f"{created_date}_{slugify(ident)}" if created_date else slugify(ident)
            out_path = out_dir / f"{base}.pdf"
            # avoid silently overwriting same-day-same-name duplicates
            n = 2
            while out_path.exists():
                out_path = out_dir / f"{base}-{n}.pdf"
                n += 1
            build_pdf(row, out_path, styles)
            count += 1
            print(f"  wrote {out_path.name}")

    print(f"\nDone — {count} PDF(s) written to {out_dir}")


if __name__ == "__main__":
    main()
