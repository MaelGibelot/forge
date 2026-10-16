import { z } from 'zod';
import { authenticated, ApiError } from '@/lib/supabase/server';
import { ok, failure, originCheck, json, dbCheck } from '@/lib/http';
import { programSchema } from '@/lib/domain';
export async function POST(request: Request) {
  try {
    originCheck(request);
    const { db } = await authenticated();
    const payload = programSchema.parse(await json(request));
    const { data, error } = await db.rpc('save_program', { payload });
    dbCheck(error);
    return ok({ revision: data });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request) {
  try {
    originCheck(request);
    const { db, user } = await authenticated();
    const { id, revision } = z
      .object({ id: z.uuid(), revision: z.number().int().positive() })
      .parse(await json(request));
    const { data, error } = await db
      .from('programs')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('revision', revision)
      .select('id');
    dbCheck(error);
    if (!data?.length) throw new ApiError('Le programme a changé. Rechargez la page.', 409);
    return ok({ success: true });
  } catch (e) {
    return failure(e);
  }
}
