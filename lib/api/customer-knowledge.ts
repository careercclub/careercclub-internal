import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";
import { withPostgres } from "@/lib/db/postgres";

export type PainPointRecord = ApiRecord;
export type PainPointPlatformRecord = ApiRecord;
export type PainPointCategoryRecord = ApiRecord;
export type FreeClassEvalRecord = ApiRecord;

const painPoints = createTableApi<PainPointRecord>("pain_points", {
  orderBy: "created_at",
  ascending: false,
});

const platforms = createTableApi<PainPointPlatformRecord>("pain_point_platforms", {
  orderBy: "nama",
  ascending: true,
});

const categories = createTableApi<PainPointCategoryRecord>("pain_point_categories", {
  orderBy: "nama",
  ascending: true,
});

const freeClassEval = createTableApi<FreeClassEvalRecord>("free_class_eval", {
  orderBy: "created_at",
  ascending: false,
});

export const listPainPoints = painPoints.list;
export const countPainPoints = painPoints.count;
export const getPainPoint = painPoints.get;
export const createPainPoint = painPoints.create;
export const updatePainPoint = painPoints.update;
export const deletePainPoint = painPoints.remove;

export const listPainPointPlatforms = platforms.list;
export const createPainPointPlatform = platforms.create;
export const updatePainPointPlatform = platforms.update;
export const deletePainPointPlatform = platforms.remove;

export const listPainPointCategories = categories.list;
export const createPainPointCategory = categories.create;
export const updatePainPointCategory = categories.update;
export const deletePainPointCategory = categories.remove;

export const listFreeClassEvaluations = freeClassEval.list;
export const createFreeClassEvaluation = freeClassEval.create;
export const updateFreeClassEvaluation = freeClassEval.update;
export const deleteFreeClassEvaluation = freeClassEval.remove;

export function importFreeClassEvaluations(rows: Array<Record<string, string | number | null>>) {
  return withPostgres(async (sql) => sql.begin(async (tx) => {
    const unique = new Map(rows.map((row) => [`${String(row.email).toLowerCase()}|${row.seri}`, row]));
    let imported = 0;
    for (const row of unique.values()) {
      const email = String(row.email || "").trim().toLowerCase(); const seri = String(row.seri || "").trim();
      if (!email || !seri) continue;
      await tx`
        insert into free_class_eval (
          email, seri, nama, universitas, angkatan, timestamp, materi_judul,
          materi_kebutuhan, materi_mudah, materi_jawab, nara_kuasai, nara_jelas,
          kualitas_teknis, waktu, moderator, info_webinar, kepuasan, minat,
          rekomendasi, hal_baik, ditingkatkan, topik_keinginan
        ) values (
          ${email}, ${seri}, ${String(row.nama || "")}, ${String(row.universitas || "")},
          ${String(row.angkatan || "")}, ${String(row.timestamp || "")}, ${row.materi_judul},
          ${row.materi_kebutuhan}, ${row.materi_mudah}, ${row.materi_jawab}, ${row.nara_kuasai},
          ${row.nara_jelas}, ${row.kualitas_teknis}, ${row.waktu}, ${row.moderator},
          ${row.info_webinar}, ${row.kepuasan}, ${row.minat}, ${row.rekomendasi},
          ${String(row.hal_baik || "")}, ${String(row.ditingkatkan || "")}, ${String(row.topik_keinginan || "")}
        )
        on conflict (email, seri) do update set
          nama = excluded.nama, universitas = excluded.universitas, angkatan = excluded.angkatan,
          timestamp = excluded.timestamp, materi_judul = excluded.materi_judul,
          materi_kebutuhan = excluded.materi_kebutuhan, materi_mudah = excluded.materi_mudah,
          materi_jawab = excluded.materi_jawab, nara_kuasai = excluded.nara_kuasai,
          nara_jelas = excluded.nara_jelas, kualitas_teknis = excluded.kualitas_teknis,
          waktu = excluded.waktu, moderator = excluded.moderator, info_webinar = excluded.info_webinar,
          kepuasan = excluded.kepuasan, minat = excluded.minat, rekomendasi = excluded.rekomendasi,
          hal_baik = excluded.hal_baik, ditingkatkan = excluded.ditingkatkan,
          topik_keinginan = excluded.topik_keinginan
      `;
      imported += 1;
    }
    return { imported };
  }));
}
