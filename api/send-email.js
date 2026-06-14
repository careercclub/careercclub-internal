// api/send-email.js — Vercel Serverless Function (proxy ke Resend)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { to, subject, html, from_name, from_email, scheduled_at } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
    }

    const recipients = Array.isArray(to) ? to : [to];
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const recipient of recipients) {
      const payload = {
        from: `${from_name || 'CareerCclub'} <${from_email || 'onboarding@resend.dev'}>`,
        to: [typeof recipient === 'string' ? recipient : recipient.email],
        subject,
        html,
      };
      if (scheduled_at) payload.scheduled_at = scheduled_at;

      const apiRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await apiRes.json();
      if (apiRes.ok) {
        successCount++;
        results.push({ email: payload.to[0], status: 'sent', id: data.id });
      } else {
        failCount++;
        results.push({ email: payload.to[0], status: 'failed', error: data.message || 'Unknown error' });
      }
    }

    return res.status(200).json({
      success: true,
      sent: successCount,
      failed: failCount,
      results,
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
