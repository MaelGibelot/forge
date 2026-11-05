'use client';
import { useState } from 'react';
import { enduranceSportLabels, type EnduranceGoal, type EnduranceSport } from '@/lib/endurance';
import { Field, NumberField, RestInput } from './ui';

export const enduranceObjectiveLabels: Record<EnduranceGoal['objective'], string> = {
  fitness: 'Améliorer mon endurance',
  distance: 'Préparer une distance',
  performance: 'Améliorer mon chrono',
};

export function EnduranceGoalsFields({
  goals,
  onChange,
}: {
  goals: EnduranceGoal[];
  onChange: (goals: EnduranceGoal[]) => void;
}) {
  const [sport, setSport] = useState<EnduranceSport>('running');
  const goal = goals.find((item) => item.sport === sport);
  const swimming = sport === 'swimming';
  const distanceFactor = swimming ? 1000 : 1;

  function updateGoal(patch: Partial<Omit<EnduranceGoal, 'sport'>>) {
    const next: EnduranceGoal = {
      sport,
      objective: 'fitness',
      sessions_per_week: 2,
      ...goal,
      ...patch,
    };
    onChange(goal ? goals.map((item) => (item.sport === sport ? next : item)) : [...goals, next]);
  }

  return (
    <section
      className="stack gap-sm"
      id="objectifs-cardio"
      aria-labelledby="objectifs-cardio-title"
    >
      <h3 id="objectifs-cardio-title">Objectifs cardio</h3>
      <p className="muted">
        Choisissez un objectif et une fréquence pour chaque sport. Vos plans apparaissent dans les
        conseils du coach sur l’accueil.
      </p>
      {goals.length > 0 && (
        <div className="flex" aria-label="Objectifs cardio configurés">
          {goals.map((item) => (
            <span className="badge" key={item.sport}>
              {enduranceSportLabels[item.sport]} · {item.sessions_per_week}{' '}
              {item.sessions_per_week === 1 ? 'séance' : 'séances'} par semaine
            </span>
          ))}
        </div>
      )}
      <Field label="Sport">
        <select
          aria-label="Sport de l’objectif cardio"
          value={sport}
          onChange={(event) => setSport(event.target.value as EnduranceSport)}
        >
          {Object.entries(enduranceSportLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Objectif cardio">
        <select
          aria-label={`Objectif cardio · ${enduranceSportLabels[sport]}`}
          value={goal?.objective ?? ''}
          onChange={(event) => {
            const objective = event.target.value as EnduranceGoal['objective'] | '';
            if (objective) updateGoal({ objective });
            else onChange(goals.filter((item) => item.sport !== sport));
          }}
        >
          <option value="">Aucun plan</option>
          {Object.entries(enduranceObjectiveLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      {goal && (
        <>
          <Field label="Séances par semaine pour ce sport">
            <select
              aria-label={`Séances par semaine · ${enduranceSportLabels[sport]}`}
              value={goal.sessions_per_week}
              onChange={(event) => updateGoal({ sessions_per_week: Number(event.target.value) })}
            >
              {Array.from({ length: 7 }, (_, index) => index + 1).map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Distance cible en ${swimming ? 'm' : 'km'} (facultatif)`}>
            <NumberField
              label={`Distance cible · ${enduranceSportLabels[sport]}`}
              value={
                goal.target_distance_km == null
                  ? null
                  : Number((goal.target_distance_km * distanceFactor).toPrecision(12))
              }
              onChange={(value) =>
                updateGoal({
                  target_distance_km: value == null ? null : value / distanceFactor,
                  ...(value == null ? { target_time_seconds: null } : {}),
                })
              }
              min={swimming ? 1 : 0.01}
              max={10000 * distanceFactor}
              step={swimming ? 1 : 0.01}
              nullable
            />
          </Field>
          {(goal.target_distance_km ?? 0) > 0 && (
            <Field label="Temps cible en minutes et secondes (facultatif)">
              <RestInput
                label={`Temps cible · ${enduranceSportLabels[sport]}`}
                value={goal.target_time_seconds ?? null}
                onChange={(value) => updateGoal({ target_time_seconds: value })}
                maxMinutes={1440}
              />
            </Field>
          )}
        </>
      )}
    </section>
  );
}
