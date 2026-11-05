import type { Workout, WorkoutSet } from './domain';
import {
  enduranceActivity,
  enduranceRate,
  formatEnduranceRate,
  type EnduranceGoal,
  type EnduranceSession,
  type EnduranceSport,
} from './endurance';

const dayMs = 86_400_000;
const parisDate = new Intl.DateTimeFormat('fr-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

function parisDay(time: number) {
  const parts = parisDate.formatToParts(time);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  return Date.UTC(year, month - 1, day) / dayMs;
}

export interface EndurancePlanSlot {
  session: EnduranceSession;
  duration_seconds: number;
  distance_km?: number;
  label: string;
  detail: string;
}

interface EnduranceComparison {
  activity_name: string;
  latest_date: string;
  previous_date: string;
  distance_km: number;
  latest_seconds: number;
  previous_seconds: number;
  change_percent: number;
}

export interface EnduranceCoaching {
  recent: {
    sessions: number;
    days: number;
    duration_seconds: number;
    distance_km: number;
    distance_recorded_sessions: number;
  };
  comparison: EnduranceComparison | null;
  plan: EndurancePlanSlot[];
  facts: string[];
  guidance: string;
}

interface ComparableEffort {
  session: EnduranceSession;
  name: string;
  signature: string;
  continuous: boolean;
  controlledAndRecovered: boolean;
  seconds: number;
  distance: number;
}

interface SportWorkout {
  id: string;
  date: string;
  day: number;
  time: number;
  seconds: number;
  distance: number;
  difficultyReported: boolean;
  efforts: ComparableEffort[];
}

const recorded = (s: WorkoutSet) =>
  s.completed && Number.isFinite(s.duration_seconds) && (s.duration_seconds ?? 0) > 0;

function recordedDistance(s: WorkoutSet) {
  return Number.isFinite(s.distance_km) && (s.distance_km ?? 0) > 0 ? s.distance_km! : 0;
}

function sportHistory(
  workouts: Workout[],
  sport: EnduranceSport,
  now: number,
  today: number,
): SportWorkout[] {
  const result: SportWorkout[] = [];
  const seen = new Set<string>();
  for (const workout of workouts) {
    if (workout.status !== 'completed' || seen.has(workout.id)) continue;
    const time = Date.parse(workout.started_at);
    if (!Number.isFinite(time) || time > now) continue;
    const day = parisDay(time);
    if (day < today - 41) continue;
    if (workout.finished_at && Date.parse(workout.finished_at) > now) continue;
    seen.add(workout.id);
    let seconds = 0;
    let distance = 0;
    let difficultyReported = false;
    const efforts: ComparableEffort[] = [];
    for (const exercise of workout.exercises) {
      if (exercise.load_kind !== 'cardio') continue;
      const activity = enduranceActivity(exercise.exercise_id);
      if (activity?.sport !== sport) continue;
      const sets = exercise.sets.filter(recorded);
      if (!sets.length) continue;
      seconds += sets.reduce((sum, set) => sum + set.duration_seconds!, 0);
      distance += sets.reduce((sum, set) => sum + recordedDistance(set), 0);
      const feedback = exercise.feedback;
      difficultyReported ||= Boolean(
        feedback?.pain ||
        feedback?.technique_issue ||
        feedback?.effort === 'hard' ||
        feedback?.recovery === 'poor',
      );

      const work = sets.filter((set) => set.type === 'normal');
      if (!work.length || work.some((set) => Math.round(recordedDistance(set) * 1000) === 0)) {
        continue;
      }
      // Match the recorded distances and rests of each segment to the metre and second.
      const signature = JSON.stringify([
        exercise.exercise_id,
        work.map((set) => [Math.round(recordedDistance(set) * 1000), set.rest_seconds]),
      ]);
      efforts.push({
        session: activity.session,
        name: activity.exercise.name,
        signature,
        continuous:
          work.length === 1 &&
          !work[0].rest_seconds &&
          (activity.session === 'easy' ||
            activity.session === 'tempo' ||
            activity.session === 'long'),
        controlledAndRecovered:
          (feedback?.effort === 'easy' || feedback?.effort === 'controlled') &&
          feedback.recovery === 'good' &&
          !feedback.pain &&
          !feedback.technique_issue,
        seconds: work.reduce((sum, set) => sum + set.duration_seconds!, 0),
        distance:
          work.reduce((sum, set) => sum + Math.round(recordedDistance(set) * 1000), 0) / 1000,
      });
    }
    if (seconds > 0) {
      result.push({
        id: workout.id,
        date: workout.started_at,
        day,
        time,
        seconds,
        distance,
        difficultyReported,
        efforts,
      });
    }
  }
  return result.toSorted((a, b) => b.time - a.time || a.id.localeCompare(b.id));
}

function latestComparison(history: SportWorkout[]): EnduranceComparison | null {
  for (let index = 0; index < history.length; index++) {
    const latest = history[index];
    for (const effort of latest.efforts) {
      if (effort.session === 'technique' || effort.session === 'recovery') continue;
      for (const previous of history.slice(index + 1)) {
        if (latest.day === previous.day) continue;
        const match = previous.efforts.find((x) => x.signature === effort.signature);
        if (match) {
          return {
            activity_name: effort.name,
            latest_date: latest.date,
            previous_date: previous.date,
            distance_km: effort.distance,
            latest_seconds: effort.seconds,
            previous_seconds: match.seconds,
            change_percent: ((effort.seconds - match.seconds) / match.seconds) * 100,
          };
        }
      }
    }
  }
  return null;
}

function summarize(workouts: SportWorkout[]): EnduranceCoaching['recent'] {
  return {
    sessions: workouts.length,
    days: new Set(workouts.map((w) => w.day)).size,
    duration_seconds: workouts.reduce((sum, w) => sum + w.seconds, 0),
    distance_km: workouts.reduce((sum, w) => sum + w.distance, 0),
    distance_recorded_sessions: workouts.filter((w) => w.distance > 0).length,
  };
}

const median = (values: number[]) => {
  const ordered = values.toSorted((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};

const planLabels: Record<EnduranceSport, Record<EnduranceSession, string>> = {
  running: {
    easy: 'Endurance fondamentale',
    intervals: 'Fractionné',
    tempo: 'Tempo',
    long: 'Sortie longue',
    technique: 'Éducatifs de course',
    recovery: 'Footing de récupération',
  },
  swimming: {
    easy: 'Endurance en bassin',
    intervals: 'Intervalles en bassin',
    tempo: 'Allure soutenue',
    long: 'Séance de distance',
    technique: 'Technique de nage',
    recovery: 'Nage de récupération',
  },
  cycling: {
    easy: 'Sortie en endurance',
    intervals: 'Intervalles à vélo',
    tempo: 'Tempo à vélo',
    long: 'Sortie longue',
    technique: 'Technique et cadence',
    recovery: 'Récupération à vélo',
  },
};

const starterMinutes: Record<EnduranceSport, number> = { running: 15, swimming: 15, cycling: 25 };
const shortDistance: Record<EnduranceSport, number> = { running: 10, swimming: 1.5, cycling: 40 };
const weights: Record<EnduranceSession, number> = {
  easy: 1,
  intervals: 1,
  tempo: 1,
  long: 1.35,
  technique: 0.8,
  recovery: 0.65,
};

function distanceLabel(km: number, sport: EnduranceSport) {
  const swimming = sport === 'swimming';
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: swimming ? 0 : 3 }).format(swimming ? km * 1000 : km)} ${swimming ? 'm' : 'km'}`;
}

function elapsedLabel(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [
    hours ? `${hours} h` : '',
    minutes ? `${minutes} min` : '',
    remainder ? `${remainder} s` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function instructions(sport: EnduranceSport, session: EnduranceSession): string {
  if (session === 'technique') {
    if (sport === 'swimming')
      return 'Alternez des longueurs faciles et des éducatifs courts. Prenez des pauses pour garder une nage propre.';
    if (sport === 'cycling')
      return 'Travaillez une cadence souple à faible résistance. Gardez un effort facile sur terrain régulier.';
    return 'Alternez course facile et quelques éducatifs courts. Marchez entre les passages pour garder des appuis souples.';
  }
  if (session === 'intervals' || session === 'tempo') {
    const block = session === 'intervals' ? '4 × 1 min soutenue' : '2 × 3 min soutenues';
    const recovery =
      sport === 'swimming' ? '2 min de nage facile ou de repos' : '2 min à allure facile';
    return `Commencez par 8 min faciles, puis ${block} avec ${recovery} après chaque effort. Récupérations comprises, complétez la durée à allure facile avec au moins 5 min de retour au calme.`;
  }
  if (sport === 'swimming') {
    return 'Nagez à un rythme confortable en gardant une technique régulière. Répartissez le temps en séries en comptant vos pauses dans la durée proposée.';
  }
  if (sport === 'running') {
    return 'Courez à une allure qui permet de parler en phrases. Alternez course et marche si cela vous aide à garder l’effort facile.';
  }
  return 'Roulez à une allure qui permet de parler en phrases, avec un braquet facile à emmener. Gardez un effort régulier dans les côtes.';
}

function makePlan(
  goal: EnduranceGoal,
  history: SportWorkout[],
  weeks: EnduranceCoaching['recent'][],
  longest: ComparableEffort | undefined,
): Pick<EnduranceCoaching, 'plan' | 'guidance'> {
  const recent = weeks[0];
  const activeWeeks = weeks.filter((week) => week.days > 0);
  const regular =
    recent.days === 1
      ? activeWeeks.length >= 3
      : recent.days >= 2 && activeWeeks.filter((week) => week.days >= 2).length >= 2;
  const difficulty = history[0]?.difficultyReported ?? false;
  let capacity = recent.days || 2;
  if (regular && !difficulty) {
    capacity = Math.min(
      recent.days + 1,
      Math.floor(median(activeWeeks.map((week) => week.days))) + 1,
    );
  } else if (!regular) {
    capacity = Math.min(2, capacity);
  }
  const starting = Math.min(starterMinutes[goal.sport] * 60, history[0]?.seconds ?? Infinity);
  const budget = recent.days
    ? Math.min(recent.duration_seconds, median(activeWeeks.map((week) => week.duration_seconds)))
    : starting * Math.min(capacity, goal.sessions_per_week);
  const count = Math.min(goal.sessions_per_week, capacity, Math.max(1, Math.floor(budget)));
  const sessions: EnduranceSession[] = Array.from({ length: count }, (_, index) => {
    if (difficulty) return index === 0 ? 'recovery' : 'easy';
    if (goal.sport === 'swimming' && index === 0 && (!regular || count >= 3)) return 'technique';
    if (index === count - 1 && goal.objective === 'distance' && recent.days) return 'long';
    if (
      index === Math.min(1, count - 1) &&
      regular &&
      count <= recent.days &&
      goal.objective === 'performance' &&
      budget / count >= 25 * 60
    ) {
      return (goal.target_distance_km ?? 0) > shortDistance[goal.sport] ? 'tempo' : 'intervals';
    }
    if (index > 0 && index === count - 1) return 'recovery';
    return 'easy';
  });
  let extension: { base: ComparableEffort; duration: number; distance: number } | undefined;
  if (
    goal.objective === 'distance' &&
    regular &&
    !difficulty &&
    count === recent.days &&
    longest?.continuous &&
    longest.controlledAndRecovered &&
    goal.target_distance_km &&
    history.slice(0, recent.sessions).some((workout) => workout.efforts.includes(longest))
  ) {
    // Reserve one established outing before distributing the other sessions' time.
    const targetDistance = Math.min(goal.target_distance_km, longest.distance * 1.05);
    const secondsAdded = Math.min(
      180,
      Math.floor((longest.seconds * targetDistance) / longest.distance - longest.seconds),
    );
    const minimumOtherDuration = Math.min(starting, Math.floor(budget / (count * 2)));
    if (secondsAdded >= 60 && longest.seconds + minimumOtherDuration * (count - 1) <= budget) {
      extension = {
        base: longest,
        duration: longest.seconds + secondsAdded,
        distance: targetDistance,
      };
    }
  }
  const totalWeight =
    sessions.reduce((sum, session) => sum + weights[session], 0) - (extension ? weights.long : 0);
  const remainingBudget = extension ? budget - extension.base.seconds : budget;
  const longestRecentSession = recent.days
    ? Math.max(...history.slice(0, recent.sessions).map((w) => w.seconds))
    : starting;
  const plan = sessions.map((type): EndurancePlanSlot => {
    const extended = type === 'long' ? extension : undefined;
    const seconds =
      extended?.duration ??
      Math.min(longestRecentSession, (remainingBudget * weights[type]) / totalWeight);
    const duration_seconds = extended
      ? seconds
      : Math.max(1, seconds >= 300 ? Math.floor(seconds / 60) * 60 : Math.floor(seconds));
    const session =
      (type === 'intervals' || type === 'tempo') && duration_seconds < 25 * 60 ? 'easy' : type;
    let detail = instructions(goal.sport, session);
    const slot = { session, duration_seconds, label: planLabels[goal.sport][session], detail };
    if (session === 'long' && longest && recent.days) {
      const km = Math.min(
        extended?.distance ?? longest.distance,
        (duration_seconds * longest.distance) / longest.seconds,
        goal.target_distance_km ?? Infinity,
      );
      const distance_km =
        Math.floor(km * (goal.sport === 'swimming' ? 1000 : 100)) /
        (goal.sport === 'swimming' ? 1000 : 100);
      if (distance_km > 0) {
        if (extended)
          detail +=
            ' Votre sortie de référence a été maîtrisée et suivie d’une bonne récupération. Essayez ce léger allongement en gardant le même effort.';
        detail +=
          ' La distance est un repère tiré de vos séances. Arrêtez la sortie au premier des deux repères atteints.';
        return { ...slot, distance_km, detail };
      }
    }
    return slot;
  });

  let guidance =
    'Répartissez les séances sur des jours distincts en gardant une journée facile ou de repos autour d’un effort soutenu.';
  if (!recent.days) {
    guidance =
      'Commencez par ces séances faciles et renseignez vos durées pour adapter la semaine suivante.';
  } else if (difficulty) {
    guidance =
      'Votre dernière séance signale une difficulté. Gardez un effort facile et décalez la prochaine séance si la gêne persiste.';
  } else if (!regular) {
    guidance =
      'Consolidez d’abord votre régularité. Le plan s’appuie sur le temps d’activité des sept derniers jours.';
  }
  if (count < goal.sessions_per_week) {
    guidance = `${count} séance(s) proposée(s) pour commencer sur ${goal.sessions_per_week} souhaitée(s). ${guidance}`;
  }
  return { plan, guidance };
}

export function enduranceCoaching(
  goal: EnduranceGoal,
  workouts: Workout[],
  now = Date.now(),
): EnduranceCoaching {
  const today = parisDay(now);
  const history = sportHistory(workouts, goal.sport, now, today);
  const weeks = Array.from({ length: 4 }, (_, index) =>
    summarize(history.filter((workout) => Math.floor((today - workout.day) / 7) === index)),
  );
  const recent = weeks[0];
  const longest = history
    .filter((w) => w.day >= today - 27)
    .flatMap((w) => w.efforts)
    .filter((effort) => effort.session === 'easy' || effort.session === 'long')
    .reduce<ComparableEffort | undefined>(
      (best, effort) => (!best || effort.distance > best.distance ? effort : best),
      undefined,
    );
  const comparison = latestComparison(history);
  const facts: string[] = [];
  if (weeks[1].days > 0)
    facts.push(`${weeks[1].days} jour(s) d’entraînement les sept jours précédents.`);
  if (longest) {
    facts.push(
      `Votre plus grande distance renseignée sur une séance d’endurance récente est de ${distanceLabel(longest.distance, goal.sport)}.`,
    );
  }
  if (goal.target_distance_km && goal.objective !== 'fitness') {
    const target = distanceLabel(goal.target_distance_km, goal.sport);
    facts.push(
      longest && longest.distance >= goal.target_distance_km
        ? `La distance de ${target} a déjà été atteinte dans votre historique d’endurance récent.`
        : `Votre objectif de ${target} sert de repère pour faire évoluer le plan au fil des séances.`,
    );
  }
  if (goal.target_distance_km && goal.target_time_seconds) {
    const rate = enduranceRate(goal.sport, goal.target_time_seconds, goal.target_distance_km);
    if (rate !== null)
      facts.push(`Votre cible correspond à ${formatEnduranceRate(goal.sport, rate)} en moyenne.`);
    const targetMeters = Math.round(goal.target_distance_km * 1000);
    const benchmark = history
      .flatMap((workout) => workout.efforts)
      .find((effort) => effort.continuous && Math.round(effort.distance * 1000) === targetMeters);
    if (benchmark) {
      const gap = benchmark.seconds - goal.target_time_seconds;
      const comparison =
        gap === 0
          ? 'exactement le temps cible'
          : `${elapsedLabel(Math.abs(gap))} de ${gap > 0 ? 'plus' : 'moins'} que le temps cible`;
      facts.push(
        `Votre dernier effort de ${distanceLabel(benchmark.distance, goal.sport)} saisi en un seul segment a duré ${elapsedLabel(benchmark.seconds)}, soit ${comparison}.`,
      );
    } else {
      facts.push(
        `Il manque une séance enregistrée à ${distanceLabel(goal.target_distance_km, goal.sport)} en un seul segment d’endurance ou de tempo pour comparer votre temps à la cible.`,
      );
    }
  }
  if (!comparison && history.length)
    facts.push(
      'Pour comparer deux temps, renseignez la distance des mêmes segments sur deux séances du même type.',
    );
  return { recent, comparison, ...makePlan(goal, history, weeks, longest), facts };
}
