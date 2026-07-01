"use client";

import { rescheduleTicketAction } from "@/app/actions/dashboard-actions";
import { updateProgramTaskWorkflowAction, updateTaskDetailsAction } from "@/app/actions/program-actions";
import { deleteTicketAction, duplicateTicketAction, updateTicketDetailsAction } from "@/app/actions/ticket-actions";
import type { ApiRecord } from "@/lib/api/_crud";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, type DragEvent, type ReactNode, useMemo, useState, useTransition } from "react";
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
function personName(people: ApiRecord[], id: string) { const person = people.find((row) => String(row.id) === id); return person ? text(person.nama) || text(person.name) || text(person.email) || id : id; }

type CalItem = { kind: "event" | "task" | "ticket"; row: ApiRecord };

const navBtn: CSSProperties = { minHeight: 28, padding: "4px 8px", border: "0.5px solid var(--border-md)", borderRadius: 6, background: "var(--white)", fontSize: 12, color: "var(--text)" };
const chipBase: CSSProperties = { display: "block", width: "100%", textAlign: "left", border: 0, padding: "2px 5px", borderRadius: 3, fontSize: 9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const overlay: CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 60 };
const modalCard: CSSProperties = { width: "min(560px,100%)", maxHeight: "90vh", overflowY: "auto", background: "var(--white)", borderRadius: 12, padding: 18, boxShadow: "0 20px 60px rgba(0,0,0,.25)" };
const inp: CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid var(--border-md)", borderRadius: 8, fontSize: 13, background: "var(--white)", color: "var(--text)" };
const twoCol: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
const primaryBtn: CSSProperties = { padding: "8px 14px", border: 0, borderRadius: 8, background: "var(--purple-mid)", color: "#fff", fontSize: 12, fontWeight: 600 };
const ghostBtn: CSSProperties = { padding: "8px 14px", border: "1px solid var(--border-md)", borderRadius: 8, background: "var(--white)", fontSize: 12, color: "var(--text)" };
const dangerBtn: CSSProperties = { padding: "8px 12px", border: "1px solid var(--red)", borderRadius: 8, background: "var(--white)", color: "var(--red)", fontSize: 12 };
const iconBtn: CSSProperties = { border: 0, background: "transparent", fontSize: 16, color: "var(--text-muted)", cursor: "pointer" };
const chipTag: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 20, background: "var(--purple-light)", color: "var(--purple-mid)", fontSize: 11, fontWeight: 500 };
const chipX: CSSProperties = { border: 0, background: "transparent", color: "var(--purple-mid)", cursor: "pointer", fontSize: 13, lineHeight: 1 };
const panelCard: CSSProperties = { background: "var(--white)", border: "0.5px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16 };

function Legend({ color, label }: { color: string; label: string }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: color, display: "inline-block" }} />{label}</span>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label style={{ display: "block", marginBottom: 8 }}><span style={{ display: "block", fontSize: 10, color: "var(--text-muted)", marginBottom: 3 }}>{label}</span>{children}</label>;
}

