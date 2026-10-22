import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';
const enabled =
  process.env.E2E_LIVE === '1' &&
  !!process.env.SUPABASE_SECRET_KEY &&
  !!process.env.AUTH_IDENTITY_DOMAIN;
test.describe('Supabase réel — comptes temporaires et parcours complet', () => {
  test.skip(
    !enabled,
    'Nécessite un projet Supabase de TEST configuré et E2E_LIVE=1. Aucun backend simulé.',
  );
  const accounts: { id: string; username: string; password: string }[] = [];
  const service = () =>
    createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
      auth: { persistSession: false },
    });
  test.beforeAll(async () => {
    for (let i = 0; i < 2; i++) {
      const username = `e2e-${randomBytes(6).toString('hex')}`,
        password = randomBytes(24).toString('base64url'),
        email = `${randomUUID()}@${process.env.AUTH_IDENTITY_DOMAIN}`;
      const db = service();
      const { data, error } = await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw error;
      accounts.push({ id: data.user.id, username, password });
      for (const r of [
        await db.rpc('register_login', {
          login: username,
          identity: data.user.id,
          technical_email: email,
        }),
        await db.from('profiles').insert({ user_id: data.user.id, display_name: 'Athlète E2E' }),
        await db.from('user_preferences').insert({ user_id: data.user.id, max_rpe: 9, min_rir: 1 }),
      ])
        if (r.error) throw r.error;
    }
  });
  test.afterAll(async () => {
    if (enabled)
      for (const a of accounts) {
        const { error } = await service().auth.admin.deleteUser(a.id);
        if (error) throw error;
      }
  });
  async function login(page: Page, a = accounts[0]) {
    await page.goto('/connexion');
    await page.getByLabel('Identifiant', { exact: true }).fill(a.username);
    await page.getByLabel('Mot de passe', { exact: true }).fill(a.password);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/tableau-de-bord/);
  }
  test('crée un programme, un superset, reprend une séance et recalcule les records', async ({
    page,
    browser,
  }) => {
    await login(page);
    await page.goto('/programmes/nouveau');
    await page.getByLabel('Nom du programme', { exact: true }).fill('Programme E2E');
    for (const name of ['Développé couché', 'Extension triceps corde']) {
      await page.getByRole('button', { name: 'Ajouter un exercice', exact: true }).click();
      const modal = page.getByRole('dialog');
      await modal.getByLabel('Rechercher un exercice').fill(name);
      await modal.getByRole('button').filter({ hasText: name }).first().click();
    }
    for (const name of ['Développé couché', 'Extension triceps corde'])
      await page.getByLabel(`Sélectionner ${name} pour un superset`, { exact: true }).check();
    await page.getByRole('button', { name: 'Regrouper en superset' }).click();
    await page.getByRole('button', { name: 'Enregistrer le programme' }).click();
    await expect(page).toHaveURL(/\/programmes$/);
    await page.getByRole('button', { name: /Démarrer Séance 1/ }).click();
    await expect(page).toHaveURL(/\/seances\//);
    const workoutId = page.url().split('/').at(-1)!;
    const card = page.locator('.workout-card').first();
    await card.getByLabel('Charge série 1', { exact: true }).fill('80');
    await card.getByLabel('Répétitions série 1', { exact: true }).selectOption('10');
    await card.getByLabel('Repos série 1, minutes', { exact: true }).fill('2');
    await card.getByLabel('Repos série 1, secondes', { exact: true }).fill('30');
    await card.getByRole('button', { name: 'Série 1 à effectuer', exact: true }).click();
    await expect(page.getByText('Enregistré sur le serveur', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sauver en brouillon' }).click();
    await expect(page).toHaveURL(/historique/);
    await page
      .getByRole('link', { name: /Séance 1/ })
      .first()
      .click();
    await expect(
      page.locator('.workout-card').first().getByLabel('Charge série 1', { exact: true }),
    ).toHaveValue('80');
    await page.reload();
    await expect(
      page.locator('.workout-card').first().getByLabel('Repos série 1, secondes', { exact: true }),
    ).toHaveValue('30');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Terminer la séance' }).click();
    await expect(
      page.getByRole('heading', { name: 'Bilan de la séance', exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp('/seances/' + workoutId));
    await page.goto('/statistiques');
    await page.getByLabel('Exercice analysé').selectOption('10000000-0000-4000-8000-000000000001');
    await expect(page.getByRole('img', { name: /Graphique de progression/ })).toBeVisible();
    await page.goto('/records');
    await expect(page.getByRole('heading', { name: /Développé couché/ })).toBeVisible();
    const other = await browser.newContext();
    try {
      const second = await other.newPage();
      await login(second, accounts[1]);
      const hidden = await second.request.get(`/api/workouts?id=${workoutId}`);
      expect(await hidden.json()).toEqual([]);
    } finally {
      await other.close();
    }
    await page.goto('/parametres');
    await page.getByRole('button', { name: 'Sombre', exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.goto(`/seances/${workoutId}`);
    await page.getByRole('button', { name: 'Modifier', exact: true }).click();
    await page
      .locator('.workout-card')
      .first()
      .getByLabel('Charge série 1', { exact: true })
      .fill('70');
    await expect(page.getByText('Enregistré sur le serveur', { exact: true })).toBeVisible();
    await page.goto('/records');
    await expect(page.getByText('70', { exact: false }).first()).toBeVisible();
  });
});
