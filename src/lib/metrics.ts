import {
  muscles,
  type Exercise,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
  type Preferences,
} from './domain';

export function weeklyFrequency(
  workouts: Workout[],
  period: number,
  firstCompletedAt: string | null,
  now: number,
) {
  const day = 864e5;
  const since = period ? now - period * day : -Infinity;
  const completed = workouts.filter(
    (w) =>
      w.status === 'completed' &&
      Date.parse(w.started_at) >= since &&
      Date.parse(w.started_at) <= now,
  );
  if (!completed.length) return { rate: 0, days: period || 7 };
  const oldest = completed.reduce((min, w) => Math.min(min, Date.parse(w.started_at)), now);
  const first = firstCompletedAt ? Date.parse(firstCompletedAt) : oldest;
  const start = Math.max(since, Number.isFinite(first) ? Math.min(first, oldest) : oldest);
  const days = Math.max(7, (now - start) / day);
  return { rate: (completed.length * 7) / days, days };
}

export function muscleSeries(workouts: Workout[], exercises: Exercise[], warmup = false) {
  const catalog = new Map(exercises.map((e) => [e.id, e]));
  const direct = new Map(muscles.map((m) => [m, 0]));
  const secondary = new Map(muscles.map((m) => [m, 0]));
  for (const w of workouts) {
    for (const e of w.exercises) {
      if (e.load_kind === 'cardio') continue;
      const count = e.sets.filter((s) => eligible(s, warmup)).length;
      direct.set(e.primary_muscle, (direct.get(e.primary_muscle) ?? 0) + count);
      for (const m of new Set(catalog.get(e.exercise_id)?.secondary_muscles ?? [])) {
        if (m !== e.primary_muscle) secondary.set(m, (secondary.get(m) ?? 0) + count);
      }
    }
  }
  return {
    direct: muscles.map((name) => ({ name, count: direct.get(name) ?? 0 })),
    secondary: muscles.map((name) => ({ name, count: secondary.get(name) ?? 0 })),
  };
}

