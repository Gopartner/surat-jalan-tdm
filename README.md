# SURAT JALAN TDM

Aplikasi web statis untuk mencatat **laporan operasional pengiriman material** dan **ritase kendaraan
proyek** (TDM). Dirancang untuk dipakai cepat di lapangan: buka dari HP Android atau desktop, isi
ritase, lihat rekap otomatis, lalu bagikan laporan sebagai teks WhatsApp atau PDF.

- **Tanpa framework, tanpa build step.** HTML5 + CSS3 + Vanilla JavaScript (ES Module).
- **Data master terpisah** di folder `data/*.json` — tidak ada daftar driver/material yang
  di-hardcode di komponen UI.
- **Hemat kuota** (± 55 KB kode aplikasi + 360 KB pustaka PDF opsional), jalan sepenuhnya di browser.
- **Penyimpanan lokal** memakai LocalStorage: draft tersimpan otomatis, laporan bisa disimpan,
  diedit, diexport, dan diimport.

**Website:** <https://yudibilly.github.io/surat-jalan-tdm/>

---

## Daftar isi

1. [Fitur](#fitur)
2. [Struktur folder](#struktur-folder)
3. [Menjalankan di lokal](#menjalankan-di-lokal)
4. [Cara memakai aplikasi](#cara-memakai-aplikasi)
5. [Mengedit data master](#mengedit-data-master)
6. [Menambah / menghapus driver](#menambah--menghapus-driver)
7. [Rumus perhitungan](#rumus-perhitungan)
8. [Penyimpanan: master vs laporan vs draft](#penyimpanan-master-vs-laporan-vs-draft)
9. [Export: TXT, PDF, JSON](#export-txt-pdf-json)
10. [Pengujian](#pengujian)
11. [Deployment GitHub Pages](#deployment-github-pages)
12. [Batasan yang diketahui](#batasan-yang-diketahui)

---

## Fitur

### Informasi laporan
- Jenis laporan dari `data/master_laporan_harian.json`, lengkap dengan opsi **Lainnya…** (input manual).
- Tanggal default hari ini, ditampilkan **DD-MM-YYYY**, bisa diketik atau dipilih dari kalender.
- Sumber material, tujuan, dan material dari JSON master, masing-masing punya opsi **Lainnya…**.
- Memilih jenis laporan akan menerapkan default sumber/tujuan/material milik jenis tersebut.

### Ritase driver
- Kartu driver responsif: nomor urut, nama, nomor polisi, ritase, tombol **−** / **+**.
- Ritase juga bisa diketik langsung (angka besar lebih cepat).
- Ritase tidak bisa negatif; tombol **−** otomatis nonaktif di angka 0.
- Tambah driver manual, hapus driver dari laporan, aktif/nonaktifkan, tandai **rental**.
- Grand total, jumlah armada, dan jumlah rental diperbarui seketika tanpa reload.

### Rekap otomatis
- Total Armada (driver aktif), Armada Rental, Total Ritase (semua driver), Grand Total (driver aktif).

### Rincian ukuran batu
- Tabel per driver × kategori ukuran (default: **Batu 0.5/1** dan **Batu 1-2**).
- Input angka besar, nyaman di HP.
- **Membedakan "belum diisi" dan nol**: kolom kosong tidak dijumlahkan dan ditandai `belum`.
- Subtotal per kategori + total rincian material, otomatis dibandingkan dengan Grand Total.

### Validasi
- Status **VALID**, **PERLU DILENGKAPI**, atau **TIDAK SESUAI** beserta daftar periksa:
  tanggal, sumber, tujuan, identitas driver, ritase negatif, kelengkapan rincian, dan selisih total.
- Export final diblokir (dengan konfirmasi) bila validasi belum lengkap, kecuali mode
  **laporan sementara** diaktifkan.

### Laporan & export
- **Preview real-time** format WhatsApp (emoji, pemisah, rincian per ukuran batu).
- **Download TXT** + **Copy Text** untuk dibagikan ke WhatsApp.
- **Download PDF A4** (jsPDF, header biru navy/oranye, tabel tidak terpotong, footer + nomor halaman).
- **Print** memakai `print.css` (A4, tabel berulang antar halaman, footer berjalan).
- **Simpan Laporan**, **Reset Form**, daftar laporan tersimpan (buka/hapus/download TXT).
- **Export/Import JSON** untuk backup atau pindah perangkat.

### UI/UX
- Biru navy + oranye, kontras tinggi, font sistem (tanpa webfont = cepat).
- Dua kolom di desktop (form + panel preview sticky), satu kolom di mobile.
- Bottom bar aksi cepat di mobile (Preview / PDF / TXT / Simpan).
- Indikator status simpan otomatis, toast, modal konfirmasi, empty state.
- Tanpa horizontal scroll (diuji pada 390 px, 768 px, dan 1500 px).

---

## Struktur folder

```text
surat-jalan-tdm/
├── index.html                     # satu-satunya halaman aplikasi
├── README.md
├── .gitignore
├── package.json                   # hanya untuk tooling/testing (tidak dipakai runtime)
│
├── assets/
│   ├── css/
│   │   ├── style.css              # tampilan layar
│   │   └── print.css              # layout A4 untuk print / Save as PDF
│   ├── js/
│   │   ├── app.js                 # orkestrator: state, event, render
│   │   ├── master-data.js         # pemuat JSON + model laporan
│   │   ├── driver.js              # kartu ritase driver (event delegation)
│   │   ├── material.js            # tabel rincian ukuran batu
│   │   ├── calculation.js         # rekap & subtotal (fungsi murni)
│   │   ├── validation.js          # aturan validasi + status
│   │   ├── report-text.js         # format teks WhatsApp
│   │   ├── export.js              # PDF, print, copy
│   │   ├── storage.js             # LocalStorage + import/export JSON
│   │   └── dom.js                 # util DOM kecil
│   ├── icons/
│   │   ├── favicon.svg
│   │   ├── apple-touch-icon.png
│   │   └── site.webmanifest
│   └── vendor/
│       └── jspdf.umd.min.js       # jsPDF 2.5.2 (di-vendor agar tidak bergantung CDN)
│
├── data/
│   ├── master_laporan_harian.json
│   ├── sumber_material.json
│   ├── master_tujuan.json
│   ├── master_material.json       # pilihan material + kategori ukuran batu
│   └── master_driver.json
│
├── docs/
│   └── JSON_SCHEMAS.md            # dokumentasi format setiap file JSON
│
├── tests/
│   ├── unit.test.mjs              # 19 unit test logika (node --test)
│   ├── selftest.js                # 44 pengujian end-to-end di browser
│   └── browser-smoke.mjs          # runner headless (Edge/Chrome)
│
└── .github/
    └── workflows/
        └── deploy.yml             # deploy otomatis ke GitHub Pages
```

---

## Menjalankan di lokal

Aplikasi memakai ES Module + `fetch()` untuk membaca JSON. Karena itu **jangan** membuka
`index.html` lewat `file://` (browser akan memblokir CORS). Gunakan server statis:

```bash
# Python 3 (paling praktis)
python -m http.server 8000

# lalu buka
http://localhost:8000/
```

Alternatif:

```bash
npx serve .
# atau
php -S localhost:8000
```

Tidak ada langkah install/build. File yang di-deploy adalah file apa adanya.

---

## Cara memakai aplikasi

1. **Pilih jenis laporan.** Default sumber/tujuan/material terisi otomatis. Ganti bila perlu,
   atau pilih **Lainnya…** lalu tulis manual.
2. **Periksa tanggal** (default hari ini). Klik ikon kalender untuk memilih tanggal lain.
3. **Isi ritase** tiap driver dengan tombol **+ / −** atau ketik angkanya.
   - Tab/Enter berpindah kolom; nilai akan dibulatkan ke bawah dan tidak bisa negatif.
   - Tandai driver **rental** lewat tombol `R`; nonaktifkan lewat tombol `◉`.
   - **+ Tambah Driver** untuk sopir/armada yang tidak ada di master (hanya untuk laporan ini).
4. **Lengkapi Rincian Ukuran Batu.** Kolom kosong = *belum diisi*, bukan nol.
5. **Cek Validasi.** Status harus **VALID** bila ingin export final.
6. **Simpan Laporan** (masuk daftar *Laporan Tersimpan*) atau biarkan autosave menyimpan draft.
7. **Bagikan:** *Copy Text* / *Download TXT* untuk WhatsApp, *Download PDF* untuk arsip/cetak.

Draft tersimpan otomatis ±0,5 detik setelah perubahan dan dipulihkan saat halaman dibuka kembali.

### Pintasan

| Aksi | Desktop | Mobile |
| --- | --- | --- |
| Buka panel preview | sudah tampil di kanan | tombol **Preview** di bar bawah |
| Simpan laporan | tombol **Simpan Laporan** | **Simpan** di bar bawah |
| Export PDF | **Download PDF** | **PDF** di bar bawah |

---

## Mengedit data master

Semua master ada di `data/`. Detail field ada di [`docs/JSON_SCHEMAS.md`](docs/JSON_SCHEMAS.md).

Ringkasan aturan:

- Bentuk file: `{ "schemaVersion": 1, "items": [ ... ] }`.
- `id` harus unik dan **jangan diubah** bila sudah pernah dipakai laporan.
- `aktif: false` menyembunyikan item dari dropdown tanpa menghapus data lama.
- Setelah mengedit: refresh halaman (Ctrl+F5 / tarik-refresh di HP).

### Cara menambah driver ke master

Edit `data/master_driver.json`, tambahkan objek baru di dalam `items`:

```json
{
  "id": "drv-bambang",
  "nama": "Bambang",
  "nopol": "DR 9001 KC",
  "rental": true,
  "aktif": true
}
```

Driver baru muncul pada **laporan baru** (setelah reset/reload tanpa draft). Untuk laporan yang
sedang dibuka, gunakan tombol **+ Tambah Driver** agar data lama tidak berubah.

### Cara mengubah sumber material

Edit `data/sumber_material.json`:

```json
{ "id": "sm-tongkang-pel-baru", "label": "TONGKANG PEL BARU", "kategori": "tongkang", "aktif": true }
```

Jika label mengandung kata `TONGKANG`, subjek laporan otomatis menjadi
`TONGKANG KE <TUJUAN>`.

### Cara mengubah tujuan

Edit `data/master_tujuan.json`:

```json
{ "id": "mt-stockpile-baru", "label": "Stockpile Baru", "aktif": true }
```

### Cara mengubah material & kategori ukuran batu

`data/master_material.json` punya dua daftar:

- `items` → pilihan pada dropdown **Material** (Koral, Batu 0.5/1, dst).
- `ukuran` → kolom pada tabel **Rincian Ukuran Batu**.

Menambah `ukuran` baru otomatis menambah kolom tabel, subtotal, dan baris di preview/PDF. Data
laporan lama akan menganggap kolom baru belum diisi.

---

## Menambah / menghapus driver

| Kebutuhan | Cara | Efek |
| --- | --- | --- |
| Driver baru permanen | edit `data/master_driver.json` | muncul di semua laporan baru |
| Driver tambahan sekali pakai | tombol **+ Tambah Driver** | hanya laporan aktif, ditandai `MANUAL` |
| Keluarkan dari hitungan | tombol **◉** (nonaktif) | tidak dihitung, data tetap ada |
| Hapus dari laporan | tombol **✕** | data ritase & rincian driver tersebut dihapus dari laporan |

Menghapus driver di laporan **tidak** mengubah `master_driver.json`.

---

## Rumus perhitungan

```text
Grand Total        = Σ ritase driver AKTIF
Total Armada       = jumlah driver AKTIF
Armada Rental      = jumlah driver AKTIF yang ditandai rental
Total Ritase       = Σ ritase seluruh driver (termasuk nonaktif, sebagai informasi)

Subtotal kategori  = Σ nilai kategori tersebut dari driver AKTIF yang sudah diisi
Total Rincian      = Σ seluruh subtotal
Selisih            = Total Rincian − Grand Total
```

Aturan "belum diisi":

- Sel kosong → `null` → **tidak** dijumlahkan, driver ditandai belum lengkap.
- Sel bernilai `0` → dijumlahkan sebagai 0 dan dianggap **sudah diisi**.
- Status **VALID** hanya jika tidak ada error/peringatan dan `Selisih = 0`.

---

## Penyimpanan: master vs laporan vs draft

| Jenis | Lokasi | Ditulis oleh aplikasi? |
| --- | --- | --- |
| Master data | `data/*.json` (file repo) | **Tidak pernah** |
| Draft berjalan | LocalStorage `sjt:draft:v1` | Ya, autosave |
| Laporan tersimpan | LocalStorage `sjt:reports:v1` | Ya, tombol Simpan |
| Preferensi | LocalStorage `sjt:settings:v1` | Ya (mode sementara) |

Konsekuensi penting:

- Data laporan **tidak** ikut ter-commit ke Git dan tidak beredar antar perangkat otomatis.
- LocalStorage bisa hilang bila cache/browser data dibersihkan → gunakan **Export JSON** untuk backup.
- Inkognito/private mode biasanya memblokir LocalStorage; aplikasi tetap jalan tetapi draft tidak
  tersimpan (ada peringatan).

---

## Export: TXT, PDF, JSON

### TXT (WhatsApp friendly)

```
🏗️ LAPORAN HARIAN SEGINTUNG - 04/11/2026

📦 TONGKANG KE CAMP QUARRY EDY

- Sumber: TONGKANG PEL SEGINTUNG
- Tujuan: Camp Quarry Edy
- Material: Koral
...
```

Diakhiri nomor dokumen (`SJT-YYYYMMDD-XXXX`) dan waktu cetak.

### PDF

- Ukuran **A4 portrait**, margin 14 mm.
- Header biru navy dengan aksen oranye, kotak info 2 kolom, tabel bergaris zebra.
- Tabel dipecah otomatis antar halaman; baris tidak terpotong.
- Footer setiap halaman: nomor dokumen, waktu cetak, dan **Hal. X / Y**.
- Blok tanda tangan (Dibuat / Diperiksa / Disetujui).
- Nama file: `surat-jalan-<jenis>-<YYYYMMDD>-<id>.pdf`.

Jika pustaka PDF gagal dimuat (mis. diblokir), tombol PDF otomatis membuka dialog print browser —
pilih **Save as PDF**.

### JSON

- **Export JSON** → `surat-jalan-tdm-backup-YYYYMMDD.json` berisi semua laporan + draft.
- **Import JSON** menerima file backup tersebut (atau array laporan). Laporan dengan id sama akan
  ditimpa; laporan lain tetap aman.

---

## Pengujian

```bash
npm test              # 19 unit test logika (Node 20+, tanpa dependency)
npm run test:browser  # 44 pengujian end-to-end di Edge/Chrome headless
```

`npm run test:browser` akan menyalakan static server Python di port 8765, membuka
`http://127.0.0.1:8765/?selftest=1`, lalu membaca hasil dari DOM. Hasil yang diharapkan:
`SELFTEST PASS 44/44`.

Yang diuji:

| No | Skenario | Status |
| --- | --- | --- |
| 1 | Dropdown membaca seluruh JSON master | lulus |
| 2 | Opsi **Lainnya** membuka input manual | lulus |
| 3 | Tombol **+** menambah ritase | lulus |
| 4 | Tombol **−** mengurangi ritase | lulus |
| 5 | Ritase tidak bisa negatif | lulus |
| 6 | Grand Total akurat (115 rit, 8 driver) | lulus |
| 7 | Total armada akurat | lulus |
| 8 | Total rental akurat | lulus |
| 9 | Subtotal material akurat | lulus |
| 10 | Validasi selisih ritase bekerja | lulus |
| 11 | LocalStorage menyimpan draft | lulus |
| 12 | Draft bertahan setelah reload | lulus (manual + smoke) |
| 13 | Export TXT berisi data aktual | lulus |
| 14 | Pembuatan PDF (2 halaman) | lulus |
| 15 | Layout mobile tanpa overflow | lulus (390 px) |
| 16 | Semua JSON terbaca di server statis | lulus |

Pengujian manual yang disarankan setelah deploy:
buka URL GitHub Pages → isi ritase → refresh (draft harus pulih) → Download PDF di Chrome Android →
coba "Save as PDF". Nomor halaman otomatis ditambahkan Chrome pada dialog print; PDF dari jsPDF
sudah memiliki nomor halaman sendiri.

---

## Deployment GitHub Pages

Workflow `.github/workflows/deploy.yml` berjalan otomatis saat push ke `main`:

1. Checkout repo.
2. Salin file statis ke `_site/` (tanpa `.git`, `tests`, `node_modules`).
3. Upload artefak Pages.
4. Deploy ke environment `github-pages`.

Tidak ada Node/build step saat deploy.

### Aktivasi sekali saja

1. Buka **Settings → Pages**.
2. Bagian **Build and deployment → Source**, pilih **GitHub Actions**.
3. Push ke `main` (atau jalankan workflow manual via tab **Actions → Deploy … → Run workflow**).
4. Tunggu ±1 menit, lalu buka <https://yudibilly.github.io/surat-jalan-tdm/>.

Jika memakai CLI:

```bash
gh api -X POST repos/yudibilly/surat-jalan-tdm/pages -f build_type=workflow
```

### Fallback: publish lewat branch `gh-pages` (tanpa Actions)

Jika Actions dinonaktifkan di level akun (gejalanya: `HTTP 422: Actions has been disabled for this user`
atau tidak ada run yang tercipta setelah push), situs tetap bisa dipublikasikan lewat branch statis:

```bash
# 1. siapkan worktree sementara berisi file situs (tanpa tests/.github)
git worktree add --detach /tmp/sjt-pages
cd /tmp/sjt-pages
git checkout --orphan gh-pages

# 2. salin file situs, lalu commit & push
git add -A
git commit -m "deploy: publish static site"
git push origin gh-pages

# 3. arahkan Pages ke branch tersebut
gh api -X PUT repos/yudibilly/surat-jalan-tdm/pages \
  --input - <<< '{"build_type":"legacy","source":{"branch":"gh-pages","path":"/"}}'
```

Repo ini sudah pernah dipublikasikan dengan cara tersebut. Saat Actions kembali aktif, ubah
**Settings → Pages → Source** menjadi **GitHub Actions** agar workflow `deploy.yml` mengambil alih.

`main` berisi file `.nojekyll` agar GitHub Pages (mode branch) menyajikan file apa adanya tanpa Jekyll.


---

## Batasan yang diketahui

- **Butuh web server.** Membuka `index.html` dari filesystem gagal karena `fetch()` JSON diblokir
  CORS (`file://`). Gunakan `python -m http.server` atau GitHub Pages.
- **LocalStorage per browser/per perangkat.** Sinkronisasi antar HP tidak otomatis; gunakan
  Export/Import JSON.
- **Digitasi tanda tangan** belum ada; blok tanda tangan hanya untuk tanda tangan manual.
- **jsPDF hanya mendukung font standar** (Latin-1). Emoji tidak muncul di PDF (sengaja dihilangkan),
  tetapi tetap ada di TEXT/WhatsApp.
- **Nomor halaman print** bergantung pada browser: Chrome/Edge menambahkan header/footer sendiri
  bila opsi tersebut dicentang. PDF dari jsPDF sudah pasti bernomor.
- **Mode gelap** belum dioptimalkan.
- Data master hanya bisa diubah lewat file JSON di repo (belum ada editor master di UI).
