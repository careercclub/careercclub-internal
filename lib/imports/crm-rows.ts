// Row mapping for the lynk.id order export ("myorder.xlsx") feeding CRM buyers.
//
// Keep this module free of imports: the fixture test loads it directly under
// `node --test`, so a `server-only` import here would break that.

export type CrmImportRow = {
  status: string;
  name: string;
  wa: string;
  email: string;
  product: string;
  price: number;
  notes: string;
  date: string | null;
};

export const crmAliases = {
  product: ["judul barang", "product", "produk"],
  email: ["buyer email", "email"],
  phone: ["buyer phone (opsional)", "buyer phone", "phone", "wa", "whatsapp"],
  name: ["buyer name (opsional)", "buyer name", "name", "nama"],
  status: ["status", "payment status"],
  price: ["harga", "price"],
  notes: ["notes (opsional)", "notes"],
  date: ["tanggal", "date", "created at"],
} as const;

export function normalizeWa(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (digits && !digits.startsWith("62")) digits = `62${digits}`;
  return digits;
}

// lynk.id writes "01-07-2026 10:24" — day first. Confirmed against a real export
// whose first component reaches 31, which no month can. Do not "fix" this to
// month-first without re-checking a real file: the flip is silent and corrupts
// every date that could be read either way.
export function normalizeCrmDate(value: string) {
  const text = value.trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dayFirst = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dayFirst) return `${dayFirst[3]}-${dayFirst[2].padStart(2, "0")}-${dayFirst[1].padStart(2, "0")}`;
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null;
}

// "1.250.000" (id) and "1,250,000" (en) both mean the same amount, and plain
// Number() turns the first into NaN — which the old `|| 0` silently booked as a
// price of zero, quietly reclassifying the sale as a downsell. When both separators
// appear the rightmost is the decimal point; when only one appears, a three-digit
// tail means it was grouping thousands.
export function parsePrice(value: string) {
  const cleaned = value.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return 0;
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  let normalized = cleaned;
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? "." : ",";
    normalized = cleaned.split(decimal === "." ? "," : ".").join("").replace(decimal, ".");
  } else if (lastDot >= 0 || lastComma >= 0) {
    const parts = cleaned.split(lastDot >= 0 ? "." : ",");
    const grouped = parts.length > 2 || parts[parts.length - 1].length === 3;
    normalized = grouped ? parts.join("") : parts.join(".");
  }
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

// lynk.id packs the checkout survey into the Notes column as a JSON object keyed by
// the question text. These three map onto real buyer columns; anything else is
// ignored rather than dumped into a field.
export function parseBuyerNotes(raw: string) {
  try {
    const notes = JSON.parse(raw) as Record<string, unknown>;
    return {
      sumber: String(notes["Kamu tau kita dari mana?"] || ""),
      tahap: String(notes["Kamu sedang berada di tahap mana saat ini?"] || ""),
      industri: String(notes["Kamu tertarik di bidang industri apa aja? (FMCG, Finance, Mining, dll)"] || ""),
    };
  } catch {
    return { sumber: "", tahap: "", industri: "" };
  }
}

function find(values: Map<string, string>, names: readonly string[]) {
  for (const name of names) {
    const direct = values.get(name.toLowerCase());
    if (direct !== undefined) return direct;
  }
  return "";
}

// Returns null for a row that carries none of the identifying columns, so callers
// can skip trailing blank rows without inventing an empty buyer.
export function mapCrmRow(values: Map<string, string>): CrmImportRow | null {
  const product = find(values, crmAliases.product);
  const email = find(values, crmAliases.email);
  const phone = find(values, crmAliases.phone);
  if (!product && !email && !phone) return null;

  return {
    status: find(values, crmAliases.status),
    name: find(values, crmAliases.name),
    wa: normalizeWa(phone),
    email: email.toLowerCase(),
    product,
    price: parsePrice(find(values, crmAliases.price)),
    notes: find(values, crmAliases.notes),
    date: normalizeCrmDate(find(values, crmAliases.date)),
  };
}
