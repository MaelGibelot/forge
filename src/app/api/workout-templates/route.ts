import { z } from 'zod';
import { authenticated, ApiError } from '@/lib/supabase/server';
import { ok, failure, originCheck, json, dbCheck } from '@/lib/http';
import { templateSchema } from '@/lib/templates';

export async function GET() {
  try {
    const { db, user } = await authenticated();
    const { data, error } = await db
      .from('workout_templates')
      .select('id,revision,name,definition')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    dbCheck(error);
    return ok(templateSchema.array().parse(data));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    originCheck(request);
    const { db, user } = await authenticated();
    const t = templateSchema.parse(await json(request));
    const { data, error } = await db
      .from('workout_templates')
      .insert({ id: t.id, user_id: user.id, name: t.name, definition: t.definition })
      .select('id,revision,name,definition')
      .single();
    if (error?.code === '23505') {
      const existing = await db
        .from('workout_templates')
        .select('id,revision,name,definition')
        .eq('id', t.id)
        .eq('user_id', user.id)
        .maybeSingle();
      dbCheck(existing.error);
      if (existing.data) return ok(templateSchema.parse(existing.data));
    }
    dbCheck(error);
    return ok(templateSchema.parse(data));
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  try {
    originCheck(request);
    const { db, user } = await authenticated();
    const p = z
      .object({
        id: z.uuid(),
        revision: z.number().int().positive(),
        name: z.string().trim().min(1).max(100),
      })
      .parse(await json(request));
    const { data, error } = await db
      .from('workout_templates')
      .update({ name: p.name, revision: p.revision + 1 })
      .eq('id', p.id)
      .eq('user_id', user.id)
      .eq('revision', p.revision)
      .select('id,revision,name,definition');
    dbCheck(error);
    if (!data?.length) throw new ApiError('Ce modèle a changé. Rechargez la liste.', 409);
    return ok(templateSchema.parse(data[0]));
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request) {
  try {
    originCheck(request);
    const { db, user } = await authenticated();
    const p = z
      .object({ id: z.uuid(), revision: z.number().int().positive() })
      .parse(await json(request));
    const { data, error } = await db
      .from('workout_templates')
      .delete()
      .eq('id', p.id)
      .eq('user_id', user.id)
      .eq('revision', p.revision)
      .select('id');
    dbCheck(error);
    if (!data?.length) throw new ApiError('Ce modèle a changé. Rechargez la liste.', 409);
    return ok({ success: true });
  } catch (e) {
    return failure(e);
  }
}
