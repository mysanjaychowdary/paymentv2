import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UploadSimple, Trash, Buildings, Bank } from "@phosphor-icons/react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const emptyForm = {
  company_name: "",
  tagline: "",
  address: "",
  phone: "",
  email: "",
  gst_number: "",
  bank_name: "",
  account_name: "",
  account_number: "",
  ifsc_code: "",
  branch: "",
  default_quotation_terms: "",
  default_invoice_payment_terms: "",
};

export default function Settings() {
  const [form, setForm] = useState(emptyForm);
  const [logoUrl, setLogoUrl] = useState(null);
  const [hasLogo, setHasLogo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef(null);

  const loadLogo = async () => {
    try {
      const res = await api.get("/settings/logo", { responseType: "blob" });
      setLogoUrl(URL.createObjectURL(res.data));
      setHasLogo(true);
    } catch (err) {
      setLogoUrl(null);
      setHasLogo(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/settings");
      setForm({ ...emptyForm, ...data });
      await loadLogo();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/settings", form);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoFile = async (file) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) {
      toast.error("Please upload a PNG, JPG, WEBP or SVG image.");
      return;
    }
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post("/settings/logo", formData, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Logo updated");
      await loadLogo();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = async () => {
    try {
      await api.delete("/settings/logo");
      setLogoUrl(null);
      setHasLogo(false);
      toast.success("Logo removed");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="max-w-3xl space-y-6" data-testid="settings-page">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your company profile appears on generated invoice &amp; quotation PDFs.
        </p>
      </div>

      <form onSubmit={save} className="space-y-6">
        <div className="border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Buildings size={18} weight="duotone" className="text-primary" />
            <h2 className="font-heading text-base font-bold tracking-tight">Company Profile</h2>
          </div>

          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary">
              {logoUrl ? (
                <img src={logoUrl} alt="Company logo" className="h-full w-full object-contain" data-testid="settings-logo-preview" />
              ) : (
                <span className="font-heading text-xl font-bold text-primary">
                  {(form.company_name || "Y")[0].toUpperCase()}
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                data-testid="settings-logo-input"
                onChange={(e) => handleLogoFile(e.target.files?.[0])}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={uploadingLogo}
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="settings-logo-upload-button"
                >
                  <UploadSimple size={15} /> {uploadingLogo ? "Uploading..." : hasLogo ? "Replace Logo" : "Upload Logo"}
                </Button>
                {hasLogo && (
                  <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive" onClick={removeLogo} data-testid="settings-logo-remove-button">
                    <Trash size={15} /> Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">PNG, JPG, WEBP or SVG. Shown on invoice &amp; quotation PDFs.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Company Name</Label>
              <Input
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                data-testid="settings-company-name-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tagline</Label>
              <Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} data-testid="settings-tagline-input" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="settings-phone-input" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="settings-email-input" />
            </div>
            <div className="space-y-1.5">
              <Label>GSTIN</Label>
              <Input value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} data-testid="settings-gstin-input" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Address</Label>
              <Textarea
                rows={3}
                placeholder={"123, Business Park, 4th Floor,\nHyderabad, Telangana - 500081"}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                data-testid="settings-address-input"
              />
            </div>
          </div>
        </div>

        <div className="border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Bank size={18} weight="duotone" className="text-primary" />
            <h2 className="font-heading text-base font-bold tracking-tight">Bank Details</h2>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">Shown in the Payment Details section of invoice PDFs.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Bank Name</Label>
              <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} data-testid="settings-bank-name-input" />
            </div>
            <div className="space-y-1.5">
              <Label>Account Name</Label>
              <Input value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} data-testid="settings-account-name-input" />
            </div>
            <div className="space-y-1.5">
              <Label>Account Number</Label>
              <Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} data-testid="settings-account-number-input" />
            </div>
            <div className="space-y-1.5">
              <Label>IFSC Code</Label>
              <Input value={form.ifsc_code} onChange={(e) => setForm({ ...form, ifsc_code: e.target.value })} data-testid="settings-ifsc-input" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Branch</Label>
              <Input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} data-testid="settings-branch-input" />
            </div>
          </div>
        </div>

        <div className="border border-border bg-card p-6">
          <h2 className="mb-4 font-heading text-base font-bold tracking-tight">Default Document Text</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Default Quotation Terms &amp; Conditions</Label>
              <Textarea
                rows={4}
                value={form.default_quotation_terms}
                onChange={(e) => setForm({ ...form, default_quotation_terms: e.target.value })}
                data-testid="settings-quotation-terms-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Default Invoice Payment Terms</Label>
              <Textarea
                rows={4}
                value={form.default_invoice_payment_terms}
                onChange={(e) => setForm({ ...form, default_invoice_payment_terms: e.target.value })}
                data-testid="settings-invoice-terms-input"
              />
            </div>
          </div>
        </div>

        <Button type="submit" disabled={saving} data-testid="settings-save-button">
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </form>
    </div>
  );
}
