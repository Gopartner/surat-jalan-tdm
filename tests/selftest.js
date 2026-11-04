/**
 * tests/selftest.js — harness pengujian end-to-end di browser.
 * Aktif hanya jika halaman dibuka dengan ?selftest=1
 */

const results = [];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

window.__SJT_ERRORS__ = window.__SJT_ERRORS__ || [];
window.addEventListener("error", (event) => window.__SJT_ERRORS__.push(String(event.message)));
window.addEventListener("unhandledrejection", (event) => window.__SJT_ERRORS__.push(String(event.reason)));

function q(selector) {
  return document.querySelector(selector);
}

function qa(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function click(node) {
  node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
}

function setValue(node, value) {
  node.value = value;
  node.dispatchEvent(new Event("input", { bubbles: true }));
  // <select> mengandalkan event change, input teks memakai event input
  if (node.tagName === "SELECT") node.dispatchEvent(new Event("change", { bubbles: true }));
}

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) console.error(`✕ ${name} — ${detail}`);
}

function check(name, fn) {
  try {
    const outcome = fn();
    if (outcome === false) record(name, false, "assertion gagal");
    else record(name, true);
  } catch (error) {
    record(name, false, error.message);
  }
}

async function checkAsync(name, fn) {
  try {
    const outcome = await fn();
    if (outcome === false) record(name, false, "assertion gagal");
    else record(name, true);
  } catch (error) {
    record(name, false, error.message);
  }
}

async function waitForApp() {
  for (let i = 0; i < 100; i += 1) {
    if (window.__SJT__ && window.__SJT__.ready) {
      await window.__SJT__.ready;
      return true;
    }
    await wait(100);
  }
  return false;
}

function done() {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  const lines = results.map((r) => `${r.ok ? "PASS" : "FAIL"} :: ${r.name}${r.detail ? ` :: ${r.detail}` : ""}`);
  const summary = `SELFTEST ${failed === 0 ? "PASS" : "FAIL"} ${passed}/${results.length}`;

  const pre = document.createElement("pre");
  pre.id = "selftest-output";
  pre.style.cssText = "position:fixed;left:0;top:0;z-index:9999;background:#fff;color:#111;font-size:11px;max-height:100vh;overflow:auto;margin:0;padding:8px;border:2px solid #0f2f52";
  pre.textContent = [summary, ...lines].join("\n");
  document.body.appendChild(pre);
  document.title = summary;
  window.__SELFTEST__ = { summary, passed, failed, results };
  console.log(summary);
}

