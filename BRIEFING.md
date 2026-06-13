# BRIEFING — CCC Internal Dashboard

> Paste file ini di awal setiap sesi Claude Code biar context langsung ke-load.

---

## Stack & Deploy

| Item | Detail |
|------|--------|
| File | Single HTML file (`index.html`) — saat ini ~18,700 baris |
| Stack | Vanilla JS + Supabase JS SDK v2, Chart.js, Tabler Icons |
| Deploy | GitHub → Vercel (`careercclub-internal.vercel.app`) |
| Supabase project | `yqiijyylqocvohptkvau` |
| Working file | `index.html` di root folder project |

---

## Konvensi Wajib (Jangan Sampai Lupa)

### Edit & Verifikasi
- **Selalu verify JS** dengan `node -e "require('fs').readFileSync('index.html','utf8')"` atau Node eval setelah setiap edit
- **Python scripting** untuk multi-line replacement yang kompleks — jangan pakai str_replace kalau ada karakter khusus
- Setelah Python insert, **scan trailing backslash** yang ikut masuk ke HTML (bikin SyntaxError)

### JavaScript Patterns
- **UUID di onclick** wajib quoted args: `onclick="fn('${id}')"`  — jangan pernah unquoted
- **Timezone** selalu `toLocalDateISO(date)`, bukan `.toISOString()`
- **Mapper pattern**: setiap entitas punya `_xRowToJS` + `_xJSToRow`
- **`sb_load`** pakai `opts.eq` object format: `{ eq: { kolom: nilai } }`
- **`MENU_VERSION`** harus di-bump setiap ada nav page baru (saat ini: `v11_orgpartner`)
- **Patch `window.switchPage`** hanya boleh ada SATU — kalau perlu extend, merge ke patch yang sudah ada

### UI Patterns (Wajib Diikuti untuk Modul Baru)
- **Filter bar**: semua modul pakai `.filter-bar` CSS class — horizontal scrollable pills, satu baris, tombol aksi di ujung kanan
- **Activity log**: setiap aksi simpan/hapus/import wajib ada `logActivity()` call — sudah auto-inject di `sb_insert` / `sb_update` / `sb_delete`
- **Mobile card grid**: Graphic Design & Content Library pakai 2-kolom card grid
- **Custom label dropdown**: fixed positioning agar tidak terpotong parent overflow

---

## Supabase Tables

### Tables Utama
Lihat Supabase dashboard untuk schema lengkap. Tables yang dibuat custom di project ini:

| Table | Kolom Penting |
|-------|--------------|
| `activity_log` | id, user_name, module, action, detail, created_at |
| `pain_points` | ..., `labels text[] DEFAULT '{}'` (kolom tambahan) |

### SQL yang Pernah Dijalankan
```sql
-- Activity log table
CREATE TABLE IF NOT EXISTS activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name text,
  module text,
  action text,
  detail text,
  created_at timestamptz DEFAULT now()
);

-- Labels di pain_points
ALTER TABLE pain_points ADD COLUMN IF NOT EXISTS labels text[] DEFAULT '{}';
```

---

## Modules yang Ada

Dashboard, Program/Events, CRM, Talent Pool, B2B & Org Partnership, Content Evaluation, Meta Ads, Instagram Performance, Competitor Intel, Customer Knowledge (Pain Points + Analytics Free Class), Content Library, Graphic Design, Tickets, Products, Voucher, MT Vacancies, Resources, Settings

---

## Arsitektur Singkat

```
index.html
├── <style>          CSS variables, layout, component styles
├── <body>
│   ├── .sidebar     Nav kiri (hidden di PWA mode)
│   ├── .main
│   │   ├── .topbar  Header (bell notif, page title, bulan)
│   │   └── #mainContent  ← konten tiap page di-render ke sini
│   └── .pwa-bottom-nav   Bottom nav (visible di PWA mode)
└── <script>
    ├── Supabase init
    ├── Helper functions (sb_load, sb_insert, sb_update, sb_delete, logActivity, toLocalDateISO, ...)
    ├── switchPage()  ← router utama, render tiap page ke #mainContent
    ├── Module functions (initDashboard, initCRM, initPartner, ...)
    └── PWA init (pwa-mode class, bottom nav, swipe gestures)
```

### PWA Mode
- Aktif kalau `window.matchMedia('(display-mode: standalone)').matches`
- Tambahkan class `pwa-mode` ke `document.body`
- Semua styling khusus mobile ada di `body.pwa-mode { ... }`

---

## Helper Functions Penting

```js
// Load dari Supabase
await sb_load('table_name', {
  eq: { kolom: nilai },       // filter
  order: 'created_at',        // sort
  ascending: false
});

// Insert (otomatis logActivity)
await sb_insert('table_name', { ...payload });

// Update (otomatis logActivity)
await sb_update('table_name', id, { ...updates });

// Delete (otomatis logActivity)
await sb_delete('table_name', id);

// Log manual (kalau perlu)
await logActivity('Aksi', 'Nama Modul', 'detail string');

// Timezone-safe date
toLocalDateISO(new Date()); // → "2026-06-13"
```

---

## TO DO (Belum Dikerjain)

- [ ] **Analytics Free Class** — filter by series (saat ini semua series digabung)
- [ ] **Customer Knowledge labels** — filter di tab Dashboard (Pain Point cards), bukan cuma Database tab
- [ ] **Notif bell** — cek coverage `logActivity` di modul: Voucher, Products, Resources, Settings
- [ ] **Content Library** — tambah label filter di gallery page (bukan cuma di form)
- [ ] **PWA "Lainnya" menu** — modul yang belum masuk bottom nav (Tickets, CRM, Customer Knowledge, dll)
- [ ] **Pull-to-refresh** di PWA mode (touch slide down untuk reload page aktif)

---

## Known Issues / Notes Teknis

- Error `Invalid or unexpected token` di block 8 Node.js → pre-existing, bukan blocking (karakter unicode di comment)
- CORS error saat buka dari `file://` → normal, hanya jalan dari Vercel / localhost server
- `_origSwitchNotion` error → pastikan hanya ada SATU patch `window.switchPage`
- Python `lines.insert()` bisa inject trailing `\` → scan setelah setiap insert

---

## Cara Kerja di Claude Code (VS Code)

1. Buka folder project di VS Code
2. Buka terminal → `claude`
3. Paste isi file ini di awal sesi
4. Langsung minta fitur/fix — Claude Code bisa baca dan edit `index.html` langsung tanpa upload/download
5. Test lokal: `npx http-server -p 8000` lalu buka `localhost:8000`
6. Push ke GitHub → Vercel auto-deploy
