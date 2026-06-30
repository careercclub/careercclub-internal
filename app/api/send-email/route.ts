import type { NextRequest } from "next/server";
import { auth } from "@/auth";

type Recipient = string | { email?: string };

type SendEmailBody = {
  to?: Recipient | Recipient[];
  subject?: string;
  html?: string;
  from_name?: string;
  from_email?: string;
  scheduled_at?: string;
};

type SendResult = {
  email: string | null;
  status: "sent" | "failed";
  id?: string;
  error?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(payload: unknown, init: ResponseInit = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init.headers || {}),
    },
  });
}

function getRecipientEmail(recipient: Recipient): string | null {
  return typeof recipient === "string" ? recipient : recipient.email || null;
}

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  if (!(await auth())?.user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as SendEmailBody;
    const { to, subject, html, from_name, from_email, scheduled_at } = body;

    if (!to || !subject || !html || subject.length > 300 || html.length > 500_000) {
      return json(
        { error: "Missing required fields: to, subject, html" },
        { status: 400 },
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
    }

    const recipients = Array.isArray(to) ? to : [to];
    if (recipients.length > 100) {
      return json({ error: "A maximum of 100 recipients is allowed per request." }, { status: 400 });
    }
    const results: SendResult[] = [];
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      const email = getRecipientEmail(recipient);

      if (!email) {
        failed += 1;
        results.push({ email: null, status: "failed", error: "Missing recipient email" });
        continue;
      }

      const payload = {
        from: `${from_name || "CareerCclub"} <${
          from_email || process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
        }>`,
        to: [email],
        subject,
        html,
        ...(scheduled_at ? { scheduled_at } : {}),
      };

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        id?: string;
        message?: string;
        error?: string;
      };

      if (response.ok) {
        sent += 1;
        results.push({ email, status: "sent", id: data.id });
      } else {
        failed += 1;
        results.push({
          email,
          status: "failed",
          error: data.message || data.error || "Unknown error",
        });
      }
    }

    return json({ success: true, sent, failed, results });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
