// Reads the "CCC List MT" workbook into rows for Job Vacancy MT.
//
// Pure: takes each sheet as rows of cell text (row 0 = headers) so it can be tested
// without ExcelJS or a database. Sheets and columns are found by name, not position, so
// a newer workbook with an extra column or a 2027 year column still imports.
//
// Sheets used:
//   Aktif (MT 2026) / Pernah Buka (2025) / Lama (2024 saja) / Dikeluarkan dari Aktif → companies
//   Prediksi 2026     → prediction on a company
//   Kontak HR         → HR contacts
//   Syarat Gabungan   → requirements (already merges the poster and research archives)
//   Update Tgl & Status, Tahapan Tambahan → dated updates and selection steps
// The summary sheet is formulas over the others and the "(arsip)" sheets are folded
// into "Syarat Gabungan", so neither is read.

export type ProspectStatus = "active" | "predicted" | "older" | "excluded";
export type Opening = { months: number[]; label: string; dates: string };
export type Prediction = { priority: string; pattern: string; estimate: string; basis: string; contacts: string; approach: string; confidence: string; notes: string };

export type ParsedProspect = {
  importKey: string;
  legalName: string;
  brand: string;
  status: ProspectStatus;
  industry: string;
  program: string;
  activeYears: string;
  totalOpenings: number | null;
  usualMonths: number[];
  openings: Record<string, Opening>;
  prediction: Prediction | null;
  notes: string;
  exclusionReason: string;
};
export type ParsedContact = { importKey: string; name: string; title: string; link: string; mtStatus: string; position: number };
export type ResearchKind = "requirement" | "update" | "steps";
export type ParsedResearch = { importKey: string; kind: ResearchKind; program: string; origin: string; refId: string; details: Record<string, string>; position: number };
export type Unmatched = { sheet: string; row: number; label: string };
export type ParseResult = {
  prospects: ParsedProspect[];
  contacts: ParsedContact[];
  research: ParsedResearch[];
  unmatched: Unmatched[];
  /** Research rows with no brand at all — the workbook's own note rows ("Catatan: …"). */
  skippedNotes: number;
  /** Company sheets that were not found — an empty result is reported, not imported. */
  missingSheets: string[];
};

export type SheetRows = string[][];

/* ── Months ── */

const MONTH_WORDS: Array<[string, number]> = [
  ["januari", 1], ["january", 1], ["jan", 1],
  ["februari", 2], ["february", 2], ["feb", 2], ["pebruari", 2],
  ["maret", 3], ["march", 3], ["mar", 3],
  ["april", 4], ["apr", 4],
  ["mei", 5], ["may", 5],
  ["juni", 6], ["june", 6], ["jun", 6],
  ["juli", 7], ["july", 7], ["jul", 7],
  ["agustus", 8], ["august", 8], ["agu", 8], ["agt", 8], ["aug", 8],
  ["september", 9], ["sept", 9], ["sep", 9],
  ["oktober", 10], ["october", 10], ["okt", 10], ["oct", 10],
  ["november", 11], ["nov", 11], ["nop", 11],
  ["desember", 12], ["december", 12], ["des", 12], ["dec", 12],
];
const MONTH_PATTERN = new RegExp(`\\b(${MONTH_WORDS.map(([word]) => word).sort((a, b) => b.length - a.length).join("|")})\\b`, "gi");
const MONTH_NUMBER = new Map(MONTH_WORDS);

/** "Agustus–November" → [8, 9, 10, 11]; "Januari, Februari" → [1, 2]; "Belum jelas" → []. */
export function parseMonths(text: string): number[] {
  const source = String(text || "").toLowerCase();
  const found: Array<{ month: number; start: number; end: number }> = [];
  for (const match of source.matchAll(MONTH_PATTERN)) found.push({ month: MONTH_NUMBER.get(match[1].toLowerCase()) || 0, start: match.index || 0, end: (match.index || 0) + match[0].length });
  const months = new Set<number>();
  found.forEach((item, index) => {
    months.add(item.month);
    const next = found[index + 1];
    // A dash (or "sampai"/"to") between two months is a range, wrapping over the new year.
    if (next && /^\s*(–|—|-|s\/d|sd|sampai|hingga|to)\s*$/.test(source.slice(item.end, next.start))) {
      for (let month = item.month; month !== next.month; month = month === 12 ? 1 : month + 1) months.add(month);
    }
  });
  months.delete(0);
  return [...months].sort((a, b) => a - b);
}

