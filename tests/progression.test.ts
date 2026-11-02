import { describe, expect, it } from 'vitest';
import { catalog } from '../src/lib/catalog';
import {
  defaults,
  newEntry,
  newSet,
  startWorkout,
  setSchema,
  workoutSchema,
  type Workout,
  type WorkoutExercise,
} from '../src/lib/domain';
import { recommendation } from '../src/lib/progression';
import { duplicateWorkout } from '../src/lib/clone';
import { templateFromWorkout, workoutFromTemplate } from '../src/lib/templates';
const now = Date.now();
function movement(index = 0, reps = [12, 12, 12], weights = [80, 80, 80]): WorkoutExercise {
  const entry = newEntry(catalog[index], 0);
  return {
    ...entry,
    target: { ...entry.target, sets: reps.length, reps_min: 8, reps_max: 12 },
    technique_ok: true,
    sets: reps.map((n, i) => ({
      ...newSet(i, entry.target),
      completed: true,
      reps: n,
      weight: weights[i],
    })),
  };
}
function session(days: number, exercises: WorkoutExercise[]): Workout {
  return {
    ...startWorkout(),
    status: 'completed',
    started_at: new Date(now - days * 864e5).toISOString(),
    finished_at: new Date(now - days * 864e5 + 3600000).toISOString(),
    exercises,
  };
}
const history = () => [
  session(3, [movement()]),
  session(2, [movement()]),
  session(1, [movement()]),
];

