// Who can be picked as an assignee or a calendar guest. Pure: tested under `node --test`.
// A person whose sign-in account is Blocked is not offered any more; someone already on a
// ticket stays on it (shown as blocked) until they are removed.

type Person = Record<string, unknown> & { id: unknown };

export const isBlocked = (person: Person | undefined) => person?.blocked === true;

/** Shown for an id whose person was deleted (before deletes were checked, Putaran 56). */
export const REMOVED_PERSON = "Removed person";

/** Name for an assignee id: the person's name, or "Removed person" when the id points at nobody. */
export function personLabel(people: Person[], id: unknown) {
  const person = people.find((row) => String(row.id) === String(id));
  if (!person) return REMOVED_PERSON;
  return String(person.nama || person.name || person.email || REMOVED_PERSON);
}

/** Calendar guests: people with an email whose account is not blocked. */
export function invitablePeople<T extends Person>(people: T[]) {
  return people.filter((person) => Boolean(person.email) && !isBlocked(person));
}

/** People to offer in a picker: everyone not blocked, plus those already chosen (so they show). */
export function pickablePeople<T extends Person>(people: T[], chosen: readonly string[] = []) {
  return people.filter((person) => !isBlocked(person) || chosen.includes(String(person.id)));
}
