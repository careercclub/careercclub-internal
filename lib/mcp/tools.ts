import "server-only";
import { COMPETITOR_GUIDE, CUSTOMER_KNOWLEDGE_GUIDE, INSTAGRAM_GUIDE, MT_GUIDE, syncCompetitorIntel, syncCustomerKnowledge, syncInstagram, syncMtProspects } from "@/lib/agent/sync";
import { painPointLists } from "@/lib/api/customer-knowledge-agent";
import { listTicketPeople } from "@/lib/api/tickets";
import { withPostgres } from "@/lib/db/postgres";
import { getRowById, listRows } from "@/lib/db/query";
import { isRecordDefinitionKey, recordDefinitions, type RecordDefinition } from "@/lib/records/catalog";
import { createRecord, updateRecord } from "@/lib/records/write";
import { MIN_SEARCH_LENGTH } from "@/lib/search/registry";
import { searchEverything } from "@/lib/search/query";
import { requireTicketAccess } from "@/lib/tickets/access";
import { ticketVisibility } from "@/lib/tickets/visibility";
import { cleanRow, formEntries, isHiddenField, isMaskedField, MCP_EXCLUDED_TABLES, missingRequired, pageOf, refusedFields, rowFilter, rowMatches, writableFields } from "./data-rules";
import type { ConnectorUser } from "./oauth";
import { recordServerError } from "@/lib/monitoring/errors";

// The tools the CareerCclub connector gives Claude (Putaran 62). Every call runs as the person who
// connected, with their rights. There is no delete tool.

type Json = Record<string, unknown>;
export type Tool = { name: string; title: string; description: string; inputSchema: Json; annotations: Json };
export class ToolError extends Error {}

const READ = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const moduleKeys = () => Object.keys(recordDefinitions).filter((key) => !MCP_EXCLUDED_TABLES.has((recordDefinitions as Record<string, RecordDefinition>)[key].table));
const SYNCS = { instagram: INSTAGRAM_GUIDE, "job-vacancy-mt": MT_GUIDE, "competitor-intel": COMPETITOR_GUIDE, "customer-knowledge": CUSTOMER_KNOWLEDGE_GUIDE } as const;
const syncBody = (list: string, about: string) => ({
  type: "object", required: ["mode", list],
  properties: { mode: { type: "string", enum: ["preview", "apply"], description: "preview first and show the person; apply after they agree" }, [list]: { type: "array", items: { type: "object" }, description: about } },
});

export function tools(): Tool[] {
  const modules = moduleKeys();
  return [
    { name: "list_modules", title: "List modules", annotations: READ, description: "Every module (data list) of CareerCclub Internal: its key, name, page, fields (type, required, options) and whether you may add or change it. Call this first to learn the keys and field names.", inputSchema: { type: "object", properties: {} } },
    { name: "search", title: "Search everything", annotations: READ, description: "Searches every module at once, like Ctrl+K in the app (English and Indonesian words, close spellings). Returns matches with their module key and id; open one with get_record.", inputSchema: { type: "object", required: ["query"], properties: { query: { type: "string", minLength: MIN_SEARCH_LENGTH } } } },
    { name: "list_records", title: "List records", annotations: READ, description: "Rows of one module, newest or in the module's order, 50 at a time (max 200). Narrow with query (words anywhere in the row) and filters (exact field values, e.g. {\"status\": \"Approached\"}). Use offset to page.", inputSchema: { type: "object", required: ["module"], properties: { module: { type: "string", enum: modules }, query: { type: "string" }, filters: { type: "object" }, limit: { type: "integer", minimum: 1, maximum: 200 }, offset: { type: "integer", minimum: 0 } } } },
    { name: "get_record", title: "Get a record", annotations: READ, description: "One row of a module by id, with every field.", inputSchema: { type: "object", required: ["module", "id"], properties: { module: { type: "string", enum: modules }, id: { type: "string" } } } },
    { name: "add_record", title: "Add a record", annotations: WRITE, description: "Adds a row to a module, as the person who connected (recorded in their name, same rules as the app's forms). values uses the field names from list_modules; required fields must be filled. Passwords, bank accounts and files cannot be set here.", inputSchema: { type: "object", required: ["module", "values"], properties: { module: { type: "string", enum: modules }, values: { type: "object" } } } },
    { name: "update_record", title: "Change a record", annotations: { ...WRITE, idempotentHint: true }, description: "Changes fields of one row. Send only the fields to change; the others stay as they are. Same rules as the app (a ticket only if this person may see it). Nothing can be deleted.", inputSchema: { type: "object", required: ["module", "id", "values"], properties: { module: { type: "string", enum: modules }, id: { type: "string" }, values: { type: "object" } } } },
    { name: "import_guide", title: "Import format", annotations: READ, description: "The exact format and rules for the bulk imports below (Instagram & Content Evaluation, Job Vacancy MT, Competitor Intel, Customer Knowledge). Read it before calling an import.", inputSchema: { type: "object", required: ["module"], properties: { module: { type: "string", enum: Object.keys(SYNCS) } } } },
    { name: "import_instagram", title: "Import Instagram insights", annotations: WRITE, description: "Posts' insights (Content Evaluation) and weekly account numbers (Instagram page), matched by post_id and week. Format: import_guide instagram.", inputSchema: { type: "object", required: ["mode"], properties: { mode: { type: "string", enum: ["preview", "apply"], description: "preview first and show the person; apply after they agree" }, posts: { type: "array", items: { type: "object" }, description: "posts with post_id (as text) and their metrics" }, weeks: { type: "array", items: { type: "object" }, description: "optional weekly account numbers" } } } },
    { name: "import_job_vacancy_mt", title: "Import MT companies", annotations: WRITE, description: "Companies opening Management Trainee programs, with openings, HR contacts and research notes. Format: import_guide job-vacancy-mt.", inputSchema: syncBody("companies", "companies") },
    { name: "import_competitors", title: "Import competitors", annotations: WRITE, description: "Competitors with followers, news (flags), products and prices. Format: import_guide competitor-intel.", inputSchema: syncBody("competitors", "competitors") },
    { name: "import_customer_comments", title: "Import customer comments", annotations: WRITE, description: "Comments, DMs and replies for Customer Knowledge (pain points). Platform and category must exist; see import_guide customer-knowledge.", inputSchema: syncBody("pain_points", "pain points") },
  ];
}

