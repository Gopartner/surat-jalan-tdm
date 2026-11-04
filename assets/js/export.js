/**
 * export.js — Preview teks, TXT, PDF (jsPDF) dan cetak (print.css)
 */

import { clampRit, formatNumber } from "./calculation.js";
import { STATUS_LABEL } from "./validation.js";
import { buildFileName, buildReportText, buildSubject } from "./report-text.js";
import { downloadFile, escapeHtml } from "./dom.js";

const NAVY = [15, 47, 82];
const NAVY_DARK = [10, 33, 56];
const NAVY_MID = [20, 64, 110];
const ORANGE = [245, 130, 31];
const ORANGE_DARK = [193, 101, 10];
const INK = [18, 40, 63];
const MUTED = [107, 127, 149];
const BORDER = [215, 225, 236];
const LIGHT = [248, 251, 254];
const ZEBRA = [246, 249, 253];
const OK = [14, 159, 110];
const WARN = [194, 116, 10];
const ERR = [217, 45, 32];

/* ---------------- Teks ---------------- */

export function buildText(report, ctx) {
  return buildReportText(report, ctx);
}

export function downloadText(report, ctx) {
  const text = buildText(report, ctx);
  downloadFile(text, buildFileName(report, ctx.judul, "txt"), "text/plain;charset=utf-8");
  return text;
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback di bawah */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/* ---------------- Sanitasi teks untuk PDF ---------------- */

function sanitize(value) {
  return String(value ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[→➜]/g, "->")
    .replace(/[≥]/g, ">=")
    .replace(/[≤]/g, "<=")
    .replace(/[×]/g, "x")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[^\u0000-\u00FF·]/g, "");
}

/* ---------------- PDF ---------------- */

class PdfBuilder {
  constructor(doc, { docId, judul }) {
    this.doc = doc;
    this.docId = docId;
    this.judul = judul;
    this.pageWidth = doc.internal.pageSize.getWidth();
    this.pageHeight = doc.internal.pageSize.getHeight();
    this.margin = 14;
    this.contentWidth = this.pageWidth - this.margin * 2;
    this.y = this.margin;
    this.page = 1;
  }

  get bottomLimit() {
    return this.pageHeight - 20;
  }

  ensure(height) {
    if (this.y + height > this.bottomLimit) {
      this.addPage();
      return true;
    }
    return false;
  }

  addPage() {
    this.doc.addPage();
    this.page += 1;
    this.y = this.margin + 6;
    this.drawRunningHeader();
  }

  drawRunningHeader() {
    const { doc } = this;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    doc.text(sanitize(this.judul || "SURAT JALAN TDM"), this.margin, this.margin);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.setFontSize(7);
    doc.text(sanitize(this.docId), this.pageWidth - this.margin, this.margin, { align: "right" });
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(this.margin, this.margin + 2, this.pageWidth - this.margin, this.margin + 2);
  }

  header(report, ctx) {
    const { doc } = this;
    const info = report.info || {};

    doc.setFillColor(...NAVY_DARK);
    doc.rect(0, 0, this.pageWidth, 30, "F");
    doc.setFillColor(...ORANGE);
    doc.rect(0, 30, this.pageWidth, 1.8, "F");

    doc.setFillColor(...ORANGE);
    doc.roundedRect(this.margin, 8, 13, 13, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("SJT", this.margin + 6.5, 15.6, { align: "center" });

    doc.setFontSize(17);
    doc.setCharSpace(0.6);
    doc.text("SURAT JALAN TDM", this.margin + 17, 14.6);
    doc.setCharSpace(0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.4);
    doc.setTextColor(188, 212, 236);
    doc.text("Laporan Operasional Pengiriman Material & Ritase", this.margin + 17, 19.4);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(sanitize(ctx.judul || "LAPORAN HARIAN"), this.pageWidth - this.margin, 12, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(188, 212, 236);
    doc.text(`No. ${sanitize(ctx.docId)}`, this.pageWidth - this.margin, 16.4, { align: "right" });
    doc.text(sanitize(ctx.tanggalLabel || ""), this.pageWidth - this.margin, 20.6, { align: "right" });

    this.y = 36;

    /* Info grid */
    const rows = [
      ["Jenis Laporan", ctx.judul || "-"],
      ["Tanggal", ctx.tanggalLabel || "-"],
      ["Material", info.material || "-"],
      ["Sumber Material", info.sumber || "-"],
      ["Tujuan Pengiriman", info.tujuan || "-"],
      ["Subjek", buildSubject(info)],
    ];

    const boxHeight = 9 + rows.length / 2 * 7.4 + 3;
    doc.setFillColor(...LIGHT);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(this.margin, this.y, this.contentWidth, boxHeight, 1.6, 1.6, "FD");
    doc.setFillColor(...ORANGE);
    doc.rect(this.margin, this.y, 1.4, boxHeight, "F");

    const colWidth = this.contentWidth / 2;
    rows.forEach(([label, value], index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = this.margin + 5 + col * colWidth;
      const y = this.y + 5.4 + row * 7.4;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.4);
      doc.setTextColor(...MUTED);
      doc.setCharSpace(0.4);
      doc.text(sanitize(label).toUpperCase(), x, y);
      doc.setCharSpace(0);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.6);
      doc.setTextColor(...INK);
      const maxWidth = colWidth - 8;
      const text = doc.splitTextToSize(sanitize(value), maxWidth)[0] || "-";
      doc.text(text, x, y + 3.6);
    });

    this.y += boxHeight + 6;
  }

