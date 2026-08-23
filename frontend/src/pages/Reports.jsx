import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/shared/DatePicker";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { METHOD_LABELS } from "@/lib/constants";

function DateRangeFilter({ from, to, setFrom, setTo }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-44">
        <p className="mb-1 text-xs text-muted-foreground">From</p>
        <DatePicker value={from} onChange={setFrom} testId="report-date-from" />
      </div>
      <div className="w-44">
        <p className="mb-1 text-xs text-muted-foreground">To</p>
        <DatePicker value={to} onChange={setTo} testId="report-date-to" />
      </div>
    </div>
  );
}

function SalesReport() {
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [data, setData] = useState({ rows: [], total: 0 });

  useEffect(() => {
    const params = {};
    if (from) params.date_from = from.slice(0, 10);
    if (to) params.date_to = to.slice(0, 10);
    api.get("/reports/sales", { params }).then((res) => setData(res.data));
  }, [from, to]);

  return (
    <div className="space-y-4" data-testid="sales-report">
      <DateRangeFilter from={from} to={to} setFrom={setFrom} setTo={setTo} />
      <div className="border border-border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Invoice #</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.rows.map((r, i) => (
              <TableRow key={i}><TableCell>{r.customer}</TableCell><TableCell>{r.invoice_number}</TableCell><TableCell>{formatDate(r.date)}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(r.amount)}</TableCell></TableRow>
            ))}
            {data.rows.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No sales in this range.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <p className="text-right text-sm font-semibold tabular-nums">Total: {formatCurrency(data.total)}</p>
    </div>
  );
}

function PaymentsReport() {
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [data, setData] = useState({ rows: [], total: 0 });

  useEffect(() => {
    const params = {};
    if (from) params.date_from = from.slice(0, 10);
    if (to) params.date_to = to.slice(0, 10);
    api.get("/reports/payments", { params }).then((res) => setData(res.data));
  }, [from, to]);

  return (
    <div className="space-y-4" data-testid="payments-report">
      <DateRangeFilter from={from} to={to} setFrom={setFrom} setTo={setTo} />
      <div className="border border-border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Invoice #</TableHead><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.rows.map((r, i) => (
              <TableRow key={i}><TableCell>{r.customer}</TableCell><TableCell>{r.invoice_number}</TableCell><TableCell>{formatDate(r.date)}</TableCell><TableCell>{METHOD_LABELS[r.method] || r.method}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(r.amount)}</TableCell></TableRow>
            ))}
            {data.rows.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No payments in this range.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <p className="text-right text-sm font-semibold tabular-nums">Total: {formatCurrency(data.total)}</p>
    </div>
  );
}

function OutstandingReport() {
  const [data, setData] = useState({ rows: [], total_due: 0 });

  useEffect(() => {
    api.get("/reports/outstanding").then((res) => setData(res.data));
  }, []);

  return (
    <div className="space-y-4" data-testid="outstanding-report">
      <div className="border border-border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Invoice #</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Due</TableHead><TableHead>Due Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{r.customer}</TableCell><TableCell>{r.invoice_number}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(r.total)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(r.paid)}</TableCell>
                <TableCell className="text-right tabular-nums text-amber-600">{formatCurrency(r.due)}</TableCell>
                <TableCell>{formatDate(r.due_date)}</TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
              </TableRow>
            ))}
            {data.rows.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No outstanding invoices. 🎉</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <p className="text-right text-sm font-semibold tabular-nums">Total Due: {formatCurrency(data.total_due)}</p>
    </div>
  );
}

