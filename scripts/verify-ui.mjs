import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.APP_URL || "http://127.0.0.1:3000";
const SHOT_DIR = path.resolve("tmp/shots");
fs.mkdirSync(SHOT_DIR, { recursive: true });

const shot = (page, name) =>
  page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function selectPlayer(page, placeholderPart, name) {
  const input = page.locator(`input[placeholder*="${placeholderPart}"]`);
  await input.click();
  await input.fill(name);
  await page.waitForSelector(".ac-menu", { timeout: 8000 });
  await sleep(400);
  const item = page.locator(".ac-item", { hasText: name }).first();
  await item.click();
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // Home page
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await sleep(400);
  await shot(page, "home-desktop");

  // Search + verdict flow
  await selectPlayer(page, "选手 A", "Bin");
  await selectPlayer(page, "选手 B", "Faker");
  await page.getByRole("button", { name: "开打！鉴定父子" }).click();
  await page.waitForSelector(".verdict", { timeout: 12000 });
  await sleep(500);
  await shot(page, "h2h-desktop");

  const title = await page.locator(".verdict-title").innerText();
  console.log("VERDICT:", title);

  // Series view
  await page.getByRole("button", { name: "系列赛记录" }).click();
  await sleep(300);
  await shot(page, "h2h-series-desktop");

  // Time range preset
  await page.getByRole("button", { name: "近一年" }).click();
  await sleep(800);
  await shot(page, "h2h-1y-desktop");

  // Ranking page for Bin
  const res = await page.request.get(`${BASE}/api/players?q=Bin`);
  const bin = (await res.json()).players?.[0];
  if (bin) {
    await page.goto(`${BASE}/ranking/${bin.id}?type=son&min_games=10`, {
      waitUntil: "networkidle",
    });
    await page.waitForSelector(".rank-cards, .empty-box, .error-box", { timeout: 12000 });
    await sleep(500);
    await shot(page, "ranking-son-desktop");

    await page.goto(`${BASE}/ranking/${bin.id}?type=dad&min_games=10`, {
      waitUntil: "networkidle",
    });
    await page.waitForSelector(".rank-cards, .empty-box, .error-box", { timeout: 12000 });
    await sleep(500);
    await shot(page, "ranking-dad-desktop");
  } else {
    console.log("WARN: Bin not found via API");
  }

  // Mobile viewport
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(BASE + "/", { waitUntil: "networkidle" });
  await sleep(400);
  await shot(mobile, "home-mobile");
  if (bin) {
    await mobile.goto(`${BASE}/h2h/${bin.id}/${bin.id}`, {
      waitUntil: "networkidle",
    });
    await mobile.waitForSelector(".verdict", { timeout: 12000 });
    await sleep(400);
    await shot(mobile, "h2h-mobile");
  }
  await mobile.close();

  // Console errors check
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const failed = [];
  page.on("requestfailed", (r) => failed.push(r.url()));
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await sleep(300);
  console.log("PAGE ERRORS:", errors.length ? errors : "none");
  console.log("FAILED REQUESTS:", failed.length ? failed : "none");
  console.log("SHOTS:", fs.readdirSync(SHOT_DIR).join(", "));
} finally {
  await browser.close();
}
