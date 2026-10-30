const { test, expect } = require("@playwright/test");
const { installPreviewProtection } = require("./preview-protection.cjs");
test.beforeEach(async ({ page }) => installPreviewProtection(page));

test("GA4 is opt-in: decline never loads Google Analytics", async ({ page }) => {
  const requests=[];
  page.on("request",req=>{if(req.url().includes("googletagmanager.com/gtag/js"))requests.push(req.url());});
  await page.goto("/");
  await expect(page.getByRole("region",{name:"Optional website analytics"})).toBeVisible();
  expect(requests).toHaveLength(0);
  await page.getByRole("button",{name:"Decline"}).click();
  await expect(page.getByRole("region",{name:"Optional website analytics"})).toHaveCount(0);
  await page.goto("/class-9/mathematics");
  await expect(page.getByRole("region",{name:"Optional website analytics"})).toHaveCount(0);
  expect(requests).toHaveLength(0);
  await page.getByRole("button",{name:"Analytics preferences"}).click();
  await expect(page.getByRole("region",{name:"Optional website analytics"})).toBeVisible();
});

test("GA4 only loads after public-page consent and never on private pages",async({page})=>{
  const urls=[];
  await page.route("https://www.googletagmanager.com/**",async route=>{
    urls.push(route.request().url());
    await route.abort();
  });
  await page.goto("/");
  expect(urls).toHaveLength(0);
  await page.getByRole("button",{name:"Allow public-page analytics"}).click();
  await expect.poll(()=>urls.length).toBe(1);
  expect(urls[0]).toContain("G-7LDGQZJF8E");
  const events=await page.evaluate(()=>window.dataLayer||[]);
  expect(events.some(x=>x[0]==="event"&&x[1]==="page_view")).toBe(true);
  await page.goto("/app");
  await expect(page.getByRole("region",{name:"Optional website analytics"})).toHaveCount(0);
  const hasAnalytics=await page.evaluate(()=>Boolean(document.querySelector('script[src*="googletagmanager.com"]')));
  expect(hasAnalytics).toBe(false);
});

test("Private admin routes never prompt for analytics",async({page})=>{
  await page.goto("/admin");
  await expect(page.getByRole("region",{name:"Optional website analytics"})).toHaveCount(0);
});
