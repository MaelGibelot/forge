import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { catalog } from '../src/lib/catalog';
import { newEntry, startWorkout, newSet, type Program } from '../src/lib/domain';
import { templateFromWorkout, workoutFromTemplate } from '../src/lib/templates';
const db = new PGlite();
const alice = '20000000-0000-4000-8000-000000000001',
  bob = '20000000-0000-4000-8000-000000000002';
const program: Program = {
  id: crypto.randomUUID(),
  name: 'Programme Alice',
  description: '',
  revision: 0,
  active: true,
  days: [
    {
      id: crypto.randomUUID(),
      name: 'Push',
      position: 0,
      groups: [],
      exercises: [newEntry(catalog[0], 0)],
    },
  ],
};
async function asUser(id: string) {
  await db.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
  );
}
async function rpc(name: string, payload: unknown) {
  return db.query<{ revision: number }>(`select public.${name}($1::jsonb) as revision`, [
    JSON.stringify(payload),
  ]);
}
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${alice}'),('${bob}');`,
  );
  for (const file of readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  }
  await db.exec(readFileSync('supabase/seed.sql', 'utf8'));
}, 60000);
afterAll(async () => {
  await db.close();
});
describe('PostgreSQL embarqué : migrations, transactions et RLS', () => {
  it('persiste le profil, les paliers et le ressenti privé sans modifier les objectifs fixes', async () => {
    const base = newEntry(catalog[0], 0);
    const e = {
      ...base,
      target: { ...base.target, reps_min: 10, reps_max: 10 },
      technique_ok: true,
      feedback: { effort: 'controlled', recovery: 'good', pain: false, technique_issue: true },
      sets: [{ ...newSet(0, base.target), weight: 70, reps: 10, completed: true }],
    };
    const w = { ...startWorkout(), exercises: [e] };
    await asUser(alice);
    await db.query(
      'insert into public.user_preferences(user_id,coaching) values($1,$2) on conflict(user_id) do update set coaching=excluded.coaching',
      [alice, JSON.stringify({ goal: 'strength', level: 'advanced' })],
    );
    await db.query(
      'insert into public.exercise_progression(user_id,exercise_id,available_weights) values($1,$2,$3) on conflict(user_id,exercise_id) do update set available_weights=excluded.available_weights',
      [alice, e.exercise_id, [70, 71, 72.5]],
    );
    await rpc('save_workout', w);
    const read = await db.query<{ w: (typeof w)[] }>(
      'select public.read_workouts(0,30,null,$1) w',
      [w.id],
    );
    expect(read.rows[0].w[0].exercises[0].feedback).toEqual(e.feedback);
    expect(read.rows[0].w[0].exercises[0].target.reps_max).toBe(10);
    expect(
      (
        await db.query<{ coaching: { goal: string } }>(
          'select coaching from public.user_preferences where user_id=$1',
          [alice],
        )
      ).rows[0].coaching.goal,
    ).toBe('strength');
    await asUser(bob);
    expect(
      (await db.query('select feedback from public.workout_exercises where id=$1', [e.id])).rows,
    ).toHaveLength(0);
    expect(
      (await db.query('select coaching from public.user_preferences where user_id=$1', [alice]))
        .rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "update public.user_preferences set coaching='{}' where user_id=$1 returning user_id",
          [alice],
        )
      ).rows,
    ).toHaveLength(0);
    await asUser(alice);
    await expect(
      db.query(
        "update public.workout_exercises set feedback='{" + '"pain":"oui"' + "}' where id=$1",
        [e.id],
      ),
    ).rejects.toThrow();
    await expect(
      db.query('update public.exercise_progression set available_weights=$1 where exercise_id=$2', [
        [-1],
        e.exercise_id,
      ]),
    ).rejects.toThrow();
    await db.exec('reset role');
    await db.query('delete from public.workout_sessions where id=$1', [w.id]);
    await db.query('delete from public.exercise_progression where user_id=$1', [alice]);
    await db.query('delete from public.user_preferences where user_id=$1', [alice]);
  });
  it('persiste l’échec, isole les comptes et refuse les échecs sur des séries non effectuées ou cardio', async () => {
    const entry = newEntry(catalog[0], 0);
    const w = {
      ...startWorkout(),
      exercises: [
        {
          ...entry,
          technique_ok: true,
          sets: [
            {
              ...newSet(0, entry.target),
              weight: 60,
              reps: 10,
              completed: true,
              reached_failure: true,
            },
          ],
        },
      ],
    };
    await asUser(alice);
    await rpc('save_workout', w);
    const read = await db.query<{ w: (typeof w)[] }>(
      'select public.read_workouts(0,30,null,$1) w',
      [w.id],
    );
    expect(read.rows[0].w[0].exercises[0].sets[0].reached_failure).toBe(true);
    await asUser(bob);
    expect(
      (
        await db.query('select reached_failure from public.workout_sets where id=$1', [
          w.exercises[0].sets[0].id,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          'update public.workout_sets set reached_failure=false where id=$1 returning id',
          [w.exercises[0].sets[0].id],
        )
      ).rows,
    ).toHaveLength(0);
    await asUser(alice);
    await expect(
      db.query('update public.workout_sets set completed=false where id=$1', [
        w.exercises[0].sets[0].id,
      ]),
    ).rejects.toThrow();
    const cardio = newEntry(
      catalog.find((e) => e.load_kind === 'cardio')!,
      0,
    );
    const invalid = {
      ...startWorkout(),
      exercises: [
        {
          ...cardio,
          technique_ok: false,
          sets: [
            {
              ...newSet(0, cardio.target, 'cardio'),
              duration_seconds: 600,
              completed: true,
              reached_failure: true,
            },
          ],
        },
      ],
    };
    await expect(rpc('save_workout', invalid)).rejects.toThrow();
    expect(
      (await db.query('select id from public.workout_sessions where id=$1', [invalid.id])).rows,
    ).toHaveLength(0);
    await db.exec('reset role');
    await db.query('delete from public.workout_sessions where id=$1', [w.id]);
  });
  it('sauvegarde les modèles privés, interdit leur transfert et lance une séance sans résultats', async () => {
    const entry = newEntry(catalog[0], 0);
    const source = {
      ...startWorkout(),
      exercises: [
        {
          ...entry,
          technique_ok: true,
          sets: [{ ...newSet(0, entry.target), weight: 60, reps: 10, completed: true }],
        },
      ],
    };
    const t = templateFromWorkout(source);
    await asUser(alice);
    await db.query(
      'insert into public.workout_templates(id,user_id,name,definition) values($1,$2,$3,$4)',
      [t.id, alice, t.name, JSON.stringify(t.definition)],
    );
    expect((await db.query('select * from public.workout_templates')).rows).toHaveLength(1);
    await asUser(bob);
    expect((await db.query('select * from public.workout_templates')).rows).toHaveLength(0);
    expect(
      (
        await db.query('update public.workout_templates set name=$1 where id=$2 returning id', [
          'Interdit',
          t.id,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (await db.query('delete from public.workout_templates where id=$1 returning id', [t.id]))
        .rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        'insert into public.workout_templates(id,user_id,name,definition) values($1,$2,$3,$4)',
        [crypto.randomUUID(), alice, t.name, JSON.stringify(t.definition)],
      ),
    ).rejects.toThrow();
    await asUser(alice);
    await expect(
      db.query('update public.workout_templates set user_id=$1 where id=$2', [bob, t.id]),
    ).rejects.toThrow();
    await db.query(
      'update public.workout_templates set name=$1,revision=2 where id=$2 and revision=1',
      ['Renommé', t.id],
    );
    expect(
      (
        await db.query(
          'delete from public.workout_templates where id=$1 and revision=1 returning id',
          [t.id],
        )
      ).rows,
    ).toHaveLength(0);
    const next = workoutFromTemplate(t);
    await rpc('save_workout', next);
    const read = await db.query<{ w: (typeof next)[] }>(
      'select public.read_workouts(0,30,null,$1) w',
      [next.id],
    );
    expect(read.rows[0].w[0].exercises[0].sets[0]).toMatchObject({
      weight: null,
      reps: 0,
      completed: false,
    });
    await db.exec('reset role;set role anon;');
    await expect(db.query('select * from public.workout_templates')).rejects.toThrow();
    await db.exec('reset role');
    await db.query('delete from public.workout_sessions where id=$1', [next.id]);
  });
  it('enregistre et isole les intervalles cardio, y compris lors d’un accès SQL direct', async () => {
    await asUser(alice);
    const machine = catalog.find((e) => e.load_kind === 'cardio')!;
    const entry = newEntry(machine, 0);
    const w = {
      ...startWorkout(),
      status: 'completed' as const,
      finished_at: new Date().toISOString(),
      exercises: [
        {
          ...entry,
          technique_ok: false,
          sets: [
            {
              ...newSet(0, entry.target, 'cardio'),
              duration_seconds: 1800,
              distance_km: 5.2,
              completed: true,
            },
          ],
        },
      ],
    };
    const saved = await rpc('save_workout', w);
    const revision = saved.rows[0].revision;
    const read = await db.query<{ w: (typeof w)[] }>(
      'select public.read_workouts(0,30,null,$1::uuid) as w',
      [w.id],
    );
    expect(read.rows[0].w[0].exercises[0].sets[0]).toMatchObject({
      duration_seconds: 1800,
      distance_km: 5.2,
      reps: 0,
      weight: null,
    });
    const invalid = structuredClone(w);
    invalid.revision = revision;
    invalid.exercises[0].sets[0].reps = 10;
    await expect(rpc('save_workout', invalid)).rejects.toThrow('Intervalle cardio invalide');
    expect(
      (
        await db.query('select duration_seconds from public.workout_sets where id=$1', [
          w.exercises[0].sets[0].id,
        ])
      ).rows,
    ).toEqual([{ duration_seconds: 1800 }]);
    await asUser(bob);
    expect(
      (await db.query('select * from public.workout_sets where id=$1', [w.exercises[0].sets[0].id]))
        .rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          'update public.workout_sets set duration_seconds=20 where id=$1 returning id',
          [w.exercises[0].sets[0].id],
        )
      ).rows,
    ).toHaveLength(0);
    await db.exec('reset role');
    await db.query('delete from public.workout_sessions where id=$1', [w.id]);
  });
  it('installe le catalogue complet sans doublons au re-seed', async () => {
    await db.exec(readFileSync('supabase/seed.sql', 'utf8'));
    const r = await db.query<{ n: number }>('select count(*)::int n from public.exercises');
    expect(r.rows[0].n).toBe(catalog.length);
  });
  it('active RLS sur chaque table publique et privée', async () => {
    const r = await db.query<{ n: number }>(
      "select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' and not c.relrowsecurity",
    );
    expect(r.rows[0].n).toBe(0);
  });
  it('sauvegarde et relit un programme normalisé', async () => {
    await asUser(alice);
    const r = await rpc('save_program', program);
    expect(r.rows[0].revision).toBe(1);
    const read = await db.query<{ p: Program[] }>('select public.read_programs() as p');
    expect(read.rows[0].p[0].days[0].exercises[0].target.sets).toBe(3);
  });
  it('isole Alice et Bob même en accès SQL direct', async () => {
    await asUser(bob);
    expect((await db.query('select * from public.programs')).rows).toHaveLength(0);
    expect((await db.query('select * from public.program_days')).rows).toHaveLength(0);
    expect((await db.query('select * from public.program_exercises')).rows).toHaveLength(0);
    const r = await db.query('update public.programs set name=$1 where id=$2 returning id', [
      'Hacked',
      program.id,
    ]);
    expect(r.rows).toHaveLength(0);
    await expect(
      db.query(
        'insert into public.program_days(id,user_id,program_id,name,position) values($1,$2,$3,$4,0)',
        [crypto.randomUUID(), bob, program.id, 'Intrusion'],
      ),
    ).rejects.toThrow();
  });
  it('refuse la lecture des identifiants techniques et des limites depuis un compte', async () => {
    await asUser(bob);
    await expect(db.query("select public.resolve_login('alice')")).rejects.toThrow();
    await expect(db.query('select * from private.login_identities')).rejects.toThrow();
    await expect(db.query("select public.consume_login_attempt('x',8)")).rejects.toThrow();
  });
  it('refuse les exercices privés d’un autre compte', async () => {
    await asUser(alice);
    const id = crypto.randomUUID();
    await db.query(
      "insert into public.exercises(id,user_id,name,equipment,primary_muscle) values($1,$2,'Personnel','Barre','Dos')",
      [id, alice],
    );
    await asUser(bob);
    expect((await db.query('select * from public.exercises where id=$1', [id])).rows).toHaveLength(
      0,
    );
    const p = {
      ...program,
      id: crypto.randomUUID(),
      days: [
        {
          ...program.days[0],
          id: crypto.randomUUID(),
          exercises: [
            { ...program.days[0].exercises[0], id: crypto.randomUUID(), exercise_id: id },
          ],
        },
      ],
    };
    await expect(rpc('save_program', p)).rejects.toThrow();
    expect((await db.query('select * from public.programs')).rows).toHaveLength(0);
  });
  it('détecte une sauvegarde obsolète sans réécrire les données', async () => {
    await asUser(alice);
    await rpc('save_program', { ...program, revision: 1, name: 'Modifié' });
    await expect(rpc('save_program', { ...program, revision: 1, name: 'Écrasé' })).rejects.toThrow(
      'CONFLICT',
    );
    expect(
      (await db.query<{ name: string }>('select name from public.programs')).rows[0].name,
    ).toBe('Modifié');
  });
  it('préserve un instantané et ses séries après modification du programme', async () => {
    await asUser(alice);
    const w = startWorkout(program.days[0]);
    w.exercises[0].sets[0] = {
      ...newSet(0, w.exercises[0].target),
      weight: 80,
      reps: 10,
      completed: true,
      rpe: 8,
      rir: 2,
      rest_seconds: 150,
    };
    w.status = 'completed';
    w.finished_at = new Date().toISOString();
    const r = await rpc('save_workout', w);
    expect(r.rows[0].revision).toBe(1);
    await rpc('save_program', {
      ...program,
      revision: 2,
      days: [{ ...program.days[0], exercises: [] }],
    });
    const read = await db.query<{ w: (typeof w)[] }>('select public.read_workouts() w');
    expect(read.rows[0].w[0].exercises[0].sets[0]).toMatchObject({
      weight: 80,
      reps: 10,
      rest_seconds: 150,
    });
    await asUser(bob);
    expect((await db.query('select * from public.workout_sets')).rows).toHaveLength(0);
    expect((await db.query<{ w: unknown[] }>('select public.read_workouts() w')).rows[0].w).toEqual(
      [],
    );
  });
  it('applique les contraintes numériques en base', async () => {
    await asUser(alice);
    await expect(
      db.query(
        "insert into public.bodyweight_entries(user_id,date,weight) values($1,'2026-10-16',-2)",
        [alice],
      ),
    ).rejects.toThrow();
  });
  it('sauvegarde les tours de superset et annule toute écriture si une série est invalide', async () => {
    await asUser(alice);
    const a = newEntry(catalog[0], 0),
      b = newEntry(catalog[1], 1);
    const group = { id: crypto.randomUUID(), name: 'A', rounds: 3, rest_seconds: 90 };
    a.group_id = group.id;
    b.group_id = group.id;
    const w = startWorkout({
      id: crypto.randomUUID(),
      name: 'Superset',
      position: 0,
      groups: [group],
      exercises: [a, b],
    });
    w.source_day_id = null;
    w.round_rests = [{ group_id: w.groups[0].id, round: 1, rest_seconds: 100 }];
    expect((await rpc('save_workout', w)).rows[0].revision).toBe(1);
    w.revision = 1;
    w.name = 'Ne doit pas persister';
    w.exercises[1].sets[0].weight = -1;
    await expect(rpc('save_workout', w)).rejects.toThrow();
    const read = await db.query<{ w: (typeof w)[] }>(
      'select public.read_workouts(0,30,null,$1) w',
      [w.id],
    );
    expect(read.rows[0].w[0].name).toBe('Superset');
    expect(read.rows[0].w[0].revision).toBe(1);
    expect(read.rows[0].w[0].round_rests[0].rest_seconds).toBe(100);
    await expect(rpc('save_workout', { ...read.rows[0].w[0], revision: 99 })).rejects.toThrow(
      'CONFLICT',
    );
  });
  it('isole le poids et supprime les données privées en cascade', async () => {
    await asUser(alice);
    await db.query(
      "insert into public.bodyweight_entries(user_id,date,weight) values($1,'2026-10-16',75)",
      [alice],
    );
    await asUser(bob);
    expect((await db.query('select * from public.bodyweight_entries')).rows).toHaveLength(0);
    await db.exec('reset role');
    await db.query('delete from auth.users where id=$1', [alice]);
    for (const table of [
      'programs',
      'program_days',
      'program_exercises',
      'workout_sessions',
      'workout_exercises',
      'workout_sets',
      'bodyweight_entries',
      'workout_templates',
    ])
      expect((await db.query(`select * from public.${table}`)).rows).toHaveLength(0);
  });
  it('limite les essais de façon persistante et atomique', async () => {
    await db.exec('reset role;set role service_role;');
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        db.query<{ ok: boolean }>("select public.consume_login_attempt('test-user',8) ok"),
      ),
    );
    expect(results.filter((r) => r.rows[0].ok)).toHaveLength(8);
  });
});
