'use client';
import { RepGoalFields } from './rep-goal-fields';
import {
  resolveRepGoal,
  latestGoal,
  indicativeRange,
  movementKnowledge,
  goalLabels,
} from '@/lib/training-knowledge';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Search, ArrowUpRight, BookOpen } from 'lucide-react';
import { useData, allWorkouts } from './store';
import { Button, PageTitle, Modal, Field, NumberField, ErrorBox, Empty, api } from './ui';
import { Anatomy } from './anatomy';
import {
  muscles,
  equipment,
  newEntry,
  type Exercise,
  type Workout,
  type WorkoutExercise,
} from '@/lib/domain';
import { records, recommendation, number } from '@/lib/metrics';
import { ProgressionDetails } from './progression-details';
export function ExercisePicker({
  onSelect,
  onClose,
}: {
  onSelect: (e: Exercise) => void;
  onClose: () => void;
}) {
  const { data } = useData();
  const [q, setQ] = useState(''),
    [muscle, setMuscle] = useState(''),
    [collection, setCollection] = useState(''),
    [limit, setLimit] = useState(60);
  const results = data.exercises.filter(
    (e) =>
      `${e.name} ${e.english_name ?? ''} ${e.category}`
        .toLocaleLowerCase('fr')
        .includes(q.toLocaleLowerCase('fr')) &&
      (!collection ||
        (collection === 'technogym'
          ? e.category.startsWith('Technogym ·')
          : e.load_kind === 'cardio')) &&
      (!muscle || e.primary_muscle === muscle),
  );
  return (
    <Modal title="Ajouter un exercice" onClose={onClose}>
      <div className="search-bar">
        <select
          aria-label="Collection"
          value={collection}
          onChange={(e) => setCollection(e.target.value)}
        >
          <option value="">Toutes les collections</option>
          <option value="technogym">Technogym</option>
          <option value="cardio">Cardio</option>
        </select>
        <input
          aria-label="Rechercher un exercice"
          placeholder="Rechercher un mouvement…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="Groupe musculaire"
          value={muscle}
          onChange={(e) => setMuscle(e.target.value)}
        >
          <option value="">Tous les muscles</option>
          {muscles.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </div>
      <div className="picker-list">
        {results.slice(0, limit).map((e) => (
          <button key={e.id} onClick={() => onSelect(e)}>
            <span>
              {e.name}
              <br />
              <small>
                {e.primary_muscle} · {e.equipment}
              </small>
            </span>
            <Plus size={17} />
          </button>
        ))}
        {!results.length && (
          <Empty
            title="Aucun exercice trouvé"
            description="Essayez un autre nom ou groupe musculaire."
          />
        )}
        {results.length > limit && (
          <Button variant="secondary" onClick={() => setLimit((n) => n + 60)}>
            Afficher plus d’exercices ({results.length - limit} restants)
          </Button>
        )}
      </div>
    </Modal>
  );
}
export function ExerciseLibrary() {
  const { data, reload } = useData();
  const [q, setQ] = useState(''),
    [muscle, setMuscle] = useState(''),
    [eq, setEq] = useState(''),
    [category, setCategory] = useState(''),
    [collection, setCollection] = useState(''),
    [create, setCreate] = useState(false);
  const [limit, setLimit] = useState(48);
  const results = data.exercises
    .filter(
      (e) =>
        `${e.name} ${e.english_name ?? ''}`
          .toLocaleLowerCase('fr')
          .includes(q.toLocaleLowerCase('fr')) &&
        (!muscle || e.primary_muscle === muscle) &&
        (!eq || e.equipment === eq) &&
        (!category || e.category === category),
    )
    .filter(
      (e) =>
        !collection ||
        (collection === 'technogym'
          ? e.category.startsWith('Technogym ·')
          : e.load_kind === 'cardio'),
    );
  return (
    <>
      <PageTitle
        eyebrow="LES BONS MOUVEMENTS, LES BONS REPÈRES"
        title="Bibliothèque d’exercices"
        description={`${data.exercises.length} exercices pour construire vos séances.`}
        actions={
          <Button onClick={() => setCreate(true)}>
            <Plus size={16} />
            Créer un exercice
          </Button>
        }
      />
      <div className="search-bar">
        <select
          aria-label="Collection"
          value={collection}
          onChange={(e) => {
            setCollection(e.target.value);
            setCategory('');
          }}
        >
          <option value="">Toutes les collections</option>
          <option value="technogym">Technogym</option>
          <option value="cardio">Cardio</option>
        </select>
        <div className="search-input">
          <Search size={18} />
          <input
            aria-label="Rechercher"
            placeholder="Rechercher un exercice…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select aria-label="Muscle" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
          <option value="">Tous les muscles</option>
          {muscles.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <select aria-label="Équipement" value={eq} onChange={(e) => setEq(e.target.value)}>
          <option value="">Tous les équipements</option>
          {equipment.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <select
          aria-label="Catégorie"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Toutes les catégories</option>
          {[...new Set(data.exercises.map((e) => e.category))].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </div>
      <div className="exercise-grid">
        {results.slice(0, limit).map((e) => (
          <Link key={e.id} href={`/exercices/${e.id}`} className="card exercise-card">
            <div className="exercise-card-visual">
              <span className="badge">{e.equipment}</span>
              <Anatomy primary={e.primary_muscle} secondary={e.secondary_muscles} compact />
            </div>
            <div className="exercise-card-content">
              <span className="badge badge-orange">{e.primary_muscle}</span>
              <h3>{e.name}</h3>
              <div className="flex between">
                <p>{e.user_id ? 'Personnel' : e.category}</p>
                <ArrowUpRight size={15} className="muted" />
              </div>
            </div>
          </Link>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
        {Math.min(limit, results.length)} / {results.length} exercices affichés
      </p>
      {results.length > limit && (
        <Button
          variant="secondary"
          style={{ marginTop: 16 }}
          onClick={() => setLimit((n) => n + 48)}
        >
          Afficher plus d’exercices
        </Button>
      )}
      {!results.length && (
        <Empty
          icon={<BookOpen />}
          title="Aucun résultat"
          description="Essayez d’élargir vos filtres ou créez votre exercice."
        />
      )}
      {create && (
        <CustomExercise
          onClose={() => setCreate(false)}
          onCreated={async () => {
            await reload();
            setCreate(false);
          }}
        />
      )}
    </>
  );
}
function CustomExercise({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Votre propre exercice" onClose={onClose}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          try {
            await api('/api/exercises', {
              method: 'POST',
              body: JSON.stringify({
                name: f.get('name'),
                primary_muscle: f.get('muscle'),
                equipment: f.get('equipment'),
                load_kind: f.get('kind'),
                description: f.get('description'),
                instructions: String(f.get('instructions')).split('\n').filter(Boolean),
              }),
            });
            await onCreated();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Nom">
          <input name="name" required maxLength={120} />
        </Field>
        <div className="grid-2">
          <Field label="Muscle principal">
            <select name="muscle">
              {muscles.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Équipement">
            <select name="equipment">
              {equipment.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field
          label="Convention de charge"
          hint="Choisissez une convention et gardez-la identique d’une séance à l’autre."
        >
          <select name="kind">
            <option value="external">Charge externe (kg)</option>
            <option value="bodyweight">Poids du corps</option>
            <option value="assisted">Assistance (kg)</option>
            <option value="cardio">Cardio (durée et distance)</option>
          </select>
        </Field>
        <Field label="Description">
          <textarea name="description" maxLength={2000} />
        </Field>
        <Field label="Instructions (une étape par ligne)">
          <textarea name="instructions" maxLength={3000} />
        </Field>
        <ErrorBox message={error} />
        <Button busy={busy}>Créer mon exercice privé</Button>
      </form>
    </Modal>
  );
}
export function ExerciseDetail({ id }: { id: string }) {
  const { data, reload } = useData();
  const exercise = data.exercises.find((e) => e.id === id);
  const [workouts, setWorkouts] = useState<Workout[] | null>(null),
    [error, setError] = useState<string | null>(null),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false);
  const setting = data.progression.find((s) => s.exercise_id === id);
  const [increment, setIncrement] = useState(
      setting?.increment ?? (exercise ? newEntry(exercise, 0).increment : 2.5),
    ),
    [customMin, setMin] = useState<number | null>(setting?.reps_min ?? null),
    [customMax, setMax] = useState<number | null>(setting?.reps_max ?? null),
    [weights, setWeights] = useState(setting?.available_weights?.join(', ') ?? '');
  useEffect(() => {
    allWorkouts(undefined, id)
      .then(setWorkouts)
      .catch((e) => setError(e.message));
  }, [id, data.workouts]);
  if (!exercise)
    return (
      <Empty
        title="Exercice introuvable"
        description="Cet exercice est inaccessible ou n’existe plus."
      />
    );
  const resolved = resolveRepGoal({
    exercise,
    setting,
    previous: latestGoal(workouts ?? [], id),
    preferences: data.preferences,
  });
  const min = customMin ?? resolved.reps_min,
    max = customMax ?? resolved.reps_max;
  const available_weights = weights.trim()
    ? weights
        .trim()
        .split(/[\s,;]+/)
        .map(Number)
    : [];
  const entry: WorkoutExercise = {
    ...newEntry(exercise, 0),
    target: { ...newEntry(exercise, 0).target, reps_min: min, reps_max: max },
    increment,
    technique_ok: false,
    sets: [],
  };
  const rec = workouts
    ? recommendation(entry, workouts, data.preferences, undefined, undefined, {
        exercise_id: id,
        increment,
        reps_min: min,
        reps_max: max,
        available_weights,
      })
    : null;
  const pr = records(workouts ?? [])[0];
  return (
    <>
      <Link className="text-link" href="/exercices">
        ← Bibliothèque
      </Link>
      <PageTitle
        eyebrow={`${exercise.equipment.toUpperCase()} · ${exercise.category.toUpperCase()}`}
        title={exercise.name}
        description={exercise.description}
      />
      <div className="exercise-details">
        <div className="stack">
          <section className="card">
            <Anatomy primary={exercise.primary_muscle} secondary={exercise.secondary_muscles} />
          </section>
          {pr && (
            <section className="card">
              <div className="eyebrow">VOS RECORDS PERSONNELS</div>
              <h2>
                {number(pr.max_weight, 2)} kg <small className="muted">· charge maximale</small>
              </h2>
              <p className="muted" style={{ marginTop: 10 }}>
                1RM estimé : {pr.e1rm ? `${number(pr.e1rm, 1)} kg` : 'Non applicable'}
              </p>
              <p className="muted">Volume maximal : {number(pr.volume)} kg</p>
              <Link className="text-link" href="/statistiques">
                Voir la progression
                <ArrowUpRight size={14} />
              </Link>
            </section>
          )}
        </div>
        <div className="stack">
          <section className="card">
            <h2>Bien exécuter le mouvement</h2>
            <p className="muted">{movementKnowledge(exercise).cue}</p>
            <ol>
              {exercise.instructions.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            {exercise.tips && (
              <>
                <h3>Les repères à garder</h3>
                <p className="muted">{exercise.tips}</p>
              </>
            )}
            {exercise.mistakes && (
              <>
                <h3>Les erreurs à éviter</h3>
                <p className="muted">{exercise.mistakes}</p>
              </>
            )}
            {exercise.load_kind !== 'external' && (
              <div className="setup-notice" style={{ marginTop: 18 }}>
                {exercise.load_kind === 'cardio'
                  ? 'La durée et la distance sont suivies séparément du volume de musculation et des records de charge.'
                  : 'Les répétitions sont suivies séparément. Le poids du corps et l’assistance sont exclus du volume externe et du 1RM estimé.'}
              </div>
            )}
          </section>
          {exercise.load_kind !== 'cardio' && (
            <section className="card stack">
              <div>
                <div className="eyebrow">VOTRE PROCHAIN PAS</div>
                <h2>{rec?.title ?? 'Chargement de l’historique…'}</h2>
                <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                  {rec?.reason}
                </p>
                {rec && <ProgressionDetails suggestion={rec} loadKind={exercise.load_kind} />}
              </div>
              <div className="field-grid">
                <Field label="Incrément (kg)">
                  <NumberField
                    label="Incrément"
                    min={0.1}
                    max={100}
                    value={increment}
                    onChange={(n) => setIncrement(n ?? 2.5)}
                  />
                </Field>
                <RepGoalFields
                  min={min}
                  max={max}
                  onChange={(a, b) => {
                    setMin(a);
                    setMax(b);
                  }}
                />
              </div>
              <Field
                label="Charges disponibles (kg)"
                hint="Facultatif. Séparez par des virgules : 6, 7, 8, 9. Décimales avec un point. Poids par haltère si votre saisie est par haltère."
              >
                <input
                  value={weights}
                  maxLength={1500}
                  onChange={(e) => setWeights(e.target.value)}
                />
              </Field>
              <p className="muted">
                {resolved.source}. Repère facultatif{' '}
                {data.preferences.coaching?.goal
                  ? goalLabels[data.preferences.coaching.goal]
                  : 'hypertrophie (objectif non renseigné)'}{' '}
                : {indicativeRange(exercise, data.preferences.coaching?.goal).join('–')}{' '}
                répétitions.
              </p>
              <Button
                variant="ghost"
                onClick={() => {
                  const [a, b] = indicativeRange(exercise, data.preferences.coaching?.goal);
                  setMin(a);
                  setMax(b);
                }}
              >
                Utiliser ce repère
              </Button>
              <p className="muted" style={{ fontSize: 11 }}>
                Après enregistrement, votre objectif personnel prime sur le programme au démarrage
                d’une nouvelle séance. Une cible modifiée dans la séance reste prioritaire. Les
                séances existantes ne sont pas réécrites.
              </p>
              <ErrorBox message={error} />
              {saved && (
                <p className="green" role="status">
                  Réglages enregistrés.
                </p>
              )}
              <Button
                variant="secondary"
                busy={busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await api('/api/preferences', {
                      method: 'PATCH',
                      body: JSON.stringify({
                        exercise_id: id,
                        increment,
                        reps_min: min,
                        reps_max: max,
                        available_weights,
                      }),
                    });
                    await reload();
                    setSaved(true);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Enregistrer les réglages
              </Button>
            </section>
          )}
          <section className="card">
            <h2>Autres mouvements du même groupe</h2>
            <div className="flex" style={{ marginTop: 15 }}>
              {data.exercises
                .filter((e) => e.primary_muscle === exercise.primary_muscle && e.id !== id)
                .slice(0, 4)
                .map((e) => (
                  <Link className="badge" href={`/exercices/${e.id}`} key={e.id}>
                    {e.name} ↗
                  </Link>
                ))}
            </div>
            <p className="muted" style={{ fontSize: 10, marginTop: 13 }}>
              Chaque mouvement et chaque machine ont leur propre historique.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
