import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.EMBER_URL || "http://127.0.0.1:4173/mobile-prototypes/embercrown-artpass-03/index.html";
const outDir = process.env.EMBER_QA_OUT || "qa-output";
await fs.mkdir(outDir, { recursive: true });

const appendQuery = (url, key, value) => `${url}${url.includes("?") ? "&" : "?"}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
const report = {
  baseUrl,
  checks: {},
  mobile: { checkpoints: [] },
  desktop: { checkpoints: [] },
  consoleErrors: [],
  consoleWarnings: [],
  pageErrors: [],
  fatal: null,
  generatedAt: new Date().toISOString(),
};

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=swiftshader", "--disable-gpu-sandbox"],
});

const attachDiagnostics = (page, label) => {
  page.on("console", (message) => {
    const entry = `[${label}] ${message.text()}`;
    if (message.type() === "error") report.consoleErrors.push(entry);
    if (message.type() === "warning") report.consoleWarnings.push(entry);
  });
  page.on("pageerror", (error) => report.pageErrors.push(`[${label}] ${String(error)}`));
};

const pinFirstTapClock = async (context) => {
  await context.addInitScript(() => {
    const realNow = window.performance.now.bind(window.performance);
    let pinned = true;
    try {
      Object.defineProperty(window.performance, "now", {
        configurable: true,
        value: () => (pinned ? 100 : realNow()),
      });
      window.__EMBER_QA_CLOCK_PINNED__ = true;
      window.__EMBER_RELEASE_CLOCK__ = () => {
        pinned = false;
      };
    } catch (error) {
      window.__EMBER_QA_CLOCK_PINNED__ = false;
      window.__EMBER_RELEASE_CLOCK__ = () => {};
      console.warn(`Could not pin performance.now for deterministic first-tap QA: ${String(error)}`);
    }
  });
};

const getSnapshot = async (page, bucket, name) => {
  const value = await page.evaluate(() => window.__EMBER_QA__?.snapshot?.() ?? null);
  bucket.checkpoints.push({ name, value });
  return value;
};

const runMobile = async () => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    screen: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    locale: "ko-KR",
  });
  await pinFirstTapClock(context);
  const page = await context.newPage();
  attachDiagnostics(page, "mobile");
  const url = appendQuery(baseUrl, "qa_case", "mobile");

  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    report.mobile.url = page.url();
    report.mobile.httpStatus = response?.status() ?? null;
    report.mobile.title = await page.title();
    report.checks.mobile_page_identity = /EMBERCROWN/i.test(report.mobile.title) && (report.mobile.httpStatus === null || report.mobile.httpStatus < 400);

    await page.waitForSelector("#startButton", { state: "visible", timeout: 30_000 });
    report.mobile.firstTapClockPinned = await page.evaluate(() => window.__EMBER_QA_CLOCK_PINNED__ === true && performance.now() === 100);
    report.checks.first_tap_clock_pinned = report.mobile.firstTapClockPinned;
    await page.screenshot({ path: path.join(outDir, "01-mobile-title.png") });

    await page.tap("#startButton");
    await page.evaluate(() => window.__EMBER_RELEASE_CLOCK__?.());
    await page.waitForFunction(() => window.__EMBER_QA__?.ready?.() === true, null, { timeout: 90_000 });
    report.checks.first_physical_tap_starts_game = true;

    await page.screenshot({ path: path.join(outDir, "02-mobile-playing.png") });
    const playing = await getSnapshot(page, report.mobile, "playing");
    report.checks.mobile_playing_state = ["play", "playing"].includes(playing?.state);
    report.checks.mobile_touch_controls_visible = await page.locator("#touchControls").evaluate((el) => !el.classList.contains("hidden"));

    const beforeMove = await getSnapshot(page, report.mobile, "before-joystick");
    const stick = await page.locator("#joystick").boundingBox();
    if (!stick) throw new Error("Mobile joystick has no bounding box.");
    const cx = stick.x + stick.width / 2;
    const cy = stick.y + stick.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + stick.width * 0.33, cy - stick.height * 0.08, { steps: 6 });
    await page.waitForTimeout(550);
    await page.mouse.up();
    await page.waitForTimeout(180);
    const afterMove = await getSnapshot(page, report.mobile, "after-joystick");
    const moved = beforeMove?.position && afterMove?.position && Math.hypot(
      afterMove.position.x - beforeMove.position.x,
      afterMove.position.z - beforeMove.position.z,
    ) > 0.08;
    report.checks.mobile_joystick_moves_player = Boolean(moved);

    const beforeActions = await getSnapshot(page, report.mobile, "before-actions");
    await page.tap("#attackButton");
    await page.waitForTimeout(120);
    await page.tap("#spellButton");
    await page.waitForTimeout(120);
    await page.tap("#dodgeButton");
    await page.waitForTimeout(700);
    const afterActions = await getSnapshot(page, report.mobile, "after-actions");
    report.checks.mobile_action_buttons_update_state = Boolean(beforeActions && afterActions && afterActions.mp < beforeActions.mp);

    await page.evaluate(() => {
      window.__EMBER_QA__.activateOath();
      window.__EMBER_QA__.clearWights();
    });
    await page.waitForFunction(() => window.__EMBER_QA__.snapshot().stage >= 2, null, { timeout: 15_000 });
    report.checks.oath_progression = true;

    await page.evaluate(() => window.__EMBER_QA__.lightAll());
    await page.waitForFunction(() => window.__EMBER_QA__.snapshot().boss === true, null, { timeout: 20_000 });
    report.checks.boss_spawn = true;

    await page.evaluate(() => window.__EMBER_QA__.setBossRatio(0.64));
    await page.waitForFunction(() => window.__EMBER_QA__.snapshot().bossPhase === 2, null, { timeout: 12_000 });
    await page.screenshot({ path: path.join(outDir, "03-mobile-boss-phase-2.png") });
    await getSnapshot(page, report.mobile, "boss-phase-2");
    report.checks.boss_phase_2 = true;
    await page.waitForTimeout(1_400);

    await page.evaluate(() => window.__EMBER_QA__.setBossRatio(0.31));
    await page.waitForFunction(() => window.__EMBER_QA__.snapshot().bossPhase === 3, null, { timeout: 12_000 });
    await page.screenshot({ path: path.join(outDir, "04-mobile-boss-phase-3.png") });
    await getSnapshot(page, report.mobile, "boss-phase-3");
    report.checks.boss_phase_3 = true;
    await page.waitForTimeout(1_500);

    await page.evaluate(() => window.__EMBER_QA__.damageBoss(99_999));
    await page.waitForSelector("#victoryScreen:not(.hidden)", { timeout: 15_000 });
    await page.screenshot({ path: path.join(outDir, "05-mobile-victory.png") });
    const victory = await getSnapshot(page, report.mobile, "victory");
    report.checks.mobile_victory = victory?.state === "win";
  } finally {
    await context.close();
  }
};

const runDesktop = async () => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    screen: { width: 1440, height: 900 },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
    locale: "ko-KR",
  });
  await pinFirstTapClock(context);
  const page = await context.newPage();
  attachDiagnostics(page, "desktop");
  const url = appendQuery(baseUrl, "qa_case", "desktop");

  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    report.desktop.url = page.url();
    report.desktop.httpStatus = response?.status() ?? null;
    report.desktop.title = await page.title();
    report.checks.desktop_page_identity = /EMBERCROWN/i.test(report.desktop.title) && (report.desktop.httpStatus === null || report.desktop.httpStatus < 400);

    await page.waitForSelector("#startButton", { state: "visible", timeout: 30_000 });
    await page.click("#startButton");
    await page.evaluate(() => window.__EMBER_RELEASE_CLOCK__?.());
    await page.waitForFunction(() => window.__EMBER_QA__?.ready?.() === true, null, { timeout: 90_000 });
    await page.screenshot({ path: path.join(outDir, "06-desktop-playing.png") });

    const before = await getSnapshot(page, report.desktop, "before-keyboard");
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(500);
    await page.keyboard.up("KeyW");
    await page.keyboard.press("KeyJ");
    await page.keyboard.press("KeyK");
    await page.keyboard.press("Space");
    await page.waitForTimeout(650);
    const after = await getSnapshot(page, report.desktop, "after-keyboard");
    const moved = before?.position && after?.position && Math.hypot(
      after.position.x - before.position.x,
      after.position.z - before.position.z,
    ) > 0.08;
    report.checks.desktop_keyboard_flow = Boolean(moved && after.mp < before.mp);
    report.checks.desktop_touch_controls_hidden = await page.locator("#touchControls").evaluate((el) => el.classList.contains("hidden"));
  } finally {
    await context.close();
  }
};

try {
  await runMobile();
  await runDesktop();
} catch (error) {
  report.fatal = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ""}` : String(error);
} finally {
  await browser.close();
}

report.checks.no_console_errors = report.consoleErrors.length === 0;
report.checks.no_page_errors = report.pageErrors.length === 0;
report.passed = !report.fatal && Object.values(report.checks).every(Boolean);

await fs.writeFile(path.join(outDir, "browser-qa.json"), JSON.stringify(report, null, 2));
if (!report.passed) {
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ passed: true, baseUrl, checks: report.checks }, null, 2));
}
