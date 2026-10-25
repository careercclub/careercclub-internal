# Log Putaran

"Putaran" = satu siklus perbaikan (PDCA/kaizen) yang dijalankan setiap kali ada perubahan:

1. **Plan** — heuristic evaluation / UX audit (10 heuristik Nielsen + prinsip build Gastron). Temuan dipisah: prioritas vs nice-to-have.
2. **Do** — kerjakan temuan prioritas.
3. **Check** — regression testing (unit test, tsc, lint, klik semua tombol di browser) + design review (screenshot HP & desktop).
4. **Act** — centang Definition of Done di bawah, catat hasilnya di log ini, nice-to-have masuk antrean putaran berikutnya.

## Definition of Done (checklist rilis)

- [ ] `npm test` lolos semua
- [ ] `npx tsc --noEmit` bersih
- [ ] `npm run lint` bersih untuk file yang diubah
- [ ] Semua tombol di alur yang diubah diklik otomatis, tanpa tombol mati dan tanpa error console
- [ ] Isian wajib: kosong → ditandai merah + difokus, tidak tersimpan
- [ ] Label tombol: sebut objeknya ("Delete content", bukan "Delete"); tombol pembuka = tombol simpan
- [ ] Bahasa UI: Content Library memakai bahasa Inggris penuh (keputusan user, Putaran 2); tidak ada teks campur
- [ ] Aksi berbahaya pakai konfirmasi, fokus default di "Cancel"
- [ ] Aturan validasi ada di satu fungsi bersama, dipakai semua jalur
- [ ] Tampilan dicek di lebar HP (390px) dan desktop, tanpa scroll horizontal
- [ ] `npm run build` lolos (dijalankan di mesin dengan node_modules yang cocok)

---

## Putaran 1 — Content Library: edit & hapus konten (11 Okt 2026)

**Perubahan dasar:** tombol "Edit konten" dan "Hapus konten" di popup konten; form edit memakai form yang sama dengan tambah; validasi dipindah ke `lib/content-library/payload.ts` (dipakai tambah, edit, dan kirim dari Design Assets); edit & hapus tercatat di activity log.

### Plan — temuan heuristic evaluation

| # | Temuan | Heuristik / prinsip | Status |
|---|--------|--------------------|--------|
| P1 | Dua tombol "Tambah" beda fungsi (konten vs label); pembuka "Tambah" tapi simpan "Simpan" | Konsistensi; prinsip 6 | Diperbaiki: "Tambah konten" / "Tambah label" |
| P2 | Edit tipe Organic → Ads membuat konten "hilang" dari tab aktif | Visibilitas status | Diperbaiki: tab ikut pindah + notice menyebut tab tujuan |
| P3 | Label kosong hanya muncul teks error di bawah form | Pencegahan error; prinsip 4 | Diperbaiki: input label merah + difokus |
| P4 | Notice sukses tidak pernah hilang & berwarna hijau | Desain minimalis; prinsip 9 | Diperbaiki: hilang setelah 4 detik, warna utama |
| P5 | Konfirmasi hapus: fokus tidak di tombol aman | Pencegahan error | Diperbaiki: fokus di "Batal", Enter tidak menghapus |
| P6 | Aksi popup terpecah 2 baris (link terpisah dari edit/hapus) | Minimalis; prinsip 8 | Diperbaiki: satu baris aksi |
| P7 | Konfirmasi hapus di HP: tombol tidak rata | Design review | Diperbaiki: tombol sejajar penuh |

### Check — hasil

- Unit test: **43/43 lolos** (10 tes baru untuk aturan konten & gambar)
- Klik tombol otomatis (Chromium, data contoh): **39/39 lolos, 5× berturut-turut**
- tsc & lint: bersih
- Ditemukan saat Check lalu diperbaiki: fokus "Batal" tidak jalan dengan `autoFocus` di dalam dialog → diganti fokus lewat ref
- Belum dijalankan: `npm run build` (node_modules di arsip adalah build Windows)

### Nice-to-have (antrean putaran berikutnya)

- ~~N1. Label campur bahasa~~ → diputuskan user: bahasa Inggris penuh (Putaran 2)
- N2. Peringatan perubahan belum disimpan saat menutup form edit
- N3. Bersihkan gambar yatim di storage (sekarang sengaja tidak dihapus karena bisa dipakai bersama Design Assets)
- N4. Label yang mepet ke gambar di popup versi HP

---

## Putaran 2 — Content Library: satu bahasa (Inggris) (11 Okt 2026)

Keputusan user: modul Content Library memakai bahasa Inggris penuh.

### Kamus istilah (pakai → jangan pakai)

| Pakai | Jangan pakai | Arti |
|-------|--------------|------|
| content | konten, item, post | satu entri di Content Library |
| Idea type (Organic Ideas / Ad Ideas) | Tipe konten, category | kolom `tipe` |
| Format (Carousel, Reels/Video, …) | Jenis, type | kolom `jenis` |
| Add content / Edit content / Save content / Delete content | Tambah, Simpan, Hapus, Edit | tombol aksi |
| Add label / Remove label | Tambah | label |
| Add image / Remove image | Tambah gambar, Hapus gambar | gambar |
| Cancel | Batal | batal |
| required / optional | wajib / opsional | penanda isian |

"Format" dipilih untuk `jenis` supaya tidak bentrok dengan "Idea type" (`tipe`); dua-duanya kalau diterjemahkan jadi "type".

### Plan — temuan

| # | Temuan | Heuristik / prinsip | Status |
|---|--------|--------------------|--------|
| P1 | Seluruh teks modul (tombol, label, placeholder, pesan sukses/error, aria-label, pesan error server) campur Indonesia–Inggris | Konsistensi; prinsip 6 | Diperbaiki: Inggris penuh sesuai kamus |
| P2 | Kolom Likes selalu bergaris merah walau sudah terisi — merah seharusnya hanya untuk error | Prinsip 9 | Diperbaiki: merah hanya saat isian tidak valid (`:user-invalid`) |

P2 ditemukan saat design review di tahap Check.

### Check — hasil

- Unit test: **43/43 lolos** (pesan error baru ikut dites)
- Klik tombol otomatis: **42/42 lolos, 3× berturut-turut** (3 cek baru: memindai layar, aria-label, placeholder di popup, konfirmasi hapus, dan form edit → nol teks Indonesia)
- tsc & lint: bersih

### Pengecualian yang disengaja

- Catatan activity log tetap "Tambah / Edit / Hapus" karena log dipakai bersama semua modul lain yang berbahasa Indonesia.
- Komponen bersama (tombol X di dialog, menu samping) tidak diubah karena di luar modul ini.

### Nice-to-have (antrean)

- N2. Peringatan perubahan belum disimpan saat menutup form edit
- N3. Bersihkan gambar yatim di storage
- N4. Label yang mepet ke gambar di popup versi HP
- N5. Samakan bahasa di modul lain / komponen bersama kalau mau satu bahasa untuk seluruh app

---

## Putaran 3 — Search "Cari apa saja" (Ctrl+K) mencari isi data (11 Okt 2026)

**Permintaan:** search di atas tidak hanya mencari modul, tapi semua yang pernah diinput (contoh: "email ccc", nama design asset), dan hasilnya bisa dibuka secara fungsional.

**Cara kerja:**
- `lib/search/registry.ts` — daftar tabel & kolom yang bisa dicari, diturunkan otomatis dari katalog modul (`lib/records/catalog.ts`). Field baru di katalog otomatis ikut bisa dicari.
- `lib/search/query.ts` + `GET /api/search?q=` — cari di 51 tabel, semua kata wajib cocok (ILIKE ALL), satu koneksi DB, satu tabel error tidak menjatuhkan pencarian.
- Search Ctrl+K — grup **Halaman** dan **Data**; tiap hasil data menampilkan judul, bagian yang cocok, dan nama modul.
- Klik hasil → `<halaman>?focus=<id>` → `RecordFocus` (global) memberi tahu modul, modul membuka tab/halaman/popup yang tepat, lalu data di-scroll dan disorot. `?focus` dihapus dari URL setelahnya.

**Keamanan:** password, secret/token, kolom ID, dan kunci file storage tidak pernah dicari maupun ditampilkan; `app_settings` dikecualikan; endpoint wajib login; karakter `%`/`_` di-escape; modul yang disembunyikan di Settings tidak muncul di hasil.

### Matriks keterlacakan (tabel → halaman → cara data ditunjukkan)

| Cara | Tabel |
|------|-------|
| Popup/detail langsung terbuka | buyers (CRM), content_evaluations, tickets, talent_pool, collaborators, partners, org_partners, competitor_profiles, pain_points, content_library, events (Program → tab Events) |
| Kartu/daftar di-scroll + disorot (filter/tab direset) | resources, ads_contents, vouchers, story_plan_dates, event_rundown |
| Tabel umum: lompat ke halaman + form edit terbuka | 36 tabel lain (products, design_assets, tasks, deals, outreach, competitor_*, product_*, tkt_*, carousel/story/kol/mt-story, dst.) |

Dijaga oleh tes `lib/search/coverage.test.mjs`: tiap tabel yang bisa dicari wajib punya halaman tujuan yang bisa menunjukkan datanya.

### Plan — temuan heuristic evaluation

| # | Temuan | Heuristik / prinsip | Status |
|---|--------|--------------------|--------|
| P1 | Search hanya mencari nama modul | Fleksibilitas & efisiensi | Dibangun: pencarian isi data lintas 51 tabel |
| P2 | Hasil harus bisa "dibuka", bukan sekadar pindah halaman | Kecocokan dengan dunia nyata | Dibangun: buka popup / lompat halaman / sorot |
| P3 | Filter lokal (mis. "Search resources") bisa menyembunyikan data yang dicari | Visibilitas status | Diperbaiki: filter/tab modul direset saat membuka hasil |
| P4 | Data yang sudah dihapus → halaman terbuka tanpa penjelasan | Bantu pulih dari error | Diperbaiki: pesan "Data tidak tampil… Mungkin sudah dihapus." |
| P5 | Konteks hasil "Email CCC" menampilkan catatan, bukan email | Kenali bukan ingat | Diperbaiki (ditemukan saat design review): judul cocok → tampilkan email/username/link |
| P6 | Sorotan berkedip, bisa tak terlihat | Visibilitas status | Diperbaiki (design review): sorotan tetap 3 detik |
| P7 | **Tombol search tidak ada sama sekali di HP** (`hidden sm:flex`), padahal HP tidak punya Ctrl+K | Aksesibilitas; prinsip 1 | Diperbaiki (design review): ikon search tampil di HP |
| P8 | Ketik 1 huruf tidak jelas kenapa data tidak dicari | Bantuan | Diperbaiki: petunjuk "Ketik minimal 2 huruf…" |
| P9 | Aturan "modul disembunyikan" berpotensi dobel antara halaman & data | Prinsip 2 | Diperbaiki: satu fungsi `hiddenPathPredicate` dipakai keduanya |

### Check — hasil

- Unit test: **55/55 lolos** (12 tes baru: aturan pencarian, keamanan password, keterlacakan halaman)
- SQL asli dijalankan ke PostgreSQL (PGlite) dengan data contoh: **13/13 lolos** — "email ccc", "ajiw" (notes), "odyssey" (design asset + content library), password & kunci file tidak bisa dicari, `%`/`_` aman, input SQL injection aman, 51 tabel ter-query tanpa error
- End-to-end di Chromium (ketik → klik → modul terbuka → sorot): **33/33 lolos, 3× berturut-turut**, termasuk HP
- tsc bersih; lint bersih untuk kode baru
- Ditemukan saat Check lalu diperbaiki: 1 error lint di `record-focus.tsx` (setState di effect)

### Pengecualian yang disengaja

- 4 error lint lama di `competitor-tools.tsx` & `content-planning-tools.tsx` (setState di effect) sudah ada sebelum putaran ini; tidak disentuh.
- `mt_vacancies` (Job Vacancy MT) belum ada di katalog modul, jadi belum ikut dicari.
- Teks search tetap bahasa Indonesia karena komponen bersama semua modul (keputusan bahasa Inggris hanya untuk Content Library).

### Nice-to-have (antrean)

- N6. Job Vacancy MT ikut dicari (perlu didaftarkan di katalog)
- N7. Sorot kata yang cocok (bold) di hasil search
- N8. Pencarian terakhir / data yang baru dibuka muncul saat search masih kosong
- N9. Index full-text (pg_trgm) kalau data sudah puluhan ribu baris dan search terasa lambat
- N10. Untuk tabel kecil (CTA, klasifikasi) arahkan ke halaman induknya, bukan halaman master data

---

## Putaran 4 — Audit ulang search + antrean (11 Okt 2026)

### Plan — temuan

| # | Temuan | Heuristik / prinsip | Status |
|---|--------|--------------------|--------|
| P1 | **Kebocoran akses:** halaman Tickets hanya menampilkan tiket sesuai role (staff: miliknya / ditugaskan ke dia; lead: divisinya), tapi search Putaran 3 menampilkan semua tiket ke siapa pun | Keamanan; prinsip 2 & 3 | Diperbaiki: aturan dipindah ke `lib/tickets/visibility.ts`, dipakai halaman Tickets **dan** search |
| P2 | Job Vacancy MT tidak bisa dicari (tidak ada di katalog) | Permintaan user ("apa pun yang pernah diinput") | Dibangun: daftar khusus search `lib/search/extra-definitions.ts` + klik hasil membuka form lowongan |
| P3 | Hasil search tidak menunjukkan kata yang cocok | Kenali bukan ingat | Dibangun: kata yang cocok ditebalkan (label kolom tidak ikut — ditemukan saat Check) |
| P4 | Menutup form Content Library (Cancel / Esc / klik luar) membuang isian tanpa peringatan | Kontrol & kebebasan user; pencegahan error | Dibangun: "Discard unsaved changes?" — fokus default di **Keep editing**; form tanpa perubahan langsung tertutup |
| P5 | Popup Content Library di HP: label menimpa gambar | Design review | Diperbaiki: baris popup tidak lagi ikut terhimpit (`grid-auto-rows: max-content`) |
| P6 | Petunjuk keyboard "↑↓ pilih ↵ buka" tampil di HP | Minimalis | Diperbaiki: hanya tampil di layar lebar |

**Keputusan sengaja tidak diambil sendiri:** kalender di Dashboard dan Program menampilkan **semua** tiket ke semua orang (tidak memakai aturan role Tickets). Ini sudah ada sebelum putaran ini dan bisa jadi disengaja untuk kalender operasional tim → ditanyakan ke user.

**Perbedaan kecil aturan tiket (lebih aman):** role dibaca tanpa beda huruf besar-kecil ("Admin" = "admin"); email kosong tidak lagi bisa cocok dengan orang tiket ber-email kosong.

### Check — hasil

- Unit test: **63/63 lolos** (8 tes baru: 6 aturan akses tiket, Job Vacancy MT, penebalan kata)
- SQL asli ke PostgreSQL: **18/18 lolos** — staff Ani hanya menemukan tiket yang ditugaskan ke dia, akun asing tidak menemukan tiket, lead marketing tidak melihat tiket ops, admin melihat semua; Job Vacancy MT ditemukan lewat role di dalam array
- E2E search: **34/34 lolos, 3×**
- E2E Content Library: **51/51 lolos, 3×** (9 cek baru: peringatan buang perubahan, Esc, fokus aman, hapus gambar dihitung perubahan, label tidak menimpa gambar di HP)
- Regresi menangkap perubahan perilaku yang disengaja: tes lama "Cancel langsung menutup form yang sudah diisi" diperbarui ke perilaku baru
- tsc bersih; lint bersih untuk kode baru (4 error lama di 2 file tetap)

### Nice-to-have (antrean)

- N3. Bersihkan gambar yatim di storage
- N5. Satu bahasa untuk seluruh app (kalau diinginkan)
- N8. Pencarian terakhir / data yang baru dibuka saat search masih kosong
- N9. Index pg_trgm kalau data sudah puluhan ribu baris
- N10. Tabel master kecil diarahkan ke halaman induknya
- N11. Hasil search bisa dibaca screen reader (role listbox/option)
- ~~N12. Terapkan aturan akses tiket di kalender Dashboard & Program~~ → diputuskan user: disaring sesuai role (Putaran 5)

---

## Putaran 5 — Aturan role tiket di semua tempat + search lebih ramah (11 Okt 2026)

**Keputusan user:** kalender Dashboard & Program disaring sesuai role, sama dengan halaman Tickets.

### Plan — temuan

| # | Temuan | Heuristik / prinsip | Status |
|---|--------|--------------------|--------|
| P1 | Kalender Dashboard & Program menampilkan semua tiket ke semua orang | Keamanan; prinsip 3 | Diperbaiki: semua halaman memakai `getVisibleTicketWorkspace(viewer)` |
| P2 | Badge "Tickets 99+" di menu menghitung **semua** tiket, padahal halamannya hanya menampilkan tiket yang boleh dilihat | Prinsip 3 (angka sama dari fungsi sama) | Diperbaiki: `countVisibleTickets(viewer)`; hitungan tiket lama di `getDashboardCounts` dihapus |
| P3 | Search kosong tidak membantu orang yang ingin membuka lagi data yang baru dilihat | Kenali bukan ingat; prinsip 1 | Dibangun: grup "Terakhir dibuka" (maks 5, per browser) + tombol "Hapus riwayat" |
| P4 | Hasil search tidak bisa dibaca screen reader dengan benar | Aksesibilitas | Dibangun: combobox + listbox + option, pilihan aktif diumumkan |
| P5 | **Bug lama:** membuka search dengan Ctrl+K masih berisi ketikan sebelumnya (reset hanya terjadi saat klik tombol) | Konsistensi | Diperbaiki (ditemukan saat Check): satu fungsi `openPalette()` untuk tombol, Ctrl+K, dan dialog |
| P6 | Riwayat dari penyimpanan browser bisa berisi link ke situs lain (`//situs-lain`) | Keamanan | Dicegah: hanya path internal yang diterima |
| P7 | Style global `button { font: inherit }` menimpa ukuran teks Tailwind di tombol | Design review | Diakali di tombol baru (ukuran di `span`); dicatat untuk komponen lain |

### Matriks keterlacakan aturan role tiket

| Tempat | Sumber data | Dijaga tes |
|--------|-------------|-----------|
| Halaman Tickets | `getVisibleTicketWorkspace` | `lib/tickets/traceability.test.mjs` |
| Kalender + "Upcoming" Dashboard | `getVisibleTicketWorkspace` | idem |
| Kalender Program | `getVisibleTicketWorkspace` | idem |
| Badge menu Tickets | `countVisibleTickets` | idem + SQL |
| Search Ctrl+K | `ROW_GUARDS.tickets` → `ticketVisibility` | idem + SQL |

Tes statis juga gagal kalau nanti ada halaman baru yang memanggil `getTicketWorkspace()`/`listTickets()` langsung.

### Check — hasil

- Unit test: **69/69 lolos** (6 baru: keterlacakan aturan tiket, riwayat search)
- SQL asli ke PostgreSQL lewat client DB asli: **22/22 lolos** — badge staff = 1 (bukan 2), admin = semua, akun asing = 0; kalender staff hanya tiketnya; daftar orang tetap lengkap
- E2E search: **46/46 lolos, 3×** (12 cek baru: riwayat, urutan, tanpa duplikat, hapus riwayat, modul tersembunyi tidak bocor lewat riwayat, combobox/listbox, Ctrl+K kotak kosong, penyimpanan browser diblokir tetap jalan)
- E2E Content Library: **51/51 lolos**
- tsc bersih; lint bersih untuk kode baru

### Butuh keputusan user

- N13. **Hak mengubah tiket** belum memakai aturan role: aksi edit/hapus tiket dan route Google Calendar menerima ID tiket apa pun dari user yang login. Usul: hanya yang boleh **melihat** tiket boleh **mengubah**-nya (admin tetap semua).

### Nice-to-have (antrean)

- N3. Bersihkan gambar yatim di storage
- N5. Satu bahasa untuk seluruh app (kalau diinginkan)
- N9. Index pg_trgm kalau data sudah puluhan ribu baris
- N10. Tabel master kecil diarahkan ke halaman induknya
- N14. Rapikan style global `button { font: inherit }` supaya ukuran teks Tailwind di tombol berlaku (perlu dicek di semua modul)

---

## Putaran 6 — Regression testing "buka hasil search" di semua modul khusus (11 Okt 2026)

**Kenapa:** fitur "klik hasil search → modul terbuka di data itu" dipasang di 14 modul khusus pada Putaran 3, tapi tes browser baru mencakup 4 modul. Sisanya hanya dicek statis (ada kode handler). Putaran ini membuka **13 modul sisanya** di browser dengan data contoh dan link `?focus=` — sengaja memilih data yang **bukan** tampilan default (event kedua, tiket berstatus Done, voucher lama, minggu yang tertutup, halaman tabel ke-3).

### Plan / Check — temuan

| # | Temuan | Jenis | Status |
|---|--------|-------|--------|
| P1 | **Bug Putaran 3:** `RecordFocus` (di shell, dirender sebelum halaman) mengirim sinyal pertama **sebelum** modul sempat mendengarkan. Kalau datanya sudah terlihat dari awal (mis. baris tiket), data hanya disorot dan **detailnya tidak pernah terbuka** | Bug | Diperbaiki: sinyal pertama ditunda satu giliran (`setTimeout(tick, 0)`) |
| P2 | **Content Planning:** tanggal story di minggu yang tertutup ("Minggu 4 Oktober") tidak bisa ditunjukkan → pesan "Data tidak tampil" | Bug | Diperbaiki: minggu yang berisi tanggal itu dibuka otomatis |
| P3 | Tes lama Content Library kadang gagal (cek dialog sebelum animasi tutup selesai) | Tes flaky | Diperbaiki di skrip tes (menunggu sampai benar-benar tertutup) |
| — | CRM & Content Evaluation sempat "gagal" | Salah di skrip tes, aplikasi benar | Cek tes diperbaiki |

