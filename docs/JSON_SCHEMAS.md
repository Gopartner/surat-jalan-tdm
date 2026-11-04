# Dokumentasi Format JSON

Semua data master berada di folder `data/`. Aplikasi membacanya dengan `fetch()` relatif terhadap
`assets/js/master-data.js`, sehingga **tidak perlu build step**.

Aturan umum:

| Aturan | Keterangan |
| --- | --- |
| Encoding | UTF-8 tanpa BOM |
| Bentuk | Objek `{ "schemaVersion": 1, "items": [ ... ] }` |
| `id` | String unik, huruf kecil, pemisah `-`. **Jangan diubah** setelah dipakai di laporan. |
| `aktif` | `false` → item tidak muncul di dropdown, tetapi data laporan lama tetap aman. |
| `label` / `nama` | Teks yang tampil di UI. Boleh diubah kapan saja. |
| Urutan | Urutan item di array = urutan dropdown. |
| Komentar | JSON tidak mendukung komentar. Jangan menambahkan `//` atau `/* */`. |

Setelah mengubah file JSON, cukup **refresh halaman** (Ctrl+F5) agar perubahan terbaca.

---

## 1. `data/master_laporan_harian.json`

Daftar jenis laporan beserta nilai default sumber/tujuan/material.

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-11-04",
  "items": [
    {
      "id": "lh-segintung",
      "label": "Laporan Harian Segintung",
      "judul": "LAPORAN HARIAN SEGINTUNG",
      "kode": "LH-SGT",
      "aktif": true,
      "default": {
        "sumberId": "sm-tongkang-pel-segintung",
        "tujuanId": "mt-camp-quarry-edy",
        "materialId": "mat-koral"
      }
    }
  ]
}
```

| Field | Tipe | Wajib | Keterangan |
| --- | --- | --- | --- |
| `id` | string | ya | ID unik jenis laporan. |
| `label` | string | ya | Teks pada dropdown. |
| `judul` | string | ya | Judul yang dipakai di preview, TXT, dan PDF (biasanya kapital). |
| `kode` | string | tidak | Kode internal, tidak dipakai di UI saat ini. |
| `aktif` | boolean | tidak | Default `true`. |
| `default.sumberId` | string | tidak | ID dari `sumber_material.json`; otomatis dipilih saat jenis laporan dipilih. |
| `default.tujuanId` | string | tidak | ID dari `master_tujuan.json`. |
| `default.materialId` | string | tidak | ID dari `master_material.json`. |

Opsi **Lainnya…** selalu ditambahkan otomatis oleh aplikasi (tidak perlu ditulis di JSON).

---

## 2. `data/sumber_material.json`

```json
{
  "schemaVersion": 1,
  "items": [
    {
      "id": "sm-tongkang-pel-segintung",
      "label": "TONGKANG PEL SEGINTUNG",
      "kategori": "tongkang",
      "aktif": true
    }
  ]
}
```

| Field | Tipe | Wajib | Keterangan |
| --- | --- | --- | --- |
| `id` | string | ya | ID unik. |
| `label` | string | ya | Teks dropdown. Jika mengandung kata `TONGKANG`, subjek laporan otomatis menjadi `TONGKANG KE <TUJUAN>`. |
| `kategori` | string | tidak | `tongkang`, `quarry`, `stockpile`, `jetty`, dst. Informasi tambahan. |
| `aktif` | boolean | tidak | Default `true`. |

---

## 3. `data/master_tujuan.json`

```json
{
  "schemaVersion": 1,
  "items": [{ "id": "mt-camp-quarry-edy", "label": "Camp Quarry Edy", "aktif": true }]
}
```

| Field | Tipe | Wajib | Keterangan |
| --- | --- | --- | --- |
| `id` | string | ya | ID unik. |
| `label` | string | ya | Nama tujuan (dipakai juga untuk subjek `TONGKANG KE ...`). |
| `aktif` | boolean | tidak | Default `true`. |

---

## 4. `data/master_material.json`

Berisi dua hal: pilihan material dan kategori kolom pada tabel **Rincian Ukuran Batu**.

```json
{
  "schemaVersion": 1,
  "items": [
    { "id": "mat-koral", "label": "Koral", "aktif": true },
    { "id": "mat-batu-1-2", "label": "Batu 1-2", "aktif": true }
  ],
  "ukuran": [
    { "id": "batu-05-1", "label": "Batu 0.5/1", "satuan": "rit", "aktif": true },
    { "id": "batu-1-2", "label": "Batu 1-2", "satuan": "rit", "aktif": true }
  ]
}
```

| Field | Tipe | Wajib | Keterangan |
| --- | --- | --- | --- |
| `items[].id` | string | ya | ID material. |
| `items[].label` | string | ya | Nama material pada dropdown. |
| `ukuran[].id` | string | ya | ID kolom rincian. **Jangan diubah** jika sudah ada data tersimpan. |
| `ukuran[].label` | string | ya | Judul kolom tabel & baris preview. |
| `ukuran[].satuan` | string | tidak | Satuan (default `rit`). |

Menambah kategori baru akan otomatis menambah kolom pada tabel rincian dan bagian preview.
Data laporan lama akan menganggap kolom baru **belum diisi** (bukan nol).

---

## 5. `data/master_driver.json`

```json
{
  "schemaVersion": 1,
  "items": [
    { "id": "drv-warjo", "nama": "Warjo", "nopol": "DR 8641 KC", "rental": false, "aktif": true }
  ]
}
```

| Field | Tipe | Wajib | Keterangan |
| --- | --- | --- | --- |
| `id` | string | ya | ID unik driver. |
| `nama` | string | ya | Nama tampilan (UI menampilkannya kapital). |
| `nopol` | string | ya | Nomor polisi, otomatis diubah ke huruf besar. |
| `rental` | boolean | tidak | Menandai armada rental untuk laporan baru. |
| `aktif` | boolean | tidak | `false` → tidak dimasukkan ke laporan baru. |

Perubahan pada file ini **hanya memengaruhi laporan baru**. Laporan tersimpan menyimpan salinan
nama/nomor polisi sendiri sehingga tidak berubah saat master diedit.

---

## 6. Format data laporan (LocalStorage & export JSON)

Kunci LocalStorage:

| Kunci | Isi |
| --- | --- |
| `sjt:draft:v1` | `{ savedAt, report }` — draft yang sedang diedit (autosave). |
| `sjt:reports:v1` | `{ [id]: report }` — laporan yang disimpan manual. |
| `sjt:settings:v1` | `{ sementara: boolean }` — preferensi mode export sementara. |

Struktur satu `report`:

```json
{
  "id": "lap-m9x2k1-a1b2c3",
  "createdAt": "2026-11-04T09:00:00.000Z",
  "updatedAt": "2026-11-04T09:10:00.000Z",
  "status": "draft",
  "schemaVersion": 1,
  "info": {
    "laporanId": "lh-segintung",
    "laporanCustom": "",
    "tanggal": "2026-11-04",
    "sumberId": "sm-tongkang-pel-segintung",
    "sumberCustom": "",
    "sumber": "TONGKANG PEL SEGINTUNG",
    "tujuanId": "mt-camp-quarry-edy",
    "tujuanCustom": "",
    "tujuan": "Camp Quarry Edy",
    "materialId": "mat-koral",
    "materialCustom": "",
    "material": "Koral"
  },
  "drivers": [
    {
      "uid": "d-m9x2k1-9f8e7d",
      "driverId": "drv-warjo",
      "nama": "Warjo",
      "nopol": "DR 8641 KC",
      "rental": false,
      "active": true,
      "ritase": 11,
      "custom": false,
      "order": 0
    }
  ],
  "material": {
    "values": {
      "d-m9x2k1-9f8e7d": { "batu-05-1": 10, "batu-1-2": 0 }
    }
  }
}
```

Catatan penting:

- `uid` adalah identitas driver **di dalam laporan**. Kunci `material.values` memakai `uid`,
  bukan `id` master, agar driver bisa ditambah/dihapus tanpa merusak data lain.
- `ritase: 0` berarti benar-benar nol. Nilai rincian `null` atau kunci yang tidak ada berarti
  **belum diisi** dan tidak dijumlahkan.
- `active: false` mengeluarkan driver dari Total Armada dan Grand Total, tetapi datanya tetap
  tersimpan (bisa diaktifkan kembali).
- Export JSON menghasilkan `{ app, schemaVersion, exportedAt, reports: [...], draft }`.
  Import menerima bentuk tersebut, atau array laporan langsung.

---

## 7. Validasi struktur mandiri

```bash
# cek JSON tidak rusak
node -e "for (const f of require('fs').readdirSync('data')) JSON.parse(require('fs').readFileSync('data/'+f,'utf8')); console.log('JSON valid')"

# jalankan unit test + smoke test browser
npm test
npm run test:browser
```
