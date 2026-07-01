import "server-only";

type AnthropicContent =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "base64"; media_type: string; data: string };
    };

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
  error?: { message?: string };
};

function parseJsonResponse(text: string): unknown {
  const cleaned = text.trim();
  const candidates: string[] = [];
  // Prefer a fenced ```json ... ``` block when present.
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) candidates.push(fenced.trim());
  // Then the whole reply, then a first-brace..last-brace slice (tolerates prose around the JSON).
  candidates.push(cleaned);
  const starts = [cleaned.indexOf("{"), cleaned.indexOf("[")].filter((index) => index >= 0);
  if (starts.length) {
    const start = Math.min(...starts);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (end > start) candidates.push(cleaned.slice(start, end + 1));
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // fall through to the next strategy
    }
  }
  throw new Error(`Anthropic did not return valid JSON. Raw reply: ${cleaned.slice(0, 300)}`);
}

export async function requestAnthropicJson(system: string, content: AnthropicContent[]) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 1200,
      temperature: 0,
      system,
      messages: [{ role: "user", content }],
    }),
    signal: AbortSignal.timeout(45_000),
  });

  const payload = (await response.json()) as AnthropicResponse;
  if (!response.ok) throw new Error(payload.error?.message || "Anthropic request failed.");

  const text = payload.content?.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Anthropic returned an empty response.");
  return parseJsonResponse(text);
}
