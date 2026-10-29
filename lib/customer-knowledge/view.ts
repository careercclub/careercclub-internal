// Customer Knowledge rules (IJIS layout, Oct 2026). Pure: tested under `node --test`.
// Month values are stored as Indonesian short names ("Mei", "Agu", "Okt", "Des"); the UI shows English.

type Row = Record<string, unknown>;

export const MONTH_VALUES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthLabel(value: unknown) { const index = MONTH_VALUES.indexOf(String(value ?? "")); return index > -1 ? MONTH_LABELS[index] : String(value ?? ""); }
export const MONTH_OPTIONS = MONTH_VALUES.map((value, index) => ({ value, label: MONTH_LABELS[index] }));

function text(value: unknown) { return value === null || value === undefined ? "" : String(value).trim(); }

export function labelsOf(row: Row): string[] {
  if (Array.isArray(row.labels)) return row.labels.map(String);
  if (typeof row.labels === "string") {
    try { const value = JSON.parse(row.labels); return Array.isArray(value) ? value.map(String) : []; }
    catch { return row.labels.split(",").map((item) => item.trim()).filter(Boolean); }
  }
  return [];
}

export function distribution(rows: Row[], key: string): Array<[string, number]> {
  const map = new Map<string, number>();
  rows.forEach((row) => { const value = text(row[key]) || "Unknown"; map.set(value, (map.get(value) || 0) + 1); });
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function monthCounts(rows: Row[]) {
  const counts = Array<number>(12).fill(0);
  rows.forEach((row) => { const index = MONTH_VALUES.indexOf(text(row.bulan)); if (index > -1) counts[index] += 1; });
  return counts;
}

// Words that carry no topic: Indonesian (formal, chat spelling, question words) and English.
// The cloud should show what people ask about ("psikotes", "interview user"), not "atau" or "gimana".
const STOPWORDS = new Set([
  "yang", "dan", "di", "ke", "dari", "itu", "ini", "gak", "ga", "gk", "nggak", "ngga", "enggak", "engga", "tidak", "tdk", "bukan", "gue", "gua", "gw", "aku", "saya", "kamu", "lu", "lo", "kami", "kita", "mereka", "dia", "beliau", "nya", "kalian", "anda",
  "kak", "kakak", "ka", "min", "admin", "mimin", "bang", "bro", "sis", "mas", "mba", "mbak", "gaes", "guys", "halo", "hai", "hallo", "permisi", "terima", "kasih", "makasih", "thanks", "thank", "thx", "mohon", "tolong", "maaf",
  "dong", "sih", "ya", "yaa", "yah", "iya", "iyaa", "aja", "saja", "bgt", "banget", "kali", "udah", "sudah", "sdh", "dah", "belum", "blm", "masih", "lagi", "mau", "ingin", "pengen", "pingin", "bisa", "boleh", "ada", "punya",
  "untuk", "utk", "buat", "dengan", "dgn", "sama", "juga", "jg", "lebih", "tapi", "tp", "tetapi", "namun", "kalau", "kalo", "klo", "kl", "jika", "jadi", "jd", "karena", "krn", "soalnya", "biar", "agar", "supaya", "sebagai", "seperti", "kayak", "kaya", "kyk",
  "atau", "atw", "apa", "apakah", "kah", "gimana", "bagaimana", "gmn", "kenapa", "mengapa", "knp", "siapa", "kapan", "dimana", "mana", "berapa", "brp", "yg", "pun", "kan", "kok", "lah", "tuh", "nih", "deh", "loh", "lho", "dll", "dsb",
  "akan", "bakal", "harus", "hrs", "perlu", "biasanya", "biasa", "gini", "gitu", "begini", "begitu", "gt", "setelah", "sebelum", "pas", "waktu", "saat", "ketika", "sampai", "sampe", "terus", "trus", "lalu", "kemudian", "nanti", "sekarang", "tadi", "abis", "habis",
  "pada", "dalam", "oleh", "bagi", "para", "hal", "sangat", "paling", "semua", "setiap", "tiap", "banyak", "sedikit", "satu", "orang", "sini", "situ", "sana", "baru", "emang", "memang", "dapat", "dapet", "bikin", "kasih", "tau", "tahu",
  "the", "and", "for", "you", "your", "what", "how", "are", "was", "with", "this", "that", "can", "does", "have", "has", "but", "not", "any", "about", "from", "will", "would", "should", "there", "they", "them", "just",
]);
const KEEP_SHORT = new Set(["mt", "hr", "hrd", "cv", "fgd", "oa", "ip"]);

/** Words and two-word phrases counted once per comment; a phrase must appear in at least two comments. */
export function topKeywords(rows: Row[], limit = 15): Array<[string, number]> {
  const lowered = rows.map((row) => text(row.komentar).toLowerCase());
  const frequencies = new Map<string, number>();
  lowered.forEach((comment, rowIndex) => {
    const words = comment.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word && (KEEP_SHORT.has(word) || (word.length > 2 && !STOPWORDS.has(word))));
    const seen = new Set(words);
    for (let index = 0; index < words.length - 1; index += 1) seen.add(`${words[index]} ${words[index + 1]}`);
    seen.forEach((word) => {
      if (word.includes(" ") && !lowered.some((other, otherIndex) => otherIndex !== rowIndex && other.includes(word))) return;
      frequencies.set(word, (frequencies.get(word) || 0) + 1);
    });
  });
  return [...frequencies.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}

/**
 * Free Class average rating: every 1–5 answer counts once (Putaran 58). The header and the Free
 * Class tab both use this, so they never show 4.31 and 4.28 for the same answers.
 */
export function averageRating(rows: Row[], keys: readonly string[]) {
  const values = rows.flatMap((row) => keys.map((key) => Number(row[key])).filter((value) => value >= 1 && value <= 5));
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export type PainFilter = { query?: string; platform?: string; month?: string; category?: string; label?: string };

export function filterPainPoints<T extends Row>(rows: T[], f: PainFilter): T[] {
  const q = text(f.query).toLowerCase();
  // Empty platform/category count as "Unknown" in the charts, so filtering by it finds them.
  return rows.filter((row) => (!f.platform || (text(row.platform) || "Unknown") === f.platform)
    && (!f.month || text(row.bulan) === f.month)
    && (!f.category || (text(row.kategori) || "Unknown") === f.category)
    && (!f.label || labelsOf(row).includes(f.label))
    && (!q || `${text(row.komentar)} ${text(row.username)}`.toLowerCase().includes(q)));
}
