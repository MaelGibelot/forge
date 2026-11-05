'use client';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { Exercise, Workout } from '@/lib/domain';
import {
  enduranceActivity,
  enduranceSportLabels,
  type EnduranceGoal,
  type EnduranceSport,
} from '@/lib/endurance';
import { enduranceCoaching } from '@/lib/endurance-coach';
import { duration, number, shortDate } from '@/lib/metrics';
import { enduranceObjectiveLabels } from './endurance-goals';
import { Button } from './ui';

function formatDistance(sport: EnduranceSport, km: number) {
  return sport === 'swimming' ? `${number(km * 1000)} m` : `${number(km, 2)} km`;
}

export function EndurancePlans({
  goals,
  workouts,
  exercises,
  now,
  activeWorkoutId,
  busy,
  onStart,
}: {
  goals: EnduranceGoal[];
  workouts: Workout[] | null;
  exercises: Exercise[];
  now: number;
  activeWorkoutId?: string;
  busy: boolean;
  onStart: (activityId: string, notes: string) => void;
}) {
  return (
    <div className="stack gap-sm">
      <div className="flex between">
        <h3>Plans cardio</h3>
        <Link className="text-link" href="/parametres#objectifs-cardio">
          {goals.length ? 'Modifier mes objectifs cardio' : 'Choisir un objectif cardio'}
          <ArrowUpRight size={14} />
        </Link>
      </div>
      {goals.length === 0 && (
        <p className="muted">
          Configurez un objectif de course à pied, de natation ou de vélo pour obtenir un plan à
          votre rythme.
        </p>
      )}
      {goals.length > 0 && !workouts && <p role="status">Analyse des séances cardio…</p>}
      {goals.length > 0 && workouts && activeWorkoutId && (
        <p className="muted">
          Une séance est en cours.{' '}
          <Link className="text-link" href={`/seances/${activeWorkoutId}`}>
            Reprendre la séance en cours
          </Link>
        </p>
      )}
      {goals.length > 0 && busy && <p role="status">Ouverture de la séance…</p>}
      {workouts &&
        goals.map((goal, index) => {
          const { recent, comparison, plan, facts, guidance } = enduranceCoaching(
            goal,
            workouts,
            now,
          );
          const sport = enduranceSportLabels[goal.sport];
          const frequency = `${goal.sessions_per_week} séance${goal.sessions_per_week > 1 ? 's' : ''} par semaine`;
          return (
            <details key={goal.sport} open={index === 0}>
              <summary>
                <strong>{sport}</strong> · {frequency}
              </summary>
              <div className="stack gap-sm" style={{ marginTop: 12 }}>
                <p>
                  {enduranceObjectiveLabels[goal.objective]}
                  {goal.target_distance_km != null &&
                    ` · ${formatDistance(goal.sport, goal.target_distance_km)}`}
                  {goal.target_time_seconds != null && ` en ${duration(goal.target_time_seconds)}`}
                </p>
                <p className="muted">
                  Sur les 7 derniers jours, {recent.sessions}{' '}
                  {recent.sessions === 1 ? 'séance' : 'séances'} sur {recent.days}{' '}
                  {recent.days === 1 ? 'jour' : 'jours'} · {duration(recent.duration_seconds)}{' '}
                  d’activité enregistrée.
                  {recent.distance_recorded_sessions > 0 && (
                    <>
                      {' '}
                      {formatDistance(goal.sport, recent.distance_km)} relevés sur{' '}
                      {recent.distance_recorded_sessions}{' '}
                      {recent.distance_recorded_sessions === 1 ? 'séance' : 'séances'}.
                    </>
                  )}
                </p>
                {comparison && (
                  <p>
                    {comparison.activity_name} · Sur le même format enregistré, à{' '}
                    {formatDistance(goal.sport, comparison.distance_km)},{' '}
                    {duration(comparison.latest_seconds)} le {shortDate(comparison.latest_date)}{' '}
                    contre {duration(comparison.previous_seconds)} le{' '}
                    {shortDate(comparison.previous_date)}.{' '}
                    {Math.abs(comparison.change_percent) < 0.05
                      ? 'Temps stable.'
                      : `${number(Math.abs(comparison.change_percent), 1)} % de temps en ${comparison.change_percent < 0 ? 'moins' : 'plus'}.`}
                  </p>
                )}
                {facts.map((fact) => (
                  <p key={fact} className="muted">
                    {fact}
                  </p>
                ))}
                <p>{guidance}</p>
                <h4>Séances proposées pour la semaine</h4>
                <ol className="stack gap-sm" style={{ listStyle: 'none', padding: 0 }}>
                  {plan.map((slot, position) => {
                    const exercise = exercises.find((entry) => {
                      const activity = enduranceActivity(entry.id);
                      return activity?.sport === goal.sport && activity.session === slot.session;
                    });
                    const target = [
                      duration(slot.duration_seconds),
                      slot.distance_km == null ? '' : formatDistance(goal.sport, slot.distance_km),
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <li className="quick-program" style={{ flexWrap: 'wrap' }} key={position}>
                        <div>
                          <h4>
                            Séance {position + 1} · {slot.label}
                          </h4>
                          <p>
                            {slot.distance_km == null
                              ? 'Durée prévue'
                              : 'Durée et distance prévues'}
                            {' · '}
                            {target}
                          </p>
                          <p>{slot.detail}</p>
                        </div>
                        {!activeWorkoutId && exercise && (
                          <Button
                            variant="secondary"
                            disabled={busy}
                            aria-label={`Démarrer ${sport}, séance ${position + 1} · ${slot.label}`}
                            onClick={() =>
                              onStart(exercise.id, `${slot.label} · ${target}\n${slot.detail}`)
                            }
                          >
                            Démarrer
                            <ArrowUpRight size={14} />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            </details>
          );
        })}
    </div>
  );
}
