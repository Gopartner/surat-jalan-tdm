/**
 * Unit test logika murni (tanpa DOM).
 * Jalankan: npm test   (atau: node --test tests/unit.test.mjs)
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  clampRit,
  parseMaterialValue,
  computeRekap,
  computeMaterialTotals,
  formatNumber,
} from "../assets/js/calculation.js";
import { validateReport, formatTanggal } from "../assets/js/validation.js";
import { buildReportText, buildSubject, DIVIDER } from "../assets/js/report-text.js";
import { isoToDisplay, displayToISO, todayISO, buildDocId } from "../assets/js/master-data.js";

const UKURAN = [
  { id: "batu-05-1", label: "Batu 0.5/1" },
  { id: "batu-1-2", label: "Batu 1-2" },
];
const MASTERS = { ukuran: UKURAN };

const driver = (uid, nama, nopol, ritase, extra = {}) => ({
  uid,
  nama,
  nopol,
  ritase,
  active: true,
  rental: false,
  ...extra,
});

const drivers8 = [
  driver("d1", "Warjo", "DR 8641 KC", 11),
  driver("d2", "Hartanto", "DR 8638 KC", 12),
  driver("d3", "Fauji", "DR 8642 KC", 9),
  driver("d4", "Suprapto", "KH 8947 FD", 24),
  driver("d5", "Djoko", "KH 8189 LF", 11),
  driver("d6", "Herman", "KH 8389 FI", 20),
  driver("d7", "Sugiho new", "DA 8978 HK", 22),
  driver("d8", "Suki", "KM 8727 HK", 6),
];

function makeReport(overrides = {}) {
  return {
    id: "lap-test-1",
    info: {
      laporanId: "lh-segintung",
      laporanCustom: "",
      tanggal: "2026-11-04",
      sumberId: "sm-tongkang-pel-segintung",
      sumber: "TONGKANG PEL SEGINTUNG",
      tujuanId: "mt-camp-quarry-edy",
      tujuan: "Camp Quarry Edy",
      materialId: "mat-koral",
      material: "Koral",
    },
    drivers: drivers8,
    material: { values: {} },
    ...overrides,
  };
}

/* ---------------- calculation ---------------- */

test("clampRit menahan nilai negatif dan membulatkan", () => {
  assert.equal(clampRit(-5), 0);
  assert.equal(clampRit("3"), 3);
  assert.equal(clampRit(2.9), 2);
  assert.equal(clampRit("abc"), 0);
  assert.equal(clampRit(NaN), 0);
});

test("parseMaterialValue membedakan belum diisi dan nol", () => {
  assert.equal(parseMaterialValue(""), null);
  assert.equal(parseMaterialValue(null), null);
  assert.equal(parseMaterialValue(undefined), null);
  assert.equal(parseMaterialValue(0), 0);
  assert.equal(parseMaterialValue("0"), 0);
  assert.equal(parseMaterialValue(7), 7);
  assert.equal(parseMaterialValue(-2), 0);
});

test("computeRekap: armada, rental, grand total hanya driver aktif", () => {
  const drivers = [
    driver("a", "A", "AA 1", 5, { rental: true }),
    driver("b", "B", "BB 2", 7),
    driver("c", "C", "CC 3", 99, { active: false }),
  ];
  const rekap = computeRekap(drivers);
  assert.equal(rekap.totalArmada, 2);
  assert.equal(rekap.totalRental, 1);
  assert.equal(rekap.grandTotal, 12);
  assert.equal(rekap.totalNonAktif, 1);
});

test("computeRekap: total 8 driver contoh = 115 rit", () => {
  const rekap = computeRekap(drivers8);
  assert.equal(rekap.totalArmada, 8);
  assert.equal(rekap.grandTotal, 115);
});

