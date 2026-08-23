import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerCombobox } from "@/components/shared/CustomerCombobox";
import { DatePicker } from "@/components/shared/DatePicker";
import { LineItemsEditor, emptyItem } from "@/components/shared/LineItemsEditor";
import { QUOTATION_STATUSES, STATUS_LABELS } from "@/lib/constants";

export default function QuotationForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [date, setDate] = useState(new Date().toISOString());
  const [validUntil, setValidUntil] = useState(null);
  const [items, setItems] = useState([emptyItem()]);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [status, setStatus] = useState("draft");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/customers").then((res) => setCustomers(res.data));
    api.get("/services").then((res) => setServices(res.data));
    if (!isEdit) {
      api.get("/settings").then((res) => {
        setTerms(res.data.default_quotation_terms || "Payment due within 15 days of acceptance.");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isEdit) {
      api.get(`/quotations/${id}`).then((res) => {
        const q = res.data;
        setCustomerId(q.customer_id);
        setDate(q.date);
        setValidUntil(q.valid_until);
        setItems(q.items.length ? q.items : [emptyItem()]);
        setNotes(q.notes || "");
        setTerms(q.terms || "");
        setStatus(q.status);
      });
    }
  }, [id, isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerId) {
      toast.error("Please select a customer");
      return;
    }
    setSaving(true);
    const payload = { customer_id: customerId, date, valid_until: validUntil, items, notes, terms, status };
    try {
      if (isEdit) {
        await api.put(`/quotations/${id}`, payload);
        toast.success("Quotation updated");
        navigate(`/quotations/${id}`);
      } else {
        const { data } = await api.post("/quotations", payload);
        toast.success("Quotation created");
        navigate(`/quotations/${data.id}`);
      }
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6" data-testid="quotation-form-page">
      <h1 className="font-heading text-3xl font-bold tracking-tight">{isEdit ? "Edit Quotation" : "New Quotation"}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 border border-border bg-card p-5 sm:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Customer *</Label>
            <CustomerCombobox customers={customers} value={customerId} onChange={setCustomerId} testId="quotation-customer-select" />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <DatePicker value={date} onChange={setDate} testId="quotation-date-picker" />
          </div>
          <div className="space-y-1.5">
            <Label>Valid Until</Label>
            <DatePicker value={validUntil} onChange={setValidUntil} testId="quotation-valid-until-picker" />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger data-testid="quotation-status-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {QUOTATION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <LineItemsEditor items={items} onChange={setItems} services={services} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="quotation-notes-input" rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Terms &amp; Conditions</Label>
            <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} data-testid="quotation-terms-input" rows={3} />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" disabled={saving} data-testid="quotation-save-button">
            {saving ? "Saving..." : "Save Quotation"}
          </Button>
        </div>
      </form>
    </div>
  );
}