async function run() {
  const ready = await waitForApp();
  record("Aplikasi siap (app.js termuat)", ready);
  if (!ready) return done();

  const api = window.__SJT__.api;
  const state = api.getState();

  await wait(300);

  /* 1. Dropdown dari JSON */
  check("master data termuat dari JSON", () => Boolean(state.masters && state.masters.driver.length === 8));
  check("dropdown jenis laporan terisi", () => q("#laporan-select").options.length >= 5);
  check("dropdown sumber material terisi", () => q("#sumber-select").options.length >= 6);
  check("dropdown tujuan terisi", () => q("#tujuan-select").options.length >= 6);
  check("dropdown material terisi", () => q("#material-select").options.length >= 6);
  check("opsi Lainnya tersedia di setiap dropdown", () =>
    ["#laporan-select", "#sumber-select", "#tujuan-select", "#material-select"].every((sel) =>
      Array.from(q(sel).options).some((option) => option.value === "lainnya")
    )
  );

  /* 2. Kartu driver */
  check("8 kartu driver dirender", () => qa(".driver-card").length === 8);
  check("nomor polisi dari master tampil", () => document.body.textContent.includes("DR 8641 KC"));
  check("grand total awal 0", () => q("#rekap-grand").textContent === "0");

  /* 3. Tombol + dan - */
  const card1 = qa(".driver-card")[0];
  click(card1.querySelector('[data-action="inc"]'));
  click(card1.querySelector('[data-action="inc"]'));
  click(card1.querySelector('[data-action="inc"]'));
  check("tombol + menambah ritase", () => card1.querySelector(".rit-input").value === "3");
  check("grand total ikut berubah setelah +", () => q("#rekap-grand").textContent === "3");

  for (let i = 0; i < 6; i += 1) click(card1.querySelector('[data-action="dec"]'));
  check("tombol - mengurangi dan berhenti di 0", () => card1.querySelector(".rit-input").value === "0");
  check("tombol - nonaktif saat ritase 0", () => card1.querySelector('[data-action="dec"]').disabled === true);

  /* 4. Input ritase manual */
  const ritInputs = qa(".rit-input");
  const nilai = [11, 12, 9, 24, 11, 20, 22, 6];
  ritInputs.forEach((input, index) => setValue(input, String(nilai[index])));
  check("grand total 115 dari 8 driver", () => q("#rekap-grand").textContent === "115");
  check("total armada 8", () => q("#rekap-armada").textContent === "8");
  check("total ritase keseluruhan 115", () => q("#rekap-total-ritase").textContent === "115");

  /* 4b. Panel data real-time */
  check("panel data real-time tampil", () => Boolean(q("#live-dock")) && !q("#live-dock").classList.contains("is-collapsed"));
  check("live armada = 8", () => q("#live-armada").textContent === "8");
  check("live total ritase = 115", () => q("#live-ritase").textContent === "115");
  check("live grand total = 115", () => q("#live-grand").textContent === "115");
  check("live status sama dengan status validasi", () => q("#live-status").textContent.trim() === q("#validasi-pill").textContent.trim());
  check("waktu update live terisi", () => q("#live-time").textContent.trim() !== "—");

  setValue(ritInputs[0], "0");
  check("angka berubah saat mengetik tanpa blur", () => q("#live-grand").textContent === "104" && q("#rekap-grand").textContent === "104");
  setValue(ritInputs[0], "11");
  check("angka kembali setelah diketik ulang", () => q("#live-grand").textContent === "115");

  /* 5. Ritase tidak boleh negatif */
  setValue(ritInputs[0], "-5");
  check("ritase tidak bisa negatif (state)", () => state.report.drivers[0].ritase === 0);
  setValue(ritInputs[0], "11");
  check("grand total kembali 115", () => q("#rekap-grand").textContent === "115");

  /* 6. Rental & nonaktif */
  click(qa(".driver-card")[6].querySelector('[data-action="toggle-rental"]'));
  check("total rental bertambah", () => q("#rekap-rental").textContent === "1");
  click(qa(".driver-card")[6].querySelector('[data-action="toggle-rental"]'));

  click(qa(".driver-card")[7].querySelector('[data-action="toggle-active"]'));
  check("driver nonaktif keluar dari total armada", () => q("#rekap-armada").textContent === "7");
  check("grand total mengecualikan driver nonaktif", () => q("#rekap-grand").textContent === "109");
  click(qa(".driver-card")[7].querySelector('[data-action="toggle-active"]'));
  check("driver aktif kembali, total pulih", () => q("#rekap-grand").textContent === "115");

  /* 7. Rincian material */
  const categories = state.masters.ukuran.map((c) => c.id);
  const fill = (uid, cat, value) => {
    const input = q(`.mat-input[data-uid="${uid}"][data-cat="${cat}"]`);
    if (!input) throw new Error(`input ${uid}/${cat} tidak ditemukan`);
    setValue(input, String(value));
  };

  state.report.drivers.forEach((driver) => {
    fill(driver.uid, categories[0], driver.ritase);
    fill(driver.uid, categories[1], 0);
  });
  await wait(50);

  check("subtotal batu 0.5/1 = 115", () => q('[data-role="subtotal-batu-05-1"]').textContent === "115");
  check("nilai 0 dihitung sebagai terisi", () => state.validation.material.complete === true);
  check("status validasi VALID saat total cocok", () => q("#validasi-pill").textContent.trim() === "VALID");
  check("total rincian material = grand total", () => q('[data-role="material-total"]').textContent === "115");
  check("preview memuat bagian rincian ukuran batu", () => q("#preview-text").textContent.includes("RINCIAN UKURAN BATU"));

  /* 7b. Nama driver tersinkron real-time ke tabel rincian */
  const namaAsli = state.report.drivers[0].nama;
  setValue(qa(".driver-name")[0], "Nama Uji Live");
  check("nama di tabel rincian ikut berubah saat mengetik", () => {
    const cell = q(`tr[data-uid="${state.report.drivers[0].uid}"] .mat-driver strong`);
    return Boolean(cell) && cell.textContent === "Nama Uji Live";
  });
  check("preview ikut memakai nama baru", () => q("#preview-text").textContent.includes("Nama Uji Live"));
  setValue(qa(".driver-name")[0], namaAsli);
  check("nama kembali seperti semula", () => q("#preview-text").textContent.includes(namaAsli));

  /* 8. Belum diisi (null) vs nol */
  const target = state.report.drivers[2];
  const emptyInput = q(`.mat-input[data-uid="${target.uid}"][data-cat="${categories[1]}"]`);
  setValue(emptyInput, "");
  await wait(50);
  check("sel kosong ditandai belum diisi", () => state.report.material.values[target.uid][categories[1]] === null);
  check("status menjadi PERLU DILENGKAPI", () => q("#validasi-pill").textContent.trim() === "PERLU DILENGKAPI");
  check("preview menampilkan 'belum'", () => q("#preview-text").textContent.includes("belum"));

  fill(target.uid, categories[1], 0);
  await wait(50);
  check("status kembali VALID", () => q("#validasi-pill").textContent.trim() === "VALID");

  /* 9. Pilihan Lainnya */
  setValue(q("#laporan-select"), "lainnya");
  check("input manual muncul untuk Lainnya", () => q("#laporan-custom").hidden === false);
  setValue(q("#laporan-custom"), "Laporan Uji");
  check("judul preview mengikuti input manual", () => q("#preview-text").textContent.includes("LAPORAN UJI"));
  setValue(q("#laporan-select"), "lh-segintung");
  check("kembali ke preset menyembunyikan input manual", () => q("#laporan-custom").hidden === true);

  /* 10. LocalStorage draft */
  await wait(800);
  const draftRaw = window.localStorage.getItem("sjt:draft:v1");
  check("draft tersimpan di LocalStorage", () => Boolean(draftRaw) && draftRaw.includes("drivers"));
  check("master JSON tidak ditulis ulang", () => !Object.keys(window.localStorage).some((key) => key.includes("master_")));

  /* 11. Export TXT */
  const mod = await import("../assets/js/report-text.js");
  const text = mod.buildReportText(state.report, api.ctxFor(state.report));
  check("TXT memuat judul & total", () => text.includes("Grand Total: 115 Rit"));
  check("TXT memuat seluruh driver", () => text.includes("8. Suki (KM 8727 HK) = 6 rit"));

  /* 12. PDF */
  let pdfOk = false;
  let pdfInfo = "";
  for (let i = 0; i < 40 && !window.jspdf; i += 1) await wait(100);
  try {
    const { buildPdf } = await import("../assets/js/export.js");
    const doc = buildPdf(state.report, api.ctxFor(state.report));
    const pages = doc.getNumberOfPages();
    const uri = doc.output("datauristring");
    pdfOk = pages >= 1 && uri.startsWith("data:application/pdf") && uri.length > 4000;
    pdfInfo = `${pages} halaman, ${Math.round(uri.length / 1024)} KB`;
  } catch (error) {
    pdfInfo = error.message;
  }
  record("PDF A4 berhasil dibuat", pdfOk, pdfInfo);

  /* 13. Layout tidak overflow horizontal (desktop & mobile) */
  check("tidak ada overflow horizontal pada viewport", () => {
    const doc = document.documentElement;
    return doc.scrollWidth <= doc.clientWidth + 1;
  });
  check("tombol plus/minus berukuran layak sentuh", () => {
    const buttons = qa(".step-btn");
    return buttons.length > 0 && buttons.every((btn) => btn.getBoundingClientRect().height >= 36);
  });
  check("panel live berada di dalam viewport", () => {
    const r = q("#live-dock").getBoundingClientRect();
    return r.left >= -1 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1;
  });
  check("panel live tidak menutupi tombol aksi mobile", () => {
    const bar = q(".mobile-bar");
    if (getComputedStyle(bar).display === "none") return true;
    return q("#live-dock").getBoundingClientRect().bottom <= bar.getBoundingClientRect().top + 1;
  });

  /* 14. JSON master dapat diakses */
  await checkAsync("semua file JSON master dapat diakses", async () => {
    const files = [
      "data/master_laporan_harian.json",
      "data/sumber_material.json",
      "data/master_tujuan.json",
      "data/master_material.json",
      "data/master_driver.json",
    ];
    const responses = await Promise.all(files.map((file) => fetch(file)));
    return responses.every((response) => response.ok);
  });

  /* 14. Tanpa error console */
  check("tidak ada error JavaScript saat inisialisasi", () => !window.__SJT_ERRORS__ || window.__SJT_ERRORS__.length === 0);

  done();
}

run().catch((error) => {
  record("harness berjalan", false, error.message);
  done();
});
