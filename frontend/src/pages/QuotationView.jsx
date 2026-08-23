import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { DownloadSimple, PencilSimple, ArrowRight, ArrowLeft } from "@phosphor-icons/react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";

export default function QuotationView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quotation, setQuotation] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loadError, setLoadError] = useState("");

  const load = async () => {
    setLoadError("");
    try {
      const res = await api.get(`/quotations/${id}`);
      setQuotation(res.data);
      try {
        const r = await api.get(`/customers/${res.data.customer_id}`);
        setCustomer(r.data);
      } catch (e) {
        setCustomer({ name: "Unknown customer (deleted)" });
      }
    } catch (err) {
      setLoadError(formatApiErrorDetail(err.response?.data?.detail) || "Quotation not found.");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const downloadPdf = async () => {
    try {
      const res = await api.get(`/quotations/${id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${quotation.quotation_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error("Failed to download PDF");
    }
  };

  const convertToInvoice = async () => {
    try {
      const { data } = await api.post(`/quotations/${id}/convert-to-invoice`);
      toast.success(`Converted to invoice ${data.invoice_number}`);
      navigate(`/invoices/${data.id}`);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  if (loadError) {
    return (
      <div className="max-w-lg space-y-4" data-testid="quotation-load-error">
        <p className="text-sm text-destructive">{loadError}</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/quotations")}>Back to Quotations</Button>
      </div>
    );
  }

  if (!quotation || !customer) {
    return <div className="text-sm text-muted-foreground">Loading quotation...</div>;
  }

  return (
    <div className="max-w-3xl space-y-6" data-testid="quotation-view-page">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/quotations")}>
          <ArrowLeft size={16} /> Back
        </Button>
        <div className="flex gap-2">
          {quotation.status === "accepted" && !quotation.invoice_id && (
            <Button variant="outline" className="gap-1.5" onClick={convertToInvoice} data-testid="convert-to-invoice-button">
              <ArrowRight size={16} /> Convert to Invoice
            </Button>
          )}
          <Button variant="outline" className="gap-1.5" onClick={() => navigate(`/quotations/${id}/edit`)} data-testid="edit-quotation-button">
            <PencilSimple size={16} /> Edit
          </Button>
          <Button className="gap-1.5" onClick={downloadPdf} data-testid="download-quotation-pdf-button">
            <DownloadSimple size={16} /> Download PDF
          </Button>
        </div>
      </div>

      <div className="print-page border border-border bg-card p-8">
        <div className="flex items-start justify-between border-b border-border pb-6">
          <div>
            <p className="font-heading text-lg font-bold tracking-tight text-primary">SANJU ANIMATIONS IT SOLUTIONS</p>
            <p className="text-xs text-muted-foreground">Digital Marketing &amp; Messaging Services</p>
          </div>
          <div className="text-right">
            <p className="font-heading text-2xl font-bold tracking-tight">QUOTATION</p>
            <p className="text-sm text-muted-foreground" data-testid="quotation-number-display">#{quotation.quotation_number}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 py-6">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Quoted To</p>
            <p className="mt-1 font-medium">{customer.name}</p>
            {customer.company_name && <p className="text-sm text-muted-foreground">{customer.company_name}</p>}
            {customer.address && <p className="text-sm text-muted-foreground">{customer.address}</p>}
          </div>
          <div className="text-right text-sm">
            <p><span className="text-muted-foreground">Date: </span>{formatDate(quotation.date)}</p>
            <p><span className="text-muted-foreground">Valid Until: </span>{formatDate(quotation.valid_until)}</p>
            <p className="mt-1"><StatusBadge status={quotation.status} testId="quotation-status-badge" /></p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Disc %</TableHead>
              <TableHead className="text-right">Tax %</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotation.items.map((it, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <p className="font-medium">{it.service_name}</p>
                  {it.description && <p className="text-xs text-muted-foreground">{it.description}</p>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{it.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(it.rate)}</TableCell>
                <TableCell className="text-right tabular-nums">{it.discount_percent}%</TableCell>
                <TableCell className="text-right tabular-nums">{it.tax_percent}%</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(it.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="ml-auto mt-4 w-64 space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(quotation.subtotal)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Discount</span><span className="tabular-nums">- {formatCurrency(quotation.discount_total)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Tax</span><span className="tabular-nums">+ {formatCurrency(quotation.tax_total)}</span></div>
          <div className="flex justify-between border-t border-border pt-1.5 font-heading text-lg font-bold text-primary">
            <span>Total</span><span className="tabular-nums" data-testid="quotation-total-display">{formatCurrency(quotation.total)}</span>
          </div>
        </div>

        {quotation.notes && (
          <div className="mt-6 border-t border-border pt-4 text-sm">
            <p className="font-semibold">Notes</p>
            <p className="text-muted-foreground">{quotation.notes}</p>
          </div>
        )}
        {quotation.terms && (
          <div className="mt-4 text-sm">
            <p className="font-semibold">Terms &amp; Conditions</p>
            <p className="text-muted-foreground">{quotation.terms}</p>
          </div>
        )}
      </div>
    </div>
  );
}