test("computeMaterialTotals: sel kosong tidak dihitung sebagai nol", () => {
  const values = {
    d1: { "batu-05-1": 10, "batu-1-2": 1 },
    d2: { "batu-05-1": 0, "batu-1-2": null },
  };
  const result = computeMaterialTotals(drivers8.slice(0, 2), UKURAN, values);

  assert.equal(result.subtotals["batu-05-1"], 10);
  assert.equal(result.subtotals["batu-1-2"], 1);
  assert.equal(result.materialTotal, 11);
  assert.equal(result.complete, false);
  assert.equal(result.incompleteDrivers.length, 1);
  assert.equal(result.missing.length, 1);
  assert.equal(result.missing[0].uid, "d2");
  assert.equal(result.missing[0].categoryId, "batu-1-2");
  assert.equal(result.perDriver[0].total, 11);
  assert.equal(result.perDriver[1].total, 0);
});

test("computeMaterialTotals: hanya driver aktif yang masuk subtotal", () => {
  const drivers = [driver("a", "A", "AA", 2), driver("b", "B", "BB", 5, { active: false })];
  const values = { a: { "batu-05-1": 2, "batu-1-2": 0 }, b: { "batu-05-1": 99, "batu-1-2": 99 } };
  const result = computeMaterialTotals(drivers, UKURAN, values);
  assert.equal(result.subtotals["batu-05-1"], 2);
  assert.equal(result.materialTotal, 2);
  assert.equal(result.complete, true);
});

test("formatNumber memakai pemisah ribuan Indonesia", () => {
  assert.equal(formatNumber(1234), "1.234");
  assert.equal(formatNumber(0), "0");
  assert.equal(formatNumber("x"), "0");
});

/* ---------------- validation ---------------- */

test("validasi VALID saat data lengkap dan total cocok", () => {
  const values = {};
  for (const d of drivers8) values[d.uid] = { "batu-05-1": d.ritase, "batu-1-2": 0 };
  const report = makeReport({ material: { values } });
  const result = validateReport(report, MASTERS);

  assert.equal(result.status, "valid");
  assert.equal(result.label, "VALID");
  assert.equal(result.errors, 0);
  assert.equal(result.warnings, 0);
  assert.equal(result.material.materialTotal, 115);
});

test("validasi PERLU DILENGKAPI saat ada sel belum diisi", () => {
  const values = {};
  for (const d of drivers8) values[d.uid] = { "batu-05-1": d.ritase, "batu-1-2": null };
  const report = makeReport({ material: { values } });
  const result = validateReport(report, MASTERS);

  assert.equal(result.status, "incomplete");
  assert.equal(result.label, "PERLU DILENGKAPI");
  assert.ok(result.items.some((i) => i.code === "material-incomplete"));
  assert.equal(result.errors, 0);
});

test("validasi TIDAK SESUAI saat total rincian berbeda", () => {
  const values = {};
  for (const d of drivers8) values[d.uid] = { "batu-05-1": 1, "batu-1-2": 0 };
  const report = makeReport({ material: { values } });
  const result = validateReport(report, MASTERS);

  assert.equal(result.status, "mismatch");
  assert.equal(result.label, "TIDAK SESUAI");
  assert.ok(result.items.some((i) => i.code === "material-mismatch"));
  assert.match(result.items.find((i) => i.code === "material-mismatch").detail, /selisih/);
});

test("validasi TIDAK SESUAI saat tanggal kosong", () => {
  const report = makeReport();
  report.info.tanggal = "";
  const result = validateReport(report, MASTERS);
  assert.equal(result.status, "mismatch");
  assert.ok(result.items.some((i) => i.code === "tanggal" && i.level === "err"));
});

test("validasi TIDAK SESUAI saat sumber/tujuan kosong", () => {
  const report = makeReport({ material: { values: {} } });
  report.info.sumber = "";
  report.info.tujuan = "";
  const result = validateReport(report, MASTERS);
  assert.ok(result.items.some((i) => i.code === "sumber" && i.level === "err"));
  assert.ok(result.items.some((i) => i.code === "tujuan" && i.level === "err"));
});

