import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";
import { withPostgres } from "@/lib/db/postgres";

export type BuyerRecord = ApiRecord;
export type CrmDealRecord = ApiRecord;

const buyers = createTableApi<BuyerRecord>("buyers", {
  orderBy: "created_at",
  ascending: false,
});

const deals = createTableApi<CrmDealRecord>("crm_deals", {
  orderBy: "created_at",
  ascending: false,
});

export const listBuyers = buyers.list;
export const countBuyers = buyers.count;
export const getBuyer = buyers.get;
export const createBuyer = buyers.create;
export const updateBuyer = buyers.update;
export const deleteBuyer = buyers.remove;

export const listCrmDeals = deals.list;
export const countCrmDeals = deals.count;
export const getCrmDeal = deals.get;
export const createCrmDeal = deals.create;
export const updateCrmDeal = deals.update;
export const deleteCrmDeal = deals.remove;

export function listCrmDealsWithBuyers() {
  return withPostgres(async (sql) => {
    const rows = await sql<(CrmDealRecord & { buyer_name: string | null })[]>`
      select crm_deals.*, buyers.name as buyer_name
      from crm_deals
      left join buyers on buyers.id = crm_deals.buyer_id
      order by crm_deals.created_at desc
    `;
    return [...rows];
  });
}

export function countUniqueSuccessfulBuyers() {
  return withPostgres(async (sql) => {
    const [row] = await sql<{ count: string }[]>`
      select count(distinct coalesce(
        nullif(ccc_normalize_wa(wa), ''),
        nullif(lower(btrim(email)), ''),
        id::text
      ))::text as count
      from buyers
      where upper(coalesce(payment_status, '')) = 'SUCCESS'
    `;

    return Number(row?.count || 0);
  });
}

export function listBuyersWithTalentMatches() {
  return withPostgres(async (sql) => {
    const rows = await sql<(BuyerRecord & { talent_pool_match: boolean })[]>`
      select b.*,
        exists (
          select 1
          from talent_pool t
          where (
            ccc_normalize_wa(b.wa) <> ''
            and ccc_normalize_wa(t.wa) = ccc_normalize_wa(b.wa)
          ) or (
            btrim(coalesce(b.email, '')) <> ''
            and lower(btrim(t.email)) = lower(btrim(b.email))
          )
        ) as talent_pool_match
      from buyers b
      order by b.created_at desc
    `;

    return [...rows];
  });
}

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

type ImportMode = "new" | "results";

const fallbackClassifications = [
  { words: ["from zero", "bundl", "package", "paket"], value: "Bundling Package" },
  { words: ["interview", "fgd", "class"], value: "Elearning" },
  { words: ["incaran", "screening", "hr"], value: "Optimasi Screening" },
  { words: ["soal", "psikotes", "assessment", "550"], value: "Psikotes" },
  { words: ["playbook", "ebook", "e-book"], value: "E-book MT" },
  { words: ["info mt", "database", "70+"], value: "Database MT" },
] as const;

function parseBuyerNotes(raw: string) {
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

export function importCrmTransactions(rows: CrmImportRow[], mode: ImportMode) {
  return withPostgres(async (sql) => sql.begin(async (tx) => {
    const mappings = await tx<{ nama: string; klasifikasi: string }[]>`
      select nama, klasifikasi from master_produk order by nama
    `;
    const classify = (product: string) => {
      const normalized = product.trim().toLowerCase();
      const exact = mappings.find((mapping) => mapping.nama.trim().toLowerCase() === normalized);
      if (exact) return exact.klasifikasi;
      return fallbackClassifications.find((mapping) => mapping.words.some((word) => normalized.includes(word)))?.value || "Belum Diklasifikasi";
    };

    let added = 0;
    let updated = 0;
    let skipped = 0;
    const warnings: string[] = [];

    for (const [index, row] of rows.entries()) {
      if (row.status.toUpperCase() !== "SUCCESS" || !row.wa || !row.product) {
        skipped += 1;
        continue;
      }
      const classification = classify(row.product);
      if (classification === "Belum Diklasifikasi") warnings.push(`Row ${index + 2}: product classification not found.`);
      else if (!mappings.some((mapping) => mapping.nama.trim().toLowerCase() === row.product.trim().toLowerCase())) {
        await tx`
          insert into master_produk (nama, klasifikasi)
          values (${row.product.trim()}, ${classification})
          on conflict (nama) do nothing
        `;
        mappings.push({ nama: row.product.trim(), klasifikasi: classification });
      }
      const notes = parseBuyerNotes(row.notes);
      const historyItem = { produk: row.product, klasifikasi: classification, harga: row.price, tanggal: row.date || "" };
      const [existing] = await tx<{ id: string; harga: number | null; riwayat: unknown }[]>`
        select id, harga, riwayat
        from buyers
        where ccc_normalize_wa(wa) = ccc_normalize_wa(${row.wa})
        order by created_at
        limit 1
        for update
      `;

      if (mode === "new") {
        if (existing) {
          skipped += 1;
          continue;
        }
        await tx`
          insert into buyers (
            name, wa, email, produk, klasifikasi, harga, industri, tahap, sumber,
            status, payment_status, talent_pool, tanggal, riwayat
          ) values (
            ${row.name}, ${row.wa}, ${row.email}, ${row.product}, ${classification}, ${row.price},
            ${notes.industri}, ${notes.tahap}, ${notes.sumber}, 'Belum diblast', 'SUCCESS', false,
            ${row.date}, ${JSON.stringify([historyItem])}::jsonb
          )
        `;
        added += 1;
        continue;
      }

      if (!existing) {
        skipped += 1;
        continue;
      }
      const oldPrice = Number(existing.harga || 0);
      const conversion = row.price > oldPrice ? "Upsell" : row.price < oldPrice ? "Downsell" : "Cross sell";
      const history = Array.isArray(existing.riwayat) ? existing.riwayat : [];
      await tx`
        update buyers
        set produk = ${row.product}, klasifikasi = ${classification}, harga = ${row.price},
            payment_status = 'SUCCESS', status = ${`Sudah convert — ${conversion}`},
            tanggal = ${row.date}, riwayat = ${JSON.stringify([...history, historyItem])}::jsonb
        where id = ${existing.id}
      `;
      updated += 1;
    }
    return { added, updated, skipped, warnings: warnings.slice(0, 100) };
  }));
}
