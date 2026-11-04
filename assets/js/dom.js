/**
 * dom.js — util DOM kecil (tanpa dependensi).
 */

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function on(target, type, handler, options) {
  if (!target) return () => {};
  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
}

/** Debounce sederhana. */
export function debounce(fn, wait = 300) {
  let timer = null;
  const wrapped = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };
  wrapped.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return wrapped;
}

/** dd/mm/yyyy HH:MM */
export function timestampID(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

/** Unduh blob sebagai file. */
export function downloadFile(content, filename, mime = "text/plain;charset=utf-8") {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Modal sederhana, mengembalikan Promise<boolean> (true = aksi utama). */
export function confirmModal({ title = "Konfirmasi", message = "", confirmLabel = "Ya", cancelLabel = "Batal", danger = false, extra = null }) {
  return new Promise((resolve) => {
    const root = document.getElementById("modal-root") || document.body;
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>${escapeHtml(title)}</h3>
          <button type="button" class="icon-btn" data-modal="close" aria-label="Tutup">✕</button>
        </div>
        <div class="modal-body">
          <p class="modal-text">${message}</p>
          ${extra ? extra : ""}
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-secondary" data-modal="cancel">${escapeHtml(cancelLabel)}</button>
          <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-modal="ok">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;

    const close = (result) => {
      document.removeEventListener("keydown", onKey);
      backdrop.remove();
      resolve(result);
    };
    const onKey = (event) => {
      if (event.key === "Escape") close(false);
    };

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) return close(false);
      const action = event.target.closest("[data-modal]")?.dataset.modal;
      if (action === "ok") close(true);
      if (action === "cancel" || action === "close") close(false);
    });
    document.addEventListener("keydown", onKey);

    root.appendChild(backdrop);
    backdrop.querySelector('[data-modal="ok"]')?.focus();
  });
}
