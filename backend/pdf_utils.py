import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_LEFT

BRAND_NAME = "SANJU ANIMATIONS IT SOLUTIONS"
BRAND_TAGLINE = "Digital Marketing & Messaging Services"
BRAND_COLOR = colors.HexColor("#EA580C")
INK = colors.HexColor("#09090B")
MUTED = colors.HexColor("#71717A")
LIGHT_BORDER = colors.HexColor("#E4E4E7")
SURFACE = colors.HexColor("#F4F4F5")
SUCCESS = colors.HexColor("#16A34A")
WARNING = colors.HexColor("#D97706")

STATUS_COLORS = {
    "draft": colors.HexColor("#71717A"),
    "sent": colors.HexColor("#2563EB"),
    "accepted": SUCCESS,
    "paid": SUCCESS,
    "rejected": colors.HexColor("#DC2626"),
    "cancelled": colors.HexColor("#71717A"),
    "expired": colors.HexColor("#71717A"),
    "partially_paid": WARNING,
    "overdue": colors.HexColor("#DC2626"),
}

PAGE_WIDTH, PAGE_HEIGHT = A4
HEADER_HEIGHT = 32 * mm
MARGIN = 18 * mm


def fmt(v):
    try:
        return f"Rs. {v:,.2f}"
    except Exception:
        return f"Rs. {v}"


def _styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="SmallMuted", fontSize=9, textColor=MUTED, leading=13))
    styles.add(ParagraphStyle(name="Normal9", fontSize=9.5, textColor=INK, leading=14))
    styles.add(ParagraphStyle(name="Normal9Right", fontSize=9.5, textColor=INK, leading=14, alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name="SectionLabel", fontSize=8, textColor=MUTED, leading=11, spaceAfter=2))
    styles.add(ParagraphStyle(name="BoldName", fontSize=11, textColor=INK, leading=14, fontName="Helvetica-Bold"))
    return styles


def _make_header_footer(title, doc_number, status):
    def draw(canvas, doc):
        canvas.saveState()
        # top brand band
        canvas.setFillColor(BRAND_COLOR)
        canvas.rect(0, PAGE_HEIGHT - HEADER_HEIGHT, PAGE_WIDTH, HEADER_HEIGHT, stroke=0, fill=1)
        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica-Bold", 15)
        canvas.drawString(MARGIN, PAGE_HEIGHT - 15 * mm, BRAND_NAME)
        canvas.setFont("Helvetica", 8.5)
        canvas.drawString(MARGIN, PAGE_HEIGHT - 20.5 * mm, BRAND_TAGLINE)
        canvas.setFont("Helvetica-Bold", 20)
        canvas.drawRightString(PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 15 * mm, title)
        canvas.setFont("Helvetica", 9.5)
        canvas.drawRightString(PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 21 * mm, f"#{doc_number}")

        # status chip top-right below band
        chip_color = STATUS_COLORS.get(status, MUTED)
        label = status.replace("_", " ").title()
        canvas.setFont("Helvetica-Bold", 8)
        chip_w = canvas.stringWidth(label, "Helvetica-Bold", 8) + 12
        chip_x = PAGE_WIDTH - MARGIN - chip_w
        chip_y = PAGE_HEIGHT - HEADER_HEIGHT - 9 * mm
        canvas.setFillColor(chip_color)
        canvas.roundRect(chip_x, chip_y, chip_w, 5.5 * mm, 2.5, stroke=0, fill=1)
        canvas.setFillColor(colors.white)
        canvas.drawCentredString(chip_x + chip_w / 2, chip_y + 1.7 * mm, label)

        # footer
        canvas.setStrokeColor(LIGHT_BORDER)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, 14 * mm, PAGE_WIDTH - MARGIN, 14 * mm)
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 8)
        canvas.drawString(MARGIN, 10 * mm, "Thank you for your business.")
        canvas.drawRightString(PAGE_WIDTH - MARGIN, 10 * mm, f"Page {doc.page}")
        canvas.restoreState()
    return draw


