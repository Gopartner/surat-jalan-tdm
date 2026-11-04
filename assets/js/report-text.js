/**
 * report-text.js — pembentuk teks laporan (murni, dipakai preview + export TXT)
 * Format ramah WhatsApp.
 */

import { formatNumber, clampRit } from "./calculation.js";
import { STATUS_LABEL, formatTanggal } from "./validation.js";

export const DIVIDER = "━━━━━━━━━━━━━━━━━━━━";
const ICON = { ok: "✅", warn: "⚠️", err: "❌" };

/** Subjek ringkas: "TONGKANG KE CAMP QUARRY EDY" */
export function buildSubject(info = {}) {
  const sumber = String(info.sumber || "-").trim();
  const tujuan = String(info.tujuan || "-").trim();
  const isTongkang = /tongkang/i.test(sumber);
  if (isTongkang) return `TONGKANG KE ${tujuan.toUpperCase()}`;
  return `${sumber.toUpperCase()} → ${tujuan.toUpperCase()}`;
}

export function activeDrivers(drivers = []) {
  return drivers.filter((d) => d.active);
}

/**
 * @param {Object} report
 * @param {Object} ctx { judul, validation, rekap, material, categories, docId, timestamp }
 */
export function buildReportText(report, ctx) {
  const info = report.info || {};
  const { judul, validation, rekap, material, categories = [], docId = "", timestamp = "" } = ctx;
  const drivers = activeDrivers(report.drivers || []);
  const inactive = (report.drivers || []).filter((d) => !d.active);
  const lines = [];

  /* Header */
  lines.push(`🏗️ ${String(judul || "LAPORAN HARIAN").toUpperCase()} - ${formatTanggal(info.tanggal) || "--/--/----"}`);
  lines.push("");
  lines.push(`📦 ${buildSubject(info)}`);
  lines.push("");
  lines.push(`- Sumber: ${info.sumber || "-"}`);
  lines.push(`- Tujuan: ${info.tujuan || "-"}`);
  lines.push(`- Material: ${info.material || "-"}`);
  lines.push("");

  /* Rincian ritase */
  lines.push("Rincian Ritase Driver:");
  lines.push("");
  if (drivers.length === 0) {
    lines.push("(belum ada driver aktif)");
  } else {
    drivers.forEach((driver, index) => {
      const rental = driver.rental ? " (Rental)" : "";
      lines.push(`${index + 1}. ${driver.nama || "(tanpa nama)"} (${driver.nopol || "-"})${rental} = ${formatNumber(clampRit(driver.ritase))} rit`);
    });
  }
  if (inactive.length > 0) {
    lines.push("");
    lines.push(`Tidak dihitung (nonaktif): ${inactive.map((d) => d.nama || "(tanpa nama)").join(", ")}`);
  }
  lines.push("");
  lines.push(DIVIDER);
  lines.push("");

  /* Rekap */
  lines.push("📊 REKAP TOTAL");
  lines.push("");
  lines.push(`- Total Armada: ${formatNumber(rekap.totalArmada)} Unit (Rental ${formatNumber(rekap.totalRental)})`);
  lines.push(`- Grand Total: ${formatNumber(rekap.grandTotal)} Rit`);
  if (material.expectedCells > 0) {
    lines.push(`- Total Rincian Material: ${formatNumber(material.materialTotal)} Rit`);
    if (material.complete) {
      const beda = material.materialTotal - rekap.grandTotal;
      lines.push(`- Selisih: ${beda > 0 ? "+" : ""}${formatNumber(beda)} Rit`);
    } else {
      lines.push(`- Selisih: belum final (${material.incompleteDrivers.length} driver belum lengkap)`);
    }
  }
  lines.push("");
  lines.push(DIVIDER);
  lines.push("");

  /* Rincian material */
  lines.push("📊 RINCIAN UKURAN BATU (SEMENTARA)");
  lines.push("");
  if (categories.length === 0) {
    lines.push("(kategori ukuran batu belum tersedia)");
  } else {
    for (const category of categories) {
      lines.push(`${category.label}:`);
      const rows = material.perDriver.filter((d) => d.active);
      if (rows.length === 0) {
        lines.push("- belum ada driver");
      } else {
        for (const row of rows) {
          const value = row.values[category.id];
          const text = value === null || value === undefined ? "belum" : formatNumber(value);
          const note = value === null || value === undefined ? " ⚠️" : "";
          lines.push(`- ${row.nama || "(tanpa nama)"}: ${text}${note}`);
        }
      }
      lines.push(`- Subtotal sementara: ${formatNumber(material.subtotals[category.id] || 0)}`);
      lines.push("");
    }
    lines.push(`Total seluruh ukuran: ${formatNumber(material.materialTotal)} rit`);
  }
  lines.push("");
  lines.push(DIVIDER);
  lines.push("");

  /* Validasi */
  lines.push(`${validation.status === "valid" ? "✅" : "⚠️"} VALIDASI SEMENTARA:`);
  lines.push("");
  lines.push(`Status: ${STATUS_LABEL[validation.status]}`);
  for (const check of validation.items) {
    lines.push(`${ICON[check.level] || "•"} ${check.title}${check.detail ? ` — ${check.detail}` : ""}`);
  }
  lines.push("");
  lines.push(DIVIDER);

  /* Footer */
  if (docId || timestamp) {
    lines.push("");
    lines.push(`No. Dokumen: ${docId || "-"}`);
    lines.push(`Dicetak: ${timestamp || "-"}`);
    lines.push("Dibuat dengan Surat Jalan TDM");
  }

  return lines.join("\n");
}

/** Nama file aman untuk unduhan. */
export function buildFileName(report, judul, extension = "txt") {
  const tanggal = String(report.info?.tanggal || "").replace(/-/g, "");
  const jenis = String(judul || "laporan")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const id = String(report.id || "draft").slice(-6);
  return `surat-jalan-${jenis}-${tanggal || "tanpa-tanggal"}-${id}.${extension}`;
}
