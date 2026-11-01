import type { Exercise, Preferences, Workout, WorkoutExercise, WorkoutSet } from './domain';

export interface Suggestion {
  kind: 'increase' | 'reps' | 'hold' | 'fatigue' | 'insufficient' | 'disabled';
  title: string;
  reason: string;
  weight?: number;
  plan?: { weight: number | null; reps: number }[];
  analysis?: string[];
}
export interface ProgressionContext {
  workout: Workout;
  exercises: Exercise[];
}
type Observation = { workout: Workout; entry: WorkoutExercise; sets: WorkoutSet[] };

function observe(workout: Workout, id: string): Observation | null {
  const entries = workout.exercises.filter((e) => e.exercise_id === id);
  // Never interpret two blocks of the same movement as two separate training sessions.
  if (entries.length !== 1) return null;
  const entry = entries[0];
  if (entry.load_kind === 'cardio') return null;
  const normal = entry.sets.filter((s) => s.type === 'normal');
  if (
    !normal.length ||
    normal.some(
      (s) =>
        !s.completed ||
        s.reps <= 0 ||
        s.reps > 100 ||
        s.duration_seconds != null ||
        (entry.load_kind === 'bodyweight'
          ? s.weight !== null && s.weight !== 0
          : s.weight === null ||
            s.weight < (entry.load_kind === 'assisted' ? 0 : 0.01) ||
            s.weight > 2000),
    )
  )
    return null;
  const sets = normal.map((s, i) => ({
    ...s,
    rest_seconds:
      s.rest_seconds ??
      (entry.group_id
        ? (workout.round_rests.find((r) => r.group_id === entry.group_id && r.round === i + 1)
            ?.rest_seconds ?? null)
        : null),
  }));
  return { workout, entry, sets };
}
function groupKey(workout: Workout, entry: WorkoutExercise) {
  return entry.group_id
    ? workout.exercises
        .filter((e) => e.group_id === entry.group_id && e.id !== entry.id)
        .map((e) => e.exercise_id)
        .sort()
        .join('|') || 'superset'
    : '';
}
function compatible(a: Observation, b: Observation) {
  return (
    a.entry.load_kind === b.entry.load_kind &&
    groupKey(a.workout, a.entry) === groupKey(b.workout, b.entry) &&
    a.sets.length === b.sets.length &&
    a.entry.target.reps_min === b.entry.target.reps_min &&
    a.entry.target.reps_max === b.entry.target.reps_max &&
    ((!a.workout.source_day_id && !b.workout.source_day_id) ||
      a.entry.target.sets === b.entry.target.sets)
  );
}
function rest(o: Observation) {
  const values = o.sets.flatMap((s) => (s.rest_seconds === null ? [] : [s.rest_seconds]));
  return values.length ? values.reduce((n, v) => n + v, 0) / values.length : null;
}
function restChanged(a: Observation, b: Observation) {
  const x = rest(a),
    y = rest(b);
  return x !== null && y !== null && Math.abs(x - y) > Math.max(30, y * 0.25);
}
function sameLoads(a: Observation, b: Observation) {
  return a.sets.every((s, i) => s.weight === b.sets[i]?.weight);
}
function totalReps(o: Observation) {
  return o.sets.reduce((n, s) => n + s.reps, 0);
}
function compare(a: Observation, b: Observation): -1 | 0 | 1 | null {
  if (!compatible(a, b) || restChanged(a, b)) return null;
  if (sameLoads(a, b)) {
    const delta = totalReps(a) - totalReps(b);
    return Math.abs(delta) < Math.max(1, totalReps(b) * 0.03) ? 0 : delta > 0 ? 1 : -1;
  }
  const direction = a.entry.load_kind === 'assisted' ? -1 : 1;
  const up = a.sets.every(
    (s, i) =>
      direction * (s.weight ?? 0) >= direction * (b.sets[i].weight ?? 0) &&
      s.reps >= b.sets[i].reps,
  );
  const down = a.sets.every(
    (s, i) =>
      direction * (s.weight ?? 0) <= direction * (b.sets[i].weight ?? 0) &&
      s.reps <= b.sets[i].reps,
  );
  return up ? 1 : down ? -1 : null;
}

