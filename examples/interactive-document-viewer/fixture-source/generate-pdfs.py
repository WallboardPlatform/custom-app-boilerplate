from pathlib import Path

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "overlay" / "preview" / "pdf-assets"
WIDTH, HEIGHT = A4
INK = HexColor("#14211f")
MUTED = HexColor("#66736f")
TEAL = HexColor("#0c7c6f")
AMBER = HexColor("#e8a32a")
PAPER = HexColor("#f7f4ec")
LINE = HexColor("#d7d9d2")


def header(pdf: canvas.Canvas, section: str, page_number: int) -> None:
    pdf.setFillColor(PAPER)
    pdf.rect(0, 0, WIDTH, HEIGHT, fill=1, stroke=0)
    pdf.setFillColor(TEAL)
    pdf.rect(0, HEIGHT - 18, WIDTH, 18, fill=1, stroke=0)
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(48, HEIGHT - 48, "NORTHLINE OPERATIONS")
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 9)
    pdf.drawRightString(WIDTH - 48, HEIGHT - 48, section.upper())
    pdf.setStrokeColor(LINE)
    pdf.line(48, 42, WIDTH - 48, 42)
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 8)
    pdf.drawString(48, 27, "Controlled document - training environment")
    pdf.drawRightString(WIDTH - 48, 27, f"PAGE {page_number:02d}")


def title(pdf: canvas.Canvas, eyebrow: str, heading: str, y: float) -> float:
    pdf.setFillColor(TEAL)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(48, y, eyebrow.upper())
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 28)
    pdf.drawString(48, y - 38, heading)
    return y - 72


def paragraph(pdf: canvas.Canvas, lines: list[str], y: float, size: int = 11) -> float:
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica", size)
    leading = size * 1.55
    for line in lines:
        pdf.drawString(48, y, line)
        y -= leading
    return y


def labeled_rule(pdf: canvas.Canvas, label: str, y: float) -> None:
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(48, y + 8, label.upper())
    pdf.setStrokeColor(LINE)
    pdf.line(48, y, WIDTH - 48, y)