describe('échec et propositions explicables', () => {
  it('propose 28 kg × 8 pour démarrer après 26 × 10 puis 28 × 10, malgré une série ajoutée', () => {
    const past = movement(0, [10, 10], [26, 28]);
    past.technique_ok = false;
    const entry = movement(0, [8, 8, 8], [26, 28, 28]);
    entry.sets.forEach((s) => {
      s.completed = false;
    });
    const current = { ...startWorkout(), exercises: [entry] };
    const result = recommendation(entry, [session(1, [past])], defaults, current.id, {
      workout: current,
      exercises: catalog,
    });
    expect(result.plan).toEqual([{ weight: 28, reps: 8 }]);
    expect(result.reason).toContain('28 kg × 10');
    expect(recommendation(past, [session(1, [past])], defaults).plan).toEqual([
      { weight: 28, reps: 8 },
    ]);
    expect(result.analysis?.[0]).toContain('volume n’est pas comparable');
    // A completed opening set must never turn into advice for an unproven third set.
    entry.sets[0].completed = true;
    expect(
      recommendation(entry, [session(1, [past])], defaults, current.id, {
        workout: current,
        exercises: catalog,
      }).plan,
    ).toBeUndefined();
    entry.sets[0].reached_failure = true;
    expect(
      recommendation(entry, [session(1, [past])], defaults, current.id, {
        workout: current,
        exercises: catalog,
      }).title,
    ).toBe('Échec déclaré sur cet exercice');
  });
  it('ne consolide pas une charge à peine réussie, une descente de charge ou un saut trop grand', () => {
    const entry = movement(0, [8, 8], [26, 28]);
    entry.sets.forEach((s) => {
      s.completed = false;
    });
    for (const [reps, weights] of [
      [
        [10, 8],
        [26, 28],
      ],
      [
        [10, 10],
        [28, 26],
      ],
      [
        [10, 10],
        [20, 28],
      ],
    ]) {
      const past = movement(0, reps, weights);
      expect(recommendation(entry, [session(1, [past])], defaults).plan?.length).toBe(2);
    }
    const past = movement(0, [10, 10], [26, 28]);
    past.sets[1].reached_failure = true;
    expect(recommendation(entry, [session(1, [past])], defaults).title).toContain('sans ajouter');
    expect(recommendation(entry, [session(1, [past])], defaults).plan?.[0].weight).toBe(26);
    past.sets[1].reached_failure = false;
    entry.target.reps_max = 15;
    expect(recommendation(entry, [session(1, [past])], defaults).kind).toBe('insufficient');
  });
  it('retire immédiatement la proposition de charge après un échec dans l’exercice en cours', () => {
    const entry = movement();
    entry.sets[0].reached_failure = true;
    const current = { ...startWorkout(), exercises: [entry] };
    const result = recommendation(entry, history(), defaults, current.id, {
      workout: current,
      exercises: catalog,
    });
    expect(result.title).toBe('Échec déclaré sur cet exercice');
    expect(result.plan).toBeUndefined();
  });
  it('ne compare pas un superset devenu isolé et tient compte de l’échec déclaré sur une dégressive', () => {
    const past = history();
    const grouped = past[2].exercises[0];
    grouped.group_id = crypto.randomUUID();
    expect(recommendation(movement(), past, defaults).kind).toBe('insufficient');
    grouped.group_id = null;
    grouped.sets.push({
      ...newSet(3, grouped.target),
      type: 'drop',
      weight: 60,
      reps: 10,
      completed: true,
      reached_failure: true,
    });
    expect(recommendation(movement(), past, defaults).reason).toContain('échec');
  });
  it('accepte les anciennes séries sans flag et remet le flag à zéro pour les copies/modèles', () => {
    const entry = movement();
    entry.sets[0].reached_failure = true;
    const w = session(1, [entry]);
    const { reached_failure: _flag, ...legacy } = entry.sets[0];
    expect(_flag).toBe(true);
    expect(setSchema.parse(legacy).reached_failure).toBe(false);
    expect(duplicateWorkout(w).exercises[0].sets.every((s) => !s.reached_failure)).toBe(true);
    const template = templateFromWorkout(w);
    expect(JSON.stringify(template.definition)).not.toContain('reached_failure');
    expect(workoutFromTemplate(template).exercises[0].sets.every((s) => !s.reached_failure)).toBe(
      true,
    );
    entry.sets[0].completed = false;
    expect(workoutSchema.safeParse(w).success).toBe(false);
  });
  it('confirme la performance sur deux séances et bloque la hausse après un échec déclaré', () => {
    expect(recommendation(movement(), history().slice(0, 1), defaults).kind).toBe('hold');
    const good = recommendation(movement(), history(), defaults);
    expect(good).toMatchObject({
      kind: 'increase',
      weight: 82.5,
      plan: [
        { weight: 82.5, reps: 8 },
        { weight: 82.5, reps: 8 },
        { weight: 82.5, reps: 8 },
      ],
    });
    const failed = history();
    failed[2].exercises[0].sets[0].reached_failure = true;
    expect(recommendation(movement(), failed, defaults)).toMatchObject({
      kind: 'hold',
      plan: [
        { weight: 80, reps: 12 },
        { weight: 80, reps: 12 },
        { weight: 80, reps: 12 },
      ],
    });
  });
  it('gère les charges variables sans les écraser par une charge uniforme', () => {
    const e = movement(0, [12, 12, 12], [80, 75, 70]);
    const result = recommendation(e, [session(2, [e]), session(1, [e])], defaults);
    expect(result.kind).toBe('increase');
    expect(result.weight).toBeUndefined();
    expect(result.plan?.map((s) => s.weight)).toEqual([82.5, 77.5, 72.5]);
    e.sets[2].reps = 10;
    const partial = recommendation(e, [session(1, [e])], defaults);
    expect(partial.plan).toEqual([
      { weight: 80, reps: 12 },
      { weight: 75, reps: 12 },
      { weight: 70, reps: 11 },
    ]);
  });
  it('détecte une baisse répétée des autres exercices sans comparer leurs kg entre eux', () => {
    const workouts = [3, 2, 1].map((day, i) =>
      session(day, [
        movement(),
        movement(1, [12 - i * 2, 12 - i * 2, 12 - i * 2], [40, 40, 40]),
        movement(2, [12 - i * 2, 12 - i * 2, 12 - i * 2], [15, 15, 15]),
      ]),
    );
    const result = recommendation(movement(), workouts, defaults);
    expect(result.kind).toBe('hold');
    expect(result.reason).toContain('autres exercices');
    expect(result.analysis?.some((s) => s.includes('2 sur 2'))).toBe(true);
    // One comparison and one declining exercise are insufficient to establish a global signal.
    expect(recommendation(movement(), workouts.slice(1), defaults).kind).toBe('increase');
    workouts.forEach((w) => w.exercises.pop());
    expect(recommendation(movement(), workouts, defaults).kind).toBe('increase');
  });
  it('ne transforme pas une hausse de charge accompagnée de moins de répétitions en régression', () => {
    const workouts = [3, 2, 1].map((day, i) =>
      session(day, [
        movement(),
        movement(1, [12 - i, 12 - i, 12 - i], [40 + i * 2, 40 + i * 2, 40 + i * 2]),
        movement(2, [12 - i, 12 - i, 12 - i], [15 + i, 15 + i, 15 + i]),
      ]),
    );
    expect(recommendation(movement(), workouts, defaults).kind).toBe('increase');
  });
  it('modère une hausse après deux exercices en baisse dans la séance en cours', () => {
    const past = [
      session(2, [movement(), movement(1, [10, 10, 10]), movement(2, [10, 10, 10])]),
      session(1, [movement(), movement(1, [10, 10, 10]), movement(2, [10, 10, 10])]),
    ];
    const target = { ...movement(), position: 2 };
    const current: Workout = {
      ...startWorkout(),
      exercises: [
        { ...movement(1, [8, 8, 8]), position: 0 },
        { ...movement(2, [8, 8, 8]), position: 1 },
        target,
      ],
    };
    const result = recommendation(target, past, defaults, current.id, {
      workout: current,
      exercises: catalog,
    });
    expect(result.kind).toBe('hold');
    expect(result.reason).toContain('exercices précédents');
    current.exercises[1].sets[0].completed = false;
    expect(
      recommendation(target, past, defaults, current.id, { workout: current, exercises: catalog })
        .kind,
    ).toBe('increase');
  });
  it('tient compte des échecs déjà atteints sur les muscles concernés, mais pas des exercices suivants', () => {
    const target = { ...movement(), position: 1 };
    const before = { ...movement(1), position: 0 };
    before.sets[0].reached_failure = true;
    before.sets[1].reached_failure = true;
    const current = { ...startWorkout(), exercises: [before, target] };
    expect(
      recommendation(target, history(), defaults, current.id, {
        workout: current,
        exercises: catalog,
      }).reason,
    ).toContain('déjà été déclarées');
    before.position = 2;
    expect(
      recommendation(target, history(), defaults, current.id, {
        workout: current,
        exercises: catalog,
      }).kind,
    ).toBe('increase');
  });
  it('réduit l’assistance et propose seulement des répétitions au poids du corps', () => {
    const assisted = newEntry(
      catalog.find((e) => e.load_kind === 'assisted')!,
      0,
    );
    const e: WorkoutExercise = {
      ...assisted,
      technique_ok: true,
      sets: [12, 12, 12].map((reps, i) => ({
        ...newSet(i, assisted.target, 'assisted'),
        weight: 40,
        reps,
        completed: true,
      })),
    };
    const result = recommendation(e, [session(2, [e]), session(1, [e])], defaults);
    expect(result.kind).toBe('increase');
    expect(result.plan?.every((s) => s.weight === 37.5)).toBe(true);
    const body = {
      ...e,
      load_kind: 'bodyweight' as const,
      sets: e.sets.map((s) => ({ ...s, weight: null, reps: 10 })),
    };
    expect(recommendation(body, [session(1, [body])], defaults).plan?.map((s) => s.reps)).toEqual([
      11, 10, 10,
    ]);
  });
  it('n’invente pas deux séances à partir de blocs et ignore les dates futures et la séance courante', () => {
    const w = session(1, [movement(), movement()]);
    expect(recommendation(movement(), [w], defaults).kind).toBe('insufficient');
    expect(recommendation(movement(), [session(-2, [movement()])], defaults).kind).toBe(
      'insufficient',
    );
    expect(recommendation(movement(), [w], defaults, w.id).kind).toBe('insufficient');
    const highStep = { ...movement(), increment: 20 };
    expect(recommendation(highStep, history(), defaults).title).toBe('Ajustez votre incrément');
  });
  it('ne déduit aucun échec pour le cardio et ne modifie pas l’historique', () => {
    const e = newEntry(
      catalog.find((e) => e.load_kind === 'cardio')!,
      0,
    );
    const w: Workout = {
      ...startWorkout(),
      exercises: [
        {
          ...e,
          technique_ok: false,
          sets: [
            {
              ...newSet(0, e.target, 'cardio'),
              duration_seconds: 600,
              completed: true,
              reached_failure: true,
            },
          ],
        },
      ],
    };
    expect(workoutSchema.safeParse(w).success).toBe(false);
    const past = history(),
      before = JSON.stringify(past);
    recommendation(movement(), past, defaults);
    expect(JSON.stringify(past)).toBe(before);
  });
});
