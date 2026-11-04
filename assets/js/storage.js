/**
 * storage.js — LocalStorage untuk draft & laporan tersimpan.
 * Master JSON TIDAK pernah ditulis dari sini.
 */

const DRAFT_KEY = "sjt:draft:v1";
const REPORTS_KEY = "sjt:reports:v1";
const SETTINGS_KEY = "sjt:settings:v1";

function storageAvailable() {
  try {
    const probe = "__sjt_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const available = storageAvailable();

function readJSON(key, fallback) {
  if (!available) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  if (!available) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function isStorageAvailable() {
  return available;
}

/** UUID sederhana, cukup unik untuk data laporan lokal. */
export function uid(prefix = "sjt") {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

/* ---------------- Draft ---------------- */

export function saveDraft(report) {
  return writeJSON(DRAFT_KEY, { savedAt: new Date().toISOString(), report });
}

export function loadDraft() {
  const data = readJSON(DRAFT_KEY, null);
  if (!data || !data.report) return null;
  return data;
}

export function clearDraft() {
  if (!available) return false;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
    return true;
  } catch {
    return false;
  }
}

/* ---------------- Laporan tersimpan ---------------- */

export function listReports() {
  const data = readJSON(REPORTS_KEY, {});
  return Object.values(data).sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

export function getReport(id) {
  const data = readJSON(REPORTS_KEY, {});
  return data[id] || null;
}

export function saveReport(report) {
  const data = readJSON(REPORTS_KEY, {});
  const record = { ...report, updatedAt: new Date().toISOString() };
  data[record.id] = record;
  const ok = writeJSON(REPORTS_KEY, data);
  return ok ? record : null;
}

export function deleteReport(id) {
  const data = readJSON(REPORTS_KEY, {});
  if (!data[id]) return false;
  delete data[id];
  return writeJSON(REPORTS_KEY, data);
}

export function countReports() {
  return Object.keys(readJSON(REPORTS_KEY, {})).length;
}

/* ---------------- Import / Export JSON ---------------- */

export function exportBundle() {
  return {
    app: "surat-jalan-tdm",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    reports: listReports(),
    draft: loadDraft(),
  };
}

/**
 * Import laporan dari JSON hasil export.
 * @returns {{imported:number, skipped:number}}
 */
export function importBundle(payload, { replace = false } = {}) {
  if (!payload || typeof payload !== "object") throw new Error("Struktur JSON tidak dikenali.");

  const incoming = Array.isArray(payload.reports) ? payload.reports : Array.isArray(payload) ? payload : null;
  if (!incoming) throw new Error("File JSON tidak memuat daftar laporan.");

  const current = replace ? {} : readJSON(REPORTS_KEY, {});
  let imported = 0;
  let skipped = 0;

  for (const report of incoming) {
    if (!report || !report.info || !Array.isArray(report.drivers)) {
      skipped += 1;
      continue;
    }
    const id = report.id || uid("lap");
    current[id] = {
      ...report,
      id,
      updatedAt: report.updatedAt || new Date().toISOString(),
      importedAt: new Date().toISOString(),
    };
    imported += 1;
  }

  writeJSON(REPORTS_KEY, current);
  return { imported, skipped };
}

/* ---------------- Pengaturan kecil ---------------- */

export function getSettings() {
  return readJSON(SETTINGS_KEY, { sementara: false });
}

export function saveSettings(patch) {
  return writeJSON(SETTINGS_KEY, { ...getSettings(), ...patch });
}
