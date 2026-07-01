"use client";

import { addTicketCommentAction, addTicketLinkAction, attachTicketFileAction, changeTicketStatusAction, duplicateTicketAction } from "@/app/actions/ticket-actions";
import type { ApiRecord } from "@/lib/api/_crud";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import styles from "../record-manager.module.css";

const statuses = ["Open", "In Review", "In Progress", "Done", "Rejected"] as const;
function array(value: unknown) { return Array.isArray(value) ? value as Array<Record<string, unknown>> : []; }
function escapeHtml(value: unknown) { return String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character); }

export function TicketTools({ rows, people }: { rows: ApiRecord[]; people: ApiRecord[] }) {
  const router = useRouter();
  const [items, setItems] = useState(rows);
  const [selectedId, setSelectedId] = useState(String(rows[0]?.id || ""));
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const selected = items.find((row) => String(row.id) === selectedId);
  const personMap = useMemo(() => new Map(people.map((person) => [String(person.id), person])), [people]);
  const visible = items.filter((row) => !query || `${row.ticket_no} ${row.title} ${row.description}`.toLowerCase().includes(query.toLowerCase()));

  function move(id: string, status: string) {
    const before = items;
    setItems((current) => current.map((row) => String(row.id) === id ? { ...row, status } : row));
    startTransition(async () => { try { await changeTicketStatusAction(id, status); } catch { setItems(before); } });
  }

  async function upload(file: File) {
    if (!selected) return;
    setMessage("Uploading attachment...");
    try {
      const signed = await fetch("/api/storage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ area: "task-attachments", filename: file.name, contentType: file.type || "application/pdf" }) });
      const result = await signed.json() as { key?: string; url?: string; error?: string };
      if (!signed.ok || !result.key || !result.url) throw new Error(result.error || "Upload could not be prepared.");
      const uploaded = await fetch(result.url, { method: "PUT", headers: { "Content-Type": file.type || "application/pdf" }, body: file });
      if (!uploaded.ok) throw new Error("R2 rejected the upload.");
      await attachTicketFileAction(String(selected.id), { name: file.name, key: result.key, type: file.type, size: file.size });
      setMessage("Attachment saved."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); }
  }

  async function sendEmail() {
    if (!selected) return;
    const ids = Array.isArray(selected.assigned_to_ids) ? selected.assigned_to_ids.map(String) : selected.assigned_to_id ? [String(selected.assigned_to_id)] : [];
    const recipients = ids.map((id) => personMap.get(id)?.email).filter(Boolean).map(String);
    if (!recipients.length) { setMessage("No assignee email is configured."); return; }
    const response = await fetch("/api/send-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: recipients, subject: `[${selected.ticket_no || "TICKET"}] ${selected.title}`, html: `<h2>${escapeHtml(selected.title)}</h2><p>${escapeHtml(selected.description)}</p><p>Status: ${escapeHtml(selected.status)}<br>Priority: ${escapeHtml(selected.priority)}<br>Due: ${escapeHtml(selected.due_date)}</p>` }) });
    const result = await response.json() as { sent?: number; error?: string };
    setMessage(response.ok ? `Email sent to ${result.sent || recipients.length} recipient(s).` : result.error || "Email failed.");
  }

  return <div className={styles.ticketWorkspace}><div className={styles.filterBar}><input placeholder="Search tickets" value={query} onChange={(event) => setQuery(event.target.value)} />{pending ? <span className={styles.formMessage}>Saving...</span> : null}</div><div className={styles.ticketBoard}>{statuses.map((status) => <section key={status}><header><strong>{status}</strong><span>{visible.filter((row) => String(row.status || "Open") === status).length}</span></header>{visible.filter((row) => String(row.status || "Open") === status).map((row) => <button className={String(row.id) === selectedId ? styles.ticketCardActive : styles.ticketCard} key={String(row.id)} onClick={() => setSelectedId(String(row.id))} type="button"><strong>{String(row.title || "Untitled")}</strong><span>{String(row.ticket_no || String(row.id).slice(0, 8))}</span><small>{String(row.due_date || "No deadline")}</small></button>)}</section>)}</div>{selected ? <aside className={styles.ticketDetail}><header><div><span>{String(selected.ticket_no || "Ticket")}</span><h3>{String(selected.title || "Untitled")}</h3></div><button onClick={() => startTransition(() => duplicateTicketAction(String(selected.id)))} type="button"><i className="ti ti-copy" /> Duplicate</button></header><p>{String(selected.description || "No description")}</p><div className={styles.ticketDetailGrid}><label className={styles.field}><span>Status</span><select value={String(selected.status || "Open")} onChange={(event) => move(String(selected.id), event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><div><span>Priority</span><strong>{String(selected.priority || "Med")}</strong></div><div><span>Deadline</span><strong>{String(selected.due_date || "-")}</strong></div><div><span>Assignees</span><strong>{(Array.isArray(selected.assigned_to_ids) ? selected.assigned_to_ids : [selected.assigned_to_id]).filter(Boolean).map((id) => String(personMap.get(String(id))?.nama || id)).join(", ") || "-"}</strong></div></div><div className={styles.ticketActions}><button onClick={sendEmail} type="button"><i className="ti ti-mail" /> Send email</button><label><i className="ti ti-paperclip" /> Attach file<input type="file" accept="image/*,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file); }} /></label></div>{message ? <p className={styles.formMessage}>{message}</p> : null}<details><summary>Links and comments</summary><div className={styles.ticketLists}>{array(selected.links).map((link, index) => <a href={String(link.url || "#")} key={index} target="_blank" rel="noreferrer">{String(link.label || link.url || "Link")}</a>)}{array(selected.komentar).map((comment, index) => <blockquote key={index}><strong>{String(comment.user || "User")}</strong><p>{String(comment.text || "")}</p><span>{String(comment.time || "")}</span></blockquote>)}</div><form action={addTicketLinkAction.bind(null, String(selected.id))} className={styles.inlineForm}><input name="label" placeholder="Link label" /><input name="url" placeholder="https://..." required /><button>Add link</button></form><form action={addTicketCommentAction.bind(null, String(selected.id))} className={styles.inlineForm}><textarea name="comment" placeholder="Add comment" required /><button>Add comment</button></form></details></aside> : null}</div>;
}
