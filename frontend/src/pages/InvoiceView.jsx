import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { DownloadSimple, PencilSimple, ArrowLeft, Plus, CopySimple } from "@phosphor-icons/react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DatePicker } from "@/components/shared/DatePicker";
import { formatCurrency, formatDate } from "@/lib/format";
import { PAYMENT_METHODS, METHOD_LABELS } from "@/lib/constants";

const emptyPayment = { payment_date: new Date().toISOString(), amount: "", method: "upi", reference_number: "", notes: "" };

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [payments, setPayments] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyPayment);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  const load = async () => {
    setLoadError("");
    try {
      const res = await api.get(`/invoices/${id}`);
      setInvoice(res.data);
      try {
        const r = await api.get(`/customers/${res.data.customer_id}`);
        setCustomer(r.data);
      } catch (e) {
        setCustomer({ name: "Unknown customer (deleted)" });
      }
      const p = await api.get("/payments", { params: { invoice_id: id } });
      setPayments(p.data);
    } catch (err) {
      setLoadError(formatApiErrorDetail(err.response?.data?.detail) || "Invoice not found.");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const downloadPdf = async () => {
    try {
      const res = await api.get(`/invoices/${id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoice.invoice_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error("Failed to download PDF");
    }
  };

  const openPaymentDialog = () => {
    setForm({ ...emptyPayment, amount: invoice.due_amount > 0 ? invoice.due_amount : "" });
    setDialogOpen(true);
  };

  const duplicateInvoice = async () => {
    try {
      const { data } = await api.post(`/invoices/${id}/duplicate`);
      toast.success(`Duplicated as ${data.invoice_number}`);
      navigate(`/invoices/${data.id}/edit`);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const savePayment = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/payments", {
        customer_id: invoice.customer_id,
        invoice_id: invoice.id,
        payment_date: form.payment_date,
        amount: Number(form.amount),
        method: form.method,
        reference_number: form.reference_number,
        notes: form.notes,
      });
      toast.success("Payment recorded");
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="max-w-lg space-y-4" data-testid="invoice-load-error">
        <p className="text-sm text-destructive">{loadError}</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/invoices")}>Back to Invoices</Button>
      </div>
    );
  }

  if (!invoice || !customer) {
    return <div className="text-sm text-muted-foreground">Loading invoice...</div>;
  }

  return (
    <div className="max-w-3xl space-y-6" data-testid="invoice-view-page">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/invoices")}>
          <ArrowLeft size={16} /> Back
        </Button>
        <div className="flex gap-2">
          {invoice.due_amount > 0 && invoice.status !== "cancelled" && (
            <Button variant="outline" className="gap-1.5" onClick={openPaymentDialog} data-testid="record-payment-button">
              <Plus size={16} /> Record Payment
            </Button>
          )}
          <Button variant="outline" className="gap-1.5" onClick={() => navigate(`/invoices/${id}/edit`)} data-testid="edit-invoice-button">
            <PencilSimple size={16} /> Edit
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={duplicateInvoice} data-testid="duplicate-invoice-button">
            <CopySimple size={16} /> Duplicate
          </Button>
          <Button className="gap-1.5" onClick={downloadPdf} data-testid="download-invoice-pdf-button">
            <DownloadSimple size={16} /> Download PDF
          </Button>
        </div>
      </div>

      <div className="print-page border border-border bg-card p-8">
        <div className="flex items-start justify-between border-b border-border pb-6">
          <div>
            <p className="font-heading text-lg font-bold tracking-tight text-primary">SANJU ANIMATIONS IT SOLUTIONS</p>
            <p className="text-xs text-muted-foreground">Digital Marketing &amp; Messaging Services</p>
          </div>
          <div className="text-right">
            <p className="font-heading text-2xl font-bold tracking-tight">INVOICE</p>
            <p className="text-sm text-muted-foreground" data-testid="invoice-number-display">#{invoice.invoice_number}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 py-6">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Billed To</p>
            <p className="mt-1 font-medium">{customer.name}</p>
            {customer.company_name && <p className="text-sm text-muted-foreground">{customer.company_name}</p>}
            {customer.address && <p className="text-sm text-muted-foreground">{customer.address}</p>}
          </div>
          <div className="text-right text-sm">
            <p><span className="text-muted-foreground">Date: </span>{formatDate(invoice.invoice_date)}</p>
            <p><span className="text-muted-foreground">Due: </span>{formatDate(invoice.due_date)}</p>
            <p className="mt-1"><StatusBadge status={invoice.status} testId="invoice-status-badge" /></p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Disc %</TableHead>
              <TableHead className="text-right">Tax %</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.items.map((it, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <p className="font-medium">{it.service_name}</p>
                  {it.description && <p className="text-xs text-muted-foreground">{it.description}</p>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{it.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(it.rate)}</TableCell>
                <TableCell className="text-right tabular-nums">{it.discount_percent}%</TableCell>
                <TableCell className="text-right tabular-nums">{it.tax_percent}%</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(it.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="ml-auto mt-4 w-64 space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(invoice.subtotal)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Discount</span><span className="tabular-nums">- {formatCurrency(invoice.discount_total)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Tax</span><span className="tabular-nums">+ {formatCurrency(invoice.tax_total)}</span></div>
          <div className="flex justify-between border-t border-border pt-1.5 font-heading text-lg font-bold">
            <span>Total</span><span className="tabular-nums" data-testid="invoice-total-display">{formatCurrency(invoice.total)}</span>
          </div>
          <div className="flex justify-between text-emerald-600"><span>Paid</span><span className="tabular-nums" data-testid="invoice-paid-display">{formatCurrency(invoice.paid_amount)}</span></div>
          <div className="flex justify-between font-bold text-amber-600"><span>Due</span><span className="tabular-nums" data-testid="invoice-due-display">{formatCurrency(invoice.due_amount)}</span></div>
        </div>

        {invoice.notes && (
          <div className="mt-6 border-t border-border pt-4 text-sm">
            <p className="font-semibold">Notes</p>
            <p className="text-muted-foreground">{invoice.notes}</p>
          </div>
        )}
        {invoice.payment_terms && (
          <div className="mt-4 text-sm">
            <p className="font-semibold">Payment Terms</p>
            <p className="text-muted-foreground">{invoice.payment_terms}</p>
          </div>
        )}
      </div>

      <div className="border border-border bg-card p-5 no-print">
        <h3 className="mb-3 font-heading text-sm font-bold tracking-tight">Payment History</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{formatDate(p.payment_date)}</TableCell>
                <TableCell>{METHOD_LABELS[p.method] || p.method}</TableCell>
                <TableCell>{p.reference_number || "-"}</TableCell>
                <TableCell className="text-right tabular-nums text-emerald-600">{formatCurrency(p.amount)}</TableCell>
              </TableRow>
            ))}
            {payments.length === 0 && <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">No payments recorded yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="payment-form-dialog">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <form onSubmit={savePayment} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Payment Date</Label>
                <DatePicker value={form.payment_date} onChange={(v) => setForm({ ...form, payment_date: v })} testId="payment-date-picker" />
              </div>
              <div className="space-y-1.5">
                <Label>Amount *</Label>
                <Input type="number" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid="payment-amount-input" />
              </div>
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                  <SelectTrigger data-testid="payment-method-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{METHOD_LABELS[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Reference Number</Label>
                <Input value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} data-testid="payment-reference-input" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="payment-notes-input" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving} data-testid="payment-save-button">{saving ? "Saving..." : "Save Payment"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
