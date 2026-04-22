/**
 * Run full flow and take screenshot of Review page (RECOMPOSE button).
 * Usage: node scripts/screenshot-review.mjs
 * Requires: npm install -D @playwright/test (or use npx playwright)
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000/en';
const OUT = 'screenshots';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });

  try {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${OUT}/1-home.png`, fullPage: true });

    await page.click('button:has-text("START COMPOSING")');
    await page.waitForURL(/choose-medium/);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/2-choose-medium.png`, fullPage: true });

    await page.click('button:has-text("Piano")');
    await page.waitForURL(/compose/);
    await page.waitForTimeout(500);

    const key = await page.locator('[data-note="F"]').first();
    await key.click();
    await page.waitForTimeout(300);
    await page.click('button:has-text("Continue")');
    await page.waitForURL(/review/);
    await page.waitForTimeout(500);

    await page.screenshot({ path: `${OUT}/3-review-recompose.png`, fullPage: true });
    console.log('Screenshots saved to', OUT);
  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
  }
}

main();