/* ── Names and matching ── */

/** Lower case, no accents, no "PT"/"Tbk"/"(Persero)", punctuation folded to spaces. */
export function normalizeName(value: string) {
  return String(value || "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(pt|tbk|persero|perseroan|terbuka)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim().replace(/\s+/g, " ");
}

export function nameVariants(value: string) {
  const text = String(value || "");
  const withoutBrackets = text.replace(/\([^)]*\)/g, " ");
  const variants = new Set([normalizeName(text), normalizeName(withoutBrackets)]);
  for (const inner of text.matchAll(/\(([^)]*)\)/g)) variants.add(normalizeName(inner[1]));
  for (const part of withoutBrackets.split(/\s*\/\s*/)) variants.add(normalizeName(part));
  return [...variants].filter((item) => item.length >= 2);
}

const unconfirmed = (legal: string) => /^belum terkonfirmasi/i.test(legal.trim());
const STATUS_PREFERENCE: ProspectStatus[] = ["active", "predicted", "older", "excluded"];
const MT_STATUS_TO_STATUS: Array<[RegExp, ProspectStatus]> = [[/^aktif/i, "active"], [/^pernah/i, "predicted"], [/^lama/i, "older"], [/^dikeluarkan/i, "excluded"]];

function createMatcher(prospects: ParsedProspect[]) {
  const byPair = new Map<string, ParsedProspect[]>();
  const byBrand = new Map<string, ParsedProspect[]>();
  const byLegal = new Map<string, ParsedProspect[]>();
  const byNorm = new Map<string, ParsedProspect[]>();
  const byVariant = new Map<string, ParsedProspect[]>();
  const push = (map: Map<string, ParsedProspect[]>, key: string, prospect: ParsedProspect) => { if (!key) return; const list = map.get(key) || []; if (!list.includes(prospect)) list.push(prospect); map.set(key, list); };
  for (const prospect of prospects) {
    push(byPair, `${prospect.legalName.trim()}|${prospect.brand.trim()}`, prospect);
    push(byBrand, prospect.brand.trim(), prospect);
    if (!unconfirmed(prospect.legalName)) { push(byLegal, prospect.legalName.trim(), prospect); push(byNorm, normalizeName(prospect.legalName), prospect); nameVariants(prospect.legalName).forEach((key) => push(byVariant, key, prospect)); }
    push(byNorm, normalizeName(prospect.brand), prospect);
    nameVariants(prospect.brand).forEach((key) => push(byVariant, key, prospect));
  }
  function pick(candidates: ParsedProspect[], preferred?: ProspectStatus) {
    if (candidates.length <= 1) return candidates[0];
    const order = preferred ? [preferred, ...STATUS_PREFERENCE.filter((item) => item !== preferred)] : STATUS_PREFERENCE;
    return [...candidates].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status))[0];
  }
  /** The company a contact or research row belongs to, or undefined when no rule finds exactly one. */
  return function match(legal: string, brand: string, mtStatus = ""): ParsedProspect | undefined {
    const preferred = MT_STATUS_TO_STATUS.find(([pattern]) => pattern.test(mtStatus))?.[1];
    const legalText = legal.trim(); const brandText = brand.trim();
    const exact = [
      legalText && brandText ? byPair.get(`${legalText}|${brandText}`) : undefined,
      brandText ? byBrand.get(brandText) : undefined,
      legalText && !unconfirmed(legalText) ? byLegal.get(legalText) : undefined,
      // Research sheets sometimes put the legal name in the Brand column.
      brandText ? byLegal.get(brandText) : undefined,
      brandText ? byNorm.get(normalizeName(brandText)) : undefined,
      legalText && !unconfirmed(legalText) ? byNorm.get(normalizeName(legalText)) : undefined,
    ];
    for (const candidates of exact) if (candidates?.length) return pick(candidates, preferred);
    // Loose: a bracketed or slash-separated part of the name. Only taken when it points at one company.
    for (const name of [brandText, unconfirmed(legalText) ? "" : legalText]) {
      if (!name) continue;
      const hits = new Set<ParsedProspect>();
      nameVariants(name).forEach((key) => byVariant.get(key)?.forEach((prospect) => hits.add(prospect)));
      const distinct = new Set([...hits].map((prospect) => `${normalizeName(prospect.legalName)}|${normalizeName(prospect.brand)}`));
      if (hits.size && distinct.size === 1) return pick([...hits], preferred);
    }
    return undefined;
  };
}

