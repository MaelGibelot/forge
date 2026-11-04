import type { Workout } from '@/lib/domain';
import { climbingTotals, gradeLabel } from '@/lib/climbing';
import { shortDate } from '@/lib/metrics';
import Link from 'next/link';
export function ClimbingHistory({
  workouts,
  exerciseId,
  kind,
}: {
  workouts: Workout[];
  exerciseId: string;
  kind: 'climbing' | 'bouldering';
}) {
  const filtered = workouts
    .filter((w) => w.status === 'completed')
    .map((w) => ({ ...w, exercises: w.exercises.filter((e) => e.exercise_id === exerciseId) }));
  const total = climbingTotals(filtered, kind);
  const passages = filtered
    .toSorted((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))
    .flatMap((w) =>
      w.exercises.flatMap((e) =>
        e.sets.filter((s) => s.completed && s.climbing?.grade).map((s) => ({ w, s })),
      ),
    );
  return (
    <section className="card stack" aria-label="Historique escalade">
      <h2>Vos niveaux en {kind === 'bouldering' ? 'bloc' : 'voie'}</h2>
      <p>
        {total.sent} réussite(s) sur {total.count} passage(s) enregistré(s) · {total.attempts}{' '}
        essai(s).
      </p>
      <p>
        Meilleure cotation réussie : <strong>{gradeLabel(total.highest, kind)}</strong>
      </p>
      <p className="muted">
        Une tentative reste visible dans le suivi et ne compte pas comme une réussite. Les cotations
        sont des repères de difficulté, pas des charges.
      </p>
      {passages.length ? (
        <details>
          <summary>Voir les passages enregistrés ({passages.length})</summary>
          <ul>
            {passages.map(({ w, s }) => (
              <li key={s.id}>
                <Link href={`/seances/${w.id}`}>
                  {shortDate(w.started_at)} · {gradeLabel(s.climbing?.grade, kind)}
                </Link>{' '}
                · {s.climbing?.result === 'sent' ? 'Réussi' : 'Tenté'} · {s.climbing?.attempts}{' '}
                essai(s){s.notes ? ` · ${s.notes}` : ''}
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="muted">Les niveaux apparaîtront après votre première séance terminée.</p>
      )}
    </section>
  );
}
