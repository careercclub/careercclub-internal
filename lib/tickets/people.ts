// Who can be picked as an assignee or a calendar guest. Pure: tested under `node --test`.
// A person whose sign-in account is Blocked is not offered any more; someone already on a
// ticket stays on it (shown as blocked) until they are removed.

type Person = Record<string, unknown> & { id: unknown };

export const isBlocked = (person: Person | undefined) => person?.blocked === true;

/** People to offer in a picker: everyone not blocked, plus those already chosen (so they show). */
export function pickablePeople<T extends Person>(people: T[], chosen: readonly string[] = []) {
  return people.filter((person) => !isBlocked(person) || chosen.includes(String(person.id)));
}