export function eligible(s: WorkoutSet, includeWarmup = false) {
  return (
    s.completed &&
    s.duration_seconds == null &&
    s.reps > 0 &&
    Number.isFinite(s.reps) &&
    s.reps <= 500 &&
    (includeWarmup || s.type !== 'warmup')
  );
}
export function setVolume(s: WorkoutSet, loadKind = 'external', includeWarmup = false) {
  return eligible(s, includeWarmup) &&
    loadKind === 'external' &&
    s.weight !== null &&
    Number.isFinite(s.weight) &&
    s.weight >= 0 &&
    s.weight <= 2000
    ? s.weight * s.reps
    : 0;
}
export function exerciseVolume(e: WorkoutExercise, warmup = false) {
  return e.sets.reduce((v, s) => v + setVolume(s, e.load_kind, warmup), 0);
}
export function workoutVolume(w: Workout, warmup = false) {
  return w.exercises.reduce((v, e) => v + exerciseVolume(e, warmup), 0);
}
export function estimated1RM(
  s: WorkoutSet,
  e: Pick<WorkoutExercise, 'supports_1rm' | 'load_kind'>,
): number | null {
  if (
    !e.supports_1rm ||
    e.load_kind !== 'external' ||
    s.type !== 'normal' ||
    !eligible(s) ||
    s.reps > 10 ||
    !s.weight ||
    s.weight < 0 ||
    s.weight > 2000 ||
    !Number.isFinite(s.weight)
  )
    return null;
  return s.reps === 1 ? s.weight : s.weight * (1 + s.reps / 30);
}
export function records(workouts: Workout[]) {
  const result = new Map<
    string,
    {
      exercise_id: string;
      name: string;
      max_weight: number;
      e1rm: number | null;
      volume: number;
      by_reps: Record<number, number>;
      workout_id: string;
      date: string;
    }
  >();
  for (const w of [...workouts]
    .filter((w) => w.status === 'completed')
    .sort((a, b) => a.started_at.localeCompare(b.started_at)))
    for (const e of w.exercises) {
      const sets = e.sets.filter(
        (s) =>
          eligible(s) &&
          e.load_kind === 'external' &&
          s.weight !== null &&
          s.weight > 0 &&
          s.weight <= 2000,
      );
      if (!sets.length) continue;
      const r = result.get(e.exercise_id) ?? {
        exercise_id: e.exercise_id,
        name: e.name,
        max_weight: 0,
        e1rm: null,
        volume: 0,
        by_reps: {},
        workout_id: w.id,
        date: w.started_at,
      };
      for (const s of sets) {
        if (s.weight! > r.max_weight) {
          r.max_weight = s.weight!;
          r.workout_id = w.id;
          r.date = w.started_at;
        }
        const rm = estimated1RM(s, e);
        if (rm !== null && (r.e1rm === null || rm > r.e1rm)) r.e1rm = rm;
        r.by_reps[s.reps] = Math.max(r.by_reps[s.reps] ?? 0, s.weight!);
      }
      // A movement may appear twice in a session (two blocks, same identity).
      r.volume = Math.max(
        r.volume,
        w.exercises
          .filter((x) => x.exercise_id === e.exercise_id)
          .reduce((v, x) => v + exerciseVolume(x), 0),
      );
      result.set(e.exercise_id, r);
    }
  return [...result.values()];
}
export interface Suggestion {
  kind: 'increase' | 'reps' | 'hold' | 'fatigue' | 'insufficient' | 'disabled';
  title: string;
  reason: string;
  weight?: number;
}
export function recommendation(
  entry: WorkoutExercise,
  workouts: Workout[],
  prefs: Preferences,
  excludeId?: string,
): Suggestion {
  if (!prefs.recommendations)
    return {
      kind: 'disabled',
      title: 'Recommandations désactivées',
      reason: 'Réactivez-les dans les paramètres.',
    };
  if (entry.load_kind === 'cardio')
    return {
      kind: 'disabled',
      title: 'Suivi cardio',
      reason:
        'Consignez la durée, la distance et vos sensations pour comparer des intervalles sur le même appareil.',
    };
  const insufficient: Suggestion = {
    kind: 'insufficient',
    title: 'Construisez votre historique',
    reason: 'Continue à enregistrer tes séances pour obtenir des recommandations plus précises.',
  };
  if (entry.load_kind !== 'external')
    return {
      ...insufficient,
      reason: 'Les charges au poids du corps ou assistées ne sont pas directement comparables.',
    };
  const history = [...workouts]
    .filter((w) => w.status === 'completed' && w.id !== excludeId)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .flatMap((w) =>
      w.exercises
        .filter((e) => e.exercise_id === entry.exercise_id)
        .map((e) => {
          if (!e.group_id) return e;
          let round = 0;
          return {
            ...e,
            sets: e.sets.map((s) => {
              if (s.type !== 'normal') return s;
              round++;
              const rest = w.round_rests.find(
                (r) => r.group_id === e.group_id && r.round === round,
              )?.rest_seconds;
              return { ...s, rest_seconds: s.rest_seconds ?? rest ?? null };
            }),
          };
        }),
    )
    .slice(0, prefs.history_count);
  const comparable = history.filter(
    (e) =>
      e.load_kind === entry.load_kind &&
      e.target.sets === entry.target.sets &&
      e.target.reps_min === entry.target.reps_min &&
      e.target.reps_max === entry.target.reps_max &&
      e.sets.filter(
        (s) =>
          s.type === 'normal' &&
          eligible(s) &&
          s.weight !== null &&
          s.weight > 0 &&
          s.weight <= 2000 &&
          s.reps <= 100,
      ).length === entry.target.sets,
  );
  // Never skip a changed programme and resurrect a recommendation from older data.
  if (!comparable.length || comparable[0] !== history[0]) return insufficient;
  const recent = comparable[0];
  const work = recent.sets.filter((s) => s.type === 'normal' && eligible(s));
  if (!work.every((s) => s.weight === work[0].weight))
    return {
      kind: 'hold',
      title: 'Conservez vos charges',
      reason: 'Les séries utilisent des charges différentes. Stabilisez une base comparable.',
    };
  const weight = work[0].weight!;
  const meanRest = (e: WorkoutExercise) => {
    const rests = e.sets
      .filter((s) => s.type === 'normal' && eligible(s) && s.rest_seconds !== null)
      .map((s) => s.rest_seconds!);
    return rests.length ? rests.reduce((a, b) => a + b, 0) / rests.length : null;
  };
  const rest = meanRest(recent),
    earlierRest = comparable[1] ? meanRest(comparable[1]) : null;
  if (
    rest !== null &&
    earlierRest !== null &&
    Math.abs(rest - earlierRest) > Math.max(30, earlierRest * 0.25)
  )
    return {
      kind: 'hold',
      title: 'Confirmez à repos comparable',
      reason:
        'Les temps de repos ont sensiblement changé. Une hausse ponctuelle ne suffit pas à établir une tendance.',
    };
  const excessive = work.some(
    (s) =>
      (prefs.max_rpe !== null && s.rpe !== null && s.rpe > prefs.max_rpe) ||
      (prefs.min_rir !== null && s.rir !== null && s.rir < prefs.min_rir),
  );
  const sameLoad = comparable.filter((e) =>
    e.sets.filter((s) => s.type === 'normal' && eligible(s)).every((s) => s.weight === weight),
  );
  const reps = (e: WorkoutExercise) =>
    e.sets.filter((s) => s.type === 'normal' && eligible(s)).reduce((a, s) => a + s.reps, 0);
  if (
    sameLoad.length >= 3 &&
    sameLoad[0] === recent &&
    reps(sameLoad[0]) < reps(sameLoad[1]) * 0.97 &&
    reps(sameLoad[1]) < reps(sameLoad[2]) * 0.97
  )
    return {
      kind: 'fatigue',
      title: 'Une baisse à surveiller',
      reason:
        'Les répétitions diminuent sur trois séances à charge et objectifs comparables. Vous pouvez conserver la charge, adapter le volume ou mieux récupérer. Aucune modification automatique.',
    };
  if (excessive || !recent.technique_ok)
    return {
      kind: 'hold',
      title: 'Stabilisez la charge',
      reason: excessive
        ? 'L’effort renseigné dépasse vos seuils. Confirmez une exécution maîtrisée avant de monter.'
        : 'Validez la technique et l’effort de la dernière séance avant d’envisager une hausse.',
    };
  if (work.every((s) => s.reps >= entry.target.reps_max))
    return {
      kind: 'increase',
      title: `Essayez ${weight + entry.increment} kg`,
      reason: `Le haut de la fourchette est atteint sur les ${entry.target.sets} séries, avec technique et effort validés. Suggestion pour la prochaine séance, pas une preuve de progression durable.`,
      weight: weight + entry.increment,
    };
  if (work.every((s) => s.reps >= entry.target.reps_min))
    return {
      kind: 'reps',
      title: `Conservez ${weight} kg`,
      reason: 'Essayez d’ajouter une ou deux répétitions au total avant d’augmenter la charge.',
    };
  return {
    kind: 'hold',
    title: 'Conservez la charge actuelle',
    reason:
      'Une séance plus difficile ne suffit pas à conclure à une stagnation. Cherchez d’abord à retrouver la fourchette cible.',
  };
}
export const number = (n: number, digits = 0) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(n);
export function cardioTotals(workout: Workout, includeWarmup = true) {
  return workout.exercises
    .filter((e) => e.load_kind === 'cardio')
    .flatMap((e) => e.sets)
    .filter(
      (s) => s.completed && (s.duration_seconds ?? 0) > 0 && (includeWarmup || s.type !== 'warmup'),
    )
    .reduce(
      (sum, s) => ({
        seconds: sum.seconds + (s.duration_seconds ?? 0),
        distance: sum.distance + (s.distance_km ?? 0),
      }),
      { seconds: 0, distance: 0 },
    );
}
export const duration = (seconds: number) =>
  `${Math.floor(seconds / 60)} min${seconds % 60 ? ` ${seconds % 60} s` : ''}`;
export const shortDate = (date: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Paris',
  }).format(new Date(date));
