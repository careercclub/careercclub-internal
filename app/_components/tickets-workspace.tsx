"use client";

import { revertWith } from "./safe-action";

import { addTicketLinkAction, changeTicketStatusAction, createTicketAction, deleteTicketAction, duplicateTicketAction, updateTicketDetailsAction } from "@/app/actions/ticket-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ApiRecord } from "@/lib/api/_crud";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, type ReactNode, useMemo, useState, useEffect } from "react";
import { AssigneeField, personName } from "./assignee-field";
import { GoogleCalendarScript } from "./google-calendar-tool";
import { TicketGoogleCalendarModal } from "./ticket-google-calendar-modal";
import { Pagination, usePagination } from "./ui-kit";
import { useRecordFocus } from "./use-record-focus";
import styles from "./tickets-workspace.module.css";
import { dueChip, groupTickets } from "@/lib/tickets/groups";
import { isDone, isOverdue, localIso } from "@/lib/dashboard/summary";
import { settingsHref } from "@/lib/records/links";
import { confirmAction } from "./app-dialog";
import { DateInput } from "./date-input";

const PRIORITIES = ["High", "Med", "Low"];

function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
function initials(name: string) { return name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase() || "?"; }
// jsonb columns written before the sql.json() fix hold a JSON *string* rather than an
// array — and the append path produced an array of such strings. Unwrap both so
// existing tickets keep rendering their links without a data migration.
function arr(value: unknown): Record<string, unknown>[] {
  if (typeof value === "string") { try { return arr(JSON.parse(value)); } catch { return []; } }
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => (typeof item === "string" ? arr(item) : item && typeof item === "object" ? [item as Record<string, unknown>] : []));
}
function calendarAdded(row: ApiRecord) { return row.gcal_added === true || row.gcal_added === "true"; }


