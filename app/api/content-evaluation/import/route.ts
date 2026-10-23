import { auth } from "@/auth";
import { importContentEvaluations, type ContentEvaluationImportRow } from "@/lib/api/content-evaluation";
import { parseDate, parseNumber } from "@/lib/imports/csv-text";
import { cellText, readWorkbook } from "@/lib/imports/workbook";
import type ExcelJS from "exceljs";

export const runtime = "nodejs";

function text(value: ExcelJS.CellValue) { return cellText(value); }

function number(value: string) { return parseNumber(value); }
function format(value: string) { const lower = value.toLowerCase(); if (lower.includes("reel") || lower.includes("video")) return "Reel"; if (lower.includes("story")) return "Story"; if (lower.includes("photo") || lower.includes("image")) return "Feed Photo"; return "Carousel"; }
// Meta Business Suite writes "06/30/2026 19:00" — month first.
function date(value: string) { return parseDate(value, "mdy"); }

export async function POST(request: Request) {
  if (!(await auth())?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const formData = await request.formData(); const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024 || !/\.(csv|xlsx)$/i.test(file.name)) return Response.json({ error: "A CSV or XLSX file up to 10 MB is required." }, { status: 400 });
  try {
    const workbook = await readWorkbook(new Uint8Array(await file.arrayBuffer()), file.name);
    const sheet = workbook.worksheets[0]; if (!sheet) return Response.json({ error: "Workbook is empty." }, { status: 400 });
    const headers = new Map<number, string>(); sheet.getRow(1).eachCell((cell, column) => headers.set(column, text(cell.value).toLowerCase()));
    // Excel keeps only 15 significant digits. A Post ID saved as a number cell has already
    // lost its tail, so different posts would merge into one — refuse instead of guessing.
    const idColumn = [...headers.entries()].find(([, header]) => header === "post id")?.[0];
    if (idColumn) {
      let rounded = 0;
      sheet.eachRow((row, rowNumber) => { const value = row.getCell(idColumn).value; if (rowNumber > 1 && typeof value === "number" && Math.abs(value) >= 1e15) rounded += 1; });
      if (rounded) return Response.json({ error: `${rounded} Post ID${rounded === 1 ? " was" : "s were"} stored by Excel as numbers and lost digits, so posts would be mixed up. Import the CSV straight from Meta Business Suite, or format the Post ID column as Text before saving.` }, { status: 400 });
    }
    const rows: ContentEvaluationImportRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = new Map<string, string>(); headers.forEach((header, column) => values.set(header, text(row.getCell(column).value)));
      const get = (name: string) => values.get(name) || "";
      const getAny = (...names: string[]) => names.map(get).find(Boolean) || "";
      const postId = get("post id"); if (!postId) return;
      const description = get("description");
      rows.push({ postId, accountId: get("account id"), accountUsername: get("account username"), description, title: description.replace(/\s+/g, " ").slice(0, 80) || `Post ${postId}`, url: get("permalink"), format: format(get("post type")), date: date(get("publish time") || get("date")), views: number(get("views")), reach: number(get("reach")), likes: number(get("likes")), comments: number(get("comments")), saves: number(get("saves")), shares: number(get("shares")), follows: number(get("follows")), duration: number(getAny("duration (sec)", "duration")), nfPct: number(getAny("non-follower reach %", "non follower reach %", "nf_pct", "nf%")), fromHome: number(getAny("from home", "from_home")), fromProfile: number(getAny("from profile", "from_profile")), fromOther: number(getAny("from other", "from_other")), engaged: number(getAny("accounts engaged", "engaged")), profileVisits: number(getAny("profile visits", "profile_visits")), linkTaps: number(getAny("link taps", "link_taps")), watchtime: number(getAny("average watch time", "watchtime")), wtr: number(getAny("watch through rate", "wtr")), replays: number(get("replays")), dropoff: number(getAny("drop-off", "dropoff")), tapsForward: number(getAny("taps forward", "taps_forward")), tapsBack: number(getAny("taps back", "taps_back")), exits: number(get("exits")), replies: number(get("replies")), stickersInteract: number(getAny("sticker taps", "sticker interactions", "stickers_interact")) });
    });
    if (!rows.length) return Response.json({ error: "No Meta Business Suite rows with Post ID were found." }, { status: 400 });
    return Response.json(await importContentEvaluations(rows));
  } catch (error) { console.error("Content evaluation import failed", error); return Response.json({ error: "The workbook could not be imported." }, { status: 500 }); }
}
