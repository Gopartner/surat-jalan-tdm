/**
 * master-data.js — pemuat data master JSON + pembentuk model laporan.
 * Semua dropdown UI WAJIB mengambil data dari modul ini (tidak hardcode).
 */

import { uid } from "./storage.js";

const SOURCES = {
  laporanHarian: new URL("../../data/master_laporan_harian.json", import.meta.url),
  sumberMaterial: new URL("../../data/sumber_material.json", import.meta.url),
  tujuan: new URL("../../data/master_tujuan.json", import.meta.url),
  material: new URL("../../data/master_material.json", import.meta.url),
  driver: new URL("../../data/master_driver.json", import.meta.url),
};

async function fetchJSON(url, label) {
  let response;
  try {
    response = await fetch(url, { cache: "no-cache" });
  } catch (error) {
    throw new Error(`Gagal memuat ${label}. Pastikan aplikasi dijalankan lewat web server (bukan file://).`);
  }
  if (!response.ok) {
    throw new Error(`Gagal memuat ${label} (HTTP ${response.status}).`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`File ${label} bukan JSON yang valid.`);
  }
}

const onlyActive = (items) => (Array.isArray(items) ? items.filter((item) => item && item.aktif !== false) : []);

function normalizeList(payload) {
  if (Array.isArray(payload)) return onlyActive(payload);
  return onlyActive(payload.items);
}

/** Muat seluruh data master secara paralel. */
export async function loadMasterData() {
  const [laporanHarian, sumberMaterial, tujuan, material, driver] = await Promise.all([
    fetchJSON(SOURCES.laporanHarian, "master_laporan_harian.json"),
    fetchJSON(SOURCES.sumberMaterial, "sumber_material.json"),
    fetchJSON(SOURCES.tujuan, "master_tujuan.json"),
    fetchJSON(SOURCES.material, "master_material.json"),
    fetchJSON(SOURCES.driver, "master_driver.json"),
  ]);

  const materialItems = normalizeList(material);
  const ukuran = onlyActive(material.ukuran);

  if (materialItems.length === 0) throw new Error("master_material.json tidak memiliki data material.");
  if (ukuran.length === 0) throw new Error("master_material.json tidak memiliki kategori ukuran batu.");

  const masters = {
    laporanHarian: normalizeList(laporanHarian),
    sumberMaterial: normalizeList(sumberMaterial),
    tujuan: normalizeList(tujuan),
    material: materialItems,
    ukuran,
    driver: normalizeList(driver).map((d) => ({
      id: d.id || uid("drv"),
      nama: String(d.nama || "").trim(),
      nopol: String(d.nopol || "").trim().toUpperCase(),
      rental: Boolean(d.rental),
    })),
  };

  if (masters.driver.length === 0) throw new Error("master_driver.json tidak memiliki data driver.");
  return masters;
}

/* ---------------- Helper tampilan ---------------- */

export function findById(list, id) {
  return (list || []).find((item) => item.id === id) || null;
}

export function labelOf(list, id, fallback = "") {
  const found = findById(list, id);
  return found ? found.label || found.nama || "" : fallback;
}

/** Judul laporan sesuai pilihan (termasuk opsi Lainnya). */
export function resolveJudul(masters, info) {
  if (info.laporanId === "lainnya") return String(info.laporanCustom || "").trim().toUpperCase();
  const found = findById(masters.laporanHarian, info.laporanId);
  return found ? found.judul || found.label.toUpperCase() : "";
}

/* ---------------- Tanggal ---------------- */

export function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function isoToDisplay(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

export function displayToISO(display) {
  const value = String(display || "").trim();
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return "";
  const [, d, m, y] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)) return "";
  return `${y}-${m}-${d}`;
}

/* ---------------- Model laporan ---------------- */

export function driverFromMaster(master) {
  return {
    uid: uid("d"),
    driverId: master.id,
    nama: master.nama,
    nopol: master.nopol,
    rental: Boolean(master.rental),
    active: true,
    ritase: 0,
    custom: false,
  };
}

export function emptyMaterialValues() {
  return {};
}

/** Laporan baru: seluruh driver master dimasukkan (aktif, ritase 0). */
export function createEmptyReport(masters, { withDefaults = true } = {}) {
  const tanggal = todayISO();
  const preset = withDefaults ? masters.laporanHarian[0] : null;
  const defaults = preset?.default || {};

  const sumberId = findById(masters.sumberMaterial, defaults.sumberId) ? defaults.sumberId : masters.sumberMaterial[0]?.id || "";
  const tujuanId = findById(masters.tujuan, defaults.tujuanId) ? defaults.tujuanId : masters.tujuan[0]?.id || "";
  const materialId = findById(masters.material, defaults.materialId) ? defaults.materialId : masters.material[0]?.id || "";

  const now = new Date().toISOString();

  return {
    id: uid("lap"),
    createdAt: now,
    updatedAt: now,
    status: "draft",
    info: {
      laporanId: preset?.id || "lainnya",
      laporanCustom: preset ? "" : "",
      tanggal,
      sumberId,
      sumberCustom: "",
      tujuanId,
      tujuanCustom: "",
      materialId,
      materialCustom: "",
      sumber: labelOf(masters.sumberMaterial, sumberId),
      tujuan: labelOf(masters.tujuan, tujuanId),
      material: labelOf(masters.material, materialId),
    },
    drivers: masters.driver.map(driverFromMaster),
    material: { values: emptyMaterialValues() },
  };
}

/**
 * Pastikan bentuk laporan hasil import/draft tetap lengkap
 * (tahan terhadap perubahan master data).
 */
export function normalizeReport(report, masters) {
  if (!report || typeof report !== "object") return createEmptyReport(masters);
  const info = { ...report.info };

  info.laporanId = info.laporanId || "lainnya";
  info.tanggal = /^\d{4}-\d{2}-\d{2}$/.test(info.tanggal || "") ? info.tanggal : todayISO();
  if (!Array.isArray(report.drivers)) report.drivers = [];

  const drivers = report.drivers.map((driver, index) => ({
    uid: driver.uid || uid("d"),
    driverId: driver.driverId || null,
    nama: String(driver.nama || "").trim(),
    nopol: String(driver.nopol || "").trim().toUpperCase(),
    rental: Boolean(driver.rental),
    active: driver.active !== false,
    ritase: Math.max(0, Math.trunc(Number(driver.ritase) || 0)),
    custom: Boolean(driver.custom),
    order: Number.isFinite(driver.order) ? driver.order : index,
  }));

  const values = report.material && report.material.values ? report.material.values : {};

  return {
    ...report,
    id: report.id || uid("lap"),
    info,
    drivers,
    material: { values },
    schemaVersion: 1,
  };
}

/** Nomor dokumen: SJT-20261104-A1B2 */
export function buildDocId(report) {
  const iso = (report.info?.tanggal || todayISO()).replace(/-/g, "");
  const suffix = String(report.id || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-4)
    .toUpperCase();
  return `SJT-${iso}-${suffix || "DRAFT"}`;
}
