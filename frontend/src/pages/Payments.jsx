import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, MagnifyingGlass } from "@phosphor-icons/react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomerCombobox } from "@/components/shared/CustomerCombobox";
import { DatePicker } from "@/components/shared/DatePicker";
import { formatCurrency, formatDate } from "@/lib/format";
import { PAYMENT_METHODS, METHOD_LABELS } from "@/lib/constants";

const emptyForm = { customer_id: "", invoice_id: "", payment_date: new Date().toISOString(), amount: "", method: "upi", reference_number: "", notes: "" };

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/payments").then((res) => setPayments(res.data));

  useEffect(() => {
    load();
    api.get("/customers").then((res) => setCustomers(res.data));
  }, []);

  useEffect(() => {
    if (form.customer_id) {
      api.get("/invoices", { params: { customer_id: form.customer_id } }).then((res) => setInvoices(res.data));
    } else {
      setInvoices([]);
    }
  }, [form.customer_id]);

  const filtered = payments.filter((p) => !search || p.customer_name.toLowerCase().includes(search.toLowerCase()) || p.invoice_number.toLowerCase().includes(search.toLowerCase()));

  const openCreate = () => {
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.invoice_id) {
      toast.error("Please select an invoice");
      return;
    }
    setSaving(true);
    try {
      await api.post("/payments", { ...form, amount: Number(form.amount) });
      toast.success("Payment recorded");
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="payments-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Payments</h1>
          <p className="mt-1 text-sm text-muted-foreground">All payments received from customers.</p>
        </div>
        <Button onClick={openCreate} data-testid="add-payment-button" className="gap-1.5">
          <Plus size={16} /> Record Payment
        </Button>
      </div>

      <div className="relative max-w-sm">
        <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by customer or invoice #..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="payment-search-input" />
      </div>

      <div className="border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id} data-testid={`payment-row-${p.id}`}>
                <TableCell className="font-medium">{p.customer_name}</TableCell>
                <TableCell>{p.invoice_number}</TableCell>
                <TableCell>{formatDate(p.payment_date)}</TableCell>
                <TableCell>{METHOD_LABELS[p.method] || p.method}</TableCell>
                <TableCell>{p.reference_number || "-"}</TableCell>
                <TableCell className="text-right tabular-nums text-emerald-600">{formatCurrency(p.amount)}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No payments found.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="payment-form-dialog">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Customer *</Label>
              <CustomerCombobox customers={customers} value={form.customer_id} onChange={(v) => setForm({ ...form, customer_id: v, invoice_id: "" })} testId="payment-customer-select" />
            </div>
            <div className="space-y-1.5">
              <Label>Invoice *</Label>
              <Select value={form.invoice_id} onValueChange={(v) => setForm({ ...form, invoice_id: v })} disabled={!form.customer_id}>
                <SelectTrigger data-testid="payment-invoice-select"><SelectValue placeholder="Select invoice" /></SelectTrigger>
                <SelectContent>
                  {invoices.filter((i) => i.due_amount > 0).map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.invoice_number} — Due {formatCurrency(i.due_amount)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
