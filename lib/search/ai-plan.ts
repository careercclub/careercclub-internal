// "Ask AI" in global search, level 1: the AI only reads the question the person typed (plus the
// names of the modules and their fields — never any record), and turns it into keywords and the
// modules worth searching. The normal search then runs with those keywords, with the same
// visibility rules, so the AI never sees data and never decides what someone may see.
// Pure: tested under `node --test`.

export type SearchModule = { key: string; module: string; fields: ReadonlyArray<{ label: string }> };
export type AiSearchPlan = { keywords: string[]; modules: string[] };

export const AI_QUERY_MAX = 200;
const MAX_KEYWORDS = 8;

/** Long, sentence-like questions are where AI helps; short words are already well served. */
export function looksLikeQuestion(query: string) {
  return query.trim().split(/\s+/).filter(Boolean).length >= 3;
}

export function aiSearchSystemPrompt(modules: ReadonlyArray<SearchModule>, today: string) {
  const catalog = modules.map((spec) => `- ${spec.key}: ${spec.module} (${spec.fields.map((field) => field.label).join(", ")})`).join("\n");
  return [
    "You turn a search question for an internal company app (CareerCclub, Indonesia) into a keyword search.",
    "The question may be Indonesian, English or mixed. You never see the data; only these modules exist:",
    catalog,
    `Today is ${today}.`,
    "Return only JSON: {\"keywords\": string[], \"modules\": string[]}.",
    "keywords: 1-8 short words or names that would appear in the records (both the Indonesian and the English word when they differ, likely brand or tool names, singular forms). No stop words, no dates.",
    "modules: the module keys from the list above that could hold the answer, most likely first; [] when unsure.",
    "Logins and passwords live in resources (type credential). Never include passwords or secrets as keywords.",
  ].join("\n");
}

const clean = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40) : "");

/** Accepts only what the search can use: known module keys and short, non-empty keywords. */
export function parseAiPlan(raw: unknown, moduleKeys: ReadonlyArray<string>): AiSearchPlan {
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const keywords = [...new Set((Array.isArray(body.keywords) ? body.keywords : []).map(clean).filter((word) => word.length >= 2))].slice(0, MAX_KEYWORDS);
  const known = new Set(moduleKeys);
  const modules = [...new Set((Array.isArray(body.modules) ? body.modules : []).map((value) => (typeof value === "string" ? value.trim() : "")).filter((key) => known.has(key)))];
  return { keywords, modules };
}

/** Records matching more of the AI's keywords come first. */
export function keywordScore(haystack: string, keywords: ReadonlyArray<string>) {
  const text = haystack.toLowerCase();
  return keywords.reduce((score, word) => score + (text.includes(word) ? 1 : 0), 0);
}

/** Cache key: the same question (case, spacing) asked again within a few minutes reuses the plan. */
export const planCacheKey = (query: string) => query.trim().toLowerCase().replace(/\s+/g, " ");
