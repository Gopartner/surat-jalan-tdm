/**
 * app.js — orkestrator aplikasi SURAT JALAN TDM
 * Menghubungkan master data JSON, state laporan, storage, dan UI.
 */

import {
  loadMasterData,
  createEmptyReport,
  normalizeReport,
  resolveJudul,
  labelOf,
  isoToDisplay,
  displayToISO,
  buildDocId,
  driverFromMaster,
  todayISO,
} from "./master-data.js";
import { computeRekap, computeMaterialTotals, formatNumber, clampRit } from "./calculation.js";
import { validateReport, formatTanggal } from "./validation.js";
import { DriverSection } from "./driver.js";
import { MaterialSection } from "./material.js";
import { buildReportText } from "./report-text.js";
import { downloadText, copyText, downloadPdf, hasPdfLibrary, printReport, buildPrintHtml } from "./export.js";
import * as storage from "./storage.js";
import { qs, escapeHtml, debounce, timestampID, downloadFile } from "./dom.js";

/* ---------------- State ---------------- */

const state = {
  masters: null,
  report: null,
  rekap: null,
  material: null,
  validation: null,
  ui: { sementara: false, ready: false, liveCollapsed: false },
};

let driverSection = null;
let materialSection = null;

const el = (id) => document.getElementById(id);

const ICON = { ok: "✓", warn: "!", err: "✕" };

/* ---------------- Toast ---------------- */

function toast(message, kind = "info") {
  const root = el("toast-root");
  if (!root) return;
  const node = document.createElement("div");
  node.className = `toast is-${kind}`;
  node.innerHTML = message;
  root.appendChild(node);
  setTimeout(() => {
    node.style.opacity = "0";
    node.style.transition = "opacity .2s ease";
    setTimeout(() => node.remove(), 220);
  }, 3200);
}

function setSaveState(kind) {
  const node = el("save-state");
  if (!node) return;
  const label = { saved: "Draft tersimpan", saving: "Menyimpan…", error: "Gagal menyimpan" };
  node.dataset.state = kind;
  node.textContent = label[kind] || label.saved;
}

/* ---------------- Inisialisasi ---------------- */

async function init() {
  wireStaticEvents();

  try {
    state.masters = await loadMasterData();
  } catch (error) {
    showFatal(error.message);
    return;
  }

  state.ui.sementara = Boolean(storage.getSettings().sementara);
  el("chk-sementara").checked = state.ui.sementara;
  state.ui.liveCollapsed = Boolean(storage.getSettings().liveCollapsed);
  applyLiveCollapsed();

  populateSelects();

  const draft = storage.loadDraft();
  state.report = draft && draft.report ? normalizeReport(draft.report, state.masters) : createEmptyReport(state.masters);

  setupSections();
  syncInfoInputs();
  renderAll();

  if (draft && draft.report) {
    toast("Draft terakhir dipulihkan dari penyimpanan lokal.", "ok");
  }
  if (!storage.isStorageAvailable()) {
    toast("LocalStorage tidak tersedia — draft tidak akan tersimpan otomatis.", "warn");
  }

  updateSavedCount();
  state.ui.ready = true;
  window.__SJT__.state = state;
  document.dispatchEvent(new CustomEvent("sjt:ready"));
}

function showFatal(message) {
  const box = el("load-error");
  const text = el("load-error-text");
  if (box && text) {
    text.innerHTML = `<strong>Tidak dapat memuat data master.</strong><br />${escapeHtml(message)}<br /><br />
      Jalankan lewat web server lokal, contoh:<br /><code>python -m http.server 8000</code>
      lalu buka <code>http://localhost:8000/</code>.`;
    box.hidden = false;
  }
  toast("Data master gagal dimuat.", "err");
}

