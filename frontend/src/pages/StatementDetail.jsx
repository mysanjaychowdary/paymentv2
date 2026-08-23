import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Sparkle, MagnifyingGlass, Lightbulb } from "@phosphor-icons/react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/shared/StatCard";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const PALETTE = ["#EA580C", "#16A34A", "#D97706", "#DC2626", "#7C3AED", "#0891B2", "#DB2777", "#65A30D", "#2563EB", "#4338CA", "#0D9488", "#A16207"];

export default function StatementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [statement, setStatement] = useState(null);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api.get(`/statements/${id}`).then((res) => setStatement(res.data)).catch(() => setLoadError("Statement not found."));
  }, [id]);

  const filteredTransactions = useMemo(() => {
    if (!statement) return [];
    if (!search) return statement.transactions;
    const q = search.toLowerCase();
    return statement.transactions.filter((t) => t.description?.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q));
  }, [statement, search]);

  if (loadError) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{loadError}</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/statement-analyzer")}>Back</Button>
      </div>
    );
  }

  if (!statement) {
    return <div className="text-sm text-muted-foreground">Loading analysis...</div>;
  }

  return (
    <div className="max-w-5xl space-y-6" data-testid="statement-detail-page">
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/statement-analyzer")}>
        <ArrowLeft size={16} /> Back to Statement Analyzer
      </Button>

      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight" data-testid="statement-filename">{statement.filename}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {statement.period_start ? `${statement.period_start} → ${statement.period_end}` : "Period unknown"} · {statement.transaction_count} transactions
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard testId="statement-total-income" label="Total Income" value={formatCurrency(statement.total_income)} accent="text-emerald-600" />
        <StatCard testId="statement-total-expense" label="Total Expense" value={formatCurrency(statement.total_expense)} accent="text-amber-600" />
        <StatCard testId="statement-net" label="Net" value={formatCurrency(statement.net)} accent={statement.net >= 0 ? "text-emerald-600" : "text-red-600"} />
      </div>

      <div className="border border-border bg-card p-5">
        <h2 className="mb-2 flex items-center gap-2 font-heading text-sm font-bold tracking-tight">
          <Sparkle size={16} weight="duotone" className="text-primary" /> AI Summary
        </h2>
        <p className="text-sm text-muted-foreground" data-testid="statement-summary-text">{statement.summary}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="border border-border bg-card p-5" data-testid="statement-category-chart">
          <h2 className="mb-3 font-heading text-sm font-bold tracking-tight">Spending by Category</h2>
          {statement.category_breakdown?.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={statement.category_breakdown} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={95} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                  {statement.category_breakdown.map((entry, i) => (
                    <Cell key={entry.category} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No category data.</p>
          )}
        </div>

        <div className="border border-border bg-card p-5" data-testid="statement-recommendations">
          <h2 className="mb-3 flex items-center gap-2 font-heading text-sm font-bold tracking-tight">
            <Lightbulb size={16} weight="duotone" className="text-primary" /> Recommendations
          </h2>
          <ul className="space-y-3">
            {statement.recommendations?.map((r, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                <span className="text-muted-foreground">{r}</span>
              </li>
            ))}
            {(!statement.recommendations || statement.recommendations.length === 0) && (
              <p className="text-sm text-muted-foreground">No recommendations generated.</p>
            )}
          </ul>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold tracking-tight">Transactions</h2>
          <div className="relative w-64">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search description or category..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="statement-transaction-search" />
          </div>
        </div>
        <div className="border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((t, i) => (
                <TableRow key={i} data-testid={`statement-txn-row-${i}`}>
                  <TableCell>{formatDate(t.date)}</TableCell>
                  <TableCell className="max-w-xs truncate">{t.description}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-md border border-border bg-secondary px-2 py-0.5 text-xs font-medium">{t.category}</span>
                  </TableCell>
                  <TableCell className={cn("text-xs font-medium capitalize", t.type === "credit" ? "text-emerald-600" : "text-red-600")}>{t.type}</TableCell>
                  <TableCell className={cn("text-right tabular-nums font-medium", t.type === "credit" ? "text-emerald-600" : "text-red-600")}>
                    {t.type === "credit" ? "+" : "-"} {formatCurrency(t.amount)}
                  </TableCell>
                </TableRow>
              ))}
              {filteredTransactions.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No transactions match your search.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