function CreateTicketModal({ people, divisions, types, onClose, onCreated }: { people: ApiRecord[]; divisions: ApiRecord[]; types: ApiRecord[]; onClose: () => void; onCreated: (row: ApiRecord) => void }) {
  const [form, setForm] = useState({ title: "", description: "", priority: "Med", divisionId: "", typeId: "", dueDate: "" });
  const [assignees, setAssignees] = useState<string[]>([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (!form.title.trim()) { setError("Ticket title is required."); document.getElementById("create-ticket-title")?.focus(); return; }
    setBusy(true); setError("");
    try {
      const row = await createTicketAction({ title: form.title, description: form.description, status: "Todo", priority: form.priority, divisionId: form.divisionId || null, typeId: form.typeId || null, dueDate: form.dueDate || null, assignedToIds: assignees, links: linkUrl.trim() ? [{ label: "Link", url: linkUrl.trim() }] : [] });
      onCreated(row);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create the ticket."); setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><i className="ti ti-ticket" /> Create ticket</DialogTitle><DialogDescription>Send a request to a division or a specific person.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label htmlFor="create-ticket-title">Ticket title <span aria-hidden="true" className="text-[var(--red)]">*</span></Label><Input aria-invalid={Boolean(error) && !form.title.trim()} id="create-ticket-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. CCA flyer design" /></div>
          <div className="grid gap-1.5"><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Division</Label><Select value={form.divisionId || "none"} onValueChange={(v) => setForm({ ...form, divisionId: v === "none" ? "" : v })}><SelectTrigger><SelectValue placeholder="Select division" /></SelectTrigger><SelectContent><SelectItem value="none">Select division</SelectItem>{divisions.map((d) => <SelectItem key={String(d.id)} value={String(d.id)}>{text(d.nama)}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Request type</Label><Select value={form.typeId || "none"} onValueChange={(v) => setForm({ ...form, typeId: v === "none" ? "" : v })}><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{types.map((t) => <SelectItem key={String(t.id)} value={String(t.id)}>{text(t.nama)}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Priority</Label><Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Deadline</Label><DateInput as={Input} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
          </div>
          <AssigneeField people={people} value={assignees} onChange={setAssignees} />
          <div className="grid gap-1.5"><Label>Link <span className="font-normal text-muted-foreground">(optional)</span></Label><Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." /></div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter sticky className="sm:justify-end"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="button" onClick={submit} disabled={busy}>{busy ? "Saving…" : "Create ticket"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailTicketModal({ ticket, people, divisions, onClose, onSaved, onDeleted, onDuplicated, onCalendar }: { ticket: ApiRecord; people: ApiRecord[]; divisions: ApiRecord[]; onClose: () => void; onSaved: (row: ApiRecord) => void; onDeleted: (id: string) => void; onDuplicated: (row: ApiRecord) => void; onCalendar: () => void }) {
  const [form, setForm] = useState({ title: text(ticket.title), description: text(ticket.description), status: text(ticket.status) || "Todo", priority: text(ticket.priority) || "Med", dueDate: text(ticket.due_date).slice(0, 10) });
  const [divisionId, setDivisionId] = useState(text(ticket.divisi_id));
  const [assignees, setAssignees] = useState<string[]>(Array.isArray(ticket.assigned_to_ids) ? ticket.assigned_to_ids.map(String) : []);
  const [linkUrl, setLinkUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const links = arr(ticket.links);
  const synced = calendarAdded(ticket);
  async function save() {
    if (!form.title.trim()) { setError("Ticket title is required."); document.getElementById("edit-ticket-title")?.focus(); return; }
    setBusy(true); setError("");
    try {
      const updated = await updateTicketDetailsAction(String(ticket.id), { title: form.title, description: form.description, status: form.status, priority: form.priority, dueDate: form.dueDate || null, assignedToIds: assignees, divisionId: divisionId || null, typeId: ticket.type_id ?? null, cc: Array.isArray(ticket.cc) ? ticket.cc.join(",") : text(ticket.cc) });
      onSaved({ ...ticket, ...updated });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); } finally { setBusy(false); }
  }
  async function addLink() {
    const url = linkUrl.trim(); if (!url) return;
    setBusy(true); setError("");
    try { const fd = new FormData(); fd.set("url", url); fd.set("label", "Link"); await addTicketLinkAction(String(ticket.id), fd); onSaved({ ...ticket, links: [...links, { label: "Link", url }] }); setLinkUrl(""); } catch (e) { setError(e instanceof Error ? e.message : "Could not add the link."); } finally { setBusy(false); }
  }
  async function remove() { if (!(await confirmAction({ title: "Delete this ticket?", message: "This cannot be undone.", confirmLabel: "Delete ticket", danger: true }))) return; setBusy(true); setError(""); try { await deleteTicketAction(String(ticket.id)); onDeleted(String(ticket.id)); } catch (e) { setError(e instanceof Error ? e.message : "Could not delete."); setBusy(false); } }
  async function duplicate() { setBusy(true); setError(""); try { const row = await duplicateTicketAction(String(ticket.id)); onDuplicated(row); onClose(); } catch (e) { setError(e instanceof Error ? e.message : "Could not duplicate."); setBusy(false); } }
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><i className="ti ti-ticket" /> Ticket details</DialogTitle>{ticket.ticket_no ? <DialogDescription>#{text(ticket.ticket_no)}</DialogDescription> : null}</DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label htmlFor="edit-ticket-title">Ticket title <span aria-hidden="true" className="text-[var(--red)]">*</span></Label><Input aria-invalid={Boolean(error) && !form.title.trim()} id="edit-ticket-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Todo", "In Progress", "Done"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Priority</Label><Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Division</Label><Select value={divisionId || "none"} onValueChange={(v) => setDivisionId(v === "none" ? "" : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{divisions.map((d) => <SelectItem key={String(d.id)} value={String(d.id)}>{text(d.nama)}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Deadline</Label><DateInput as={Input} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
          </div>
          <AssigneeField people={people} value={assignees} onChange={setAssignees} />
          <div className="grid gap-1.5">
            <Label>Attachments &amp; links</Label>
            {links.map((link, index) => <a key={index} href={text(link.url)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-primary underline truncate"><i className="ti ti-link" /> {text(link.label) || text(link.url)}</a>)}
            <div className="flex gap-2"><Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." /><Button type="button" variant="outline" size="sm" onClick={addLink} disabled={busy || !linkUrl.trim()}>Add link</Button></div>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter sticky className="flex-row flex-wrap justify-between gap-2 sm:justify-between">
          <div className="flex gap-1.5"><Button aria-label={synced ? "Re-sync Google Calendar" : "Add to Google Calendar"} title={synced ? "Re-sync Google Calendar" : "Add to Google Calendar"} type="button" variant="outline" size="sm" onClick={onCalendar} disabled={busy} style={synced ? { background: "var(--green)", borderColor: "var(--green)", color: "#fff" } : undefined}><i aria-hidden="true" className={`ti ti-calendar-${synced ? "check" : "plus"}`} /><span className="hidden sm:inline">{synced ? "Re-sync Calendar" : "Google Calendar"}</span></Button><Button aria-label="Duplicate ticket" title="Duplicate ticket" type="button" variant="outline" size="sm" onClick={duplicate} disabled={busy}><i aria-hidden="true" className="ti ti-copy" /><span className="hidden sm:inline">Duplicate</span></Button><Button aria-label="Delete ticket" title="Delete ticket" type="button" variant="outline" size="sm" className="border-[var(--red)] text-[var(--red)] hover:bg-[var(--red-bg)]" onClick={remove} disabled={busy}><i aria-hidden="true" className="ti ti-trash" /><span className="hidden sm:inline">Delete</span></Button></div>
          <div className="flex gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="button" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save ticket"}</Button></div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TicketsWorkspace({ rows, people, divisions, types, aiPanel }: { rows: ApiRecord[]; people: ApiRecord[]; divisions: ApiRecord[]; types: ApiRecord[]; aiPanel: ReactNode }) {
  const router = useRouter();
  const [items, setItems] = useState(rows);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"open" | "done" | "all">("open");
  const [fDiv, setFDiv] = useState("");
  const [fPrio, setFPrio] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  // "Create ticket" on the Dashboard opens this same form (one way to create a ticket).
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("create") !== "ticket") return;
    url.searchParams.delete("create");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    const timer = window.setTimeout(() => setCreateOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const [calendarId, setCalendarId] = useState<string | null>(null);

  const personMap = useMemo(() => new Map(people.map((person) => [String(person.id), person])), [people]);
  const divisionMap = useMemo(() => new Map(divisions.map((division) => [String(division.id), division])), [divisions]);
  const divisionIndex = useMemo(() => new Map(divisions.map((division, index) => [String(division.id), index])), [divisions]);
  const typeMap = useMemo(() => new Map(types.map((type) => [String(type.id), type])), [types]);

  const today = localIso(new Date());
  const openCount = items.filter((row) => !isDone(row)).length;
  const doneCount = items.length - openCount;
  const lateCount = items.filter((row) => isOverdue(row, today)).length;
  const visible = items.filter((row) => {
    if (tab === "open" && isDone(row)) return false;
    if (tab === "done" && !isDone(row)) return false;
    if (query && !`${text(row.ticket_no)} ${text(row.title)} ${text(row.description)}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (fDiv && text(row.divisi_id) !== fDiv) return false;
    if (fPrio && text(row.priority) !== fPrio) return false;
    return true;
  });
  // Sorted by group first so pages follow the groups; the page is then shown grouped.
  const ordered = groupTickets(visible, today).flatMap((group) => group.rows);
  const { pageItems: visiblePage, page: ticketPage, setPage: setTicketPage, totalPages: ticketTotalPages } = usePagination(ordered, 20);
  const pageGroups = groupTickets(visiblePage, today);
  const detail = items.find((row) => String(row.id) === detailId) || null;
  useRecordFocus((id) => {
    if (!items.some((row) => String(row.id) === id)) return;
    setTab("all"); setQuery(""); setFDiv(""); setFPrio("");
    setDetailId(id);
    return true;
  });
  const calendarTicket = items.find((row) => String(row.id) === calendarId) || null;

  function firstAssignee(row: ApiRecord) {
    const ids = Array.isArray(row.assigned_to_ids) ? row.assigned_to_ids.map(String) : row.assigned_to_id ? [String(row.assigned_to_id)] : [];
    const person = ids.length ? personMap.get(ids[0]) : null;
    return person ? text(person.nama) || text(person.email) : "—";
  }
  async function toggleDone(row: ApiRecord) {
    const next = row.status === "Done" ? "Todo" : "Done";
    const before = items;
    setItems((current) => current.map((item) => String(item.id) === String(row.id) ? { ...item, status: next } : item));
    await changeTicketStatusAction(String(row.id), next).catch(revertWith(() => setItems(before), "Could not change the ticket status."));
  }

  return (
    <div className={styles.page}>
      <GoogleCalendarScript />
      <header className={styles.head}>
        <div>
          <span className={styles.eyebrow}>Internal</span>
          <h1>Tickets</h1>
          <p>{openCount} open{lateCount ? <> · <b className={styles.lateText}>{lateCount} late</b></> : null}</p>
        </div>
        <div className={styles.headActions}>
          <Link className={styles.ghostButton} href={settingsHref("tickets", "divisions")}><i className="ti ti-adjustments" aria-hidden="true" /> Ticket setup</Link>
          <Button type="button" onClick={() => setCreateOpen(true)}><i className="ti ti-plus" aria-hidden="true" /> Create ticket</Button>
        </div>
      </header>

      {aiPanel}

      <div className={styles.toolbar}>
        <div className={styles.segmented} role="tablist" aria-label="Ticket status">
          {([["open", "Open", openCount], ["done", "Done", doneCount], ["all", "All", items.length]] as const).map(([id, label, count]) => (
            <button aria-selected={tab === id} className={tab === id ? styles.segmentActive : styles.segment} key={id} onClick={() => setTab(id)} role="tab" type="button">{label} <span>{count}</span></button>
          ))}
        </div>
        <label className={styles.search}><i className="ti ti-search" aria-hidden="true" /><input aria-label="Search tickets" placeholder="Search tickets…" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        <label className={styles.filterPill}><span>Division</span><select aria-label="Filter division" value={fDiv} onChange={(e) => setFDiv(e.target.value)}><option value="">All</option>{divisions.map((d) => <option key={String(d.id)} value={String(d.id)}>{text(d.nama)}</option>)}</select></label>
        <label className={styles.filterPill}><span>Priority</span><select aria-label="Filter priority" value={fPrio} onChange={(e) => setFPrio(e.target.value)}><option value="">All</option>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
      </div>

      <section className={styles.panel} aria-label="Tickets">
        {visible.length === 0 ? (
          <div className={styles.empty}><i className="ti ti-inbox" aria-hidden="true" /><strong>No tickets found</strong><span>{query || fDiv || fPrio ? "Try another search or clear the filters." : tab === "open" ? "Nothing open. Click Create ticket to add one." : "No tickets here yet."}</span></div>
        ) : pageGroups.map((group) => (
          <div className={styles.group} key={group.id}>
            <h2 className={group.id === "late" ? styles.groupLate : styles.groupTitle}>{group.title} <span>{groupTickets(visible, today).find((g) => g.id === group.id)?.rows.length}</span></h2>
            <ul className={styles.rows}>
              {group.rows.map((row) => {
                const done = isDone(row);
                const division = divisionMap.get(text(row.divisi_id));
                const type = typeMap.get(text(row.type_id));
                const att = arr(row.files).length + arr(row.links).length;
                const synced = calendarAdded(row);
                const chip = dueChip(row, today);
                const assignee = firstAssignee(row);
                const title = text(row.title) || "Untitled ticket";
                return (
                  <li className={done ? styles.rowDone : styles.row} data-record-id={String(row.id)} key={String(row.id)}>
                    <button aria-label={done ? `Reopen ticket: ${title}` : `Mark ticket done: ${title}`} aria-pressed={done} className={done ? styles.checkOn : styles.check} onClick={() => void toggleDone(row)} type="button"><i className="ti ti-check" aria-hidden="true" /></button>
                    <button className={styles.rowMain} data-record-open onClick={() => setDetailId(String(row.id))} type="button">
                      <b>{title}</b>
                      <small>{[text(row.ticket_no), division ? text(division.nama) : "", type ? text(type.nama) : "", text(row.priority) === "High" ? "High priority" : ""].filter(Boolean).join(" · ")}{att ? <> · <i className="ti ti-paperclip" aria-hidden="true" />{att}</> : null}</small>
                    </button>
                    <span className={assignee === "—" ? styles.avatarEmpty : styles.avatar} title={assignee === "—" ? "No assignee" : assignee}>{assignee === "—" ? "?" : initials(assignee)}</span>
                    {chip ? <span className={chip.tone === "late" ? styles.chipLate : chip.tone === "soon" ? styles.chipSoon : styles.chip}>{chip.label}</span> : <span className={styles.chipNone}>No date</span>}
                    <button aria-label={synced ? `Re-sync ${title} to Google Calendar` : `Add ${title} to Google Calendar`} className={synced ? styles.calOn : styles.cal} onClick={() => setCalendarId(String(row.id))} title={synced ? "On Google Calendar (click to re-sync)" : "Add to Google Calendar"} type="button"><i className={`ti ti-calendar-${synced ? "check" : "plus"}`} aria-hidden="true" /></button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <Pagination onChange={setTicketPage} page={ticketPage} totalPages={ticketTotalPages} />
      </section>
      {createOpen ? <CreateTicketModal people={people} divisions={divisions} types={types} onClose={() => setCreateOpen(false)} onCreated={(row) => { setItems((current) => [row, ...current]); setCreateOpen(false); router.refresh(); }} /> : null}
      {detail ? <DetailTicketModal ticket={detail} people={people} divisions={divisions} onClose={() => setDetailId(null)} onSaved={(row) => { setItems((current) => current.map((item) => String(item.id) === String(row.id) ? row : item)); router.refresh(); }} onDeleted={(id) => { setItems((current) => current.filter((item) => String(item.id) !== id)); setDetailId(null); router.refresh(); }} onDuplicated={(row) => { setItems((current) => [row, ...current]); router.refresh(); }} onCalendar={() => { setCalendarId(String(detail.id)); setDetailId(null); }} /> : null}
      {calendarTicket ? <TicketGoogleCalendarModal key={String(calendarTicket.id)} ticket={calendarTicket} people={people} onClose={() => setCalendarId(null)} onSynced={(row) => { setItems((current) => current.map((item) => String(item.id) === String(row.id) ? row : item)); router.refresh(); }} /> : null}
    </div>
  );
}
