import {
  muscles,
  type Exercise,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
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
export function exerciseFrequency(workouts: Workout[]) {
  const counts = new Map<string, number>();
  for (const w of workouts) {
    if (w.status !== 'completed') continue;
    const ids = new Set(
      w.exercises
        .filter((e) => e.load_kind !== 'cardio' && e.sets.some((s) => eligible(s)))
        .map((e) => e.exercise_id),
    );
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export function records(workouts: Workout[]) {
  const result = new Map<
    string,
    {
      exercise_id: string;
      name: string;
      max_weight: number;
      record_reps: number;
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
        record_reps: 0,
        e1rm: null,
        volume: 0,
        by_reps: {},
        workout_id: w.id,
        date: w.started_at,
      };
      const sessionSets = w.exercises
        .filter((x) => x.exercise_id === e.exercise_id && x.load_kind === 'external')
        .flatMap((x) => x.sets)
        .filter((s) => eligible(s) && s.weight !== null && s.weight > 0 && s.weight <= 2000);
      const maxWeight = Math.max(...sessionSets.map((s) => s.weight!));
      const atMax = sessionSets.filter((s) => s.weight === maxWeight);
      const bestReps = Math.max(...atMax.map((s) => s.reps));
      if (maxWeight > r.max_weight || (maxWeight === r.max_weight && bestReps > r.record_reps)) {
        r.max_weight = maxWeight;
        r.record_reps = bestReps;
        r.workout_id = w.id;
        r.date = w.started_at;
      }
      for (const s of sets) {
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
export { recommendation, type Suggestion } from './progression';
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
