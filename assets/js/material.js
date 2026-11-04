/**
 * material.js — tabel RINCIAN UKURAN BATU
 * Membedakan "belum diisi" (null) dengan nilai 0.
 */

import { clampRit, formatNumber, parseMaterialValue } from "./calculation.js";
import { escapeHtml } from "./dom.js";

export class MaterialSection {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.tbody
   * @param {HTMLElement} options.tfoot
   * @param {HTMLElement} options.theadRow
   * @param {Array} options.categories
   * @param {Object} options.callbacks { onValue }
   */
  constructor({ tbody, tfoot, theadRow, categories, callbacks }) {
    this.tbody = tbody;
    this.tfoot = tfoot;
    this.theadRow = theadRow;
    this.categories = categories;
    this.callbacks = callbacks;
    this.drivers = [];
    this.values = {};

    this.tbody.addEventListener("input", (event) => this.handleInput(event));
    this.tbody.addEventListener("blur", (event) => this.handleBlur(event), true);
  }

  setCategories(categories) {
    this.categories = categories;
    this.renderHead();
  }

  setData(drivers, values) {
    this.drivers = drivers;
    this.values = values || {};
    this.render();
  }

  renderHead() {
    if (!this.theadRow) return;
    this.theadRow.innerHTML = [
      "<th>Driver</th>",
      ...this.categories.map((c) => `<th class="num">${escapeHtml(c.label)}</th>`),
      '<th class="num">Total</th>',
    ].join("");
  }

  render() {
    this.renderHead();
    this.tbody.innerHTML = this.drivers.map((driver) => this.rowTemplate(driver)).join("");
    this.renderFoot();
  }

  rowTemplate(driver) {
    const row = this.values[driver.uid] || {};
    const cells = this.categories
      .map((category) => {
        const value = row[category.id];
        const isBlank = value === null || value === undefined || value === "";
        return `
          <td class="num">
            <input class="mat-input ${isBlank ? "is-missing" : ""} ${Number(value) === 0 ? "is-zero" : ""}"
              type="number" inputmode="numeric" min="0" step="1"
              data-uid="${escapeHtml(driver.uid)}" data-cat="${escapeHtml(category.id)}"
              value="${isBlank ? "" : clampRit(value)}" placeholder="belum"
              aria-label="${escapeHtml(category.label)} untuk ${escapeHtml(driver.nama || "driver")}" />
          </td>`;
      })
      .join("");

    return `
      <tr data-uid="${escapeHtml(driver.uid)}" class="${driver.active ? "" : "is-inactive"}">
        <td>
          <div class="mat-driver">
            <strong>${escapeHtml(driver.nama || "(tanpa nama)")}</strong>
            <span>${escapeHtml(driver.nopol || "-")}${driver.rental ? " · RENTAL" : ""}${
      driver.active ? "" : " · NONAKTIF"
    }</span>
          </div>
        </td>
        ${cells}
        <td class="num mat-total" data-role="row-total">${this.rowTotalText(driver.uid)}</td>
      </tr>
    `;
  }

  rowTotalText(uid) {
    const driver = this.drivers.find((d) => d.uid === uid);
    const row = this.values[uid] || {};
    let total = 0;
    let filled = 0;
    for (const category of this.categories) {
      const value = parseMaterialValue(row[category.id]);
      if (value === null) continue;
      total += value;
      filled += 1;
    }
    if (filled === 0) return '<span class="mat-total is-missing">belum</span>';
    if (!driver?.active) return `${formatNumber(total)} <span class="cell-icon">· nonaktif</span>`;
    return formatNumber(total);
  }

  renderFoot(material) {
    const totals = material ? material.subtotals : this.computeSubtotals();
    const grand = material ? material.materialTotal : Object.values(totals).reduce((a, b) => a + b, 0);
    const cells = this.categories
      .map((category) => `<td class="num" data-role="subtotal-${escapeHtml(category.id)}">${formatNumber(totals[category.id] || 0)}</td>`)
      .join("");
    this.tfoot.innerHTML = `<tr><td>Subtotal</td>${cells}<td class="num" data-role="material-total">${formatNumber(grand)}</td></tr>`;
  }

  computeSubtotals() {
    const totals = Object.fromEntries(this.categories.map((c) => [c.id, 0]));
    for (const driver of this.drivers) {
      if (!driver.active) continue;
      const row = this.values[driver.uid] || {};
      for (const category of this.categories) {
        const value = parseMaterialValue(row[category.id]);
        if (value === null) continue;
        totals[category.id] += value;
      }
    }
    return totals;
  }

  /** Perbarui total satu baris + seluruh footer (dipanggil setelah input). */
  syncRow(uid, material) {
    const row = this.tbody.querySelector(`tr[data-uid="${uid}"]`);
    if (row) {
      const cell = row.querySelector('[data-role="row-total"]');
      if (cell) cell.innerHTML = this.rowTotalText(uid);
    }
    this.renderFoot(material);
  }

  handleInput(event) {
    const input = event.target;
    if (!input.classList || !input.classList.contains("mat-input")) return;
    const { uid, cat } = input.dataset;
    const value = parseMaterialValue(input.value);

    if (!this.values[uid]) this.values[uid] = {};
    this.values[uid][cat] = value;

    input.classList.toggle("is-missing", value === null);
    input.classList.toggle("is-zero", value === 0);

    this.callbacks.onValue?.(uid, cat, value);
  }

  handleBlur(event) {
    const input = event.target;
    if (!input.classList || !input.classList.contains("mat-input")) return;
    const value = parseMaterialValue(input.value);
    input.value = value === null ? "" : String(value);
  }
}
