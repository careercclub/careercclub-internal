"use client";

import { revertWith } from "./safe-action";

import { rescheduleTicketAction } from "@/app/actions/dashboard-actions";
import { updateProgramTaskWorkflowAction, updateTaskDetailsAction } from "@/app/actions/program-actions";
import { deleteTicketAction, duplicateTicketAction, updateTicketDetailsAction } from "@/app/actions/ticket-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ApiRecord } from "@/lib/api/_crud";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, type DragEvent, useMemo, useState, useTransition } from "react";
import { AssigneeField, personName } from "./assignee-field";
import styles from "../record-manager.module.css";
import { confirmAction } from "./app-dialog";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// One palette: phases are shades of the brand blue (event day strongest). Red stays for danger.
// Stored phase values stay Indonesian ("Hari H"); PHASE_LABEL is display only.
const PHASE_COLORS: Record<string, { bg: string; fg: string }> = {
  "Pre Event": { bg: "var(--purple-light)", fg: "var(--purple-dark)" },
  "Hari H": { bg: "var(--purple-mid)", fg: "#fff" },
  "Post Event": { bg: "var(--surface-2)", fg: "var(--text)" },
};
const PHASE_LABEL: Record<string, string> = { "Pre Event": "Pre-event", "Hari H": "Event day", "Post Event": "Post-event" };
const DEFAULT_PHASE = { bg: "var(--surface-2)", fg: "var(--text-muted)" };