def _build_doc(title, doc_number, doc_date, extra_date_label, extra_date_value, customer, items, subtotal, discount_total, tax_total, total, notes, terms_or_payment_terms, terms_label, status, paid_amount=None, due_amount=None):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=HEADER_HEIGHT + 15 * mm, bottomMargin=20 * mm,
        leftMargin=MARGIN, rightMargin=MARGIN,
    )
    styles = _styles()
    elements = []

    meta_left = [
        Paragraph("BILLED TO" if title == "INVOICE" else "QUOTED TO", styles["SectionLabel"]),
        Paragraph(customer.get("name", ""), styles["BoldName"]),
    ]
    if customer.get("company_name"):
        meta_left.append(Paragraph(customer["company_name"], styles["Normal9"]))
    if customer.get("address"):
        meta_left.append(Paragraph(customer["address"], styles["SmallMuted"]))
    if customer.get("mobile"):
        meta_left.append(Paragraph(customer["mobile"], styles["SmallMuted"]))
    meta_left.append(Paragraph(f"GSTIN: {customer.get('gst_number') or '-'}", styles["SmallMuted"]))

    meta_right = [
        Paragraph(f"<font color='#71717A'>Date</font>&nbsp;&nbsp;<b>{doc_date}</b>", styles["Normal9Right"]),
        Paragraph(f"<font color='#71717A'>{extra_date_label}</font>&nbsp;&nbsp;<b>{extra_date_value}</b>", styles["Normal9Right"]),
    ]

    meta_table = Table([[meta_left, meta_right]], colWidths=[100 * mm, 74 * mm])
    meta_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    elements.append(meta_table)
    elements.append(Spacer(1, 9 * mm))

    rows = [["SERVICE", "QTY", "RATE", "DISC %", "TAX %", "AMOUNT"]]
    for it in items:
        desc = it.get("description") or ""
        name = it.get("service_name", "")
        cell = Paragraph(f"<b>{name}</b>" + (f"<br/><font size=8 color='#71717A'>{desc}</font>" if desc else ""), styles["Normal9"])
        rows.append([
            cell,
            f"{it.get('quantity', 0):g}",
            fmt(it.get("rate", 0)),
            f"{it.get('discount_percent', 0):g}%",
            f"{it.get('tax_percent', 0):g}%",
            fmt(it.get("amount", 0)),
        ])
    item_table = Table(rows, colWidths=[58 * mm, 18 * mm, 28 * mm, 20 * mm, 20 * mm, 30 * mm], repeatRows=1)
    item_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTSIZE", (0, 1), (-1, -1), 9.5),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("LINEBELOW", (0, 1), (-1, -1), 0.5, LIGHT_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SURFACE]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(item_table)
    elements.append(Spacer(1, 7 * mm))

    totals_rows = [["Subtotal", fmt(subtotal)], ["Discount", "- " + fmt(discount_total)], ["Tax", "+ " + fmt(tax_total)], ["Total", fmt(total)]]
    if paid_amount is not None:
        totals_rows.append(["Paid", fmt(paid_amount)])
        totals_rows.append(["Balance Due", fmt(due_amount)])
    totals_table = Table(totals_rows, colWidths=[130 * mm, 44 * mm])
    total_row_idx = 3
    style_cmds = [
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("TEXTCOLOR", (0, 0), (-1, total_row_idx - 1), MUTED),
        ("LINEABOVE", (0, total_row_idx), (-1, total_row_idx), 1.2, INK),
        ("FONTNAME", (0, total_row_idx), (-1, total_row_idx), "Helvetica-Bold"),
        ("FONTSIZE", (0, total_row_idx), (-1, total_row_idx), 12),
        ("TOPPADDING", (0, total_row_idx), (-1, total_row_idx), 5),
    ]
    if paid_amount is not None:
        style_cmds += [
            ("TEXTCOLOR", (0, total_row_idx + 1), (-1, total_row_idx + 1), SUCCESS),
            ("FONTNAME", (0, total_row_idx + 1), (-1, total_row_idx + 1), "Helvetica-Bold"),
            ("TEXTCOLOR", (0, total_row_idx + 2), (-1, total_row_idx + 2), colors.HexColor("#DC2626") if due_amount and due_amount > 0 else SUCCESS),
            ("FONTNAME", (0, total_row_idx + 2), (-1, total_row_idx + 2), "Helvetica-Bold"),
            ("FONTSIZE", (0, total_row_idx + 2), (-1, total_row_idx + 2), 11),
            ("LINEABOVE", (0, total_row_idx + 1), (-1, total_row_idx + 1), 0.5, LIGHT_BORDER),
            ("TOPPADDING", (0, total_row_idx + 1), (-1, total_row_idx + 1), 5),
        ]
    totals_table.setStyle(TableStyle(style_cmds))
    elements.append(totals_table)
    elements.append(Spacer(1, 9 * mm))

    if notes:
        elements.append(Paragraph("NOTES", styles["SectionLabel"]))
        elements.append(Paragraph(notes, styles["Normal9"]))
        elements.append(Spacer(1, 5 * mm))
    if terms_or_payment_terms:
        elements.append(HRFlowable(width="100%", thickness=0.5, color=LIGHT_BORDER, spaceAfter=5))
        elements.append(Paragraph(terms_label.upper(), styles["SectionLabel"]))
        elements.append(Paragraph(terms_or_payment_terms, styles["SmallMuted"]))

    draw_fn = _make_header_footer(title, doc_number, status)
    doc.build(elements, onFirstPage=draw_fn, onLaterPages=draw_fn)
    buf.seek(0)
    return buf


