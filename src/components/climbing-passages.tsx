'use client';
import { Plus, Trash2 } from 'lucide-react';
import { climbingGrades, gradeLabel } from '@/lib/climbing';
import { newSet, type WorkoutExercise, type WorkoutSet } from '@/lib/domain';
import { Button, Field, NumberField } from './ui';

export function ClimbingPassages({
  exercise: e,
  onChange,
  edit,
}: {
  exercise: WorkoutExercise;
  onChange: (e: WorkoutExercise) => void;
  edit: boolean;
}) {
  const block = e.load_kind === 'bouldering';
  const update = (s: WorkoutSet, patch: Partial<NonNullable<WorkoutSet['climbing']>>) => {
    const climbing = {
      grade: null,
      attempts: 1,
      result: 'attempt' as const,
      style: null,
      ...s.climbing,
      ...patch,
    };
    onChange({
      ...e,
      sets: e.sets.map((x) =>
        x.id === s.id ? { ...s, climbing, completed: s.completed && !!climbing.grade } : x,
      ),
    });
  };
  return (
    <div className="stack">
      <p className="muted">
        Une ligne par {block ? 'bloc' : 'voie'} travaillé. « Enregistré » signifie suivi dans la
        séance ; le résultat indique si le passage a été réussi.
      </p>
      {e.sets.map((s, i) => (
        <div
          className="card stack"
          style={{ background: 'var(--panel2)', marginTop: 14 }}
          key={s.id}
        >
          <div className="flex between">
            <h3>
              {block ? 'Bloc' : 'Voie'} {i + 1}
            </h3>
            {edit && (
              <Button
                variant="ghost"
                aria-label={`Supprimer le passage ${i + 1}`}
                onClick={() =>
                  onChange({
                    ...e,
                    sets: e.sets
                      .filter((x) => x.id !== s.id)
                      .map((x, position) => ({ ...x, position })),
                  })
                }
              >
                <Trash2 size={15} />
              </Button>
            )}
          </div>
          <div className="field-grid">
            <Field label={block ? 'Cotation bloc (Fontainebleau)' : 'Cotation voie (française)'}>
              <select
                aria-label={`Cotation passage ${i + 1}`}
                value={s.climbing?.grade ?? ''}
                onChange={(x) => update(s, { grade: x.target.value || null })}
              >
                <option value="">Choisir une cotation</option>
                {climbingGrades.map((g) => (
                  <option key={g} value={g}>
                    {gradeLabel(g, e.load_kind)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Résultat">
              <select
                aria-label={`Résultat passage ${i + 1}`}
                value={s.climbing?.result ?? 'attempt'}
                onChange={(x) => update(s, { result: x.target.value as 'attempt' | 'sent' })}
              >
                <option value="attempt">Tenté</option>
                <option value="sent">Réussi</option>
              </select>
            </Field>
            <Field label="Nombre d’essais">
              <NumberField
                label={`Essais passage ${i + 1}`}
                min={1}
                max={100}
                step={1}
                value={s.climbing?.attempts ?? 1}
                onChange={(n) => update(s, { attempts: n ?? 1 })}
              />
            </Field>
            {!block && (
              <Field label="Pratique (facultatif)">
                <select
                  aria-label={`Pratique passage ${i + 1}`}
                  value={s.climbing?.style ?? ''}
                  onChange={(x) =>
                    update(s, { style: (x.target.value as 'lead' | 'toprope') || null })
                  }
                >
                  <option value="">Non renseignée</option>
                  <option value="lead">En tête</option>
                  <option value="toprope">En moulinette</option>
                </select>
              </Field>
            )}
          </div>
          <Field label="Voie, salle ou remarques">
            <input
              aria-label={`Notes passage ${i + 1}`}
              maxLength={1000}
              value={s.notes}
              onChange={(x) =>
                onChange({
                  ...e,
                  sets: e.sets.map((v) => (v.id === s.id ? { ...s, notes: x.target.value } : v)),
                })
              }
            />
          </Field>
          <label className="check-label">
            <input
              type="checkbox"
              checked={s.completed}
              disabled={!s.climbing?.grade}
              onChange={(x) =>
                onChange({
                  ...e,
                  sets: e.sets.map((v) =>
                    v.id === s.id ? { ...s, completed: x.target.checked } : v,
                  ),
                })
              }
            />
            Passage {i + 1} enregistré
          </label>
        </div>
      ))}
      {edit && (
        <Button
          variant="secondary"
          onClick={() =>
            onChange({ ...e, sets: [...e.sets, newSet(e.sets.length, e.target, e.load_kind)] })
          }
        >
          <Plus size={15} />
          Ajouter {block ? 'un bloc' : 'une voie'}
        </Button>
      )}
    </div>
  );
}
