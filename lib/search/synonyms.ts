// Words people type for the same thing, in English and Indonesian. Global search (Ctrl+K) treats
// a word as matching when any word of its group matches, so "password" finds Logins (stored as
// type "credential") and "tiket" finds tickets. One list: add a group here and both page and
// record search follow. Pure: tested under `node --test`.

export const SYNONYM_GROUPS: ReadonlyArray<ReadonlyArray<string>> = [
  ["password", "passwords", "sandi", "login", "logins", "akun", "account", "accounts", "credential", "credentials", "kredensial"],
  ["ticket", "tickets", "tiket"],
  ["event", "events", "acara", "kegiatan"],
  ["task", "tasks", "tugas"],
  ["partner", "partners", "mitra", "partnership", "kerjasama"],
  ["vacancy", "vacancies", "loker", "lowongan", "job", "jobs"],
  ["company", "companies", "perusahaan"],
  ["buyer", "buyers", "pembeli", "customer", "customers", "pelanggan"],
  ["candidate", "candidates", "kandidat", "talent"],
  ["deadline", "due", "tenggat"],
  ["content", "konten"],
  ["link", "links", "tautan", "url"],
  ["phone", "wa", "whatsapp", "hp", "nomor"],
  ["price", "harga"],
  ["product", "products", "produk"],
  ["competitor", "competitors", "kompetitor", "pesaing"],
  ["design", "desain"],
  ["asset", "assets", "aset"],
  ["note", "notes", "catatan"],
  ["division", "divisi"],
  ["university", "universitas", "kampus"],
  ["schedule", "jadwal"],
  ["feedback", "masukan"],
  ["document", "documents", "dokumen"],
];

const INDEX = new Map<string, readonly string[]>();
for (const group of SYNONYM_GROUPS) for (const word of group) INDEX.set(word, group);

/** "tiket" → ["tiket", "ticket", "tickets"]; a word without a group → [word]. The typed word comes first. */
export function expandTerm(term: string): string[] {
  const group = INDEX.get(term.toLowerCase());
  return group ? [term, ...group.filter((word) => word !== term)] : [term];
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Does `text` contain `word`? The typed word may sit anywhere ("career" in "careercclub");
 * a synonym must start a word, so "wa" finds "WA 0812…" but not "Jawa", "login" not "blogin".
 */
export function containsWord(text: string, word: string, typed: boolean) {
  if (typed) return text.includes(word);
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(word)}`, "iu").test(text);
}

/** Every group matches `text`: the typed word anywhere, or a synonym at a word start. */
export function groupMatches(text: string, group: readonly string[]) {
  return group.some((word, index) => containsWord(text, word, index === 0));
}

/** Typos between two words (insert, delete, change, or swap two neighbours), capped at `max + 1`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let before: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, before[j - 2] + 1);
      current[j] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > max) return max + 1;
    before = previous;
    previous = current;
  }
  return Math.min(previous[b.length], max + 1);
}

/** Typo tolerance only for words of 4+ letters: one mistake up to 7 letters, two from 8. */
export function typoBudget(term: string) {
  return term.length < 4 ? 0 : term.length < 8 ? 1 : 2;
}

/** True when `term` is within its typo budget of some word in `text` (or of a word's start, for long words). */
export function closeWordIn(text: string, term: string): boolean {
  const budget = typoBudget(term);
  if (!budget) return false;
  for (const word of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (word.length < 3) continue;
    if (editDistance(term, word, budget) <= budget) return true;
    if (word.length > term.length && editDistance(term, word.slice(0, term.length), budget) <= budget) return true;
  }
  return false;
}
