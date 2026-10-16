'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  CloudCheck,
  CloudUpload,
  Save,
  CheckCheck,
  Dumbbell,
  Lightbulb,
  Pencil,
  Copy,
  Link2,
} from 'lucide-react';
import { useData, allWorkouts } from './store';
import { Button, PageTitle, Field, ErrorBox, Empty, NumberField, RestInput, api } from './ui';
import { ExercisePicker } from './exercises';
import {
  newEntry,
  newSet,
  previousExercise,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from '@/lib/domain';
import { workoutVolume, number, shortDate, recommendation, records } from '@/lib/metrics';
import { move, duplicateWorkout } from '@/lib/clone';
import { useWorkoutSave } from '@/lib/use-workout-save';
export function WorkoutPage({ id }: { id: string }) {
  const [workout, setWorkout] = useState<Workout | null>(null),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api<Workout[]>(`/api/workouts?id=${id}`)
      .then((rows) => {
        if (live) {
          if (rows[0]) setWorkout(rows[0]);
          else setError('Cette séance est inaccessible ou a été supprimée.');
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [id]);
  if (error) return <ErrorBox message={error} />;
  if (!workout) return <div className="page-loading">Chargement de la séance…</div>;
  return <WorkoutEditor key={id} initial={workout} />;
}
function WorkoutEditor({ initial }: { initial: Workout }) {
  const { data, setWorkout: remember, reload } = useData();
  const router = useRouter();
  const editor = useWorkoutSave(initial, data.user_id, remember);
  const w = editor.workout;
  const [edit, setEdit] = useState(w.status !== 'completed'),
    [picker, setPicker] = useState(false),
    [history, setHistory] = useState<Workout[] | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [ignored, setIgnored] = useState<string[]>([]),
    [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    allWorkouts()
      .then(setHistory)
      .catch((e) => setError(e.message));
  }, []);
  const updateExercise = (next: WorkoutExercise) =>
    editor.change({ ...w, exercises: w.exercises.map((e) => (e.id === next.id ? next : e)) });
  const removeExercise = (id: string) => {
    const exercises = w.exercises.filter((e) => e.id !== id).map((e, i) => ({ ...e, position: i }));
    const groups = w.groups.filter((g) => exercises.filter((e) => e.group_id === g.id).length >= 2);
    editor.change({
      ...w,
      groups,
      round_rests: w.round_rests.filter((r) => groups.some((g) => g.id === r.group_id)),
      exercises: exercises.map((e) => ({
        ...e,
        group_id: groups.some((g) => g.id === e.group_id) ? e.group_id : null,
      })),
    });
  };
  const complete = async (status: 'completed' | 'draft') => {
    if (
      status === 'completed' &&
      !confirm('Terminer cette séance et enregistrer les séries effectuées ?')
    )
      return;
    setBusy(true);
    setError(null);
    try {
      editor.change({
        ...w,
        status,
        finished_at: status === 'completed' ? (w.finished_at ?? new Date().toISOString()) : null,
      });
      await editor.save();
      await reload();
      router.push('/historique');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const total = w.exercises.flatMap((e) => e.sets).length,
    done = w.exercises.flatMap((e) => e.sets).filter((s) => s.completed).length;
  const prIds = new Set(
    records([...(history ?? []).filter((h) => h.id !== w.id), w])
      .filter((r) => r.workout_id === w.id)
      .map((r) => r.exercise_id),
  );
  return (
    <>
      <Link href="/historique" className="text-link">
        ← Mes entraînements
      </Link>
      <PageTitle
        eyebrow={`${shortDate(w.started_at).toUpperCase()} · ${w.status === 'completed' ? 'SÉANCE TERMINÉE' : w.status === 'draft' ? 'BROUILLON' : 'SÉANCE EN COURS'}`}
        title={w.name}
        description={`${w.exercises.length} exercices · ${done}/${total} séries effectuées · ${number(workoutVolume(w))} kg de volume externe`}
        actions={
          !edit ? (
            <>
              <Button variant="secondary" onClick={() => setEdit(true)}>
                <Pencil size={15} />
                Modifier
              </Button>
              <Button
                variant="secondary"
                busy={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const next = duplicateWorkout(w);
                    const r = await api<{ revision: number }>('/api/workouts', {
                      method: 'POST',
                      body: JSON.stringify(next),
                    });
                    remember({ ...next, revision: r.revision });
                    router.push(`/seances/${next.id}`);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Copy size={15} />
                Dupliquer
              </Button>
            </>
          ) : undefined
        }
      />
      {edit && (
        <div className="workout-toolbar">
          <div className="save-status">
            {editor.status === 'saved' ? (
              <CloudCheck size={16} className="green" />
            ) : (
              <CloudUpload size={16} />
            )}
            <span role="status">
              {
                {
                  saved: 'Enregistré sur le serveur',
                  dirty: 'Modifications à synchroniser…',
                  saving: 'Enregistrement…',
                  error: 'Sauvegarde échouée',
                  conflict: 'Conflit de versions',
                }[editor.status]
              }
            </span>
          </div>
          <div className="actions">
            <Button variant="secondary" busy={busy} onClick={() => complete('draft')}>
              <Save size={15} />
              Sauver en brouillon
            </Button>
            <Button busy={busy} onClick={() => complete('completed')}>
              <CheckCheck size={17} />
              {w.status === 'completed' ? 'Enregistrer les corrections' : 'Terminer la séance'}
            </Button>
          </div>
        </div>
      )}
      <div className="progress-track" aria-label={`${done} séries sur ${total}`}>
        <div style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
      <ErrorBox message={error ?? editor.error} />
      {editor.localWarning && (
        <div className="error-box">
          La copie de secours locale est indisponible sur ce navigateur. Attendez la confirmation
          serveur avant de quitter.
        </div>
      )}
      {(editor.status === 'error' || editor.status === 'conflict') && (
        <div className="actions" style={{ margin: '15px 0' }}>
          {editor.status === 'error' && (
            <Button variant="secondary" onClick={() => editor.save().catch(() => {})}>
              Réessayer la sauvegarde
            </Button>
          )}
          <Button variant="secondary" onClick={editor.reloadServer}>
            Recharger la version du serveur
          </Button>
        </div>
      )}
      {edit && (
        <div className="grid-2" style={{ marginBottom: 22 }}>
          <Field label="Nom de la séance">
            <input
              value={w.name}
              maxLength={100}
              onChange={(e) => editor.change({ ...w, name: e.target.value })}
            />
          </Field>
          <Field label="Date et heure de début (heure locale)">
            <input
              type="datetime-local"
              value={(() => {
                const d = new Date(w.started_at);
                return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
                  .toISOString()
                  .slice(0, 16);
              })()}
              onChange={(e) => {
                if (e.target.value)
                  editor.change({ ...w, started_at: new Date(e.target.value).toISOString() });
              }}
            />
          </Field>
          {w.finished_at && (
            <Field label="Date et heure de fin (heure locale)">
              <input
                type="datetime-local"
                value={(() => {
                  const d = new Date(w.finished_at!);
                  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
                    .toISOString()
                    .slice(0, 16);
                })()}
                onChange={(e) => {
                  if (e.target.value)
                    editor.change({ ...w, finished_at: new Date(e.target.value).toISOString() });
                }}
              />
            </Field>
          )}
        </div>
      )}
      {w.groups.map((g) => (
        <div className="group-band" key={g.id}>
          <Link2 size={17} />
          <strong>
            {g.name} · {g.rounds} tours
          </strong>
          <span>
            Repos cible :{' '}
            {g.rest_seconds === null
              ? 'libre'
              : `${Math.floor(g.rest_seconds / 60)} min ${g.rest_seconds % 60} s`}
          </span>
          <div className="flex" style={{ width: '100%' }}>
            {Array.from({ length: g.rounds }, (_, i) => {
              const r = w.round_rests.find((r) => r.group_id === g.id && r.round === i + 1);
              return (
                <Field key={i} label={`Repos réel / tour ${i + 1}`}>
                  <fieldset disabled={!edit} style={{ border: 0, padding: 0 }}>
                    <RestInput
                      value={r?.rest_seconds ?? null}
                      label={`Repos superset, tour ${i + 1}`}
                      onChange={(n) =>
                        editor.change({
                          ...w,
                          round_rests: [
                            ...w.round_rests.filter(
                              (r) => !(r.group_id === g.id && r.round === i + 1),
                            ),
                            { group_id: g.id, round: i + 1, rest_seconds: n },
                          ],
                        })
                      }
                    />
                  </fieldset>
                </Field>
              );
            })}
          </div>
        </div>
      ))}
      {!w.exercises.length && (
        <section className="card">
          <Empty
            icon={<Dumbbell />}
            title="À vous de jouer"
            description="Ajoutez votre premier exercice. Chaque série sera enregistrée après votre saisie."
            action={
              edit && (
                <Button onClick={() => setPicker(true)}>
                  <Plus size={16} />
                  Ajouter un exercice
                </Button>
              )
            }
          />
        </section>
      )}
      {w.exercises.map((e, ei) => {
        const last = previousExercise(
          (history ?? []).filter((h) => h.started_at < w.started_at),
          e.exercise_id,
          w.id,
        );
        const suggestion = history
          ? recommendation(
              e,
              history.filter((h) => h.started_at < w.started_at),
              data.preferences,
              w.id,
            )
          : null;
        const set = (s: WorkoutSet) =>
          updateExercise({ ...e, sets: e.sets.map((x) => (x.id === s.id ? s : x)) });
        return (
          <section key={e.id} className="card workout-card">
            <div className="workout-header">
              <div>
                <div className="flex">
                  {edit && (
                    <input
                      type="checkbox"
                      aria-label={`Sélectionner ${e.name} pour un superset`}
                      checked={selected.includes(e.id)}
                      onChange={(x) =>
                        setSelected(
                          x.target.checked
                            ? [...selected, e.id]
                            : selected.filter((i) => i !== e.id),
                        )
                      }
                    />
                  )}
                  <h2>
                    <Link href={`/exercices/${e.exercise_id}`}>{e.name} ↗</Link>
                  </h2>
                  {e.group_id && (
                    <span className="badge badge-green">
                      {w.groups.find((g) => g.id === e.group_id)?.name}
                    </span>
                  )}
                  {w.status === 'completed' && prIds.has(e.exercise_id) && (
                    <span className="badge badge-orange">RECORD DE CHARGE</span>
                  )}
                </div>
                <p>
                  {e.target.sets} × {e.target.reps_min}–{e.target.reps_max} répétitions ·{' '}
                  {e.primary_muscle} ·{' '}
                  {e.load_kind === 'assisted'
                    ? 'Assistance en kg'
                    : e.load_kind === 'bodyweight'
                      ? 'Poids du corps'
                      : 'Charge externe en kg'}
                  {e.target.rest_seconds !== null
                    ? ` · repos cible ${Math.floor(e.target.rest_seconds / 60)}:${String(e.target.rest_seconds % 60).padStart(2, '0')}`
                    : ''}
                </p>
                {e.notes && <p>{e.notes}</p>}
              </div>
              {edit && (
                <div className="tools">
                  <Button
                    variant="ghost"
                    disabled={ei === 0}
                    aria-label="Monter l’exercice"
                    onClick={() =>
                      editor.change({
                        ...w,
                        exercises: move(w.exercises, ei, -1).map((x, i) => ({ ...x, position: i })),
                      })
                    }
                  >
                    <ArrowUp size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={ei === w.exercises.length - 1}
                    aria-label="Descendre l’exercice"
                    onClick={() =>
                      editor.change({
                        ...w,
                        exercises: move(w.exercises, ei, 1).map((x, i) => ({ ...x, position: i })),
                      })
                    }
                  >
                    <ArrowDown size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label="Supprimer l’exercice"
                    onClick={() => {
                      if (confirm(`Retirer ${e.name} et ses séries de cette séance ?`))
                        removeExercise(e.id);
                    }}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              )}
            </div>
            {edit && suggestion && suggestion.kind !== 'disabled' && !ignored.includes(e.id) && (
              <div className="suggestion">
                <Lightbulb size={17} />
                <div>
                  <strong>{suggestion.title}</strong>
                  <p>{suggestion.reason}</p>
                </div>
                <div className="actions">
                  {suggestion.weight !== undefined && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (
                          e.sets.some((s) => s.completed) &&
                          !confirm(
                            'Appliquer la suggestion aux séries restantes ? Les séries déjà réalisées seront conservées.',
                          )
                        )
                          return;
                        updateExercise({
                          ...e,
                          sets: e.sets.map((s) =>
                            s.completed || s.type !== 'normal'
                              ? s
                              : { ...s, weight: suggestion.weight! },
                          ),
                        });
                        setIgnored([...ignored, e.id]);
                      }}
                    >
                      Appliquer aux séries restantes
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => setIgnored([...ignored, e.id])}>
                    Ignorer
                  </Button>
                </div>
              </div>
            )}
            <fieldset disabled={!edit || busy} style={{ border: 0, padding: 0, minWidth: 0 }}>
              <div className="set-scroll">
                <table className="sets-table">
                  <thead>
                    <tr>
                      <th>SÉRIE</th>
                      <th>PRÉCÉDENT</th>
                      <th>TYPE</th>
                      <th>KG</th>
                      <th>RÉP.</th>
                      <th>RPE</th>
                      <th>RIR</th>
                      <th>{e.group_id ? 'REPOS / SÉRIE*' : 'REPOS RÉALISÉ'}</th>
                      <th>FAIT</th>
                      {edit && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {e.sets.map((s, si) => {
                      const prev = last?.sets.filter((p) => p.type === s.type && p.completed)[
                        e.sets.slice(0, si).filter((x) => x.type === s.type).length
                      ];
                      return (
                        <tr key={s.id} className={s.completed ? 'completed' : ''}>
                          <td>
                            <strong>{si + 1}</strong>
                          </td>
                          <td className="previous">
                            {prev
                              ? `${prev.weight ?? 'PDC'}${prev.weight !== null ? ' kg' : ''} × ${prev.reps}`
                              : '—'}
                            {prev?.rest_seconds !== null && prev?.rest_seconds !== undefined && (
                              <small>
                                repos {Math.floor(prev.rest_seconds / 60)}:
                                {String(prev.rest_seconds % 60).padStart(2, '0')}
                              </small>
                            )}
                          </td>
                          <td>
                            <select
                              aria-label={`Type série ${si + 1}`}
                              value={s.type}
                              onChange={(x) =>
                                set({ ...s, type: x.target.value as WorkoutSet['type'] })
                              }
                            >
                              <option value="normal">Travail</option>
                              <option value="warmup">Échauff.</option>
                              <option value="drop">Dégressive</option>
                            </select>
                          </td>
                          <td className="weight">
                            <NumberField
                              label={`Charge série ${si + 1}`}
                              value={s.weight}
                              onChange={(n) => set({ ...s, weight: n })}
                              nullable
                            />
                          </td>
                          <td className="reps">
                            <NumberField
                              label={`Répétitions série ${si + 1}`}
                              value={s.reps}
                              max={500}
                              step={1}
                              onChange={(n) => set({ ...s, reps: n ?? 0 })}
                            />
                          </td>
                          <td className="effort">
                            <NumberField
                              label={`RPE série ${si + 1}`}
                              value={s.rpe}
                              min={1}
                              max={10}
                              onChange={(n) => set({ ...s, rpe: n })}
                              nullable
                            />
                          </td>
                          <td className="effort">
                            <NumberField
                              label={`RIR série ${si + 1}`}
                              value={s.rir}
                              min={0}
                              max={10}
                              onChange={(n) => set({ ...s, rir: n })}
                              nullable
                            />
                          </td>
                          <td>
                            <RestInput
                              value={s.rest_seconds}
                              label={`Repos série ${si + 1}`}
                              onChange={(n) => set({ ...s, rest_seconds: n })}
                            />
                          </td>
                          <td>
                            <button
                              className={`set-done ${s.completed ? 'done' : ''}`}
                              aria-label={`Série ${si + 1} ${s.completed ? 'effectuée' : 'à effectuer'}`}
                              aria-pressed={s.completed}
                              onClick={() => set({ ...s, completed: !s.completed })}
                            >
                              <Check size={18} />
                            </button>
                          </td>
                          {edit && (
                            <td>
                              <Button
                                variant="ghost"
                                aria-label={`Supprimer la série ${si + 1}`}
                                onClick={() =>
                                  updateExercise({
                                    ...e,
                                    sets: e.sets
                                      .filter((x) => x.id !== s.id)
                                      .map((x, i) => ({ ...x, position: i })),
                                  })
                                }
                              >
                                <Trash2 size={13} />
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="set-footer">
                {edit && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      updateExercise({ ...e, sets: [...e.sets, newSet(e.sets.length, e.target)] })
                    }
                  >
                    <Plus size={14} />
                    Ajouter une série
                  </Button>
                )}
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={e.technique_ok}
                    onChange={(x) => updateExercise({ ...e, technique_ok: x.target.checked })}
                  />
                  Technique et effort acceptables sur cet exercice
                </label>
              </div>
              <details className="notes-details">
                <summary>Notes par série</summary>
                {e.sets.map((s, i) => (
                  <Field key={s.id} label={`Série ${i + 1}`}>
                    <input
                      value={s.notes}
                      maxLength={1000}
                      onChange={(x) => set({ ...s, notes: x.target.value })}
                      placeholder="Votre ressenti, un réglage…"
                    />
                  </Field>
                ))}
              </details>
            </fieldset>
          </section>
        );
      })}
      {edit && (
        <div className="actions">
          <Button variant="secondary" onClick={() => setPicker(true)}>
            <Plus size={16} />
            Ajouter un exercice
          </Button>
          <Button
            variant="secondary"
            disabled={selected.length < 2}
            onClick={() => {
              const id = crypto.randomUUID();
              const groups = [
                ...w.groups,
                {
                  id,
                  name: `Superset ${String.fromCharCode(65 + w.groups.length)}`,
                  rounds: 3,
                  rest_seconds: 90,
                },
              ];
              const exercises = w.exercises.map((e) =>
                selected.includes(e.id) ? { ...e, group_id: id } : e,
              );
              const valid = groups.filter(
                (g) => exercises.filter((e) => e.group_id === g.id).length >= 2,
              );
              editor.change({
                ...w,
                groups: valid,
                exercises: exercises.map((e) => ({
                  ...e,
                  group_id: valid.some((g) => g.id === e.group_id) ? e.group_id : null,
                })),
                round_rests: w.round_rests.filter((r) => valid.some((g) => g.id === r.group_id)),
              });
              setSelected([]);
            }}
          >
            <Link2 size={16} />
            Créer un superset
          </Button>
        </div>
      )}
      <section className="card stack" style={{ marginTop: 22 }}>
        <Field label="Notes de séance">
          <textarea
            value={w.notes}
            disabled={!edit}
            maxLength={5000}
            onChange={(e) => editor.change({ ...w, notes: e.target.value })}
            placeholder="Comment s’est passée votre séance ?"
          />
        </Field>
        <p className="muted" style={{ fontSize: 11 }}>
          RPE : effort perçu de 1 à 10 (10 = effort maximal). RIR : répétitions estimées encore
          possibles. Les deux champs sont facultatifs et indépendants. Le repos est saisi
          manuellement, sans chronomètre. * En superset, utilisez le repos par tour en haut de page
          ; un repos par série reste distinct.
        </p>
      </section>
      {picker && (
        <ExercisePicker
          onClose={() => setPicker(false)}
          onSelect={(exercise) => {
            const e = newEntry(
              exercise,
              w.exercises.length,
              data.progression.find((s) => s.exercise_id === exercise.id),
            );
            const last = previousExercise(history ?? [], exercise.id, w.id);
            editor.change({
              ...w,
              exercises: [
                ...w.exercises,
                {
                  ...e,
                  technique_ok: false,
                  sets: Array.from({ length: e.target.sets }, (_, i) => ({
                    ...newSet(i, e.target),
                    weight:
                      last?.sets.filter((s) => s.type === 'normal' && s.completed)[i]?.weight ??
                      null,
                  })),
                },
              ],
            });
            setPicker(false);
          }}
        />
      )}
    </>
  );
}
