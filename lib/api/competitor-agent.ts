import "server-only";
import type postgres from "postgres";
import { withPostgres } from "@/lib/db/postgres";
import { existingFlagKey, planCompetitors, summariseCompetitors, type ExistingCompetitor } from "@/lib/competitor/agent";
import { list, parseObj } from "@/lib/competitor/view";

// Competitor Intel through the Claude access API (rules in lib/competitor/agent.ts).

type Sql = postgres.Sql | postgres.TransactionSql;
type Row = Record<string, unknown>;
const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const numberOrNull = (value: unknown) => (value === null || value === undefined || value === "" ? null : Number(value));
const day = (value: unknown) => (value instanceof Date ? value.toISOString().slice(0, 10) : text(value).slice(0, 10));

/** Links are a list of URLs (older rows may hold { url } objects). */
function linkList(value: unknown) {
  const items = Array.isArray(value) ? value : list(value);
  return items.map((item) => (item && typeof item === "object" ? text((item as Row).url) : text(item))).filter(Boolean);
}

async function loadExisting(sql: Sql, lock: boolean): Promise<ExistingCompetitor[]> {
  const profiles = lock ? await sql<Row[]>`select * from competitor_profiles for update` : await sql<Row[]>`select * from competitor_profiles`;
  const [snapshots, flags, products, prices] = await Promise.all([
    sql<Row[]>`select competitor_id, to_char(snapshot_date, 'YYYY-MM-DD') as snapshot_date from competitor_snapshots`,
    sql<Row[]>`select competitor_id, flag_type, to_char(flag_date, 'YYYY-MM-DD') as flag_date, description from competitor_flags`,
    sql<Row[]>`select id, competitor_id, name, category, description, status, price_min, price_max, features, links from competitor_products`,
    sql<Row[]>`select product_id, price_min, price_max, to_char(recorded_at, 'YYYY-MM-DD') as recorded_at from competitor_product_prices order by recorded_at desc`,
  ]);
  const latestPrice = new Map<string, Row>();
  for (const row of prices) if (!latestPrice.has(text(row.product_id))) latestPrice.set(text(row.product_id), row);
  return profiles.map((p) => {
    const id = text(p.id);
    const followers = Object.fromEntries(Object.entries(parseObj(p.followers)).map(([k, v]) => [k, Number(v) || 0]));
    return {
      id, name: text(p.name), category: text(p.category), primary_url: text(p.primary_url), niche: text(p.niche), target_audience: Array.isArray(p.target_audience) ? p.target_audience.join(" | ") : text(p.target_audience),
      threat_level: text(p.threat_level), notes: text(p.notes), platforms: list(p.platforms), followers,
      snapshotDates: snapshots.filter((s) => text(s.competitor_id) === id).map((s) => text(s.snapshot_date)),
      flagKeys: flags.filter((f) => text(f.competitor_id) === id).map((f) => existingFlagKey(text(f.flag_type), text(f.flag_date), text(f.description))),
      products: products.filter((row) => text(row.competitor_id) === id).map((row) => {
        const price = latestPrice.get(text(row.id));
        return { id: text(row.id), name: text(row.name), category: text(row.category), description: text(row.description), status: text(row.status), price_min: numberOrNull(row.price_min), price_max: numberOrNull(row.price_max), features: list(row.features), links: linkList(row.links), latestPrice: price ? { min: numberOrNull(price.price_min), max: numberOrNull(price.price_max), date: day(price.recorded_at) } : null };
      }),
    };
  });
}

/** List/JSON columns are jsonb in some databases and text[] or text in others; write what each holds. */
async function columnWriter(sql: Sql) {
  const rows = await sql<Array<{ table_name: string; column_name: string; data_type: string }>>`
    select table_name, column_name, data_type from information_schema.columns
    where table_schema = 'public' and table_name in ('competitor_profiles', 'competitor_products', 'competitor_snapshots')`;
  const types = new Map(rows.map((row) => [`${row.table_name}.${row.column_name}`, row.data_type]));
  return (table: string, column: string, value: unknown) => {
    const type = types.get(`${table}.${column}`) || "jsonb";
    if (type === "jsonb" || type === "json") return sql.json(value as never);
    if (type === "ARRAY") return Array.isArray(value) ? value.map(String) : [];
    return Array.isArray(value) ? value.join(" | ") : JSON.stringify(value);
  };
}

