import { authenticated } from '@/lib/supabase/server';
import { ok, failure, originCheck, json, dbCheck } from '@/lib/http';
import { preferencesSchema, progressionSchema } from '@/lib/domain';
export async function PUT(request: Request) {
  try {
    originCheck(request);
    const { db, user } = await authenticated();
    const { display_name, ...prefs } = preferencesSchema.parse(await json(request));
    const a = await db.from('profiles').update({ display_name }).eq('user_id', user.id);
    dbCheck(a.error);
    const b = await db.from('user_preferences').upsert({ ...prefs, user_id: user.id });
    dbCheck(b.error);
    return ok({ success: true });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  try {
    originCheck(request);
    const { db, user } = await authenticated();
    const p = progressionSchema.parse(await json(request));
    const { error } = await db.from('exercise_progression').upsert({ ...p, user_id: user.id });
    dbCheck(error);
    return ok({ success: true });
  } catch (e) {
    return failure(e);
  }
}
