\"use client\";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { getCsrfToken } from "@/lib/api";

export default function UploadOldResultsPage() {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!isLoading && !isAuthenticated) {
    router.push("/admin/login");
    return null;
  }

  function onFileChange(f?: File | null) {
    setFile(f ?? null);
    setMessage(null);
  }

  async function doUpload() {
    if (!file) return setMessage("Please choose a CSV file first.");
    setUploading(true);
    setMessage(null);
    try {
      const text = await file.text();
      const csrf = getCsrfToken();
      const base = process.env.NEXT_PUBLIC_API_URL || "";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrf) headers["x-csrf-token"] = csrf;
      const res = await fetch(`${base}/api/admin/upload-old-results`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ csv: text, dryRun }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Upload failed");
      setMessage(`Done. processed=${data.processed}, errors=${data.errors?.length || 0}, dryRun=${data.dryRun}`);
    } catch (e: any) {
      setMessage(`Error: ${e?.message || String(e)}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Upload Old Results (CSV)</h1>

      <p className="mb-3 text-sm text-slate-400">
        Download the template, fill your rows, then upload. Required columns: <code>fullDateTime</code>, <code>resultNumber</code>.
      </p>

      <div className="mb-4 flex items-center gap-3">
        <a
          href="/upload-template.csv"
          download
          className="px-4 py-2 bg-slate-800 text-white rounded hover:opacity-90"
        >
          Download template
        </a>

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          className="px-2 py-1"
        />
      </div>

      <label className="flex items-center gap-2 mb-4">
        <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
        <span className="text-sm">Dry run (validate only, no DB writes)</span>
      </label>

      <div className="flex gap-2 mb-4">
        <button
          onClick={doUpload}
          disabled={!file || uploading}
          className="px-4 py-2 bg-amber-500 text-black rounded disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
        <button onClick={() => onFileChange(null)} className="px-3 py-2 border rounded">Clear</button>
      </div>

      {message && <div className="mt-4 p-3 bg-slate-800/60 rounded text-sm">{message}</div>}
      <p className="mt-4 text-xs text-slate-500">Endpoint: {process.env.NEXT_PUBLIC_API_URL || ""}/api/admin/upload-old-results</p>
    </div>
  );
}