function populateSelects() {
  const { masters } = state;
  const options = (items, labelKey, withLainnya = true) => {
    const opts = items.map(
      (item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item[labelKey] || item.label || item.nama)}</option>`
    );
    if (withLainnya) opts.push('<option value="lainnya">Lainnya…</option>');
    return opts.join("");
  };

  el("laporan-select").innerHTML = options(masters.laporanHarian, "label");
  el("sumber-select").innerHTML = options(masters.sumberMaterial, "label");
  el("tujuan-select").innerHTML = options(masters.tujuan, "label");
  el("material-select").innerHTML = options(masters.material, "label");
}

function setupSections() {
  driverSection = new DriverSection({
    container: el("driver-grid"),
    callbacks: {
      onRitase: () => {
        refreshDerived();
        scheduleSave();
      },
      onIdentity: () => {
        materialSection?.syncNames(state.report.drivers);
        refreshDerived();
        scheduleSave();
      },
      onToggleActive: (driver) => {
        driverSection.render();
        renderMaterial();
        refreshDerived();
        scheduleSave();
      },
      onToggleRental: (driver) => {
        driverSection.syncCard(driver);
        refreshDerived();
        scheduleSave();
      },
      onRemove: (driver) => removeDriver(driver),
    },
  });
  driverSection.setDrivers(state.report.drivers);

  materialSection = new MaterialSection({
    tbody: el("material-tbody"),
    tfoot: el("material-tfoot"),
    theadRow: el("material-thead-row"),
    categories: state.masters.ukuran,
    callbacks: {
      onValue: (uid) => {
        refreshDerived();
        materialSection.syncRow(uid, state.material);
        scheduleSave();
      },
    },
  });
  materialSection.setData(state.report.drivers, state.report.material.values);
}

/* ---------------- Info laporan ---------------- */

function resolveInfoStrings() {
  const info = state.report.info;
  const { masters } = state;

  info.sumber = info.sumberId === "lainnya" ? String(info.sumberCustom || "").trim() : labelOf(masters.sumberMaterial, info.sumberId);
  info.tujuan = info.tujuanId === "lainnya" ? String(info.tujuanCustom || "").trim() : labelOf(masters.tujuan, info.tujuanId);
  info.material =
    info.materialId === "lainnya" ? String(info.materialCustom || "").trim() : labelOf(masters.material, info.materialId);
  info.judul = resolveJudul(masters, info);
}

function syncInfoInputs() {
  const info = state.report.info;

  el("laporan-select").value = info.laporanId || "lainnya";
  el("laporan-custom").value = info.laporanCustom || "";
  el("laporan-custom").hidden = info.laporanId !== "lainnya";

  el("tanggal-display").value = isoToDisplay(info.tanggal);
  el("tanggal-picker").value = info.tanggal || todayISO();

  el("sumber-select").value = info.sumberId || "lainnya";
  el("sumber-custom").value = info.sumberCustom || "";
  el("sumber-custom").hidden = info.sumberId !== "lainnya";

  el("tujuan-select").value = info.tujuanId || "lainnya";
  el("tujuan-custom").value = info.tujuanCustom || "";
  el("tujuan-custom").hidden = info.tujuanId !== "lainnya";

  el("material-select").value = info.materialId || "lainnya";
  el("material-custom").value = info.materialCustom || "";
  el("material-custom").hidden = info.materialId !== "lainnya";

  resolveInfoStrings();
}

function applyDefaultsForType(laporanId) {
  const preset = state.masters.laporanHarian.find((item) => item.id === laporanId);
  if (!preset || !preset.default) return;
  const info = state.report.info;

  if (preset.default.sumberId && state.masters.sumberMaterial.some((s) => s.id === preset.default.sumberId)) {
    info.sumberId = preset.default.sumberId;
    info.sumberCustom = "";
  }
  if (preset.default.tujuanId && state.masters.tujuan.some((t) => t.id === preset.default.tujuanId)) {
    info.tujuanId = preset.default.tujuanId;
    info.tujuanCustom = "";
  }
  if (preset.default.materialId && state.masters.material.some((m) => m.id === preset.default.materialId)) {
    info.materialId = preset.default.materialId;
    info.materialCustom = "";
  }
}

function maskTanggal(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

/* ---------------- Render ---------------- */

function renderAll() {
  driverSection?.setDrivers(state.report.drivers);
  renderMaterial();
  refreshDerived();
  updateSavedCount();
}

function renderMaterial() {
  materialSection?.setData(state.report.drivers, state.report.material.values);
}

function refreshDerived() {
  const { report, masters } = state;
  if (!report) return;

  resolveInfoStrings();

  state.rekap = computeRekap(report.drivers);
  state.material = computeMaterialTotals(report.drivers, masters.ukuran, report.material.values);
  state.validation = validateReport(report, masters);

  renderRekap();
  renderMaterialStatus();
  renderValidation();
  renderPreview();
  renderLive();
}

function renderRekap() {
  const { rekap } = state;
  const totalRitase = state.report.drivers.reduce((sum, driver) => sum + clampRit(driver.ritase), 0);

  el("rekap-armada").textContent = formatNumber(rekap.totalArmada);
  el("rekap-rental").textContent = formatNumber(rekap.totalRental);
  el("rekap-total-ritase").textContent = formatNumber(totalRitase);
  el("rekap-grand").textContent = formatNumber(rekap.grandTotal);

  const count = el("driver-count");
  if (count) {
    const nonAktif = rekap.totalNonAktif > 0 ? ` · ${rekap.totalNonAktif} nonaktif` : "";
    count.textContent = `${rekap.totalArmada} aktif${nonAktif}`;
  }
}

function renderMaterialStatus() {
  const pill = el("material-status");
  const { material, rekap } = state;
  if (!pill) return;

  let label = "Belum lengkap";
  let cls = "status-incomplete";

  if (material.complete) {
    if (material.materialTotal === rekap.grandTotal) {
      label = "Lengkap & sesuai";
      cls = "status-valid";
    } else {
      label = "Lengkap, tidak sesuai";
      cls = "status-mismatch";
    }
  } else if (material.expectedCells > 0) {
    label = `Belum lengkap (${material.incompleteDrivers.length} driver)`;
  }

  pill.textContent = label;
  pill.className = `status-pill ${cls}`;

  const note = el("material-note");
  if (note) {
    const total = material.expectedCells
      ? `Total rincian <strong>${formatNumber(material.materialTotal)} rit</strong> · Grand total <strong>${formatNumber(
          rekap.grandTotal
        )} rit</strong>.`
      : "Belum ada driver aktif.";
    note.innerHTML = `${total} Kosong berarti <strong>belum diisi</strong> (bukan nol).`;
  }
}

function renderValidation() {
  const { validation } = state;
  const pill = el("validasi-pill");
  const list = el("validasi-list");
  const summary = el("validasi-summary");
  if (!pill || !list) return;

  const cls = `status-pill status-${validation.status === "valid" ? "valid" : validation.status === "incomplete" ? "incomplete" : "mismatch"}`;
  pill.className = cls;
  pill.textContent = validation.label;

  if (summary) {
    const parts = [];
    parts.push(`${validation.errors} kesalahan`);
    parts.push(`${validation.warnings} peringatan`);
    summary.textContent = `Status ${validation.label} — ${parts.join(" · ")}.`;
  }

  list.innerHTML = validation.items
    .map((check) => {
      const kind = check.level === "ok" ? "is-ok" : check.level === "warn" ? "is-warn" : "is-err";
      return `<li class="check-item ${kind}">
        <span class="check-mark">${ICON[check.level] || "•"}</span>
        <div>
          <strong>${escapeHtml(check.title)}</strong>
          ${check.detail ? `<span class="check-detail">${escapeHtml(check.detail)}</span>` : ""}
        </div>
      </li>`;
    })
    .join("");
}

function buildCtx() {
  const { report, masters, rekap, material, validation } = state;
  const judul = resolveJudul(masters, report.info) || "Laporan Harian";
  return {
    judul,
    rekap,
    material,
    validation,
    categories: masters.ukuran,
    docId: buildDocId(report),
    timestamp: timestampID(),
    tanggalLabel: formatTanggal(report.info.tanggal) || "--/--/----",
    catatan: validation.status === "valid" ? "" : "Laporan sementara - validasi belum lengkap.",
  };
}

function renderPreview() {
  const ctx = buildCtx();
  const text = buildReportText(state.report, ctx);
  el("preview-text").textContent = text;

  const status = el("preview-status");
  status.className = `status-pill status-${
    ctx.validation.status === "valid" ? "valid" : ctx.validation.status === "incomplete" ? "incomplete" : "mismatch"
  }`;
  status.textContent = ctx.validation.label;

  el("preview-docid").textContent = ctx.docId;
  el("preview-updated").textContent = `Diperbarui ${new Date().toLocaleTimeString("id-ID")}`;
}

/* ---------------- Ringkasan live ---------------- */

function statusClass(status) {
  const kind = status === "valid" ? "valid" : status === "incomplete" ? "incomplete" : "mismatch";
  return `status-pill status-${kind}`;
}

function applyLiveCollapsed() {
  const dock = el("live-dock");
  if (!dock) return;
  dock.classList.toggle("is-collapsed", state.ui.liveCollapsed);
  el("live-toggle")?.setAttribute("aria-expanded", String(!state.ui.liveCollapsed));
}

function setLiveValue(id, value) {
  const node = el(id);
  if (!node) return;
  const text = formatNumber(value);
  if (node.textContent === text) return;
  node.textContent = text;
  node.classList.remove("is-bump");
  void node.offsetWidth;
  node.classList.add("is-bump");
}

/** Angka pada dock diperbarui setiap kali input berubah (real-time, tanpa tombol). */
function renderLive() {
  const { report, rekap, material, validation } = state;
  if (!report || !rekap || !material || !validation) return;

  const totalRitase = report.drivers.reduce((sum, driver) => sum + clampRit(driver.ritase), 0);

  setLiveValue("live-armada", rekap.totalArmada);
  setLiveValue("live-ritase", totalRitase);
  setLiveValue("live-grand", rekap.grandTotal);

  const status = el("live-status");
  if (status) {
    status.className = statusClass(validation.status);
    status.textContent = validation.label;
  }

  const hint = el("live-hint");
  if (hint) {
    if (!material.expectedCells) {
      hint.textContent = "Belum ada driver aktif";
    } else if (!material.complete) {
      const missing = material.expectedCells - material.filledCells;
      hint.textContent = `${formatNumber(missing)} sel material kosong`;
    } else {
      const diff = material.materialTotal - rekap.grandTotal;
      hint.textContent = diff === 0 ? "Material sesuai" : `Selisih ${formatNumber(Math.abs(diff))} rit`;
    }
  }

  const time = el("live-time");
  if (time) time.textContent = new Date().toLocaleTimeString("id-ID");
}

/* ---------------- Simpan draft ---------------- */

const scheduleSave = debounce(() => {
  const report = state.report;
  if (!report) return;
  setSaveState("saving");
  report.updatedAt = new Date().toISOString();
  const ok = storage.saveDraft(report);
  setSaveState(ok ? "saved" : "error");
  if (!ok) toast("Gagal menyimpan draft ke LocalStorage.", "err");
}, 500);

/* ---------------- Aksi driver ---------------- */

async function removeDriver(driver) {
  if (state.report.drivers.length <= 1) {
    toast("Minimal harus ada satu driver dalam laporan.", "warn");
    return;
  }
  const ok = await modalConfirm({
    title: "Hapus driver",
    message: `Hapus <strong>${escapeHtml(driver.nama || "driver tanpa nama")}</strong> dari laporan ini? Data ritase dan rincian materialnya akan ikut dihapus dari laporan.`,
    confirmLabel: "Hapus driver",
    danger: true,
  });
  if (!ok) return;

  state.report.drivers = state.report.drivers.filter((d) => d.uid !== driver.uid);
  if (state.report.material.values) delete state.report.material.values[driver.uid];

  renderAll();
  scheduleSave();
  toast("Driver dihapus dari laporan.", "ok");
}

function openAddDriverModal() {
  const root = el("modal-root");
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Tambah driver">
      <div class="modal-head">
        <h3>Tambah Driver</h3>
        <button type="button" class="icon-btn" data-modal="close" aria-label="Tutup">✕</button>
      </div>
      <form class="modal-body" id="add-driver-form">
        <label class="field">
          <span class="field-label">Nama Driver</span>
          <input class="control" id="new-driver-nama" type="text" placeholder="Nama driver" autocomplete="off" required />
        </label>
        <label class="field">
          <span class="field-label">Nomor Polisi</span>
          <input class="control" id="new-driver-nopol" type="text" placeholder="DR 0000 XX" autocomplete="off" required />
        </label>
        <label class="field-note" style="display:flex; gap:8px; align-items:center">
          <input type="checkbox" id="new-driver-rental" />
          <span>Tandai sebagai armada rental</span>
        </label>
        <p class="field-note">Driver baru hanya ditambahkan ke laporan ini, bukan ke <code>master_driver.json</code>.</p>
      </form>
      <div class="modal-foot">
        <button type="button" class="btn btn-secondary" data-modal="close">Batal</button>
        <button type="submit" class="btn btn-primary" form="add-driver-form">Tambah Driver</button>
      </div>
    </div>`;

  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) return close();
    if (event.target.closest('[data-modal="close"]')) close();
  });

  backdrop.querySelector("#add-driver-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const nama = backdrop.querySelector("#new-driver-nama").value.trim();
    const nopol = backdrop.querySelector("#new-driver-nopol").value.trim().toUpperCase();
    const rental = backdrop.querySelector("#new-driver-rental").checked;

    if (!nama || !nopol) {
      toast("Nama dan nomor polisi wajib diisi.", "warn");
      return;
    }

    const driver = driverFromMaster({ id: null, nama, nopol, rental });
    driver.custom = true;
    state.report.drivers.push(driver);
    close();
    renderAll();
    scheduleSave();
    toast(`Driver ${escapeHtml(nama)} ditambahkan.`, "ok");
  });

  root.appendChild(backdrop);
  backdrop.querySelector("#new-driver-nama").focus();
}

