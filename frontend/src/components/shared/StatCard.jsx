import { cn } from "@/lib/utils";

export function StatCard({ label, value, sub, subClass, icon: Icon, testId, accent = "text-foreground" }) {
  return (
    <div
      data-testid={testId}
      className="group relative border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_2px_0_0_rgba(234,88,12,0.15)]"
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon ? <Icon size={18} weight="duotone" className="text-primary/70" /> : null}
      </div>
      <p className={cn("mt-3 font-heading text-2xl font-bold tabular-nums", accent)}>{value}</p>
      {sub ? <p className={cn("mt-1 text-xs tabular-nums", subClass || "text-muted-foreground")}>{sub}</p> : null}
    </div>
  );
}
