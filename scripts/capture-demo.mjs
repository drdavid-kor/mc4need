import { chromium } from 'playwright';
const base = 'https://mc4need.david-widgets.com';
const browser = await chromium.launch();
const context = await browser.newContext({
  locale: 'zh-CN', viewport: { width: 1440, height: 1000 },
  permissions: ['clipboard-read', 'clipboard-write'],
  recordVideo: { dir: 'reports/private/video', size: { width: 1280, height: 888 } },
});
const p = await context.newPage();
async function ready(page) {
  await page.locator('.card').first().waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(img => {
      img.loading = 'eager';
      return img.decode().catch(() => {});
    }));
  });
}
await p.goto(base + '/?lang=zh');
await ready(p);
await p.getByRole('button', { name: '演示案例', exact: true }).click();
await p.screenshot({ path: 'docs/images/home-desktop.png', fullPage: true });
await p.getByRole('button', { name: '关注餐食需求', exact: true }).click();
await p.waitForTimeout(1600);
await p.getByRole('button', { name: '关闭', exact: true }).click();
await p.locator('#discover').scrollIntoViewIfNeeded();
await p.waitForTimeout(1600);
await p.locator('.card h3 a[href="/needs/demo-birthday"]').click();
await p.locator('.demo-notice').waitFor();
await p.locator('img').first().evaluate(img => img.decode());
await p.screenshot({ path: 'docs/images/demo-detail.png', fullPage: true });
await p.waitForTimeout(1800);
await p.getByRole('button', { name: '我也有一份需要' }).click();
await p.waitForTimeout(1600);
await p.getByRole('button', { name: /复制完整指引|已复制，粘贴到你的 AI 即可/ }).click();
await p.waitForTimeout(1600);
await p.getByRole('button', { name: '关闭', exact: true }).click();
await p.locator('blockquote').scrollIntoViewIfNeeded();
await p.waitForTimeout(1600);
await context.close();
await p.video().saveAs('docs/media/web-tour.webm');
const mobile = await browser.newPage({ locale: 'zh-CN', viewport: { width: 390, height: 844 } });
await mobile.goto(base + '/?lang=zh');
await ready(mobile);
await mobile.getByRole('button', { name: '演示案例', exact: true }).click();
await mobile.screenshot({ path: 'docs/images/home-mobile.png', fullPage: true });
const english = await browser.newPage({ locale: 'en-US', viewport: { width: 1440, height: 1000 } });
await english.goto(base + '/?lang=en');
await ready(english);
await english.getByRole('button', { name: 'Demo cases', exact: true }).click();
await english.screenshot({ path: 'docs/images/home-en-desktop.png', fullPage: true });
await browser.close();
console.log('Production screenshots and silent website tour saved; no real order or private identity shown.');
