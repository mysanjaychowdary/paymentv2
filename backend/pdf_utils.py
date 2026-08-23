import io
import math
import os
import reportlab
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER

BRAND_COLOR = colors.HexColor("#EA580C")
INK = colors.HexColor("#18181B")
MUTED = colors.HexColor("#71717A")
LIGHT_BORDER = colors.HexColor("#E2D9CE")
SURFACE = colors.HexColor("#FFF7ED")
SUCCESS = colors.HexColor("#16A34A")

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN = 18 * mm
HEADER_HEIGHT = 34 * mm
FOOTER_HEIGHT = 13 * mm
TOP_BAR_HEIGHT = 2.4 * mm

# ---------- Fonts ----------
# Embed a clean humanist sans (Bitstream Vera, bundled with reportlab) so the PDF
# renders identically everywhere instead of falling back to whatever "Helvetica"
# maps to on the viewer's system. Falls back to the built-in Helvetica if the
# font files aren't available in this reportlab install.
FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"


def _register_fonts():
    global FONT_REGULAR, FONT_BOLD
    try:
        font_dir = os.path.join(os.path.dirname(reportlab.__file__), "fonts")
        pdfmetrics.registerFont(TTFont("CorpSans", os.path.join(font_dir, "Vera.ttf")))
        pdfmetrics.registerFont(TTFont("CorpSans-Bold", os.path.join(font_dir, "VeraBd.ttf")))
        pdfmetrics.registerFontFamily("CorpSans", normal="CorpSans", bold="CorpSans-Bold")
        FONT_REGULAR = "CorpSans"
        FONT_BOLD = "CorpSans-Bold"
    except Exception:
        pass


_register_fonts()


def fmt(v):
    try:
        return f"Rs. {v:,.2f}"
    except Exception:
        return f"Rs. {v}"


# ---------- Amount in words (Indian numbering system) ----------
_ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
         "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def _two_digit_words(n):
    if n < 20:
        return _ONES[n]
    tens, ones = divmod(n, 10)
    return (_TENS[tens] + (" " + _ONES[ones] if ones else "")).strip()


def _three_digit_words(n):
    if n >= 100:
        rest = n % 100
        return _ONES[n // 100] + " Hundred" + (" " + _two_digit_words(rest) if rest else "")
    return _two_digit_words(n)


def _number_to_words_indian(n):
    if n == 0:
        return "Zero"
    parts = []
    crore, n = divmod(n, 10000000)
    lakh, n = divmod(n, 100000)
    thousand, n = divmod(n, 1000)
    hundred = n
    if crore:
        parts.append(_three_digit_words(crore) + " Crore")
    if lakh:
        parts.append(_three_digit_words(lakh) + " Lakh")
    if thousand:
        parts.append(_three_digit_words(thousand) + " Thousand")
    if hundred:
        parts.append(_three_digit_words(hundred))
    return " ".join(parts)


def amount_in_words(amount):
    amount = round(float(amount or 0), 2)
    rupees = int(amount)
    paise = int(round((amount - rupees) * 100))
    words = _number_to_words_indian(rupees) + " Rupees"
    if paise:
        words += " and " + _number_to_words_indian(paise) + " Paise"
    return words + " Only"


def _styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="SmallMuted", fontName=FONT_REGULAR, fontSize=9, textColor=MUTED, leading=13))
    styles.add(ParagraphStyle(name="Normal9", fontName=FONT_REGULAR, fontSize=9.5, textColor=INK, leading=14))
    styles.add(ParagraphStyle(name="Normal9Right", fontName=FONT_REGULAR, fontSize=9.5, textColor=INK, leading=14, alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name="SectionLabel", fontName=FONT_BOLD, fontSize=8.5, textColor=BRAND_COLOR, leading=11, spaceAfter=2))
    styles.add(ParagraphStyle(name="BoldName", fontName=FONT_BOLD, fontSize=11, textColor=INK, leading=14))
    styles.add(ParagraphStyle(name="CenterMuted", fontName=FONT_REGULAR, fontSize=8, textColor=MUTED, leading=11, alignment=TA_CENTER))
    return styles