function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
function localIso(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
// Task/ticket deadlines and event dates are calendar dates; in WIB (UTC+7) the
// local parts of a UTC-midnight Date resolve to the correct day.
function dateKey(value: unknown) { if (!value) return ""; return value instanceof Date ? localIso(value) : String(value).slice(0, 10); }

type CalItem = { kind: "event" | "task" | "ticket"; row: ApiRecord };

const navBtn: CSSProperties = { minHeight: 28, padding: "4px 8px", border: "0.5px solid var(--border-md)", borderRadius: 6, background: "var(--white)", fontSize: 12, color: "var(--text)" };
const chipBase: CSSProperties = { display: "block", width: "100%", textAlign: "left", border: 0, padding: "2px 6px", borderRadius: 6, fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const panelCard: CSSProperties = { background: "var(--white)", border: "0.5px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16 };

function Legend({ color, label }: { color: string; label: string }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: color, boxShadow: "inset 0 0 0 1px var(--border)", display: "inline-block" }} />{label}</span>;
}


function CalChip({ item, onOpen, onDragStart }: { item: CalItem; onOpen: () => void; onDragStart: (e: DragEvent) => void }) {
  const row = item.row;
  const title = text(row.title) || text(row.nama) || (item.kind === "ticket" ? "Ticket" : item.kind === "event" ? "Program" : "Task");
  if (item.kind === "event") {
    return <button type="button" onClick={onOpen} title={title} style={{ ...chipBase, background: "var(--text)", color: "#fff", cursor: "pointer" }}><i className="ti ti-broadcast" style={{ fontSize: 10 }} /> {title}</button>;
  }
  if (item.kind === "ticket") {
    return <button type="button" draggable onDragStart={onDragStart} onClick={onOpen} title={title} style={{ ...chipBase, background: "var(--white)", color: "var(--text)", boxShadow: "inset 0 0 0 1px var(--border-md)", fontWeight: 500, cursor: "grab" }}><i className="ti ti-ticket" style={{ fontSize: 10 }} /> {title}</button>;
  }
  const done = text(row.status) === "Done";
  const progress = text(row.status) === "On Progress";
  const color = PHASE_COLORS[text(row.phase)] || DEFAULT_PHASE;
  return <button type="button" draggable onDragStart={onDragStart} onClick={onOpen} title={title} style={{ ...chipBase, background: color.bg, color: color.fg, fontWeight: 500, cursor: "pointer", opacity: done ? 0.5 : 1, textDecoration: done ? "line-through" : "none", borderLeft: progress ? `2px solid ${color.fg}` : undefined }}>{title}</button>;
}

function TicketModal({ ticket, people, divisions, onClose, onSaved, onDeleted }: { ticket: ApiRecord; people: ApiRecord[]; divisions: ApiRecord[]; onClose: () => void; onSaved: (row: ApiRecord) => void; onDeleted: (id: string) => void }) {
  const router = useRouter();
  const [form, setForm] = useState({ title: text(ticket.title), description: text(ticket.description), status: text(ticket.status) || "Todo", priority: text(ticket.priority) || "Med", dueDate: dateKey(ticket.due_date) });
  const [divisionId, setDivisionId] = useState(text(ticket.divisi_id));
  const [assignees, setAssignees] = useState<string[]>(Array.isArray(ticket.assigned_to_ids) ? ticket.assigned_to_ids.map(String) : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true); setError("");
    try {
      await updateTicketDetailsAction(String(ticket.id), {
        title: form.title, description: form.description, status: form.status, priority: form.priority, dueDate: form.dueDate || null,
        assignedToIds: assignees, divisionId: divisionId || null, typeId: ticket.type_id ?? null,
        cc: Array.isArray(ticket.cc) ? ticket.cc.join(",") : text(ticket.cc),
      });
      onSaved({ ...ticket, ...form, due_date: form.dueDate, divisi_id: divisionId, assigned_to_ids: assignees });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); setBusy(false); }
  }
  async function remove() {
    if (!(await confirmAction({ title: "Delete this ticket?", message: "This cannot be undone.", confirmLabel: "Delete ticket", danger: true }))) return;
    setBusy(true); setError("");
    try { await deleteTicketAction(String(ticket.id)); onDeleted(String(ticket.id)); } catch (e) { setError(e instanceof Error ? e.message : "Could not delete."); setBusy(false); }
  }
  async function duplicate() {
    setBusy(true); setError("");
    try { await duplicateTicketAction(String(ticket.id)); router.refresh(); onClose(); } catch (e) { setError(e instanceof Error ? e.message : "Could not duplicate."); setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><i className="ti ti-ticket" /> Ticket details</DialogTitle>
          {ticket.ticket_no ? <DialogDescription>#{text(ticket.ticket_no)}</DialogDescription> : null}
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Ticket title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Todo", "In Progress", "Done"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Priority</Label><Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["High", "Med", "Low"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Division</Label><Select value={divisionId || "none"} onValueChange={(v) => setDivisionId(v === "none" ? "" : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{divisions.map((d) => <SelectItem key={String(d.id)} value={String(d.id)}>{text(d.nama) || text(d.name)}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Deadline</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
          </div>
          <AssigneeField people={people} value={assignees} onChange={setAssignees} />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter sticky className="flex-row flex-wrap justify-between gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button aria-label="Duplicate ticket" title="Duplicate ticket" type="button" variant="outline" size="sm" onClick={duplicate} disabled={busy}><i aria-hidden="true" className="ti ti-copy" /><span className="hidden sm:inline">Duplicate</span></Button>
            <Button aria-label="Delete ticket" title="Delete ticket" type="button" variant="outline" size="sm" className="border-[var(--red)] text-[var(--red)] hover:bg-[var(--red-bg)]" onClick={remove} disabled={busy}><i aria-hidden="true" className="ti ti-trash" /><span className="hidden sm:inline">Delete</span></Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save ticket"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskModal({ task, people, onClose, onSaved }: { task: ApiRecord; people: ApiRecord[]; onClose: () => void; onSaved: (row: ApiRecord) => void }) {
  const [form, setForm] = useState({ title: text(task.title), description: text(task.description), status: text(task.status) || "Todo", priority: text(task.priority) || "Med", phase: text(task.phase), dueDate: dateKey(task.due_date) });
  const [assignees, setAssignees] = useState<string[]>(Array.isArray(task.assignee_ids) ? task.assignee_ids.map(String) : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (!form.title.trim()) { setError("Task title is required."); document.getElementById("calendar-task-title")?.focus(); return; }
    setBusy(true); setError("");
    try {
      await updateTaskDetailsAction(String(task.id), { title: form.title, description: form.description, status: form.status, priority: form.priority, phase: form.phase || undefined, dueDate: form.dueDate || null, assigneeIds: assignees });
      onSaved({ ...task, ...form, due_date: form.dueDate, assignee_ids: assignees });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><i className="ti ti-checklist" /> Edit task</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label htmlFor="calendar-task-title">Task title <span aria-hidden="true" className="text-[var(--red)]">*</span></Label><Input aria-invalid={Boolean(error) && !form.title.trim()} id="calendar-task-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Phase</Label><Select value={form.phase || "none"} onValueChange={(v) => setForm({ ...form, phase: v === "none" ? "" : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{["Pre Event", "Hari H", "Post Event"].map((s) => <SelectItem key={s} value={s}>{PHASE_LABEL[s]}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Todo", "On Progress", "Done"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Priority</Label><Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["High", "Med", "Low"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Deadline</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
          </div>
          <AssigneeField people={people} value={assignees} onChange={setAssignees} />
          <div className="flex gap-2 rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground"><i className="ti ti-info-circle mt-0.5" /><span>File uploads and Google Calendar sync are on the <Link href="/program/tasks" className="text-primary underline">Program tasks</Link>.</span></div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter sticky className="sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save task"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DashboardCalendar({ tickets, tasks, events, people = [], divisions = [], referenceDate }: { tickets: ApiRecord[]; tasks: ApiRecord[]; events: ApiRecord[]; people?: ApiRecord[]; divisions?: ApiRecord[]; referenceDate: string }) {
  const router = useRouter();
  const [taskRows, setTaskRows] = useState(tasks);
  const [ticketRows, setTicketRows] = useState(tickets);
  const [monthOffset, setMonthOffset] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<CalItem | null>(null);
  const [pending, startTransition] = useTransition();

  const view = useMemo(() => {
    const base = new Date(referenceDate);
    const first = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
    const y = first.getFullYear();
    const m = first.getMonth();
    const startWeekday = (first.getDay() + 6) % 7; // Monday first
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const total = Math.max(35, Math.ceil((startWeekday + daysInMonth) / 7) * 7);
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < startWeekday; i += 1) cells.push({ date: new Date(y, m, 1 - startWeekday + i), inMonth: false });
    for (let d = 1; d <= daysInMonth; d += 1) cells.push({ date: new Date(y, m, d), inMonth: true });
    for (let i = cells.length; i < total; i += 1) cells.push({ date: new Date(y, m + 1, i - startWeekday - daysInMonth + 1), inMonth: false });
    return { label: `${MONTHS[m]} ${y}`, cells };
  }, [referenceDate, monthOffset]);

  const byDate = useMemo(() => {
    const map: Record<string, CalItem[]> = {};
    const push = (key: string, item: CalItem) => { if (!key) return; (map[key] ||= []).push(item); };
    events.forEach((row) => push(dateKey(row.tanggal), { kind: "event", row }));
    taskRows.forEach((row) => push(dateKey(row.due_date), { kind: "task", row }));
    ticketRows.forEach((row) => { if (text(row.status) === "Done" || row.related_task_id) return; push(dateKey(row.due_date), { kind: "ticket", row }); });
    return map;
  }, [events, taskRows, ticketRows]);

  const todayKey = localIso(new Date());

  function reschedule(kind: string, id: string, date: string) {
    if (kind === "ticket") {
      const before = ticketRows;
      setTicketRows((rows) => rows.map((row) => (String(row.id) === id ? { ...row, due_date: date } : row)));
      startTransition(async () => { await rescheduleTicketAction(id, date).catch(revertWith(() => setTicketRows(before), "Could not move the ticket.")); });
    } else if (kind === "task") {
      const before = taskRows;
      setTaskRows((rows) => rows.map((row) => (String(row.id) === id ? { ...row, due_date: date } : row)));
      startTransition(async () => { await updateProgramTaskWorkflowAction(id, { dueDate: date }).catch(revertWith(() => setTaskRows(before), "Could not move the task.")); });
    }
  }

  return (
    <div className={styles.dashboardOps}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, paddingBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button type="button" onClick={() => setMonthOffset((v) => v - 1)} style={navBtn} aria-label="Previous month"><i className="ti ti-chevron-left" /></button>
          <strong style={{ fontSize: 15, minWidth: 130, textAlign: "center" }}>{view.label}</strong>
          <button type="button" onClick={() => setMonthOffset((v) => v + 1)} style={navBtn} aria-label="Next month"><i className="ti ti-chevron-right" /></button>
          <button type="button" onClick={() => setMonthOffset(0)} style={{ ...navBtn, fontSize: 12 }}>This month</button>
          {pending ? <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Saving…</span> : null}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", fontSize: 12, color: "var(--text-muted)" }}>
          <Legend color="var(--text)" label="Program" /><Legend color="var(--purple-light)" label="Pre-event" /><Legend color="var(--purple-mid)" label="Event day" /><Legend color="var(--surface-2)" label="Post-event" /><Legend color="var(--border-md)" label="Ticket" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: "var(--bg)", border: "0.5px solid var(--border)", borderBottom: "none", borderRadius: "6px 6px 0 0" }}>
        {WEEKDAYS.map((d) => <div key={d} style={{ padding: "6px 2px", textAlign: "center", fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", border: "0.5px solid var(--border)", borderTop: "none", borderRadius: "0 0 6px 6px", overflow: "hidden" }}>
        {view.cells.map((cell, idx) => {
          const key = localIso(cell.date);
          const items = byDate[key] || [];
          const isToday = key === todayKey;
          const isWeekend = cell.date.getDay() === 0 || cell.date.getDay() === 6;
          const open = expanded[key];
          const visible = open ? items : items.slice(0, 2);
          return (
            <div key={`${key}-${idx}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const [kind, id] = e.dataTransfer.getData("calendar-item").split(":"); if (id) reschedule(kind, id, key); }}
              style={{ minHeight: 76, padding: "3px 3px 4px", borderRight: idx % 7 !== 6 ? "0.5px solid var(--border)" : "none", borderBottom: idx < view.cells.length - 7 ? "0.5px solid var(--border)" : "none", background: !cell.inMonth ? "var(--surface-2)" : isToday ? "var(--purple-light)" : isWeekend ? "var(--surface-2)" : "var(--white)", opacity: cell.inMonth ? 1 : 0.55, display: "flex", flexDirection: "column", gap: 2, overflow: "hidden" }}>
              <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 600, color: isToday ? "var(--purple-mid)" : cell.inMonth ? "var(--text)" : "var(--text-hint)" }}>
                {cell.date.getDate()}{isToday ? <span style={{ fontSize: 11, marginLeft: 4, background: "var(--purple-mid)", color: "#fff", padding: "0 6px", borderRadius: 999 }}>Today</span> : null}
              </div>
              {visible.map((item) => <CalChip key={`${item.kind}-${item.row.id}`} item={item} onOpen={() => (item.kind === "event" ? router.push("/program") : setModal(item))} onDragStart={(e) => { if (item.kind !== "event") e.dataTransfer.setData("calendar-item", `${item.kind}:${item.row.id}`); }} />)}
              {items.length > 2 ? <button type="button" onClick={() => setExpanded((s) => ({ ...s, [key]: !open }))} style={{ fontSize: 11, color: "var(--purple-mid)", fontWeight: 700, textAlign: "left", background: "transparent", border: 0, padding: "1px 2px", cursor: "pointer" }}>{open ? "Show less" : `+${items.length - 2} more`}</button> : null}
            </div>
          );
        })}
      </div>
      {modal?.kind === "ticket" ? <TicketModal ticket={modal.row} people={people} divisions={divisions} onClose={() => setModal(null)} onSaved={(row) => { setTicketRows((rows) => rows.map((r) => (String(r.id) === String(row.id) ? row : r))); setModal(null); router.refresh(); }} onDeleted={(id) => { setTicketRows((rows) => rows.filter((r) => String(r.id) !== id)); setModal(null); router.refresh(); }} /> : null}
      {modal?.kind === "task" ? <TaskModal task={modal.row} people={people} onClose={() => setModal(null)} onSaved={(row) => { setTaskRows((rows) => rows.map((r) => (String(r.id) === String(row.id) ? row : r))); setModal(null); router.refresh(); }} /> : null}
    </div>
  );
}
