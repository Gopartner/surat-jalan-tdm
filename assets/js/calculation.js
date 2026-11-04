/**
 * calculation.js — logika perhitungan murni (tanpa DOM)
 * Semua angka pada aplikasi berasal dari sini, tidak ada total manual.
 */

export const RIT_PATTERN = /^\d+$/;

/** Ubah nilai apa pun menjadi ritase valid (integer >= 0). */
export function clampRit(value) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/** Apakah nilai input masih "belum diisi" (null / "" / bukan angka)? */
export function isBlank(value) {
  return value === null || value === undefined || value === "";
}

/**
 * Normalisasi nilai rincian material.
 * null  = belum diisi (BUKAN nol)
 * 0     = diisi nol
 * >0    = ritase
 */
export function parseMaterialValue(value) {
  if (isBlank(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n < 0 ? 0 : Math.trunc(n);
}

const numberFormat = new Intl.NumberFormat("id-ID");

/** Format angka gaya Indonesia: 1.234 */
export function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return numberFormat.format(n);
}

/** Ringkasan armada + ritase. Hanya driver aktif yang dihitung. */
export function computeRekap(drivers = []) {
  const active = drivers.filter((d) => d.active);
  const totalArmada = active.length;
  const totalRental = active.filter((d) => d.rental).length;
  const grandTotal = active.reduce((sum, d) => sum + clampRit(d.ritase), 0);
  const totalNonAktif = drivers.length - active.length;

  return {
    totalDriver: drivers.length,
    totalArmada,
    totalRental,
    grandTotal,
    totalNonAktif,
  };
}

/**
 * Hitung rincian ukuran batu per driver + subtotal per kategori.
 * @param {Array} drivers  daftar driver laporan (uid, nama, nopol, active, rental, ritase)
 * @param {Array} categories daftar kategori ukuran [{id,label}]
 * @param {Object} values  { [driverUid]: { [categoryId]: number|null } }
 */
export function computeMaterialTotals(drivers = [], categories = [], values = {}) {
  const perDriver = [];
  const subtotals = Object.fromEntries(categories.map((c) => [c.id, 0]));
  const filledPerCategory = Object.fromEntries(categories.map((c) => [c.id, 0]));
  const missing = [];

  let materialTotal = 0;
  let filledCells = 0;
  let expectedCells = 0;

  for (const driver of drivers) {
    const raw = values[driver.uid] || {};
    const rowValues = {};
    let rowTotal = 0;
    let rowFilled = 0;
    let complete = true;

    for (const category of categories) {
      const value = parseMaterialValue(raw[category.id]);
      rowValues[category.id] = value;

      if (value === null) {
        complete = false;
        if (driver.active) {
          missing.push({
            uid: driver.uid,
            nama: driver.nama || "(tanpa nama)",
            categoryId: category.id,
            categoryLabel: category.label,
          });
        }
        continue;
      }

      rowTotal += value;
      rowFilled += 1;

      if (driver.active) {
        subtotals[category.id] += value;
        filledPerCategory[category.id] += 1;
        materialTotal += value;
        filledCells += 1;
      }
    }

    if (driver.active) expectedCells += categories.length;

    perDriver.push({
      uid: driver.uid,
      nama: driver.nama,
      nopol: driver.nopol,
      active: driver.active,
      rental: driver.rental,
      ritase: clampRit(driver.ritase),
      values: rowValues,
      total: rowTotal,
      filled: rowFilled,
      complete,
      missingCount: categories.length - rowFilled,
    });
  }

  const incompleteDrivers = perDriver.filter((d) => d.active && !d.complete);

  return {
    perDriver,
    subtotals,
    filledPerCategory,
    missing,
    materialTotal,
    filledCells,
    expectedCells,
    incompleteDrivers,
    complete: expectedCells === 0 ? false : incompleteDrivers.length === 0,
    categoryCount: categories.length,
  };
}

/** Selisih rincian material vs grand total ritase. */
export function materialDifference(grandTotal, materialTotal) {
  return {
    diff: Number(materialTotal) - Number(grandTotal),
    match: Number(materialTotal) === Number(grandTotal),
  };
}
