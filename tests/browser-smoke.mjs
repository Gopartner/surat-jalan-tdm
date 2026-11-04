/**
 * tests/browser-smoke.mjs — jalankan selftest di browser headless.
 * Pemakaian: npm run test:browser
 *
 * Membutuhkan Python (untuk static server) dan Edge/Chrome terpasang.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = Number(process.env.SJT_PORT || 8765);
const ROOT = path.resolve(process.cwd());
const URL = `http://127.0.0.1:${PORT}/?selftest=1`;

const BROWSERS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function pickBrowser() {
  const found = BROWSERS.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("Browser (Edge/Chrome) tidak ditemukan.");
  return found;
}

async function waitForServer(attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/index.html`);
      if (response.ok) return true;
    } catch {
      /* belum siap */
    }
    await sleep(250);
  }
  return false;
}

async function main() {
  const browser = pickBrowser();
  const profile = mkdtempSync(path.join(tmpdir(), "sjt-profile-"));

  const server = spawn("python", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], {
    cwd: ROOT,
    stdio: "ignore",
    windowsHide: true,
  });

  const cleanup = () => {
    try {
      server.kill();
    } catch {
      /* ignore */
    }
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  };

  try {
    if (!(await waitForServer())) throw new Error("Server statis gagal dijalankan (port " + PORT + ").");

    const child = spawn(
      browser,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        `--user-data-dir=${profile}`,
        "--virtual-time-budget=20000",
        "--dump-dom",
        URL,
      ],
      { stdio: ["ignore", "pipe", "ignore"], windowsHide: true }
    );

    let dom = "";
    child.stdout.on("data", (chunk) => {
      dom += chunk.toString();
    });

    const code = await new Promise((resolve) => child.on("close", resolve));
    if (code !== 0 && !dom) throw new Error(`Browser keluar dengan kode ${code} tanpa output.`);

    const lines = dom.split("\n").filter((line) => /^(PASS|FAIL) ::/.test(line.trim()));
    const title = dom.match(/<title>(.*?)<\/title>/)?.[1] || "(tanpa judul)";
    const failed = lines.filter((line) => line.trim().startsWith("FAIL"));

    console.log(title);
    console.log(lines.map((line) => line.trim()).join("\n"));

    if (failed.length > 0 || !title.includes("SELFTEST PASS")) {
      console.error(`\n${failed.length} pengujian gagal.`);
      process.exitCode = 1;
    } else {
      console.log(`\n${lines.length} pengujian browser lulus.`);
    }
  } finally {
    cleanup();
  }
}

main().catch((error) => {
  console.error("Smoke test gagal:", error.message);
  process.exitCode = 1;
});