function AssigneeField({ people, value, onChange }: { people: ApiRecord[]; value: string[]; onChange: (ids: string[]) => void }) {
  const available = people.filter((person) => !value.includes(String(person.id)));
  return (
    <Field label="Assignee">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
        {value.length ? value.map((id) => <span key={id} style={chipTag}>{personName(people, id)}<button type="button" onClick={() => onChange(value.filter((current) => current !== id))} style={chipX} aria-label="Hapus assignee">×</button></span>) : <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Belum ada assignee</span>}
      </div>
      <select value="" onChange={(event) => { if (event.target.value) onChange([...value, event.target.value]); }} style={inp}>
        <option value="">+ Tambah assignee…</option>
        {available.map((person) => <option key={String(person.id)} value={String(person.id)}>{text(person.nama) || text(person.name) || text(person.email)}</option>)}
      </select>
    </Field>
  );
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
    <div style={overlay} onClick={onClose} role="presentation">
      <div style={modalCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <strong style={{ fontSize: 14, display: "flex", gap: 6, alignItems: "center" }}><i className="ti ti-ticket" /> Detail Ticket</strong>
          <button type="button" onClick={onClose} style={iconBtn} aria-label="Tutup"><i className="ti ti-x" /></button>
        </div>
        {ticket.ticket_no ? <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>#{text(ticket.ticket_no)}</div> : null}
        <Field label="Judul Ticket"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inp} /></Field>
        <Field label="Deskripsi"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} style={inp} /></Field>
        <div style={twoCol}>
          <Field label="Status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={inp}>{["Todo", "In Progress", "Done"].map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Prioritas"><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} style={inp}>{["High", "Med", "Low"].map((s) => <option key={s}>{s}</option>)}</select></Field>
        </div>
        <div style={twoCol}>
          <Field label="Divisi"><select value={divisionId} onChange={(e) => setDivisionId(e.target.value)} style={inp}><option value="">—</option>{divisions.map((division) => <option key={String(division.id)} value={String(division.id)}>{text(division.nama) || text(division.name)}</option>)}</select></Field>
          <Field label="Deadline"><input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} style={inp} /></Field>
        </div>
        <AssigneeField people={people} value={assignees} onChange={setAssignees} />
        {error ? <p style={{ color: "var(--red)", fontSize: 11, margin: "4px 0" }}>{error}</p> : null}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={duplicate} disabled={busy} style={ghostBtn}><i className="ti ti-copy" /> Duplikat</button>
            <button type="button" onClick={remove} disabled={busy} style={dangerBtn}><i className="ti ti-trash" /> Hapus</button>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button type="button" onClick={onClose} style={ghostBtn}>Batal</button>
            <button type="button" onClick={save} disabled={busy} style={primaryBtn}>{busy ? "Menyimpan…" : "Simpan"}</button>
          </div>
        </div>
      </div>
    </div>
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
    <div style={overlay} onClick={onClose} role="presentation">
      <div style={modalCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <strong style={{ fontSize: 14, display: "flex", gap: 6, alignItems: "center" }}><i className="ti ti-checklist" /> Edit Task</strong>
          <button type="button" onClick={onClose} style={iconBtn} aria-label="Tutup"><i className="ti ti-x" /></button>
        </div>
        <Field label="Judul Task"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inp} /></Field>
        <Field label="Deskripsi"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} style={inp} /></Field>
        <div style={twoCol}>
          <Field label="Phase"><select value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })} style={inp}><option value="">—</option>{["Pre Event", "Hari H", "Post Event"].map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={inp}>{["Todo", "On Progress", "Done"].map((s) => <option key={s}>{s}</option>)}</select></Field>
        </div>
        <div style={twoCol}>
          <Field label="Priority"><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} style={inp}>{["High", "Med", "Low"].map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Deadline"><input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} style={inp} /></Field>
        </div>
        <AssigneeField people={people} value={assignees} onChange={setAssignees} />
        <div style={{ marginBottom: 8 }}>
          <span style={{ display: "block", fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>Attachments</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Belum ada attachment</span>
          <div style={{ marginTop: 8, padding: "8px 10px", background: "var(--blue-bg)", color: "var(--blue)", borderRadius: 8, fontSize: 11, display: "flex", gap: 6, alignItems: "flex-start" }}><i className="ti ti-info-circle" style={{ marginTop: 1 }} /><span>Upload file &amp; sinkron Google Calendar tersedia di halaman Program tasks.</span></div>
        </div>
        {error ? <p style={{ color: "var(--red)", fontSize: 11, margin: "4px 0" }}>{error}</p> : null}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 8, flexWrap: "wrap" }}>
          <Link href="/program/tasks" style={{ fontSize: 11, color: "var(--purple-mid)" }}>Buka di Program</Link>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button type="button" onClick={onClose} style={ghostBtn}>Batal</button>
            <button type="button" onClick={save} disabled={busy} style={primaryBtn}>{busy ? "Menyimpan…" : "Simpan"}</button>
          </div>
        </div>
      </div>
    </div>
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
