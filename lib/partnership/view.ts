// Partnership board rules (B2B and Organization share them). Pure: tested under `node --test`.

type Row = Record<string, unknown>;

export const PARTNER_STATUSES = ["Approached", "Sales Meet", "Negotiation", "Closed Deal", "Closed Lost"];

function text(value: unknown) { return value === null || value === undefined ? "" : String(value).trim(); }
function day(value: unknown) {
  if (value instanceof Date) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  return text(value).slice(0, 10);
}

/** Board columns in pipeline order; a partner with an unknown/empty status lands in the first column. */
export function pipelineColumns<T extends Row>(rows: T[]) {
  const columns = PARTNER_STATUSES.map((status) => ({ status, rows: [] as T[] }));
  for (const row of rows) (columns.find((column) => column.status === text(row.status)) || columns[0]).rows.push(row);
  return columns;
}

/** Per partner: number of deals and the latest outreach date (YYYY-MM-DD). */
export function partnerActivity(deals: Row[], outreach: Row[], partnerField: string) {
  const map = new Map<string, { deals: number; lastContact: string }>();
  const get = (id: unknown) => { const key = text(id); if (!map.has(key)) map.set(key, { deals: 0, lastContact: "" }); return map.get(key)!; };
  for (const deal of deals) if (text(deal[partnerField])) get(deal[partnerField]).deals += 1;
  for (const log of outreach) {
    if (!text(log[partnerField])) continue;
    const entry = get(log[partnerField]); const date = day(log.tanggal);
    if (date > entry.lastContact) entry.lastContact = date;
  }
  return map;
}

export function partnerSummary(rows: Row[]) {
  const count = (status: string) => rows.filter((row) => text(row.status) === status).length;
  const open = rows.filter((row) => !["Closed Deal", "Closed Lost"].includes(text(row.status))).length;
  return { total: rows.length, open, negotiation: count("Negotiation"), closed: count("Closed Deal"), strategic: rows.filter((row) => text(row.tier) === "Strategic").length };
}

/** Outreach grouped by day, newest day first (entries without a date last). */
export function outreachByDay<T extends Row>(outreach: T[]) {
  const groups = new Map<string, T[]>();
  for (const log of outreach) { const key = day(log.tanggal); groups.set(key, [...(groups.get(key) || []), log]); }
  return [...groups.entries()].sort((a, b) => (!a[0] ? 1 : !b[0] ? -1 : b[0].localeCompare(a[0]))).map(([date, logs]) => ({ date, logs }));
}
