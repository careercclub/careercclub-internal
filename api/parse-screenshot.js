// api/parse-screenshot.js — Vercel Serverless Function (proxy ke Anthropic API)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { image, mediaType } = req.body;
    if (!image || !mediaType) {
      return res.status(400).json({ error: 'Missing required fields: image, mediaType' });
    }

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: image },
              },
              {
                type: 'text',
                text: 'Kamu adalah asisten yang membantu mengekstrak informasi dari screenshot komentar/DM/diskusi media sosial tentang persiapan Management Trainee (MT).\n\nDari gambar ini, ekstrak:\n1. Teks komentar/pertanyaan utama (bersihkan dari username, timestamp, emoji berlebihan)\n2. Platform media sosial (Instagram/TikTok/Threads/X/YouTube/WhatsApp/lainnya)\n3. Kategori yang paling sesuai dari pilihan berikut:\n   - General Question (pertanyaan umum seputar MT)\n   - Interview Phase (pertanyaan seputar interview, FGD, LGD)\n   - Assessment Test Phase (pertanyaan seputar psikotes, tes online)\n   - Panel Presentation Phase (pertanyaan seputar presentasi panel)\n   - Offer & Negotiation (pertanyaan seputar offering, negosiasi gaji)\n   - Post-MT (pertanyaan seputar kehidupan setelah lolos MT)\n\nJawab dalam JSON saja tanpa penjelasan lain dan tanpa markdown backticks:\n{"komentar": "...", "platform": "...", "kategori": "..."}',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    const text = (data.content && data.content[0] && data.content[0].text) || '';

    let parsed;
    try {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : text);
    } catch (_) {
      parsed = { komentar: text, platform: '' };
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
