import { logActivity } from "@/lib/api/activity";
import { agentCaller } from "@/lib/api/agent-tokens";
import { applyAgentCompanies, previewAgentCompanies } from "@/lib/api/mt-agent";
import { MAX_COMPANIES } from "@/lib/mt-prospects/agent";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

// Claude access → Job Vacancy MT. GET explains the format; POST previews or applies.
const GUIDE = {
  module: "Job Vacancy MT",
  auth: "Authorization: Bearer <Claude access key from Settings → Claude access>, or a signed-in browser session.",
  steps: ["POST with mode \"preview\" and show the person the summary and every possible_duplicate / conflict.", "After they agree, POST the same companies with mode \"apply\". Nothing is ever deleted."],
  request: {
    mode: "preview | apply",
    companies: `up to ${MAX_COMPANIES} items`,
  },
  company: {
    brand: "string (brand or legal_name required)",
    legal_name: "string, e.g. PT Garudafood Putra Putri Jaya Tbk",
    industry: "string", program: "string, the MT programme name", status: "active | predicted | older | excluded (new companies only; default active)",
    active_years: "string, e.g. \"2024, 2025\"", usual_months: "number[] 1-12 or text like \"Agustus–Oktober\"",
    openings: "{ \"2026\": { months: number[] | \"Maret–April\", dates?: string } }",
    notes: "string", contacts: "[{ name, title?, link? }] HR contacts",
    updates: "[{ text, date?: YYYY-MM-DD, source_url? }] dated research notes",
    requirements: "[{ text, program?, source_url? }]",
    selection_steps: "[{ text, program?, source_url?, date? }] e.g. \"Administrasi → Psikotes → Interview HR → Interview User → MCU\"",
    match_id: "string, the company id from a possible_duplicate candidate, to update that company",
    as_new: "true to add as a new company although a similar name exists",
  },
  rules: [
    "Matched by name like the Excel upload (PT/Tbk/(Persero) ignored).",
    "Existing companies: only empty fields are filled; a different value is reported as a conflict and not written.",
    "Opening years, HR contacts and notes that are not there yet are added; duplicates are skipped.",
    "A similar but different name is a possible_duplicate and is skipped until match_id or as_new is given.",
    "Companies from the Excel upload are refreshed by the next upload; notes added here stay.",
  ],
};

export async function GET(request: Request) {
  if (!(await agentCaller(request, "job-vacancy-mt"))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(GUIDE);
}

export async function POST(request: Request) {
  const caller = await agentCaller(request, "job-vacancy-mt");
  if (!caller) return Response.json({ error: "Unauthorized: a Claude access key for Job Vacancy MT, or sign in." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { mode?: unknown; companies?: unknown } | null;
  const mode = body?.mode === "apply" ? "apply" : body?.mode === "preview" ? "preview" : null;
  if (!mode) return Response.json({ error: "mode must be \"preview\" or \"apply\".", guide: GUIDE }, { status: 400 });
  if (!Array.isArray(body?.companies) || !body.companies.length) return Response.json({ error: "companies must be a non-empty list.", guide: GUIDE }, { status: 400 });
  if (body.companies.length > MAX_COMPANIES) return Response.json({ error: `At most ${MAX_COMPANIES} companies per request.` }, { status: 400 });
  try {
    if (mode === "preview") return Response.json({ mode, ...(await previewAgentCompanies(body.companies)) });
    const result = await applyAgentCompanies(body.companies, caller.label);
    const s = result.summary;
    await logActivity({ userName: caller.label, module: "Job Vacancy MT", action: "Claude update", detail: `${s.added} added · ${s.updated} updated · ${s.contactsAdded} contacts · ${s.notesAdded} notes`, table: "mt_prospects" });
    revalidatePath("/job-vacancy-mt");
    return Response.json({ mode, ...result });
  } catch (error) {
    console.error("[api/agent/mt-prospects] failed", error);
    return Response.json({ error: "Could not update Job Vacancy MT. Nothing was changed." }, { status: 500 });
  }
}