/* ── Sheets and columns ── */

const headerKey = (value: string) => String(value || "").toLowerCase().replace(/\s+/g, " ").trim();

function findSheet(sheets: Record<string, SheetRows>, prefix: string) {
  const name = Object.keys(sheets).find((item) => headerKey(item).startsWith(prefix));
  return name ? { name, rows: sheets[name] } : undefined;
}

type Columns = { get: (row: string[], ...names: string[]) => string; years: string[]; has: (...names: string[]) => boolean };
function columns(headers: string[]): Columns {
  const keys = headers.map(headerKey);
  // An exact header wins over a longer one that starts the same ("Nama" vs "Nama PT (legal)").
  const index = (names: string[]) => {
    for (const name of names) { const at = keys.indexOf(name); if (at >= 0) return at; }
    for (const name of names) { const at = keys.findIndex((key) => key.startsWith(`${name} `) || key.startsWith(`${name}(`) || key.startsWith(`${name}/`)); if (at >= 0) return at; }
    return -1;
  };
  const years = [...new Set(keys.flatMap((key) => { const match = /^(\d{4}) bulan buka$/.exec(key) || /^(\d{4}) tanggal buka$/.exec(key); return match ? [match[1]] : []; }))].sort();
  return {
    get: (row, ...names) => { const at = index(names); return at >= 0 ? String(row[at] ?? "").trim() : ""; },
    has: (...names) => index(names) >= 0,
    years,
  };
}

const blankRow = (row: string[]) => !row.some((cell) => String(cell ?? "").trim());
const intOrNull = (value: string) => { const number = Number.parseInt(value.replace(/[^\d-]/g, ""), 10); return Number.isFinite(number) ? number : null; };

const COMPANY_SHEETS: Array<[string, ProspectStatus]> = [["aktif", "active"], ["pernah buka", "predicted"], ["lama", "older"], ["dikeluarkan", "excluded"]];

