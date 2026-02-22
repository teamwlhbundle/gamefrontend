\"use client\";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { getCsrfToken } from "@/lib/api";

export default function UploadOldResultsPage() {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [isLoading, isAuthenticated, router]);

  function onFileChange(f?: File | null) {
    setFile(f ?? null);
    setPreview([]);
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const lines = text.split(/\\r?\\n/).filter(Boolean).slice(0, 10);
      const rows = lines.map((l) => l.split(",").map((c) => c.trim()));
      setPreview(rows);
    };
    reader.readAsText(f);
  }

  async function doUpload() {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const reader = new FileReader();
      const text = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file);
      });

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
      setMessage(`Success: ${JSON.stringify(data)}`);
    } catch (e: any) {
      setMessage(`Error: ${e?.message || String(e)}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Upload Old Results (CSV)</h1>

      <label className="block mb-2">
        <span className="text-sm">CSV columns: fullDateTime,resultNumber,gameId,gameName (ISO datetime preferred)</span>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          className="block mt-2"
        />
      </label>

      <label className="flex items-center gap-2 mb-3">
        <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
        <span className="text-sm">Dry run (validate only, no DB writes)</span>
      </label>

      {preview.length > 0 && (
        <div className="mb-3 overflow-auto border rounded">
          <table className="w-full text-sm">
            <tbody>
              {preview.map((row, i) => (
                <tr key={i} className="odd:bg-slate-800 even:bg-slate-900">
                  {row.map((cell, j) => (
                    <td key={j} className="px-2 py-1 border-r border-slate-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={doUpload}
          disabled={!file || uploading}
          className="px-4 py-2 bg-amber-500 text-black rounded disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
        <button onClick={() => onFileChange(null)} className="px-4 py-2 border rounded">
          Clear
        </button>
      </div>

      {message && <pre className="mt-4 whitespace-pre-wrap">{message}</pre>}

      <p className="mt-4 text-xs text-slate-400">
        Endpoint: {process.env.NEXT_PUBLIC_API_URL || ""}/api/admin/upload-old-results (credentials include, CSRF header)
      </p>
    </div>
  );
}

