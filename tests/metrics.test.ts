import { describe, it, expect } from 'vitest';
import { catalog } from '../src/lib/catalog';
import {
  defaults,
  newEntry,
  newSet,
  startWorkout,
  setSchema,
  programSchema,
  workoutSchema,
  type Workout,
  type WorkoutExercise,
} from '../src/lib/domain';
import {
  setVolume,
  workoutVolume,
  estimated1RM,
  records,
  recommendation,
  exerciseFrequency,
} from '../src/lib/metrics';
import { duplicateProgram, duplicateWorkout } from '../src/lib/clone';
function exercise(reps = [10, 10, 10], weight = 80): WorkoutExercise {
  const e = newEntry(catalog[0], 0);
  return {
    ...e,
    target: { ...e.target, reps_min: 8, reps_max: 10, sets: 3 },
    technique_ok: true,
    sets: reps.map((r, i) => ({ ...newSet(i, e.target), reps: r, weight, completed: true })),
  };
}
function session(e = exercise(), index = 1): Workout {
  return {
    ...startWorkout(),
    exercises: [e],
    status: 'completed',
    started_at: `2026-10-${String(index).padStart(2, '0')}T10:00:00Z`,
    finished_at: `2026-10-${String(index).padStart(2, '0')}T11:00:00Z`,
  };
}
describe('mesures', () => {
  it('compte une pratique par séance et exclut brouillons, séries non validées et échauffements seuls', () => {
    const e = exercise();
    const a = session(e);
    a.exercises.push({ ...e, id: crypto.randomUUID() });
    const warmup = session({ ...e, sets: e.sets.map((s) => ({ ...s, type: 'warmup' })) });
    const undone = session({ ...e, sets: e.sets.map((s) => ({ ...s, completed: false })) });
    const before = JSON.stringify([a, warmup, undone]);
    const counts = exerciseFrequency([
      a,
      session(e),
      warmup,
      undone,
      { ...session(e), status: 'draft' },
    ]);
    expect(counts.get(e.exercise_id)).toBe(2);
    expect(JSON.stringify([a, warmup, undone])).toBe(before);
  });
  it('additionne deux blocs du même exercice dans le record de volume par séance', () => {
    const e = exercise();
    const w = session(e);
    w.exercises.push({ ...exercise(), exercise_id: e.exercise_id });
    expect(records([w])[0].volume).toBe(4800);
  });
  it('calcule le volume des seules séries éligibles', () => {
    const e = exercise();
    e.sets[0].type = 'warmup';
    e.sets[1].completed = false;
    expect(workoutVolume(session(e))).toBe(800);
    expect(workoutVolume(session(e), true)).toBe(1600);
  });
  it('exclut le poids du corps et l’assistance', () => {
    expect(setVolume(exercise().sets[0], 'bodyweight')).toBe(0);
    expect(setVolume(exercise().sets[0], 'assisted')).toBe(0);
  });
  it('utilise Epley uniquement pour des séries normales adaptées', () => {
    const e = exercise();
    expect(estimated1RM(e.sets[0], e)).toBeCloseTo(106.666, 2);
    expect(estimated1RM({ ...e.sets[0], reps: 1 }, e)).toBe(80);
    for (const s of [
      { ...e.sets[0], reps: 11 },
      { ...e.sets[0], type: 'drop' as const },
      { ...e.sets[0], weight: null },
      { ...e.sets[0], completed: false },
    ])
      expect(estimated1RM(s, e)).toBeNull();
    expect(estimated1RM(e.sets[0], { ...e, supports_1rm: false })).toBeNull();
  });
  it('recalcule les records après modification et suppression', () => {
    const old = session(exercise([8, 8, 8], 80), 1),
      recent = session(exercise([8, 8, 8], 85), 2);
    expect(records([old, recent])[0].max_weight).toBe(85);
    recent.exercises[0].sets.forEach((s) => (s.weight = 75));
    expect(records([old, recent])[0].max_weight).toBe(80);
    expect(records([recent])[0].max_weight).toBe(75);
    expect(records([])).toEqual([]);
  });
  it('ignore les brouillons et conserve les records par répétitions', () => {
    const w = session();
    expect(records([{ ...w, status: 'draft' }])).toEqual([]);
    expect(records([w])[0].by_reps[10]).toBe(80);
  });
});
describe('validation', () => {
  it.each([
    { weight: -1 },
    { weight: NaN },
    { reps: 1.5 },
    { reps: -1 },
    { rest_seconds: 7201 },
    { rest_seconds: 1.5 },
    { rpe: 11 },
    { rir: -1 },
  ])('rejette les valeurs incohérentes %j', (patch) => {
    expect(setSchema.safeParse({ ...exercise().sets[0], ...patch }).success).toBe(false);
  });
  it('autorise charge nulle, RPE et RIR absents, repos facultatif', () => {
    expect(
      setSchema.parse({
        ...exercise().sets[0],
        weight: null,
        rpe: null,
        rir: null,
        rest_seconds: null,
      }),
    ).toBeTruthy();
  });
  it('interdit une séance vide terminée ou un repos superset invalide', () => {
    expect(workoutSchema.safeParse({ ...session(), exercises: [] }).success).toBe(false);
    expect(
      workoutSchema.safeParse({
        ...session(),
        round_rests: [{ group_id: crypto.randomUUID(), round: 1, rest_seconds: 60 }],
      }).success,
    ).toBe(false);
  });
  it('isole les instantanés et les identifiants de chaque séance', () => {
    const g = { id: crypto.randomUUID(), name: 'A', rounds: 3, rest_seconds: 90 };
    const a = exercise(),
      b = exercise();
    a.group_id = g.id;
    b.group_id = g.id;
    const d = {
      id: crypto.randomUUID(),
      name: 'Push',
      position: 0,
      groups: [g],
      exercises: [a, b],
    };
    const one = startWorkout(d),
      two = startWorkout(d);
    expect(one.groups[0].id).not.toBe(two.groups[0].id);
    expect(one.exercises[0].group_id).toBe(one.groups[0].id);
    d.exercises[0].target.reps_min = 15;
    expect(one.exercises[0].target.reps_min).toBe(8);
  });
  it('duplique programmes et séances avec des IDs indépendants', () => {
    const a = exercise(),
      b = exercise();
    const g = { id: crypto.randomUUID(), name: 'A', rounds: 3, rest_seconds: 90 };
    a.group_id = g.id;
    b.group_id = g.id;
    const p = programSchema.parse({
      id: crypto.randomUUID(),
      revision: 2,
      name: 'PPL',
      description: '',
      active: true,
      days: [
        { id: crypto.randomUUID(), name: 'Push', position: 0, groups: [g], exercises: [a, b] },
      ],
    });
    const copy = duplicateProgram(p);
    expect(copy.id).not.toBe(p.id);
    expect(copy.days[0].groups[0].id).toBe(copy.days[0].exercises[0].group_id);
    expect(copy.revision).toBe(0);
    const w = duplicateWorkout(session());
    expect(w.status).toBe('draft');
    expect(w.exercises[0].sets.every((s) => !s.completed)).toBe(true);
  });
});
describe('surcharge progressive reproductible', () => {
  it('suggère l’incrément configuré après validation de toutes les séries', () => {
    const e = exercise();
    expect(recommendation(e, [session(e)], defaults)).toMatchObject({
      kind: 'increase',
      weight: 82.5,
    });
  });
  it('accepte l’absence de RPE/RIR quand la technique et l’effort sont validés', () => {
    expect(recommendation(exercise(), [session()], defaults).kind).toBe('increase');
  });
  it('refuse la hausse sans validation ou si l’effort dépasse le seuil', () => {
    const e = exercise();
    e.technique_ok = false;
    expect(recommendation(e, [session(e)], defaults).kind).toBe('hold');
    e.technique_ok = true;
    e.sets[0].rpe = 10;
    expect(recommendation(e, [session(e)], defaults).kind).toBe('hold');
    e.sets[0].rpe = null;
    e.sets[0].rir = 0;
    expect(recommendation(e, [session(e)], defaults).kind).toBe('hold');
  });
  it('recommande des répétitions pour une progression partielle', () => {
    const e = exercise([10, 9, 8]);
    expect(recommendation(e, [session(e)], defaults).kind).toBe('reps');
  });
  it('stabilise sous la borne basse', () => {
    const e = exercise([7, 8, 8]);
    expect(recommendation(e, [session(e)], defaults).kind).toBe('hold');
  });
  it('signale trois baisses comparables mais pas une seule mauvaise séance', () => {
    const a = session(exercise([10, 10, 10]), 1),
      b = session(exercise([9, 9, 9]), 2),
      c = session(exercise([8, 8, 8]), 3);
    expect(recommendation(exercise(), [a, b, c], defaults).kind).toBe('fatigue');
    expect(recommendation(exercise(), [a, b], defaults).kind).toBe('reps');
  });
  it('ne confond pas changement de programme et progression', () => {
    const e = exercise();
    e.target.sets = 4;
    expect(recommendation(exercise(), [session(e)], defaults).kind).toBe('insufficient');
  });
  it('ignore échauffements et séries incomplètes', () => {
    const e = exercise();
    e.sets.push({ ...e.sets[0], id: crypto.randomUUID(), type: 'warmup', weight: 20, reps: 5 });
    expect(recommendation(e, [session(e)], defaults).kind).toBe('increase');
    e.sets[0].completed = false;
    expect(recommendation(e, [session(e)], defaults).kind).toBe('insufficient');
  });
  it('stabilise en cas de repos sensiblement différents', () => {
    const a = exercise(),
      b = exercise();
    a.sets.forEach((s) => (s.rest_seconds = 120));
    b.sets.forEach((s) => (s.rest_seconds = 240));
    expect(recommendation(b, [session(a, 1), session(b, 2)], defaults).kind).toBe('hold');
  });
  it('ne crée aucune tendance sans historique et respecte la désactivation', () => {
    expect(recommendation(exercise(), [], defaults).kind).toBe('insufficient');
    expect(
      recommendation(exercise(), [session()], { ...defaults, recommendations: false }).kind,
    ).toBe('disabled');
  });
  it('recalcule après suppression ou modification de l’historique', () => {
    const e = exercise();
    expect(recommendation(e, [session(e)], defaults).kind).toBe('increase');
    e.sets[0].reps = 7;
    expect(recommendation(e, [session(e)], defaults).kind).toBe('hold');
    expect(recommendation(e, [], defaults).kind).toBe('insufficient');
  });
  it('ne modifie jamais les données analysées', () => {
    const e = exercise(),
      history = [session(e)];
    const before = JSON.stringify(history);
    recommendation(e, history, defaults);
    expect(JSON.stringify(history)).toBe(before);
  });
});
