import { writeFileSync } from 'node:fs';
import { catalog } from '../src/lib/catalog.ts';
const sql = (s: string) => `'${s.replaceAll("'", "''")}'`;
const statements = ['-- Catalogue original FORGE. Réexécutable.'];
for (const e of catalog) {
  statements.push(
    `insert into public.exercises(id,name,english_name,description,category,equipment,primary_muscle,instructions,tips,mistakes,load_kind,supports_1rm) values (${sql(e.id)},${sql(e.name)},${e.english_name ? sql(e.english_name) : 'null'},${sql(e.description)},${sql(e.category)},${sql(e.equipment)},${sql(e.primary_muscle)},array[${e.instructions.map(sql).join(',')}],${sql(e.tips)},${sql(e.mistakes)},${sql(e.load_kind)},${e.supports_1rm}) on conflict(id) do nothing;`,
  );
  statements.push(
    `insert into public.exercise_muscles values (${sql(e.id)},${sql(e.primary_muscle)},'primary')${e.secondary_muscles.map((m) => `,(${sql(e.id)},${sql(m)},'secondary')`).join('')} on conflict do nothing;`,
  );
}
writeFileSync('supabase/seed.sql', statements.join('\n') + '\n');
console.log(`${catalog.length} exercices générés.`);
