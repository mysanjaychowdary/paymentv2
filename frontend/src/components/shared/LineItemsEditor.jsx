import { Plus, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { computeTotals, formatCurrency } from "@/lib/format";

const emptyItem = () => ({ service_id: null, service_name: "", description: "", hsn_sac: "", quantity: 1, rate: 0, discount_percent: 0, tax_percent: 0 });

export function LineItemsEditor({ items, onChange, services }) {
  const { items: computed, subtotal, discount_total, tax_total, total } = computeTotals(items);

  const updateItem = (idx, patch) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange(next);
  };

  const addRow = () => onChange([...items, emptyItem()]);
  const removeRow = (idx) => onChange(items.filter((_, i) => i !== idx));

  const applyServicePreset = (idx, serviceId) => {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc) return;
    updateItem(idx, { service_id: svc.id, service_name: svc.name, rate: svc.default_price, hsn_sac: svc.hsn_sac || "" });
  };

  return (
    <div className="space-y-3" data-testid="line-items-editor">
      <div className="overflow-x-auto border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[160px]">Service</TableHead>
              <TableHead className="min-w-[160px]">Description</TableHead>
              <TableHead className="w-24">HSN/SAC</TableHead>
              <TableHead className="w-24 text-right">Qty</TableHead>
              <TableHead className="w-28 text-right">Rate</TableHead>
              <TableHead className="w-24 text-right">Disc %</TableHead>
              <TableHead className="w-24 text-right">Tax %</TableHead>
              <TableHead className="w-28 text-right">Amount</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {computed.map((item, idx) => (
              <TableRow key={idx} data-testid={`line-item-row-${idx}`}>
                <TableCell>
                  <div className="space-y-1">
                    <Select onValueChange={(v) => applyServicePreset(idx, v)}>
                      <SelectTrigger className="h-8 text-xs" data-testid={`line-item-service-preset-${idx}`}>
                        <SelectValue placeholder="Quick fill..." />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={item.service_name}
                      placeholder="Service name"
                      data-testid={`line-item-name-${idx}`}
                      onChange={(e) => updateItem(idx, { service_name: e.target.value })}
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <Input
                    value={item.description || ""}
                    placeholder="Description"
                    data-testid={`line-item-description-${idx}`}
                    onChange={(e) => updateItem(idx, { description: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={item.hsn_sac || ""}
                    placeholder="HSN/SAC"
                    data-testid={`line-item-hsn-${idx}`}
                    onChange={(e) => updateItem(idx, { hsn_sac: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="text-right tabular-nums"
                    value={item.quantity}
                    data-testid={`line-item-qty-${idx}`}
                    onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="text-right tabular-nums"
                    value={item.rate}
                    data-testid={`line-item-rate-${idx}`}
                    onChange={(e) => updateItem(idx, { rate: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="text-right tabular-nums"
                    value={item.discount_percent}
                    data-testid={`line-item-discount-${idx}`}
                    onChange={(e) => updateItem(idx, { discount_percent: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="text-right tabular-nums"
                    value={item.tax_percent}
                    data-testid={`line-item-tax-${idx}`}
                    onChange={(e) => updateItem(idx, { tax_percent: e.target.value })}
                  />
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatCurrency(item.amount)}</TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    data-testid={`line-item-remove-${idx}`}
                    onClick={() => removeRow(idx)}
                  >
                    <Trash size={16} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {computed.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
                  No items added yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addRow} data-testid="add-line-item-button" className="gap-1.5">
        <Plus size={16} /> Add Item
      </Button>

      <div className="ml-auto w-full max-w-xs space-y-1.5 border border-border p-4 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span className="tabular-nums" data-testid="totals-subtotal">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Discount</span>
          <span className="tabular-nums" data-testid="totals-discount">- {formatCurrency(discount_total)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Tax</span>
          <span className="tabular-nums" data-testid="totals-tax">+ {formatCurrency(tax_total)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-1.5 font-heading text-base font-bold text-primary">
          <span>Total</span>
          <span className="tabular-nums" data-testid="totals-total">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}

export { emptyItem };
