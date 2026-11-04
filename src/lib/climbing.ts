import type { Exercise, Workout } from './domain';
// Ordinal labels only: adjacent grades are not equal increments of effort.
export const climbingGrades = Array.from({ length: 9 }, (_, i) => [
  String(i + 1),
  ...['a', 'b', 'c'].flatMap((letter) => [`${i + 1}${letter}`, `${i + 1}${letter}+`]),
]).flat();
export const isClimbing = (kind?: string) => kind === 'climbing' || kind === 'bouldering';
export const isStrength = (kind?: string) =>
  ['external', 'bodyweight', 'assisted'].includes(kind ?? '');
export function gradeLabel(grade: string | null | undefined, kind?: string) {
  return grade ? (kind === 'bouldering' ? grade.toUpperCase() : grade) : 'Non renseignée';
}
export function gradeRank(grade?: string | null) {
  return grade ? climbingGrades.indexOf(grade) : -1;
}
export function climbingTotals(workouts: Workout[], kind: 'climbing' | 'bouldering') {
  const entries = workouts
    .flatMap((w) => w.exercises)
    .filter((e) => e.load_kind === kind)
    .flatMap((e) => e.sets)
    .filter((s) => s.completed && s.climbing?.grade);
  const sent = entries.filter((s) => s.climbing?.result === 'sent');
  const highest = sent.reduce(
    (best, s) => (gradeRank(s.climbing?.grade) > gradeRank(best) ? s.climbing!.grade : best),
    null as string | null,
  );
  return {
    count: entries.length,
    sent: sent.length,
    attempts: entries.reduce((n, s) => n + (s.climbing?.attempts ?? 0), 0),
    highest,
  };
}
export const sportCatalog: Exercise[] = (['climbing', 'bouldering'] as const).map((kind, i) => ({
  id: `40000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  user_id: null,
  name: kind === 'climbing' ? 'Escalade — voies' : 'Escalade — bloc',
  english_name: kind === 'climbing' ? 'Sport climbing routes' : 'Bouldering',
  category: 'Sports · Escalade',
  equipment: 'Poids du corps',
  primary_muscle: 'Dos',
  secondary_muscles: ['Biceps', 'Abdominaux', 'Épaules', 'Quadriceps', 'Fessiers'],
  description: 'Consignez une cotation, vos essais et le résultat de chaque passage.',
  instructions: [
    'Ajoutez une ligne par voie ou bloc travaillé.',
    'Choisissez la cotation affichée ou celle du topo et indiquez le nombre d’essais.',
    'Distinguez une réussite d’un projet encore tenté. Précisez la salle, le secteur ou la couleur dans les notes.',
  ],
  tips: 'Les cotations restent des repères de difficulté. Voies et blocs ont des historiques distincts ; les couleurs d’une salle ne sont pas converties automatiquement.',
  mistakes:
    'Une tentative enregistrée ne constitue pas une réussite. Les passages ne comptent pas comme des séries de musculation.',
  load_kind: kind,
  supports_1rm: false,
}));