def _hexagon_points(cx, cy, r):
    return [(cx + r * math.cos(math.pi / 180 * (60 * i - 30)), cy + r * math.sin(math.pi / 180 * (60 * i - 30))) for i in range(6)]


def _hexagon_path(canvas, cx, cy, r):
    points = _hexagon_points(cx, cy, r)
    path = canvas.beginPath()
    path.moveTo(*points[0])
    for p in points[1:]:
        path.lineTo(*p)
    path.close()
    return path


def _draw_logo_hexagon(canvas, x, y, size, initial):
    """Vector fallback logo (orange hexagon) used when no custom logo has been uploaded."""
    cx, cy = x + size / 2, y + size / 2
    canvas.setStrokeColor(BRAND_COLOR)
    canvas.setLineWidth(2.2)
    canvas.drawPath(_hexagon_path(canvas, cx, cy, size / 2), stroke=1, fill=0)
    canvas.setFillColor(BRAND_COLOR)
    canvas.setFont(FONT_BOLD, size * 0.42)
    canvas.drawCentredString(cx, cy - size * 0.15, (initial or "Y")[0].upper())


def _draw_background(canvas):
    """Subtle corporate letterhead treatment: top accent bar, tinted header band,
    faint watermark hexagon — all painted first so flowable content sits on top."""
    canvas.setFillColor(BRAND_COLOR)
    canvas.rect(0, PAGE_HEIGHT - TOP_BAR_HEIGHT, PAGE_WIDTH, TOP_BAR_HEIGHT, stroke=0, fill=1)

    canvas.setFillColor(SURFACE)
    canvas.rect(0, PAGE_HEIGHT - TOP_BAR_HEIGHT - HEADER_HEIGHT, PAGE_WIDTH, HEADER_HEIGHT, stroke=0, fill=1)

    try:
        canvas.saveState()
        canvas.setStrokeColor(BRAND_COLOR)
        canvas.setStrokeAlpha(0.05)
        canvas.setLineWidth(16)
        canvas.drawPath(_hexagon_path(canvas, PAGE_WIDTH - 6 * mm, FOOTER_HEIGHT + 26 * mm, 46 * mm), stroke=1, fill=0)
        canvas.restoreState()
    except Exception:
        pass


def _make_header_footer(title, settings):
    logo_bytes = settings.get("_logo_bytes")
    company_name = settings.get("company_name") or "Your Company"
    tagline = settings.get("tagline") or ""

    def draw(canvas, doc):
        canvas.saveState()
        _draw_background(canvas)

        top = PAGE_HEIGHT - MARGIN
        logo_size = 17 * mm
        logo_x, logo_y = MARGIN, top - logo_size

        if logo_bytes:
            try:
                img = ImageReader(io.BytesIO(logo_bytes))
                canvas.drawImage(img, logo_x, logo_y, width=logo_size, height=logo_size,
                                  preserveAspectRatio=True, mask="auto")
            except Exception:
                _draw_logo_hexagon(canvas, logo_x, logo_y, logo_size, company_name)
        else:
            _draw_logo_hexagon(canvas, logo_x, logo_y, logo_size, company_name)

        text_x = logo_x + logo_size + 5 * mm
        canvas.setFillColor(INK)
        canvas.setFont(FONT_BOLD, 15)
        canvas.drawString(text_x, top - 6.5 * mm, company_name)
        if tagline:
            canvas.setFillColor(MUTED)
            canvas.setFont(FONT_REGULAR, 9)
            canvas.drawString(text_x, top - 12 * mm, tagline)

        canvas.setFillColor(BRAND_COLOR)
        canvas.setFont(FONT_BOLD, 28)
        canvas.drawRightString(PAGE_WIDTH - MARGIN, top - 9.5 * mm, title)

        # footer band
        canvas.setFillColor(BRAND_COLOR)
        canvas.rect(0, 0, PAGE_WIDTH, FOOTER_HEIGHT, stroke=0, fill=1)
        canvas.setFillColor(colors.white)
        canvas.setFont(FONT_BOLD, 10)
        canvas.drawCentredString(PAGE_WIDTH / 2, FOOTER_HEIGHT / 2 - 3, "Thank you for your business!")
        canvas.setFont(FONT_REGULAR, 7)
        canvas.drawRightString(PAGE_WIDTH - MARGIN, FOOTER_HEIGHT / 2 - 3, f"Page {doc.page}")
        canvas.restoreState()
    return draw


