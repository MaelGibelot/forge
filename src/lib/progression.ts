import type {
  Exercise,
  Preferences,
  ProgressionSetting,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from './domain';
import { movementKnowledge } from './training-knowledge';

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
  settings?: ProgressionSetting[];
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

export function performanceTrend(exerciseId: string, workouts: Workout[], now = Date.now()) {
  const observations = workouts
    .filter((w) => w.status === 'completed' && Date.parse(w.started_at) <= now)
    .toSorted((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))
    .filter((w) => w.exercises.some((e) => e.exercise_id === exerciseId))
    .slice(0, 3)
    .map((w) => observe(w, exerciseId));
  const [a, b, c] = observations;
  if (!a || !b || compare(a, b) === null) return null;
  return {
    direction: compare(a, b),
    repsGain: sameLoads(a, b) ? totalReps(a) - totalReps(b) : null,
    plateau: !!c && compare(a, b) === 0 && compare(b, c) === 0,
    repeatedDecline: !!c && compare(a, b) === -1 && compare(b, c) === -1,
  };
}

export function recommendation(
  entry: WorkoutExercise,
  workouts: Workout[],
  prefs: Preferences,
  excludeId?: string,
  context?: ProgressionContext,
  setting?: ProgressionSetting,
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
  const fixed = entry.target.reps_min === entry.target.reps_max;
  const currentFeedback = context ? entry.feedback : undefined;
  if (currentFeedback?.pain || currentFeedback?.technique_issue)
    return {
      kind: 'hold',
      title: currentFeedback.pain
        ? 'Inconfort signalé : adaptez le mouvement'
        : 'Retrouvez une exécution maîtrisée',
      reason:
        'Aucune charge chiffrée n’est proposée avec ce signal. Interrompez le mouvement douloureux ou non maîtrisé ; adaptez l’amplitude ou choisissez une variante confortable. Si l’inconfort persiste, demandez un avis professionnel.',
    };
  if (context && entry.sets.some((s) => s.completed && s.reached_failure))
    return {
      kind: 'hold',
      title: 'Échec déclaré sur cet exercice',
      reason:
        'Une série de cet exercice vient d’être déclarée à l’échec. Aucune hausse n’est proposée pour les séries restantes ; les séries déjà réalisées restent conservées.',
    };
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
  if (latest.entry.feedback?.pain || latest.entry.feedback?.technique_issue)
    return {
      kind: 'hold',
      title: 'Vérifiez le mouvement avant de reprendre',
      reason:
        'Un inconfort ou une difficulté technique a été déclaré à la dernière occurrence. Confirmez une variante et une amplitude confortables avant de demander une nouvelle charge.',
    };
  const expected = entry.sets.filter((s) => s.type === 'normal').length || entry.target.sets;
  const sameTargets =
    latest.entry.target.reps_min === entry.target.reps_min &&
    latest.entry.target.reps_max === entry.target.reps_max;
  const freeStructure = context && !context.workout.source_day_id && !latest.workout.source_day_id;
  const countChanged =
    latest.sets.length !== expected ||
    (!freeStructure && latest.entry.target.sets !== entry.target.sets);
  // A rising load within one session is evidence for an opening set, not for
  // repeating that load across every set (nor for a comparable volume trend).
  const strongest = latest.sets.reduce((best, s) =>
    s.weight! > best.weight! || (s.weight === best.weight && s.reps > best.reps) ? s : best,
  );
  const opening =
    entry.load_kind === 'external' &&
    strongest.weight! > latest.sets[0].weight! &&
    strongest.weight! <= latest.sets[0].weight! * 1.1 &&
    strongest.reps >= entry.target.reps_min + 2 &&
    latest.sets.every(
      (s, i) =>
        s.reps >= entry.target.reps_min && (i === 0 || s.weight! >= latest.sets[i - 1].weight!),
    )
      ? { weight: strongest.weight, reps: entry.target.reps_min }
      : null;
  if (
    !sameTargets ||
    Boolean(entry.group_id) !== Boolean(latest.entry.group_id) ||
    (context && groupKey(context.workout, entry) !== groupKey(latest.workout, latest.entry)) ||
    latest.entry.load_kind !== entry.load_kind ||
    (countChanged && !opening)
  )
    return insufficient(
      'Le nombre de séries, le mode de charge ou la fourchette ont changé. Confirmez une séance avec cette structure avant de comparer.',
    );
  const history: Observation[] = [latest];
  for (const w of appearances.slice(1)) {
    if (countChanged) break;
    const o = observe(w, entry.exercise_id);
    if (!o || !compatible(latest, o)) break;
    history.push(o);
  }
  const baseline = latest.sets.slice(0, countChanged ? 1 : expected).map((s) => ({
    weight: s.weight,
    reps: Math.max(entry.target.reps_min, Math.min(entry.target.reps_max, s.reps)),
  }));
  const analysis = [
    countChanged
      ? `${latest.sets.length} séries précédentes pour ${expected} prévues : le volume n’est pas comparable. Seul un repère pour la première série est proposé.`
      : `${history.length} séance(s) récente(s) à structure comparable pour cet exercice.`,
    'Échauffements et séries dégressives exclus des performances comparées ; leurs échecs déclarés restent pris en compte. Brouillons exclus de l’historique.',
    fixed
      ? `Objectif fixe : ${entry.target.reps_min} répétitions. Il est conservé, même si une nouvelle charge est proposée.`
      : `Plage retenue : ${entry.target.reps_min}–${entry.target.reps_max} répétitions. Aucun objectif universel n’est imposé.`,
    `Dernière occurrence il y a ${Math.max(0, Math.floor((cutoff - Date.parse(latest.workout.started_at)) / 864e5))} jour(s). Ce délai ne mesure pas votre récupération.`,
  ];
  if (prefs.coaching?.limitations)
    analysis.push(
      'Des limitations sont déclarées dans votre profil. Le moteur ne déduit ni mobilité ni diagnostic à partir de ce texte ; vérifiez l’adaptation du mouvement.',
    );

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
  if (
    currentFeedback?.recovery === 'poor' ||
    currentFeedback?.effort === 'hard' ||
    latest.entry.feedback?.recovery === 'poor' ||
    latest.entry.feedback?.effort === 'hard'
  )
    return answer(
      'hold',
      'Consolidez selon votre récupération',
      'Un effort trop difficile ou une récupération insuffisante a été déclaré. Maintenez une base maîtrisée ; envisagez moins de séries ou davantage de récupération selon votre ressenti.',
    );
  if (cutoff - Date.parse(latest.workout.started_at) > 28 * 864e5)
    return {
      kind: 'hold',
      title: 'Reprenez vos repères après la pause',
      reason:
        'La dernière occurrence date de plus de quatre semaines. Réévaluez une charge maîtrisée pendant la reprise ; aucune hausse ni réduction automatique n’est déduite du temps écoulé.',
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
  if (excessive)
    return answer(
      'hold',
      'Stabilisez la charge',
      'Les indicateurs d’effort renseignés dépassent vos seuils.',
    );
  if (opening && context && entry.sets.some((s) => s.type === 'normal' && s.completed))
    return {
      kind: 'hold',
      title: 'Ajustez les séries suivantes',
      reason:
        'Le repère concernait uniquement la première série. Elle est déjà réalisée ; ajustez les suivantes selon votre exécution, sans extrapoler cette charge à toutes les séries.',
      analysis,
    };
  if (opening)
    return answer(
      'hold',
      'Commencez par votre charge déjà réussie',
      `Vous avez réalisé ${strongest.weight} kg × ${strongest.reps} répétitions après une série plus légère. Essayez ${opening.weight} kg × ${opening.reps} en première série, puis ajustez les suivantes selon votre exécution. Ce repère ne prédit pas la tenue de cette charge sur toutes les séries.`,
      [opening],
    );
  if (!latest.entry.technique_ok)
    return answer(
      'hold',
      'Stabilisez la charge',
      'La technique de la dernière occurrence n’a pas été validée. Confirmez une exécution maîtrisée avant de monter.',
    );
  const atTop = (o: Observation) =>
    o.entry.technique_ok &&
    !o.entry.feedback?.pain &&
    !o.entry.feedback?.technique_issue &&
    o.entry.feedback?.effort !== 'hard' &&
    o.entry.feedback?.recovery !== 'poor' &&
    !o.entry.sets.some((s) => s.completed && s.reached_failure) &&
    o.sets.every(
      (s) =>
        s.reps >= entry.target.reps_max &&
        !(prefs.max_rpe !== null && s.rpe !== null && s.rpe > prefs.max_rpe) &&
        !(prefs.min_rir !== null && s.rir !== null && s.rir < prefs.min_rir),
    );
  if (atTop(latest)) {
    const confirmations = prefs.coaching?.level === 'advanced' ? 3 : 2;
    if (
      history.length < confirmations ||
      !history
        .slice(0, confirmations)
        .every((o) => sameLoads(latest, o) && !restChanged(latest, o) && atTop(o))
    )
      return answer(
        'hold',
        fixed ? 'Confirmez votre objectif fixe' : 'Confirmez le haut de la fourchette',
        `La cible est atteinte. Confirmez-la sur ${confirmations} séances à mêmes charges avant d’envisager une hausse.`,
      );
    if (prefs.coaching?.goal === 'maintenance')
      return answer(
        'hold',
        'Conservez votre objectif d’entretien',
        'La cible est confirmée. L’entretien ne nécessite pas de rechercher une hausse de charge à chaque validation.',
      );
    if (
      fixed &&
      (latest.entry.feedback?.recovery !== 'good' ||
        !(
          latest.entry.feedback?.effort === 'controlled' ||
          latest.entry.feedback?.effort === 'easy' ||
          latest.sets.every((s) => s.rir !== null && s.rir >= (prefs.min_rir ?? 1))
        ))
    )
      return answer(
        'hold',
        'Objectif fixe confirmé : vérifiez votre marge',
        'Votre nombre fixe de répétitions est conservé. Avant de proposer plus lourd, renseignez une récupération bonne et un effort maîtrisé (ou un RIR suffisant). Une absence de données ne prouve pas une marge disponible.',
      );
    if (entry.load_kind === 'bodyweight')
      return answer(
        'hold',
        'Fourchette confirmée au poids du corps',
        'Les répétitions sont confirmées. Ajustez votre objectif si nécessaire ; aucune charge corporelle ou lest n’est déduit automatiquement.',
      );
    const assisted = entry.load_kind === 'assisted';
    const available =
      (
        setting ?? context?.settings?.find((s) => s.exercise_id === entry.exercise_id)
      )?.available_weights?.toSorted((a, b) => a - b) ?? [];
    const profile = movementKnowledge({
      name: entry.name,
      primary_muscle: entry.primary_muscle,
      equipment: context?.exercises.find((e) => e.id === entry.exercise_id)?.equipment ?? 'Machine',
    });
    const limit = profile.isolation ? 0.05 : 0.1;
    const plan = baseline.map((s) => ({
      weight: available.length
        ? ((assisted
            ? available.findLast((w) => w < s.weight!)
            : available.find((w) => w > s.weight!)) ?? s.weight)
        : Math.round(
            (assisted ? Math.max(0, s.weight! - entry.increment) : s.weight! + entry.increment) *
              1000,
          ) / 1000,
      reps: entry.target.reps_min,
    }));
    if (
      plan.some((s, i) => s.weight === baseline[i].weight) ||
      plan.some((s) => s.weight! > 2000) ||
      baseline.some((s, i) => Math.abs(plan[i].weight! - s.weight!) > s.weight! * limit)
    )
      return answer(
        'hold',
        'Ajustez votre incrément',
        `Le prochain palier dépasse ${limit * 100} % d’au moins une charge, la limite de saisie, ou aucun palier disponible ne permet de progresser. Consolidez les répétitions ou choisissez un pas plus petit ; aucun matériel n’est inventé.`,
      );
    return answer(
      'increase',
      assisted ? 'Essayez un peu moins d’assistance' : 'Essayez le prochain palier',
      `La cible est confirmée sur ${confirmations} séances à mêmes charges, technique validée, sans échec déclaré ni signal de baisse retenu. ${available.length ? 'Le prochain poids disponible est utilisé.' : 'L’incrément configuré est utilisé ; les charges disponibles ne sont pas renseignées.'} ${fixed ? 'Votre objectif fixe reste identique.' : 'Les répétitions repartent de votre borne basse.'} ${latest.entry.feedback?.effort ? '' : 'L’absence d’échec déclaré ne mesure pas la marge d’effort : confirmez votre aisance avant d’appliquer.'}`,
      plan,
    );
  }
  if (latest.sets.some((s) => s.reps < entry.target.reps_min))
    return answer(
      'hold',
      fixed ? 'Consolidez votre objectif fixe' : 'Retrouvez votre fourchette',
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
