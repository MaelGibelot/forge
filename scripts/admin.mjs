import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { emitKeypressEvents } from 'node:readline';
const [command, rawUsername, ...nameParts] = process.argv.slice(2);
const username = rawUsername?.toLowerCase();
if (
  !['create', 'reset'].includes(command) ||
  !username ||
  !/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username)
) {
  console.error('Usage : npm run admin -- create identifiant "Pseudo" | reset identifiant');
  process.exit(1);
}
const domain = process.env.AUTH_IDENTITY_DOMAIN;
if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain))
  throw new Error('AUTH_IDENTITY_DOMAIN doit être un domaine technique que vous contrôlez.');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function readPassword() {
  if (!process.stdin.isTTY)
    throw new Error('Utilisez un terminal interactif pour la saisie masquée.');
  process.stdout.write('Mot de passe (12 caractères minimum) : ');
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let text = '';
    const handler = (str, key) => {
      if (key?.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('Annulé'));
      } else if (key?.name === 'return') {
        cleanup();
        resolve(text);
      } else if (key?.name === 'backspace') {
        text = text.slice(0, -1);
      } else if (str && !key?.ctrl && !key?.meta) text += str;
    };
    function cleanup() {
      process.stdin.removeListener('keypress', handler);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    }
    process.stdin.on('keypress', handler);
  });
}
const password = await readPassword();
if (password.length < 12 || password.length > 128) throw new Error('12 à 128 caractères requis.');
const check = (r) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};
if (command === 'create') {
  const email = `${randomUUID()}@${domain}`;
  const user = check(await db.auth.admin.createUser({ email, password, email_confirm: true })).user;
  try {
    check(
      await db.rpc('register_login', {
        login: username,
        identity: user.id,
        technical_email: email,
      }),
    );
    check(
      await db
        .from('profiles')
        .insert({ user_id: user.id, display_name: nameParts.join(' ') || username }),
    );
    check(await db.from('user_preferences').insert({ user_id: user.id, max_rpe: 9, min_rir: 1 }));
  } catch (e) {
    const rollback = await db.auth.admin.deleteUser(user.id);
    if (rollback.error)
      console.error('Création partielle : supprimer le compte dans Supabase Auth :', user.id);
    throw e;
  }
  console.log(`Compte ${username} créé. Aucun email envoyé.`);
} else {
  const id = check(await db.rpc('lookup_login_user', { login: username }));
  if (!id) throw new Error('Identifiant introuvable.');
  // Password update does not revoke existing JWTs; see README for revocation.
  check(await db.auth.admin.updateUserById(id, { password, ban_duration: 'none' }));
  console.log(
    `Mot de passe réinitialisé pour ${username}. Révoquez les sessions existantes dans Supabase Auth si nécessaire.`,
  );
}
