import { z } from 'zod';
import { authenticated, admin, ApiError } from '@/lib/supabase/server';
import { ok, failure, originCheck, json, dbCheck } from '@/lib/http';
async function reauthenticate(request: Request) {
  originCheck(request);
  const { db, user } = await authenticated();
  const p = z
    .object({
      password: z.string().min(1).max(128),
      new_password: z.string().min(12).max(128).optional(),
      confirmation: z.string().optional(),
    })
    .parse(await json(request));
  const { error } = await db.auth.signInWithPassword({ email: user.email!, password: p.password });
  if (error) throw new ApiError('Mot de passe actuel incorrect.', 401);
  return { db, user, p };
}
export async function PATCH(request: Request) {
  try {
    const { db, p } = await reauthenticate(request);
    if (!p.new_password) throw new ApiError('Nouveau mot de passe requis.');
    const { error } = await db.auth.updateUser({ password: p.new_password });
    dbCheck(error);
    return ok({ success: true });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request) {
  try {
    const { db, user, p } = await reauthenticate(request);
    if (p.confirmation !== 'SUPPRIMER') throw new ApiError('Saisissez SUPPRIMER pour confirmer.');
    const signed = await db.auth.signOut({ scope: 'global' });
    dbCheck(signed.error);
    const { error } = await admin().auth.admin.deleteUser(user.id);
    dbCheck(error);
    return ok({ success: true });
  } catch (e) {
    return failure(e);
  }
}
