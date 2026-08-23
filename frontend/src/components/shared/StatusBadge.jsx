import { cn } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";

export function StatusBadge({ status, testId }) {
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        STATUS_COLORS[status] || "bg-zinc-100 text-zinc-600 border-zinc-300"
      )}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}
