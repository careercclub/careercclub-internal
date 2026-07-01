"use client";

import { rescheduleTicketAction } from "@/app/actions/dashboard-actions";
import type { ApiRecord } from "@/lib/api/_crud";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import styles from "../record-manager.module.css";

function iso(date: Date) { return date.toISOString().slice(0, 10); }

export function DashboardCalendar({ tickets, tasks, events }: { tickets: ApiRecord[]; tasks: ApiRecord[]; events: ApiRecord[] }) {
  const [items, setItems] = useState(tickets);
  const [offset, setOffset] = useState(0);
  const [pending, startTransition] = useTransition();
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() + offset + index); return date; }), [offset]);
  function move(id: string, date: string) {
    const before = items;
    setItems((current) => current.map((ticket) => String(ticket.id) === id ? { ...ticket, due_date: date } : ticket));
    startTransition(async () => { try { await rescheduleTicketAction(id, date); } catch { setItems(before); } });
  }
  const upcomingTasks = tasks.filter((task) => task.status !== "Done").sort((a, b) => String(a.due_date || "9999").localeCompare(String(b.due_date || "9999"))).slice(0, 8);
  const upcomingEvents = events.filter((event) => String(event.status).toLowerCase() !== "done").sort((a, b) => String(a.tanggal || "9999").localeCompare(String(b.tanggal || "9999"))).slice(0, 5);
  return <div className={styles.dashboardOps}><div className={styles.calendarToolbar}><div><strong>Ticket deadline calendar</strong><span>Drag tickets to another day</span></div><div><button onClick={() => setOffset((value) => value - 7)} type="button"><i className="ti ti-chevron-left" /></button><button onClick={() => setOffset(0)} type="button">Today</button><button onClick={() => setOffset((value) => value + 7)} type="button"><i className="ti ti-chevron-right" /></button></div>{pending ? <span>Saving...</span> : null}</div><div className={styles.weekCalendar}>{days.map((date) => { const dateKey = iso(date); return <section key={dateKey} onDragOver={(event) => event.preventDefault()} onDrop={(event) => move(event.dataTransfer.getData("ticket-id"), dateKey)}><header><strong>{date.toLocaleDateString("en", { weekday: "short" })}</strong><span>{date.getDate()}</span></header>{items.filter((ticket) => String(ticket.due_date || "").slice(0, 10) === dateKey).map((ticket) => <Link draggable href={`/tickets#${ticket.id}`} key={String(ticket.id)} onDragStart={(event) => event.dataTransfer.setData("ticket-id", String(ticket.id))}>{String(ticket.title || "Untitled")}</Link>)}</section>; })}</div><div className={styles.dashboardLists}><section><header><strong>Upcoming tasks</strong><Link href="/program/tasks">View all</Link></header>{upcomingTasks.map((task) => <Link href="/program/tasks" key={String(task.id)}><strong>{String(task.title || "Untitled")}</strong><span>{String(task.due_date || "No deadline")}</span></Link>)}</section><section><header><strong>Upcoming programs</strong><Link href="/program">View all</Link></header>{upcomingEvents.map((event) => <Link href="/program" key={String(event.id)}><strong>{String(event.nama || "Untitled")}</strong><span>{String(event.tanggal || "No date")}</span></Link>)}</section></div></div>;
}