### Hasil per modul (link `?focus=` dibuka langsung)

| Modul | Yang terjadi | Hasil |
|-------|--------------|-------|
| CRM | Detail pembeli terbuka (pembeli ada di halaman tabel ke-3) | ✅ |
| Tickets | Tab "Semua", tiket Done ikut tampil, **detail tiket terbuka** (setelah P1) | ✅ |
| Talent Pool | Detail kandidat terbuka | ✅ |
| Program | Tab Events + event kedua terpilih | ✅ |
| B2B Partnership | Form partner terbuka | ✅ |
| Competitor Intel | Form profil kompetitor terbuka | ✅ |
| Customer Knowledge | Form pain point terbuka | ✅ |
| Content Evaluation | Detail evaluasi terbuka (data lama, di luar range default) | ✅ |
| Meta Ads | Kartu disorot | ✅ |
| Voucher | Pindah ke tab list + kartu disorot | ✅ |
| Content Planning | Tab Story + minggu dibuka + tanggal disorot (setelah P2) | ✅ |
| Rundown | Event pindah + baris rundown disorot | ✅ |
| Job Vacancy MT | Form lowongan terbuka | ✅ |

- E2E modul khusus: **13/13 lolos, 3×**
- Regresi E2E search: **46/46 lolos, 2×**; E2E Content Library: **51/51 lolos, 5×**
- Unit test **69/69**; tsc bersih; lint bersih untuk kode baru

### Nice-to-have (antrean)

- N3. Bersihkan gambar yatim di storage
- N5. Satu bahasa untuk seluruh app (kalau diinginkan)
- N9. Index pg_trgm kalau data sudah puluhan ribu baris
- N10. Tabel master kecil diarahkan ke halaman induknya
- N14. Rapikan style global `button { font: inherit }`
- N15. Popup Content Evaluation (dan modal custom lain) belum punya `role="dialog"` — screen reader tidak tahu itu popup
- N16. Pindahkan tes browser (sekarang di luar repo, pakai Playwright) ke dalam repo + tambah `npm run test:e2e`, supaya Claude/dev lain bisa menjalankan ulang

### Masih menunggu keputusan user

- N13. Hak **mengubah** tiket (edit/hapus/sinkron kalender) belum memakai aturan role.

---

## Putaran 7 — Audit UI/UX semua modul (11 Okt 2026) — *audit saja, kode belum diubah*

**Keputusan user:** arah = *rapikan & samakan* (bukan desain ulang); bahasa UI = **Inggris semua**; urutan = audit dulu; keluhan utama = susah nemu fitur, tidak konsisten antar modul, form ribet/panjang, tampilan HP.

**Cara audit:** (1) pindai kode 49 komponen + 11 file CSS; (2) render app shell asli + 22 halaman di Chromium dengan data contoh, lebar desktop 1280px dan HP 390px, ukur elemen keluar layar, tombol <32px, teks <11px, bahasa teks di layar; (3) cek manual screenshot.

### Temuan lintas modul (akar masalah)

| # | Temuan | Angka | Keluhan |
|---|--------|-------|---------|
| A1 | **Form minta ketik JSON / UUID / ID mentah** (mis. "Assignee UUIDs", "Product UUIDs", "History JSON") di form tabel umum | **58 isian di 36 dari 54 form**; form Tickets 9 isian mentah; form Content Evaluation 40 isian dalam satu layar | Form ribet |
| A2 | **27 sub-halaman hanya bisa dicapai dari deretan link di dalam panel "kelola" yang terlipat**; menu samping hanya 21 dari 57 halaman | 36 halaman tidak ada di menu | Susah nemu fitur |
| A3 | **Satu hal diurus di dua tempat:** master data (divisi/orang/tipe tiket, platform/kategori, CTA, klasifikasi, mapping, link template) ada di Settings **dan** di sub-halaman sendiri; Products punya tab Features/Benefits/… **dan** sub-halaman untuk masing-masing; Partnership/Competitor punya tab Deals/Outreach/Products **dan** sub-halaman tabel | ±20 jalur dobel | Tidak konsisten (prinsip 2) |
| A4 | **Bahasa campur** di 11 komponen; kalender & tanggal pakai bahasa Indonesia; nav HP "Konten", "Lainnya" | ±600 teks UI perlu diterjemahkan | Tidak konsisten |
| A5 | **3 jenis popup berbeda** (Dialog shadcn, Modal buatan sendiri, div overlay) + **37 popup bawaan browser** (`window.confirm/alert/prompt`) yang memblokir layar dan tidak bisa diberi gaya | 17 + 37 | Tidak konsisten |
| A6 | **Tabel umum (36 halaman) tidak ramah pemula:** kolom menampilkan ID mentah ("pr1") bukan nama, tombol "Add record/Save record/Delete record", pesan kosong "Add the first record when the VPS database is connected" (bahasa developer), hapus tanpa konfirmasi | 36 halaman | Form ribet, tidak konsisten |
| A7 | **Tampilan HP:** tabel lebar & filter keluar layar; tombol di bawah 32px di semua halaman (9–56 per halaman); navigasi bawah HP memberi slot utama ke B2B/Org, sementara CRM/Tickets tersembunyi di "Lainnya" | lihat tabel | HP |
| A8 | **Teks terlalu kecil** (<11px) di semua halaman; 145 aturan font kecil di CSS tabel umum saja | 170 di komponen + 245 di CSS | HP |
| A9 | **Warna:** 137 warna hex berbeda; kartu angka/pill memakai biru, hijau, kuning, ungu, teal untuk membedakan hal (prinsip 9: satu palet) | 223 di komponen + 198 di CSS | Tidak konsisten |
| A10 | Label tombol generik: "Simpan" ×9, "Tambah" ×6, "Hapus" ×4 tanpa objek | 20 | Tidak konsisten (prinsip 6) |
| A11 | Style global `button { font: inherit }` menimpa ukuran teks di semua tombol | semua tombol | Tidak konsisten |
| A12 | Settings: 10 tab dalam 2 baris berantakan, campur bahasa | 1 halaman | Susah nemu fitur |

### Per modul (HP 390px)

| Modul | Bahasa di layar (kata ID/EN) | Elemen keluar layar | Tombol <32px | Teks <11px | Popup bawaan browser | Warna hardcode |
|---|---|---|---|---|---|---|
| Dashboard | 11/4 | 0 | 16/38 | 68 | 1 | 16 |
| Content Planning | 10/3 | 1 | 12/39 | 56 | 6 | 49 |
| Content Evaluation | 23/12 | 1 | 22/93 | 86 | 1 | 0 |
| Meta Ads | 6/4 | 0 | 9/41 | 35 | 0 | 2 |
| Instagram | 4/89 | **74** | 12/165 | **172** | 0 | 7 |
| Content Library | 1/4 | 0 | 10/40 | 21 | 0 | 0 |
| Voucher | 4/6 | 0 | 12/34 | 27 | 0 | 0 |
| Program | 8/6 | 0 | 9/41 | 24 | 2 | 8 |
| Products | 4/10 | **61** | 18/59 | 23 | 1 | 0 |
| Tabel umum (mis. Product features) | 1/32 | 27 | 9/65 | 39 | 0 | 0 |
| CRM | **59/7** | **262** (juga 99 di desktop) | **56/94** | 81 | 1 | 8 |
| Job Vacancy MT | 21/5 | 2 | 10/39 | 22 | 6 | 15 |
| Competitor Intel | 5/5 | 24 | 12/37 | 25 | 3 | 0 |
| Customer Knowledge | 5/3 | 39 | 14/36 | 16 | 3 | 16 |
| Tickets | 14/5 | 0 | 9/45 | 47 | 1 | 24 |
| B2B / Org Partnership | 3/6 | **65** | 14/43 | 49 | 5 | 5 |
| Design Assets | 1/22 | 0 | 21/61 | 47 | 0 | 0 |
| Resources | 5/31 | 37 | 10/62 | 55 | 0 | 3 |
| Settings | 3/13 | 0 | 18/43 | 19 | 0 | 0 |
| Talent Pool | 22/21 | **209** | 9/42 | 49 | 0 | 0 |
| Collaborators | 1/5 | 0 | 12/35 | 21 | 0 | 1 |
| Rundown | 4/6 | 0 | 12/39 | 30 | 0 | 0 |

Catatan: ikon Tabler tidak termuat di lingkungan audit (offline), jadi tombol ikon tampak kosong di screenshot — ukuran tombolnya tetap terukur benar.

### Usulan urutan putaran (prioritas → nice-to-have)

**Prioritas (fondasi — semua modul ikut membaik):**
1. **Putaran 8 — Form & tabel umum (A1, A6):** dropdown nama ganti ketik ID/UUID; editor daftar/tag ganti JSON mentah; isian wajib di atas, sisanya dilipat; kolom tampilkan nama bukan ID; label tombol spesifik ("Add feature"); pesan kosong ramah; konfirmasi hapus. Dampak: 36 halaman sekaligus.
2. **Putaran 9 — Navigasi (A2, A3, A12, nav HP):** sub-halaman masuk menu (bisa dibuka-tutup per modul); satu tempat per data (hapus jalur dobel, sisanya jadi tautan ke tempat utama); Settings dirapikan; nav bawah HP diurutkan menurut yang paling sering dipakai.
3. **Putaran 10 — Satu popup & konfirmasi (A5, A10, A11):** satu komponen popup + satu konfirmasi; 37 popup bawaan browser diganti; label tombol spesifik; perbaiki style tombol global.
4. **Putaran 11 — Bahasa Inggris semua (A4)** dengan kamus istilah satu untuk seluruh app (termasuk tanggal/kalender).

**Berikutnya:**
5. **Putaran 12 — HP per modul (A7, A8):** CRM, Talent Pool, Instagram, Products, B2B, Customer Knowledge, Resources, Competitor — tabel jadi kartu di HP, filter dilipat, tombol ≥36px, teks ≥11px.
6. **Putaran 13 — Satu palet warna (A9).**

### Masih menunggu keputusan user
- N13. Hak mengubah tiket mengikuti aturan role.

---

## Putaran 8 — Form & tabel umum (RecordManager, 36 halaman) (11 Okt 2026)

Menjawab temuan A1 & A6 Putaran 7. Props `RecordManager` tidak berubah, jadi semua halaman yang memakainya ikut membaik tanpa disentuh.

### Do — yang berubah

| # | Sebelum | Sesudah |
|---|---------|---------|
| P1 | 58 isian minta ketik ID/UUID (mis. "Assignee UUIDs", "Product ID") | **Dropdown nama** (satu pilihan) atau **daftar centang nama** (banyak pilihan). Server tetap menerima id → `record-actions.ts` tidak diubah. Sumber nama: `REFERENCES` di `lib/records/form-plan.ts`, disajikan `GET /api/record-options` (wajib login, hanya id + nama, pilihan tiket ikut aturan role) |
| P2 | Kotak JSON mentah untuk daftar teks (label, platform, fitur, link, cc) | **Editor daftar** (ketik → Enter, hapus per item) |
| P3 | JSON berstruktur & id eksternal tampil di depan | Dilipat di **"Advanced"** dengan penjelasan |
| P4 | Riwayat pembeli, komentar & file tiket, lampiran task, gambar tampil sebagai JSON | **Tidak ditampilkan**, nilai aslinya dikirim ulang apa adanya saat Save (tidak bisa terhapus tanpa sengaja); nilai lama non-JSON dibungkus aman |
| P5 | Semua isian sekaligus (tiket 18, evaluasi 40) | **Isian wajib di depan** (tanda *required*), sisanya di **"More fields · N optional · M filled"** |
| P6 | Kolom tabel menampilkan id mentah ("pr1") & header "product id" | Kolom menampilkan **nama**; header manusiawi ("Product", "Assignees") |
| P7 | "Add record / Save record / Delete record", jumlah "records" | **"Add feature" / "Save feature" / "Delete feature"**, "5 features" (kamus `ITEM_NOUN` untuk 54 tabel) |
| P8 | Hapus langsung tanpa konfirmasi | **"Delete this feature? This cannot be undone."** — fokus di Cancel |
| P9 | Pesan kosong "Add the first record when the VPS database is connected" | **"No features yet — Click Add feature above to create the first one."** |
| P10 | Pilihan peran notifikasi berupa multi-select (harus Ctrl+klik) | Daftar centang |
| P11 | Isian wajib kosong tidak ditandai | Garis merah setelah disentuh; kursor pindah ke isian itu |

### Check — ditemukan & diperbaiki saat tes

- **Daftar centang di dalam `<label>`**: klik judul "Products" ikut mencentang produk pertama → diganti `fieldset` (ditemukan tes otomatis)
- **Tabel melebarkan seluruh halaman di HP** (798px di layar 390px): panel grid ikut melar ke lebar minimum tabel, dan label tersembunyi "Actions" (posisi absolute) lolos dari kotak geser → `min-width: 0` + `position: relative` (ditemukan design review). Efek: elemen keluar layar HP **Resources 37 → 0**, **tabel umum 27 → 0**
- Kotak centang raksasa (style isian ikut ke checkbox); "Select statu…" (pembentuk kata tunggal memotong "status"); isian wajib tanpa pilihan kini menulis "No choices set up yet."

### Check — hasil

- Unit test **79/79** (10 baru, termasuk keterlacakan: **tidak boleh ada lagi isian ID yang harus diketik** — tes gagal kalau ada isian *_id baru tanpa sumber nama; setiap sumber menunjuk tabel & kolom yang ada; setiap tabel punya sebutan item)
- E2E 54 tabel: **804/804 lolos, 3×** — termasuk **Save tanpa mengubah apa pun mengembalikan semua isian persis sama di 54 tabel** (tidak ada data hilang), hapus minta konfirmasi, kolom nama, editor daftar, pilihan banyak, isian wajib, HP
- Regresi: search 46/46 (2×), 13 modul khusus 13/13, Content Library 51/51
- tsc bersih; lint bersih untuk kode baru

### Antrean
- Lanjut **Putaran 9 — Navigasi** (A2, A3, A12)
- `/api/record-options` diuji ke PostgreSQL (PGlite): opsi tiket ikut aturan role (staff hanya tiketnya), urut nama, tabel tak dikenal ditolak, tidak ada kolom lain (mis. email) yang ikut terkirim — SQL suite **28/28**
- N13 hak mengubah tiket — menunggu keputusan user

---

## Putaran 9 — Navigasi: semua halaman ada di menu, satu tempat per data (14 Okt 2026)

Menjawab temuan A2, A3 (sebagian), A12 dan nav HP dari audit Putaran 7.

### Do — yang berubah

| # | Sebelum | Sesudah |
|---|---------|---------|
| P1 | Menu samping hanya 21 dari 57 halaman; 27 sub-halaman hanya lewat deretan link di panel terlipat | **Sub-halaman tampil di bawah modulnya** (terbuka otomatis saat sedang di modul itu, panah untuk membuka modul lain; disembunyikan saat sidebar diperkecil). Satu sumber: `lib/records/links.ts` |
| P2 | 9 master data dikelola di **dua tempat** (Settings + sub-halaman sendiri): divisi/orang/tipe tiket, platform & kategori pain point, klasifikasi & mapping produk, CTA carousel, template link event | **Hanya di Settings.** 9 alamat lama diarahkan otomatis ke bagian Settings yang tepat (`?focus` dari search ikut diteruskan) |
| P3 | Deals & outreach partnership dikelola di tab halaman partnership **dan** di 4 sub-halaman tabel | **Hanya di tab partnership** (`?tab=deals` / `?tab=outreach`); 4 alamat lama diarahkan; hasil search deal/outreach membuka tab & menyorot barisnya |
| P4 | Settings: 10 tab dalam 2 baris berantakan, campur bahasa ("Master Produk", "Klasifikasi Produk", "Divisi", "Tipe Request") | 1 baris berbahasa Inggris: Menu · Users & roles · Ticket setup · Pain point lists · Product classes · Product mapping · Carousel CTAs · Link templates · Competitor lists; alamat ikut berubah (`/settings?tab=…`) sehingga bisa dibookmark/dibagikan; Users & roles hanya untuk admin |
| P5 | Nav bawah HP: Home, Program, **Konten**, B2B, Org, Design, **Lainnya**; CRM & Tickets tersembunyi; modul yang disembunyikan di Settings tetap muncul | **Home · Tickets · Program · Content · CRM · More**; modul tersembunyi dilewati & slotnya diisi modul berikutnya |
| P6 | Ctrl+K tidak mengenal sub-halaman/ bagian Settings | Ctrl+K menemukan "Settings › Ticket setup", "B2B Partnership › Deals & scope", dst.; tidak pernah menawarkan alamat lama |
| P7 | Tombol "Master Data" di Tickets & link Platforms/Categories di Customer Knowledge menunjuk alamat lama | Langsung ke bagian Settings ("Ticket setup") |

### Check — hasil

- Unit test **87/87** (8 baru — keterlacakan navigasi: **setiap halaman bisa dicapai dari menu**, setiap alamat lama diarahkan ke halaman & tab yang ada dan meneruskan `?focus`, menu/katalog/kode tidak menunjuk alamat lama, tabel master hanya di Settings, Users & roles hanya admin)
- E2E navigasi: **32/32 lolos, 3×** (menu & tanda aktif, sidebar diperkecil, Settings deep link & URL, hasil search master data → Settings, deal/outreach → tab partnership, Ctrl+K, non-admin, nav HP + modul tersembunyi, More)
- Regresi: search 46/46, 13 modul 13/13, form & tabel umum 804/804, Content Library 51/51
- tsc bersih; lint bersih untuk kode baru
- Ditemukan saat Check lalu diperbaiki: bar Settings terpotong di desktop ("Event link…", "Competitor lists" harus digeser) → label dipendekkan, sekarang muat; 3 link di dalam modul masih ke alamat lama → diarahkan langsung + tes penjaga

### Sengaja belum (dicatat)

- **N17. Jalur dobel tersisa:** Content Planning (carousels, stories, story/carousel links, KOL, MT story), Products (features, benefits, …), Program tasks, CRM deals, Instagram targets, Competitor products/prices/snapshots/flags punya tampilan khusus **dan** sub-halaman tabel mentah. Supaya bisa dipensiunkan, tampilan khusus tiap modul harus bisa menerima hasil search untuk setiap tabelnya dulu — dikerjakan per modul.
- Urutan nav HP dipilih berdasarkan pekerjaan harian (belum ada data pemakaian); gampang diubah di `BOTTOM_NAV`.
- N13 hak mengubah tiket — menunggu keputusan user.

---

## Putaran 10 — Satu sistem popup & konfirmasi, tombol menyebut objeknya (14 Okt 2026)

Menjawab temuan A5 (popup beda-beda), A6 (label tombol umum), N14 (ukuran teks tombol tidak ikut Tailwind), N15 (modal buatan sendiri bukan dialog) dari audit Putaran 7.

### Do — yang berubah

| # | Sebelum | Sesudah |
|---|---------|---------|
| P1 | **37 popup bawaan browser** (`window.confirm` 21, `alert` 13, `prompt` 3): tampilan abu-abu browser, bahasa Indonesia, bisa "dibungkam" browser (tombol Hapus lalu diam saja) | **Satu layanan** `app/_components/app-dialog.tsx`: `confirmAction` (konfirmasi), `askText` (isian satu kolom), `notify`/`notifyError` (pesan di bawah layar). Semua 37 diganti. Hapus = merah; fokus awal di **Cancel**, jadi Enter tidak pernah menghapus tanpa sengaja |
| P2 | Teks konfirmasi umum: "Hapus data ini?", "Hapus row ini?", tombol "OK" | Judul & tombol menyebut objek: "Delete this ticket?" → **Delete ticket**; "Send to 12 recipients?" → **Send email** / **Schedule email**; jumlah ikut (1 transaction / 3 transactions); akibat dijelaskan bila ada ("Its deals are deleted too") |
| P3 | Modal Job Vacancy punya konfirmasi hapus sendiri ("Ya, Hapus") | Pakai konfirmasi bersama yang sama |
| P4 | Modal buatan sendiri (Content Planning, Content Evaluation, Job Vacancy) & panel detail CRM/Talent Pool: tidak diumumkan sebagai dialog, fokus tetap di belakang, Tab bisa keluar ke halaman di belakang | `use-modal.tsx`: `role="dialog"` + judul, **Esc menutup**, fokus masuk (form → kolom pertama, panel detail → tombol pertama), **Tab berputar di dalam**, fokus kembali ke tombol pembuka saat ditutup |
| P5 | Tombol berlabel umum (Simpan, Batal, Tambah, Hapus, Terapkan, Save) di 9 file — tidak jelas apa yang disimpan/dihapus | Menyebut objek: Save evaluation, Save carousel plan, Save story date, Save KOL, Save MT story, Save link, Save user, Add industry, Add label, Add rundown item, Add MT story, Delete evaluation, Delete carousel plan, Delete selected (n), Apply status, Apply talent pool, Cancel import; "Batal" → Cancel. Tombol ikon hapus diberi nama (Delete story date/slide, Delete KOL, Delete MT story, Delete vacancy, Delete rundown item) |
| P6 | N14: aturan global `button, input… { font: inherit }` mengalahkan kelas ukuran Tailwind (`text-xs` dll. di tombol tidak berlaku) | Dipindah ke `@layer base`; kelas Tailwind sekarang berlaku, CSS modul tetap menang seperti sebelumnya |

