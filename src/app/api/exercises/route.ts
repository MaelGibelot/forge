import { z } from 'zod';
import { authenticated } from '@/lib/supabase/server';
import { ok, failure, originCheck, json, dbCheck } from '@/lib/http';
import { muscles, equipment } from '@/lib/domain';
export async function POST(request: Request) {
  try {
    originCheck(request);
    const { db, user } = await authenticated();
    const p = z
      .object({
        name: z.string().trim().min(1).max(120),
        equipment: z.enum(equipment),
        primary_muscle: z.enum(muscles),
        load_kind: z.enum(['external', 'bodyweight', 'assisted']),
        description: z.string().max(2000),
        instructions: z.array(z.string().max(500)).max(10),
      })
      .parse(await json(request));
    const { error } = await db
      .from('exercises')
      .insert({ ...p, user_id: user.id, category: 'Personnalisé', supports_1rm: false });
    dbCheck(error);
    return ok({ success: true });
  } catch (e) {
    return failure(e);
  }
}
