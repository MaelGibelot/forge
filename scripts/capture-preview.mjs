import { chromium, devices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('docs/previews', { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge' });
try {
  for (const [name, options] of [
    ['desktop', { viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' }],
    ['mobile', { ...devices['iPhone 13'], defaultBrowserType: undefined, colorScheme: 'dark' }],
  ]) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    await page.goto(`${process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000'}/connexion`);
    await page.getByRole('heading', { name: 'Prêt pour la suite ?' }).waitFor();
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: `docs/previews/connexion-${name}.png`,
      fullPage: true,
      caret: 'initial',
    });
    await context.close();
  }
} finally {
  await browser.close();
}