/* ---------------- Modal generik ---------------- */

function modalConfirm({ title = "Konfirmasi", message = "", confirmLabel = "Ya", cancelLabel = "Batal", danger = false }) {
  return new Promise((resolve) => {
    const root = el("modal-root");
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>${escapeHtml(title)}</h3>
          <button type="button" class="icon-btn" data-modal="close" aria-label="Tutup">✕</button>
        </div>
        <div class="modal-body"><p class="modal-text">${message}</p></div>
        <div class="modal-foot">
          <button type="button" class="btn btn-secondary" data-modal="cancel">${escapeHtml(cancelLabel)}</button>
          <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-modal="ok">${escapeHtml(
      confirmLabel
    )}</button>
        </div>
      </div>`;

    const finish = (value) => {
      document.removeEventListener("keydown", onKey);
      backdrop.remove();
      resolve(value);
    };
    const onKey = (event) => {
      if (event.key === "Escape") finish(false);
    };

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) return finish(false);
      const action = event.target.closest("[data-modal]")?.dataset.modal;
      if (action === "ok") finish(true);
      if (action === "cancel" || action === "close") finish(false);
    });
    document.addEventListener("keydown", onKey);

    root.appendChild(backdrop);
    backdrop.querySelector('[data-modal="ok"]').focus();
  });
}

/* ---------------- Event binding ---------------- */

function bindSelect(selectId, customId, key) {
  const select = el(selectId);
  const custom = el(customId);

  select.addEventListener("change", (event) => {
    const value = event.target.value;
    state.report.info[`${key}Id`] = value;
    const isCustom = value === "lainnya";
    custom.hidden = !isCustom;
    if (!isCustom) {
      state.report.info[`${key}Custom`] = "";
      custom.value = "";
      custom.classList.remove("is-invalid");
    } else {
      custom.focus();
    }
    refreshDerived();
    scheduleSave();
  });

  custom.addEventListener("input", (event) => {
    state.report.info[`${key}Custom`] = event.target.value;
    refreshDerived();
    scheduleSave();
  });
}

function wireStaticEvents() {
  /* Jenis laporan */
  el("laporan-select").addEventListener("change", (event) => {
    const value = event.target.value;
    state.report.info.laporanId = value;
    el("laporan-custom").hidden = value !== "lainnya";

    if (value === "lainnya") {
      state.report.info.laporanCustom = el("laporan-custom").value || "";
      el("laporan-custom").focus();
    } else {
      state.report.info.laporanCustom = "";
      el("laporan-custom").value = "";
      applyDefaultsForType(value);
      syncInfoInputs();
    }
    refreshDerived();
    scheduleSave();
  });

  el("laporan-custom").addEventListener("input", (event) => {
    state.report.info.laporanCustom = event.target.value;
    refreshDerived();
    scheduleSave();
  });

  /* Tanggal */
  const tanggalDisplay = el("tanggal-display");
  tanggalDisplay.addEventListener("input", (event) => {
    const masked = maskTanggal(event.target.value);
    event.target.value = masked;
    const iso = displayToISO(masked);
    state.report.info.tanggal = iso;
    el("tanggal-picker").value = iso || "";
    tanggalDisplay.classList.toggle("is-invalid", masked.length === 10 && !iso);
    refreshDerived();
    scheduleSave();
  });
  tanggalDisplay.addEventListener("blur", () => {
    if (tanggalDisplay.value.length === 10 && !displayToISO(tanggalDisplay.value)) {
      toast("Tanggal tidak valid. Gunakan format DD-MM-YYYY.", "warn");
    }
  });

  el("btn-tanggal-picker").addEventListener("click", () => {
    const picker = el("tanggal-picker");
    picker.value = state.report.info.tanggal || todayISO();
    if (typeof picker.showPicker === "function") {
      try {
        picker.showPicker();
        return;
      } catch {
        /* fallback */
      }
    }
    picker.hidden = false;
    picker.focus();
    picker.click();
  });

  el("tanggal-picker").addEventListener("change", (event) => {
    const iso = event.target.value;
    state.report.info.tanggal = iso;
    tanggalDisplay.value = isoToDisplay(iso);
    tanggalDisplay.classList.remove("is-invalid");
    event.target.hidden = true;
    refreshDerived();
    scheduleSave();
  });

  /* Sumber / tujuan / material */
  bindSelect("sumber-select", "sumber-custom", "sumber");
  bindSelect("tujuan-select", "tujuan-custom", "tujuan");
  bindSelect("material-select", "material-custom", "material");

  /* Ringkasan live (bisa diciutkan) */
  el("live-toggle")?.addEventListener("click", () => {
    state.ui.liveCollapsed = !state.ui.liveCollapsed;
    storage.saveSettings({ liveCollapsed: state.ui.liveCollapsed });
    applyLiveCollapsed();
  });

  /* Driver */
  el("btn-add-driver").addEventListener("click", openAddDriverModal);

  /* Aksi laporan */
  el("btn-save").addEventListener("click", saveCurrentReport);
  el("btn-reset").addEventListener("click", resetForm);
  el("btn-copy").addEventListener("click", handleCopy);
  el("btn-txt").addEventListener("click", handleDownloadTxt);
  el("btn-pdf").addEventListener("click", handleDownloadPdf);
  el("btn-print").addEventListener("click", handlePrint);
  el("btn-open-saved").addEventListener("click", openSavedModal);

  /* Mobile bar */
  el("btn-m-preview").addEventListener("click", () => {
    el("preview-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  el("btn-m-pdf").addEventListener("click", handleDownloadPdf);
  el("btn-m-txt").addEventListener("click", handleDownloadTxt);
  el("btn-m-save").addEventListener("click", saveCurrentReport);

  /* JSON */
  el("btn-export-json").addEventListener("click", handleExportJson);
  el("btn-import-json").addEventListener("click", () => el("file-import").click());
  el("file-import").addEventListener("change", handleImportJson);

  /* Mode sementara */
  el("chk-sementara").addEventListener("change", (event) => {
    state.ui.sementara = event.target.checked;
    storage.saveSettings({ sementara: state.ui.sementara });
    toast(
      state.ui.sementara
        ? "Export laporan sementara diizinkan."
        : "Export hanya diizinkan untuk laporan valid.",
      state.ui.sementara ? "warn" : "ok"
    );
  });

  /* Print via Ctrl+P */
  window.addEventListener("beforeprint", () => {
    if (!state.report || !state.rekap) return;
    try {
      el("print-root").innerHTML = buildPrintHtml(state.report, ctxFor(state.report));
    } catch {
      /* diamkan */
    }
  });
}

/* ---------------- Aksi export ---------------- */

function ctxFor(report) {
  const rekap = computeRekap(report.drivers);
  const material = computeMaterialTotals(report.drivers, state.masters.ukuran, report.material?.values);
  const validation = validateReport(report, state.masters);
  return {
    judul: resolveJudul(state.masters, report.info) || "Laporan Harian",
    rekap,
    material,
    validation,
    categories: state.masters.ukuran,
    docId: buildDocId(report),
    timestamp: timestampID(),
    tanggalLabel: formatTanggal(report.info.tanggal) || "--/--/----",
    catatan: validation.status === "valid" ? "" : "Laporan sementara - validasi belum lengkap.",
  };
}

async function guardExport() {
  if (state.validation.status === "valid") return true;
  if (state.ui.sementara) return true;

  return modalConfirm({
    title: "Laporan belum valid",
    message: `Status validasi saat ini: <strong>${escapeHtml(state.validation.label)}</strong>.
      ${state.validation.errors} kesalahan, ${state.validation.warnings} peringatan.<br /><br />
      Export laporan final sebaiknya dilakukan setelah data lengkap. Anda tetap bisa melanjutkan
      sebagai <strong>laporan sementara</strong>, atau aktifkan opsi "Izinkan export laporan sementara".`,
    confirmLabel: "Tetap export (sementara)",
    cancelLabel: "Periksa dulu",
    danger: true,
  });
}

async function handleCopy() {
  try {
    const ok = await copyText(buildReportText(state.report, ctxFor(state.report)));
    toast(ok ? "Teks laporan disalin ke clipboard." : "Gagal menyalin. Gunakan Download TXT.", ok ? "ok" : "err");
  } catch (error) {
    toast(`Gagal menyalin: ${escapeHtml(error.message)}`, "err");
  }
}

async function handleDownloadTxt() {
  try {
    if (!(await guardExport())) return;
    const report = state.report;
    downloadText(report, ctxFor(report));
    toast("Laporan TXT berhasil diunduh.", "ok");
  } catch (error) {
    toast(`Gagal membuat TXT: ${escapeHtml(error.message)}`, "err");
  }
}

async function handleDownloadPdf() {
  try {
    if (!(await guardExport())) return;
    const report = state.report;
    const ctx = ctxFor(report);

    if (!hasPdfLibrary()) {
      toast("Pustaka PDF tidak tersedia — membuka dialog print (pilih Save as PDF).", "warn");
      printReport(report, ctx);
      return;
    }
    downloadPdf(report, ctx);
    toast("PDF berhasil dibuat.", "ok");
  } catch (error) {
    toast(`Gagal membuat PDF: ${escapeHtml(error.message)}`, "err");
  }
}

async function handlePrint() {
  try {
    if (!(await guardExport())) return;
    printReport(state.report, ctxFor(state.report));
  } catch (error) {
    toast(`Gagal membuka dialog print: ${escapeHtml(error.message)}`, "err");
  }
}

/* ---------------- Simpan / muat laporan ---------------- */

function updateSavedCount() {
  const badge = el("saved-count");
  if (badge) badge.textContent = String(storage.countReports());
}

function saveCurrentReport() {
  try {
    const report = state.report;
    report.status = state.validation.status === "valid" ? "final" : "draft";
    const saved = storage.saveReport(report);
    if (!saved) {
      toast("Gagal menyimpan laporan.", "err");
      return;
    }
    storage.saveDraft(report);
    updateSavedCount();
    toast(
      report.status === "final"
        ? `Laporan ${escapeHtml(buildDocId(report))} disimpan (final).`
        : `Laporan ${escapeHtml(buildDocId(report))} disimpan sebagai draft.`,
      "ok"
    );
  } catch (error) {
    toast(`Gagal menyimpan: ${escapeHtml(error.message)}`, "err");
  }
}

async function resetForm() {
  const ok = await modalConfirm({
    title: "Reset form",
    message:
      "Seluruh isian pada form akan dikosongkan dan draft saat ini dihapus dari penyimpanan lokal.<br /><br />" +
      "Laporan yang <strong>sudah disimpan</strong> tidak ikut terhapus.",
    confirmLabel: "Reset sekarang",
    danger: true,
  });
  if (!ok) return;

  storage.clearDraft();
  state.report = createEmptyReport(state.masters);
  syncInfoInputs();
  renderAll();
  scheduleSave();
  toast("Form berhasil direset.", "ok");
}

function openSavedModal() {
  const reports = storage.listReports();
  const root = el("modal-root");
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";

  const items = reports.length
    ? `<div class="saved-list">${reports
        .map((report) => {
          const judul = resolveJudul(state.masters, report.info || {}) || "Laporan";
          const tanggal = formatTanggal(report.info?.tanggal) || "--/--/----";
          const total = computeRekap(report.drivers || []).grandTotal;
          const updated = report.updatedAt ? new Date(report.updatedAt).toLocaleString("id-ID") : "-";
          return `<div class="saved-item" data-id="${escapeHtml(report.id)}">
            <div>
              <div class="saved-item-title">${escapeHtml(judul)} · ${escapeHtml(tanggal)}</div>
              <div class="saved-item-meta">${escapeHtml(buildDocId(report))} · ${formatNumber(total)} rit · ${
            report.status === "final" ? "final" : "draft"
          } · ${escapeHtml(updated)}</div>
            </div>
            <div class="saved-item-actions">
              <button type="button" class="btn btn-sm btn-primary" data-saved="open">Buka</button>
              <button type="button" class="btn btn-sm btn-secondary" data-saved="txt">TXT</button>
              <button type="button" class="btn btn-sm btn-danger" data-saved="delete">Hapus</button>
            </div>
          </div>`;
        })
        .join("")}</div>`
    : `<div class="empty-state">Belum ada laporan tersimpan.<br />Gunakan tombol <strong>Simpan Laporan</strong> untuk menyimpan.</div>`;

  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Laporan tersimpan">
      <div class="modal-head">
        <h3>Laporan Tersimpan</h3>
        <button type="button" class="icon-btn" data-modal="close" aria-label="Tutup">✕</button>
      </div>
      <div class="modal-body">${items}</div>
      <div class="modal-foot">
        <span class="card-hint spacer">${reports.length} laporan</span>
        <button type="button" class="btn btn-secondary" data-modal="close">Tutup</button>
      </div>
    </div>`;

  const close = () => backdrop.remove();

  backdrop.addEventListener("click", async (event) => {
    if (event.target === backdrop) return close();
    if (event.target.closest('[data-modal="close"]')) return close();

    const button = event.target.closest("[data-saved]");
    if (!button) return;
    const item = button.closest("[data-id]");
    const id = item?.dataset.id;
    const report = storage.getReport(id);
    if (!report) return;

    if (button.dataset.saved === "open") {
      state.report = normalizeReport(report, state.masters);
      syncInfoInputs();
      renderAll();
      close();
      scheduleSave();
      toast(`Laporan ${escapeHtml(buildDocId(report))} dibuka.`, "ok");
    } else if (button.dataset.saved === "txt") {
      const normalized = normalizeReport(report, state.masters);
      downloadText(normalized, ctxFor(normalized));
      toast("TXT laporan tersimpan berhasil diunduh.", "ok");
    } else if (button.dataset.saved === "delete") {
      const ok = await modalConfirm({
        title: "Hapus laporan",
        message: `Hapus laporan <strong>${escapeHtml(buildDocId(report))}</strong> secara permanen?`,
        confirmLabel: "Hapus",
        danger: true,
      });
      if (!ok) return;
      storage.deleteReport(id);
      updateSavedCount();
      close();
      openSavedModal();
      toast("Laporan dihapus.", "ok");
    }
  });

  root.appendChild(backdrop);
}

/* ---------------- JSON backup ---------------- */

function handleExportJson() {
  try {
    const bundle = storage.exportBundle();
    const stamp = todayISO().replace(/-/g, "");
    downloadFile(JSON.stringify(bundle, null, 2), `surat-jalan-tdm-backup-${stamp}.json`, "application/json");
    toast("Backup JSON berhasil diunduh.", "ok");
  } catch (error) {
    toast(`Gagal export JSON: ${escapeHtml(error.message)}`, "err");
  }
}

async function handleImportJson(event) {
  const input = event.target;
  const file = input.files && input.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const result = storage.importBundle(payload);
    updateSavedCount();
    toast(`Import selesai: ${result.imported} laporan, ${result.skipped} dilewati.`, "ok");
  } catch (error) {
    toast(`Import gagal: ${escapeHtml(error.message)}`, "err");
  } finally {
    input.value = "";
  }
}

/* ---------------- Boot ---------------- */

window.__SJT__ = window.__SJT__ || {};
window.__SJT__.state = state;
window.__SJT__.api = {
  getState: () => state,
  ctxFor,
  renderAll,
  refreshDerived,
  scheduleSave,
  toast,
  saveCurrentReport,
  openSavedModal,
  resetForm,
  computeRekap,
  computeMaterialTotals,
};
window.__SJT__.ready = init().catch((error) => {
  console.error(error);
  showFatal(error.message || "Terjadi kesalahan tak terduga.");
});

