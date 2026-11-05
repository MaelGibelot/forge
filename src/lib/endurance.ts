import { z } from 'zod';
import type { Exercise } from './domain';

const sports = ['running', 'swimming', 'cycling'] as const;
export type EnduranceSport = (typeof sports)[number];
export type EnduranceSession = 'easy' | 'intervals' | 'tempo' | 'long' | 'technique' | 'recovery';

export const enduranceSportLabels: Record<EnduranceSport, string> = {
  running: 'Course à pied',
  swimming: 'Natation',
  cycling: 'Vélo',
};

export const enduranceGoalSchema = z
  .object({
    sport: z.enum(sports),
    objective: z.enum(['fitness', 'distance', 'performance']),
    sessions_per_week: z.number().int().min(1).max(7),
    target_distance_km: z.number().positive().max(10000).nullable().optional(),
    target_time_seconds: z.number().int().positive().max(86400).nullable().optional(),
  })
  .refine((goal) => goal.target_time_seconds == null || goal.target_distance_km != null, {
    message: 'Renseignez une distance pour associer un temps cible.',
    path: ['target_distance_km'],
  });
export type EnduranceGoal = z.infer<typeof enduranceGoalSchema>;

export const enduranceGoalsSchema = z
  .array(enduranceGoalSchema)
  .max(sports.length)
  .refine((goals) => new Set(goals.map((goal) => goal.sport)).size === goals.length, {
    message: 'Conservez un objectif par sport.',
  });

const sessions = ['easy', 'intervals', 'tempo', 'long', 'technique', 'recovery'] as const;
const sessionLabels: Record<EnduranceSport, Record<EnduranceSession, string>> = {
  running: {
    easy: 'endurance fondamentale',
    intervals: 'fractionné / intervalles',
    tempo: 'tempo / seuil',
    long: 'sortie longue',
    technique: 'éducatifs',
    recovery: 'footing de récupération',
  },
  swimming: {
    easy: 'endurance',
    intervals: 'intervalles',
    tempo: 'allure soutenue',
    long: 'distance',
    technique: 'technique et éducatifs',
    recovery: 'récupération',
  },
  cycling: {
    easy: 'endurance',
    intervals: 'intervalles',
    tempo: 'tempo',
    long: 'sortie longue',
    technique: 'technique et cadence',
    recovery: 'récupération',
  },
};

const activities = sports.flatMap((sport, sportIndex) =>
  sessions.map((session, sessionIndex) => {
    const name = `${enduranceSportLabels[sport]} — ${sessionLabels[sport][session]}`;
    const exercise: Exercise = {
      id: `50000000-0000-4000-8000-${String(sportIndex * 100 + sessionIndex + 1).padStart(12, '0')}`,
      user_id: null,
      name,
      english_name: `${sport} ${session}`,
      description: 'Enregistrez le temps d’activité et la distance pour suivre votre progression.',
      category: `Sports · ${enduranceSportLabels[sport]}`,
      equipment: 'Cardio',
      primary_muscle: sport === 'swimming' ? 'Dos' : 'Quadriceps',
      secondary_muscles: [],
      instructions: [
        'Indiquez la durée d’activité et la distance réellement parcourue.',
        'Pour une séance découpée, utilisez une ligne par segment et distinguez l’échauffement du travail.',
      ],
      tips: 'Précisez le parcours ou le bassin dans les notes pour comparer des séances similaires.',
      mistakes: 'Évitez de saisir la durée totale et celle de chaque segment dans la même séance.',
      load_kind: 'cardio',
      supports_1rm: false,
    };
    return { sport, session, exercise };
  }),
);

export const enduranceActivities = activities.map(({ exercise }) => exercise);
const activityById = new Map(activities.map((activity) => [activity.exercise.id, activity]));

export function enduranceActivity(id?: string) {
  return id ? activityById.get(id) : undefined;
}

export function enduranceRate(sport: EnduranceSport, seconds: number, km: number) {
  if (!Number.isFinite(seconds) || !Number.isFinite(km) || seconds <= 0 || km <= 0) return null;
  const rate =
    sport === 'cycling' ? (3600 * km) / seconds : seconds / (sport === 'swimming' ? km * 10 : km);
  return Number.isFinite(rate) ? rate : null;
}

export function formatEnduranceRate(sport: EnduranceSport, rate: number) {
  if (sport === 'cycling') {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(rate)} km/h`;
  }
  const seconds = Math.round(rate);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')} /${sport === 'swimming' ? '100 m' : 'km'}`;
}
