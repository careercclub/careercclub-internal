// api/send-email.js — Vercel Edge Function (proxy ke Resend)
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = await req.json();
    const { to, subject, html, from_name, from_email, scheduled_at } = body;

    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, html' }), { status: 400 });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 500 });
    }

    // Kirim satu per satu kalau array (blast), atau single
    const recipients = Array.isArray(to) ? to : [to];
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const recipient of recipients) {
      const payload = {
        from: `${from_name || 'CareerCclub'} <${from_email || 'noreply@careercclub.com'}>`,
        to: [typeof recipient === 'string' ? recipient : recipient.email],
        subject,
        html,
      };
      if (scheduled_at) payload.scheduled_at = scheduled_at;

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        successCount++;
        results.push({ email: payload.to[0], status: 'sent', id: data.id });
      } else {
        failCount++;
        results.push({ email: payload.to[0], status: 'failed', error: data.message || 'Unknown error' });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      sent: successCount,
      failed: failCount,
      results,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
}
