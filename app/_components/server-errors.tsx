"use client";

import { markErrorFixedAction } from "@/app/_actions/settings-actions";
import type { ServerErrorRow } from "@/lib/monitoring/errors";
import { formatDay } from "@/lib/text/date";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { notifyError } from "./app-dialog";
import { HelpTip } from "./ui-kit";
import s from "./settings-workspace.module.css";

const KIND: Record<string, string> = { page: "Page", api: "API", action: "Save", job: "Sync" };
const when = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : `${formatDay(date.toLocaleDateString("en-CA"))}, ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`; };

/** Settings → Errors (admins): unexpected server errors, one row per kind, newest first. */
export function ServerErrors({ errors }: { errors: ServerErrorRow[] | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  if (!errors) return <p className={s.hint}>Errors needs the database update from this release (migration 032). Run <code>npm run vps:rebuild</code> on the server.</p>;
  const open = errors.filter((row) => !row.fixed_at);
  async function fixed(id: string) {
    setBusy(id);
    try { await markErrorFixedAction(id); router.refresh(); } catch (error) { notifyError(error, "Could not mark it fixed."); } finally { setBusy(""); }
  }
  return (
    <div className={s.stack}>
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground"><strong>{open.length}</strong> open</p>
        <HelpTip label="About errors">Unexpected errors on the server: a page that failed to load, a save that broke, a sync that crashed. Messages a person can act on (like “Title is required”) are not listed. The same error is counted, not repeated. Emails and long numbers are hidden. Mark fixed once it is solved; it comes back if it happens again. Send the message to whoever maintains the app.</HelpTip>
      </div>
      {!errors.length ? <p className={s.hint}>No errors recorded.</p> : (
        <ul className="grid gap-2">
          {errors.map((row) => (
            <li className={`${s.card} grid gap-1 ${row.fixed_at ? "opacity-60" : ""}`} key={row.id}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                <b>{KIND[row.kind] || row.kind}</b><span className="text-muted-foreground">{row.place}</span>
                <span className="ml-auto text-muted-foreground">{row.count}× · last {when(row.last_at)}</span>
              </div>
              <code className="whitespace-pre-wrap break-words text-[12px]">{row.message}</code>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>First {when(row.first_at)}{row.fixed_at ? ` · fixed ${when(row.fixed_at)}` : ""}</span>
                {!row.fixed_at ? <button className={s.ghostSmall} disabled={busy === row.id} onClick={() => void fixed(row.id)} type="button">{busy === row.id ? "Saving…" : "Mark fixed"}</button> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
