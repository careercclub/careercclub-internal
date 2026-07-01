"use client";

import { createStoryPlanFromTextAction } from "@/app/actions/content-planning-actions";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "../record-manager.module.css";

type StoryDraft = { tanggal: string; status: string; items: Array<{ urutan: number; isi: string }> };

export function StoryPlanAiParser() {
  const router = useRouter();
  const [source, setSource] = useState("");
  const [draft, setDraft] = useState<StoryDraft>({ tanggal: "", status: "Draft", items: [] });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function parse() {
    setBusy(true); setMessage("Parsing...");
    try {
      const response = await fetch("/api/ai/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "story", text: source }) });
      const result = await response.json() as { data?: Partial<StoryDraft>; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error || "Story plan could not be parsed.");
      setDraft({ tanggal: String(result.data.tanggal || ""), status: result.data.status === "Done" ? "Done" : "Draft", items: Array.isArray(result.data.items) ? result.data.items.map((item, index) => ({ urutan: Number(item.urutan) || index + 1, isi: String(item.isi || "") })) : [] });
      setMessage("Parsed. Review the date and slide list before saving.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Story parsing failed."); }
    finally { setBusy(false); }
  }

  async function save() {
    setBusy(true); setMessage("");
    try { await createStoryPlanFromTextAction(draft); setDraft({ tanggal: "", status: "Draft", items: [] }); setSource(""); setMessage("Story plan saved."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Story plan could not be saved."); }
    finally { setBusy(false); }
  }

  return <details className={styles.createPanel}><summary><i className="ti ti-sparkles" /> Create Story plan from text</summary><div className={styles.toolStack}><label className={styles.field}><span>Story brief</span><textarea rows={5} value={source} onChange={(event) => setSource(event.target.value)} /></label><button className={styles.secondaryButton} disabled={busy || !source.trim()} onClick={parse} type="button">Parse with AI</button><div className={styles.formGrid}><label className={styles.field}><span>Date</span><input type="date" value={draft.tanggal} onChange={(event) => setDraft({ ...draft, tanggal: event.target.value })} /></label><label className={styles.field}><span>Status</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}><option>Draft</option><option>Done</option></select></label><label className={styles.field}><span>Slides, one per line</span><textarea value={draft.items.map((item) => item.isi).join("\n")} onChange={(event) => setDraft({ ...draft, items: event.target.value.split("\n").map((isi, index) => ({ urutan: index + 1, isi })) })} /></label><button className={styles.primaryButton} disabled={busy || !draft.tanggal || !draft.items.some((item) => item.isi.trim())} onClick={save} type="button">Save Story plan</button></div>{message ? <p className={styles.formMessage}>{message}</p> : null}</div></details>;
}
