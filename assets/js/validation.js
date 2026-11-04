/**
 * validation.js — aturan validasi laporan (murni, tanpa DOM)
 *
 * Status:
 *  - "valid"      → VALID
 *  - "incomplete" → PERLU DILENGKAPI
 *  - "mismatch"   → TIDAK SESUAI
 */

import { computeMaterialTotals, computeRekap, formatNumber } from "./calculation.js";

export const STATUS = {
  VALID: "valid",
  INCOMPLETE: "incomplete",
  MISMATCH: "mismatch",
};

export const STATUS_LABEL = {
  valid: "VALID",
  incomplete: "PERLU DILENGKAPI",
  mismatch: "TIDAK SESUAI",
};

/** dd/mm/yyyy dari "YYYY-MM-DD" */
export function formatTanggal(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

function item(level, code, title, detail) {
  return { level, code, title, detail: detail || "" };
}

/**
 * @param {Object} report  { info, drivers, material }
 * @param {Object} masters { ukuran: [{id,label}] }
 * @returns {{status:string,label:string,items:Array,errors:number,warnings:number,blocking:boolean}}
 */
export function validateReport(report, masters = {}) {
  const info = report.info || {};
  const drivers = report.drivers || [];
  const categories = masters.ukuran || [];
  const rekap = computeRekap(drivers);
  const material = computeMaterialTotals(drivers, categories, report.material && report.material.values);

  const items = [];

  /* 1. Tanggal */
  if (!info.tanggal || !/^\d{4}-\d{2}-\d{2}$/.test(info.tanggal)) {
    items.push(item("err", "tanggal", "Tanggal laporan belum diisi", "Isi tanggal laporan pada bagian Informasi Laporan."));
  } else {
    items.push(item("ok", "tanggal", "Tanggal laporan terisi", formatTanggal(info.tanggal)));
  }

  /* 2. Sumber material */
  if (!info.sumber) {
    items.push(item("err", "sumber", "Sumber material belum dipilih", "Pilih sumber material atau isi pilihan Lainnya."));
  } else {
    items.push(item("ok", "sumber", "Sumber material terisi", info.sumber));
  }

  /* 3. Tujuan */
  if (!info.tujuan) {
    items.push(item("err", "tujuan", "Tujuan pengiriman belum dipilih", "Pilih tujuan atau isi pilihan Lainnya."));
  } else {
    items.push(item("ok", "tujuan", "Tujuan pengiriman terisi", info.tujuan));
  }

  /* 4. Driver tanpa identitas */
  const withoutIdentity = drivers.filter(
    (d) => d.active && (!String(d.nama || "").trim() || !String(d.nopol || "").trim())
  );
  if (drivers.length === 0 || rekap.totalArmada === 0) {
    items.push(item("err", "armada", "Belum ada driver aktif dalam laporan", "Aktifkan minimal satu driver pada bagian Rincian Ritase."));
  } else if (withoutIdentity.length > 0) {
    items.push(
      item(
        "err",
        "identitas",
        `${withoutIdentity.length} driver tanpa identitas lengkap`,
        "Lengkapi nama dan nomor polisi: " + withoutIdentity.map((d) => d.nama || "(tanpa nama)").join(", ")
      )
    );
  } else {
    items.push(item("ok", "identitas", "Semua driver aktif memiliki nama dan nomor polisi", `${rekap.totalArmada} unit`));
  }

  /* 5. Ritase negatif / tidak valid */
  const invalidRit = drivers.filter((d) => !Number.isInteger(Number(d.ritase)) || Number(d.ritase) < 0);
  if (invalidRit.length > 0) {
    items.push(item("err", "ritase", `${invalidRit.length} driver memiliki ritase tidak valid`, "Ritase harus bilangan bulat dan tidak boleh negatif."));
  } else if (rekap.grandTotal === 0) {
    items.push(item("warn", "ritase", "Grand total ritase masih 0", "Tambahkan ritase pada kartu driver."));
  } else {
    items.push(item("ok", "ritase", "Ritase seluruh driver valid", `${formatNumber(rekap.grandTotal)} rit`));
  }

  /* 6 & 7. Rincian material */
  if (material.expectedCells === 0) {
    items.push(item("warn", "material", "Rincian ukuran batu belum dapat dihitung", "Belum ada driver aktif."));
  } else if (material.incompleteDrivers.length > 0) {
    const nama = material.incompleteDrivers.map((d) => d.nama || "(tanpa nama)");
    items.push(
      item(
        "warn",
        "material-incomplete",
        `${material.incompleteDrivers.length} driver belum lengkap rincian materialnya`,
        "Belum diisi (bukan nol): " + nama.join(", ")
      )
    );
  } else {
    items.push(item("ok", "material-complete", "Rincian material sudah lengkap", `${material.expectedCells} sel terisi`));
  }

  const selisih = material.materialTotal - rekap.grandTotal;
  if (material.expectedCells > 0 && material.complete) {
    if (selisih === 0) {
      items.push(
        item(
          "ok",
          "material-match",
          "Total rincian sama dengan grand total",
          `${formatNumber(material.materialTotal)} = ${formatNumber(rekap.grandTotal)} rit`
        )
      );
    } else {
      items.push(
        item(
          "err",
          "material-mismatch",
          "Total rincian tidak sama dengan grand total",
          `Rincian ${formatNumber(material.materialTotal)} rit vs Grand Total ${formatNumber(rekap.grandTotal)} rit (selisih ${
            selisih > 0 ? "+" : ""
          }${formatNumber(selisih)} rit)`
        )
      );
    }
  } else if (material.incompleteDrivers.length > 0) {
    items.push(
      item(
        "warn",
        "material-pending",
        "Perbandingan total belum final",
        "Lengkapi seluruh rincian agar grand total dapat dibandingkan. Kolom kosong tidak dihitung sebagai nol."
      )
    );
  }

  const errors = items.filter((i) => i.level === "err").length;
  const warnings = items.filter((i) => i.level === "warn").length;

  let status = STATUS.VALID;
  if (errors > 0) status = STATUS.MISMATCH;
  else if (warnings > 0) status = STATUS.INCOMPLETE;
  else if (material.materialTotal !== rekap.grandTotal) status = STATUS.MISMATCH;

  return {
    status,
    label: STATUS_LABEL[status],
    items,
    errors,
    warnings,
    blocking: status !== STATUS.VALID,
    rekap,
    material,
  };
}

/** Data siap ekspor: hanya bila valid, kecuali mode sementara diizinkan. */
export function canFinalize(validation) {
  return validation.status === STATUS.VALID;
}
