import type { Program, Workout } from './domain';
export function duplicateProgram(p: Program): Program {
  return {
    ...p,
    id: crypto.randomUUID(),
    revision: 0,
    name: `${p.name} (copie)`,
    active: false,
    days: p.days.map((d) => {
      const groupMap = new Map(d.groups.map((g) => [g.id, crypto.randomUUID()]));
      return {
        ...d,
        id: crypto.randomUUID(),
        groups: d.groups.map((g) => ({ ...g, id: groupMap.get(g.id)! })),
        exercises: d.exercises.map((e) => ({
          ...e,
          id: crypto.randomUUID(),
          target: { ...e.target },
          group_id: e.group_id ? groupMap.get(e.group_id)! : null,
        })),
      };
    }),
  };
}
export function duplicateWorkout(w: Workout): Workout {
  const groupMap = new Map(w.groups.map((g) => [g.id, crypto.randomUUID()]));
  return {
    ...w,
    id: crypto.randomUUID(),
    revision: 0,
    status: 'draft',
    source_day_id: null,
    name: `${w.name} (copie)`,
    started_at: new Date().toISOString(),
    finished_at: null,
    round_rests: [],
    groups: w.groups.map((g) => ({ ...g, id: groupMap.get(g.id)! })),
    exercises: w.exercises.map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      group_id: e.group_id ? groupMap.get(e.group_id)! : null,
      technique_ok: false,
      sets: e.sets.map((s) => ({
        ...s,
        id: crypto.randomUUID(),
        completed: false,
        rest_seconds: null,
        rpe: null,
        rir: null,
        duration_seconds: e.load_kind === 'cardio' ? null : s.duration_seconds,
        distance_km: e.load_kind === 'cardio' ? null : s.distance_km,
      })),
    })),
  };
}
export function move<T>(list: T[], index: number, delta: number) {
  const next = [...list];
  if (index + delta < 0 || index + delta >= list.length) return list;
  [next[index], next[index + delta]] = [next[index + delta], next[index]];
  return next;
}
