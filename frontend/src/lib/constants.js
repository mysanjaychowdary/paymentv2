export const QUOTATION_STATUSES = ["draft", "sent", "accepted", "rejected", "expired"];
export const INVOICE_STATUSES = ["draft", "sent", "partially_paid", "paid", "overdue", "cancelled"];
export const PAYMENT_METHODS = ["upi", "bank_transfer", "cash", "card", "other"];

export const STATUS_LABELS = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  partially_paid: "Partially Paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export const METHOD_LABELS = {
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  cash: "Cash",
  card: "Card",
  other: "Other",
};

export const STATUS_COLORS = {
  draft: "bg-zinc-100 text-zinc-600 border-zinc-300",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-zinc-100 text-zinc-500 border-zinc-300",
  expired: "bg-zinc-100 text-zinc-500 border-zinc-300",
  partially_paid: "bg-amber-50 text-amber-700 border-amber-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
};
