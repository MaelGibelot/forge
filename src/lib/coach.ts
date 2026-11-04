import type { AppData, Workout, WorkoutExercise } from './domain';
import { recommendation, performanceTrend } from './progression';
import { resolveRepGoal } from './training-knowledge';
import { isStrength } from './climbing';

export interface CoachAdvice {
  id: string;
  title: string;
  fact: string;
  advice: string;
  priority: number;
  href: string;
  action: string;
}
export function coachAdvice(
  data: Pick<AppData, 'preferences' | 'exercises' | 'progression' | 'programs'>,
  workouts: Workout[],
  now = Date.now(),
): CoachAdvice[] {
  if (!data.preferences.recommendations) return [];
  const recent = workouts
    .filter(
      (w) =>
        w.status === 'completed' &&
        Date.parse(w.started_at) <= now &&
        Date.parse(w.started_at) >= now - 42 * 864e5,
    )
    .toSorted((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
  const latest = new Map<string, WorkoutExercise>();
  for (const w of recent)
    for (const e of w.exercises)
      if (isStrength(e.load_kind) && !latest.has(e.exercise_id)) latest.set(e.exercise_id, e);
  const cards: CoachAdvice[] = [];
  for (const [id, e] of latest) {
    const setting = data.progression.find((s) => s.exercise_id === id);
    const exercise = data.exercises.find((x) => x.id === id);
    if (!exercise) continue;
    const program = data.programs
      .filter((p) => p.active)
      .flatMap((p) => p.days.flatMap((d) => d.exercises))
      .find((x) => x.exercise_id === id);
    const goal = resolveRepGoal({
      exercise,
      setting,
      program: program?.target,
      previous: e.target,
      preferences: data.preferences,
    });
    const entry = {
      ...e,
      sets: [],
      target: { ...e.target, reps_min: goal.reps_min, reps_max: goal.reps_max },
      increment: setting?.increment ?? program?.increment ?? e.increment,
    };
    const r = recommendation(entry, recent, data.preferences, undefined, undefined, setting);
    const trend = performanceTrend(id, recent, now);
    let title = r.title,
      fact = `${e.name} · dernière occurrence enregistrée.`,
      advice = r.reason,
      priority = 1;
    if (e.feedback?.pain || e.feedback?.technique_issue) {
      priority = 10;
      fact = `${e.name} · inconfort ou difficulté technique déclaré à la dernière occurrence.`;
    } else if (
      e.feedback?.recovery === 'poor' ||
      e.feedback?.effort === 'hard' ||
      r.kind === 'fatigue'
    )
      priority = 9;
    else if (e.sets.some((s) => s.completed && s.reached_failure)) {
      priority = 8;
      fact = `${e.name} · échec déclaré à la dernière occurrence.`;
    } else if (r.kind === 'hold' && /autres exercices|exercices baissent/.test(r.reason))
      priority = 8;
    else if (trend && trend.repsGain !== null && trend.repsGain > 0 && r.kind !== 'insufficient') {
      title = `Vous progressez sur ${e.name}`;
      fact = `+${trend.repsGain} répétition(s) au total à mêmes charges, sur vos deux dernières occurrences comparables.`;
      advice =
        'La progression en répétitions compte aussi. Gardez votre cible et vérifiez le prochain plan avant de changer les charges.';
      priority = 6;
    } else if (r.kind === 'increase') {
      priority = 5;
      fact = `${e.name} · cible confirmée sur plusieurs occurrences comparables.`;
    } else if (trend?.plateau) {
      title = `Un palier sur ${e.name}`;
      fact = 'Trois occurrences comparables stables, à mêmes charges.';
      advice = `${r.reason} Vérifiez aussi vos repos et votre exécution avant de modifier le volume.`;
      priority = 4;
    }
    if (priority > 1)
      cards.push({
        id: `${recent.find((w) => w.exercises.some((x) => x.exercise_id === id))!.id}:${id}:${title}`,
        title,
        fact,
        advice,
        priority,
        href: `/exercices/${id}`,
        action: 'Voir l’exercice et son plan',
      });
  }
  const series = (from: number, until: number) => {
    const totals = new Map<string, number>();
    for (const w of recent.filter(
      (w) => Date.parse(w.started_at) >= from && Date.parse(w.started_at) < until,
    )) {
      for (const e of w.exercises.filter((e) => isStrength(e.load_kind))) {
        const n = e.sets.filter((s) => s.type === 'normal' && s.completed && s.reps > 0).length;
        totals.set(e.primary_muscle, (totals.get(e.primary_muscle) ?? 0) + n);
      }
    }
    return totals;
  };
  const current = series(now - 7 * 864e5, now + 1),
    previous = series(now - 14 * 864e5, now - 7 * 864e5);
  for (const [muscle, n] of current) {
    const old = previous.get(muscle) ?? 0;
    if (old >= 6 && n >= 10 && n > old * 1.5)
      cards.push({
        id: `volume:${muscle}:${n}:${old}`,
        title: `Volume en hausse : ${muscle}`,
        fact: `${n} séries directes sur les 7 derniers jours, contre ${old} les 7 jours précédents. Échauffements, dégressives et travail indirect exclus.`,
        advice: `Surveillez votre récupération et vos performances avant d’ajouter des séries.${data.preferences.coaching?.volume_preference === 'minimal' ? ' Vous privilégiez un volume minimal : consolidez cette base.' : ''} Cette variation ne prouve pas une surcharge ou un surentraînement.`,
        priority: 7,
        href: '/statistiques',
        action: 'Voir le volume',
      });
  }
  if (!cards.length && recent.length)
    cards.push({
      id: `base:${recent[0].id}`,
      title: 'Consolidez votre prochain entraînement',
      fact: `${recent.filter((w) => Date.parse(w.started_at) >= now - 7 * 864e5).length} séance(s) terminée(s) sur les 7 derniers jours.${data.preferences.coaching?.sessions_per_week ? ` Votre souhait : ${data.preferences.coaching.sessions_per_week} par semaine.` : ''}`,
      advice:
        'Les données récentes ne justifient pas de conseil plus précis. Réglez vos objectifs fixes ou vos plages et renseignez votre ressenti pour affiner les propositions.',
      priority: 1,
      href: '/parametres',
      action: 'Personnaliser mon coaching',
    });
  if (!recent.length)
    cards.push({
      id: 'first',
      title: 'Définissez vos repères de départ',
      fact: 'Aucune séance terminée dans les six dernières semaines.',
      advice:
        'Choisissez votre objectif et vos répétitions cibles. Les repères par exercice sont facultatifs ; aucune charge ne sera inventée sans historique.',
      priority: 1,
      href: '/parametres',
      action: 'Définir mon profil',
    });
  return cards.toSorted((a, b) => b.priority - a.priority || a.id.localeCompare(b.id)).slice(0, 3);
}
