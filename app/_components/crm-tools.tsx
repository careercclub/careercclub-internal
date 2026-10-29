"use client";

import { crmSummary, groupCustomers } from "@/lib/crm/view";
import type { ApiRecord } from "@/lib/api/_crud";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import s from "./email-blast.module.css";

type ImportResult = { added?: number; updated?: number; skipped?: number; warnings?: string[]; error?: string };

export function CrmTools({ rows }: { rows: ApiRecord[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  // Transactions, Converted and Talent Pool come from the same functions as the CRM header and
  // funnel (lib/crm/view.ts), so the two never show different numbers (Putaran 58).
  const stats = useMemo(() => {
    const summary = crmSummary(groupCustomers(rows));
    return {
      total: summary.transactions,
      pending: rows.filter((row) => String(row.payment_status || "").toUpperCase() === "PENDING").length,
      failed: rows.filter((row) => String(row.payment_status || "").toUpperCase() === "FAILED").length,
      converted: summary.funnel.converted,
      talent: summary.buyers - summary.notInPool,
    };
  }, [rows]);

  async function importFile(formData: FormData) {
    setBusy(true);
    setMessage("");
    try {
      const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
      if (!files.length) throw new Error("Select at least one CSV or XLSX file.");
      const total = { added: 0, updated: 0, skipped: 0, warnings: 0 };
      const done: string[] = [];
      for (const file of files) {
        const request = new FormData(); request.set("mode", String(formData.get("mode") || "new")); request.set("file", file);
        const response = await fetch("/api/crm/import", { method: "POST", body: request });
        const result = await response.json().catch(() => ({ error: "The server did not answer." })) as ImportResult;
        // Each file is saved on its own. Say which ones already went in, so a retry does not
        // import them twice (in "results" mode that would append the purchase history again).
        if (!response.ok) throw new Error(`${file.name}: ${result.error || "Import failed."}${done.length ? ` Already imported: ${done.join(", ")}. Leave those out if you retry.` : ""}`);
        done.push(file.name);
        total.added += result.added || 0; total.updated += result.updated || 0; total.skipped += result.skipped || 0; total.warnings += result.warnings?.length || 0;
      }
      setMessage(`Added ${total.added}, updated ${total.updated}, skipped ${total.skipped}.${total.warnings ? ` ${total.warnings} classification warning(s).` : ""}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ccc-crm-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={s.importGrid}>
      <section className={s.card} aria-labelledby="crm-import-title">
        <h3 id="crm-import-title"><i className="ti ti-file-import" aria-hidden="true" /> Import Lynkid transactions</h3>
        <form action={importFile} className={s.form}>
          <label className={s.field}><span>Import mode</span><select name="mode"><option value="new">New buyers (skip duplicate WhatsApp)</option><option value="results">Blast results (append purchase history)</option></select></label>
          <label className={s.field}><span>CSV or XLSX files <b className={s.req}>*</b></span><input accept=".csv,.xlsx" multiple name="files" type="file" required /></label>
          <button className={s.primary} disabled={busy} type="submit">{busy ? "Importing…" : "Import transactions"}</button>
          {message ? <p className={s.message} role="status">{message}</p> : null}
        </form>
      </section>
      <section className={s.card} aria-labelledby="crm-data-title">
        <h3 id="crm-data-title">Data health</h3>
        <dl className={s.health}>
          <div><dt>Transactions</dt><dd>{stats.total}</dd></div>
          <div><dt>Pending payment</dt><dd>{stats.pending}</dd></div>
          <div><dt>Failed payment</dt><dd className={stats.failed ? s.errorText : undefined}>{stats.failed}</dd></div>
          <div><dt>Converted buyers</dt><dd>{stats.converted}</dd></div>
          <div><dt>Buyers in Talent Pool</dt><dd>{stats.talent}</dd></div>
        </dl>
        <button className={s.ghost} type="button" onClick={exportJson}><i className="ti ti-download" aria-hidden="true" /> Export JSON</button>
      </section>
    </div>
  );
}
