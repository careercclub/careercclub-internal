"use client";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ApiRecord } from "@/lib/api/_crud";

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

export function personName(people: ApiRecord[], id: string) {
  const person = people.find((row) => String(row.id) === id);
  return person ? text(person.nama) || text(person.name) || text(person.email) || id : id;
}

// A person row without auth_user_id is not an application account — they can still
// be assigned (historical rows, external collaborators) but they can never open the
// board to see the ticket, so the picker says so rather than failing silently.
function hasAccount(person: ApiRecord) {
  return Boolean(person.auth_user_id);
}

// One picker for tickets, program tasks and the dashboard calendar. These were three
// byte-for-byte copies; keeping them separate meant "select everyone" would have
// landed in one modal and not the others.
export function AssigneeField({ people, value, onChange, label = "Assignee" }: {
  people: ApiRecord[];
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}) {
  const available = people.filter((person) => !value.includes(String(person.id)));
  const allIds = people.map((person) => String(person.id));

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <div className="flex gap-2">
          {available.length ? (
            <button type="button" onClick={() => onChange(allIds)} className="text-xs text-primary underline underline-offset-2">
              Pilih semua ({people.length})
            </button>
          ) : null}
          {value.length ? (
            <button type="button" onClick={() => onChange([])} className="text-xs text-muted-foreground underline underline-offset-2">
              Hapus semua
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {value.length ? value.map((id) => (
          <Badge key={id} variant="secondary" className="gap-1 pr-1">
            {personName(people, id)}
            <button type="button" onClick={() => onChange(value.filter((current) => current !== id))} className="rounded-full px-1 leading-none hover:bg-black/10" aria-label="Hapus assignee">×</button>
          </Badge>
        )) : <span className="text-xs text-muted-foreground">Belum ada assignee</span>}
      </div>

      {available.length ? (
        <Select key={value.length} value="" onValueChange={(id) => { if (id) onChange([...value, id]); }}>
          <SelectTrigger><SelectValue placeholder="+ Tambah assignee…" /></SelectTrigger>
          <SelectContent>
            {available.map((person) => (
              <SelectItem key={String(person.id)} value={String(person.id)}>
                {text(person.nama) || text(person.name) || text(person.email)}
                {hasAccount(person) ? "" : " · tanpa akun"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}
