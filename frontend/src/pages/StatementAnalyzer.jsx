import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { UploadSimple, FileCsv, FilePdf, FileXls, Trash, MagnifyingGlass, Sparkle } from "@phosphor-icons/react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  processing: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

function fileIcon(filename) {
  const ext = (filename || "").split(".").pop().toLowerCase();
  if (ext === "pdf") return FilePdf;
  if (ext === "csv") return FileCsv;
  return FileXls;
}

export default function StatementAnalyzer() {
  const navigate = useNavigate();
  const [statements, setStatements] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const load = () => api.get("/statements").then((res) => setStatements(res.data));

  useEffect(() => {
    load();
  }, []);

  const handleFile = async (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "csv", "xlsx", "xls"].includes(ext)) {
      toast.error("Please upload a PDF, CSV or Excel file.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/statements/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (data.status === "failed") {
        toast.error(data.error_message || "Could not analyze this statement.");
        load();
      } else {
        toast.success("Statement analyzed successfully");
        navigate(`/statement-analyzer/${data.id}`);
      }
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setUploading(false);
    }
  };

  const remove = async (s) => {
    try {
      await api.delete(`/statements/${s.id}`);
      toast.success("Statement removed");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  return (
    <div className="space-y-6" data-testid="statement-analyzer-page">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Statement Analyzer</h1>
        <p className="mt-1 text-sm text-muted-foreground">Upload a bank statement to auto-categorize spending and get AI recommendations.</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
        onClick={() => !uploading && fileInputRef.current?.click()}
        data-testid="statement-upload-dropzone"
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-12 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.csv,.xlsx,.xls"
          className="hidden"
          data-testid="statement-file-input"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {uploading ? (
          <>
            <Sparkle size={32} weight="duotone" className="animate-pulse text-primary" />
            <p className="font-medium">Analyzing your statement with AI...</p>
            <p className="text-xs text-muted-foreground">This can take up to a minute for larger statements.</p>
          </>
        ) : (
          <>
            <UploadSimple size={32} weight="duotone" className="text-primary" />
            <p className="font-medium">Drop your bank statement here, or click to browse</p>
            <p className="text-xs text-muted-foreground">Supports PDF, CSV, XLS and XLSX</p>
          </>
        )}
      </div>

      <div>
        <h2 className="mb-3 font-heading text-lg font-bold tracking-tight">History</h2>
        <div className="border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Income</TableHead>
                <TableHead className="text-right">Expense</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statements.map((s) => {
                const Icon = fileIcon(s.filename);
                return (
                  <TableRow key={s.id} data-testid={`statement-row-${s.id}`} className="cursor-pointer" onClick={() => s.status === "completed" && navigate(`/statement-analyzer/${s.id}`)}>
                    <TableCell className="flex items-center gap-2 font-medium"><Icon size={16} className="text-muted-foreground" /> {s.filename}</TableCell>
                    <TableCell>{formatDate(s.created_at)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.period_start ? `${s.period_start} → ${s.period_end}` : "-"}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">{formatCurrency(s.total_income)}</TableCell>
                    <TableCell className="text-right tabular-nums text-amber-600">{formatCurrency(s.total_expense)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums font-medium", s.net >= 0 ? "text-emerald-600" : "text-red-600")}>{formatCurrency(s.net)}</TableCell>
                    <TableCell>
                      <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold capitalize", STATUS_STYLES[s.status])}>{s.status}</span>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" data-testid={`delete-statement-${s.id}`} onClick={() => remove(s)}>
                        <Trash size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {statements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No statements uploaded yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