### Check — hasil

- Unit test **91/91** (4 baru di `lib/ui/consistency.test.mjs`): tidak ada `window.confirm/alert/prompt` di kode; setiap modal buatan sendiri lewat `useModal`/`DialogBehaviour`; tidak ada tombol berlabel kosong "Save/Add/Delete/Simpan/Tambah/Hapus/Terapkan"; setiap konfirmasi punya label ≥2 kata dan konfirmasi "Delete …" selalu merah
- E2E baru **popup 31/31**: Enter di konfirmasi hapus = batal; Esc = batal; konfirmasi menjalankan aksi tepat sekali; prompt template (field berlabel, fokus di field, tersimpan); validasi Competitor tanpa alert browser; hapus lowongan lewat konfirmasi bersama; modal lowongan (dialog berjudul, fokus masuk, 60× Tab tetap di dalam, Esc menutup, fokus kembali ke tombol "Tambah Loker"); modal MT story; panel detail CRM; konfirmasi muat di layar HP 390px; **tidak ada popup bawaan browser yang muncul**
- Regresi: search 46/46, 13 modul 13/13, form & tabel umum 804/804, Content Library 51/51, navigasi 32/32
- Visual N14 dibandingkan sebelum/sesudah di 13 modul: yang berubah hanya elemen yang memang memakai kelas ukuran Tailwind (mis. kotak search atas jadi sesuai desain 12px); tata letak modul tidak bergeser
- tsc bersih; lint bersih untuk kode baru (5 error lama di competitor/content-planning/talent-pool tetap, sudah ada sejak baseline)
- Ditemukan saat Check lalu diperbaiki: komentar CSS berisi `text-*/` menutup komentar terlalu awal (CSS sesudahnya bisa rusak) → kalimat diganti; label "Delete transactions" untuk 1 baris → tunggal/jamak mengikuti jumlah

### Sengaja belum (dicatat)

- Teks lain di modul-modul itu masih campur bahasa (judul modal "Tambah Loker MT Baru", pesan sukses, placeholder) → **Putaran 11** (Inggris semua + glosarium + format tanggal).
- Modal buatan sendiri belum diganti ke komponen Dialog yang sama secara visual (gaya masih per modul) — perilakunya sudah sama; penyeragaman tampilan masuk **Putaran 13** (satu palet).
- ~~N13 hak mengubah tiket~~ → **diputuskan user (15 Okt 2026): tidak diubah.** Aturan role hanya untuk *melihat* tiket; edit/hapus/sinkron kalender tetap seperti semula. Ditutup.

### Keputusan user tercatat

| # | Keputusan | Tanggal |
|---|-----------|---------|
| N13 | Hak **mengubah** tiket (edit, hapus, sinkron Google Calendar) **tidak** mengikuti aturan lihat per role — biarkan seperti sekarang | 15 Okt 2026 |

---

## Putaran 11 — Design Assets: popup detail & galeri gambar (15 Okt 2026)

Dipicu screenshot user dari internal.ccclub.id/design-assets. Nomor putaran "Inggris semua" mundur ke 12.

### Plan — audit heuristik (sebelum)

| # | Temuan | Heuristik / prinsip | Prioritas |
|---|--------|--------------------|-----------|
| D1 | Gambar di popup **terpotong**: kotak setinggi 150px dengan mode *cover* — banner lebar kehilangan atas-bawah, poster tegak hanya tampil sepotong | Visibilitas status; kecocokan dengan dunia nyata (aset harus terlihat utuh) | Prioritas |
| D2 | File yang gagal dimuat hanya tampil sebagai ikon abu-abu, tanpa penjelasan | Bantu user mengenali & memulihkan error | Prioritas |
| D3 | Label detail = nama kolom database: KATEGORI, NAMA, TIPE, LINK; nama & kategori diulang padahal sudah di judul | Kecocokan bahasa; konsistensi (bahasa Inggris) ; minimalis | Prioritas |
| D4 | Link sumber berupa teks panjang yang tidak bisa diklik dan memecah baris | Fleksibilitas & efisiensi | Prioritas |
| D5 | Popup buatan sendiri: Esc tidak menutup, fokus tidak masuk, tidak diumumkan sebagai dialog; tidak ada tombol aksi di popup | Kontrol & kebebasan user; konsistensi dengan Putaran 10 | Prioritas |
| D6 | Klik "Add to library" di kartu memunculkan form **di dasar halaman** — dari atas terlihat seperti tidak terjadi apa-apa | Visibilitas status sistem | Prioritas |
| D7 | Di production tombol "Add to library" jauh lebih besar dari "Source" (efek N14 di versi lama) | Konsistensi; estetika | Prioritas |
| D8 | Teks kartu 7–9px; "3 item" bukan "3 items" | Keterbacaan | Nice-to-have |
| D9 | `storage_path` & `storage_paths` yang menunjuk file sama dihitung dua gambar | Pencegahan error | Nice-to-have |
| D10 | Hasil search ke Design Assets tidak membuka asetnya | Konsistensi dengan modul lain (Putaran 6) | Nice-to-have |

### Do — yang berubah

- **Penampil gambar** (`StorageImage fit="contain"`): gambar selalu utuh (rasio dijaga), tinggi kotak mengikuti gambar sampai maks 56% layar (46% di HP); status *loading* (shimmer) dan **"Image could not be loaded — The file may have been moved or deleted."**
- **Popup detail** pakai Dialog bersama: judul = nama aset, kategori di atasnya; panah kiri/kanan + tombol keyboard ←/→, penghitung 1 / 2, **thumbnail** untuk lompat; detail dengan label dari katalog (Type, Source link, Notes…), link bisa diklik (domain + ikon), catatan menjaga baris baru; tombol **Close · Open source · Add to library**; Esc menutup.
- **Add to library** jadi popup "Add to content library" di tengah layar, terisi dari aset, kolom wajib bertanda merah (Source URL, Likes), sukses → pesan di bawah layar dan popup tertutup.
- **Kartu**: teks 10–12px, aksi Source & Add to library satu ukuran (11px) dipisah garis tipis, "3 items", gambar ganda dihitung sekali.
- Hasil search Design Assets langsung membuka popup aset (`?focus=`).
- Berlaku juga untuk galeri KOL & MT Story (komponen yang sama, label dari katalog masing-masing).

### Check — iterative design review

1. Review 1 (desktop): gambar lebar utuh, form jadi popup ✔; **gambar tegak masih terpotong** (tinggi `img` 100% tidak berlaku di grid) → diganti `max-height` + rasio asli. Ruang kosong besar di atas/bawah banner lebar → kotak sekarang mengikuti bentuk gambar.
2. Review 2 (HP 390px): teks "file may have been moved" **tertabrak tombol panah** → diberi jarak samping.
3. Review 3: desktop & HP bersih, tanpa scroll ke samping.

### Check — regression

- E2E baru Design Assets **49/49** (desktop + HP): gambar lebar & tegak tampil utuh tanpa terpotong/melar (rasio diukur), Esc menutup, pesan file hilang tidak tertabrak panah, label Inggris, link bisa diklik, ← → dan thumbnail, form Add to library sebagai popup + terisi + Likes kosong menahan kirim + kirim sekali + pesan sukses, ukuran aksi kartu sama, hasil search membuka popup
- Regresi: unit 91/91, search 46/46, modul 13/13, navigasi 32/32, popup 31/31, form & tabel 804/804, Content Library 51/51
- tsc bersih; lint bersih untuk kode baru; `npm run build` lolos

### Antrean

- Edit/hapus aset langsung dari popup (sekarang lewat tab Manage data).
- Kartu yang gambar pertamanya hilang masih menampilkan ikon; bisa memakai gambar berikutnya yang berhasil dimuat.

---

## Putaran 12 — Semua popup: muat di layar, bisa ditutup, tombol selalu terlihat (15 Okt 2026)

Dipicu screenshot user dari Content Library (popup lebih tinggi dari layar, gambar terpotong) + permintaan "terus evaluasi UI modul lain, terutama popup". Nomor "Inggris semua" mundur ke 13.

**Keputusan user:** modul **Voucher dihapus dari app, data tetap** (tabel `vouchers` tidak disentuh).

### Plan — audit heuristik terukur (sebelum)

Alat: skrip yang membuka **29 popup** (lewat `?focus=` hasil search, tombol Add/New, dan langkah khusus per modul) di **laptop 1280×720, desktop 1920×1080, HP 390×844**, lalu mengukur: muat di layar, isi terpotong, tombol tutup terlihat, tombol aksi terakhir terlihat tanpa scroll, Esc menutup, diumumkan sebagai dialog, gambar *cover* (terpotong), teks <11px, kata bahasa Indonesia, isi melebar ke samping.

| # | Temuan | Heuristik | Prioritas |
|---|--------|-----------|-----------|
| Q1 | Content Library preview: gambar dipaksa kotak 1:1 *cover* (postingan 4:5 terpotong), tombol aksi di bawah lipatan | Visibilitas; estetika & minimalis | Prioritas |
| Q2 | Collaborators detail: **tidak ada tombol tutup**, Esc tidak menutup, bukan dialog | Kontrol & kebebasan user | Prioritas |
| Q3 | Form B2B/Org Partnership, Competitor, Customer Knowledge: overlay buatan sendiri, bukan dialog, Esc (B2B) tidak menutup, label tidak terhubung ke kolom, bahasa Indonesia | Konsistensi; aksesibilitas | Prioritas |
| Q4 | Editor baris "Manage data" (±36 halaman): panel melayang tanpa latar, tanpa tombol tutup, Esc tidak menutup | Kontrol & kebebasan user | Prioritas |
| Q5 | Tickets, Program, Dashboard, Content Evaluation: tombol Save baru terlihat setelah scroll ke paling bawah | Visibilitas; efisiensi | Prioritas |
| Q6 | Tickets di HP: baris tombol tidak bisa turun → isi popup melebar, "Save ticket" terpotong | Pencegahan error | Prioritas |
| Q7 | Label 7–10px huruf kapital di form popup (Content Library, Job Vacancy, Content Planning, CRM/Talent detail, Eval, RecordManager) | Keterbacaan | Prioritas |
| Q8 | Teks campur bahasa di popup (Batal/Simpan/Tambah, Judul/Deskripsi/Divisi, placeholder "contoh:/cth:/Cari…") | Konsistensi (keputusan "Inggris semua") | Prioritas |
| Q9 | Tombol Simpan generik di popup | Prinsip: tombol menyebut objek | Prioritas |

### Do — yang berubah

- **Content Library preview** dirombak: desktop dua kolom (gambar utuh kiri + thumbnail; info kanan dengan metrik, label, copywriting, notes yang bisa di-scroll; **tombol aksi selalu di bawah**); HP satu kolom, tombol aksi menempel di bawah, tombol × di pojok atas; ←/→ di keyboard.
- **Collaborators detail** → Dialog: foto sekarang tampil (klik foto untuk ganti), × dan Esc, form scroll dengan Cancel · Save profile menempel di bawah.
- **Partnership, Competitor, Customer Knowledge** → Dialog bersama: judul "Add/Edit partner|competitor|pain point", label terhubung ke kolom, kolom wajib bertanda merah, tombol **Save partner / Save competitor / Save pain point**.
- **Editor baris RecordManager** → Dialog "Edit {item}" (berlaku di semua tab Manage data & halaman tabel), Save menempel di bawah, tutup otomatis setelah simpan; hasil search tetap membuka editornya.
- **Footer menempel** (`DialogFooter sticky`) untuk Tickets, Program (event, task, link, Google Calendar), Dashboard calendar, Google Calendar modal, Design Assets; Content Evaluation & Content Library add memakai versi CSS yang sama.
- Aksi sekunder tiket (Google Calendar, Duplicate, Delete) jadi tombol ikon berlabel di HP; Delete bergaya garis merah (merah hanya untuk bahaya).
- Ukuran teks label popup naik ke 12px (kalimat biasa, bukan huruf kapital kecil).
- Bahasa Inggris di semua popup yang disentuh + placeholder pencarian; tombol menyebut objek (Save ticket/task/event, Create event, Add link, Save vacancy, Add carousel plan, …).
- **Voucher dihapus**: menu, halaman, komponen, API, katalog/search, AI command & parser; `/voucher` → Dashboard (`REMOVED_PAGES`); `kode_voucher` di Talent Pool tetap.

### Check — iterative design review

1. Audit 1: 9 jenis temuan di 14 modul (lihat tabel).
2. Review 2: Content Library desktop ✔, tapi tombol × di HP berada di bawah gambar → dipindah ke pojok popup.
3. Review 3: **Tickets di HP melebar** (tombol tidak turun baris) → footer boleh membungkus; audit ditambah cek "isi melebar ke samping" (awalnya salah deteksi teks pembaca layar → disaring).
4. Review 4: footer Tickets di HP makan 3 baris → aksi sekunder jadi ikon. Deskripsi editor "fields marked *" tidak cocok dengan tanda "required" → dihapus.
5. Audit akhir: **87 pengukuran (29 popup × 3 layar) lolos semua**; satu-satunya tanda tersisa adalah kata "Catatan" di data contoh, bukan teks app.

### Check — regression

- Unit **94/94** (baru: modul yang dihapus tidak ada di menu/katalog/search/AI dan alamat lama diarahkan; tidak ada overlay buatan sendiri atau editor melayang; dialog yang di-scroll wajib footer menempel)
- E2E: form & tabel umum **893/893** (sekarang juga cek editor = dialog dan tertutup setelah simpan; uji pilihan banyak dipindah dari voucher ke assignee task), Design Assets 49/49, popup 31/31, navigasi 32/32, modul 12/12 (Voucher dihapus), search 46/46, Content Library 51/51
- tsc bersih; lint bersih untuk kode baru; `npm run build` lolos

### Antrean

- Putaran 13 "Inggris semua" untuk halaman (bukan popup): kotak search atas masih "Cari apa saja…", tombol "Tambah" di beberapa halaman, judul statistik (TOTAL BUYERS/BELUM ISI POOL), Settings.
- Nilai data berbahasa Indonesia (fase "Hari H", status "On Progress", opsi aksi "Boost ke Meta Ads") sengaja tidak diterjemahkan karena tersimpan di database — perlu keputusan & migrasi kalau mau diganti.
- Popup modul lama yang masih memakai gaya CSS sendiri (Content Planning, Job Vacancy, Content Evaluation) sudah berperilaku sama; penyeragaman tampilan masuk putaran palet warna.

---

## Putaran 13 — Tampilan IJIS, tahap 1 (fondasi) & tahap 2 (komponen bersama) (22 Okt 2026)

User menyetujui preview "CareerCclub × gaya IJIS" (kanvas Design: Dashboard desktop, Content Library + popup, Dashboard HP). Pilihan bawaan dari preview: **warna utama biru CareerCclub**, **mode terang dulu** (mode gelap menunggu warna-tetap di modul dibersihkan). "Inggris semua" mundur ke Putaran 14.

### Do — yang berubah

**Tahap 1 — fondasi (berlaku di semua modul tanpa mengubah modul)**
- Token di `app/globals.css` diganti ke palet IJIS: latar `#edf0f4`, permukaan putih, teks `#14212c`, abu `#5f6b77`, garis `#dde3ea`, aksen biru `#1554c0` + turunannya (gelap `#0f3c8a`, muda `#dee7f6`), merah `#c8331f` hanya untuk telat/bahaya, `--shadow` halus, `--radius-lg` 18px / `--radius-xl` 22px. Nama token lama (`--purple-*`) dipertahankan supaya semua modul ikut; cara ganti aksen ditulis di komentar.
- Font **Plus Jakarta Sans** (next/font), angka tabular.
- Shell: sidebar putih dengan logo CareerCclub, label grup kapital kecil, item membulat (aktif = latar aksen muda + teks aksen gelap), sub-halaman bergaris kiri, hitungan berupa angka polos (merah hanya untuk tiket telat); top bar putih 64px, kotak search berbentuk pil "Search anything…", avatar bulat; nav HP putih.
- Warna tema PWA/manifest mengikuti latar baru.

**Tahap 2 — komponen bersama**
- Card (radius besar + bayangan), Button (pil, semibold), Dialog (radius 22px), StatCard (angka 28px, label kalimat biasa), filter & FilterPill (aktif = hitam netral, bukan biru).
- CSS modul diseragamkan otomatis: wadah/kartu → `--radius-lg` + bayangan (60), tombol → pil (16), kolom isian → `--radius` (13).

### Check — iterative design review

1. Screenshot 13 halaman × desktop & HP dengan font asli (Plus Jakarta Sans + ikon Tabler disematkan ke harness).
2. **Ditemukan & diperbaiki:** skrip penyeragaman membaca kata "Table" di komentar/nama class sebagai tab → wadah tabel Job Vacancy & Rundown jadi berbentuk pil dan **memotong tombol di kolom terakhir** (Delete vacancy tidak bisa diklik); beberapa kartu yang dibuat dari `<button>` (produk, kompetitor, kolaborator, ancaman) ikut jadi pil → dikembalikan ke kartu.
3. **Ditemukan & diperbaiki:** dengan sidebar 240px dan font baru, bar bagian Settings meluap 42px di layar 1280px → label & jarak dirapatkan, kembali satu baris tanpa digeser.

### Check — regression

- Unit 94/94; tsc bersih; lint bersih untuk kode baru; `npm run build` lolos
- E2E: form & tabel umum 893/893, popup 31/31, audit popup 84/84 (29 popup × 3 layar), navigasi 32/32, search 46/46, modul 12/12, Design Assets 49/49, Content Library 51/51
- Tes yang diperbarui karena teks sengaja diganti: tombol & kotak search sekarang "Search anything"

### Antrean (Tahap 3 — per modul)

- Prioritas: Dashboard seperti preview (salam + tanggal, kartu statistik, kartu program dengan cincin progres, "Up next", "This week"); Content Library kartu 4:5; chip status warna-warni (Marketing/Med/Todo, Belum diblast) → satu palet; label statistik kapital kecil (TOTAL BUYERS, BELUM ISI POOL) → kalimat biasa.
- Nice-to-have: mode gelap (perlu ganti warna tetap `#fff`/`#f8fbff` di modul ke token).

---

## Putaran 14 — Rombak layout per modul (IJIS), bagian 1: Dashboard, Content Library, Tickets (22 Okt 2026)

Masukan user: tahap 1–2 baru mengganti font & warna, susunan halaman masih template lama. Arah baru: **susunan halaman diganti total seperti preview, data & aksi tetap sama.**

### Do — yang berubah

| Modul | Sebelum | Sesudah |
|---|---|---|
| Dashboard | Panel "Input dengan AI" + kalender penuh + daftar kosong | Salam + tanggal; 4 kartu angka (tiket terbuka/telat, task minggu ini, task telat, program bulan ini) yang bisa diklik; kartu program mendatang dengan cincin progres task & avatar; **Up next** (telat dulu, tiket dari task tampil sekali); **This week** (7 hari + program minggu ini); AI di bawahnya; kalender paling bawah |
| Content Library | Tab bergaris, 4 dropdown polos, kartu kecil berisi banyak metrik | Judul + jumlah ide; saklar Organic/Ad Ideas; filter berbentuk pil; kartu 4:5 berisi hook, 1 label (+N) dan **satu** angka sesuai urutan yang dipilih |
| Tickets | 2 kartu angka, tabel 9 kolom dengan 3 pil warna-warni per baris | Judul + "N open · M late"; saklar Open/Done/All dengan jumlah; search & filter pil; daftar **dikelompokkan** Late / This week / Later / No due date / Done; per baris: centang bulat, judul, info singkat (nomor · divisi · tipe · High priority), avatar, **satu** chip tanggal (merah hanya telat), tombol kalender |
| Menu | Angka merah = total tiket / total task (production: "99+") | Angka merah = **yang telat saja** (tiket yang boleh dilihat, task program) |

- Satu aturan "telat" (`isOverdue` di `lib/dashboard/summary.ts`) dipakai Dashboard, Tickets dan badge menu; `jakartaNow()` dipakai bersama.
- "Create ticket" di Dashboard membuka form yang sama di Tickets (`?create=ticket`), bukan form kedua.

### Check — iterative design review

- Render desktop 1440 & HP 390 dengan font asli; dicocokkan ke preview. Ditemukan: angka Content Library berformat Indonesia ("1,2 rb") → "1.2K"; badge menu merah tidak berarti telat → diganti.

### Check — regression

- Unit **102/102** (baru: ringkasan Dashboard 5, grup Tickets 3 — termasuk "grup Late = angka telat di Dashboard"; keterlacakan badge memakai aturan telat yang sama)
- E2E baru Tickets + Dashboard **19/19** (grup, centang selesai pindah ke Done, search kosong, filter, buka detail, `?create=ticket`, HP tanpa geser, link kartu Dashboard & Up next)
- Regresi: form & tabel 893/893, popup 31/31, audit popup 84/84, navigasi 32/32, search 46/46, modul 12/12, Content Library 51/51 (1 tes diberi jeda karena fokus pindah setelah render), Design Assets 49/49
- tsc bersih; lint bersih untuk kode baru; `npm run build` lolos

### Antrean (bagian berikutnya)

Program (daftar event → kartu + timeline task), CRM, Talent Pool, B2B/Org Partnership, Content Planning, Products, Job Vacancy, Competitor, Customer Knowledge, Settings — masing-masing: preview singkat bila susunannya berubah besar, lalu bangun + tes.

## Putaran 14 — bagian 3: Program (22 Okt 2026)

### Do — yang berubah

