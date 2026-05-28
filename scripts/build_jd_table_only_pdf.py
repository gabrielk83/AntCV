#!/usr/bin/env python3
"""Generate the JD-table-only.pdf fixture for TC-027.

This script builds the test PDF used to verify the CloudConvert
PDF -> DOCX route added in P0-F (workers/docx-worker:
POST /api/jd/pdf-to-docx + convertPdfToDocx).

The fixture's key requirements live INSIDE a real PDF table
(reportlab Platypus Table primitive). If you regenerate the PDF
locally make sure the result still has a real table object —
text-with-pipes or images-of-tables would defeat the test.

Usage:
    python scripts/build_jd_table_only_pdf.py
"""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def build(out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=A4,
        title="JD — Hive Operations Engineer — BeezKneez Logistics",
        author="AntCV test fixture",
        subject="Test fixture for CloudConvert PDF->DOCX (TC-027)",
        leftMargin=22 * mm,
        rightMargin=22 * mm,
        topMargin=22 * mm,
        bottomMargin=22 * mm,
    )

    styles = getSampleStyleSheet()
    body = ParagraphStyle(
        "body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10.5,
        leading=14,
        spaceAfter=8,
    )
    h1 = ParagraphStyle(
        "h1",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        spaceAfter=4,
    )
    sub = ParagraphStyle(
        "sub",
        parent=styles["BodyText"],
        fontName="Helvetica-Oblique",
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor("#444444"),
        spaceAfter=12,
    )
    table_title = ParagraphStyle(
        "table_title",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12.5,
        leading=16,
        spaceBefore=4,
        spaceAfter=6,
    )

    story = []
    story.append(Paragraph("Hive Operations Engineer", h1))
    story.append(Paragraph("BeezKneez Logistics   |   Copenhagen, Denmark   |   Full-time", sub))
    story.append(Paragraph(
        "BeezKneez Logistics is hiring a Hive Operations Engineer to keep our "
        "automated last-mile fleet humming. You will own the daily readiness of "
        "our routing controllers and partner with safety, supply, and software "
        "to ship reliable operations across Northern Europe.",
        body,
    ))
    story.append(Spacer(1, 4))

    story.append(Paragraph("Required qualifications", table_title))

    # ── The actual table — a real reportlab Platypus Table.
    #    CloudConvert + LibreOffice extract this as a structured
    #    <w:tbl> in the resulting DOCX, which the canonical DOCX
    #    table parser then picks up unchanged. Do not replace this
    #    with a text-with-pipes block or an image — the whole point
    #    of the fixture is the structured-table round trip.
    table_data = [
        ["Requirement", "Status"],
        ["ISO 26262 functional safety experience", "Required"],
        ["Bachelor's degree in supply chain or related field", "Required"],
        ["Danish + English business fluency", "Required"],
        ["5+ years in operations or logistics engineering", "Required"],
        ["Python or SQL for data wrangling", "Preferred"],
        ["EU work authorisation", "Required"],
    ]

    # Column widths sized so the requirement column gets the bulk.
    col_widths = [115 * mm, 35 * mm]

    table = Table(table_data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        # Header row
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#283556")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10.5),
        ("ALIGN", (0, 0), (-1, 0), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        # Body rows
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 10),
        ("ALIGN", (0, 1), (0, -1), "LEFT"),
        ("ALIGN", (1, 1), (1, -1), "LEFT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.HexColor("#f3f4f6")]),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 6),
        ("TOPPADDING", (0, 1), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        # Grid lines to make the table structure unambiguous to the
        # PDF-to-DOCX converter.
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("LINEBELOW", (0, 0), (-1, 0), 1.0, colors.HexColor("#283556")),
    ]))
    story.append(table)

    story.append(Spacer(1, 14))
    story.append(Paragraph(
        "Apply at careers@beezknees.example by 2026-06-15.",
        body,
    ))

    doc.build(story)


if __name__ == "__main__":
    # Resolve relative to the script's location so it works from any cwd.
    here = Path(__file__).resolve().parent.parent
    out = here / "docs" / "personas" / "anita" / "JD-table-only.pdf"
    build(out)
    print(f"wrote {out}  ({out.stat().st_size} bytes)")