export function recommendation(
  entry: WorkoutExercise,
  workouts: Workout[],
  prefs: Preferences,
  excludeId?: string,
  context?: ProgressionContext,
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
      reason: 'La durée et la distance restent suivies séparément des séries de musculation.',
    };
  const insufficient = (
    reason = 'Terminez des séries de travail comparables pour construire une proposition fiable.',
  ): Suggestion => ({ kind: 'insufficient', title: 'Construisez votre historique', reason });
  if (entry.target.reps_max > 30)
    return insufficient(
      'Les objectifs dépassent 30 répétitions. Ajustez la fourchette avant de proposer un plan.',
    );
  const cutoff = context ? Date.parse(context.workout.started_at) : Date.now();
  const completed = workouts
    .filter(
      (w) => w.status === 'completed' && w.id !== excludeId && Date.parse(w.started_at) <= cutoff,
    )
    .toSorted((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
  const appearances = completed
    .filter((w) => w.exercises.some((e) => e.exercise_id === entry.exercise_id))
    .slice(0, prefs.history_count);
  const latest = appearances[0] ? observe(appearances[0], entry.exercise_id) : null;
  if (!latest)
    return insufficient(
      appearances.length
        ? 'La dernière occurrence est incomplète ou répartie dans plusieurs blocs. Elle ne permet pas d’aligner les séries sans ambiguïté.'
        : undefined,
    );
  const expected = entry.sets.filter((s) => s.type === 'normal').length || entry.target.sets;
  const sameTargets =
    latest.entry.target.reps_min === entry.target.reps_min &&
    latest.entry.target.reps_max === entry.target.reps_max;
  const freeStructure = context && !context.workout.source_day_id && !latest.workout.source_day_id;
  if (
    !sameTargets ||
    Boolean(entry.group_id) !== Boolean(latest.entry.group_id) ||
    (context && groupKey(context.workout, entry) !== groupKey(latest.workout, latest.entry)) ||
    latest.entry.load_kind !== entry.load_kind ||
    latest.sets.length !== expected ||
    (!freeStructure && latest.entry.target.sets !== entry.target.sets)
  )
    return insufficient(
      'Le nombre de séries, le mode de charge ou la fourchette ont changé. Confirmez une séance avec cette structure avant de comparer.',
    );
  const history: Observation[] = [latest];
  for (const w of appearances.slice(1)) {
    const o = observe(w, entry.exercise_id);
    if (!o || !compatible(latest, o)) break;
    history.push(o);
  }
  const baseline = latest.sets.map((s) => ({ weight: s.weight, reps: Math.min(30, s.reps) }));
  const analysis = [
    `${history.length} séance(s) récente(s) à structure comparable pour cet exercice.`,
    'Échauffements et séries dégressives exclus des performances comparées ; leurs échecs déclarés restent pris en compte. Brouillons exclus de l’historique.',
  ];

  // Compare each other exercise only against itself, never raw kg across movements.
  const recent = completed.filter((w) => Date.parse(w.started_at) >= cutoff - 42 * 864e5);
  const ids = new Set(
    recent.flatMap((w) =>
      w.exercises
        .filter((e) => e.exercise_id !== entry.exercise_id && e.load_kind !== 'cardio')
        .map((e) => e.exercise_id),
    ),
  );
  let assessed = 0,
    declining = 0;
  for (const id of ids) {
    const observations = recent
      .filter((w) => w.exercises.some((e) => e.exercise_id === id))
      .slice(0, 3)
      .map((w) => observe(w, id));
    if (observations.length < 3 || observations.some((o) => !o)) continue;
    const [a, b, c] = observations as Observation[];
    const first = compare(a, b),
      second = compare(b, c);
    if (first === null || second === null) continue;
    assessed++;
    if (first === -1 && second === -1) declining++;
  }
  analysis.push(
    assessed
      ? `${declining} sur ${assessed} autre(s) exercice(s) comparable(s) en baisse sur deux comparaisons successives, sur les six dernières semaines.`
      : 'Pas assez de données comparables pour conclure à une tendance des autres exercices.',
  );
  let earlierAssessed = 0,
    earlierDown = 0,
    relatedFailures = 0;
  if (context) {
    const catalog = new Map(context.exercises.map((e) => [e.id, e]));
    const muscles = new Set([
      entry.primary_muscle,
      ...(catalog.get(entry.exercise_id)?.secondary_muscles ?? []),
    ]);
    for (const e of context.workout.exercises.filter(
      (e) =>
        e.position < entry.position &&
        e.exercise_id !== entry.exercise_id &&
        e.load_kind !== 'cardio',
    )) {
      const overlap = [
        e.primary_muscle,
        ...(catalog.get(e.exercise_id)?.secondary_muscles ?? []),
      ].some((m) => muscles.has(m));
      if (overlap)
        relatedFailures += e.sets.filter(
          (s) => s.completed && s.reached_failure && s.reps > 0,
        ).length;
      const current = observe(context.workout, e.exercise_id);
      const oldWorkout = completed.find((w) =>
        w.exercises.some((x) => x.exercise_id === e.exercise_id),
      );
      const old = oldWorkout ? observe(oldWorkout, e.exercise_id) : null;
      if (!current || !old) continue;
      const direction = compare(current, old);
      if (direction === null) continue;
      earlierAssessed++;
      if (direction === -1) earlierDown++;
    }
    analysis.push(
      `${earlierDown} sur ${earlierAssessed} exercice(s) déjà terminé(s) et comparable(s) en baisse dans cette séance ; ${relatedFailures} série(s) à l’échec sur des muscles également sollicités ici.`,
    );
  }
  const answer = (
    kind: Suggestion['kind'],
    title: string,
    reason: string,
    plan = baseline,
  ): Suggestion => ({
    kind,
    title,
    reason,
    plan,
    analysis,
    ...(kind === 'increase' &&
    plan[0]?.weight !== null &&
    plan.every((s) => s.weight === plan[0].weight)
      ? { weight: plan[0].weight! }
      : {}),
  });
  if (context && entry.sets.some((s) => s.completed && s.reached_failure))
    return {
      kind: 'hold',
      title: 'Échec déclaré sur cet exercice',
      reason:
        'Une série de cet exercice vient d’être déclarée à l’échec. Aucune hausse n’est proposée pour les séries restantes ; les séries déjà réalisées restent conservées.',
      analysis,
    };
  if (history[1] && restChanged(latest, history[1]))
    return answer(
      'hold',
      'Confirmez à repos comparable',
      'Les repos ont sensiblement changé. Reprenez la dernière base avant de conclure à une progression.',
    );
  if (
    history.length >= 3 &&
    compare(history[0], history[1]) === -1 &&
    compare(history[1], history[2]) === -1
  )
    return answer(
      'fatigue',
      'Une baisse à surveiller',
      'Les performances de cet exercice baissent sur deux comparaisons successives. Conservez une base maîtrisée ; ce signal ne permet pas de diagnostiquer une fatigue.',
    );
  if (declining >= 2 && declining > assessed / 2)
    return answer(
      'hold',
      'Consolidez cette séance',
      'Plusieurs autres exercices baissent de manière répétée. La hausse de charge est suspendue jusqu’à confirmation sur cet exercice.',
    );
  if (earlierDown >= 2 || relatedFailures >= 2)
    return answer(
      'hold',
      'Adaptez-vous à la séance du jour',
      relatedFailures >= 2
        ? 'Plusieurs séries à l’échec ont déjà été déclarées sur des muscles sollicités ici. Reprenez la dernière base sans ajouter de charge.'
        : 'Au moins deux exercices précédents sont en baisse face à leur propre dernière séance comparable. Confirmez votre base avant de monter.',
    );
  const failed = latest.entry.sets.filter(
    (s) => s.completed && s.reached_failure && s.reps > 0,
  ).length;
  if (failed)
    return answer(
      'hold',
      'Confirmez sans ajouter de charge',
      `${failed} série(s) à l’échec déclarée(s) lors de la dernière occurrence. La proposition reprend cette base ; elle ne vous demande pas de retourner à l’échec.`,
    );
  const excessive = latest.sets.some(
    (s) =>
      (prefs.max_rpe !== null && s.rpe !== null && s.rpe > prefs.max_rpe) ||
      (prefs.min_rir !== null && s.rir !== null && s.rir < prefs.min_rir),
  );
  if (!latest.entry.technique_ok || excessive)
    return answer(
      'hold',
      'Stabilisez la charge',
      excessive
        ? 'Les anciens indicateurs d’effort renseignés dépassent vos seuils.'
        : 'La technique de la dernière occurrence n’a pas été validée. Confirmez une exécution maîtrisée avant de monter.',
    );
  const atTop = (o: Observation) =>
    o.entry.technique_ok &&
    !o.entry.sets.some((s) => s.completed && s.reached_failure) &&
    o.sets.every(
      (s) =>
        s.reps >= entry.target.reps_max &&
        !(prefs.max_rpe !== null && s.rpe !== null && s.rpe > prefs.max_rpe) &&
        !(prefs.min_rir !== null && s.rir !== null && s.rir < prefs.min_rir),
    );
  if (atTop(latest)) {
    if (!history[1] || !sameLoads(latest, history[1]) || !atTop(history[1]))
      return answer(
        'hold',
        'Confirmez le haut de la fourchette',
        'La dernière occurrence atteint le haut de la fourchette. Confirmez-le sur deux séances à mêmes charges avant de proposer une hausse.',
      );
    if (entry.load_kind === 'bodyweight')
      return answer(
        'hold',
        'Fourchette confirmée au poids du corps',
        'Les répétitions sont confirmées. Ajustez votre objectif si nécessaire ; aucune charge corporelle ou lest n’est déduit automatiquement.',
      );
    const assisted = entry.load_kind === 'assisted';
    const plan = baseline.map((s) => ({
      weight: assisted ? Math.max(0, s.weight! - entry.increment) : s.weight! + entry.increment,
      reps: entry.target.reps_min,
    }));
    if (
      plan.some((s, i) => s.weight === baseline[i].weight) ||
      plan.some((s) => s.weight! > 2000) ||
      (!assisted && baseline.some((s) => entry.increment > s.weight! * 0.1))
    )
      return answer(
        'hold',
        'Ajustez votre incrément',
        'L’incrément dépasse 10 % d’au moins une charge, la limite de saisie, ou l’assistance minimale est déjà atteinte. Choisissez un pas adapté avant de monter.',
      );
    return answer(
      'increase',
      assisted ? 'Essayez un peu moins d’assistance' : 'Essayez le prochain palier',
      'Le haut de la fourchette est confirmé sur deux séances à mêmes charges, sans échec déclaré ni signal de baisse retenu. L’incrément configuré est appliqué à chaque série ; les répétitions repartent de la borne basse.',
      plan,
    );
  }
  if (latest.sets.some((s) => s.reps < entry.target.reps_min))
    return answer(
      'hold',
      'Retrouvez votre fourchette',
      'Certaines séries restent sous la borne basse. Une seule séance difficile ne suffit pas à conclure à une régression durable.',
    );
  const plan = baseline.map((s) => ({ ...s }));
  const index = plan.findIndex((s) => s.reps < entry.target.reps_max);
  if (index >= 0) plan[index].reps++;
  const plateau =
    history.length >= 3 &&
    sameLoads(history[0], history[1]) &&
    sameLoads(history[1], history[2]) &&
    compare(history[0], history[1]) === 0 &&
    compare(history[1], history[2]) === 0;
  return answer(
    'reps',
    'Ajoutez une répétition avant de monter',
    plateau
      ? 'Les dernières performances comparables sont stables. Un seul ajout de répétition au total est proposé pour débloquer progressivement la fourchette.'
      : 'La fourchette est partiellement atteinte. Conservez les charges et essayez une seule répétition supplémentaire au total.',
    plan,
  );
}
