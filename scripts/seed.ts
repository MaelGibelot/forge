import { createClient } from '@supabase/supabase-js';
import { catalog } from '../src/lib/catalog.ts';
import type { Database } from '../src/lib/database.types.ts';
const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  {
    auth: { persistSession: false },
  },
);
for (const e of catalog) {
  const { secondary_muscles, ...row } = e;
  const { error } = await db.from('exercises').upsert(row);
  if (error) throw error;
  const { error: musclesError } = await db
    .from('exercise_muscles')
    .upsert([
      { exercise_id: e.id, muscle: e.primary_muscle, role: 'primary' },
      ...secondary_muscles.map((muscle) => ({ exercise_id: e.id, muscle, role: 'secondary' })),
    ]);
  if (musclesError) throw musclesError;
}
console.log(`${catalog.length} exercices synchronisés.`);
