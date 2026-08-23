import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Buildings, Phone, EnvelopeSimple, MapPin, IdentificationCard } from "@phosphor-icons/react";
import api from "@/lib/api";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { METHOD_LABELS } from "@/lib/constants";

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState(null);

  useEffect(() => {
    api.get(`/customers/${id}`).then((res) => setCustomer(res.data));
    api.get(`/customers/${id}/summary`).then((res) => setSummary(res.data));
    api.get(`/customers/${id}/history`).then((res) => setHistory(res.data));
  }, [id]);

  if (!customer || !summary || !history) {
    return <div className="text-sm text-muted-foreground">Loading customer...</div>;
  }

  return (
    <div className="space-y-6" data-testid="customer-detail-page">
      <div className="border border-border bg-card p-6">
        <h1 className="font-heading text-2xl font-bold tracking-tight" data-testid="customer-detail-name">{customer.name}</h1>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-muted-foreground">
          {customer.company_name && <span className="flex items-center gap-1.5"><Buildings size={15} /> {customer.company_name}</span>}
          {customer.mobile && <span className="flex items-center gap-1.5"><Phone size={15} /> {customer.mobile}</span>}
          {customer.email && <span className="flex items-center gap-1.5"><EnvelopeSimple size={15} /> {customer.email}</span>}
          {customer.address && <span className="flex items-center gap-1.5"><MapPin size={15} /> {customer.address}</span>}
          {customer.gst_number && <span className="flex items-center gap-1.5"><IdentificationCard size={15} /> GSTIN: {customer.gst_number}</span>}
        </div>
        {customer.notes && <p className="mt-3 text-sm italic text-muted-foreground">{customer.notes}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard testId="customer-stat-sales" label="Sales" value={formatCurrency(summary.total_sales)} />
        <StatCard testId="customer-stat-paid" label="Payments Received" value={formatCurrency(summary.total_paid)} accent="text-emerald-600" />
        <StatCard testId="customer-stat-due" label="Due" value={formatCurrency(summary.total_due)} accent="text-amber-600" />
        <StatCard testId="customer-stat-credit-count" label="Credit Purchases" value={summary.credit_purchase_count} sub={`${formatNumber(summary.credit_purchase_credits)} credits`} />
        <StatCard testId="customer-stat-credit-cost" label="Credit Purchase Cost" value={formatCurrency(summary.credit_purchase_cost)} />
      </div>

      <Tabs defaultValue="invoices" data-testid="customer-history-tabs">
        <TabsList>
          <TabsTrigger value="invoices" data-testid="tab-invoices">Invoices</TabsTrigger>
          <TabsTrigger value="quotations" data-testid="tab-quotations">Quotations</TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-payments">Payments</TabsTrigger>
          <TabsTrigger value="credit-purchases" data-testid="tab-credit-purchases">Credit Purchases</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <div className="border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell><Link to={`/invoices/${inv.id}`} className="font-medium text-primary hover:underline">{inv.invoice_number}</Link></TableCell>
                    <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(inv.total)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(inv.paid_amount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(inv.due_amount)}</TableCell>
                    <TableCell><StatusBadge status={inv.status} /></TableCell>
                  </TableRow>
                ))}
                {history.invoices.length === 0 && <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">No invoices yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="quotations">
          <div className="border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quotation #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.quotations.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell><Link to={`/quotations/${q.id}`} className="font-medium text-primary hover:underline">{q.quotation_number}</Link></TableCell>
                    <TableCell>{formatDate(q.date)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(q.total)}</TableCell>
                    <TableCell><StatusBadge status={q.status} /></TableCell>
                  </TableRow>
                ))}
                {history.quotations.length === 0 && <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">No quotations yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <div className="border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.invoice_number}</TableCell>
                    <TableCell>{formatDate(p.payment_date)}</TableCell>
                    <TableCell>{METHOD_LABELS[p.method] || p.method}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">{formatCurrency(p.amount)}</TableCell>
                  </TableRow>
                ))}
                {history.payments.length === 0 && <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">No payments yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="credit-purchases">
          <div className="border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead className="text-right">Amount Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.credit_purchases.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{formatDate(c.date)}</TableCell>
                    <TableCell>{c.provider}</TableCell>
                    <TableCell>{c.campaign_name || "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(c.credits_purchased)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(c.amount_paid)}</TableCell>
                  </TableRow>
                ))}
                {history.credit_purchases.length === 0 && <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">No credit purchases yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