def build_handbook(path: Path) -> None:
    pdf = canvas.Canvas(str(path), pagesize=A4)
    pdf.setTitle("Northline Operations Handbook")
    pdf.setAuthor("Wallboard synthetic example")

    header(pdf, "Handbook", 1)
    pdf.bookmarkPage("cover")
    pdf.addOutlineEntry("Overview", "cover", level=0)
    y = title(pdf, "Field reference / revision 04", "Operations handbook", HEIGHT - 102)
    pdf.setFillColor(AMBER)
    pdf.rect(48, y - 10, 120, 5, fill=1, stroke=0)
    y = paragraph(pdf, [
        "A compact reference for shift readiness, facility checks,",
        "and handover approval across Northline operating sites."
    ], y - 48, 13)
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(48, y - 36, "DOCUMENT SECTIONS")
    entries = [
        ("01", "Shift readiness", "readiness", "Required controls before work begins"),
        ("02", "Inspection record", "inspection", "Interactive field checklist"),
        ("03", "Handover approval", "approval", "Completion and sign-off form")
    ]
    row_y = y - 78
    for number, name, destination, description in entries:
        pdf.setStrokeColor(LINE)
        pdf.line(48, row_y - 18, WIDTH - 48, row_y - 18)
        pdf.setFillColor(TEAL)
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(48, row_y, number)
        pdf.setFillColor(INK)
        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawString(86, row_y, name)
        pdf.setFillColor(MUTED)
        pdf.setFont("Helvetica", 9)
        pdf.drawString(280, row_y, description)
        pdf.linkRect("", destination, (44, row_y - 17, WIDTH - 44, row_y + 15), relative=0, thickness=0)
        row_y -= 54
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 9)
    pdf.drawString(48, 112, "Supporting standards: ISO 45001 operational controls")
    pdf.setFillColor(TEAL)
    pdf.drawString(48, 94, "Open the public ISO overview")
    pdf.linkURL("https://www.iso.org/iso-45001-occupational-health-and-safety.html", (48, 88, 220, 108), relative=0)
    pdf.showPage()

    header(pdf, "Shift readiness", 2)
    pdf.bookmarkPage("readiness")
    pdf.addOutlineEntry("Shift readiness", "readiness", level=0)
    y = title(pdf, "Section 01", "Shift readiness", HEIGHT - 102)
    y = paragraph(pdf, [
        "Complete these controls before releasing the area for work.",
        "Escalate any failed item to the duty lead before proceeding."
    ], y, 12)
    checks = [
        ("Access", "Routes, exits, and exclusion zones are marked and unobstructed."),
        ("Equipment", "Safeguards are fitted and energy-isolation status is confirmed."),
        ("People", "The shift roster, competencies, and visitor briefing are current."),
        ("Handover", "Open actions have an owner, priority, and due time.")
    ]
    y -= 34
    for label, detail in checks:
        pdf.setFillColor(TEAL)
        pdf.roundRect(48, y - 13, 74, 24, 3, fill=1, stroke=0)
        pdf.setFillColor(white)
        pdf.setFont("Helvetica-Bold", 9)
        pdf.drawCentredString(85, y - 4, label.upper())
        pdf.setFillColor(INK)
        pdf.setFont("Helvetica", 10)
        pdf.drawString(142, y - 2, detail)
        y -= 52
    pdf.textAnnotation(
        "Supervisor note: confirm temporary access changes with Security before opening the shift.",
        Rect=(WIDTH - 88, HEIGHT - 250, WIDTH - 64, HEIGHT - 226),
        name="Note"
    )
    labeled_rule(pdf, "Escalation", y - 4)
    paragraph(pdf, [
        "Stop work if a critical control is unavailable. Record the condition,",
        "notify the duty lead, and restart only after the control is verified."
    ], y - 28, 10)
    pdf.showPage()

    header(pdf, "Inspection record", 3)
    pdf.bookmarkPage("inspection")
    pdf.addOutlineEntry("Inspection record", "inspection", level=0)
    y = title(pdf, "Section 02 / interactive form", "Inspection record", HEIGHT - 102)
    form = pdf.acroForm
    fields = [
        ("Inspector name", "inspector_name", 48, y - 34, 230),
        ("Site or area", "site_area", 306, y - 34, 240),
        ("Inspection date", "inspection_date", 48, y - 112, 230)
    ]
    for label, name, x, field_y, width in fields:
        pdf.setFillColor(MUTED)
        pdf.setFont("Helvetica-Bold", 8)
        pdf.drawString(x, field_y + 34, label.upper())
        form.textfield(
            name=name,
            x=x,
            y=field_y,
            width=width,
            height=28,
            borderColor=Color(0.55, 0.62, 0.60),
            fillColor=white,
            textColor=INK,
            forceBorder=True,
            fontName="Helvetica",
            fontSize=10
        )
    choice_y = y - 190
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(48, choice_y + 34, "OVERALL CONDITION")
    form.choice(
        name="overall_condition",
        options=["Select condition", "Ready", "Ready with actions", "Not ready"],
        value="Select condition",
        x=48,
        y=choice_y,
        width=230,
        height=28,
        borderColor=Color(0.55, 0.62, 0.60),
        fillColor=white,
        textColor=INK,
        forceBorder=True,
        fontName="Helvetica",
        fontSize=10
    )
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(48, choice_y - 52, "VERIFICATION")
    checkbox_items = [
        ("routes_clear", "Access routes are clear"),
        ("guards_verified", "Equipment safeguards are verified"),
        ("handover_reviewed", "Open handover actions are reviewed")
    ]
    check_y = choice_y - 88
    for name, label in checkbox_items:
        form.checkbox(
            name=name,
            x=48,
            y=check_y - 4,
            size=14,
            borderColor=Color(0.55, 0.62, 0.60),
            fillColor=white,
            buttonStyle="check",
            forceBorder=True
        )
        pdf.setFillColor(INK)
        pdf.setFont("Helvetica", 10)
        pdf.drawString(72, check_y, label)
        check_y -= 34
    pdf.showPage()

    header(pdf, "Handover approval", 4)
    pdf.bookmarkPage("approval")
    pdf.addOutlineEntry("Handover approval", "approval", level=0)
    y = title(pdf, "Section 03 / interactive form", "Handover approval", HEIGHT - 102)
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(48, y + 4, "HANDOVER NOTES")
    form = pdf.acroForm
    form.textfield(
        name="handover_notes",
        x=48,
        y=y - 130,
        width=WIDTH - 96,
        height=112,
        borderColor=Color(0.55, 0.62, 0.60),
        fillColor=white,
        textColor=INK,
        forceBorder=True,
        fontName="Helvetica",
        fontSize=10,
        fieldFlags="multiline"
    )
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(48, y - 178, "APPROVER")
    form.textfield(
        name="approver_name",
        x=48,
        y=y - 220,
        width=260,
        height=30,
        borderColor=Color(0.55, 0.62, 0.60),
        fillColor=white,
        textColor=INK,
        forceBorder=True,
        fontName="Helvetica",
        fontSize=10
    )
    form.checkbox(
        name="approved_for_release",
        x=48,
        y=y - 272,
        size=16,
        borderColor=Color(0.55, 0.62, 0.60),
        fillColor=white,
        buttonStyle="check",
        forceBorder=True
    )
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica", 10)
    pdf.drawString(76, y - 267, "I confirm the recorded controls are complete for shift release.")
    pdf.setFillColor(TEAL)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(48, 92, "Return to handbook overview")
    pdf.linkRect("", "cover", (44, 82, 220, 106), relative=0, thickness=0)
    pdf.save()


