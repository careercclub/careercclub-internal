"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ApiRecord } from "@/lib/api/_crud";
import { useState } from "react";
import { useGoogleCalendarAction } from "./google-calendar-tool";

type Props = {
  ticket: ApiRecord;
  people: ApiRecord[];
  onClose: () => void;
  onSynced: (ticket: ApiRecord) => void;
};

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function dateKey(value: unknown) {
  const match = text(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] || "";
}

function jakartaToday() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function ticketAssigneeIds(ticket: ApiRecord) {
  if (Array.isArray(ticket.assigned_to_ids)) return ticket.assigned_to_ids.map(String);
  return ticket.assigned_to_id ? [String(ticket.assigned_to_id)] : [];
}

function personName(person: ApiRecord) {
  return text(person.nama) || text(person.name) || text(person.email);
}

export function TicketGoogleCalendarModal({ ticket, people, onClose, onSynced }: Props) {
  const today = jakartaToday();
  const [title, setTitle] = useState(text(ticket.title));
  const [description, setDescription] = useState(text(ticket.description));
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(dateKey(ticket.due_date) || today);
  const [specificTime, setSpecificTime] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [extraEmails, setExtraEmails] = useState<string[]>([]);
  const [validationError, setValidationError] = useState("");

  const assigneeIds = new Set(ticketAssigneeIds(ticket));
  const requesterId = text(ticket.requester_id || ticket.requesterId);
  const automaticGuests = people.filter((person) => {
    const id = String(person.id);
    return Boolean(person.email) && (assigneeIds.has(id) || id === requesterId);
  });
  const automaticEmails = new Set(automaticGuests.map((person) => text(person.email).toLowerCase()));
  const additionalPeople = people.filter((person) => {
    const email = text(person.email).toLowerCase();
    return email && !automaticEmails.has(email);
  });

  const { run, busy, message, clientId, configurationLoaded } = useGoogleCalendarAction((result) => {
    onSynced({
      ...ticket,
      gcal_added: true,
      gcal_event_id: result.id || ticket.gcal_event_id,
      gcal_event_url: result.url || ticket.gcal_event_url,
    });
    onClose();
  });

  function toggleExtra(email: string) {
    setExtraEmails((current) => current.includes(email)
      ? current.filter((value) => value !== email)
      : [...current, email]);
  }

  function submit() {
    setValidationError("");
    if (!title.trim() || !startDate || !endDate) {
      setValidationError("Judul dan tanggal event wajib diisi.");
      return;
    }

    const start = specificTime ? `${startDate}T${startTime}:00` : startDate;
    const end = specificTime ? `${endDate}T${endTime}:00` : endDate;
    const invalidRange = specificTime
      ? new Date(end) <= new Date(start)
      : endDate < startDate;
    if (invalidRange) {
      setValidationError("Waktu selesai harus setelah waktu mulai.");
      return;
    }

    run({
      ticketId: String(ticket.id),
      title: title.trim(),
      description: description.trim(),
      start,
      end,
      allDay: !specificTime,
      attendees: [
        ...automaticGuests.map((person) => text(person.email)),
        ...extraEmails,
      ],
    });
  }

  const synced = ticket.gcal_added === true || ticket.gcal_added === "true";
  const error = validationError || message;

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#E8F0FE] text-[#4285F4]">
              <i className="ti ti-brand-google text-lg" aria-hidden="true" />
            </span>
            <div>
              <DialogTitle>Tambah ke Google Calendar</DialogTitle>
              <DialogDescription>{specificTime ? "Event dengan waktu spesifik" : "All-day event"}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ticket-gcal-title">Judul event</Label>
            <Input id="ticket-gcal-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ticket-gcal-start-date">Tanggal mulai</Label>
              <Input id="ticket-gcal-start-date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ticket-gcal-end-date">Tanggal selesai</Label>
              <Input id="ticket-gcal-end-date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
          </div>

          {specificTime ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ticket-gcal-start-time">Jam mulai</Label>
                <Input id="ticket-gcal-start-time" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ticket-gcal-end-time">Jam selesai</Label>
                <Input id="ticket-gcal-end-time" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
              </div>
            </div>
          ) : null}

          <button
            aria-checked={specificTime}
            className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-left text-xs text-muted-foreground"
            onClick={() => setSpecificTime((current) => !current)}
            role="switch"
            type="button"
          >
            <span className="flex items-center gap-1.5"><i className="ti ti-clock text-sm" /> Tambah waktu spesifik</span>
            <span className={`relative h-[18px] w-8 rounded-full transition-colors ${specificTime ? "bg-[#0f52ba]" : "bg-border"}`}>
              <span className={`absolute top-0.5 size-3.5 rounded-full bg-white shadow-sm transition-all ${specificTime ? "left-4" : "left-0.5"}`} />
            </span>
          </button>

          <div className="grid gap-1.5">
            <Label htmlFor="ticket-gcal-description">Deskripsi</Label>
            <Textarea id="ticket-gcal-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>

          {automaticGuests.length ? (
            <section className="rounded-md bg-[var(--purple-light)] px-3 py-2.5">
              <h3 className="mb-1.5 text-[11px] font-semibold text-muted-foreground uppercase">Assignee &amp; requester</h3>
              <div className="grid gap-1">
                {automaticGuests.map((person) => (
                  <div className="flex items-center gap-1.5 text-xs" key={String(person.id)}>
                    <i className="ti ti-user-check text-[var(--purple-accent)]" aria-hidden="true" />
                    <span>{personName(person)} <span className="text-muted-foreground">({text(person.email)})</span></span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {additionalPeople.length ? (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-[11px] font-semibold text-muted-foreground uppercase">CC tambahan</legend>
              <div className="grid max-h-[120px] gap-1.5 overflow-y-auto pr-1">
                {additionalPeople.map((person) => {
                  const email = text(person.email);
                  return (
                    <label className="flex cursor-pointer items-center gap-2 text-xs" key={String(person.id)}>
                      <input checked={extraEmails.includes(email)} onChange={() => toggleExtra(email)} type="checkbox" />
                      <span>{personName(person)} <span className="text-muted-foreground">{email}</span></span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          {configurationLoaded && !clientId ? <p className="text-xs text-destructive">Google Calendar belum dikonfigurasi untuk aplikasi ini.</p> : null}
          {error ? <p className="text-xs text-destructive" role="status">{error}</p> : null}
        </div>

        <DialogFooter className="sm:justify-end">
          <Button disabled={busy} onClick={onClose} type="button" variant="ghost">Batal</Button>
          <Button disabled={busy || !configurationLoaded || !clientId} onClick={submit} type="button">
            <i className="ti ti-calendar-plus" aria-hidden="true" />
            {busy ? "Menghubungkan..." : synced ? "Sinkronkan Ulang" : "Buat Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
