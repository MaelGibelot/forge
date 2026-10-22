'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { MuscleActivity } from './anatomy';
import type { Exercise, Workout } from '@/lib/domain';
import {
  cardioTotals,
  duration,
  eligible,
  muscleSeries,
  number,
  workoutVolume,
} from '@/lib/metrics';

const MuscleChart = dynamic(() => import('./charts').then((m) => m.MuscleChart), {
  ssr: false,
  loading: () => <div className="chart-placeholder">Chargement du graphique…</div>,
});

export function WorkoutSummary({
  workout,
  exercises,
}: {
  workout: Workout;
  exercises: Exercise[];
}) {
  const [warmup, setWarmup] = useState(false);
  const { direct, secondary } = muscleSeries([workout], exercises, warmup);
  const sets = workout.exercises
    .filter((e) => e.load_kind !== 'cardio')
    .flatMap((e) => e.sets)
    .filter((s) => eligible(s, warmup));
  const cardio = cardioTotals(workout, warmup);
  const hasDistance = workout.exercises.some(
    (e) =>
      e.load_kind === 'cardio' &&
      e.sets.some(
        (s) =>
          s.completed &&
          (s.duration_seconds ?? 0) > 0 &&
          (warmup || s.type !== 'warmup') &&
          s.distance_km != null,
      ),
  );
  const rows = direct
    .map((m, i) => ({ name: m.name, direct: m.count, secondary: secondary[i].count }))
    .filter((r) => r.direct > 0 || r.secondary > 0);
  return (
    <section aria-label="Bilan de la séance" className="stack" style={{ marginBottom: 28 }}>
      <div className="flex between">
        <div>
          <h2>Bilan de la séance</h2>
          <p className="muted">Uniquement les séries et intervalles validés de cette séance.</p>
        </div>
        <label className="check-label">
          <input type="checkbox" checked={warmup} onChange={(e) => setWarmup(e.target.checked)} />
          Inclure les échauffements
        </label>
      </div>
      <div className="metrics">
        {[
          ['Séries réalisées', number(sets.length)],
          ['Répétitions', number(sets.reduce((n, s) => n + s.reps, 0))],
          ['Volume externe', `${number(workoutVolume(workout, warmup))} kg`],
          ...(cardio.seconds
            ? [
                ['Durée cardio', duration(cardio.seconds)],
                [
                  'Distance cardio',
                  hasDistance ? `${number(cardio.distance, 2)} km` : 'Non renseignée',
                ],
              ]
            : []),
        ].map(([label, value]) => (
          <div key={label} className="card metric">
            <div className="metric-top">{label}</div>
            <div className="metric-value">{value}</div>
          </div>
        ))}
      </div>
      <section className="card" aria-label="Répartition musculaire de la séance">
        <h3>Répartition des séries par groupe musculaire</h3>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Séries directes et sollicitations indirectes comptées séparément. Le cardio n’ajoute pas
          de séries musculaires.
        </p>
        {rows.length ? (
          <MuscleChart rows={rows} />
        ) : (
          <p className="muted" style={{ marginTop: 20 }}>
            Aucune série de musculation validée avec ce filtre.
          </p>
        )}
        <details className="notes-details">
          <summary>Voir les données du graphique</summary>
          <table className="data-table">
            <thead>
              <tr>
                <th>Groupe</th>
                <th>Directes</th>
                <th>Indirectes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <th scope="row">{r.name}</th>
                  <td>{r.direct}</td>
                  <td>{r.secondary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
      <MuscleActivity direct={direct} secondary={secondary} scope="workout" />
    </section>
  );
}