def build_shift_brief(path: Path) -> None:
    pdf = canvas.Canvas(str(path), pagesize=A4)
    pdf.setTitle("Northline Shift Brief")
    pdf.setAuthor("Wallboard synthetic example")

    header(pdf, "Shift brief", 1)
    pdf.bookmarkPage("brief")
    pdf.addOutlineEntry("Shift brief", "brief", level=0)
    y = title(pdf, "19 July / morning operations", "Shift brief", HEIGHT - 102)
    y = paragraph(pdf, [
        "Three priorities define the operating window.",
        "Review the action register before the 14:00 handover."
    ], y, 12)
    cards = [
        ("01", "Keep loading bay 3 clear", "Contractor delivery expected between 09:30 and 10:15."),
        ("02", "Verify temporary barriers", "East corridor works continue until the permit is closed."),
        ("03", "Close quality action QA-184", "Owner update is due before the afternoon shift meeting.")
    ]
    y -= 34
    for number, heading, body in cards:
        pdf.setFillColor(white)
        pdf.setStrokeColor(LINE)
        pdf.roundRect(48, y - 68, WIDTH - 96, 74, 4, fill=1, stroke=1)
        pdf.setFillColor(AMBER)
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(64, y - 16, number)
        pdf.setFillColor(INK)
        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(104, y - 16, heading)
        pdf.setFillColor(MUTED)
        pdf.setFont("Helvetica", 9)
        pdf.drawString(104, y - 38, body)
        y -= 94
    pdf.showPage()

    header(pdf, "Action register", 2)
    pdf.bookmarkPage("actions")
    pdf.addOutlineEntry("Action register", "actions", level=0)
    y = title(pdf, "Ownership and timing", "Action register", HEIGHT - 102)
    columns = [(48, "ACTION"), (300, "OWNER"), (420, "DUE")]
    for x, label in columns:
        pdf.setFillColor(MUTED)
        pdf.setFont("Helvetica-Bold", 8)
        pdf.drawString(x, y, label)
    rows = [
        ("Confirm loading bay escort", "M. Reyes", "09:15"),
        ("Inspect east corridor barrier", "T. Novak", "11:00"),
        ("Update quality action QA-184", "S. Patel", "13:30"),
        ("Prepare shift handover", "Duty lead", "14:00")
    ]
    row_y = y - 32
    for action, owner, due in rows:
        pdf.setStrokeColor(LINE)
        pdf.line(48, row_y - 15, WIDTH - 48, row_y - 15)
        pdf.setFillColor(INK)
        pdf.setFont("Helvetica", 10)
        pdf.drawString(48, row_y, action)
        pdf.drawString(300, row_y, owner)
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(420, row_y, due)
        row_y -= 48
    pdf.save()


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    build_handbook(OUTPUT / "northline-operations-handbook.pdf")
    build_shift_brief(OUTPUT / "northline-shift-brief.pdf")


if __name__ == "__main__":
    main()
