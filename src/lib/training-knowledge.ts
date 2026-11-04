import type { Exercise, Preferences, ProgressionSetting, Target, Workout } from './domain';

export const goalLabels = {
  hypertrophy: 'Hypertrophie',
  strength: 'Force',
  endurance: 'Endurance musculaire',
  maintenance: 'Entretien',
};
export type TrainingGoal = keyof typeof goalLabels;
export function movementKnowledge(e: Pick<Exercise, 'name' | 'primary_muscle' | 'equipment'>) {
  const n = e.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const rules = [
    {
      match: /leg.?curl|curl.*(?:ischio|jambe)|flexion.*genou/,
      range: [10, 15],
      isolation: true,
      cue: 'Gardez le bassin stable sur l’appui, alignez le réglage de la machine avec le genou et contrôlez le retour.',
    },
    {
      match: /elevation.*later|lateral raise/,
      range: [12, 20],
      isolation: true,
      cue: 'Gardez le tronc stable et une montée contrôlée ; arrêtez la série si l’élan remplace le mouvement de l’épaule.',
    },
    {
      match: /mollet|calf/,
      range: [10, 20],
      isolation: true,
      cue: 'Gardez l’appui stable et une amplitude contrôlée, sans rebond.',
    },
    {
      match: /curl/,
      range: [8, 15],
      isolation: true,
      cue: 'Stabilisez les coudes et le tronc ; réduisez la charge si le balancement prend le dessus.',
    },
    {
      match: /extension.*triceps|triceps.*extension|pushdown|extension.*coude/,
      range: [10, 15],
      isolation: true,
      cue: 'Gardez les épaules stables et contrôlez le retour, avec une amplitude confortable au coude.',
    },
    {
      match: /presse.*cuisse|leg press/,
      range: [10, 15],
      isolation: false,
      cue: 'Gardez le bassin en appui et choisissez une profondeur que vous pouvez contrôler sans douleur.',
    },
    {
      match: /incline.*haltere/,
      range: [8, 10],
      isolation: false,
      cue: 'Stabilisez les appuis et les omoplates ; gardez une trajectoire contrôlée et une amplitude confortable.',
    },
    {
      match: /developpe.*couche|bench press|squat/,
      range: [6, 10],
      isolation: false,
      cue: 'Gardez vos appuis et le tronc stables ; réduisez la charge si vous perdez le contrôle de la trajectoire.',
    },
    {
      match: /tirage|rowing|row|traction|pull.?up|pulldown/,
      range: [8, 12],
      isolation: false,
      cue: 'Gardez le tronc stable et contrôlez le retour sans tirer par à-coups.',
    },
    {
      match: /ecarte|fly|extension|adduct|abduct|leg curl|oiseau/,
      range: [10, 15],
      isolation: true,
      cue: 'Privilégiez une amplitude confortable et un mouvement contrôlé ; évitez de forcer une articulation en fin de course.',
    },
  ];
  const rule = rules.find((r) => r.match.test(n));
  return {
    range: (rule?.range ?? [8, 15]) as [number, number],
    isolation: rule?.isolation ?? false,
    identified: !!rule,
    cue:
      rule?.cue ??
      'Choisissez une amplitude maîtrisée et des appuis stables. Les consignes de la fiche restent vos repères pour ce mouvement.',
  };
}
export function indicativeRange(
  e: Pick<Exercise, 'name' | 'primary_muscle' | 'equipment'>,
  goal?: TrainingGoal | null,
) {
  const k = movementKnowledge(e);
  if (goal === 'endurance') return [15, 25] as const;
  if (goal === 'strength') return k.isolation ? ([8, 12] as const) : ([4, 6] as const);
  if (goal === 'maintenance') return [8, 15] as const;
  return k.range;
}
export function resolveRepGoal({
  explicit,
  program,
  setting,
  previous,
  exercise,
  preferences,
}: {
  explicit?: Pick<Target, 'reps_min' | 'reps_max'>;
  program?: Pick<Target, 'reps_min' | 'reps_max'>;
  setting?: ProgressionSetting;
  previous?: Pick<Target, 'reps_min' | 'reps_max'>;
  exercise: Exercise;
  preferences?: Preferences;
}) {
  const chosen = explicit ?? setting ?? program ?? previous;
  const [min, max] = indicativeRange(exercise, preferences?.coaching?.goal);
  return {
    reps_min: chosen?.reps_min ?? min,
    reps_max: chosen?.reps_max ?? max,
    source:
      explicit || setting
        ? 'Votre objectif'
        : program
          ? 'Programme'
          : previous
            ? 'Dernier objectif connu'
            : 'Repère indicatif, modifiable',
  };
}
export function latestGoal(history: Workout[], exerciseId: string) {
  return history
    .filter((w) => w.status === 'completed' && Date.parse(w.started_at) <= Date.now())
    .toSorted((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))
    .flatMap((w) => w.exercises)
    .find((e) => e.exercise_id === exerciseId)?.target;
}
