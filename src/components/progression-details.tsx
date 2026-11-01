'use client';
import type { Suggestion } from '@/lib/progression';
import type { Exercise } from '@/lib/domain';
import { number } from '@/lib/metrics';

export function ProgressionDetails({
  suggestion,
  loadKind,
}: {
  suggestion: Suggestion;
  loadKind: Exercise['load_kind'];
}) {
  return (
    <div className="progression-details">
      {suggestion.plan && (
        <ol aria-label="Plan proposé par série">
          {suggestion.plan.map((s, i) => (
            <li key={i}>
              Série {i + 1} :{' '}
              {s.weight === null
                ? 'Poids du corps'
                : `${number(s.weight, 2)} kg${loadKind === 'assisted' ? ' d’aide' : ''}`}{' '}
              × {s.reps} répétitions
            </li>
          ))}
        </ol>
      )}
      {suggestion.analysis && (
        <details className="notes-details">
          <summary>Pourquoi cette proposition ?</summary>
          <ul>
            {suggestion.analysis.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="muted">
            Repères indicatifs : une case d’échec vide ne mesure pas les répétitions en réserve. La
            tendance des autres exercices peut modérer une hausse, jamais l’imposer.
          </p>
        </details>
      )}
    </div>
  );
}
