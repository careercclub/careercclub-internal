"use client";

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

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const WEEKDAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const PHASE_COLORS: Record<string, { bg: string; fg: string }> = {
  "Pre Event": { bg: "#d1fae5", fg: "#059669" },
  "Hari H": { bg: "#fee2e2", fg: "#dc2626" },
  "Post Event": { bg: "#dbeafe", fg: "#2563eb" },
};
const DEFAULT_PHASE = { bg: "var(--amber-bg)", fg: "var(--amber)" };

function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
function localIso(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
// Task/ticket deadlines and event dates are calendar dates; in WIB (UTC+7) the
// local parts of a UTC-midnight Date resolve to the correct day.
function dateKey(value: unknown) { if (!value) return ""; return value instanceof Date ? localIso(value) : String(value).slice(0, 10); }

type CalItem = { kind: "event" | "task" | "ticket"; row: ApiRecord };

const navBtn: CSSProperties = { minHeight: 28, padding: "4px 8px", border: "0.5px solid var(--border-md)", borderRadius: 6, background: "var(--white)", fontSize: 12, color: "var(--text)" };
const chipBase: CSSProperties = { display: "block", width: "100%", textAlign: "left", border: 0, padding: "2px 5px", borderRadius: 3, fontSize: 9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const panelCard: CSSProperties = { background: "var(--white)", border: "0.5px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16 };

function Legend({ color, label }: { color: string; label: string }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: color, display: "inline-block" }} />{label}</span>;
}


function CalChip({ item, onOpen, onDragStart }: { item: CalItem; onOpen: () => void; onDragStart: (e: DragEvent) => void }) {
  const row = item.row;
  const title = text(row.title) || text(row.nama) || (item.kind === "ticket" ? "Ticket" : item.kind === "event" ? "Program" : "Task");
  if (item.kind === "event") {
    return <button type="button" onClick={onOpen} title={title} style={{ ...chipBase, background: "var(--purple-accent)", color: "#fff", cursor: "pointer" }}><i className="ti ti-broadcast" style={{ fontSize: 8 }} /> {title}</button>;
  }
  if (item.kind === "ticket") {
    return <button type="button" draggable onDragStart={onDragStart} onClick={onOpen} title={title} style={{ ...chipBase, background: "#ffedd5", color: "#c2410c", fontWeight: 500, cursor: "grab" }}><i className="ti ti-ticket" style={{ fontSize: 8 }} /> {title}</button>;
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
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan."); setBusy(false); }
  }
  async function remove() {
    if (!window.confirm("Hapus ticket ini?")) return;
    setBusy(true); setError("");
    try { await deleteTicketAction(String(ticket.id)); onDeleted(String(ticket.id)); } catch (e) { setError(e instanceof Error ? e.message : "Gagal menghapus."); setBusy(false); }
  }
  async function duplicate() {
    setBusy(true); setError("");
    try { await duplicateTicketAction(String(ticket.id)); router.refresh(); onClose(); } catch (e) { setError(e instanceof Error ? e.message : "Gagal menduplikat."); setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><i className="ti ti-ticket" /> Detail Ticket</DialogTitle>
          {ticket.ticket_no ? <DialogDescription>#{text(ticket.ticket_no)}</DialogDescription> : null}
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Judul Ticket</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Deskripsi</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Todo", "In Progress", "Done"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Prioritas</Label><Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["High", "Med", "Low"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Divisi</Label><Select value={divisionId || "none"} onValueChange={(v) => setDivisionId(v === "none" ? "" : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{divisions.map((d) => <SelectItem key={String(d.id)} value={String(d.id)}>{text(d.nama) || text(d.name)}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Deadline</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
          </div>
          <AssigneeField people={people} value={assignees} onChange={setAssignees} />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={duplicate} disabled={busy}><i className="ti ti-copy" /> Duplikat</Button>
            <Button type="button" variant="destructive" size="sm" onClick={remove} disabled={busy}><i className="ti ti-trash" /> Hapus</Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
            <Button type="button" onClick={save} disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</Button>
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
    if (!form.title.trim()) { setError("Judul task wajib diisi."); return; }
    setBusy(true); setError("");
    try {
      await updateTaskDetailsAction(String(task.id), { title: form.title, description: form.description, status: form.status, priority: form.priority, phase: form.phase || undefined, dueDate: form.dueDate || null, assigneeIds: assignees });
      onSaved({ ...task, ...form, due_date: form.dueDate, assignee_ids: assignees });
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan."); setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><i className="ti ti-checklist" /> Edit Task</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Judul Task</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Deskripsi</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Phase</Label><Select value={form.phase || "none"} onValueChange={(v) => setForm({ ...form, phase: v === "none" ? "" : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{["Pre Event", "Hari H", "Post Event"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Todo", "On Progress", "Done"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Priority</Label><Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["High", "Med", "Low"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Deadline</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
          </div>
          <AssigneeField people={people} value={assignees} onChange={setAssignees} />
          <div className="flex gap-2 rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground"><i className="ti ti-info-circle mt-0.5" /><span>Upload file &amp; sinkron Google Calendar tersedia di halaman <Link href="/program/tasks" className="text-primary underline">Program tasks</Link>.</span></div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="button" onClick={save} disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DashboardUpcoming({ tasks, tickets }: { tasks: ApiRecord[]; tickets: ApiRecord[] }) {
  const items = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const horizon = new Date(today); horizon.setDate(horizon.getDate() + 7);
    const startKey = localIso(today); const endKey = localIso(horizon);
    const collect = (rows: ApiRecord[], kind: string, href: string) => rows.filter((row) => text(row.status) !== "Done").map((row) => ({ id: String(row.id), title: text(row.title) || "Untitled", kind, date: dateKey(row.due_date), href })).filter((item) => item.date >= startKey && item.date <= endKey);
    return [...collect(tasks, "Task", "/program/tasks"), ...collect(tickets.filter((ticket) => !ticket.related_task_id), "Ticket", "/tickets")].sort((a, b) => a.date.localeCompare(b.date));
  }, [tasks, tickets]);
  return (
    <aside style={panelCard}>
      <header style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 13, fontWeight: 600 }}><i className="ti ti-clock" /> Upcoming Tasks</header>
      {items.length ? items.map((item, index) => (
        <Link href={item.href} key={`${item.kind}-${item.id}-${index}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 0", borderBottom: "0.5px solid var(--border)", color: "var(--text)" }}>
          <strong style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</strong>
          <span style={{ flexShrink: 0, color: "var(--text-muted)", fontSize: 11 }}>{item.kind} · {item.date}</span>
        </Link>
      )) : <div style={{ display: "grid", justifyItems: "center", gap: 8, padding: "28px 8px", color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}><i className="ti ti-checks" style={{ fontSize: 22 }} /><span>Tidak ada task dalam 7 hari</span></div>}
    </aside>
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
    const startWeekday = first.getDay();
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
      startTransition(async () => { try { await rescheduleTicketAction(id, date); } catch { setTicketRows(before); } });
    } else if (kind === "task") {
      const before = taskRows;
      setTaskRows((rows) => rows.map((row) => (String(row.id) === id ? { ...row, due_date: date } : row)));
      startTransition(async () => { try { await updateProgramTaskWorkflowAction(id, { dueDate: date }); } catch { setTaskRows(before); } });
    }
  }

  return (
    <div className={styles.dashboardOps}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, paddingBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button type="button" onClick={() => setMonthOffset((v) => v - 1)} style={navBtn} aria-label="Bulan sebelumnya"><i className="ti ti-chevron-left" /></button>
          <strong style={{ fontSize: 13, minWidth: 110, textAlign: "center" }}>{view.label}</strong>
          <button type="button" onClick={() => setMonthOffset((v) => v + 1)} style={navBtn} aria-label="Bulan berikutnya"><i className="ti ti-chevron-right" /></button>
          <button type="button" onClick={() => setMonthOffset(0)} style={{ ...navBtn, fontSize: 11 }}>Hari ini</button>
          {pending ? <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Menyimpan…</span> : null}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 10, color: "var(--text-muted)" }}>
          <Legend color="#059669" label="Pre" /><Legend color="#dc2626" label="H" /><Legend color="#2563eb" label="Post" /><Legend color="#c2410c" label="Ticket" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: "var(--bg)", border: "0.5px solid var(--border)", borderBottom: "none", borderRadius: "6px 6px 0 0" }}>
        {WEEKDAYS.map((d) => <div key={d} style={{ padding: "5px 2px", textAlign: "center", fontSize: 9, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>{d}</div>)}
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
              style={{ minHeight: 76, padding: "3px 3px 4px", borderRight: idx % 7 !== 6 ? "0.5px solid var(--border)" : "none", borderBottom: idx < view.cells.length - 7 ? "0.5px solid var(--border)" : "none", background: !cell.inMonth ? "#fafaf7" : isToday ? "var(--purple-light)" : isWeekend ? "#fafaf7" : "var(--white)", opacity: cell.inMonth ? 1 : 0.55, display: "flex", flexDirection: "column", gap: 2, overflow: "hidden" }}>
              <div style={{ fontSize: 10, fontWeight: isToday ? 700 : 500, color: isToday ? "var(--purple-mid)" : cell.inMonth ? "var(--text)" : "var(--text-hint)" }}>
                {cell.date.getDate()}{isToday ? <span style={{ fontSize: 8, marginLeft: 3, background: "var(--purple-accent)", color: "#fff", padding: "1px 4px", borderRadius: 6 }}>NOW</span> : null}
              </div>
              {visible.map((item) => <CalChip key={`${item.kind}-${item.row.id}`} item={item} onOpen={() => (item.kind === "event" ? router.push("/program") : setModal(item))} onDragStart={(e) => { if (item.kind !== "event") e.dataTransfer.setData("calendar-item", `${item.kind}:${item.row.id}`); }} />)}
              {items.length > 2 ? <button type="button" onClick={() => setExpanded((s) => ({ ...s, [key]: !open }))} style={{ fontSize: 8, color: "var(--purple-accent)", fontWeight: 600, textAlign: "left", background: "transparent", border: 0, padding: "1px 2px", cursor: "pointer" }}>{open ? "Sempit ▲" : `+${items.length - 2} lainnya ▼`}</button> : null}
            </div>
          );
        })}
      </div>
      {modal?.kind === "ticket" ? <TicketModal ticket={modal.row} people={people} divisions={divisions} onClose={() => setModal(null)} onSaved={(row) => { setTicketRows((rows) => rows.map((r) => (String(r.id) === String(row.id) ? row : r))); setModal(null); router.refresh(); }} onDeleted={(id) => { setTicketRows((rows) => rows.filter((r) => String(r.id) !== id)); setModal(null); router.refresh(); }} /> : null}
      {modal?.kind === "task" ? <TaskModal task={modal.row} people={people} onClose={() => setModal(null)} onSaved={(row) => { setTaskRows((rows) => rows.map((r) => (String(r.id) === String(row.id) ? row : r))); setModal(null); router.refresh(); }} /> : null}
    </div>
  );
}
