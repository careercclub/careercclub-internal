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