def generate_quotation_pdf(quotation, customer):
    return _build_doc(
        title="QUOTATION",
        doc_number=quotation["quotation_number"],
        doc_date=quotation["date"].strftime("%d %b %Y") if hasattr(quotation["date"], "strftime") else str(quotation["date"]),
        extra_date_label="Valid Until",
        extra_date_value=quotation["valid_until"].strftime("%d %b %Y") if quotation.get("valid_until") and hasattr(quotation["valid_until"], "strftime") else "-",
        customer=customer,
        items=quotation.get("items", []),
        subtotal=quotation.get("subtotal", 0),
        discount_total=quotation.get("discount_total", 0),
        tax_total=quotation.get("tax_total", 0),
        total=quotation.get("total", 0),
        notes=quotation.get("notes", ""),
        terms_or_payment_terms=quotation.get("terms", ""),
        terms_label="Terms & Conditions",
        status=quotation.get("status", "draft"),
    )


def generate_invoice_pdf(invoice, customer):
    return _build_doc(
        title="INVOICE",
        doc_number=invoice["invoice_number"],
        doc_date=invoice["invoice_date"].strftime("%d %b %Y") if hasattr(invoice["invoice_date"], "strftime") else str(invoice["invoice_date"]),
        extra_date_label="Due Date",
        extra_date_value=invoice["due_date"].strftime("%d %b %Y") if invoice.get("due_date") and hasattr(invoice["due_date"], "strftime") else "-",
        customer=customer,
        items=invoice.get("items", []),
        subtotal=invoice.get("subtotal", 0),
        discount_total=invoice.get("discount_total", 0),
        tax_total=invoice.get("tax_total", 0),
        total=invoice.get("total", 0),
        notes=invoice.get("notes", ""),
        terms_or_payment_terms=invoice.get("payment_terms", ""),
        terms_label="Payment Terms",
        status=invoice.get("status", "draft"),
        paid_amount=invoice.get("paid_amount", 0),
        due_amount=invoice.get("due_amount", 0),
    )
