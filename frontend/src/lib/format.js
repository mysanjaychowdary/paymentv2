export function formatCurrency(amount) {
  const value = Number(amount || 0);
  return "₹" + value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatNumber(n) {
  return Number(n || 0).toLocaleString("en-IN");
}

export function formatDate(d) {
  if (!d) return "-";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function toInputDate(d) {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function daysOverdue(dueDate) {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const now = new Date();
  const diff = Math.floor((now - due) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

export function computeTotals(items) {
  let subtotal = 0;
  let discount_total = 0;
  let tax_total = 0;
  let total = 0;
  const computed = (items || []).map((it) => {
    const quantity = Number(it.quantity) || 0;
    const rate = Number(it.rate) || 0;
    const discount_percent = Number(it.discount_percent) || 0;
    const tax_percent = Number(it.tax_percent) || 0;
    const lineSubtotal = quantity * rate;
    const discountAmount = lineSubtotal * (discount_percent / 100);
    const taxable = lineSubtotal - discountAmount;
    const taxAmount = taxable * (tax_percent / 100);
    const amount = round2(taxable + taxAmount);
    subtotal += lineSubtotal;
    discount_total += discountAmount;
    tax_total += taxAmount;
    total += amount;
    return { ...it, amount };
  });
  return {
    items: computed,
    subtotal: round2(subtotal),
    discount_total: round2(discount_total),
    tax_total: round2(tax_total),
    total: round2(total),
  };
}