test("validasi menandai driver tanpa identitas", () => {
  const drivers = [driver("a", "", "AA 1", 1), driver("b", "B", "", 2)];
  const report = makeReport({ drivers, material: { values: {} } });
  const result = validateReport(report, MASTERS);
  assert.ok(result.items.some((i) => i.code === "identitas" && i.level === "err"));
});

test("formatTanggal mengubah ISO ke DD/MM/YYYY", () => {
  assert.equal(formatTanggal("2026-11-04"), "04/11/2026");
  assert.equal(formatTanggal(""), "");
  assert.equal(formatTanggal("04-11-2026"), "");
});

/* ---------------- report text ---------------- */

test("buildSubject menyesuaikan sumber tongkang", () => {
  assert.equal(
    buildSubject({ sumber: "TONGKANG PEL SEGINTUNG", tujuan: "Camp Quarry Edy" }),
    "TONGKANG KE CAMP QUARRY EDY"
  );
  assert.equal(buildSubject({ sumber: "QUARRY EDY", tujuan: "Stockpile" }), "QUARRY EDY → STOCKPILE");
});

test("buildReportText memuat seluruh bagian laporan", () => {
  const values = {};
  for (const d of drivers8) values[d.uid] = { "batu-05-1": d.ritase, "batu-1-2": 0 };
  const report = makeReport({ material: { values } });
  const validation = validateReport(report, MASTERS);
  const ctx = {
    judul: "LAPORAN HARIAN SEGINTUNG",
    validation,
    rekap: computeRekap(report.drivers),
    material: validation.material,
    categories: UKURAN,
    docId: buildDocId(report),
    timestamp: "04/11/2026 10:00",
  };

  const text = buildReportText(report, ctx);

  assert.ok(text.startsWith("🏗️ LAPORAN HARIAN SEGINTUNG - 04/11/2026"));
  assert.ok(text.includes("📦 TONGKANG KE CAMP QUARRY EDY"));
  assert.ok(text.includes("- Sumber: TONGKANG PEL SEGINTUNG"));
  assert.ok(text.includes("1. Warjo (DR 8641 KC) = 11 rit"));
  assert.ok(text.includes("- Total Armada: 8 Unit (Rental 0)"));
  assert.ok(text.includes("- Grand Total: 115 Rit"));
  assert.ok(text.includes("📊 RINCIAN UKURAN BATU (SEMENTARA)"));
  assert.ok(text.includes("Batu 0.5/1:"));
  assert.ok(text.includes(DIVIDER));
  assert.ok(text.includes("VALIDASI SEMENTARA"));
  assert.ok(text.includes("Status: VALID"));
  assert.ok(text.includes("No. Dokumen: SJT-20261104-"));
});

test("buildReportText menampilkan 'belum' untuk rincian kosong", () => {
  const report = makeReport({
    material: { values: { d1: { "batu-05-1": 10, "batu-1-2": null } } },
  });
  const validation = validateReport(report, MASTERS);
  const ctx = {
    judul: "LAPORAN HARIAN SEGINTUNG",
    validation,
    rekap: computeRekap(report.drivers),
    material: validation.material,
    categories: UKURAN,
    docId: "SJT-TEST",
    timestamp: "-",
  };
  const text = buildReportText(report, ctx);
  assert.ok(text.includes("- Warjo: 10"));
  assert.ok(text.includes("- Warjo: belum"));
  assert.ok(text.includes("PERLU DILENGKAPI"));
});

/* ---------------- master-data helper ---------------- */

test("konversi tanggal dua arah", () => {
  assert.equal(isoToDisplay("2026-11-04"), "04-11-2026");
  assert.equal(displayToISO("04-11-2026"), "2026-11-04");
  assert.equal(displayToISO("31-02-2026"), "");
  assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
});

test("buildDocId memakai tanggal laporan", () => {
  const report = makeReport({ id: "lap-abc12345" });
  assert.match(buildDocId(report), /^SJT-20261104-[A-Z0-9]{1,4}$/);
});
