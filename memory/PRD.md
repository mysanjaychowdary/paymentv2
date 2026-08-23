# PRD — Sanju Animations IT Solutions: Invoice, Payment & Credit Purchase Manager

## Original Problem Statement
Freelancer providing digital marketing/messaging services needs a simple business management app to:
1. Manage quotations, invoices and customer payments.
2. Track money received vs. due.
3. Track WhatsApp/SMS credit purchases per customer (date, credits, amount paid) as a **simple historical record only** — explicitly NO credit wallet/balance/remaining-credits system.

Core flow: **Customers → Quotations → Invoices → Payments**, and separately **Customers → Credit Purchases**.

## User Persona
Solo freelancer (Sanju Animations IT Solutions) selling WhatsApp/SMS/marketing services, buying messaging credits from providers (e.g. Gupshup), needs daily-use, fast, clutter-free tool — not full accounting/inventory software.

## Architecture
- Backend: FastAPI + Motor (MongoDB), JWT httpOnly-cookie auth (single admin user, seeded from .env)
- Frontend: React + Tailwind + shadcn/ui, orange-and-white SaaS theme (#EA580C), Sora/Inter fonts
- PDF generation: reportlab (invoices & quotations), downloaded via authenticated blob fetch, matches the orange brand theme
- Statement Analyzer AI: OpenRouter free-tier model (via OpenAI-compatible client), configured with `OPENROUTER_API_KEY` in backend/.env
- Collections: users, customers, services, quotations, invoices, payments, credit_purchases, counters, login_attempts, settings (singleton company profile)
- Company Settings page (logo upload, name/tagline/address/phone/email/GSTIN, bank details, default quotation/invoice terms) — feeds the PDF header, "Payment Details" section and new-document term defaults; logo stored locally via storage.py, referenced by `logo_path`
- Invoice/quotation PDFs redesigned to match a reference "hexagon logo + orange header + BILL TO + HSN/SAC item table + CGST/SGST totals + Amount in Words + orange footer band" template; LineItem/Service gained optional `hsn_sac` field

## Core Requirements (static)
- Customer CRUD + detail page with sales/paid/due/credit summary + tabbed history (invoices/quotations/payments/credit purchases)
- Quotation CRUD with dynamic line items (qty/rate/discount%/tax%), statuses (draft/sent/accepted/rejected/expired), convert-to-invoice
- Invoice CRUD with dynamic line items, auto-computed paid/due/status from linked payments, statuses (draft/sent/partially_paid/paid/overdue/cancelled)
- Payment recording against invoices (UPI/bank/cash/card/other), multiple payments per invoice supported
- Credit Purchase historical log per customer (date, provider, credits, amount paid, reference, campaign) — NO balance calc
- Services catalog with default price (overridable per line item)
- Dashboard with aggregate + month-to-date KPIs and recent activity
- Reports: Sales, Payments, Outstanding, Credit Purchases, Monthly, Profit Overview — all with date range filters
- PDF export for quotations & invoices

## What's Been Implemented (as of 2026-08-22)
- Full backend: auth (login/logout/me/refresh, brute-force lockout, admin seed), all CRUD routes for customers/services/quotations/invoices/payments/credit-purchases, dashboard summary, 6 report endpoints, PDF generation for invoices & quotations
- Full frontend: Login (split-screen), Sidebar+AppLayout, Dashboard, Customers list+detail, Quotations list/form/view (+convert to invoice), Invoices list/form/view (+record payment inline), Payments list+dialog, Credit Purchases list+dialog, Services list+dialog, Reports (6 tabs)
- Verified via testing agent: 19/19 backend pytest cases + full Playwright UI flow — 100% pass. Confirmed NO wallet/balance logic exists anywhere for credits.
- Test credentials in /app/memory/test_credentials.md (admin@sanjuanimations.com / Sanju@2026)

## Known Minor Items (non-blocking)
- A low-priority React console warning (likely from next-themes in the sonner Toaster template component) — does not affect functionality.
- No pagination on list endpoints yet (fine at current MVP scale).
- Monthly report "outstanding" figure is scoped to invoices raised within that month, not all-time open dues — matches a "monthly snapshot" reading of the spec; can be revisited if user wants all-time outstanding instead.

## Backlog / Next Candidates (not yet built)
- P1: Global search bar across customers/invoices/quotations from any page
- P1: Bulk actions / list pagination once data grows
- P2: Email/WhatsApp share of invoice/quotation PDF directly to customer
- P2: Recurring invoice templates for repeat customers
- P2: Multi-currency support (currently INR only, per spec)

## Next Tasks
- Await user feedback on real usage before adding further features (avoid over-building beyond stated scope, per design principle in problem statement).
