import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.EMBER_URL || "http://127.0.0.1:4173/mobile-prototypes/embercrown-artpass-03/index.html";
const outDir = process.env.EMBER_QA_OUT || "qa-output";
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--use-gl=swiftshader", "--disable-gpu-sandbox"] });
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  screen: { width: 844, height: 390 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
  locale: "ko-KR",
});
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => pageErrors.push(String(error)));

const checkpoints = [];
const snapshot = async (name) => {
  const value = await page.evaluate(() => window.__EMBER_QA__?.snapshot?.() ?? null);
  checkpoints.push({ name, value });
  return value;
};

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("#startButton", { state: "visible", timeout: 20_000 });
  await page.tap("#startButton");
  await page.waitForFunction(() => window.__EMBER_QA__?.ready?.() === true, null, { timeout: 60_000 });
  await page.screenshot({ path: path.join(outDir, "01-playing-mobile.png") });
  const playing = await snapshot("playing");
  if (playing?.state !== "playing") throw new Error(`Expected playing state, received ${JSON.stringify(playing)}`);

  await page.evaluate(() => {
    window.__EMBER_QA__.move(0.8, 0.2, 420);
    window.__EMBER_QA__.attack();
    window.__EMBER_QA__.spell();
  });
  await page.waitForTimeout(900);
  const combat = await snapshot("combat-input");
  if (!combat?.position || combat.mp >= 100) throw new Error(`Combat input did not update state: ${JSON.stringify(combat)}`);

  await page.evaluate(() => {
    window.__EMBER_QA__.activateOath();
    window.__EMBER_QA__.clearWights();
  });
  await page.waitForFunction(() => window.__EMBER_QA__.snapshot().stage >= 2, null, { timeout: 10_000 });
  await page.evaluate(() => window.__EMBER_QA__.lightAll());
  await page.waitForFunction(() => window.__EMBER_QA__.snapshot().boss === true, null, { timeout: 15_000 });

  await page.evaluate(() => window.__EMBER_QA__.setBossRatio(0.64));
  await page.waitForFunction(() => window.__EMBER_QA__.snapshot().bossPhase === 2, null, { timeout: 8_000 });
  await page.screenshot({ path: path.join(outDir, "02-boss-phase-2.png") });
  await snapshot("boss-phase-2");
  await page.waitForTimeout(1400);

  await page.evaluate(() => window.__EMBER_QA__.setBossRatio(0.31));
  await page.waitForFunction(() => window.__EMBER_QA__.snapshot().bossPhase === 3, null, { timeout: 8_000 });
  await page.screenshot({ path: path.join(outDir, "03-boss-phase-3.png") });
  await snapshot("boss-phase-3");
  await page.waitForTimeout(1500);

  await page.evaluate(() => window.__EMBER_QA__.damageBoss(99999));
  await page.waitForSelector("#victoryScreen:not(.hidden)", { timeout: 10_000 });
  await page.screenshot({ path: path.join(outDir, "04-victory.png") });
  await snapshot("victory");
} finally {
  await browser.close();
}

const report = {
  baseUrl,
  viewport: "844x390 touch",
  checkpoints,
  consoleErrors,
  pageErrors,
  passed: consoleErrors.length === 0 && pageErrors.length === 0 && checkpoints.some((item) => item.name === "boss-phase-3"),
  generatedAt: new Date().toISOString(),
};
await fs.writeFile(path.join(outDir, "browser-qa.json"), JSON.stringify(report, null, 2));
if (!report.passed) {
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
}
