import { describe, it, expect } from 'vitest';
import { catalog } from '../src/lib/catalog';
import {
  defaults,
  newEntry,
  newSet,
  startWorkout,
  preferencesSchema,
  progressionSchema,
  type Workout,
  type WorkoutExercise,
} from '../src/lib/domain';
import { indicativeRange, resolveRepGoal } from '../src/lib/training-knowledge';
import { recommendation } from '../src/lib/progression';
import { coachAdvice } from '../src/lib/coach';
import { templateFromWorkout, workoutFromTemplate } from '../src/lib/templates';
const bench = catalog[0];
function entry(reps = [10, 10, 10], min = 10, max = 10, weight = 70): WorkoutExercise {
  const e = newEntry(bench, 0);
  return {
    ...e,
    target: { ...e.target, reps_min: min, reps_max: max },
    technique_ok: true,
    feedback: { effort: 'controlled', recovery: 'good', pain: false, technique_issue: false },
    sets: reps.map((reps, i) => ({ ...newSet(i, e.target), weight, reps, completed: true })),
  };
}
function session(e: WorkoutExercise, days = 1): Workout {
  return {
    ...startWorkout(),
    status: 'completed',
    started_at: new Date(Date.now() - days * 864e5).toISOString(),
    finished_at: new Date(Date.now() - days * 864e5 + 3600000).toISOString(),
    exercises: [e],
  };
}
const profile = (
  goal: 'strength' | 'hypertrophy' | 'endurance' | 'maintenance',
  level = 'intermediate',
) => preferencesSchema.parse({ ...defaults, coaching: { goal, level } });
describe('objectifs personnalisés et coaching', () => {
  it.each([
    ['Développé couché', 6, 10],
    ['Développé incliné haltères', 8, 10],
    ['Tirage vertical', 8, 12],
    ['Rowing', 8, 12],
    ['Squat', 6, 10],
    ['Presse à cuisses', 10, 15],
    ['Élévations latérales', 12, 20],
    ['Curl biceps', 8, 15],
    ['Extension triceps', 10, 15],
    ['Mollets', 10, 20],
  ])('propose un repère facultatif pour %s', (name, min, max) => {
    expect(indicativeRange({ ...bench, name: String(name) }, 'hypertrophy')).toEqual([min, max]);
  });
  it('respecte cible explicite > réglage personnel > programme > historique > repère', () => {
    const args = {
      exercise: bench,
      setting: { exercise_id: bench.id, reps_min: 10, reps_max: 10, increment: 2.5 },
      program: { reps_min: 6, reps_max: 8 },
      previous: { reps_min: 15, reps_max: 20 },
      preferences: profile('strength'),
    };
    expect(resolveRepGoal({ ...args, explicit: { reps_min: 12, reps_max: 12 } }).reps_min).toBe(12);
    expect(resolveRepGoal(args).reps_min).toBe(10);
    expect(resolveRepGoal({ ...args, setting: undefined }).reps_min).toBe(6);
    expect(resolveRepGoal({ ...args, setting: undefined, program: undefined }).reps_min).toBe(15);
    expect(
      resolveRepGoal({ ...args, setting: undefined, program: undefined, previous: undefined })
        .reps_min,
    ).toBe(4);
    expect(indicativeRange(bench, 'endurance')).toEqual([15, 25]);
  });
  it.each([
    [10, 9, 8],
    [10, 10, 9],
  ])('conserve 70 kg et la cible fixe de 10 malgré des répétitions manquantes (%j)', (...reps) => {
    const e = entry(reps),
      w = session(e),
      before = JSON.stringify(w);
    const r = recommendation(e, [w], defaults);
    expect(r.kind).toBe('hold');
    expect(r.plan).toEqual([
      { weight: 70, reps: 10 },
      { weight: 70, reps: 10 },
      { weight: 70, reps: 10 },
    ]);
    expect(JSON.stringify(w)).toBe(before);
  });
  it('une hausse fixe conserve 10 ; sans récupération ou effort renseigné, maintient', () => {
    const e = entry(),
      past = [session(e, 2), session(e, 1)];
    expect(recommendation(e, past, defaults).plan).toEqual(
      Array(3).fill({ weight: 72.5, reps: 10 }),
    );
    e.feedback = undefined;
    expect(recommendation(e, past, defaults).title).toContain('vérifiez votre marge');
    expect(recommendation(e, past, defaults).plan?.[0]).toEqual({ weight: 70, reps: 10 });
    e.feedback = { effort: null, recovery: 'good', pain: false, technique_issue: false };
    e.sets.forEach((s) => {
      s.rir = 2;
    });
    expect(recommendation(e, past, defaults).kind).toBe('increase');
  });
  it('adapte les confirmations au niveau, maintient en entretien et respecte la plage', () => {
    const e = entry([10, 10, 10], 8, 10),
      past = [session(e, 2), session(e, 1)];
    expect(recommendation(e, past, profile('hypertrophy', 'advanced')).kind).toBe('hold');
    expect(
      recommendation(e, [...past, session(e, 3)], profile('hypertrophy', 'advanced')).kind,
    ).toBe('increase');
    expect(recommendation(e, past, profile('maintenance')).kind).toBe('hold');
    expect(recommendation(e, past, defaults).plan?.every((s) => s.reps === 8)).toBe(true);
  });
  it('utilise les charges disponibles, sans dépasser le pas prudent de l’isolation', () => {
    const e = entry([10, 10, 10], 8, 10),
      past = [session(e, 2), session(e, 1)];
    const setting = {
      exercise_id: e.exercise_id,
      increment: 2.5,
      reps_min: 8,
      reps_max: 10,
      available_weights: [70, 71, 75],
    };
    expect(recommendation(e, past, defaults, undefined, undefined, setting).weight).toBe(71);
    e.name = 'Élévations latérales';
    e.sets.forEach((s) => {
      s.weight = 8;
    });
    setting.available_weights = [8, 9, 10];
    expect(recommendation(e, past, defaults, undefined, undefined, setting).title).toBe(
      'Ajustez votre incrément',
    );
    e.increment = 0.25;
    expect(recommendation(e, past, defaults).weight).toBe(8.25);
  });
  it('réduit l’assistance vers un palier existant', () => {
    const e = { ...entry([10, 10, 10], 8, 10, 40), load_kind: 'assisted' as const };
    const setting = {
      exercise_id: e.exercise_id,
      increment: 2.5,
      reps_min: 8,
      reps_max: 10,
      available_weights: [0, 35, 38, 40, 45],
    };
    expect(
      recommendation(e, [session(e, 2), session(e, 1)], defaults, undefined, undefined, setting)
        .weight,
    ).toBe(38);
  });
  it('n’invente aucune charge sans historique ou après une interruption prolongée', () => {
    const e = entry();
    expect(recommendation(e, [], defaults).plan).toBeUndefined();
    expect(recommendation(e, [session(e, 40)], defaults).plan).toBeUndefined();
    const interrupted = session(e);
    interrupted.exercises[0].sets[1].completed = false;
    expect(recommendation(e, [interrupted], defaults).kind).toBe('insufficient');
  });
  it('inconfort et difficulté technique retirent la charge ; mauvaise récupération bloque la hausse', () => {
    for (const feedback of [
      { pain: true },
      { technique_issue: true },
      { recovery: 'poor' as const },
      { effort: 'hard' as const },
    ]) {
      const e = entry();
      e.feedback = { ...e.feedback!, ...feedback };
      const r = recommendation(e, [session(e, 2), session(e, 1)], defaults);
      expect(r.kind).toBe('hold');
      if (feedback.pain || feedback.technique_issue) expect(r.plan).toBeUndefined();
      else expect(r.plan?.[0].weight).toBe(70);
    }
  });
  it('préserve les cibles dans les modèles, réinitialise le ressenti, applique une préférence explicite au démarrage', () => {
    const e = entry(),
      template = templateFromWorkout(session(e));
    const result = workoutFromTemplate(template);
    expect(result.exercises[0].target.reps_min).toBe(10);
    expect(result.exercises[0].sets[0]).toMatchObject({ weight: null, reps: 0, completed: false });
    expect(result.exercises[0].feedback).toBeUndefined();
    const setting = { exercise_id: e.exercise_id, increment: 1, reps_min: 15, reps_max: 20 };
    const day = { id: crypto.randomUUID(), name: 'Jour', position: 0, groups: [], exercises: [e] };
    expect(startWorkout(day, [], [setting]).exercises[0].target.reps_min).toBe(15);
    expect(day.exercises[0].target.reps_min).toBe(10);
    expect(workoutFromTemplate(template, [setting]).exercises[0].target.reps_min).toBe(15);
  });
  it('priorise les signaux de prudence sur la motivation et renouvelle les faits après changement', () => {
    const e = entry([10, 10, 10], 8, 12),
      old = entry([9, 9, 9], 8, 12);
    const data = { preferences: defaults, exercises: catalog, progression: [], programs: [] };
    const past = [session(e, 1), session(old, 2)];
    expect(coachAdvice(data, past)[0].fact).toContain('+3 répétition');
    e.sets[0].reached_failure = true;
    expect(coachAdvice(data, past)[0].fact).toContain('échec déclaré');
    expect(coachAdvice(data, past)[0].title).not.toContain('progressez');
    e.feedback!.pain = true;
    expect(coachAdvice(data, past)[0].priority).toBe(10);
    expect(
      coachAdvice({ ...data, preferences: { ...defaults, recommendations: false } }, past),
    ).toEqual([]);
  });
  it('rejette les préférences hors limites et les charges de matériel invalides', () => {
    expect(
      preferencesSchema.safeParse({ ...defaults, coaching: { sessions_per_week: 100 } }).success,
    ).toBe(false);
    expect(
      progressionSchema.safeParse({
        exercise_id: bench.id,
        increment: 1,
        reps_min: 10,
        reps_max: 8,
      }).success,
    ).toBe(false);
    expect(
      progressionSchema.safeParse({
        exercise_id: bench.id,
        increment: 1,
        reps_min: 10,
        reps_max: 10,
        available_weights: [-1],
      }).success,
    ).toBe(false);
  });
  it('signale une hausse de volume avec des faits et exclut brouillons/futur des conseils', () => {
    const e = entry([10, 10, 10], 8, 12);
    const recent = [1, 2, 3, 4].map((day) => session(e, day));
    const older = [8, 9].map((day) => session(e, day));
    const data = { preferences: defaults, exercises: catalog, progression: [], programs: [] };
    const cards = coachAdvice(data, [...recent, ...older]);
    expect(
      cards.some((c) => c.fact.includes('12 séries directes') && c.fact.includes('contre 6')),
    ).toBe(true);
    const ignored = [{ ...session(e, 1), status: 'draft' as const }, session(e, -2)];
    expect(coachAdvice(data, ignored)[0].id).toBe('first');
  });
  it('ne prend pas un leg curl pour un curl de coude et ne masque pas un inconfort si la cible change', () => {
    expect(indicativeRange({ ...bench, name: 'Leg curl assis' }, 'hypertrophy')).toEqual([10, 15]);
    const past = entry();
    past.feedback!.pain = true;
    const changed = entry([8, 8, 8], 8, 12);
    expect(recommendation(changed, [session(past)], defaults).title).toContain(
      'Vérifiez le mouvement',
    );
    expect(recommendation(changed, [session(past)], defaults).plan).toBeUndefined();
  });
});
