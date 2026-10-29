// PICs of a partner (B2B or organization), Putaran 61. One partner can have several; they are
// stored as one list in `contacts`. The five older columns always mirror the first PIC, set here
// on every save (form, pipeline drag, Claude parser), so every path follows the same rule.
// Pure: no runtime imports, tested under `node --test`.

export type PartnerContact = { name: string; position: string; phone: string; email: string; linkedin: string };

export const CONTACT_KEYS = ["name", "position", "phone", "email", "linkedin"] as const;
/** Older one-PIC columns → the field of the first PIC they mirror. */
export const LEGACY_CONTACT_COLUMNS = { contact_name: "name", pos: "position", contact_phone: "phone", contact_email: "email", li: "linkedin" } as const;

const str = (value: unknown) => (typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "");
export const emptyContact = (): PartnerContact => ({ name: "", position: "", phone: "", email: "", linkedin: "" });
export const isBlankContact = (contact: PartnerContact) => CONTACT_KEYS.every((key) => !contact[key]);

/** Any stored value (array, JSON text, null) → a clean list without empty rows. */
export function readContacts(value: unknown): PartnerContact[] {
  let raw = value;
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = []; } }
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({ name: str(item.name), position: str(item.position), phone: str(item.phone), email: str(item.email), linkedin: str(item.linkedin) }))
    .filter((contact) => !isBlankContact(contact));
}

/** The PICs of a stored partner row: its list, or (rows saved before Putaran 61) its one PIC. */
export function contactsOf(row: Record<string, unknown> | null | undefined): PartnerContact[] {
  if (!row) return [];
  const list = readContacts(row.contacts);
  if (list.length) return list;
  const legacy = Object.fromEntries(Object.entries(LEGACY_CONTACT_COLUMNS).map(([column, key]) => [key, str(row[column])])) as PartnerContact;
  return isBlankContact(legacy) ? [] : [legacy];
}

/**
 * Before a partner is saved: the list wins when the save carries one; a save that only carries
 * the older columns (Claude parser) becomes a one-PIC list. Either way the older columns are set
 * from the first PIC, so they never disagree with the list.
 */
export function withContacts(values: Record<string, unknown>): Record<string, unknown> {
  const carriesList = values.contacts !== undefined && values.contacts !== null;
  const contacts = carriesList ? readContacts(values.contacts) : contactsOf({ ...values, contacts: [] });
  const first = contacts[0] || emptyContact();
  const next: Record<string, unknown> = { ...values, contacts };
  for (const [column, key] of Object.entries(LEGACY_CONTACT_COLUMNS)) next[column] = first[key] || null;
  return next;
}

/** "Rina +2" for a card; "" when there is no PIC. */
export function picSummary(contacts: PartnerContact[]) {
  if (!contacts.length) return "";
  const first = contacts[0].name || contacts[0].email || contacts[0].phone || "PIC";
  return contacts.length > 1 ? `${first} +${contacts.length - 1}` : first;
}

/** One line per partner for CSV: "Rina (HR Manager) 0812… rina@x.id; Budi". */
export function contactsText(contacts: PartnerContact[]) {
  return contacts.map((c) => [c.name, c.position ? `(${c.position})` : "", c.phone, c.email, c.linkedin].filter(Boolean).join(" ")).join("; ");
}

/** Text a search box matches against: every PIC's name, position, WhatsApp and email. */
export function contactsSearchText(contacts: PartnerContact[]) {
  return contacts.map((c) => `${c.name} ${c.position} ${c.phone} ${c.email}`).join(" ");
}
