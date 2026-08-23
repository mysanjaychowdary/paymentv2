import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  TrendUp,
  Receipt,
  Wallet,
  HourglassMedium,
  ChatCircleDots,
  CurrencyCircleDollar,
  CalendarBlank,
  ChartLineUp,
} from "@phosphor-icons/react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import api from "@/lib/api";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [trend, setTrend] = useState(null);

  useEffect(() => {
    api.get("/dashboard/summary").then((res) => setData(res.data));
    api.get("/dashboard/trend").then((res) => setTrend(res.data));
  }, []);

  if (!data) {
    return <div className="text-sm text-muted-foreground">Loading dashboard...</div>;
  }

  const monthName = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Overview of your business performance.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard testId="stat-total-sales" label="Total Sales" value={formatCurrency(data.total_sales)} icon={TrendUp} />
        <StatCard testId="stat-total-invoiced" label="Total Invoiced" value={formatCurrency(data.total_invoiced)} icon={Receipt} />
        <StatCard testId="stat-total-paid" label="Payment Received" value={formatCurrency(data.total_paid)} icon={Wallet} accent="text-emerald-600" />
        <StatCard testId="stat-total-due" label="Amount Due" value={formatCurrency(data.total_due)} icon={HourglassMedium} accent="text-amber-600" />
        <StatCard
          testId="stat-credit-purchases"
          label="Credit Purchases"
          value={formatNumber(data.total_credit_purchase_count)}
          sub="Total purchase records"
          icon={ChatCircleDots}
        />
        <StatCard testId="stat-credit-spend" label="Spent on Credits" value={formatCurrency(data.total_credit_spend)} icon={CurrencyCircleDollar} />
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-bold tracking-tight">
          <CalendarBlank size={18} weight="duotone" className="text-primary" /> This Month — {monthName}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard testId="stat-month-sales" label="Month Sales" value={formatCurrency(data.month_sales)} />
          <StatCard testId="stat-month-payments" label="Month Payments" value={formatCurrency(data.month_payments)} accent="text-emerald-600" />
          <StatCard
            testId="stat-month-credit"
            label="Month Credit Purchases"
            value={formatCurrency(data.month_credit_spend)}
            sub={`${data.month_credit_count} purchase(s)`}
          />
        </div>
      </div>

      <div className="border border-border bg-card p-5" data-testid="dashboard-trend-chart">
        <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-bold tracking-tight">
          <ChartLineUp size={18} weight="duotone" className="text-primary" /> Sales &amp; Payments Trend (Last 6 Months)
        </h2>
        {trend && trend.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#71717A" }} />
              <YAxis tick={{ fontSize: 12, fill: "#71717A" }} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
              <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 6, borderColor: "#E4E4E7", fontSize: 13 }} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Line type="monotone" dataKey="sales" name="Sales" stroke="#EA580C" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="payments" name="Payments" stroke="#16A34A" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Not enough data yet to show a trend.</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <RecentPanel
          title="Recent Invoices"
          testId="recent-invoices"
          emptyLabel="No invoices yet."
          items={data.recent_invoices}
          renderRow={(inv) => (
            <Link key={inv.id} to={`/invoices/${inv.id}`} className="flex items-center justify-between gap-2 border-b border-border py-2.5 text-sm last:border-0 hover:bg-secondary/50 -mx-2 px-2 rounded">
              <div className="min-w-0">
                <p className="truncate font-medium">{inv.invoice_number}</p>
                <p className="truncate text-xs text-muted-foreground">{inv.customer_name}</p>
              </div>
              <div className="text-right">
                <p className="tabular-nums font-medium">{formatCurrency(inv.total)}</p>
                <StatusBadge status={inv.status} />
              </div>
            </Link>
          )}
        />
        <RecentPanel
          title="Recent Payments"
          testId="recent-payments"
          emptyLabel="No payments yet."
          items={data.recent_payments}
          renderRow={(p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 border-b border-border py-2.5 text-sm last:border-0">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.customer_name}</p>
                <p className="truncate text-xs text-muted-foreground">{p.invoice_number} · {formatDate(p.payment_date)}</p>
              </div>
              <p className="tabular-nums font-medium text-emerald-600">{formatCurrency(p.amount)}</p>
            </div>
          )}
        />
        <RecentPanel
          title="Recent Credit Purchases"
          testId="recent-credit-purchases"
          emptyLabel="No credit purchases yet."
          items={data.recent_credit_purchases}
          renderRow={(c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 border-b border-border py-2.5 text-sm last:border-0">
              <div className="min-w-0">
                <p className="truncate font-medium">{c.customer_name}</p>
                <p className="truncate text-xs text-muted-foreground">{formatNumber(c.credits_purchased)} credits · {formatDate(c.date)}</p>
              </div>
              <p className="tabular-nums font-medium">{formatCurrency(c.amount_paid)}</p>
            </div>
          )}
        />
      </div>
    </div>
  );
}

function RecentPanel({ title, items, renderRow, emptyLabel, testId }) {
  return (
    <div className="border border-border bg-card p-5" data-testid={testId}>
      <h3 className="mb-2 font-heading text-sm font-bold tracking-tight">{title}</h3>
      {items && items.length > 0 ? items.map(renderRow) : <p className="py-4 text-sm text-muted-foreground">{emptyLabel}</p>}
    </div>
  );
}