  sectionTitle(title, hint = "") {
    const { doc } = this;
    this.ensure(14);
    const height = 7;
    doc.setFillColor(...NAVY_MID);
    doc.roundedRect(this.margin, this.y, this.contentWidth, height, 1.2, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.6);
    doc.setTextColor(255, 255, 255);
    doc.setCharSpace(0.5);
    doc.text(sanitize(title).toUpperCase(), this.margin + 3, this.y + 4.9);
    doc.setCharSpace(0);
    if (hint) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.6);
      doc.setTextColor(188, 212, 236);
      doc.text(sanitize(hint), this.margin + this.contentWidth - 3, this.y + 4.9, { align: "right" });
    }
    this.y += height + 2.4;
  }

  table({ headers, widths, rows, aligns = [], foot = null, rowHeight = 6.4, headerHeight = 6.6 }) {
    const { doc } = this;
    const drawHead = () => {
      doc.setFillColor(...NAVY_MID);
      doc.rect(this.margin, this.y, this.contentWidth, headerHeight, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.6);
      doc.setTextColor(255, 255, 255);
      let x = this.margin;
      headers.forEach((header, index) => {
        const align = aligns[index] || "left";
        const textX = align === "right" ? x + widths[index] - 2.4 : align === "center" ? x + widths[index] / 2 : x + 2.4;
        doc.text(sanitize(header).toUpperCase(), textX, this.y + 4.4, { align });
        x += widths[index];
      });
      this.y += headerHeight;
    };

    this.ensure(headerHeight + rowHeight * 2);
    drawHead();

    rows.forEach((row, rowIndex) => {
      if (this.y + rowHeight > this.bottomLimit) {
        this.addPage();
        drawHead();
      }
      if (rowIndex % 2 === 1) {
        doc.setFillColor(...ZEBRA);
        doc.rect(this.margin, this.y, this.contentWidth, rowHeight, "F");
      }
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.2);
      doc.line(this.margin, this.y + rowHeight, this.margin + this.contentWidth, this.y + rowHeight);

      doc.setFont("helvetica", row.strong ? "bold" : "normal");
      doc.setFontSize(7.8);
      let x = this.margin;
      row.cells.forEach((cell, index) => {
        const align = aligns[index] || "left";
        const textX = align === "right" ? x + widths[index] - 2.4 : align === "center" ? x + widths[index] / 2 : x + 2.4;
        if (row.muted?.[index]) doc.setTextColor(...MUTED);
        else doc.setTextColor(...INK);
        const content = doc.splitTextToSize(sanitize(cell), widths[index] - 4.8)[0] || "";
        doc.text(content, textX, this.y + 4.2, { align });
        x += widths[index];
      });
      this.y += rowHeight;
    });

    if (foot) {
      if (this.y + rowHeight > this.bottomLimit) {
        this.addPage();
        drawHead();
      }
      doc.setFillColor(234, 242, 250);
      doc.rect(this.margin, this.y, this.contentWidth, rowHeight, "F");
      doc.setDrawColor(...NAVY);
      doc.setLineWidth(0.4);
      doc.line(this.margin, this.y, this.margin + this.contentWidth, this.y);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.8);
      doc.setTextColor(...NAVY);
      let x = this.margin;
      foot.cells.forEach((cell, index) => {
        const align = aligns[index] || "left";
        const textX = align === "right" ? x + widths[index] - 2.4 : align === "center" ? x + widths[index] / 2 : x + 2.4;
        doc.text(sanitize(cell), textX, this.y + 4.3, { align });
        x += widths[index];
      });
      this.y += rowHeight;
    }

    this.y += 2;
  }

  rekapBoxes(rekap, material) {
    const { doc } = this;
    this.ensure(22);
    const gap = 3;
    const boxWidth = (this.contentWidth - gap * 3) / 4;
    const boxes = [
      { label: "Total Armada", value: formatNumber(rekap.totalArmada), unit: "Unit" },
      { label: "Armada Rental", value: formatNumber(rekap.totalRental), unit: "Unit" },
      { label: "Grand Total", value: formatNumber(rekap.grandTotal), unit: "Rit", accent: true },
      {
        label: "Rincian Material",
        value: material.expectedCells ? formatNumber(material.materialTotal) : "-",
        unit: "Rit",
      },
    ];

    boxes.forEach((box, index) => {
      const x = this.margin + index * (boxWidth + gap);
      doc.setFillColor(...(box.accent ? [253, 238, 223] : LIGHT));
      doc.setDrawColor(...(box.accent ? [240, 196, 155] : BORDER));
      doc.setLineWidth(0.3);
      doc.roundedRect(x, this.y, boxWidth, 18, 1.4, 1.4, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2);
      doc.setTextColor(...MUTED);
      doc.text(sanitize(box.label).toUpperCase(), x + 2.6, this.y + 5);

      doc.setFontSize(14);
      doc.setTextColor(...(box.accent ? ORANGE_DARK : NAVY));
      doc.text(sanitize(box.value), x + 2.6, this.y + 12.4);
      const valueWidth = doc.getTextWidth(sanitize(box.value));
      doc.setFontSize(6.6);
      doc.setTextColor(...MUTED);
      doc.text(sanitize(box.unit), x + 3.4 + valueWidth, this.y + 12.2);
    });

    this.y += 22;
  }

  validasiBox(validation, catatan = "") {
    const { doc } = this;
    const palette =
      validation.status === "valid" ? OK : validation.status === "incomplete" ? WARN : ERR;
    const bg =
      validation.status === "valid" ? [243, 251, 247] : validation.status === "incomplete" ? [255, 250, 240] : [255, 246, 245];

    const lines = [];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.4);
    for (const check of validation.items) {
      const prefix = check.level === "ok" ? "[OK]" : check.level === "warn" ? "[!]" : "[X]";
      const text = `${prefix} ${check.title}${check.detail ? ` - ${check.detail}` : ""}`;
      const wrapped = doc.splitTextToSize(sanitize(text), this.contentWidth - 12);
      lines.push({ wrapped, level: check.level });
    }
    if (catatan) {
      const wrapped = doc.splitTextToSize(sanitize(`Catatan: ${catatan}`), this.contentWidth - 12);
      lines.push({ wrapped, level: "note" });
    }

    const estimated = 14 + lines.reduce((sum, line) => sum + line.wrapped.length * 3.6, 0);
    this.ensure(Math.min(estimated, 90));

    const startY = this.y;
    doc.setFillColor(...bg);
    doc.setDrawColor(...palette);
    doc.setLineWidth(0.4);
    doc.roundedRect(this.margin, startY, this.contentWidth, Math.max(12, estimated), 1.4, 1.4, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.4);
    doc.setTextColor(...palette);
    doc.setCharSpace(0.4);
    doc.text(`STATUS: ${STATUS_LABEL[validation.status] || validation.status}`, this.margin + 4, startY + 6.2);
    doc.setCharSpace(0);

    let y = startY + 11;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.4);
    for (const line of lines) {
      if (line.level === "note") doc.setTextColor(...MUTED);
      else if (line.level === "err") doc.setTextColor(...ERR);
      else if (line.level === "warn") doc.setTextColor(...WARN);
      else doc.setTextColor(60, 80, 100);
      for (const part of line.wrapped) {
        if (y > this.bottomLimit) {
          this.addPage();
          y = this.y;
        }
        doc.text(part, this.margin + 4, y);
        y += 3.6;
      }
    }

    this.y = Math.max(startY + estimated, y + 2);
  }

  signature() {
    const { doc } = this;
    this.ensure(30);
    const width = this.contentWidth / 3;
    const labels = ["Dibuat oleh", "Diperiksa oleh", "Disetujui oleh"];
    const roles = ["Admin Laporan", "Supervisor", "Project Manager"];

    this.y += 4;
    labels.forEach((label, index) => {
      const x = this.margin + index * width;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.4);
      doc.setTextColor(...MUTED);
      doc.text(sanitize(label), x + width / 2, this.y, { align: "center" });
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      doc.line(x + width * 0.16, this.y + 16, x + width * 0.84, this.y + 16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.4);
      doc.setTextColor(...INK);
      doc.text(sanitize(roles[index]), x + width / 2, this.y + 19.6, { align: "center" });
    });
    this.y += 26;
  }

  footers(timestamp) {
    const { doc } = this;
    const total = doc.getNumberOfPages();
    for (let page = 1; page <= total; page += 1) {
      doc.setPage(page);
      const y = this.pageHeight - 12;
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      doc.line(this.margin, y - 3, this.pageWidth - this.margin, y - 3);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(...MUTED);
      doc.text(sanitize(`Surat Jalan TDM - ${this.docId} - dicetak ${timestamp}`), this.margin, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...NAVY);
      doc.text(`Hal. ${page} / ${total}`, this.pageWidth - this.margin, y, { align: "right" });
    }
  }
}

