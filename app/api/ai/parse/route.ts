import { auth } from "@/auth";
import { requestAnthropicJson } from "@/lib/ai/anthropic";

const schemas = {
  ticket: "{title, description, status: Open|In Review|In Progress|Done|Rejected, priority: Low|Med|High|Urgent, due_date: YYYY-MM-DD|null}",
  partnership: "{name, category, tier: Strategic|Standard, status: Approached|Sales Meet|Negotiation|Closed Deal|Closed Lost, contact_name, contact_email, contact_phone, scope, notes, input_date: YYYY-MM-DD|null}",
  story: "{tanggal: YYYY-MM-DD|null, status: Draft|Done, items: [{urutan, isi}]}",
  carousel: "{judul, tanggal_posting: YYYY-MM-DD|null, funnel: TOFU|MOFU|BOFU, cta, status: Draft|Done}",
  voucher: "{nama_event, kode, tipe: Flash Sale|Mega Sale|Bundle Sale|Voucher Gift, periode_mulai: YYYY-MM-DD|null, periode_selesai: YYYY-MM-DD|null, diskon_persen, maks_potongan, min_transaksi, kuota, notes}",
  task: "{title, description, status: Todo|In Progress|Done, priority: Low|Med|High|Urgent, phase: Pre Event|Event Day|Post Event, due_date: YYYY-MM-DD|null}",
} as const;

type ParseKind = keyof typeof schemas;

export async function POST(request: Request) {
  if (!(await auth())?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as { kind?: unknown; text?: unknown };
    if (typeof body.kind !== "string" || !(body.kind in schemas)) {
      return Response.json({ error: "Unsupported parser kind." }, { status: 400 });
    }

    if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 20_000) {
      return Response.json({ error: "Text must contain 1 to 20,000 characters." }, { status: 400 });
    }

    const kind = body.kind as ParseKind;
    const data = await requestAnthropicJson(
      `Extract a ${kind} record from Indonesian or English operational text. Return only valid JSON matching ${schemas[kind]}. Use null or an empty string when information is missing. Do not invent names, dates, or links.`,
      [{ type: "text", text: body.text.trim() }],
    );

    return Response.json({ data });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "AI parsing failed." },
      { status: 502 },
    );
  }
}