| Sebelum | Sesudah |
|---|---|
| Tab Events/Calendar, deretan kartu event berwarna + tabel task di bawahnya | Judul + "N upcoming · M late tasks"; saklar **Upcoming / Finished / Calendar** dengan jumlah; filter pil Type / From / To + "Clear" |
| Pilih event lewat kartu, detail tercampur tabel | **Board**: kiri daftar event (terdekat dulu) dengan cincin % task selesai; kanan detail event: jenis, nama, tanggal · jam, tombol **Edit event** & **Add task**, bar progres, Links, tab fase (All / Pre Event / Hari H / Post Event + jumlah) |
| Task: tabel dengan pil status, prioritas, fase warna-warni | Task dikelompokkan per fase; per baris centang bulat (sekali klik Done/buka lagi), judul, info singkat, avatar, **satu** chip tanggal (merah hanya telat), tombol Google Calendar |
| Tanggal "25 Okt" | "25 Oct" (UI Inggris) |

- `?focus=<event>` (dari Dashboard/search) memilih event itu, pindah ke Upcoming/Finished sesuai statusnya dan mengosongkan filter.
- Aturan telat & chip tanggal memakai `isOverdue` / `dueChip` yang sama dengan Tickets & Dashboard.
- HP: daftar event jadi strip geser ke samping; baris task 3 kolom (avatar disembunyikan); tombol aksi selebar layar.

### Check

- Desain: render 1440 & 390, tidak ada geser ke samping; hanya task telat yang merah.
- E2E baru Program **21/21** (urutan event, `?focus`, progres 1/4 = cincin 25%, satu chip merah, avatar, centang simpan status, filter fase & jenis, Add task / Edit event membuka form, ganti event, Calendar, HP).
- Regresi: unit 102/102, Tickets+Dashboard 19/19, modul 12/12 (cek fokus Program diperbarui ke board), navigasi 32/32, popup 31/31, audit popup Program semua ok (opener jadi "Edit event"/"Add task"), search 46/46, form & tabel 893/893, Content Library lolos, Design Assets 49/49.
- tsc bersih; lint: error tersisa hanya yang lama di competitor/content-planning/talent-pool tools (setState di effect), bukan kode baru; `npm run build` lolos.

### Antrean

CRM → Talent Pool → B2B/Org Partnership → Content Planning → Products → Job Vacancy → Competitor → Customer Knowledge → Settings.
Nice-to-have: tabel Rundown di detail event masih gaya lama (input per sel) — dirapikan saat giliran Event rundown.

## Putaran 15 — Talent Pool (IJIS layout) (22 Okt 2026)

Urutan baru dari user: Talent Pool → CRM → Partnership → Customer Knowledge → Content Planning.

### Do — yang berubah

| Sebelum | Sesudah |
|---|---|
| Tab bergaris Database / Analytics / Email Blast / Manage data; 3 kartu angka; tabel 12 kolom dengan pil status, tier, pipeline per baris | Judul + "N candidates · M buyers · K reachable by email"; saklar **Candidates / Analytics / Email blast / Manage data** |
| Filter dropdown polos ("Pipeline", "Sumber") | Search pil + saklar **All / Buyers / Not a buyer** (dengan jumlah) + filter pil Status / Source / Tier + "Clear filters" |
| Tabel | **Direktori kartu** (24 per halaman): avatar inisial, nama, universitas · tier, kota · angkatan lulus · GPA, 1 target MT (+N); chip **Buyer** hanya untuk buyer (satu status per item) |
| — | Panel **At a glance**: buyer vs bukan (bar), universitas/target MT/kota terbanyak, tombol "Email N candidates" → Email blast, "See full analytics" |
| Popup detail di tengah | **Drawer profil** dari kanan: kontak (WhatsApp/Email/LinkedIn), Academic, Profile, Management trainee, Feedback |
| Email Blast: form 2 kolom, Preview buka tab baru, teks campur Indonesia | Form kiri (Recipients, Email, Content) + **preview langsung** di kanan dan tombol "Send email to N"; Subject & Body wajib ditandai merah, kalau kosong field-nya ditandai & difokus; hapus template sekarang minta konfirmasi; semua teks Inggris |
| Analytics: grid kolom tetap, judul Indonesia | Grid responsif, judul Inggris, tombol "Export data" |

- Aturan "buyer" satu tempat: `lib/talent-pool/view.ts` (`isBuyer`, `filterCandidates`, `poolSummary`) + 3 unit test (angka header = jumlah filter Buyers/Not a buyer).
- Perbaikan: link WhatsApp sekarang format internasional (0812… → wa.me/62812…); sebelumnya link dengan awalan 0 tidak membuka chat yang benar.
- Lint: error lama `talent-pool-tools` (setState di effect) beres — pengaturan pengirim/template dibaca saat state dibuat, tulis ke storage dibungkus try/catch.
- CSS lama `talent-pool.module.css` dihapus (tidak dipakai lagi).

### Check

- Desain: render 1440 & 390. Ditemukan & diperbaiki: di HP panel At a glance menutupi layar pertama → dipindah ke bawah daftar; saklar 4 view terpotong di HP → jumlah disembunyikan di HP (sudah ada di judul).
- E2E baru Talent Pool **21/21** (24 kartu, angka header = filter Buyers, filter buyer/search/tier, Clear, At a glance, drawer buka/Esc, `?focus`, link WA, Email blast: subject kosong ditandai & fokus, preview langsung, Analytics, Manage data, HP tanpa geser samping).
- Regresi: unit 105/105, Program 21/21, Tickets+Dashboard 19/19, modul 12/12, popup 31/31, navigasi 32/32, search 46/46, form & tabel 893/893, Content Library lolos, Design Assets 49/49, audit popup Talent Pool ok.
- tsc bersih; lint: sisa error lama di competitor-tools & content-planning-tools; `npm run build` lolos.

### Antrean

CRM → B2B/Org Partnership → Customer Knowledge → Content Planning, lalu Products, Job Vacancy, Competitor, Settings.

## Putaran 16 — CRM (IJIS layout) (22 Okt 2026)

### Do — yang berubah

| Sebelum | Sesudah |
|---|---|
| 5 kartu angka ("TOTAL BUYERS", "BELUM ISI POOL", "SEDANG DIBLAST"…) + tab bergaris | Judul + "N buyers · M transactions · Rp total spend", tombol **Deals pipeline**; saklar **Buyers / Email blast / Import / Analytics** |
| — | **Funnel blast** 4 tahap yang bisa diklik: Not blasted → Blasted → Following up → Converted (jumlah + %); klik = filter |
| 9 dropdown filter berjejer | Search + filter pil Product / Payment / Talent Pool; sisanya (Status, Industry, Stage, Source, Orders) di **More filters**; "Clear filters" |
| Tabel 14 kolom dengan 4 pil warna per baris | **Baris pembeli**: centang, avatar, nama + WA · email, produk terakhir + klasifikasi (+ "not in Talent Pool"), total belanja + jumlah order (merah hanya "payment failed"), **satu** chip status |
| Bar aksi massal di atas tabel | **Bar mengambang** di bawah: "N selected", Set status + Apply status, Talent Pool + Apply talent pool, Download CSV blast, Delete selected (konfirmasi tetap), tutup |
| Popup detail dengan 3 kartu angka + daftar riwayat | **Drawer** kanan: kontak WhatsApp/Email, Orders · Total spend · Status, Details, **timeline pembelian** (terbaru di atas) |
| Email Blast teks Indonesia, tanpa preview | Layout sama dengan Talent Pool: form + **preview langsung** + "Send email to N"; Subject & Body wajib (merah, fokus); hapus template minta konfirmasi; History dengan grafik harian; Sender |
| Import: 5 kartu angka + form | Kartu Import transaksi + kartu **Data health** (pending/failed payment, converted, Talent Pool matches) + Export CRM JSON |

- Nilai status tetap disimpan dalam bahasa Indonesia (data tidak diubah); tampilan memakai label Inggris (`statusLabel`): "Belum diblast" → Not blasted, "Sedang di-upsell" → Upselling, "Sudah convert — Upsell" → Converted · upsell, dst. Aksi massal tetap menyimpan nilai aslinya.
- Logika dipindah ke `lib/crm/view.ts` (`groupCustomers`, `filterCustomers`, `crmSummary`, `funnelStage`) + 3 unit test.
- **Bug lama diperbaiki:** kartu "Sedang Diblast" menghitung semua status yang mengandung kata "blast" — termasuk "Belum diblast". Funnel sekarang menaruh tiap pembeli di tepat satu tahap (dites: jumlah tahap = total pembeli = hasil filter tahap).
- CSS Email blast dipakai bersama Talent Pool & CRM (`email-blast.module.css`); `crm.module.css` lama dihapus.

### Check

- Desain 1440 & 390. Ditemukan & diperbaiki: teks "payment failed" terpotong → kolom belanja dilebarkan; status di drawer terpotong → boleh 2 baris; bar aksi massal di HP menutup setengah layar → jadi satu baris yang bisa digeser.
- E2E baru CRM **24/24** (funnel = total, 20 baris, satu chip per baris, klik tahap memfilter, filter payment, More filters berbahasa Inggris, bar massal + Apply status menyimpan "Diblast", drawer, blast: subject kosong ditandai & preview, Import, Analytics, link Deals, `?focus` + timeline + total belanja, HP).
- Regresi: unit 108/108, Talent Pool 21/21, Program 21/21, Tickets+Dashboard 19/19, modul 12/12, popup 31/31 (selector CRM diperbarui ke baris baru), navigasi 32/32, search 46/46, form & tabel 893/893, Content Library lolos, Design Assets 49/49, audit popup CRM & Talent Pool ok.
- tsc bersih; lint: sisa error lama di competitor-tools & content-planning-tools; `npm run build` lolos.

### Antrean

B2B/Org Partnership → Customer Knowledge → Content Planning, lalu Products, Job Vacancy, Competitor, Settings.

## Putaran 17 — B2B & Organization Partnership (IJIS layout) (22 Okt 2026)

Satu komponen dipakai dua halaman (B2B Partnership, Organization Partnership), jadi keduanya berubah sekaligus.

### Do — yang berubah

| Sebelum | Sesudah |
|---|---|
| Tab bergaris Overview / Master Data / Pipeline / Deals & Scope / Outreach Log; tombol "Tambah" | Judul + "N partners · M in progress · K closed deals", tombol **Add partner** / **Add organization**; saklar **Pipeline / All partners / Deals & scope / Outreach log / Insights** (dengan jumlah) |
| Overview (5 kartu angka) jadi halaman pertama | **Board pipeline** jadi halaman pertama: 5 kolom bernomor (Approached → Closed Lost) dengan jumlah; kartu: nama, chip **Strategic** hanya untuk tier Strategic, kategori, avatar + nama PIC, "N deals · last contact 8 Oct"; drag antar kolom = ganti stage; "+ Add partner" di tiap kolom langsung mengisi status kolom itu |
| Master Data: tabel 9 kolom, 2 pil per baris | **Daftar partner**: logo inisial, nama + kategori · tier, PIC + jabatan · telepon, aktivitas (deal & kontak terakhir), **satu** chip status; hapus minta konfirmasi dengan nama partnernya |
| Deals: tabel input kecil | **Kartu deal** yang bisa diedit di tempat (nama, partner, stage, deadline, nilai, scope, catatan); tersimpan saat keluar dari field |
| Outreach: tabel input kecil | **Timeline per hari** (terbaru di atas): ikon channel, partner, channel/tanggal/respons sebagai pil, isi & catatan bisa diedit di tempat |
| — | **Insights**: 5 angka, distribusi stage/kategori/tier, partner yang baru ditambahkan |

- Logika di `lib/partnership/view.ts` (`pipelineColumns`, `partnerActivity`, `partnerSummary`, `outreachByDay`) + 3 unit test (tiap partner tepat sekali di board; status kosong/lama masuk kolom pertama).
- Alamat lama tetap jalan: `?tab=overview` → Insights, `?tab=master` → All partners, `?tab=deals` / `?tab=outreach` sama.
- Form partner: Company name wajib — kalau kosong ditandai merah & difokus.
- Teks Inggris: "Input dengan AI" → "Add with AI"; label entitas "organisasi" → "organization"; deal baru bernama "New deal"; menu samping "Overview" → "Pipeline".

### Check

- Desain 1440 & 390. Ditemukan & diperbaiki: kolom ke-5 board terpotong di 1440 → lebar kolom minimum diturunkan; input tanggal deal tertimpa kolom nilai → grid field menyesuaikan lebar; saklar view di HP terpotong → jumlah disembunyikan di HP.
- E2E baru Partnership **23/23** (5 kolom urut, semua partner sekali, kartu Strategic+PIC+aktivitas, drag menyimpan, Add di kolom mengisi status, nama kosong ditandai & fokus, daftar satu chip, filter, hapus pakai konfirmasi, edit deal tersimpan, Add deal, outreach per hari terbaru dulu, Log outreach, Insights, `?tab=overview`, HP).
- Regresi: unit 111/111 (tes konsistensi menemukan label konfirmasi dinamis → dibuat label tetap "Delete partner"/"Delete organization"), CRM 24/24, Talent Pool 21/21, Program 21/21, Tickets+Dashboard 19/19, modul 12/12, popup 31/31, navigasi 32/32 (selector deal/outreach diperbarui), search 46/46, form & tabel 893/893, Content Library lolos, Design Assets 49/49, audit popup Partnership ok.
- tsc bersih; lint: sisa error lama di competitor-tools & content-planning-tools; `npm run build` lolos.

### Antrean

Customer Knowledge → Content Planning, lalu Products, Job Vacancy, Competitor, Settings.

## Putaran 18 — Customer Knowledge (IJIS layout) (22 Okt 2026)

### Do — yang berubah

