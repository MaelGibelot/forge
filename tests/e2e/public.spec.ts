import { test, expect } from '@playwright/test';
test('connexion privée, sans inscription, lisible sur cet écran', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/connexion');
  await expect(page.getByRole('heading', { name: 'Prêt pour la suite ?' })).toBeVisible();
  await expect(page.getByLabel('Identifiant', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Mot de passe', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /inscri/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /inscri|récupér|invita/i })).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  await page.waitForLoadState('networkidle');
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
});
test('protège les pages et l’API sans session', async ({ page, request }) => {
  await page.goto('/historique');
  await expect(page).toHaveURL(/\/connexion$/);
  const r = await request.get('/api/data');
  expect([401, 503]).toContain(r.status());
  const first = await request.get(
    `/api/workouts/first-completed?until=${encodeURIComponent(new Date().toISOString())}`,
  );
  expect([401, 503]).toContain(first.status());
});