function definitionOf(key: unknown) {
  const name = String(key || "");
  if (!isRecordDefinitionKey(name) || !moduleKeys().includes(name)) throw new ToolError(`Unknown module "${name}". Call list_modules for the keys.`);
  return { key: name, definition: recordDefinitions[name] as RecordDefinition };
}

const roleOf = (user: ConnectorUser) => user.role || "member";
const mayChange = (definition: RecordDefinition, user: ConnectorUser) => !definition.mutationRoles?.length || definition.mutationRoles.includes(roleOf(user));
const viewer = (user: ConnectorUser) => ({ role: user.role, userId: user.id, email: user.email });
/** Who the app records as having made the change. */
const actor = (user: ConnectorUser) => ({ id: user.id, email: user.email, role: user.role, name: `${user.name} via Claude` });

async function readable(key: string, definition: RecordDefinition, user: ConnectorUser) {
  const rows = await listRows<Json>(definition.table, { orderBy: definition.orderBy, ascending: definition.ascending });
  if (key !== "tickets") return rows;
  const visible = ticketVisibility(viewer(user), await listTicketPeople());
  return rows.filter(visible);
}

async function one(key: string, definition: RecordDefinition, id: string, user: ConnectorUser) {
  try {
    const row = key === "tickets" ? await requireTicketAccess({ ...viewer(user), id: user.id, email: user.email, role: user.role }, id) : await getRowById<Json>(definition.table, id);
    if (!row) throw new ToolError("Not found.");
    return row as Json;
  } catch (error) {
    if (error instanceof ToolError) throw error;
    // Ticket not found / not visible, or an id of the wrong shape: the same answer.
    throw new ToolError("Not found.");
  }
}

function formOf(definition: RecordDefinition, values: Json) {
  const form = new FormData();
  for (const [name, value] of formEntries(definition.fields, values)) form.append(name, value);
  return form;
}

function checkValues(key: string, definition: RecordDefinition, values: unknown): Json {
  if (!values || typeof values !== "object" || Array.isArray(values)) throw new ToolError("values must be an object of field names (see list_modules).");
  const refused = refusedFields(definition.table, definition, values as Json);
  if (refused.length) throw new ToolError(`These fields cannot be set here: ${refused.join(", ")}. Use the field names from list_modules; passwords, bank accounts and files are changed in the app.`);
  return values as Json;
}

// Database errors are put in plain words; their raw text can name other records' values.
const DB_ERRORS: Record<string, string> = {
  "23505": "This would duplicate a record that already exists.",
  "23502": "A required value is missing.",
  "23503": "It points to a record that doesn't exist.",
  "23514": "A value is not allowed here.",
  "22P02": "A value has the wrong format.",
  "22007": "A date or time has the wrong format.",
  "22008": "A date or time is out of range.",
  "22001": "A value is too long.",
  "42703": "This module is not up to date on the server yet. Ask an admin to run the latest update.",
};
function errorText(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) {
    if (DB_ERRORS[code]) return DB_ERRORS[code];
    void recordServerError({ kind: "api", place: "mcp:write", error }).catch(() => {});
    return "The database refused the change.";
  }
  if (error instanceof SyntaxError) return "A JSON field is not valid JSON.";
  return error instanceof Error ? error.message : "Something went wrong.";
}