export function hasPdfLibrary() {
  return Boolean(window.jspdf && window.jspdf.jsPDF);
}

/**
 * Bangun PDF A4 lengkap.
 * @returns {Object} instance jsPDF
 */
export function buildPdf(report, ctx) {
  if (!hasPdfLibrary()) throw new Error("Pustaka PDF tidak tersedia.");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });

  doc.setProperties({
    title: `${ctx.judul} - ${ctx.tanggalLabel}`,
    subject: buildSubject(report.info),
    author: "Surat Jalan TDM",
    creator: "Surat Jalan TDM",
  });

  const builder = new PdfBuilder(doc, { docId: ctx.docId, judul: ctx.judul });
  builder.header(report, ctx);

  /* Rincian ritase */
  const active = report.drivers.filter((d) => d.active);
  builder.sectionTitle("Rincian Ritase Driver", `${active.length} unit aktif`);
  builder.table({
    headers: ["No", "Driver", "Nomor Polisi", "Ritase", "Keterangan"],
    widths: [10, 62, 42, 26, 42],
    aligns: ["center", "left", "left", "right", "left"],
    rows: active.map((driver, index) => ({
      cells: [
        String(index + 1),
        driver.nama || "-",
        driver.nopol || "-",
        formatNumber(clampRit(driver.ritase)),
        driver.rental ? "Rental" : "Internal",
      ],
      muted: [false, false, false, false, false],
      strong: false,
    })),
    foot: {
      cells: ["", "TOTAL RITASE", "", formatNumber(ctx.rekap.grandTotal), `${active.length} unit`],
    },
  });

  const inactive = report.drivers.filter((d) => !d.active);
  if (inactive.length > 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    const text = doc.splitTextToSize(
      sanitize(`Tidak dihitung (nonaktif): ${inactive.map((d) => d.nama || "-").join(", ")}`),
      builder.contentWidth
    );
    text.forEach((line) => {
      builder.ensure(4);
      doc.text(line, builder.margin, builder.y + 3);
      builder.y += 3.6;
    });
    builder.y += 1.4;
  }

  /* Rekap */
  builder.sectionTitle("Rekap Total");
  builder.rekapBoxes(ctx.rekap, ctx.material);

  /* Rincian ukuran batu */
  const categories = ctx.categories;
  builder.sectionTitle("Rincian Ukuran Batu", ctx.material.complete ? "lengkap" : "sementara");
  builder.table({
    headers: ["Driver", ...categories.map((c) => c.label), "Total"],
    widths: [66, ...categories.map(() => (builder.contentWidth - 66 - 30) / categories.length), 30],
    aligns: ["left", ...categories.map(() => "right"), "right"],
    rows: ctx.material.perDriver
      .filter((row) => row.active)
      .map((row) => ({
        cells: [
          `${row.nama || "-"} (${row.nopol || "-"})`,
          ...categories.map((category) => {
            const value = row.values[category.id];
            return value === null || value === undefined ? "belum" : formatNumber(value);
          }),
          row.filled === 0 ? "belum" : formatNumber(row.total),
        ],
        muted: [
          false,
          ...categories.map((category) => row.values[category.id] === null || row.values[category.id] === undefined),
          row.filled === 0,
        ],
      })),
    foot: {
      cells: [
        "SUBTOTAL",
        ...categories.map((category) => formatNumber(ctx.material.subtotals[category.id] || 0)),
        formatNumber(ctx.material.materialTotal),
      ],
    },
  });

  if (!ctx.material.complete) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...WARN);
    const text = doc.splitTextToSize(
      sanitize("Catatan: sel bertanda 'belum' belum diisi dan TIDAK dihitung sebagai nol. Subtotal masih sementara."),
      builder.contentWidth
    );
    text.forEach((line) => {
      builder.ensure(4);
      doc.text(line, builder.margin, builder.y + 3);
      builder.y += 3.6;
    });
    builder.y += 1;
  }

  /* Validasi */
  builder.sectionTitle("Validasi Laporan");
  builder.validasiBox(ctx.validation, ctx.catatan);

  builder.signature();
  builder.footers(ctx.timestamp);

  return doc;
}

