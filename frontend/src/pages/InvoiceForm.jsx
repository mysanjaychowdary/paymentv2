import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerCombobox } from "@/components/shared/CustomerCombobox";
import { DatePicker } from "@/components/shared/DatePicker";
import { LineItemsEditor, emptyItem } from "@/components/shared/LineItemsEditor";
import { INVOICE_STATUSES, STATUS_LABELS } from "@/lib/constants";

export default function InvoiceForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const location = useLocation();

  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [quotationId, setQuotationId] = useState(null);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString());
  const [dueDate, setDueDate] = useState(null);
  const [items, setItems] = useState([emptyItem()]);
  const [notes, setNotes] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Due within 15 days of invoice date.");
  const [status, setStatus] = useState("draft");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/customers").then((res) => setCustomers(res.data));
    api.get("/services").then((res) => setServices(res.data));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const prefillCustomer = params.get("customer_id");
    if (prefillCustomer && !isEdit) setCustomerId(prefillCustomer);
  }, [location.search, isEdit]);

  useEffect(() => {
    if (isEdit) {
      api.get(`/invoices/${id}`).then((res) => {
        const inv = res.data;
        setCustomerId(inv.customer_id);
        setQuotationId(inv.quotation_id);
        setInvoiceDate(inv.invoice_date);
        setDueDate(inv.due_date);
        setItems(inv.items.length ? inv.items : [emptyItem()]);
        setNotes(inv.notes || "");
        setPaymentTerms(inv.payment_terms || "");
        setStatus(inv.status);
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
    const payload = {
      customer_id: customerId,
      quotation_id: quotationId,
      invoice_date: invoiceDate,
      due_date: dueDate,
      items,
      notes,
      payment_terms: paymentTerms,
      status,
    };
    try {
      if (isEdit) {
        await api.put(`/invoices/${id}`, payload);
        toast.success("Invoice updated");
        navigate(`/invoices/${id}`);
      } else {
        const { data } = await api.post("/invoices", payload);
        toast.success("Invoice created");
        navigate(`/invoices/${data.id}`);
      }
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6" data-testid="invoice-form-page">
      <h1 className="font-heading text-3xl font-bold tracking-tight">{isEdit ? "Edit Invoice" : "New Invoice"}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 border border-border bg-card p-5 sm:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Customer *</Label>
            <CustomerCombobox customers={customers} value={customerId} onChange={setCustomerId} testId="invoice-customer-select" />
          </div>
          <div className="space-y-1.5">
            <Label>Invoice Date</Label>
            <DatePicker value={invoiceDate} onChange={setInvoiceDate} testId="invoice-date-picker" />
          </div>
          <div className="space-y-1.5">
            <Label>Due Date</Label>
            <DatePicker value={dueDate} onChange={setDueDate} testId="invoice-due-date-picker" />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger data-testid="invoice-status-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INVOICE_STATUSES.map((s) => (
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
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="invoice-notes-input" rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Payment Terms</Label>
            <Textarea value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} data-testid="invoice-payment-terms-input" rows={3} />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" disabled={saving} data-testid="invoice-save-button">
            {saving ? "Saving..." : "Save Invoice"}
          </Button>
        </div>
      </form>
    </div>
  );
}