| Sebelum | Sesudah |
|---|---|
| Tab Dashboard / Database / Analytics Free Class; dua link "Platforms" & "Categories" ke tempat yang sama; tombol "Tambah Data" | Judul + "N pain points · M Free Class responses · X/5 average"; tombol **Platforms & categories** (satu link) dan **Add pain point**; saklar **Pain points / Free Class feedback** |
| Dashboard (grafik) dan Database (daftar) terpisah | Satu halaman: **feed kutipan** (komentar, platform · username · bulan, kategori, #label, edit/hapus) + panel **What stands out** di samping: Top categories, Words people repeat, By platform, By month — semuanya bisa diklik untuk memfilter feed |
| Label & kategori warna-warni (8 warna) | Satu palet: kategori biru muda, label sebagai teks "#label" |
| Free Class: 3 kartu angka, progress bar polos, 3 daftar jawaban panjang | Kartu **Overall score** besar, rating per aspek (terendah dulu) sebagai bar, distribusi series/universitas/angkatan, **In their words** dengan saklar To improve / What went well / Topics wanted, daftar responden dilipat |
| Bulan "Mei/Agu/Okt/Des", label rating & pesan bahasa Indonesia | Tampilan Inggris (May/Aug/Oct/Dec, label rating Inggris); **nilai yang disimpan tetap** ("Okt" dll) |

- Logika di `lib/customer-knowledge/view.ts` (`monthLabel`, `labelsOf`, `distribution`, `monthCounts`, `topKeywords`, `filterPainPoints`) + 4 unit test.
- **Bug lama diperbaiki:** filter kategori "Unknown" (komentar tanpa kategori) dulu tidak pernah cocok dengan apa pun; sekarang cocok dan jumlahnya sama dengan panel Top categories (dites).
- Form: komentar wajib — kalau kosong ditandai merah & difokus; teks AI screenshot & pemilih label Inggris.

### Check

- Desain 1440 & 390; di HP dua tombol header ditumpuk supaya tidak terpotong.
- E2E baru Customer Knowledge **20/20** (feed lengkap, bulan Inggris, klik kategori & kata memfilter, filter bulan menyimpan nilai asli, form edit, bulan di form Inggris, komentar kosong ditandai & fokus, hapus pakai konfirmasi, satu link Settings, skor & rating terurut, jawaban kosong ("-", "oke") tidak dihitung, ganti pertanyaan, `?focus`, HP).
- Regresi: unit 115/115, Partnership 23/23, CRM 24/24, Talent Pool 21/21, Program 21/21, Tickets+Dashboard 19/19, modul 12/12, popup 31/31, navigasi 32/32, search 46/46, form & tabel 893/893, Content Library lolos, Design Assets 49/49, audit popup Customer Knowledge ok.
- tsc bersih; lint: sisa error lama di competitor-tools & content-planning-tools; `npm run build` lolos.

### Nice-to-have

- Grafik pie (dipakai bersama modul lain) masih multiwarna; disamakan ke satu palet saat merapikan komponen grafik.

### Antrean

Content Planning, lalu Products, Job Vacancy, Competitor, Settings.

## Putaran 19 — Content Planning (IJIS layout) (22 Okt 2026)

### Do — yang berubah

| Sebelum | Sesudah |
|---|---|
| Tab bergaris Carousel Plan / Story Plan / KOL List / MT Story; panel "Input dengan AI" lipat; panel Links | Judul + "N carousels this month · M story dates · K still in draft"; saklar **Carousels / Stories / KOL list / MT Story** (dengan jumlah); **satu tombol utama di header yang mengikuti view** (Add carousel plan / Add story date / Add KOL / Add MT story) |
| Kalender kecil berisi titik merah/hijau, lalu daftar mingguan di bawahnya | **Planner dua kolom**: kalender bulan (Senin pertama) yang menampilkan **judul** di tiap hari (2 judul + "+N more"; klik judul = edit, klik hari kosong = rencana baru di tanggal itu) + **agenda per minggu** di sampingnya ("Week 4 · October", "1/4 done"; minggu lalu dilipat, minggu ini & nanti terbuka) |
| Baris carousel dengan garis kiri warna & pil funnel warna-warni | Baris: centang bulat (sekali klik Done), judul, tanggal (klik = ganti tanggal), funnel · CTA sebagai teks, link Brief/Reference (edit di tempat), avatar assignee |
| Kartu tanggal story yang bisa dilipat | Kartu tanggal: centang posted, slide bernomor yang bisa diedit di tempat, Add story, hapus |
| Bar AI & Links terpisah dan dilipat | Bar AI satu baris ("Fill form with AI") + bar Links (chip, hapus link sekarang minta konfirmasi) |
| Date picker: hari draft **merah**, hari done hijau | Satu palet: hari yang ada draft = biru muda, semua done = abu dicoret, angka jumlah bila >1; Senin pertama |
| KOL & MT Story: kartu dengan pil platform warna-warni, "Tandai Posted" | Direktori kartu: avatar, nama, niche/perusahaan, link platform netral dengan jumlah follower, Rate/Contact, catatan; filter pil dengan jumlah; **Mark as posted**; chip "Posted" hanya untuk yang sudah posted |

- Logika kalender/agenda di `lib/content-planning/view.ts` (`weekStart`, `weekLabel`, `weekRange`, `groupByWeek`, `monthCells`, `byDay`) + 3 unit test.
- Field wajib (judul carousel, minimal satu story, nama KOL/MT, label link) sekarang ditandai merah & difokus saat disimpan kosong — sebelumnya tombol Save hanya dimatikan tanpa penjelasan.
- Semua teks Inggris (bulan, hari, "Week N · Month", placeholder AI, form).
- **Lint:** 3 error lama di file ini (setState di effect pada Avatar, link inline, slide story) beres; sisa error lint di repo tinggal 1 (competitor-tools).

### Check

- Desain 1440 & 390. Di HP judul di kalender diganti titik (biar tidak terpotong), tombol AI selebar layar. Audit popup menemukan angka kecil 9px di date picker → dinaikkan ke 11px.
- E2E baru Content Planning **26/26** (bulan ini & Inggris, Senin pertama, judul di kalender + "+1 more", klik judul = edit, klik hari kosong = tanggal terisi, judul kosong ditandai & fokus, minggu lalu dilipat, label minggu + done, centang Done, ganti tanggal lewat picker, link brief inline, AI mengisi form, tombol header mengikuti view, slide story & links, story kosong ditandai, follower KOL, filter niche, filter Not posted + Mark as posted, HP).
- Regresi: unit 118/118, Customer Knowledge 20/20, Partnership 23/23, CRM 24/24, Talent Pool 21/21, Program 21/21, Tickets+Dashboard 19/19, modul 12/12, popup 31/31 (selector tab MT Story diperbarui), navigasi 32/32, search 46/46, form & tabel 893/893, Content Library lolos, Design Assets 49/49, audit popup Content Planning bersih.
- tsc bersih; `npm run build` lolos.

### Antrean

Urutan dari user selesai (Talent Pool → CRM → Partnership → Customer Knowledge → Content Planning). Sisa: Products, Job Vacancy, Competitor, Settings, Content Evaluation / Meta Ads / Instagram, Design Assets, Resources, Collaborators.

## Putaran 20 — Products (IJIS layout) (22 Okt 2026)

### Do — yang berubah

| Sebelum | Sesudah |
|---|---|
| Kartu atas: judul, "Tambah Produk", form tambah yang muncul inline, 4 kartu angka (Live hijau, Bundles ungu) | Judul + "N products · X live · Y bundles · catalog value Rp…", tombol **Add product** membuka form popup; saklar **Catalog / Manage data** |
| Daftar kiri: kotak polos + 4 dropdown/pil ("Semua", "Satuan", "Harga tertinggi") | Panel katalog: search, saklar **All / Single / Bundles** dengan jumlah, filter pil Status / Class / Sort; baris produk: ubin inisial (bundle = ikon tumpuk), nama, klasifikasi, harga, **satu** chip status |
| Detail: kartu judul + 2 pil warna, lalu **9 tab** (Overview, Pain points … Feedback, Manage) | **Halaman produk**: kartu utama (jenis, nama, deskripsi, status, landing page, harga, Duplicate, Export KB); untuk bundle: kartu isi bundle (jumlah produk, harga kalau dibeli terpisah, hemat %) + daftar isi + "Add to bundle"; lalu **papan Knowledge base**: 7 kartu (Pain points, Passion points, Benefits, Features, Sub-products, Assets, Feedback) tampil sekaligus, masing-masing dengan jumlah, tombol + untuk form tambah di tempat, link fitur/sub-produk |

- Logika di `lib/products/view.ts` (`filterProducts`, `catalogSummary`, `bundleMath`, `knowledgeFor`) + 3 unit test (hemat tidak pernah negatif; KB bundle ikut item produk di dalamnya).
- **Aman dari salah klik:** menghapus produk dari bundle dulu langsung terhapus; sekarang minta konfirmasi.
- Field wajib (nama produk, nama item KB, deskripsi feedback, nama duplikat) ditandai merah & difokus saat disimpan kosong.
- Teks Inggris: "Tambah Produk", "Simpan produk", "Batal", "Satuan/Bundling", "Semua label", "Harga tertinggi" → Add product, Save product, Cancel, Single product/Bundle, All, Highest price; nilai yang disimpan tetap ("satuan", "bundling", "Positif", "Lainnya").

### Check

- Desain 1440 & 390; di HP panel katalog jadi kotak bergulir di atas halaman produk.
- E2E baru Products **17/17** (katalog lengkap, filter Bundles, hitungan bundle 2 produk / hemat 20%, KB bundle ikut item anggota, link fitur, item kosong ditandai & fokus, tambah item ke produk yang benar, hapus item & keluarkan dari bundle minta konfirmasi, duplikat butuh nama, Add product kosong ditandai lalu tersimpan, Manage data, `?focus`, HP).
- Regresi: unit 121/121, Content Planning 26/26, Customer Knowledge 20/20, Partnership 23/23, CRM 24/24, Talent Pool 21/21, Program 21/21, Tickets+Dashboard 19/19, modul 12/12, popup 31/31, navigasi 32/32, search 46/46, form & tabel 893/893, Content Library lolos, Design Assets 49/49, audit popup Products ok.
- tsc bersih; lint: sisa 1 error lama (competitor-tools); `npm run build` lolos.

### Antrean

Job Vacancy MT → Competitor Intel → Settings → Content Evaluation / Meta Ads / Instagram → Design Assets / Resources / Collaborators.

## Putaran 21 — Job Vacancy MT (IJIS layout) (22 Okt 2026)

### Do — yang berubah

| Sebelum | Sesudah |
|---|---|
| Tab Dashboard / Semua Loker / Newsletter / Master Data / Company Intel; 4 kartu angka ("Total Loker", "Minggu Ini"…) | Judul + "N vacancies · M open in October · K added this week", tombol **Add vacancy**; saklar **Overview / Vacancies / Newsletter / Companies / Industries** (dengan jumlah) |
| Grafik garis per bulan + donat industri 12 warna + daftar kategori | **Opening calendar**: 12 batang bulan (bulan ini disorot), klik bulan = daftar lowongan bulan itu; **Industries**: peringkat perusahaan per industri + "N open" bulan ini, klik = filter; **Open in October**: perusahaan yang buka bulan ini + deadline |
| Tabel 7 kolom dengan pil role/bulan warna-warni | **Baris lowongan**: logo inisial, perusahaan + program, industri + role pertama (+N), **strip 12 bulan** (bulan buka terisi, bulan ini diberi garis), tahun · deadline, tanggal input · Week N, link karier, hapus |
| Panel import "Import dari Google Sheets" | Kartu **Import from Google Sheets** yang bisa dibuka, preview hasil (New/Update), teks Inggris; tombol simpan "Save N vacancies" (dulu "…ke Supabase", padahal datanya di server sendiri) |
| Form lowongan satu kolom panjang, validasi lewat pesan toast | Form bagian per bagian (Company, When it opens, Requirements, Links & notes); pemilih bulan 6×2; **semua field wajib yang kosong ditandai merah sekaligus**, kursor pindah ke yang pertama, footer menyebut jumlahnya |
| Newsletter: deretan dropdown, dropdown industri melayang | **Dua panel**: kiri pilih bulan/tahun, **Week 1–4** sebagai tombol, industri sebagai pil + jumlah lowongan yang masuk; kanan pesan WhatsApp/Email + **Copy message** |
| Company Intel: kartu dengan pil status warna | Kartu perusahaan: program, riwayat per tahun dengan strip bulan, chip "Opening months changed" |
| Master Data industri: hapus langsung tanpa tanya | **Industries**: tambah (nama kosong ditandai), jumlah lowongan per industri, hapus **minta konfirmasi** dan menjelaskan lowongan lama tetap memakai nama itu |

- Isi pesan newsletter tetap **bahasa Indonesia** (untuk pelanggan); hanya tampilan aplikasi yang Inggris.
- **Bug lama diperbaiki:** tombol Copy di newsletter membuat halaman error kalau dibuka lewat http (Clipboard API hanya ada di https) — sekarang ada cadangan.
- Logika di `lib/job-vacancy/view.ts` (`monthsOf`, `weekOfMonth`, `vacancySummary`, `openingsByMonth`, `industryRanking`, `filterVacancies`, `newsletterRows`, `companyHistory`) + 4 unit test (angka batang bulan = hasil filter bulan; industri kosong = "Lainnya" dan bisa difilter).
- CSS lama `job-vacancy-mt.module.css` diganti `job-vacancy.module.css`.

### Check

- Desain 1440 & 390. Ditemukan & diperbaiki: di HP baris lowongan menampilkan industri, bukan nama perusahaan (urutan kolom) → kolom diberi nama tetap.
- E2E baru Job Vacancy **20/20** (klik bulan = daftar terfilter dan jumlahnya cocok, "Lainnya", strip bulan, buka form edit, form kosong: 5 field ditandai & fokus ke pertama, hapus pakai konfirmasi, newsletter minggu ini + tahapan seleksi, pesan tetap Indonesia, Copy, riwayat perusahaan, industri kosong ditandai, hapus industri pakai konfirmasi, HP).
- Regresi: unit 125/125, Products 17/17, Content Planning 26/26, Customer Knowledge 20/20, Partnership 23/23, CRM 24/24, Talent Pool 21/21, Program 21/21, Tickets+Dashboard 19/19, modul 12/12, popup 31/31 (tab "Semua Loker" → "Vacancies"), navigasi 32/32, search 46/46, form & tabel 893/893, Content Library lolos, Design Assets 49/49, audit popup Job Vacancy bersih.
- tsc bersih; lint: sisa 1 error lama (competitor-tools); `npm run build` lolos.

### Antrean

Competitor Intel → Settings → Content Evaluation / Meta Ads / Instagram → Design Assets / Resources / Collaborators.

## Putaran 22 — Competitor Intel (IJIS layout) (22 Okt 2026)

### Do — yang berubah

| Sebelum | Sesudah |
|---|---|
| Tab Overview / Kompetitor / Produk & Pricing; tombol "Tambah"; 5 kartu angka (Direct merah, Indirect kuning, Substitusi biru) | Judul + "N competitors · **X high threat** (merah) · Y flags logged", tombol **Add competitor**; saklar **Threat landscape / Competitors / Products & pricing** |
| Overview: dua daftar (semua kompetitor dengan 3 pil warna, daftar threat) | **Threat landscape**: kolom **High / Medium / Low / Not rated** (kolom High satu-satunya yang merah — itu memang bahaya); kartu: logo, nama, kategori · niche, follower terbesar, jumlah flag; pil kategori (All/Direct/Indirect/Substitute + jumlah) memfilter papan |
| Kartu kompetitor dengan pil kategori merah/kuning/biru, sort & filter tercampur dalam satu dropdown ("Threat: High" ada di "Urutkan") | **Direktori**: logo, nama, domain, **satu** chip threat (merah hanya High), Category/Niche/Audience, kotak follower per platform, catatan; filter terpisah Search / Category / Threat / Audience dan **Sort** sendiri; edit & hapus berlabel |
| Produk & pricing: kartu kecil per kategori | **Papan harga**: per kategori, termurah dulu, rentang harga, bar posisi harga tiap produk, logo kompetitor; link "Manage products & prices" tetap |
| Form: threat lewat radio kecil, nama kosong → toast | Threat sebagai pilihan 3 tombol (High merah), platform sebagai pil, nama kosong ditandai merah & difokus |

- Threat diambil dari **snapshot terbaru** bila ada (sama seperti sebelumnya di Overview) — sekarang konsisten juga di direktori dan filter (dulu direktori memakai threat profil saja).
- Logika di `lib/competitor/view.ts` (`threatOf`, `filterCompetitors`, `competitorSummary`, `priceBoard`) + 3 unit test.
- **Lint bersih:** error terakhir di repo (setState di effect pada logo kompetitor) beres — `npm run lint` tinggal 1 peringatan `<img>` lama.
- Teks Inggris: "Kompetitor", "Produk & Pricing", "Tambah", "Urutkan…", "Semua Kategori", "Substitusi" → Competitors, Products & pricing, Add competitor, Sort, All, Substitute (nilai tersimpan tetap "substitusi").

### Check

- Desain 1440 & 390. Ditemukan & diperbaiki: rentang harga "Rp99K–Rp99K" untuk satu produk → satu harga saja; kategori tampil dua kali di kartu tanpa URL → sekali.
- E2E baru Competitor Intel **19/19**.
- Audit popup menemukan form Add/Edit competitor lebih tinggi dari layar (tombol bawah tak terjangkau di laptop & HP) → popup kini bisa digulir, footer menempel.
- Regresi: unit 128/128, Job Vacancy 20/20, Products 17/17, Content Planning 26/26, Customer Knowledge 20/20, Partnership 23/23, CRM 24/24, Talent Pool 21/21, Program 21/21, Tickets+Dashboard 19/19, modul 12/12, popup 31/31, navigasi 32/32, search 46/46, form & tabel 893/893, Content Library lolos, Design Assets 49/49, audit popup Competitor/Products/Job Vacancy bersih.
- tsc bersih; lint **0 error** (1 peringatan lama); `npm run build` lolos.

### Antrean

Settings → Content Evaluation / Meta Ads / Instagram → Design Assets / Resources / Collaborators.

## Putaran 23 — Settings (IJIS layout) (23 Okt 2026)

### Do — yang berubah

| Sebelum | Sesudah |
|---|---|
| Satu baris tab bergaris 9 bagian (dipadatkan supaya muat 1280px) | Judul halaman + **daftar bagian vertikal di kiri**, dikelompokkan **Workspace** (Menu, Users & roles) dan **Module lists** (Ticket setup … Competitor lists), masing-masing dengan ikon; di HP jadi strip pil yang bisa digeser |
| Isi bagian langsung tanpa penjelasan | Kepala bagian: ikon, judul, **satu kalimat apa gunanya bagian ini** |
| Menu: checkbox kecil | **Switch** per modul, dikelompokkan per bagian menu; label sidebar per bagian |
| Pain point lists: chip platform & daftar kategori warna-warni, **hapus langsung tanpa tanya**, teks Indonesia | Kartu Platforms & Categories satu palet; **hapus minta konfirmasi** (dan menjelaskan pain point lama tetap memakai nama itu); tambah kosong ditandai merah & difokus; teks Inggris |
| Ticket setup › Status & email: pil Todo/In Progress/Done warna-warni | Alur status bernomor 1→2→3; penerima email per divisi dengan avatar (Lead / Staff) |
| Competitor lists: tombol "Simpan perubahan" selalu aktif | Dua kartu tag + bar simpan menempel: "You have unsaved changes" / "All changes saved", tombol **Save competitor lists** aktif hanya kalau ada perubahan |

- Pemilih warna kategori pain point dihapus dari Settings: sejak Putaran 18 warna kategori tidak ditampilkan lagi (satu palet). Nilai warna yang tersimpan tidak diubah.
- Label & urutan bagian, alamat `?tab=…&section=…`, dan "search membuka bagian yang benar" tidak berubah.

### Check

- Desain 1440 & 390.
- E2E baru Settings **12/12** (kelompok bagian, kepala bagian + deskripsi, switch menu, platform kosong ditandai & fokus, hapus platform minta konfirmasi & Esc = batal, alur ticket + penerima email, simpan competitor lists menunggu perubahan, HP).
- Tes navigasi diperbarui: dulu memeriksa "semua bagian dalam satu baris", sekarang "daftar vertikal rapi" — 32/32.
- Regresi: unit 128/128, Competitor 19/19, Job Vacancy 20/20, Products 17/17, Content Planning 26/26, Customer Knowledge 20/20, Partnership 23/23, CRM 24/24, Talent Pool 21/21, Program 21/21, Tickets+Dashboard 19/19, modul 12/12, popup 31/31, search 46/46, form & tabel 893/893, Content Library lolos, Design Assets 49/49, audit popup Settings bersih.
- tsc bersih; lint 0 error; `npm run build` lolos.

### Antrean

Content Evaluation / Meta Ads / Instagram → Design Assets / Resources / Collaborators.

## Putaran 24 — Content Evaluation, Meta Ads, Instagram (IJIS layout) (23 Okt 2026)

### Do — yang berubah

| Sebelum | Sesudah |
|---|---|
| **Meta Ads**: daftar kartu + 3 dropdown filter | Judul + ringkasan ("3 candidates · 1 to boost · 1 still to decide"), pil funnel dengan jumlah, **papan keputusan 3 kolom To decide / Boost / Skip**; kartu: format, funnel · objective, sinyal boost (batang, bukan warna merah), reach/views/saves, pilihan Pending/Boost/Skip (aksi yang sama) |
| **Instagram**: tab bergaris, 5 kartu angka warna-warni, label campur ("perlu update", "prediksi") | Segmented Overview / Import / Target & baseline; **hero followers + goal tahun ini** (progres + proyeksi 31 Des); peringatan merah hanya kalau baseline >21 hari tertinggal; 4 angka; 3 grafik satu palet; riwayat mingguan berhalaman; Import dengan dropzone + jumlah file dipilih |
| **Content Evaluation**: tab, banner sync, teks campur Indonesia ("Kalender Posting", "Semua Konten", "Tambah", "Korelasi per Hari"), modal buatan sendiri | Judul + Import Meta CSV / Add evaluation di kepala; segmented view dengan jumlah; pil rentang tanggal; Overview: angka → Top content (urut follows+link taps / follows / link taps) → 3 grafik bulanan → kalender posting (Senin dulu) → Top 5 Reels/Carousels/Stories; Reels & Feed: tabel dengan baris bisa diklik; Story vs Buyer: hari yang bisa dibuka; popup standar (Dialog, footer menempel) |

- Nilai "action" yang tersimpan tetap Indonesia ("Boost ke Meta Ads", dst.) — hanya labelnya Inggris ("Boost on Meta Ads", "Turn into a template", "Repurpose to another format"). Filter & form tetap menyimpan nilai lama.
- Teks insight otomatis di detail evaluasi (lib/analytics/content) diterjemahkan ke Inggris; rumus skor tidak berubah.
- Grafik followers & reach/interactions: satu palet biru, garis target abu-abu (dulu merah), legenda Inggris (dulu "Followers Aktual", "Prediksi").
- Logika perhitungan followers dari baseline dipindah ke `lib/marketing/view.ts` (+ unit test), isinya sama.
- Grade skor (Top Performer / Performing Well / Average / Needs Improvement) memakai gradasi biru — skor rendah bukan bahaya, jadi tidak merah.

### Bug lama yang ikut diperbaiki

- Instagram tanpa baseline: proyeksi dihitung dari 0 followers sehingga garis prediksi minus (−10.000). Sekarang tanpa baseline proyeksi berangkat dari minggu terakhir.
- Import CSV bisa ditekan tanpa file; sekarang tombol aktif setelah file dipilih.

### Check

- Desain 1440 & 390 untuk ketiga halaman (termasuk popup detail & form evaluasi). Ditemukan & diperbaiki: pil rentang tanggal terbelah dua baris di HP → satu baris yang bisa digeser; legenda grafik masih Indonesia; insight otomatis masih Indonesia.
- E2E baru marketing **47/47** (papan keputusan & filter funnel, aksi keputusan sama, tidak ada merah di kartu, ?focus iklan; hero + goal, pager riwayat, import menunggu file + pesan hasil, baseline kosong ditandai & difokus tanpa tersimpan; Top content & urutan, kalender Inggris Senin dulu, label action Inggris tapi nilai tersimpan tetap, judul kosong ditandai & difokus, simpan ke content_evaluations, filter action, Story vs Buyer, import, hapus minta konfirmasi; HP tanpa scroll samping).
- Regresi: unit 131/131, Settings 12/12, Competitor 19/19, Job Vacancy 20/20, Products 17/17, Content Planning 26/26, Customer Knowledge 20/20, Partnership 23/23, CRM 24/24, Talent Pool 21/21, Program 21/21, Tickets+Dashboard 19/19, modul 12/12 (termasuk "detail evaluasi terbuka dari ?focus"), popup 31/31, navigasi 32/32, search 46/46, form & tabel 893/893, Content Library lolos, Design Assets 49/49, audit popup Content Evaluation/Instagram bersih (Meta Ads tidak punya popup).
- tsc bersih; lint 0 error (1 peringatan lama); `npm run build` lolos.

### Antrean

Design Assets / Resources / Collaborators. Nice-to-have: pie chart multiwarna (`charts.tsx` DistributionPie/IndustryDoughnut) ke satu palet.

## Putaran 25 — Design Assets, Resources, Collaborators (IJIS layout) (23 Okt 2026)

### Do — yang berubah

| Sebelum | Sesudah |
|---|---|
| **Design Assets**: tab bergaris Gallery / Manage data, filter dropdown, panel "Upload design asset" terlipat di atas galeri | Judul + ringkasan ("9 items in 3 categories · N images"), tombol utama **Upload design asset** membuka popup; segmented Gallery / Manage data; pil kategori dengan jumlah; kartu satu gaya (gambar, nama, tipe, likes/views, Source + Add to library) |
| Upload: form polos, gambar boleh kosong sampai Save gagal diam-diam | Popup dengan Name* & Category* (saran dari kategori yang ada), dropzone gambar* (pilih, tarik, atau tempel), pratinjau dengan tombol hapus per gambar; gambar kosong ditandai merah + difokus + pesan "Add at least one image." |
| **Resources**: satu daftar panjang, ikon kuning untuk kredensial, tombol naik/turun & copy tanpa label | Kartu per kategori; baris dengan host link yang bisa diklik (URL tanpa https juga), Username / Email / Password berlabel dengan tombol Copy masing-masing, password tersembunyi + Show/Hide; pil All / Links / Logins + filter kategori; naik/turun hanya di dalam kategori dan dimatikan saat difilter |
| **Collaborators**: tab bergaris, status warna-warni (biru/abu/hijau), Privy kuning | Segmented Collaborators / Advisors / Manage data; kartu dengan avatar (foto atau inisial), **satu chip status**, chip Privy complete / not complete; filter status + "Privy not complete"; ringkasan "1 without Privy"; popup profil dengan foto yang bisa diganti (klik, tarik, tempel) |

- KOL directory & MT Story (halaman data di Content Planning) memakai galeri yang sama, jadi ikut berganti gaya.
- Nilai tersimpan tidak berubah: tipe "assets"/"references" hanya diberi label Asset/Reference; status kolaborator tetap teks bebas (dengan saran).
- CSS bersama `marketing.module.css` diganti nama jadi `page-kit.module.css` karena kini dipakai di luar Marketing.
- Logika daftar (filter, grup, pindah urutan, ringkasan) di `lib/library/view.ts` + unit test. Fungsi copy dengan cadangan untuk http dipindah ke `copy-text.ts`.

### Bug lama yang ikut diperbaiki

- Form upload aset, profil kolaborator, form evaluasi konten dan import Meta CSV memakai *form action* React, yang **mengosongkan isian** setiap kali dijalankan — kalau upload/simpan gagal, isian yang sudah diketik hilang. Sekarang isian tetap ada kalau gagal.
- Profil kolaborator: setelah Save, popup tetap terbuka tanpa tanda tersimpan. Sekarang tertutup + notifikasi "Profile saved."; gagal simpan memberi pesan.
- Resources: Copy memakai Clipboard API saja, yang tidak ada di http (internal.ccclub.id tanpa https akan gagal). Sekarang ada cadangan.
- Resources: link tanpa `https://` (mis. "figma.com/files") dibuka sebagai alamat relatif di dalam app. Sekarang jadi link luar yang benar.
- Resources: urutan baru gagal disimpan tanpa kabar. Sekarang ada pesan.

### Check

- Desain 1440 & 390 untuk ketiga halaman. Ditemukan & diperbaiki: tombol copy/naik/turun di Resources bertumpuk vertikal sehingga baris terlalu tinggi → satu baris; teks petunjuk "one per line" di profil kolaborator terlalu kecil (audit) → 12px; judul "Design assets" beda dengan menu "Design Assets" → disamakan.
- E2E baru **44/44** (kategori & tipe, upload: nama kosong ditandai & difokus, tanpa gambar ditandai + pesan, pratinjau & hapus gambar, satu upload lalu record dibuat, popup tertutup + notifikasi; Resources: host & link tanpa https, password tersembunyi/tampil/copy, naik-turun dalam kategori, simpan urutan, filter Logins, urutan dimatikan saat difilter; Collaborators: ringkasan Privy, filter Privy, advisor + services, tanpa merah, simpan profil, ?focus ke tab Advisors; HP tanpa scroll samping).
- Regresi: unit 140/140, Marketing 47/47, Settings 12/12, Competitor 19/19, Job Vacancy 20/20, Products 17/17, Content Planning 26/26, Customer Knowledge 20/20, Partnership 23/23, CRM 24/24, Talent Pool 21/21, Program 21/21, Tickets+Dashboard 19/19, modul 12/12, popup 31/31, navigasi 32/32, search 46/46, form & tabel 893/893, Content Library lolos, Design Assets (lama) 49/49, audit popup Design Assets/Resources/Collaborators bersih.
- tsc bersih; lint 0 error 0 peringatan; `npm run build` lolos.

### Antrean

Semua modul sudah layout IJIS. Nice-to-have: pie chart multiwarna (`charts.tsx`) ke satu palet; tabel rundown Program; panel Import di Manage data Talent Pool masih gaya lama.

### Sisipan — Import Talent Pool dari Google Sheet gagal (laporan user, 23 Okt)

Gejala: tab **Database Talent Pool** dipublish sebagai CSV, link ditempel ke Talent Pool → Manage data → Import Sheet, hasilnya *"This does not look like a Talent Pool sheet — no recognisable header row was found in the first 5 rows … Columns detected: 742."* Tidak ada yang masuk.

Penyebab: pencari baris judul (header) terlalu kaku.
- Hanya memeriksa **5 baris pertama**. Baris 1 di sheet ini isinya angka jumlah data (dulu 521, sekarang 742), jadi kalau ada baris tambahan di atas judul, judulnya tidak pernah ketemu.
- Hanya mengenali judul kalau **posisinya persis**: WhatsApp di kolom B, Email di C, Nama di D. Satu kolom saja disisipkan di depan, semuanya gagal.
- Pesan gagalnya hanya menyebut "742", jadi tidak kelihatan apa yang sebenarnya terbaca.

Perbaikan:
- Header dicari di **20 baris pertama**.
- Susunan form intake tetap dikenali walaupun ada kolom tambahan di depan Timestamp (kolomnya digeser otomatis).
- Header biasa (mis. Nama / Email / WhatsApp / Universitas) juga diterima dan dipetakan berdasarkan nama kolom.
- Export order lynk.id tetap ditolak, dengan pesan supaya dimasukkan lewat CRM → Import.
- Kalau masih gagal, pesannya menampilkan isi 3 baris pertama yang terbaca, supaya langsung jelas kalau tab atau susunannya salah.
- Link sheet atau file yang sudah dipilih tidak hilang lagi setelah import gagal.
- Unit test bertambah 5 kasus: header di bawah beberapa baris banner, kolom disisipkan, header biasa, dan export lynk ditolak (dua kasus).

Catatan: isi sheet aslinya tidak bisa gua buka dari sini, jadi penyebab persisnya (judul turun ke bawah baris 5, ada kolom baru, atau susunannya beda) belum gua pastikan. Pesan gagal yang baru akan menunjukkannya kalau masih gagal.

## Putaran 26 — Sisa nice-to-have: halaman data, Import Talent Pool, rundown, satu palet (23 Okt 2026)

Urutan prioritas: (1) yang dipakai harian dan masih kelihatan lama — halaman data (RecordManager, dipakai ±20 halaman + tab Manage data di 8 modul) dan panel Import Talent Pool; (2) rundown Program; (3) warna grafik.

### Do — yang berubah

| Sebelum | Sesudah |
|---|---|
| **Halaman data** (Features, Benefits, Bundles, Snapshots, Tasks, dst.): judul tipis, angka besar di kanan, "+ Add …" sebagai panel terlipat di atas tabel, teks tabel 11px / judul kolom 9px huruf besar | Kepala halaman IJIS (eyebrow, judul tebal, "5 features · deskripsi"), tombol utama **Add …** membuka popup (sama dengan Edit), pil daftar terkait, kotak cari otomatis bila data >12 baris, tabel 13px |
| Tab **Manage data** di modul (Talent Pool, Products, Resources, Collaborators, Design Assets, Instagram, KOL, MT Story): judul halaman muncul dua kali (h1 modul + h1 RecordManager) | Mode *embedded*: satu baris "31 candidates · deskripsi" + Add — tanpa judul ganda |
| **Import Talent Pool**: dua baris form polos ("Upload CSV / XLSXChoose File…"), pesan error kecil abu-abu | Kartu **Import candidates**: dropzone file + kolom link Google Sheet berdampingan, petunjuk cara publish (File → Share → Publish to web → tab → CSV), hasil "Imported 740 candidates · 2 skipped", error tampil sebagai peringatan; link tidak hilang setelah gagal |
| **Rundown Program**: tabel berisi form yang selalu terbuka (semua baris bisa diketik, simpan per baris pakai ikon disket), header campur Indonesia ("Waktu", "Durasi", "Keterangan", "Naikkan") | **Timeline**: jam mulai → selesai + durasi per item, aktivitas, catatan, blok "MC" untuk cue, link; Edit membuka form di baris itu (Activity* difokus, Save item / Cancel / Esc); item baru langsung terbuka untuk diisi; naik/turun/hapus (hapus minta konfirmasi); kepala halaman + pilih event + Starts/Ends/Duration/Status |
| **Grafik**: pie Customer Knowledge 8 warna, donut Analytics Talent Pool/CRM 12–15 warna, kalender fase hijau/merah/biru + tiket oranye, garis status event hijau/biru/merah | Satu palet biru: pie & donut jadi **bar berperingkat satu warna** (label, jumlah, % per baris — lebih mudah dibandingkan); kalender: fase = gradasi biru (Event day paling tegas), tiket = chip netral; status event Cancelled abu-abu (bukan merah) |
| Kalender Dashboard/Program: bulan & hari Indonesia, mulai Minggu, teks 8–10px, "Sempit ▲ / +2 lainnya" | Inggris, **mulai Senin**, teks 11–12px, "Show less / +2 more", "Today"; fase "Hari H" tampil sebagai "Event day" (nilai tersimpan tetap) |

### Bug lama yang ikut diperbaiki

- Form tambah/edit di semua halaman data memakai *form action* yang mengosongkan isian setelah dijalankan — kalau simpan gagal, isian hilang. Sekarang tetap.
- Tambah data tidak memberi tanda berhasil (panel tetap terbuka, kosong). Sekarang popup tertutup + notifikasi "… added."
- Rundown: dua item dengan nomor urut sama tidak bisa ditukar (tombol naik/turun tidak berbuat apa-apa). Sekarang jatuh ke posisi.
- Rundown: link tanpa https dibuka sebagai alamat di dalam app.
- Kalender: judul task kosong hanya memberi pesan, kolomnya tidak ditandai/difokus. Sekarang ditandai merah + difokus.
- Judul kolom tanpa label katalog tampil huruf kecil ("buyer match") → "Buyer match".
- Kode gaya mati di Program (pil status warna-warni yang tidak dipakai lagi) dihapus; komponen donut industri yang tidak dipakai dihapus.
- Program: tab fase & judul grup tampil "Pre-event / Event day / Post-event" (nilai tersimpan "Pre Event / Hari H / Post Event" tetap) — konsisten dengan kalender.

### Check

- Desain 1440 & 390: halaman data, Manage data Talent Pool + Import, rundown (halaman sendiri & di detail Program), kalender Dashboard, Analytics Talent Pool.
- E2E baru **39/39** (halaman data: judul + jumlah, tanpa panel terlipat, Add = popup, wajib kosong difokus & tidak tersimpan, simpan sekali + tertutup + notifikasi, pil daftar terkait; embedded: satu h1, Add candidate; Import: tombol file menunggu file, alasan server tampil sebagai peringatan, link tetap setelah gagal, jumlah hasil; rundown: jam dari start event, cue MC & link, perkiraan selesai, Edit fokus ke Activity, kosong ditandai & tidak tersimpan, Save item memanggil aksi yang sama, naik/turun, tambah di akhir, hapus minta konfirmasi & Esc batal; palet: kalender Inggris mulai Senin + "Event day", tanpa chip merah/oranye, tanpa pie multiwarna, Analytics satu palet & label Inggris; HP tanpa scroll samping).
- Tes form & tabel RecordManager diperbarui (Add sekarang tombol → popup): **946/946** (sebelumnya 893; +53 cek "form tambah = popup" per tabel). Tes Program "phase tab" dan rundown ?focus disesuaikan dengan timeline (li, bukan tr).
- Regresi: unit 140/140, semua suite modul lolos (Putaran 25 44/44, Marketing 47/47, Settings 12, Competitor 19, Job Vacancy 20, Products 17, Content Planning 26, Customer Knowledge 20, Partnership 23, CRM 24, Talent Pool 21, Program 21, Tickets 19, modul 12, popup 31, navigasi 32), search 46/46, Content Library lolos, Design Assets 49/49; audit popup Talent Pool / Product features / Program / Dashboard / Customer Knowledge / Products bersih.
- tsc bersih; lint 0 masalah; `npm run build` lolos.

### Antrean

Tidak ada sisa dari daftar redesign. Yang masih bisa dirapikan kapan-kapan: warna header email blast default (#2e2a7a, belum dijawab), dan pemeriksaan rahasia di repo (repo Public).

## Cek keamanan repo (Public) — 23 Okt 2026

Diperiksa: seluruh riwayat git (310 commit, branch `main` + `refactor`) untuk pola rahasia (AWS/Google/OpenAI/Anthropic/GitHub/Slack/Resend/SendGrid key, private key, JWT, URL database dengan password, `client_secret`, `private_key`), file data (CSV/XLSX/JSON/SQL dump), alamat IP server, dan email pribadi.

Hasil:
- **Tidak ada password/token/key asli** di riwayat. URL database di README, `.env.example` dan DEPLOYMENT_VPS.md semuanya placeholder (`password`, `URL_ENCODED_PASSWORD`). Tidak ada IP server. Tidak ada file data/dump — hanya skema & migrasi.
- **Data pribadi asli di file tes** (diperbaiki): `lib/imports/crm-rows.test.mjs` dan `lib/imports/talent-pool-layout.test.mjs` memuat baris asli dari export (nama lengkap, email, nomor WhatsApp, LinkedIn, kampus, IPK dua orang pembeli/peserta); `lib/search/registry.test.mjs` memuat dua email login akun kantor. Semua diganti data palsu (`@example.com`, nomor 62812000…); tes tetap 140/140. Catatan: versi lama tetap ada di riwayat git — menghapusnya perlu menulis ulang riwayat (force-push), atau cukup jadikan repo Private.
- **Branch `main` (app lama)** memuat URL project Supabase + *publishable key* di `index.html`. Key jenis ini memang dirancang publik, tapi dengan repo Public siapa pun bisa memakainya ke project itu — aman hanya kalau RLS di semua tabel ketat. Kalau project Supabase lama sudah tidak dipakai (data sudah pindah ke Postgres VPS), sebaiknya di-pause/hapus atau key-nya dicabut.

## Putaran 27 — Cek fungsional import data (23 Okt 2026)

Permintaan: cek fungsi, bukan tampilan — terutama import data.

### Cara uji

Bukan lewat UI tiruan. Keenam route import asli (`/api/talent-pool|crm|content-evaluation|instagram|mt-vacancies|free-class/import`) dijalankan langsung (login di-stub) ke **Postgres 16 sungguhan**, dengan tabel dibentuk seperti production (kolom dari migrasi 022, tipe `mt_vacancies` dari app lama: list = jsonb, `selection` = text, `year` = text). File uji dibuat menyerupai export asli: sheet Google Form Talent Pool (31 kolom + baris angka di atas), `myorder.xlsx` lynk.id, CSV Meta Business Suite, CSV harian Meta Insights (UTF-16 + `sep=,`), sheet lowongan, Google Form Free Class — plus variasi yang sering terjadi: BOM, `;` dari Excel Indonesia, judul kolom di bawah banner, sel tanggal Excel, `30/11/2026`, `1,234`, import ulang. Setelah import, isi tabel diperiksa dengan SQL.

Alat uji ini masuk repo: `tests/imports/` + `npm run test:imports` (menolak database yang namanya tanpa "test", karena tabelnya dikosongkan).

### Bug yang ketemu & diperbaiki

| # | Import | Gejala | Penyebab | Perbaikan |
|---|---|---|---|---|
| 1 | **Content Evaluation (Meta)** | 4 post berbeda masuk jadi 2; data post satu menimpa post lain | Pembaca CSV (ExcelJS) mengubah Post ID 17 digit jadi angka → digit belakang dibulatkan, ID bertabrakan | Semua CSV dibaca sebagai teks apa adanya (`lib/imports/workbook.ts`) |
| 2 | Content Evaluation (XLSX) | Sama, kalau Post ID disimpan Excel sebagai angka | Excel sendiri hanya menyimpan 15 digit — ID sudah rusak di file | Ditolak dengan alasan jelas ("…lost digits… import the CSV from Meta / format the column as Text"), tidak ada yang tercampur |
| 3 | Semua CSV | WhatsApp "0812…" tersimpan "812…", kode voucher "0012" jadi "12", IPK "3.50" jadi "3.5" | Sama dengan #1 | Sama dengan #1 |
| 4 | Semua CSV | CSV dari Excel setting Indonesia (pemisah `;`) tidak terbaca sama sekali | Pemisah selalu dianggap koma | Pemisah dideteksi otomatis (`,` `;` tab, juga baris `sep=`) |
| 5 | **Instagram** | Angka "1,234" di CSV Insights terbaca 1 | Baris dipecah per koma tanpa memperhatikan tanda kutip | Pemecah CSV yang benar + pembaca angka (`1,234`, `1.234.567`, `Rp 99.000`) |
| 6 | **Instagram** | Import ulang hanya file Views → Reach & Follows minggu itu jadi 0 | Update menulis semua metrik, yang tidak ada di file diisi 0 | Hanya metrik yang ada di file yang diubah |
| 7 | **Job Vacancy (file)** | Deadline `30/11/2026` → seluruh import gagal, pesan umum | Teks tanggal dimasukkan mentah ke kolom date | Tanggal dibaca (ISO, dd/mm/yyyy, "5 Okt 2026", serial Excel); yang tak terbaca dikosongkan + peringatan per baris |
| 8 | **Job Vacancy (Google Sheet)** | Sama, dan gagalnya **tanpa pesan** sama sekali | Sama + error tidak ditangkap di tombol Confirm | Parsing tanggal dipindah ke fungsi simpan bersama; error ditampilkan ("Nothing was saved: …") |
| 9 | Job Vacancy | Langkah seleksi tersimpan "a,b" — langkah yang mengandung koma terpecah | Array ditulis ke kolom text | Disimpan sebagai daftar JSON (seperti app lama); pembacaan sudah mendukung keduanya |
| 10 | **Talent Pool / Free Class (link sheet)** | Sheet belum dipublish → pesan membingungkan ("no header row…") | Google mengembalikan halaman login HTML, dibaca sebagai CSV | Dikenali: "Google returned a web page… Publish the tab first: File → Share → Publish to web…" |
| 11 | CRM (beberapa file) | File ke-2 gagal → pesan hanya error, padahal file ke-1 sudah tersimpan; dicoba ulang di mode *results* → riwayat pembelian dobel | — | Pesan menyebut file yang sudah masuk dan minta dikeluarkan saat coba ulang |
| 12 | Pesan error server | Masih Indonesia ("Isi dulu: Nama Perusahaan…", "Judul wajib diisi.", "Industri sudah ada!", dll.) | — | Diterjemahkan ke Inggris |

### Yang dicek dan sudah benar

Talent Pool: XLSX & CSV export, header di bawah banner + baris kosong, link sheet yang dipublish & link edit biasa (diubah ke export), import ulang tanpa dobel (email tanpa beda huruf besar/kecil), file lynk.id salah tempat ditolak ke CRM. CRM: order baru, PENDING dilewati, tanggal lynk day-first (31-07), catatan checkout (sumber/tahap/industri), import ulang tidak dobel, mode *results* mencocokkan WA beda format → Upsell + riwayat bertambah, sel tanggal Excel. Content Evaluation: tanggal Meta month-first, Reel/Carousel, import ulang memperbarui tanpa menghapus WTR/action yang diisi manual. Instagram: 14 hari → 2 minggu Senin dengan jumlah benar, import ulang minggu yang sama mengganti bukan menambah, CSV mingguan. Free Class: duplikat digabung, nilai & jawaban terbuka di kolom yang benar, BOM.

### Check

- Uji fungsional import **45/45** (sebelum perbaikan: 10 gagal pada putaran pertama; setelah fixture dibenahi, 9 bug nyata + 1 kasus Excel yang kini ditolak dengan jelas).
- Unit baru `lib/imports/csv-text.test.mjs` (decode, pemisah, kutip, angka, tanggal) — unit total **145/145**.
- Regresi UI semua lolos (Putaran 26 39, 25 44, Marketing 47, Settings 12, Competitor 19, Job Vacancy 20, Products 17, Content Planning 26, Customer Knowledge 20, Partnership 23, CRM 24, Talent Pool 21, Program 21, Tickets 19, modul 12, popup 31, navigasi 32, search 46, form & tabel 946, Content Library, Design Assets 49).
- tsc bersih; lint 0 masalah; `npm run build` lolos.

### Catatan

- Tipe kolom tabel dump (buyers, content_evaluations, ig_snapshots, mt_vacancies, free_class_eval) di uji ini direkonstruksi dari migrasi + app lama, bukan dari database production. Kalau di production ada tipe yang beda, `npm run test:imports` bisa dijalankan ke salinan skema production (database terpisah bernama …test).
- Belum diuji fungsional: kirim email blast (Resend), AI parse/screenshot, upload R2, Google Calendar — semuanya butuh layanan luar.

## Putaran 28 — Pindah halaman terasa berat 2–3 detik (23 Okt 2026)

### Diukur di internal.ccclub.id (Chrome user, belum login)

| Yang diukur | Hasil |
|---|---|
| Redirect dari server (tanpa database) | median 130 ms |
| `/api/health` (`select 1` ke Postgres) | median 130 ms (sekali lonjakan 420 ms) |
| File JS statis yang sudah di cache Cloudflare | ~80 ms |
| File JS statis pertama kali setelah deploy (cache Cloudflare MISS) | 1,8–3,9 detik — server lambat menyajikan file statis saat banyak diminta bersamaan |

Kesimpulan awal: jaringan & database dasar sehat. Penyebab yang pasti dari kode: **tidak ada `loading.tsx`**, jadi setiap klik menu menunggu server menyiapkan seluruh halaman sambil layar diam di halaman lama — terasa "freeze". Halaman yang perlu login belum bisa diukur (Chrome yang tersambung belum login).

### Do

- `app/(dashboard)/loading.tsx`: kerangka halaman (judul, tab, kartu, efek shimmer; tanpa animasi bila *reduced motion*) muncul **seketika** saat menu diklik; Next juga mem-prefetch kerangka ini untuk link yang terlihat.
- Layout: dua putaran query berurutan (settings + task terlambat, lalu tiket terlambat) → satu putaran paralel.
- Content Evaluation: tidak lagi memuat **seluruh** tabel buyers (dengan riwayat pembelian) hanya untuk tab Story vs Buyer — kini hanya buyer bersumber Instagram Story (id, tanggal) + jumlah total.

### Check

- Build lolos; lint 0; Marketing 47/47.

## Putaran 29 — Evaluasi fungsional & UX semua modul (23 Okt 2026)

Laporan lengkap per modul: dokumen "Evaluasi Fungsional & UX per Modul — CCC Internal" (https://claude.ai/artifact/VrFQ6KQkpsKEGBxCBepdQB).

### Cara evaluasi

- Sapuan tombol: 459 tombol/tab di 21 modul diklik satu per satu (halaman baru tiap klik); tombol yang memanggil server diklik ulang dengan server dibuat gagal.
- Sapuan form: setiap pembuka Add/New/Create/Upload/Import — label simpan, simpan kosong, fokus isian wajib, ketik lalu Esc.
- Pindai statis: tombol tanpa nama, isian tanpa label, teks < 11 px, teks `undefined`/`NaN`.

### Temuan → perbaikan

| Temuan | Sebelum | Sesudah |
|---|---|---|
| Aksi crash saat server gagal (Meta Ads 7, Content Planning 3, Settings 2) | 12 | 0 |
| Aksi gagal diam-diam (Tickets 5, Program 1) | 6 | 0 |
| Perubahan langsung balik tanpa pesan (status tiket, centang task, geser kalender) | 3 | 0 — "The change was undone." |
| Popup menghapus ketikan saat Esc/klik luar/X | 14 | 0 — tanya "Discard your changes?" |
| Cancel konfirmasi ikut menutup form di bawahnya | ada | diperbaiki |
| Isian wajib tanpa tanda merah & fokus (Tickets, Program) | 2 modul | 0 |
| Label pembuka ≠ label simpan | 5 | 0 |

### Do

- `app/_components/safe-action.ts`: `guard`, `revertWith`, `submitTo` — satu cara menangani gagal simpan di semua modul (49 titik panggilan).
- `components/ui/dialog.tsx` + `use-modal.tsx`: penjaga ketikan belum disimpan; popup bertumpuk tidak saling menutup.
- Form React action → onSubmit (isian tidak hilang saat gagal): Products, RecordManager delete, Settings, Instagram baseline, Meta Ads sync.
- `app/(dashboard)/error.tsx`: error boundary per modul ("Try again", "Reload page").
- Link carousel kosong tidak lagi disimpan; Edit ticket menolak judul kosong.
- Teks 8 px → minimal 12 px; sisa teks Indonesia di palet perintah, record-focus, AI command, Google Calendar → Inggris; status CRM "Sedang di-…" tampil "Following up · …".

### Check

- Suite baru `ux.mjs` 22/22, ikut regresi penuh (`reg.sh`).
- Regresi penuh lolos: 18 suite modul (polish 39, lib 44, mkt 47, set 12, ci 19, jv 20, prod 17, cp 26, ck 20, partner 23, crm 24, talent 21, program 21, tickets 19, run 12, popup 31, navigasi 32), search 46, RecordManager 946, Design Assets 49, audit popup, unit 145, lint 0, build lolos.

### Sisa

- Prioritas: cek SQL baris Content Evaluation rusak oleh bug Post ID lama; ukur halaman setelah login.
- Nice-to-have: filter "Assigned to me" di Tickets; petunjuk drag Partnership ke "?"; avatar "?" di Content Planning; 3 tombol utama di panel detail Program jadi 1; warna header email blast.

## Putaran 30 — Panel "Add with AI" dan dropdown bergaya app (24 Okt 2026)

Masukan user: panel "Add with AI" di All partners berantakan; dropdown masih tampilan bawaan browser.

### Do

- **Panel "Add with AI"** (`ai-text-record-parser.tsx` + CSS module baru), dipakai di B2B/Org Partnership, Tickets, Program tasks, Content Planning carousels:
  - Isi panel ber-padding, judul + satu baris petunjuk + chevron; tidak ada lagi kotak outline hitam saat diklik.
  - Form hanya muncul setelah AI membaca teks (isian minimum dulu); isian panjang (Scope, Notes) di baris bawah, lebar penuh.
  - Isian wajib bertanda merah, kosong → ditandai dan difokuskan; simpan lewat onSubmit, isian tidak hilang saat gagal; pesan sukses/gagal lewat notifikasi.
  - Label: pembuka "Add with AI" di semua halaman; simpan "Add partner/ticket/task/carousel plan/organization" (sama dengan tombol Add utama); label Tickets yang masih Indonesia ("Input dengan AI", "Judul", "Deskripsi", "Prioritas") → Inggris.
- **Dropdown bergaya app untuk semua `<select>`** (`select-menu.tsx`, dipasang sekali di root layout):
  - `<select>` aslinya tetap ada (style, name, required, validasi, onChange, FormData aman di 107 tempat); hanya daftar pilihan bawaan browser diganti menu satu gaya: sudut bulat, sorotan biru muda, centang di pilihan aktif.
  - Daftar ≥ 8 pilihan: ketik untuk mencari (mis. daftar 108 partner di Deals); "No matches" bila kosong.
  - Keyboard: Space/Enter/panah membuka, panah/Home/End/PageUp/PageDown, Enter memilih, Esc menutup.
  - Di dalam popup: Esc / klik luar hanya menutup daftar, bukan popupnya; scroll mouse jalan meski halaman dikunci popup.
  - HP (layar sentuh) tetap pakai picker bawaan — itu kontrol yang lebih enak di HP. Opt-out: `data-native-select`.
- **Dropdown Radix** (Tickets, Program, kalender, assignee): disamakan dengan menu di atas, muncul di bawah field (tidak lagi menutupi field), lebar penuh seperti input lain, tanpa border hitam.

### Check

- Suite baru `selmenu.mjs` 32/32 (mouse, posisi, centang, klik luar, cari, Enter, wheel, keyboard, state React, nilai ikut tersimpan di form, di popup Radix & modal custom, HP tetap native); ikut regresi penuh.
- Regresi penuh lolos: semua suite modul (termasuk ux 22, selmenu 32), navigasi 32, search 46, RecordManager 946, Design Assets 49, audit popup, unit 145, lint 0, build lolos.

## Putaran 31 — Job Vacancy MT dibangun ulang dari workbook "CCC List MT" (24 Okt 2026)

Permintaan user: modul Job Vacancy lama dihapus total dan diganti; basis datanya Excel "CCC List MT" (14 sheet); tampilannya mengikuti dashboard HTML user ("Prospek MT") tapi dengan gaya app. Keputusan user: data di-update dengan upload ulang Excel **dan** bisa diedit di app; belum perlu tracking approach; tabel lama dihapus permanen.

### Data

- Migrasi `025_mt_prospects.sql`: **drop** `mt_vacancies` dan `mt_industries` (permanen, keputusan user); tabel baru `mt_prospects` (perusahaan + riwayat buka per tahun + prediksi), `mt_prospect_contacts`, `mt_prospect_research` (syarat, update tanggal/status, tahapan seleksi), `mt_prospect_imports` (riwayat upload). Grant ke `ccc_ops_app` eksplisit. Diuji dua kali di Postgres lokal (aman diulang).
- Baris dari Excel bertanda `source = import` + `import_key` (nama PT | brand | urutan); yang ditambah di app `source = manual` dan tidak pernah disentuh upload.

### Import Excel (`/api/mt-prospects/import`, `lib/mt-prospects/parse.ts`)

- Sheet & kolom dicari dari nama, bukan posisi → kolom tahun baru (2027) ikut terbaca. Sheet arsip & ringkasan (rumus) tidak dibaca karena sudah tergabung di "Syarat Gabungan".
- Bulan: rentang ("Agustus–November"), daftar, lintas tahun ("Desember–Februari").
- Pencocokan kontak/riset ke perusahaan: pasangan nama PT+brand → brand → nama PT → tanpa "PT/Tbk/aksen" → isi kurung (hanya bila menunjuk satu perusahaan); kontak mengikuti "Status MT" bila perusahaan muncul di dua sheet (mis. KB Bank aktif & lama).
- Dua langkah: **cek dulu** (berapa baru/diperbarui/dihapus, kontak, riset, baris tak cocok, nama ganda dengan data app) → **Import Excel**. Satu transaksi; gagal = tidak ada yang berubah.
- File asli user: 392 perusahaan (270 aktif, 85 prediksi, 33 lama, 4 dikeluarkan), 2.428 kontak (semua cocok), 1.471 baris riset; 1 baris tak cocok + 20 baris catatan tanpa brand dilaporkan. ±3 detik. Upload ulang = 392 diperbarui, tanpa duplikat.

### Tampilan (`mt-prospects-workspace/detail/forms.tsx`)

- Tab: **Overview** (angka, grafik per bulan dgn tahun sebelumnya, perkiraan 2 bulan ke depan, per industri → klik ke daftar), **Companies** (cari, filter status & industri, A–Z tanpa peduli huruf besar), **Calendar** (12 bulan: terjadwal vs biasanya buka), **HR contacts** (cari, link LinkedIn/email). Sub-menu sidebar sama.
- Detail perusahaan: prediksi, program, riwayat buka per tahun, kontak HR (tambah/ubah/hapus), update tanggal & status, syarat & tahapan (tahapan jadi langkah, "TIDAK KETEMU" → "Not found"), catatan. Riset dimuat saat dibuka.
- Form perusahaan & kontak: isian wajib merah + fokus; detail lanjutan (bulan buka per tahun, prediksi, catatan) dilipat. Data dari Excel diberi tahu: "upload berikutnya mengganti editan".
- Pencarian global: perusahaan & kontak HR (hasil kontak membuka perusahaannya).
- Dihapus: komponen/aksi/API/view lama Job Vacancy (daftar lowongan, newsletter, master industri, company intel lama).

### Check

- Unit 10 (parse/view) + search 11 lulus; tes import fungsional: 17 tes baru Job Vacancy (pratinjau, simpan, upload ulang, file salah) — total 55/55.
- UI `mt.mjs` 62/62 (semua tab, filter, detail, kontak, form wajib, import pratinjau→terapkan, kosong, HP tanpa geser samping); sapuan klik 25 tombol: 0 tanpa efek, 0 error, 0 gagal diam-diam.
- Review terpisah (agen lain, tanpa konteks kerja) → diperbaiki:
  - Perusahaan yang hilang dari file tapi punya kontak yang ditambah di app **tidak dihapus**; jadi perusahaan app beserta kontaknya (pratinjau menyebut jumlahnya).
  - Pratinjau import selalu milik file terakhir yang dipilih (balasan lama diabaikan).
  - Sel Excel ber-hyperlink ("Profile") menyimpan URL-nya.
  - Prediksi bisa dikosongkan.
  - Batang industri (tahun mana pun, termasuk "Other") membuka daftar dengan jumlah yang sama; badge angka di tab dihapus karena daftar dibuka terfilter.
  - Tambah perusahaan = satu query.
  - Body upload rusak → 400, bukan 500.
- Tes setelah perbaikan: import 58/58 (+ kontak app selamat, hyperlink), UI `mt.mjs` 65/65, unit 151, lint 0, build lolos. Regresi penuh: semua suite modul, navigasi 32, search 46, RecordManager 946, Design Assets 49, audit popup.
- **Temuan samping:** `select-menu.tsx` (Putaran 30) ternyata punya 2 error lint yang lolos karena script regresi hanya membaca baris terakhir output lint (kosong saat ada error). Diperbaiki (ref tidak ditulis saat render; posisi menu dihitung saat dibuka) dan script regresi kini mencetak jumlah error lint.

### Deploy

- Ada migrasi → `git pull origin refactor` lalu **`npm run vps:rebuild`** (bukan `:frontend`). Migrasi 025 menghapus `mt_vacancies` & `mt_industries` permanen (keputusan user). Setelah deploy, buka Job Vacancy MT → **Import Excel** → pilih file "CCC List MT".

## Putaran 32 — Urutan nama, tanggal dd/mm/yyyy, teks ≥ 12 px, rupiah, cek Post ID (24 Okt 2026)

Lima prioritas dari usulan sebelumnya, semuanya dikerjakan.

### Do

1. **Urutan A–Z tidak peduli huruf besar/kecil** (dropdown partner sebelumnya: AIA, ARISTA, ASIATOP, ASTRO, baru Adidas).
   - Penyebab: database mengurutkan `order by name` per kode huruf (collation), dan beberapa daftar pilihan memakai `.sort()` polos.
   - `lib/db/query.ts`: kolom nama (`name`, `nama`, `label`, `kategori`, `judul`, `title`) diurutkan `lower(...)`; dua query mentah (`tkt_types`, `master_produk`) juga.
   - `lib/text/sort.ts` `compareText` (Intl.Collator: tanpa beda huruf besar/aksen, angka sebagai angka) dipakai di 14 daftar pilihan.
2. **Satu tanggal untuk semua: dd/mm/yyyy + kalender bergaya app** (`app/_components/date-input.tsx`).
   - `<input type="date">` asli tetap ada (name, required, min/max, onChange, FormData aman); teks bawaan browser (mm/dd atau dd/mm tergantung laptop) ditutup label dd/mm/yyyy.
   - Mouse/trackpad: klik → kalender (Senin di depan, hari ini bercincin, Today/Clear; Clear tidak muncul di isian wajib). Keyboard: Enter/Space/↓ membuka, panah pindah hari/minggu, PageUp/PageDown bulan (+Shift = tahun), ketik angka langsung "24102026". Di popup: Esc/klik luar hanya menutup kalender.
   - HP tetap picker bawaan, tapi tampilannya tetap dd/mm/yyyy.
   - Dipasang di 21 tempat + RecordManager + parser AI; tanggal di tabel RecordManager juga tampil dd/mm/yyyy.
3. **Teks minimal 12 px**: 276 ukuran 8–11,5 px dinaikkan (CSS module, Tailwind `text-[10px]` → `text-xs`, style inline). Dicek sebelum/sesudah di Products, Dashboard, Content Library, CRM, Settings, Customer Knowledge: tidak ada yang pecah. Satu sisa sengaja: footer template email (bukan layar app).
4. **Rupiah** (`app/_components/money-input.tsx`): diketik dan tampil "Rp 25.000.000", yang tersimpan tetap angka. Tipe field baru `money` di katalog untuk 10 field (harga produk & sub-produk, target deal CRM, harga min/max produk kompetitor, nilai deal B2B/Org); juga form harga di Products dan nilai deal di kartu Deals. Tabel RecordManager menampilkan rupiah; harga kompetitor memakai format yang sama. Simpan saat keluar field hanya kalau nilainya berubah.
5. **Cek Post ID Content Evaluation**: `database/checks/content-evaluation-post-ids.sql` (bukan migrasi, dijalankan manual).
   - Temuan saat menyiapkan: ID yang sudah dibulatkan **tidak bisa** dikenali dari bentuknya — ±43% ID asli juga lolos uji "hasil pembulatan float". Jadi query memakai permalink (url): import ulang CSV Meta → post dengan dua baris ber-url sama = ID lama dibulatkan.
   - Langkah: 1 hitung baris lama ber-ID panjang + daftar url ganda (baca saja); 2 backup; 3 import ulang CSV di app; 4 (dalam transaksi) isian manual (topik, hook, CTA, win, improve, action, WTR, thumbnail) dipindah ke baris baru bila kosong, baris lama dihapus.
   - Diuji di Postgres lokal: post yang tertimpa mendapat isiannya kembali, isian yang sudah ada tidak ditimpa, ID yang benar tidak tersentuh, url ganda habis.

### Check

- Suite baru `dm.mjs` 22/22 (kalender di popup Radix, posisi, Esc/klik luar, pilih/ketik/panah/Today/Clear, field yang simpan saat berubah, rupiah ketik & simpan digit, HP native + dd/mm/yyyy, isian wajib tanpa Clear); unit `compareText`.
- Regresi penuh lolos: semua suite modul (termasuk dm 22, mt 65, selmenu 32), navigasi 32, search 46, RecordManager 946, Design Assets 49, audit popup, unit 152, lint 0 error, build lolos.
  - Dua harness disesuaikan karena perubahan sengaja: harga kompetitor kini "Rp 750.000" (bukan "Rp750K"), dan salinan aturan simpan di harness RecordManager kini mengenal tipe `money`.

### Untuk user

- UI saja → `npm run vps:rebuild:frontend`. Kalau migrasi Putaran 31 belum dijalankan, pakai `npm run vps:rebuild`.
- Cek Post ID: jalankan `database/checks/content-evaluation-post-ids.sql` langkah demi langkah (isi tanggal deploy Putaran 27 di baris `\set fixed_at`).

## Putaran 33 — Pipeline untuk 100+ partner, grafik Instagram yang jujur (24 Okt 2026)

Masukan user (screenshot produksi): pipeline B2B harus di-scroll sampai bawah karena 100 partner di satu kolom; grafik Instagram tidak rapi dan informasinya tidak rapi. Jenis evaluasinya: **uji volume data asli** (*stress test with real data*: tampilan yang enak dengan 6 data contoh pecah di 108) dan **review visualisasi data** (*dataviz audit*: jujur, konsisten, buang yang tidak menambah informasi).

### Do

- **Pipeline (B2B & Org Partnership)**:
  - Kolom punya tinggi maksimal dan scroll sendiri, judul kolom tetap terlihat; "Add partner" di kaki kolom terlihat tanpa scroll halaman.
  - Kartu ringkas: nama + Strategic, avatar PIC / "No PIC", dan hanya info yang beda antar kartu (jumlah deal · kontak terakhir). Kategori dan "no outreach yet" tidak diulang di tiap kartu (kategori tetap ada saat disorot).
  - Kotak "Find a partner…" menyaring semua kolom sekaligus (hitungan kolom jadi "ditemukan/total", kolom kosong bilang "No match").
  - HP: petunjuk "Open a card to change its stage" (drag tidak jalan di layar sentuh).
- **Grafik Instagram** (`charts.tsx`, `instagram-tools.tsx`):
  - Followers: dari batang yang sumbunya mulai 5.000 (pertumbuhan terlihat berlebihan) → garis dari 0; proyeksi putus-putus menyambung dari bulan terakhir; target abu-abu dengan angkanya di legend.
  - "Follows per day": judul dan isi kini cocok (rata-rata harian per minggu), punya sumbu dan tooltip.
  - Reach dan Interactions dipisah jadi dua grafik — satu sumbu per grafik; interactions sebelumnya nyaris tak terlihat di skala reach.
  - Satu format waktu: bulan "Feb ’26", minggu "7 Sep"; label tidak miring.
  - Kartu grafik 2×2 dengan tinggi sama; legend seragam (garis solid/putus-putus); warna dari token app, teks pakai warna teks, grid samar, ujung batang membulat 4 px; satu kolom di layar < 900 px.

### Check

- Suite baru `viz.mjs` 19/19 (108 partner: halaman tetap pendek, kolom scroll sendiri, cari menyaring semua kolom, petunjuk HP; empat grafik di kartu masing-masing, reach & interactions tidak satu sumbu, tinggi kartu sama, legend). Suite `partner` & `mkt` disesuaikan (kartu "1 deal · 8 Oct"; nama region unik).
- Regresi penuh lolos: semua suite modul (termasuk viz 19), navigasi 32, search 46, RecordManager 946, Design Assets 49, audit popup, unit 152, lint 0 error, build lolos. Deploy: `npm run vps:rebuild:frontend`.

## Putaran 34 — Uji volume, satu kosakata, sisa nice-to-have, aksesibilitas (24 Okt 2026)

Permintaan user: "gua mau lo kerjain semuanya" — semua daftar evaluasi: uji volume semua modul, review grafik sisa, konsistensi uang/tanggal/istilah + kamus, sisa nice-to-have, aksesibilitas & state kosong/loading/error.

### Do

- **Uji volume** (`?vol=1` di harness: 3.000 buyer, 600 tiket, 2.000 talent, 400 konten, 600 outreach, dst.):
  - `ShowMoreList` (ui-kit): daftar panjang tampil per batch dengan "Show N more · M left" — Outreach (10 hari), Meta Ads (6 per kolom), Content Library (24), Design Assets (12 grup), Resources (8 grup), Collaborators (24), task Program (12).
  - Outreach log: kotak "Search outreach" + filter Response; petunjuk panjang pindah ke "?".
  - Tinggi halaman desktop setelah perbaikan: Outreach 3,1k px, Meta Ads 1,6k, Content Library 2,1k, Design Assets 3,4k, Resources 2k, Program 3,4k (sebelumnya puluhan ribu px).
- **Grafik**: Content Evaluation pakai `SeriesBarChart` bersama (bulan "Feb ’26"); breakdown CRM satu gaya (donut) dengan label rapi (huruf besar semua → Title Case, singkatan FMCG/BUMN/HR dll. tetap).
- **Input waktu**: `TimeInput` 24 jam (HH:MM, popover jam/menit, Now/Clear) dan `DateTimeInput` (tanggal + jam) menggantikan input bawaan browser di Email blast "Send at", Talent Pool, Google Calendar, Program, RecordManager.
- **Satu kosakata** (`KAMUS_ISTILAH.md` baru):
  - Uang: `lib/text/money.ts` — baris/detail "Rp 2.500.000" (`formatRupiah`), ringkasan header "Rp 4.7M" / "Rp 750K" (`formatRupiahShort`). CRM, Products, Competitor pakai ini.
  - Tanggal: `lib/text/date.ts` `formatDay` → "22 Mar 2026"; Instagram ("As of", "latest week", tabel snapshot) dan detail Design Assets tidak lagi menampilkan ISO mentah.
  - Label: Create ticket → **Add ticket**; New/Create event → **Add event**; Export CRM JSON / Export data / Export KB → **Export JSON**; Download CSV → **Export CSV**; Add or edit … → **Manage …**; Upload CSV → **Import CSV or Excel**; judul import = tombolnya (**Import Meta CSV**); "Add to library" di tombol & judul dialog; tombol Google Calendar "Add to Google Calendar" / "Re-sync Google Calendar"; sisa teks Indonesia ("Menghubungkan…", "Sinkronkan Ulang") → Inggris.
- **Nice-to-have**:
  - Tickets: tombol **Assigned to me** (pakai `isAssignedTo` di `lib/tickets/visibility.ts`; hanya muncul kalau akun tertaut ke orang tiket; hak lihat tiket tidak berubah).
  - Petunjuk panjang → "?" (`HelpTip`): import & baseline Instagram, link Google Sheet Talent Pool, Settings sidebar, Users. Subjudul Rundown dipendekkan.
  - Program: panel detail tinggal satu tombol utama (Add task); "Add rundown item" jadi tombol sekunder di panel itu (tetap utama di halaman Event rundown).
  - Avatar "?" (Content Planning, Tickets, Dashboard, Competitor) → ikon orang/toko, supaya "?" hanya berarti bantuan.
  - Checkbox/radio satu gaya (biru brand, centang putih) dan tombol file picker gaya ghost — sekali di `globals.css`; switch tetap.
  - Warna header email blast default #2e2a7a → biru brand #1554c0.
- **Aksesibilitas & state**:
  - Ring fokus keyboard satu warna (biru brand) untuk tombol/link/tab, termasuk tombol Close dialog (sebelumnya hitam/abu).
  - Input jam/tanggal Program punya label (Event time, Start/Finish date & time).
  - Kontras token dicek: teks 16,4; muted 5,5 (4,8 di latar abu); biru 6,9; merah 5,3; hint 4,6 — semua lolos.
  - Mode data kosong (`?empty=1`) untuk 19 modul: tidak ada crash, NaN, atau "Invalid Date"; semuanya punya pesan kosong. Perbaikan: pipeline kosong bilang "No partners yet…" (bukan petunjuk drag), tombol "Email 0 candidates" nonaktif, grafik bulan Customer Knowledge kosong → "No data yet.", teks "Click New event"/"+ New program" → Add event.
  - Loading (`app/(dashboard)/loading.tsx`) dan error boundary (`error.tsx`) sudah ada sejak Putaran 29; aksi gagal tetap lewat `notifyError`.

### Check

- Suite baru: `p34.mjs` 49 (Show more, cari outreach, input 24 jam, label/tanggal/rupiah di 12 halaman, HP), `a11y.mjs` 11 (ring fokus, checkbox, kontras), `empty.mjs` 57 (19 modul tanpa data). Suite `tickets` +3 (Assigned to me). Unit baru: `lib/text/money.test.mjs`, `isAssignedTo`.
- Suite lama disesuaikan ke label baru (dm, ux, tickets, crm, mkt, Design Assets).
- Regresi penuh lolos: 23 suite modul (polish 39, lib 44, mkt 47, set 12, ci 19, mt 65, prod 17, cp 26, ck 20, partner 23, crm 24, talent 21, program 21, tickets 23, run 12, popup 31, ux 22, selmenu 32, dm 22, viz 19, p34 49, a11y 11, empty 57), navigasi 32, search 46, RecordManager 946, Design Assets 49, audit popup, unit 155, import 58, lint 0 error, build lolos. Deploy: `npm run vps:rebuild:frontend` (tanpa migrasi).

### Butuh user

- Ukur kecepatan halaman setelah login di produksi (harness tidak bisa login; gua tidak memasukkan password).
- Jalankan `database/checks/content-evaluation-post-ids.sql` langkah 1 di VPS dan kirim hasilnya.
- Mode gelap: belum dikerjakan — perlu keputusan (masih ada warna tetap `#fff` di beberapa modul yang harus jadi token dulu).

## Putaran 35 — Halaman lebih ringan: kirim yang ditampilkan saja (24 Okt 2026)

Diukur di produksi (akun user yang sudah login, lewat Chrome): pindah modul ±1 detik; server menjawab dalam 0,2–0,4 detik untuk semua modul, browser tidak nge-freeze (blocking 0, JS ±30 ms). Bedanya ada di **ukuran data yang dikirim** ke browser. Temuan sampingan: produksi masih di build **23 Okt 14:39 UTC (Putaran 27, commit e39c90b)** — Putaran 28–34 belum di-deploy.

### Do

- `lib/records/lean.ts` (`leanRow`/`leanRows`): baris yang dikirim ke daftar tanpa isian kosong (null) dan tanpa kolom yang tidak ditampilkan. null dan "tidak ada" diperlakukan sama di semua komponen (dicek).
- **Content Evaluation**: daftar tanpa caption, account, Post ID, thumbnail, timestamp (`listContentEvaluationsForPage`). Editor memuat baris lengkap lewat `loadContentEvaluationAction` sebelum form tampil ("Loading the evaluation…"), jadi simpan tidak mengosongkan kolom itu.
- **Kalender Dashboard & Program**: satu aturan `isCalendarTicket` (`lib/tickets/calendar.ts`) — tiket terbuka, ada deadline, tidak dicerminkan task Program — dipakai server (hanya kirim itu) dan kalender. Task di Dashboard hanya yang ada deadline.
- **Tickets, Talent Pool**: tanpa null dan timestamp. **CRM**: tanpa null dan `updated_at` (`created_at` tetap — dipakai mengurutkan riwayat buyer). Catatan: Export JSON di Talent Pool/CRM ikut tanpa kolom kosong dan timestamp itu.
- `database/checks/content-evaluation-post-ids.sql`: `fixed_at` = waktu build produksi Putaran 27 (`2026-10-23 14:39+00`).

### Hasil (data produksi, aturan yang sama diterapkan ke payload asli)

| Halaman | Sekarang di produksi | Setelah deploy |
|---|---|---|
| Content Evaluation | 1.692 KB | 429 KB |
| Dashboard | 347 KB | 118 KB |
| Program | 351 KB | 163 KB |
| Tickets | 205 KB | 164 KB |
| Talent Pool | 761 KB | 690 KB |
| CRM | 574 KB | 538 KB |

Talent Pool dan CRM memang isinya data (763 kandidat, 872 buyer + riwayat); turun lebih jauh butuh paging di server — nice-to-have kalau datanya terus tumbuh.

### Check

- Unit baru: `lib/records/lean.test.mjs`, `lib/tickets/calendar.test.mjs`. Suite `mkt` +2 (editor memuat baris lengkap; caption & Post ID terisi dari baris lengkap).
- Regresi penuh lolos: 23 suite modul (mkt 49, sisanya sama dengan Putaran 34), navigasi 32, search 46, RecordManager 946, Design Assets 49, audit popup, unit 157, import 58, lint 0 error, build lolos. Deploy: `npm run vps:rebuild:frontend` (tanpa migrasi) — sekaligus membawa Putaran 28–34.

## Putaran 36 — Layout ikut zoom (fluid), kepadatan 100% dikurangi, label "late" (24 Okt 2026)

Masukan user (screenshot produksi di zoom 50%): isi Dashboard jadi kolom sempit di tengah; di 100% terasa "terlalu dekat". Namanya: **fluid layout** (isi mengikuti lebar jendela) dan **UI density / scale** (kepadatan). Bonus temuan: "9186 days late" (deadline TKT-226 kemungkinan salah ketik tahun).

### Do

- **Fluid layout**: 15 pembungkus halaman yang dikunci 1.180–1.360 px → satu token `--page-max: none` (`globals.css`). Zoom out = kartu, kalender, tabel melebar.
- **Kepadatan**: satu aturan untuk semua 27 stylesheet (skrip, bukan per modul): font ≥ 14 px ×0,9 (12–13 px tetap, minimal 12); padding/margin/gap ≥ 10 px ×0,85; min-height tombol/input ×0,9 (minimal 32 px). Border, breakpoint, lebar tidak disentuh. CSS `zoom: 0.9` dicoba dan ditolak: tinggi shell jadi 90%, menu dropdown tidak terbuka, hover Chart.js meleset.
- **Label telat**: satu fungsi `lateLabel` — "3d late", "4mo late", "1y+ late" (Dashboard sebelumnya "3 days late", Tickets "3d late"). `daysBetween` dipakai bersama.
- `KAMUS_ISTILAH.md`: format telat, aturan lebar & kepadatan.

### Check

- Screenshot sebelum/sesudah di ukuran layar user (1280×720 = 100%, 2560×1440 = 50%, laptop DPR 1,5): Dashboard, Tickets, CRM, Content Evaluation, B2B, Program — tidak ada yang pecah.
- Unit +1 (`lateLabel`). Regresi penuh lolos: 23 suite modul, navigasi 32, search 46, RecordManager 946, Design Assets 49, audit popup, unit 158, lint 0 error, build lolos. Deploy: `npm run vps:rebuild:frontend`.

## Putaran 37 — Mode gelap di semua modul (24 Okt 2026)

Keputusan user: mode gelap boleh; **default Light**, tidak ada opsi "System" (tidak ikut setting komputer).

### Do

- **Tombol**: satu toggle bulan/matahari di top bar, kiri lonceng ("Switch to dark mode" / "Switch to light mode"). Pilihan disimpan per browser; script kecil di `<head>` memasang tema sebelum halaman tergambar (tidak berkedip). `lib/theme/theme.ts` (`themeFrom`, `THEME_BOOT_SCRIPT`), `app/_components/theme-switch.tsx`.
- **Token gelap** (`globals.css`, `:root[data-theme="dark"]`): token yang sama diberi nilai gelap. Biru lebih terang (#5b95f8) supaya terbaca sebagai teks; teks di atas isian biru/merah lewat token baru `--on-accent` (putih di terang, gelap di gelap). Panel besar berwarna pakai `--hero` / `--hero-deep` / `--on-hero` (biru tua di gelap, tidak menyilaukan). Tailwind `dark:` mengikuti `data-theme`.
- **Warna tertulis langsung → token** di 24 stylesheet dan komponen: latar `#fff`, badge hijau/kuning/biru/oranye (→ `--green`/`--amber`/`--blue`/`--coral` + `-bg`), fokus ungu lama, halaman sign-in & offline, `bg-white`/`text-white`. Teks putih di atas foto/overlay hitam tetap putih.
- **Grafik** membaca ulang warna saat tema berganti (tanpa reload); grafik bulanan lama ikut token dan font 12 px.
- Sengaja tetap terang: preview & template email (harus sama dengan email yang diterima).
- Sekalian: badge rating 7 px → 12 px.

### Check

- Suite baru `dark.mjs` 63: toggle (default light, tersimpan, kembali ke light), komputer mode gelap tidak mengubah app, kontras 16 pasangan token gelap (semua ≥ 4,5; hint ≥ 3), 20 halaman tanpa kotak terang tersisa & tanpa error. Unit baru `lib/theme/theme.test.mjs`. Dicek manual: dialog, kalender tanggal, dropdown.
- Regresi penuh lolos: 24 suite modul (termasuk dark 63), navigasi 32, search 46, RecordManager 946, Design Assets 49, audit popup, unit 159, lint 0 error, build lolos. Deploy: `npm run vps:rebuild:frontend`.

## Putaran 38 — Access: Allowed / Blocked yang benar-benar menutup akses (24 Okt 2026)

Pertanyaan user: apa dampak uncheck "Active" di Users & roles? Jawaban: login ditolak dan notifikasi push berhenti, **tapi** orang yang sedang login tidak ikut keluar (sesi disimpan di cookie bertanda tangan, berlaku ±30 hari dan diperpanjang tiap dipakai), dan ganti role baru berlaku setelah login ulang. Keputusan user: orang yang dinonaktifkan tidak boleh bisa masuk.

### Do

- `auth.ts` + `lib/auth/access.ts`: tiap kali sesi dipakai, status dan role dibaca ulang dari `auth_users` (cache 60 detik per user). Blocked atau akun dihapus → sesi berakhir; role baru berlaku tanpa login ulang. Admin bootstrap dari env tidak disentuh. Database tidak terjangkau → sesi dipertahankan (halaman tetap gagal sendiri), dicek lagi di permintaan berikutnya.
- Settings → Users & roles: checkbox "Active" (sempat dibaca terbalik) → pilihan **Access: "Allowed — can sign in" / "Blocked — cannot sign in"**, chip merah "Blocked" di kartu, penjelasan di "?". Simpan lewat Settings membuang cache orang itu → berlaku seketika di server ini.
- Admin tidak bisa mem-Blocked akunnya sendiri (supaya tidak terkunci).
- Label: "Create user" → **Add user** (sama dengan tombol pembukanya).

### Check

- Uji ujung-ke-ujung pada build produksi lokal + Postgres (akun tes buatan sendiri, dihapus sesudahnya): login → role diubah → ≤62 detik sesi ikut role baru; Blocked → ≤62 detik sesi `null`, `/dashboard` dialihkan ke sign-in, login ulang ditolak.
- Unit baru `lib/auth/access.test.mjs` (Blocked/dihapus kehilangan akses, cache 60 detik, `forget()` seketika). Suite `set` +5 (Access per user, chip Blocked, tanpa checkbox Active, Add user).
- Regresi penuh lolos: 24 suite modul (set 17), navigasi 32, search 46, RecordManager 946, Design Assets 49, audit popup, unit 161, lint 0 error, build lolos. Deploy: `npm run vps:rebuild:frontend` (tanpa migrasi).

## Putaran 39 — Search yang lebih pintar (tanpa AI) dan tampilan hasil yang baru (24 Okt 2026)

Masukan user (screenshot produksi): "password" di search tidak menemukan apa-apa. Penyebab: search hanya mencocokkan huruf persis; isi password memang sengaja tidak dicari, dan login di Resources tersimpan sebagai tipe `credential`, jadi kata yang dipakai orang ("password", "login", "akun") tidak pernah cocok. Keputusan user: opsi A (tanpa AI) dulu, plus tampilan hasil search diperbaiki.

### Do

- **Sinonim dua bahasa** (`lib/search/synonyms.ts`, satu daftar): password/login/akun → credential, tiket → ticket, loker → vacancy, pembeli → buyer, dst. Kata yang diketik boleh cocok di mana saja; sinonim hanya di awal kata (supaya "wa" tidak kena "Jawa", "password" tidak kena "Passion"). Dipakai sama di server (`lib/search/query.ts`, SQL `ilike` + regex awal kata) dan di browser (halaman).
- **Tahan salah ketik**: kalau hasil persis < 3, pass kedua memakai `pg_trgm` (`word_similarity`) lalu dicek ulang di JS (1 salah ketik untuk 4–7 huruf, 2 untuk ≥ 8; kata < 4 huruf tidak pernah). Hasilnya ditandai **Close match** dan diurutkan paling bawah. Migrasi `026_search_pg_trgm.sql`; tanpa migrasi itu search tetap jalan (persis + sinonim).
- **Halaman & aksi**: "password" → **Resources › Logins** (`/resources?kind=credential`, filter Logins langsung aktif), "add ticket" → form Add ticket (juga saat Tickets sudah terbuka — sebelumnya link `?create=ticket` hanya bekerja saat halaman baru dibuka). Shortcut hanya muncul kalau modulnya terlihat.
- **Tampilan palette** (`command-palette.tsx`): lebih lebar (672 px), hasil dikelompokkan per modul dengan jumlahnya, ikon dalam kotak, kata yang cocok ditandai (termasuk sinonim yang cocok), chip **Login** (tanpa isi rahasia) dan **Close match**, tombol hapus isian, skeleton saat mencari, pesan kosong yang menyebut kata yang dicari, "Try again" saat gagal, footer bahasa Inggris (Move · Open · Close; sebelumnya "pilih/buka/halaman"). HP: menempel di atas dengan margin 8 px. Ikut mode gelap.
- Tes database baru `tests/search/` (`npm run test:search`, butuh `SEARCH_TEST_DATABASE_URL` database sekali pakai).
- Harness: regresi kini meng-compile CSS harness search (h2) juga — sebelumnya h2 memakai CSS lama.

### Check

- `tests/search` 10/10 terhadap PostgreSQL 16 sungguhan, dengan dan tanpa `pg_trgm` (password → login Email CCC & Canva tanpa isi password; "akun canva"; "canvaa"/"boklet" sebagai close match; isi password tidak bisa dicari; sinonim tidak menyangkut di tengah kata).
- Suite baru `p39.mjs` 23. Unit baru: `lib/search/synonyms.test.mjs`, `palette-index` +2. Suite search h2 disesuaikan (grup per modul, `<mark>`, teks Inggris) 46/46.
- Regresi penuh lolos: 25 suite modul (termasuk p39 23, dark 63), navigasi 32 (diperbarui ke kotak search baru), search 46, RecordManager 946, Design Assets 49, audit popup, unit 166, lint 0 error, build lolos.

### Deploy

Ada migrasi → `git pull origin refactor && npm run vps:rebuild` (bukan `:frontend`).

## Putaran 40 — "Ask AI" di search, level 1 (25 Okt 2026)

Usulan user: app sudah punya API AI (Anthropic, dipakai "Add with AI"), jadi pakai untuk search. Keputusan user: **level 1** — AI membantu mencari (memahami pertanyaan), tidak menjawab dari data. (Ganti nama Ticket → Task: dibatalkan user.)

### Do

- **Palette**: baris **"Ask AI: '…'"** muncul di paling atas untuk pertanyaan 3+ kata, atau kalau search biasa tidak menemukan apa-apa. Enter/klik → "Asking AI what to look for…" → grup **AI search** dengan "Searched for: canva · design · login" dan hasilnya (dibuka seperti hasil lain). Search biasa tetap instan dan tidak menunggu AI. AI gagal → pesan jelas, palette tetap jalan.
- **Yang dikirim ke AI**: hanya kalimat yang diketik + daftar nama modul & kolom (`lib/search/ai-plan.ts`). Isi data tidak pernah dikirim. AI mengembalikan kata kunci + modul; jawaban disaring (hanya modul yang dikenal, kata 2–40 huruf, maks. 8).
- **Pencarian dengan kata kunci AI** (`searchWithKeywords`, `lib/search/query.ts`): satu kata kunci (atau sinonimnya) cukup, lebih banyak kata = lebih atas, modul yang disebut AI didahulukan. Aturan lihat tiket per role tetap berlaku; password tetap tidak pernah ikut.
- **Route** `POST /api/search/ai`: wajib login; model terpisah `ANTHROPIC_SEARCH_MODEL` (default `claude-haiku-5-5`, kecil & cepat; "Add with AI" tetap memakai `ANTHROPIC_MODEL`), maks. 200 token, timeout 8 detik; pertanyaan yang sama dalam 10 menit memakai hasil tersimpan (tanpa panggilan AI); batas 20 panggilan AI per orang per menit. `requestAnthropicJson` mendapat opsi model/token/timeout (perilaku lama tidak berubah).
- `.env.example` & `DEPLOYMENT_VPS.md`: `ANTHROPIC_SEARCH_MODEL`.

### Check

- `tests/search` 19/19 (PostgreSQL sungguhan + Anthropic disimulasikan): kata kunci AI → Canva; tidak ada isi password; route mengirim hanya pertanyaan, tanpa data; model kecil; cache (tanpa panggilan kedua); AI mati → 502 dengan pesan jelas.
- Unit baru `lib/search/ai-plan.test.mjs` 3. Suite baru `p40.mjs` 14 (kapan Ask AI ditawarkan, hanya `{q}` dikirim, kata kunci tampil, hasil bisa dibuka, gagal → pesan, tidak ada "No results" di bawah hasil AI).
- Regresi penuh lolos: 26 suite modul (termasuk p40 14, p39 23, dark 63), navigasi 32, search 46, RecordManager 946, Design Assets 49, audit popup, unit 169, lint 0 error, build lolos.

### Deploy

Isi `ANTHROPIC_SEARCH_MODEL` di env VPS bila model default tidak tersedia di akun Anthropic. Kalau Putaran 39 belum di-deploy: `npm run vps:rebuild` (migrasi 026); kalau sudah: `npm run vps:rebuild:frontend`.

## Putaran 41 — Claude access: Claude bisa langsung memasukkan riset ke app (mulai dari Job Vacancy MT) (25 Okt 2026)

Permintaan user: Job Vacancy MT, Customer Knowledge, Instagram & Content Evaluation di-update langsung dari Claude (drop hasil riset / hasil crawling) tanpa import manual. Rencana yang disetujui: (1) "Claude API" di app dengan Preview → Apply, (2) Instagram sinkron otomatis, (3) nanti connector. Putaran ini: fondasi + **Job Vacancy MT**.

### Do

- **Settings → Claude access** (admin): **Add key** (nama + modul wajib, ditandai merah & fokus) → key `ccc_…` tampil **sekali** dengan **Copy key**; daftar key menampilkan awalan, modul, siapa/kapan dibuat, terakhir dipakai; **Revoke key** (konfirmasi) menghentikan seketika. Disimpan hanya hash SHA-256 (`agent_tokens`, migrasi `027_claude_access.sql`). Key hanya untuk modul yang dipilih, bisa menambah & mengubah, tidak bisa menghapus.
- **`/api/agent/mt-prospects`**: `GET` menjelaskan format ke Claude; `POST {mode: "preview" | "apply", companies}`. Boleh dengan key (`Authorization: Bearer`) atau sesi login (Claude in Chrome). Satu transaksi; rencana dihitung ulang di dalam transaksi.
- **Aturan gabung** (`lib/mt-prospects/agent.ts`, satu tempat untuk preview & apply): cocok nama seperti import Excel; perusahaan baru → perusahaan app (`added_via = 'claude'`, aman dari upload Excel); perusahaan lama → hanya kolom **kosong** diisi, nilai berbeda dilaporkan sebagai *conflict* dan tidak ditulis; tahun pembukaan, HR contact & catatan yang belum ada ditambah, duplikat dilewati; nama mirip → *possible duplicate*, dilewati sampai `match_id` / `as_new`. Tidak pernah menghapus.
- Catatan riset Claude = baris research `origin = 'Claude'` (tanggal, catatan, sumber, "Added by"); upload Excel kini **tidak** menghapusnya.
- **Job Vacancy MT**: ikon ✦ "Added by Claude" di daftar perusahaan & HR contact, chip **Added by Claude** di detail, bagian **Research notes from Claude** (tanggal, catatan, link sumber, nama key).
- Setiap apply tercatat di activity log dengan nama key ("Claude (Riset MT)").
- `docs/claude-access.md`: cara pakai untuk Claude di chat mana pun.

### Check

- `tests/agent` 19 (PostgreSQL sungguhan, migrasi 025 + 027): hanya hash disimpan; tanpa key/sesi → 401; key modul lain → 401; GET panduan; preview tidak mengubah apa-apa; apply mengisi yang kosong saja, 2025 tetap & 2026 ditambah, perusahaan baru bertanda Claude, duplikat tidak masuk, catatan bertanda nama key, apply ulang tidak menggandakan, upload Excel berikutnya mempertahankan catatan & perusahaan Claude, sesi browser boleh, key dicabut langsung berhenti, terakhir dipakai tercatat, activity log.
- Unit baru: `lib/agent/token-format.test.mjs` 2, `lib/mt-prospects/agent.test.mjs` 4. Suite baru `p41.mjs` 19 (Settings → Claude access, key sekali tampil, wajib isi, revoke dengan konfirmasi, HP; tanda Claude di Job Vacancy MT).
- Regresi kini juga menjalankan tes database: import, search, Claude access.
- Regresi penuh lolos: 27 suite modul (termasuk p41 19), navigasi 33 (+ non-admin tidak melihat Claude access), search 46, RecordManager 946, Design Assets 49, audit popup, unit 175, import 58, search-db 19, agent-db 19, lint 0 error, build lolos.

### Deploy

Migrasi baru → `git pull origin refactor && npm run vps:rebuild`. Lalu Settings → Claude access → Add key (Job Vacancy MT) dan kirim key ke Claude di chat.
