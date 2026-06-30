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

function parseJsonResponse(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || text;
  const start = Math.min(
    ...[candidate.indexOf("{"), candidate.indexOf("[")].filter((index) => index >= 0),
  );

  if (!Number.isFinite(start)) throw new Error("Anthropic returned no JSON payload.");
  return JSON.parse(candidate.slice(start).trim()) as unknown;
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
