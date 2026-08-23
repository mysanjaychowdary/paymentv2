import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, MagnifyingGlass, Trash, WarningCircle, CopySimple } from "@phosphor-icons/react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency, formatDate, daysOverdue } from "@/lib/format";
import { INVOICE_STATUSES, STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function Invoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const load = () => {
    const params = {};
    if (search) params.search = search;
    if (status !== "all") params.status = status;
    api.get("/invoices", { params }).then((res) => setInvoices(res.data));
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  const remove = async (inv) => {
    try {
      await api.delete(`/invoices/${inv.id}`);
      toast.success("Invoice deleted");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const duplicate = async (inv) => {
    try {
      const { data } = await api.post(`/invoices/${inv.id}/duplicate`);
      toast.success(`Duplicated as ${data.invoice_number}`);
      navigate(`/invoices/${data.id}/edit`);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const overdueCount = invoices.filter((inv) => inv.status === "overdue").length;

  return (
    <div className="space-y-6" data-testid="invoices-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track billing, payments and dues.</p>
        </div>
        <Button asChild data-testid="new-invoice-button" className="gap-1.5">
          <Link to="/invoices/new">
            <Plus size={16} /> New Invoice
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search invoice # or customer..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="invoice-search-input" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44" data-testid="invoice-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {INVOICE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {overdueCount > 0 && (
        <div className="flex items-center gap-2 border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700" data-testid="overdue-banner">
          <WarningCircle size={18} weight="fill" />
          <span>
            <span className="font-semibold">{overdueCount} invoice{overdueCount > 1 ? "s" : ""}</span> overdue — follow up before it slips through.
          </span>
        </div>
      )}

      <div className="border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow
                key={inv.id}
                data-testid={`invoice-row-${inv.id}`}
                className={cn(inv.status === "overdue" && "border-l-2 border-l-red-500 bg-red-50/50 hover:bg-red-50")}
              >
                <TableCell><Link to={`/invoices/${inv.id}`} className="font-medium text-primary hover:underline">{inv.invoice_number}</Link></TableCell>
                <TableCell>{inv.customer_name}</TableCell>
                <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                <TableCell className={cn(inv.status === "overdue" && "font-semibold text-red-600")}>
                  {formatDate(inv.due_date)}
                  {inv.status === "overdue" && <span className="ml-1.5 text-xs">({daysOverdue(inv.due_date)}d late)</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(inv.total)}</TableCell>
                <TableCell className="text-right tabular-nums text-emerald-600">{formatCurrency(inv.paid_amount)}</TableCell>
                <TableCell className="text-right tabular-nums text-amber-600">{formatCurrency(inv.due_amount)}</TableCell>
                <TableCell><StatusBadge status={inv.status} /></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Duplicate" data-testid={`duplicate-invoice-${inv.id}`} onClick={() => duplicate(inv)}>
                    <CopySimple size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" data-testid={`delete-invoice-${inv.id}`} onClick={() => remove(inv)}>
                    <Trash size={16} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">No invoices found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
