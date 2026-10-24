# Kamus istilah — internal.ccclub.id

UI pakai bahasa Inggris (keputusan user). Kamus ini aturan bakunya: satu hal satu kata, satu aksi satu label.
Cek ulang tiap putaran dengan `labels.mjs` (harvest label) sebelum rilis.

## Label tombol

| Aksi | Pakai | Jangan pakai |
|---|---|---|
| Bikin item baru | **Add {object}** — "Add ticket", "Add event", "Add company" | Create …, New …, Tambah … |
| Simpan perubahan | **Save {object}** — "Save event", "Save link" | Save, Submit, Update, Simpan |
| Buka form ubah | **Edit {object}** — "Edit company" | Edit (tanpa objek) |
| Hapus permanen dari database | **Delete {object}** (selalu konfirmasi) | Delete (tanpa objek), Hapus |
| Lepas dari daftar, datanya tetap ada | **Remove {object}** / "Remove from …" | Delete |
| Buka tab kelola data | **Manage {object}** — "Manage people" | Add or edit …, Edit data |
| Ambil file dari luar | **Import {sumber}** — "Import Meta CSV", "Import Excel", "Import CSV or Excel" | Upload CSV, Upload data |
| Keluarkan data | **Export CSV** / **Export JSON** | Download CSV, Export data, Export KB, Export CRM JSON |
| Kosongkan filter | **Clear filters** | Reset, Clear all |
| Batal | **Cancel** | Close (untuk batal form), Batal |
| Lagi proses | "Saving…", "Adding…", "Connecting…" (pakai …) | "Menghubungkan...", "Authorizing..." |

Aturan tambahan:
- Tombol pembuka form = tombol simpannya. Contoh: "Add ticket" membuka dialog "Add ticket" dan disimpan dengan "Add ticket"; "Add to Google Calendar" → "Add to Google Calendar" (sesudah sinkron: "Re-sync Google Calendar").
- Judul dialog/panel import = label tombol pembukanya ("Import Meta CSV").
- Kirim aset ke Content Library: "Add to library" di tombol dan judul dialog.

## Uang (`lib/text/money.ts`)

| Tempat | Format | Fungsi |
|---|---|---|
| Baris tabel, detail, transaksi, input | **Rp 2.500.000** | `formatRupiah` (MoneyInput pakai yang sama) |
| Ringkasan header / angka besar | **Rp 4.7M**, **Rp 750K**, **Rp 2B** | `formatRupiahShort` |

Jangan pakai: "Rp100k", "Rp4.7M" (tanpa spasi), "Rp99K", `toLocaleString` sendiri-sendiri.

## Tanggal (`lib/text/date.ts`, `app/_components/date-input.tsx`)

| Tempat | Format |
|---|---|
| Kalimat / label ("As of …", detail) | **22 Mar 2026** — `formatDay` |
| Sel tabel dan input | **22/03/2026** (dd/mm/yyyy) — `DateInput`, `formatDayMonthYear` |
| Sumbu chart | "Feb ’26" (bulan), "7 Sep" (hari) |
| Jam | **24 jam, 14:30** — `TimeInput` / `DateTimeInput` |

Jangan tampilkan ISO mentah (2026-09-01) ke user.

## Istilah objek

| Pakai | Jangan pakai |
|---|---|
| Ticket | Task (untuk ticket), Tiket |
| Partner (Partnership) | Mitra, Client |
| Buyer (CRM) | Customer di header CRM |
| Company (Job Vacancy MT) | PT, Perusahaan, Vacancy |
| HR contact | PIC, Contact person |
| Event (Program) | Activity, Kegiatan |
| Content Library | Library konten, KB |