def _build_doc(
    title, doc_number, doc_date, extra_date_label, extra_date_value,
    customer, items, subtotal, discount_total, tax_total, total, notes,
    terms_or_payment_terms, terms_label, settings,
    paid_amount=None, due_amount=None, payment_details=None, digital_note=None,
):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=HEADER_HEIGHT + TOP_BAR_HEIGHT + 6 * mm, bottomMargin=FOOTER_HEIGHT + 8 * mm,
        leftMargin=MARGIN, rightMargin=MARGIN,
    )
    styles = _styles()
    elements = []

    # ---- company info (left) + doc meta (right) ----
    company_left = []
    for line in (settings.get("address") or "").split("\n"):
        if line.strip():
            company_left.append(Paragraph(line.strip(), styles["Normal9"]))
    contact_bits = [b for b in [settings.get("phone"), settings.get("email")] if b]
    if contact_bits:
        company_left.append(Paragraph(" &nbsp;|&nbsp; ".join(contact_bits), styles["SmallMuted"]))
    if settings.get("gst_number"):
        company_left.append(Paragraph(f"GSTIN: {settings['gst_number']}", styles["SmallMuted"]))
    if not company_left:
        company_left.append(Spacer(1, 1))

    meta_right = [Paragraph(f"<font color='#71717A'>{title.title()} No.</font>&nbsp;&nbsp;<b>{doc_number}</b>", styles["Normal9Right"])]
    meta_right.append(Paragraph(f"<font color='#71717A'>Date</font>&nbsp;&nbsp;<b>{doc_date}</b>", styles["Normal9Right"]))
    if extra_date_value:
        meta_right.append(Paragraph(f"<font color='#71717A'>{extra_date_label}</font>&nbsp;&nbsp;<b>{extra_date_value}</b>", styles["Normal9Right"]))

    top_table = Table([[company_left, meta_right]], colWidths=[100 * mm, 74 * mm])
    top_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    elements.append(top_table)
    elements.append(Spacer(1, 5 * mm))
    elements.append(HRFlowable(width="100%", thickness=0.7, color=LIGHT_BORDER))
    elements.append(Spacer(1, 6 * mm))

    # ---- bill to ----
    bill_to = [
        Paragraph("BILL TO" if title == "INVOICE" else "QUOTED TO", styles["SectionLabel"]),
        Paragraph(customer.get("name", ""), styles["BoldName"]),
    ]
    if customer.get("company_name"):
        bill_to.append(Paragraph(customer["company_name"], styles["Normal9"]))
    if customer.get("address"):
        bill_to.append(Paragraph(customer["address"], styles["SmallMuted"]))
    if customer.get("email"):
        bill_to.append(Paragraph(f"Email: {customer['email']}", styles["SmallMuted"]))
    if customer.get("mobile"):
        bill_to.append(Paragraph(customer["mobile"], styles["SmallMuted"]))
    bill_to.append(Paragraph(f"GSTIN: {customer.get('gst_number') or '-'}", styles["SmallMuted"]))
    elements.append(Table([[bill_to]], colWidths=[174 * mm]))
    elements.append(Spacer(1, 8 * mm))

    # ---- items table ----
    rows = [["#", "DESCRIPTION", "HSN/SAC", "QTY", "UNIT PRICE", "AMOUNT"]]
    for idx, it in enumerate(items, start=1):
        desc = it.get("description") or ""
        name = it.get("service_name", "")
        cell = Paragraph(f"<b>{name}</b>" + (f"<br/><font size=8 color='#71717A'>{desc}</font>" if desc else ""), styles["Normal9"])
        rows.append([
            str(idx),
            cell,
            it.get("hsn_sac") or "-",
            f"{it.get('quantity', 0):g}",
            fmt(it.get("rate", 0)),
            fmt(it.get("amount", 0)),
        ])
    item_table = Table(rows, colWidths=[9 * mm, 65 * mm, 24 * mm, 16 * mm, 30 * mm, 30 * mm], repeatRows=1)
    item_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTNAME", (0, 1), (-1, -1), FONT_REGULAR),
        ("FONTSIZE", (0, 0), (-1, 0), 8.5),
        ("FONTSIZE", (0, 1), (-1, -1), 9.5),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, -1), 0.5, LIGHT_BORDER),
        ("BOX", (0, 0), (-1, -1), 0.9, INK),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SURFACE]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(item_table)
    elements.append(Spacer(1, 7 * mm))

    # ---- amount in words (left) + totals box (right) ----
    words_block = [
        Paragraph("AMOUNT IN WORDS", styles["SectionLabel"]),
        Paragraph(amount_in_words(total), styles["Normal9"]),
    ]

    totals_rows = [["SUBTOTAL", fmt(subtotal)]]
    if discount_total:
        totals_rows.append(["DISCOUNT", "- " + fmt(discount_total)])
    if tax_total:
        cgst = round(tax_total / 2, 2)
        sgst = round(tax_total - cgst, 2)
        taxable = subtotal - discount_total
        rate = round(tax_total / taxable * 100, 1) if taxable else 0
        half_rate = round(rate / 2, 1)
        totals_rows.append([f"CGST ({half_rate:g}%)", fmt(cgst)])
        totals_rows.append([f"SGST ({half_rate:g}%)", fmt(sgst)])
    total_row_idx = len(totals_rows)
    totals_rows.append(["TOTAL AMOUNT", fmt(total)])
    extra_rows = 0
    if paid_amount is not None:
        totals_rows.append(["PAID", fmt(paid_amount)])
        totals_rows.append(["BALANCE DUE", fmt(due_amount)])
        extra_rows = 2

    totals_table = Table(totals_rows, colWidths=[40 * mm, 34 * mm])
    style_cmds = [
        ("FONTNAME", (0, 0), (-1, -1), FONT_REGULAR),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, total_row_idx - 1), MUTED),
        ("TEXTCOLOR", (1, 0), (1, total_row_idx - 1), INK),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("BOX", (0, 0), (-1, -1), 0.8, LIGHT_BORDER),
        ("LINEAFTER", (0, 0), (0, -1), 0.5, LIGHT_BORDER),
        ("LINEBELOW", (0, 0), (-1, total_row_idx - 1), 0.4, LIGHT_BORDER),
        ("BACKGROUND", (0, total_row_idx), (-1, total_row_idx), BRAND_COLOR),
        ("TEXTCOLOR", (0, total_row_idx), (-1, total_row_idx), colors.white),
        ("FONTNAME", (0, total_row_idx), (-1, total_row_idx), FONT_BOLD),
        ("FONTSIZE", (0, total_row_idx), (-1, total_row_idx), 10.5),
    ]
    if extra_rows:
        style_cmds += [
            ("TEXTCOLOR", (0, total_row_idx + 1), (-1, total_row_idx + 1), SUCCESS),
            ("TEXTCOLOR", (0, total_row_idx + 2), (-1, total_row_idx + 2),
             colors.HexColor("#DC2626") if due_amount and due_amount > 0 else SUCCESS),
            ("FONTNAME", (0, total_row_idx + 1), (-1, total_row_idx + 2), FONT_BOLD),
        ]
    totals_table.setStyle(TableStyle(style_cmds))
    totals_table.hAlign = "RIGHT"

    combined = Table([[words_block, totals_table]], colWidths=[100 * mm, 74 * mm])
    combined.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    elements.append(combined)
    elements.append(Spacer(1, 8 * mm))
    elements.append(HRFlowable(width="100%", thickness=0.7, color=LIGHT_BORDER))
    elements.append(Spacer(1, 6 * mm))

    # ---- terms/notes + payment details (two columns) ----
    left_col = []
    if terms_or_payment_terms:
        left_col.append(Paragraph(terms_label.upper(), styles["SectionLabel"]))
        for line in terms_or_payment_terms.split("\n"):
            if line.strip():
                left_col.append(Paragraph(f"&#8226;&nbsp; {line.strip()}", styles["SmallMuted"]))
    if not left_col:
        left_col.append(Spacer(1, 1))

    right_col = []
    if notes:
        right_col.append(Paragraph("NOTES", styles["SectionLabel"]))
        right_col.append(Paragraph(notes, styles["Normal9"]))
    if payment_details:
        if right_col:
            right_col.append(Spacer(1, 4 * mm))
        right_col.append(Paragraph("PAYMENT DETAILS", styles["SectionLabel"]))
        for label, value in payment_details:
            right_col.append(Paragraph(f"<font color='#71717A'>{label}</font>&nbsp;&nbsp;:&nbsp;&nbsp;<b>{value}</b>", styles["Normal9"]))
    if not right_col:
        right_col.append(Spacer(1, 1))

    elements.append(Table([[left_col, right_col]], colWidths=[87 * mm, 87 * mm], style=TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")])))

    if digital_note:
        elements.append(Spacer(1, 8 * mm))
        elements.append(Paragraph(digital_note, styles["CenterMuted"]))

    draw_fn = _make_header_footer(title, settings)
    doc.build(elements, onFirstPage=draw_fn, onLaterPages=draw_fn)
    buf.seek(0)
    return buf


def generate_quotation_pdf(quotation, customer, settings=None):
    settings = settings or {}
    return _build_doc(
        title="QUOTATION",
        doc_number=quotation["quotation_number"],
        doc_date=quotation["date"].strftime("%d %b %Y") if hasattr(quotation["date"], "strftime") else str(quotation["date"]),
        extra_date_label="Valid Until",
        extra_date_value=quotation["valid_until"].strftime("%d %b %Y") if quotation.get("valid_until") and hasattr(quotation["valid_until"], "strftime") else None,
        customer=customer,
        items=quotation.get("items", []),
        subtotal=quotation.get("subtotal", 0),
        discount_total=quotation.get("discount_total", 0),
        tax_total=quotation.get("tax_total", 0),
        total=quotation.get("total", 0),
        notes=quotation.get("notes", ""),
        terms_or_payment_terms=quotation.get("terms", ""),
        terms_label="Terms & Conditions",
        settings=settings,
        digital_note="This is a digitally generated quotation and does not require a signature.",
    )


def generate_invoice_pdf(invoice, customer, settings=None):
    settings = settings or {}
    payment_details = None
    bank_fields = [
        ("Bank Name", settings.get("bank_name")),
        ("Account Name", settings.get("account_name")),
        ("Account No.", settings.get("account_number")),
        ("IFSC Code", settings.get("ifsc_code")),
        ("Branch", settings.get("branch")),
    ]
    filled = [(label, value) for label, value in bank_fields if value]
    if filled:
        payment_details = filled

    return _build_doc(
        title="INVOICE",
        doc_number=invoice["invoice_number"],
        doc_date=invoice["invoice_date"].strftime("%d %b %Y") if hasattr(invoice["invoice_date"], "strftime") else str(invoice["invoice_date"]),
        extra_date_label="Due Date",
        extra_date_value=invoice["due_date"].strftime("%d %b %Y") if invoice.get("due_date") and hasattr(invoice["due_date"], "strftime") else None,
        customer=customer,
        items=invoice.get("items", []),
        subtotal=invoice.get("subtotal", 0),
        discount_total=invoice.get("discount_total", 0),
        tax_total=invoice.get("tax_total", 0),
        total=invoice.get("total", 0),
        notes=invoice.get("notes", ""),
        terms_or_payment_terms=invoice.get("payment_terms", ""),
        terms_label="Payment Terms",
        settings=settings,
        paid_amount=invoice.get("paid_amount", 0),
        due_amount=invoice.get("due_amount", 0),
        payment_details=payment_details,
    )