export function parseProspectWorkbook(sheets: Record<string, SheetRows>): ParseResult {
  const prospects: ParsedProspect[] = [];
  const missingSheets: string[] = [];
  const seen = new Map<string, number>();

  for (const [prefix, status] of COMPANY_SHEETS) {
    const sheet = findSheet(sheets, prefix);
    if (!sheet) { if (status !== "excluded") missingSheets.push(prefix); continue; }
    const [headers = [], ...rows] = sheet.rows;
    const col = columns(headers);
    for (const row of rows) {
      if (blankRow(row)) continue;
      const legalName = col.get(row, "nama pt", "nama pt (legal)", "company");
      const brand = col.get(row, "brand");
      if (!legalName && !brand) continue;
      const base = `${normalizeName(legalName)}|${normalizeName(brand)}`;
      const occurrence = (seen.get(base) || 0) + 1;
      seen.set(base, occurrence);
      const openings: Record<string, Opening> = {};
      for (const year of col.years) {
        const label = col.get(row, `${year} bulan buka`);
        const dates = col.get(row, `${year} tanggal buka`);
        if (label || dates) openings[year] = { months: parseMonths(label), label, dates };
      }
      prospects.push({
        importKey: `${base}|${occurrence}`,
        legalName, brand, status,
        industry: col.get(row, "industry", "industri"),
        program: col.get(row, "nama mt", "nama mt / program", "program"),
        activeYears: col.get(row, "tahun aktif"),
        totalOpenings: intOrNull(col.get(row, "total pembukaan")),
        usualMonths: parseMonths(col.get(row, "bulan langganan")),
        openings,
        prediction: null,
        notes: col.get(row, "catatan"),
        exclusionReason: col.get(row, "alasan dikeluarkan"),
      });
    }
  }

  const match = createMatcher(prospects);
  const unmatched: Unmatched[] = [];

  const prediction = findSheet(sheets, "prediksi");
  if (prediction) {
    const [headers = [], ...rows] = prediction.rows; const col = columns(headers);
    rows.forEach((row, index) => {
      if (blankRow(row)) return;
      const legal = col.get(row, "nama pt"); const brand = col.get(row, "brand");
      const prospect = match(legal, brand, "pernah");
      if (!prospect) { unmatched.push({ sheet: prediction.name, row: index + 2, label: brand || legal }); return; }
      prospect.prediction = {
        priority: col.get(row, "prioritas"), pattern: col.get(row, "pola buka"), estimate: col.get(row, "estimasi buka"),
        basis: col.get(row, "dasar"), contacts: col.get(row, "jumlah kontak"), approach: col.get(row, "saran approach"),
        confidence: col.get(row, "confidence"), notes: col.get(row, "catatan"),
      };
      if (!prospect.industry) prospect.industry = col.get(row, "industry");
    });
  }

  const contacts: ParsedContact[] = [];
  const contactSheet = findSheet(sheets, "kontak hr");
  if (contactSheet) {
    const [headers = [], ...rows] = contactSheet.rows; const col = columns(headers);
    rows.forEach((row, index) => {
      if (blankRow(row)) return;
      const name = col.get(row, "nama"); if (!name) return;
      const mtStatus = col.get(row, "status mt");
      const prospect = match(col.get(row, "nama pt"), col.get(row, "brand"), mtStatus);
      if (!prospect) { unmatched.push({ sheet: contactSheet.name, row: index + 2, label: `${name} · ${col.get(row, "brand") || col.get(row, "nama pt")}` }); return; }
      contacts.push({ importKey: prospect.importKey, name, title: col.get(row, "jabatan"), link: col.get(row, "linkedin", "link", "email"), mtStatus, position: index });
    });
  }

  const research: ParsedResearch[] = [];
  let skippedNotes = 0;
  const researchSheets: Array<[string, ResearchKind, (col: Columns, row: string[]) => { program: string; origin: string; refId: string; details: Record<string, string> }]> = [
    ["syarat gabungan", "requirement", (col, row) => ({
      program: col.get(row, "program"), origin: col.get(row, "asal data"), refId: col.get(row, "id"),
      details: {
        referenceYear: col.get(row, "reference year"), openMonth: col.get(row, "bulan buka"), roles: col.get(row, "roles"), education: col.get(row, "education"),
        gpa: col.get(row, "gpa"), majors: col.get(row, "majors"), placement: col.get(row, "placement"), requirements: col.get(row, "requirements"),
        selectionSteps: col.get(row, "selection steps"), duration: col.get(row, "duration"), sourceType: col.get(row, "source type"),
        sourceLinks: col.get(row, "source links"), confidence: col.get(row, "confidence"), notes: col.get(row, "notes"),
      },
    })],
    ["update tgl", "update", (col, row) => ({
      program: col.get(row, "program"), origin: col.get(row, "sumber"), refId: col.get(row, "id"),
      details: {
        openDate: col.get(row, "tgl buka"), closeDate: col.get(row, "tgl tutup"), status: col.get(row, "status"), verification: col.get(row, "sumber verifikasi"),
        confidence: col.get(row, "confidence"), requirement: col.get(row, "syarat inti"), notes: col.get(row, "catatan"),
      },
    })],
    ["tahapan tambahan", "steps", (col, row) => ({
      program: col.get(row, "program"), origin: col.get(row, "sumber"), refId: col.get(row, "id"),
      details: { steps: col.get(row, "tahapan seleksi"), verification: col.get(row, "sumber / status verifikasi", "sumber /"), confidence: col.get(row, "confidence") },
    })],
  ];
  for (const [prefix, kind, read] of researchSheets) {
    const sheet = findSheet(sheets, prefix);
    if (!sheet) continue;
    const [headers = [], ...rows] = sheet.rows; const col = columns(headers);
    rows.forEach((row, index) => {
      if (blankRow(row)) return;
      const brand = col.get(row, "brand");
      const item = read(col, row);
      if (!brand) { skippedNotes += 1; return; }
      const prospect = match("", brand);
      if (!prospect) { unmatched.push({ sheet: sheet.name, row: index + 2, label: [brand, item.program].filter(Boolean).join(" · ") }); return; }
      const details = Object.fromEntries(Object.entries(item.details).filter(([, value]) => value));
      research.push({ importKey: prospect.importKey, kind, program: item.program, origin: item.origin, refId: item.refId, details, position: index });
    });
  }

  return { prospects, contacts, research, unmatched, skippedNotes, missingSheets };
}