function CreditPurchaseReport() {
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [data, setData] = useState({ rows: [], total_credits: 0, total_amount: 0 });

  useEffect(() => {
    const params = {};
    if (from) params.date_from = from.slice(0, 10);
    if (to) params.date_to = to.slice(0, 10);
    api.get("/reports/credit-purchases", { params }).then((res) => setData(res.data));
  }, [from, to]);

  return (
    <div className="space-y-4" data-testid="credit-purchase-report">
      <DateRangeFilter from={from} to={to} setFrom={setFrom} setTo={setTo} />
      <div className="border border-border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead>Provider</TableHead><TableHead className="text-right">Credits</TableHead><TableHead className="text-right">Amount Paid</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.rows.map((r, i) => (
              <TableRow key={i}><TableCell>{r.customer}</TableCell><TableCell>{formatDate(r.date)}</TableCell><TableCell>{r.provider}</TableCell><TableCell className="text-right tabular-nums">{formatNumber(r.credits)}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(r.amount)}</TableCell></TableRow>
            ))}
            {data.rows.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No credit purchases in this range.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <p className="text-right text-sm font-semibold tabular-nums">Total: {formatNumber(data.total_credits)} credits · {formatCurrency(data.total_amount)}</p>
    </div>
  );
}

function MonthlyReport() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/reports/monthly", { params: { month, year } }).then((res) => setData(res.data));
  }, [month, year]);

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 3 + i);

  return (
    <div className="space-y-4" data-testid="monthly-report">
      <div className="flex gap-3">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-40" data-testid="monthly-report-month"><SelectValue /></SelectTrigger>
          <SelectContent>{months.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28" data-testid="monthly-report-year"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard testId="monthly-sales" label="Sales" value={formatCurrency(data.sales)} />
          <StatCard testId="monthly-payments" label="Payments Received" value={formatCurrency(data.payments_received)} accent="text-emerald-600" />
          <StatCard testId="monthly-outstanding" label="Outstanding" value={formatCurrency(data.outstanding)} accent="text-amber-600" />
          <StatCard testId="monthly-credit" label="Credit Purchases" value={formatCurrency(data.credit_purchase_amount)} sub={`${data.credit_purchase_count} purchase(s)`} />
        </div>
      )}
    </div>
  );
}

function ProfitReport() {
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    const params = {};
    if (from) params.date_from = from.slice(0, 10);
    if (to) params.date_to = to.slice(0, 10);
    api.get("/reports/profit", { params }).then((res) => setData(res.data));
  }, [from, to]);

  return (
    <div className="space-y-4" data-testid="profit-report">
      <DateRangeFilter from={from} to={to} setFrom={setFrom} setTo={setTo} />
      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard testId="profit-sales" label="Customer Sales" value={formatCurrency(data.sales)} />
          <StatCard testId="profit-cost" label="Credit Purchase Cost" value={formatCurrency(data.credit_purchase_cost)} accent="text-amber-600" />
          <StatCard testId="profit-gross" label="Estimated Gross Profit" value={formatCurrency(data.gross_profit)} accent="text-emerald-600" />
        </div>
      )}
    </div>
  );
}

export default function Reports() {
  return (
    <div className="space-y-6" data-testid="reports-page">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sales, payments, outstanding &amp; credit purchase insights.</p>
      </div>

      <Tabs defaultValue="sales">
        <TabsList className="flex-wrap">
          <TabsTrigger value="sales" data-testid="report-tab-sales">Sales</TabsTrigger>
          <TabsTrigger value="payments" data-testid="report-tab-payments">Payments</TabsTrigger>
          <TabsTrigger value="outstanding" data-testid="report-tab-outstanding">Outstanding</TabsTrigger>
          <TabsTrigger value="credit" data-testid="report-tab-credit">Credit Purchases</TabsTrigger>
          <TabsTrigger value="monthly" data-testid="report-tab-monthly">Monthly</TabsTrigger>
          <TabsTrigger value="profit" data-testid="report-tab-profit">Profit Overview</TabsTrigger>
        </TabsList>
        <TabsContent value="sales"><SalesReport /></TabsContent>
        <TabsContent value="payments"><PaymentsReport /></TabsContent>
        <TabsContent value="outstanding"><OutstandingReport /></TabsContent>
        <TabsContent value="credit"><CreditPurchaseReport /></TabsContent>
        <TabsContent value="monthly"><MonthlyReport /></TabsContent>
        <TabsContent value="profit"><ProfitReport /></TabsContent>
      </Tabs>
    </div>
  );
}