function today() {
  // The team works in Jakarta time.
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

async function plan(sql: Sql, raws: unknown[], lock: boolean) {
  const items = planCompetitors(raws, await loadExisting(sql, lock), today());
  return { items, summary: summariseCompetitors(items) };
}

export function previewCompetitors(raws: unknown[]) {
  return withPostgres((sql) => plan(sql, raws, false));
}

export function applyCompetitors(raws: unknown[], actor: string) {
  return withPostgres((sql) => sql.begin(async (tx) => {
    const result = await plan(tx, raws, true);
    const write = await columnWriter(tx);
    const stamp = { added_via: actor, added_at: new Date() };
    for (const item of result.items) {
      if (item.action !== "add" && item.action !== "update") continue;
      if (item.action === "add") {
        const [row] = await tx<Array<{ id: string }>>`insert into competitor_profiles ${tx({ ...item.set, platforms: write("competitor_profiles", "platforms", item.platforms), followers: write("competitor_profiles", "followers", item.followers), ...stamp } as never)} returning id`;
        item.id = String(row.id);
      } else {
        // Empty fields only (checked again here, so a person's edit is never overwritten).
        for (const [field, value] of Object.entries(item.set)) await tx`update competitor_profiles set ${tx(field)} = ${value} where id = ${item.id!} and coalesce(${tx(field)}::text, '') = ''`;
        await tx`update competitor_profiles set platforms = ${write("competitor_profiles", "platforms", item.platforms) as never}, followers = ${write("competitor_profiles", "followers", item.followers) as never} where id = ${item.id!}`;
      }
      if (item.snapshot) {
        const [same] = await tx<Array<{ id: string; followers: unknown }>>`select id, followers from competitor_snapshots where competitor_id = ${item.id!} and snapshot_date = ${item.snapshot.date} limit 1`;
        if (same) {
          const merged = { ...parseObj(same.followers), ...item.snapshot.followers };
          await tx`update competitor_snapshots set followers = ${write("competitor_snapshots", "followers", merged) as never} ${item.snapshot.ads_active === null ? tx`` : tx`, ads_active = ${item.snapshot.ads_active}`} where id = ${same.id}`;
        } else {
          await tx`insert into competitor_snapshots ${tx({ competitor_id: item.id!, snapshot_date: item.snapshot.date, followers: write("competitor_snapshots", "followers", item.snapshot.followers), ads_active: item.snapshot.ads_active ?? false, notes: item.snapshot.notes || `Synced by ${actor}` } as never)}`;
        }
      }
      for (const flag of item.flags) await tx`insert into competitor_flags ${tx({ competitor_id: item.id!, ...flag, added_via: actor } as never)}`;
      for (const product of item.products) {
        if (product.action === "unchanged") continue;
        if (product.action === "add") {
          const [row] = await tx<Array<{ id: string }>>`insert into competitor_products ${tx({ competitor_id: item.id!, ...product.set, features: write("competitor_products", "features", product.features), links: write("competitor_products", "links", product.links), ...stamp } as never)} returning id`;
          product.id = String(row.id);
        } else {
          for (const [field, value] of Object.entries(product.set)) await tx`update competitor_products set ${tx(field)} = ${value} where id = ${product.id!} and coalesce(${tx(field)}::text, '') = ''`;
          await tx`update competitor_products set features = ${write("competitor_products", "features", product.features) as never}, links = ${write("competitor_products", "links", product.links) as never} where id = ${product.id!}`;
        }
        if (product.addPrice) await tx`insert into competitor_product_prices ${tx({ product_id: product.id!, price_min: product.addPrice.min, price_max: product.addPrice.max ?? product.addPrice.min, recorded_at: product.addPrice.date, notes: `Synced by ${actor}` } as never)}`;
      }
    }
    return result;
  }));
}