export function downloadPdf(report, ctx) {
  const doc = buildPdf(report, ctx);
  doc.save(buildFileName(report, ctx.judul, "pdf"));
}

/* ---------------- Print / Save as PDF (tanpa dependensi) ---------------- */

export function buildPrintHtml(report, ctx) {
  const info = report.info || {};
  const active = report.drivers.filter((d) => d.active);
  const categories = ctx.categories;
  const statusClass = `is-${ctx.validation.status}`;

  const driverRows = active
    .map(
      (driver, index) => `
      <tr>
        <td class="center">${index + 1}</td>
        <td class="strong">${escapeHtml(driver.nama || "-")}</td>
        <td>${escapeHtml(driver.nopol || "-")}</td>
        <td class="num">${formatNumber(clampRit(driver.ritase))}</td>
        <td>${driver.rental ? "Rental" : "Internal"}</td>
      </tr>`
    )
    .join("");

  const materialRows = ctx.material.perDriver
    .filter((row) => row.active)
    .map((row) => {
      const cells = categories
        .map((category) => {
          const value = row.values[category.id];
          if (value === null || value === undefined) return '<td class="num muted">belum</td>';
          return `<td class="num">${formatNumber(value)}</td>`;
        })
        .join("");
      return `
      <tr>
        <td class="strong">${escapeHtml(row.nama || "-")}<br /><span style="font-weight:400;color:#8b9bad">${escapeHtml(
        row.nopol || "-"
      )}</span></td>
        ${cells}
        <td class="num strong">${row.filled === 0 ? '<span class="muted">belum</span>' : formatNumber(row.total)}</td>
      </tr>`;
    })
    .join("");

  const subtotalCells = categories
    .map((category) => `<td class="num">${formatNumber(ctx.material.subtotals[category.id] || 0)}</td>`)
    .join("");

  const validationItems = ctx.validation.items
    .map(
      (check) =>
        `<li>${check.level === "ok" ? "&#10003;" : check.level === "warn" ? "&#33;" : "&#10007;"} <b>${escapeHtml(
          check.title
        )}</b>${check.detail ? ` &mdash; ${escapeHtml(check.detail)}` : ""}</li>`
    )
    .join("");

  return `
  <div class="doc">
    <div class="doc-header">
      <div class="doc-brand">
        <div class="doc-logo">SJT</div>
        <div>
          <h1 class="doc-title">SURAT JALAN TDM</h1>
          <p class="doc-subtitle">Laporan Operasional Pengiriman Material &amp; Ritase</p>
        </div>
      </div>
      <div class="doc-meta">
        <div><strong>${escapeHtml(ctx.judul || "LAPORAN HARIAN")}</strong></div>
        <div>Tanggal: <strong>${escapeHtml(ctx.tanggalLabel)}</strong></div>
        <div class="doc-id">${escapeHtml(ctx.docId)}</div>
      </div>
    </div>

    <div class="doc-info">
      <div class="doc-info-item"><span class="doc-info-label">Jenis Laporan</span><span class="doc-info-value">${escapeHtml(
        ctx.judul || "-"
      )}</span></div>
      <div class="doc-info-item"><span class="doc-info-label">Sumber Material</span><span class="doc-info-value">${escapeHtml(
        info.sumber || "-"
      )}</span></div>
      <div class="doc-info-item"><span class="doc-info-label">Material</span><span class="doc-info-value">${escapeHtml(
        info.material || "-"
      )}</span></div>
      <div class="doc-info-item"><span class="doc-info-label">Tujuan</span><span class="doc-info-value">${escapeHtml(
        info.tujuan || "-"
      )}</span></div>
      <div class="doc-info-item"><span class="doc-info-label">Total Armada</span><span class="doc-info-value">${formatNumber(
        ctx.rekap.totalArmada
      )} Unit (Rental ${formatNumber(ctx.rekap.totalRental)})</span></div>
      <div class="doc-info-item"><span class="doc-info-label">Grand Total</span><span class="doc-info-value">${formatNumber(
        ctx.rekap.grandTotal
      )} Rit</span></div>
    </div>

    <div class="doc-section">
      <h2 class="doc-section-title"><span>Rincian Ritase Driver</span><span class="hint">${
        active.length
      } unit aktif</span></h2>
      <table class="doc-table">
        <thead><tr><th style="width:10mm" class="center">No</th><th>Driver</th><th>Nomor Polisi</th><th class="num" style="width:18mm">Ritase</th><th style="width:22mm">Keterangan</th></tr></thead>
        <tbody>${driverRows || '<tr><td colspan="5" class="muted">Belum ada driver aktif</td></tr>'}</tbody>
        <tfoot><tr><td colspan="3">TOTAL RITASE</td><td class="num">${formatNumber(
          ctx.rekap.grandTotal
        )}</td><td>${active.length} unit</td></tr></tfoot>
      </table>
    </div>

    <div class="doc-section">
      <h2 class="doc-section-title"><span>Rekap Total</span></h2>
      <div class="doc-rekap">
        <div class="doc-rekap-box"><span class="doc-rekap-label">Total Armada</span><span class="doc-rekap-value">${formatNumber(
          ctx.rekap.totalArmada
        )} <small>Unit</small></span></div>
        <div class="doc-rekap-box"><span class="doc-rekap-label">Armada Rental</span><span class="doc-rekap-value">${formatNumber(
          ctx.rekap.totalRental
        )} <small>Unit</small></span></div>
        <div class="doc-rekap-box is-accent"><span class="doc-rekap-label">Grand Total</span><span class="doc-rekap-value">${formatNumber(
          ctx.rekap.grandTotal
        )} <small>Rit</small></span></div>
        <div class="doc-rekap-box"><span class="doc-rekap-label">Rincian Material</span><span class="doc-rekap-value">${
          ctx.material.expectedCells ? formatNumber(ctx.material.materialTotal) : "-"
        } <small>Rit</small></span></div>
      </div>
    </div>

    <div class="doc-section">
      <h2 class="doc-section-title"><span>Rincian Ukuran Batu</span><span class="hint">${
        ctx.material.complete ? "lengkap" : "sementara - belum lengkap"
      }</span></h2>
      <table class="doc-table">
        <thead><tr><th>Driver</th>${categories
          .map((category) => `<th class="num">${escapeHtml(category.label)}</th>`)
          .join("")}<th class="num">Total</th></tr></thead>
        <tbody>${materialRows || '<tr><td colspan="4" class="muted">Belum ada driver aktif</td></tr>'}</tbody>
        <tfoot><tr><td>SUBTOTAL</td>${subtotalCells}<td class="num">${formatNumber(
          ctx.material.materialTotal
        )}</td></tr></tfoot>
      </table>
      ${
        ctx.material.complete
          ? ""
          : '<p class="doc-note">Sel bertanda "belum" belum diisi dan tidak dihitung sebagai nol.</p>'
      }
    </div>

    <div class="doc-section">
      <h2 class="doc-section-title"><span>Validasi Laporan</span></h2>
      <div class="doc-validasi ${statusClass}">
        <span class="doc-status">${escapeHtml(ctx.validation.label)}</span>
        <ul class="doc-check-list">${validationItems}</ul>
        ${ctx.catatan ? `<p class="doc-note">Catatan: ${escapeHtml(ctx.catatan)}</p>` : ""}
      </div>
    </div>

    <div class="doc-sign">
      <div class="doc-sign-box">Dibuat oleh<div class="doc-sign-line">Admin Laporan</div></div>
      <div class="doc-sign-box">Diperiksa oleh<div class="doc-sign-line">Supervisor</div></div>
      <div class="doc-sign-box">Disetujui oleh<div class="doc-sign-line">Project Manager</div></div>
    </div>

    <div class="doc-footer">
      <span>Surat Jalan TDM &middot; ${escapeHtml(ctx.docId)} &middot; dicetak ${escapeHtml(ctx.timestamp)}</span>
      <span>Halaman <span class="page"></span></span>
    </div>
  </div>`;
}

export function printReport(report, ctx) {
  const root = document.getElementById("print-root");
  if (!root) throw new Error("Area cetak tidak ditemukan.");
  root.innerHTML = buildPrintHtml(report, ctx);
  window.print();
}
