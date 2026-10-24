// What a list page sends to the browser. Every row crosses the network on each visit, so
// empty fields (null) and columns the list never shows are left out. Editing loads the full
// row by id, so nothing typed or stored is lost. Pure: tested under `node --test`.

type Row = Record<string, unknown>;

/** Copy of `row` without null values and without the `skip` columns. */
export function leanRow<T extends Row>(row: T, skip: readonly string[] = []): T {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined || skip.includes(key)) continue;
    out[key] = value;
  }
  return out as T;
}

export function leanRows<T extends Row>(rows: readonly T[], skip: readonly string[] = []): T[] {
  return rows.map((row) => leanRow(row, skip));
}
