import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, MagnifyingGlass, PencilSimple, Trash } from "@phosphor-icons/react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomerCombobox } from "@/components/shared/CustomerCombobox";
import { DatePicker } from "@/components/shared/DatePicker";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

const emptyForm = { customer_id: "", date: new Date().toISOString(), provider: "", credits_purchased: "", amount_paid: "", reference_number: "", campaign_name: "", notes: "" };

export default function CreditPurchases() {
  const [purchases, setPurchases] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () => api.get("/credit-purchases").then((res) => setPurchases(res.data));

  useEffect(() => {
    load();
    api.get("/customers").then((res) => setCustomers(res.data));
  }, []);

  const filtered = purchases.filter((p) => !search || p.customer_name.toLowerCase().includes(search.toLowerCase()) || p.provider.toLowerCase().includes(search.toLowerCase()));
  const totalCredits = filtered.reduce((s, p) => s + p.credits_purchased, 0);
  const totalAmount = filtered.reduce((s, p) => s + p.amount_paid, 0);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ ...emptyForm, ...p });
    setDialogOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.customer_id) {
      toast.error("Please select a customer");
      return;
    }
    setSaving(true);
    const payload = { ...form, credits_purchased: Number(form.credits_purchased), amount_paid: Number(form.amount_paid) };
    try {
      if (editing) {
        await api.put(`/credit-purchases/${editing.id}`, payload);
        toast.success("Credit purchase updated");
      } else {
        await api.post("/credit-purchases", payload);
        toast.success("Credit purchase recorded");
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.delete(`/credit-purchases/${deleteTarget.id}`);
      toast.success("Deleted");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  return (
    <div className="space-y-6" data-testid="credit-purchases-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Credit Purchases</h1>
          <p className="mt-1 text-sm text-muted-foreground">WhatsApp / SMS credit purchase history per customer.</p>
        </div>
        <Button onClick={openCreate} data-testid="add-credit-purchase-button" className="gap-1.5">
          <Plus size={16} /> Add Purchase
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by customer or provider..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="credit-purchase-search-input" />
        </div>
        <div className="flex gap-4 text-sm" data-testid="credit-purchase-summary">
          <span className="text-muted-foreground">Purchases: <span className="font-semibold text-foreground tabular-nums">{filtered.length}</span></span>
          <span className="text-muted-foreground">Credits: <span className="font-semibold text-foreground tabular-nums">{formatNumber(totalCredits)}</span></span>
          <span className="text-muted-foreground">Spent: <span className="font-semibold text-foreground tabular-nums">{formatCurrency(totalAmount)}</span></span>
        </div>
      </div>

      <div className="border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead className="text-right">Credits</TableHead>
              <TableHead className="text-right">Amount Paid</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id} data-testid={`credit-purchase-row-${p.id}`}>
                <TableCell className="font-medium">{p.customer_name}</TableCell>
                <TableCell>{formatDate(p.date)}</TableCell>
                <TableCell>{p.provider}</TableCell>
                <TableCell>{p.campaign_name || "-"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(p.credits_purchased)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(p.amount_paid)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`edit-credit-purchase-${p.id}`} onClick={() => openEdit(p)}>
                    <PencilSimple size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" data-testid={`delete-credit-purchase-${p.id}`} onClick={() => setDeleteTarget(p)}>
                    <Trash size={16} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No credit purchases found.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="credit-purchase-form-dialog">
          <DialogHeader><DialogTitle>{editing ? "Edit Credit Purchase" : "Add Credit Purchase"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Customer *</Label>
              <CustomerCombobox customers={customers} value={form.customer_id} onChange={(v) => setForm({ ...form, customer_id: v })} testId="credit-purchase-customer-select" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <DatePicker value={form.date} onChange={(v) => setForm({ ...form, date: v })} testId="credit-purchase-date-picker" />
              </div>
              <div className="space-y-1.5">
                <Label>Provider *</Label>
                <Input required value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} data-testid="credit-purchase-provider-input" placeholder="e.g. Gupshup" />
              </div>
              <div className="space-y-1.5">
                <Label>Credits Purchased *</Label>
                <Input type="number" required value={form.credits_purchased} onChange={(e) => setForm({ ...form, credits_purchased: e.target.value })} data-testid="credit-purchase-credits-input" />
              </div>
              <div className="space-y-1.5">
                <Label>Amount Paid *</Label>
                <Input type="number" required value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: e.target.value })} data-testid="credit-purchase-amount-input" />
              </div>
              <div className="space-y-1.5">
                <Label>Reference Number</Label>
                <Input value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} data-testid="credit-purchase-reference-input" />
              </div>
              <div className="space-y-1.5">
                <Label>Campaign Name</Label>
                <Input value={form.campaign_name} onChange={(e) => setForm({ ...form, campaign_name: e.target.value })} data-testid="credit-purchase-campaign-input" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="credit-purchase-notes-input" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving} data-testid="credit-purchase-save-button">{saving ? "Saving..." : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent data-testid="credit-purchase-delete-dialog">
          <DialogHeader><DialogTitle>Delete this credit purchase record?</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={remove} data-testid="confirm-delete-credit-purchase">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
