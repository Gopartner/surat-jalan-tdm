/**
 * driver.js — rendering & interaksi kartu RINCIAN RITASE DRIVER
 * Event delegation: satu listener untuk seluruh grid (efisien, tanpa reload).
 */

import { clampRit, formatNumber } from "./calculation.js";
import { escapeHtml } from "./dom.js";

export class DriverSection {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container grid driver
   * @param {Object} options.callbacks { onRitase, onToggleActive, onToggleRental, onIdentity, onRemove, onRender }
   */
  constructor({ container, callbacks }) {
    this.container = container;
    this.callbacks = callbacks;
    this.drivers = [];

    this.container.addEventListener("click", (event) => this.handleClick(event));
    this.container.addEventListener("input", (event) => this.handleInput(event));
    this.container.addEventListener("change", (event) => this.handleChange(event));
    this.container.addEventListener("blur", (event) => this.handleBlur(event), true);
  }

  setDrivers(drivers) {
    this.drivers = drivers;
    this.render();
  }

  /** Render ulang seluruh kartu (hanya saat struktur berubah). */
  render() {
    this.container.innerHTML = this.drivers
      .map((driver, index) => this.cardTemplate(driver, index))
      .join("");
  }

  cardTemplate(driver, index) {
    const ritase = clampRit(driver.ritase);
    const classes = ["driver-card"];
    if (!driver.active) classes.push("is-inactive");
    if (driver.rental) classes.push("is-rental");

    return `
      <article class="${classes.join(" ")}" data-uid="${escapeHtml(driver.uid)}">
        <div class="driver-top">
          <span class="driver-no">${String(index + 1).padStart(2, "0")}</span>
          <div class="driver-id">
            <input class="driver-name" data-field="nama" type="text" value="${escapeHtml(driver.nama)}"
              placeholder="Nama driver" aria-label="Nama driver ${index + 1}" autocomplete="off" />
            <input class="driver-nopol" data-field="nopol" type="text" value="${escapeHtml(driver.nopol)}"
              placeholder="NOMOR POLISI" aria-label="Nomor polisi ${index + 1}" autocomplete="off" />
          </div>
          <div class="driver-menu">
            <button type="button" class="icon-btn ${driver.active ? "is-on" : ""}" data-action="toggle-active"
              title="${driver.active ? "Nonaktifkan driver" : "Aktifkan driver"}"
              aria-label="${driver.active ? "Nonaktifkan" : "Aktifkan"} ${escapeHtml(driver.nama)}"
              aria-pressed="${driver.active}">${driver.active ? "◉" : "○"}</button>
            <button type="button" class="icon-btn ${driver.rental ? "is-on" : ""}" data-action="toggle-rental"
              title="Tandai sebagai rental" aria-label="Tandai rental ${escapeHtml(driver.nama)}"
              aria-pressed="${driver.rental}">R</button>
            <button type="button" class="icon-btn is-danger" data-action="remove"
              title="Hapus driver dari laporan" aria-label="Hapus ${escapeHtml(driver.nama)}">✕</button>
          </div>
        </div>

        <div class="stepper">
          <button type="button" class="step-btn minus" data-action="dec" aria-label="Kurangi ritase ${escapeHtml(driver.nama)}"
            ${ritase <= 0 ? "disabled" : ""}>−</button>
          <div class="step-value">
            <input class="rit-input" data-field="ritase" type="number" inputmode="numeric" min="0" step="1"
              value="${ritase}" aria-label="Jumlah ritase ${escapeHtml(driver.nama)}" />
            <span class="step-unit">RIT</span>
          </div>
          <button type="button" class="step-btn plus" data-action="inc" aria-label="Tambah ritase ${escapeHtml(driver.nama)}">+</button>
        </div>

        <div class="driver-tags">${this.tagsTemplate(driver)}</div>
      </article>
    `;
  }

  tagsTemplate(driver) {
    const tags = [];
    if (driver.rental) tags.push('<span class="tag tag-rental">Rental</span>');
    if (!driver.active) tags.push('<span class="tag tag-off">Nonaktif</span>');
    if (driver.custom) tags.push('<span class="tag tag-custom">Manual</span>');
    if (driver.active && !driver.rental && !driver.custom) {
      tags.push(`<span class="tag">${formatNumber(clampRit(driver.ritase))} rit</span>`);
    }
    return tags.join("");
  }