/** Runs a tool as `user`. Throws ToolError for anything Claude should read and fix. */
export async function callTool(name: string, args: Json, user: ConnectorUser): Promise<unknown> {
  switch (name) {
    case "list_modules":
      return moduleKeys().map((key) => {
        const definition = (recordDefinitions as Record<string, RecordDefinition>)[key];
        const writable = new Set(writableFields(definition.table, definition.fields).map((field) => field.name));
        return {
          key, name: definition.title, page: definition.path, about: definition.description,
          can_add_and_change: mayChange(definition, user),
          fields: definition.fields.filter((field) => writable.has(field.name)).map((field) => ({ name: field.name, label: field.label, type: field.type || "text", ...(field.required ? { required: true } : {}), ...(field.options ? { options: field.options } : {}) })),
          ...(key === "tickets" ? { note: "You see only the tickets you may see in the app." } : {}),
        };
      });
    case "search": {
      const query = String(args.query || "").trim().slice(0, 120);
      if (query.length < MIN_SEARCH_LENGTH) throw new ToolError(`Type at least ${MIN_SEARCH_LENGTH} characters.`);
      const { hits } = await searchEverything(query, viewer(user), { omit: (table, field) => isMaskedField(table, field) || isHiddenField(field) });
      return hits.slice(0, 50).map((hit) => ({ module: hit.key, id: hit.id, title: hit.title, module_name: hit.module, matched: hit.matchLabel, snippet: hit.snippet, page: hit.href }));
    }
    case "list_records": {
      const { key, definition } = definitionOf(args.module);
      const rows = (await readable(key, definition, user)).map((row) => cleanRow(definition.table, row));
      const filtered = rows.filter(rowFilter((args.filters as Json) || {})).filter((row) => rowMatches(row, String(args.query || "")));
      return { module: key, ...pageOf(filtered, args.limit, args.offset) };
    }
    case "get_record": {
      const { key, definition } = definitionOf(args.module);
      return cleanRow(definition.table, await one(key, definition, String(args.id || ""), user));
    }
    case "add_record": {
      const { key, definition } = definitionOf(args.module);
      if (!mayChange(definition, user)) throw new ToolError(`Only ${definition.mutationRoles?.join(", ")} may add to ${definition.title}.`);
      const values = checkValues(key, definition, args.values);
      const missing = missingRequired(definition.table, definition, values);
      if (missing.length) throw new ToolError(`Fill the required field${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`);
      try { return { added: cleanRow(definition.table, await createRecord(actor(user), key, formOf(definition, values))) }; } catch (error) { throw new ToolError(`Not added: ${errorText(error)}`); }
    }
    case "update_record": {
      const { key, definition } = definitionOf(args.module);
      if (!mayChange(definition, user)) throw new ToolError(`Only ${definition.mutationRoles?.join(", ")} may change ${definition.title}.`);
      const values = checkValues(key, definition, args.values);
      const id = String(args.id || "");
      const previous = await one(key, definition, id, user);
      // A task linked to a ticket also changes that ticket: only if this person may see it.
      if (key === "tasks" && previous.ticket_id) await one("tickets", recordDefinitions.tickets as RecordDefinition, String(previous.ticket_id), user);
      const merged = { ...previous, ...values };
      const missing = missingRequired(definition.table, definition, merged);
      if (missing.length) throw new ToolError(`These required fields cannot be empty: ${missing.join(", ")}.`);
      try { return { changed: cleanRow(definition.table, (await updateRecord(actor(user), key, id, formOf(definition, merged))) || {}) }; } catch (error) { throw new ToolError(`Not changed: ${errorText(error)}`); }
    }
    case "import_guide": {
      const which = String(args.module || "") as keyof typeof SYNCS;
      if (!(which in SYNCS)) throw new ToolError(`module must be one of ${Object.keys(SYNCS).join(", ")}.`);
      const guide = { ...SYNCS[which], auth: "Handled by the connector." };
      return which === "customer-knowledge" ? { ...guide, ...(await withPostgres((sql) => painPointLists(sql))) } : guide;
    }
    case "import_instagram": return syncResult(await syncInstagram(args, actor(user).name));
    case "import_job_vacancy_mt": return syncResult(await syncMtProspects(args, actor(user).name));
    case "import_competitors": return syncResult(await syncCompetitorIntel(args, actor(user).name));
    case "import_customer_comments": return syncResult(await syncCustomerKnowledge(args, actor(user).name));
    default:
      throw new ToolError(`Unknown tool "${name}".`);
  }
}

function syncResult(result: { status: number; json: unknown }) {
  if (result.status >= 400) {
    const body = result.json as { error?: string } | null;
    throw new ToolError(body?.error || "The import was not accepted.");
  }
  return result.json;
}
