# Claude connector (MCP)

Sejak Putaran 62, CareerCclub Internal bisa dipasang sebagai **custom connector** di Claude. Setelah dipasang, Claude bisa membaca semua modul dan menambah atau mengubah data atas nama orang yang menyambungkannya.

## Cara pasang

1. Di app, buka **Settings → Claude access → Connector**, lalu klik **Copy URL**. Alamatnya `https://internal.ccclub.id/api/mcp`.
2. Di Claude, buka **Settings → Connectors → Add custom connector** dan tempel URL tadi.
3. Claude membuka halaman login internal.ccclub.id. Login dengan akun CareerCclub sendiri, lalu klik **Allow Claude**.
4. Selesai. Coba minta di chat: "lihat ticket yang assigned ke gua" atau "tambahin partner PT X dengan PIC Rina".

Orang dari akun Claude lain tetap butuh akun di internal.ccclub.id. Haknya mengikuti role akun itu.

## Yang bisa dan tidak bisa

| Bisa | Tidak bisa |
|---|---|
| Baca semua modul yang bisa dibuka di app (`list_modules`, `search`, `list_records`, `get_record`) | Menghapus apa pun |
| Tambah dan ubah data (`add_record`, `update_record`) dengan aturan yang sama dengan form di app | Melihat atau mengisi password |
| Impor massal Instagram, Job Vacancy MT, Competitor Intel, dan Customer Knowledge (preview dulu, baru apply) | Melihat atau mengisi nomor rekening Collaborators (ditampilkan tersamar `•••• 1234`) |
| | Mengisi file atau gambar (upload tetap lewat app) |
| | Melihat ticket yang tidak boleh dilihat di app |
| | Mengubah modul khusus admin, kalau bukan admin |

Setiap perubahan tercatat di activity log atas nama "Nama via Claude".

## Mengatur koneksi

- **Settings → Claude access → Connector** (khusus admin) menampilkan siapa saja yang tersambung dan kapan terakhir dipakai.
- **Disconnect Claude** langsung memutus koneksi.
- Akun yang di-Block juga langsung terputus.

## Teknis

- **OAuth 2.1:** pendaftaran client otomatis (DCR), PKCE S256, access token 1 jam, dan refresh token 30 hari yang selalu diganti tiap dipakai. Database hanya menyimpan hash.
- **Alamat discovery:** `/.well-known/oauth-protected-resource/api/mcp` dan `/.well-known/oauth-authorization-server`.
- **Alamat redirect yang diterima:** hanya callback Claude (`https://claude.ai/api/mcp/auth_callback`) dan loopback untuk Claude Code.
- **Kode:**
  - `lib/mcp/*` (aturan baca/tulis ada di `data-rules.ts`);
  - `app/api/mcp`, `app/api/oauth/*`, `app/oauth/authorize`;
  - migrasi `034_claude_connector.sql`.
- **Prasyarat:** di production `AUTH_URL` harus diisi (`https://internal.ccclub.id`), karena alamat di metadata OAuth dibangun dari situ.
