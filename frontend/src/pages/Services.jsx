import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, PencilSimple, Trash } from "@phosphor-icons/react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";

const emptyForm = { name: "", description: "", default_price: "" };

export default function Services() {
  const [services, setServices] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/services").then((res) => setServices(res.data));

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({ ...emptyForm, ...s });
    setDialogOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, default_price: Number(form.default_price) || 0 };
    try {
      if (editing) {
        await api.put(`/services/${editing.id}`, payload);
        toast.success("Service updated");
      } else {
        await api.post("/services", payload);
        toast.success("Service added");
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s) => {
    try {
      await api.delete(`/services/${s.id}`);
      toast.success("Service deleted");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  return (
    <div className="space-y-6" data-testid="services-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Services</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your service catalog and default prices.</p>
        </div>
        <Button onClick={openCreate} data-testid="add-service-button" className="gap-1.5">
          <Plus size={16} /> Add Service
        </Button>
      </div>

      <div className="border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Default Price</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((s) => (
              <TableRow key={s.id} data-testid={`service-row-${s.id}`}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-muted-foreground">{s.description || "-"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(s.default_price)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`edit-service-${s.id}`} onClick={() => openEdit(s)}>
                    <PencilSimple size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" data-testid={`delete-service-${s.id}`} onClick={() => remove(s)}>
                    <Trash size={16} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {services.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No services yet. Add your first service.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="service-form-dialog">
          <DialogHeader><DialogTitle>{editing ? "Edit Service" : "Add Service"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="service-name-input" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="service-description-input" />
            </div>
            <div className="space-y-1.5">
              <Label>Default Price (₹)</Label>
              <Input type="number" value={form.default_price} onChange={(e) => setForm({ ...form, default_price: e.target.value })} data-testid="service-price-input" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving} data-testid="service-save-button">{saving ? "Saving..." : "Save Service"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
