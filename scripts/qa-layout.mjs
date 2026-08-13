import { chromium } from "playwright";

const BASE = process.env.APP_URL || "http://127.0.0.1:3000";

function assert(cond, label, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}: ${label}${extra ? " | " + extra : ""}`);
  if (!cond) process.exitCode = 1;
}

const browser = await chromium.launch({ channel: "chrome", headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForSelector(".hero-title");
  const heroTitle = (await page.locator(".hero-title").innerText()).trim();
  assert(heroTitle.length > 0, "home: hero title present", heroTitle);
  assert(
    (await page.locator(".search-row input").count()) === 2,
    "home: two search inputs"
  );
  assert(
    (await page.locator(".site-nav .nav-link").count()) === 2,
    "home: nav links (首页/排行榜)"
  );
  const overflow1 = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  assert(overflow1 <= 0, "home desktop: no horizontal overflow", `delta=${overflow1}`);
  const bodyBg = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor
  );
  assert(bodyBg !== "rgba(0, 0, 0, 0)", "home: body has dark background", bodyBg);
  const heroFont = await page.locator(".hero-title").evaluate(
    (el) => getComputedStyle(el).fontSize + " / " + getComputedStyle(el).fontWeight
  );
  assert(parseInt(heroFont) >= 34, "home: hero title >= 34px", heroFont);

  // h2h page
  await page.goto(`${BASE}/h2h/881/2617`, { waitUntil: "networkidle" });
  await page.waitForSelector(".verdict-title");
  const verdictTitle = (await page.locator(".verdict-title").innerText()).trim();
  assert(verdictTitle.includes("Bin") && verdictTitle.includes("Faker"), "h2h: verdict mentions both players", verdictTitle);
  assert((await page.locator(".stat-card").count()) === 2, "h2h: two stat cards");
  const gameRows = await page.locator(".table tbody tr").count();
  assert(gameRows > 0, "h2h: game table has rows", `rows=${gameRows}`);
  const segBtns = await page.locator(".seg button").count();
  assert(segBtns === 2, "h2h: games/series toggle", `btns=${segBtns}`);
  const vFont = await page.locator(".verdict-title").evaluate(
    (el) => getComputedStyle(el).fontSize + " / weight " + getComputedStyle(el).fontWeight
  );
  assert(parseInt(vFont) >= 26, "h2h: verdict title >= 26px", vFont);

  // series view
  await page.getByRole("button", { name: "系列赛记录" }).click();
  await page.waitForTimeout(400);
  const seriesRows = await page.locator(".table tbody tr").count();
  assert(seriesRows > 0, "h2h: series table has rows", `rows=${seriesRows}`);

  // ranking page
  await page.goto(`${BASE}/ranking/881?type=son&min_games=10`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector(".rank-cards");
  const rankCards = await page.locator(".rank-card").count();
  assert(rankCards === 3, "ranking: top3 cards", `cards=${rankCards}`);
  const rankRows = await page.locator(".table tbody tr").count();
  assert(rankRows >= 3, "ranking: table rows", `rows=${rankRows}`);
  const overflow2 = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  assert(overflow2 <= 0, "ranking desktop: no horizontal overflow", `delta=${overflow2}`);

  // mobile
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(BASE + "/", { waitUntil: "networkidle" });
  await mobile.waitForSelector(".hero-title");
  const mOverflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  assert(mOverflow <= 0, "home mobile: no horizontal overflow", `delta=${mOverflow}`);
  await mobile.goto(`${BASE}/h2h/881/2617`, { waitUntil: "networkidle" });
  await mobile.waitForSelector(".verdict");
  const mOverflow2 = await mobile.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  assert(mOverflow2 <= 0, "h2h mobile: no horizontal overflow", `delta=${mOverflow2}`);
  const statsCols = await mobile.locator(".stats-grid").evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns
  );
  assert(statsCols.includes("390px") || statsCols.split(" ").length === 1, "h2h mobile: stats stacked", statsCols);
  await mobile.close();

  console.log("QA DONE");
} finally {
  await browser.close();
}