  driverByUid(uid) {
    return this.drivers.find((d) => d.uid === uid) || null;
  }

  cardByUid(uid) {
    return this.container.querySelector(`[data-uid="${uid}"]`);
  }

  /** Perbarui satu kartu tanpa render ulang seluruh grid (menjaga fokus input). */
  syncCard(driver) {
    const card = this.cardByUid(driver.uid);
    if (!card) return;
    const input = card.querySelector(".rit-input");
    const minus = card.querySelector('[data-action="dec"]');
    const ritase = clampRit(driver.ritase);

    if (input && document.activeElement !== input) input.value = String(ritase);
    if (minus) minus.disabled = ritase <= 0;
    card.classList.toggle("is-inactive", !driver.active);
    card.classList.toggle("is-rental", driver.rental);

    const tags = card.querySelector(".driver-tags");
    if (tags) tags.innerHTML = this.tagsTemplate(driver);

    const activeBtn = card.querySelector('[data-action="toggle-active"]');
    if (activeBtn) {
      activeBtn.textContent = driver.active ? "◉" : "○";
      activeBtn.classList.toggle("is-on", driver.active);
      activeBtn.setAttribute("aria-pressed", String(driver.active));
    }

    const rentalBtn = card.querySelector('[data-action="toggle-rental"]');
    if (rentalBtn) {
      rentalBtn.classList.toggle("is-on", driver.rental);
      rentalBtn.setAttribute("aria-pressed", String(driver.rental));
    }
  }

  handleClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const card = button.closest("[data-uid]");
    if (!card) return;

    const driver = this.driverByUid(card.dataset.uid);
    if (!driver) return;

    event.preventDefault();
    const action = button.dataset.action;

    if (action === "inc") {
      driver.ritase = clampRit(driver.ritase) + 1;
      this.syncCard(driver);
      this.callbacks.onRitase?.(driver, "inc");
    } else if (action === "dec") {
      driver.ritase = Math.max(0, clampRit(driver.ritase) - 1);
      this.syncCard(driver);
      this.callbacks.onRitase?.(driver, "dec");
    } else if (action === "toggle-active") {
      driver.active = !driver.active;
      this.callbacks.onToggleActive?.(driver);
    } else if (action === "toggle-rental") {
      driver.rental = !driver.rental;
      this.callbacks.onToggleRental?.(driver);
    } else if (action === "remove") {
      this.callbacks.onRemove?.(driver);
    }
  }

  handleInput(event) {
    const input = event.target;
    const card = input.closest("[data-uid]");
    if (!card) return;
    const driver = this.driverByUid(card.dataset.uid);
    if (!driver) return;

    if (input.dataset.field === "ritase") {
      const raw = input.value;
      if (raw === "") {
        driver.ritase = 0;
      } else {
        const parsed = Number(raw);
        driver.ritase = Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
      }
      const minus = card.querySelector('[data-action="dec"]');
      if (minus) minus.disabled = clampRit(driver.ritase) <= 0;
      const tags = card.querySelector(".driver-tags");
      if (tags) tags.innerHTML = this.tagsTemplate(driver);
      this.callbacks.onRitase?.(driver, "type");
    } else if (input.dataset.field === "nama") {
      driver.nama = input.value;
      this.callbacks.onIdentity?.(driver, "nama");
    } else if (input.dataset.field === "nopol") {
      driver.nopol = input.value;
      this.callbacks.onIdentity?.(driver, "nopol");
    }
  }

  handleChange() {
    /* placeholder: semua perubahan ditangani lewat input/click */
  }

  handleBlur(event) {
    const input = event.target;
    if (!input.classList || !input.classList.contains("rit-input")) return;
    const card = input.closest("[data-uid]");
    if (!card) return;
    const driver = this.driverByUid(card.dataset.uid);
    if (!driver) return;
    const value = clampRit(input.value);
    input.value = String(value);
    driver.ritase = value;
    this.callbacks.onRitase?.(driver, "blur");
  }
}
