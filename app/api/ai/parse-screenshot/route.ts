import { auth } from "@/auth";
import { requestAnthropicJson } from "@/lib/ai/anthropic";

const allowedMediaTypes = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  if (!(await auth())?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as {
      image?: unknown;
      mediaType?: unknown;
      categories?: unknown;
    };

    if (
      typeof body.image !== "string" ||
      !body.image ||
      body.image.length > 8_000_000 ||
      !/^[a-zA-Z0-9+/=]+$/.test(body.image) ||
      typeof body.mediaType !== "string" ||
      !allowedMediaTypes.has(body.mediaType)
    ) {
      return Response.json({ error: "A supported screenshot under 6 MB is required." }, { status: 400 });
    }

    const categories = Array.isArray(body.categories)
      ? body.categories.filter((item): item is string => typeof item === "string").slice(0, 100)
      : [];
    const categoryInstruction = categories.length
      ? `Choose kategori from: ${categories.join(", ")}.`
      : "Infer a short pain-point category in Indonesian.";

    const data = await requestAnthropicJson(
      `Read the social-media screenshot. Extract the main customer comment, identify the platform, and classify the pain point. Return only JSON shaped {"komentar":"","platform":"","kategori":"","username":""}. Supported platform labels are Instagram, TikTok, X, LinkedIn, WhatsApp, Facebook, YouTube, and Other. ${categoryInstruction} Do not invent unreadable text.`,
      [
        {
          type: "image",
          source: { type: "base64", media_type: body.mediaType, data: body.image },
        },
        { type: "text", text: "Extract the customer pain-point record from this screenshot." },
      ],
    );

    return Response.json(data);
  } catch (error) {
    console.error("[api/ai/parse-screenshot] failed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Screenshot parsing failed." },
      { status: 500 },
    );
  }
}
