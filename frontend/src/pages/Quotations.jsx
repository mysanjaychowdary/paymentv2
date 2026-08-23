import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, MagnifyingGlass, ArrowRight, Trash } from "@phosphor-icons/react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import { QUOTATION_STATUSES, STATUS_LABELS } from "@/lib/constants";

export default function Quotations() {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const load = () => {
    const params = {};
    if (search) params.search = search;
    if (status !== "all") params.status = status;
    api.get("/quotations", { params }).then((res) => setQuotations(res.data));
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  const convertToInvoice = async (q) => {
    try {
      const { data } = await api.post(`/quotations/${q.id}/convert-to-invoice`);
      toast.success(`Converted to invoice ${data.invoice_number}`);
      navigate(`/invoices/${data.id}`);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const remove = async (q) => {
    try {
      await api.delete(`/quotations/${q.id}`);
      toast.success("Quotation deleted");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  return (
    <div className="space-y-6" data-testid="quotations-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Quotations</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create and track customer quotations.</p>
        </div>
        <Button asChild data-testid="new-quotation-button" className="gap-1.5">
          <Link to="/quotations/new">
            <Plus size={16} /> New Quotation
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search quotation # or customer..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="quotation-search-input" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44" data-testid="quotation-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {QUOTATION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quotation #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Valid Until</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotations.map((q) => (
              <TableRow key={q.id} data-testid={`quotation-row-${q.id}`}>
                <TableCell><Link to={`/quotations/${q.id}`} className="font-medium text-primary hover:underline">{q.quotation_number}</Link></TableCell>
                <TableCell>{q.customer_name}</TableCell>
                <TableCell>{formatDate(q.date)}</TableCell>
                <TableCell>{formatDate(q.valid_until)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(q.total)}</TableCell>
                <TableCell><StatusBadge status={q.status} /></TableCell>
                <TableCell className="text-right">
                  {q.status === "accepted" && !q.invoice_id && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="Convert to invoice" data-testid={`convert-quotation-${q.id}`} onClick={() => convertToInvoice(q)}>
                      <ArrowRight size={16} />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" data-testid={`delete-quotation-${q.id}`} onClick={() => remove(q)}>
                    <Trash size={16} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {quotations.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No quotations found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
