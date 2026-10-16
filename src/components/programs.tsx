'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Dumbbell,
  Play,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Link2,
  Pencil,
} from 'lucide-react';
import { Button, PageTitle, Empty, ErrorBox, Field, NumberField, RestInput, api } from './ui';
import { ExercisePicker } from './exercises';
import { useData } from './store';
import { useStartWorkout } from './dashboard';
import {
  programSchema,
  newEntry,
  type Program,
  type ProgramDay,
  type ProgramExercise,
} from '@/lib/domain';
import { duplicateProgram, move } from '@/lib/clone';
export function Programs() {
  const { data, reload } = useData();
  const launch = useStartWorkout();
  const [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState<string | null>(null);
  return (
    <>
      <PageTitle
        eyebrow="UN PLAN POUR ALLER PLUS LOIN"
        title="Mes programmes"
        description="Construisez votre routine. Adaptez-la à votre progression."
        actions={
          <Link href="/programmes/nouveau" className="btn btn-primary">
            <Plus size={17} />
            Nouveau programme
          </Link>
        }
      />
      <ErrorBox message={error ?? launch.error} />
      {!data.programs.length ? (
        <section className="card">
          <Empty
            icon={<Dumbbell />}
            title="Votre progression mérite un plan"
            description="Créez vos séances, ajoutez vos exercices et définissez vos objectifs. Votre historique restera indépendant de chaque modification."
            action={
              <Link className="btn btn-primary" href="/programmes/nouveau">
                <Plus size={16} />
                Créer mon premier programme
              </Link>
            }
          />
        </section>
      ) : (
        <div className="grid-3">
          {data.programs.map((p) => (
            <section key={p.id} className="card program-card">
              <div className="flex between">
                <span className="program-icon">
                  <Dumbbell size={22} />
                </span>
                {p.active && <span className="badge badge-orange">PROGRAMME ACTIF</span>}
              </div>
              <div>
                <h2>{p.name}</h2>
                <p className="muted" style={{ fontSize: 12, marginTop: 7 }}>
                  {p.description || `${p.days.length} séances personnalisées`}
                </p>
              </div>
              <div className="program-days">
                {p.days.map((d) => (
                  <div className="program-day" key={d.id}>
                    <div>
                      <strong>{d.name}</strong>
                      <small>
                        {d.exercises.length} exercices ·{' '}
                        {d.exercises.reduce((n, e) => n + e.target.sets, 0)} séries
                      </small>
                    </div>
                    <Button
                      variant="ghost"
                      busy={launch.busy}
                      onClick={() => launch.start(d)}
                      aria-label={`Démarrer ${d.name}`}
                    >
                      <Play size={16} />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="program-card-footer">
                <Link className="text-link" href={`/programmes/${p.id}`}>
                  <Pencil size={13} />
                  Modifier
                </Link>
                <div className="flex gap-sm">
                  <Button
                    variant="ghost"
                    busy={busy === `copy-${p.id}`}
                    aria-label={`Dupliquer ${p.name}`}
                    onClick={async () => {
                      setBusy(`copy-${p.id}`);
                      try {
                        await api('/api/programs', {
                          method: 'POST',
                          body: JSON.stringify(duplicateProgram(p)),
                        });
                        await reload();
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    <Copy size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={`Supprimer ${p.name}`}
                    busy={busy === p.id}
                    onClick={async () => {
                      if (
                        !confirm(
                          `Supprimer « ${p.name} » ? Les séances historiques seront conservées.`,
                        )
                      )
                        return;
                      setBusy(p.id);
                      try {
                        await api('/api/programs', {
                          method: 'DELETE',
                          body: JSON.stringify({ id: p.id, revision: p.revision }),
                        });
                        await reload();
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
const day = (position: number): ProgramDay => ({
  id: crypto.randomUUID(),
  name: `Séance ${position + 1}`,
  position,
  groups: [],
  exercises: [],
});
export function ProgramEditor({ id }: { id?: string }) {
  const { data, reload } = useData();
  const router = useRouter();
  const initial = id ? data.programs.find((p) => p.id === id) : undefined;
  const [p, setP] = useState<Program>(
    () =>
      initial ?? {
        id: crypto.randomUUID(),
        revision: 0,
        name: '',
        description: '',
        active: data.programs.length === 0,
        days: [day(0)],
      },
  );
  const [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [picker, setPicker] = useState<string | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [dirty, setDirty] = useState(false);
  const update = (next: Program) => {
    setP(next);
    setDirty(true);
  };
  const updateDay = (d: ProgramDay) =>
    update({ ...p, days: p.days.map((x) => (x.id === d.id ? d : x)) });
  if (id && !initial)
    return (
      <Empty
        title="Programme introuvable"
        description="Ce programme est inaccessible ou a été supprimé."
      />
    );
  const cleanGroups = (d: ProgramDay): ProgramDay => {
    const groups = d.groups.filter(
      (g) => d.exercises.filter((e) => e.group_id === g.id).length >= 2,
    );
    return {
      ...d,
      groups,
      exercises: d.exercises.map((e) => ({
        ...e,
        group_id: groups.some((g) => g.id === e.group_id) ? e.group_id : null,
      })),
    };
  };
  return (
    <>
      <Link className="text-link" href="/programmes">
        ← Mes programmes
      </Link>
      <PageTitle
        eyebrow="VOTRE ROUTINE, VOS OBJECTIFS"
        title={id ? 'Modifier le programme' : 'Créer un programme'}
        description="Les objectifs prévus sont indépendants de vos performances enregistrées."
        actions={
          <Button
            busy={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const payload = programSchema.parse(p);
                await api('/api/programs', { method: 'POST', body: JSON.stringify(payload) });
                setDirty(false);
                await reload();
                router.push('/programmes');
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Save size={16} />
            Enregistrer le programme
          </Button>
        }
      />
      <ErrorBox message={error} />
      <section className="card stack">
        <div className="grid-2">
          <Field label="Nom du programme">
            <input
              value={p.name}
              placeholder="Ex. Upper / Lower"
              maxLength={100}
              onChange={(e) => update({ ...p, name: e.target.value })}
            />
          </Field>
          <Field label="Description (facultatif)">
            <input
              value={p.description}
              placeholder="Votre rythme, vos objectifs…"
              maxLength={2000}
              onChange={(e) => update({ ...p, description: e.target.value })}
            />
          </Field>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={p.active}
            onChange={(e) => update({ ...p, active: e.target.checked })}
          />
          Afficher ce programme en priorité sur mon tableau de bord
        </label>
        <p className="muted" style={{ fontSize: 11 }}>
          {dirty
            ? 'Modifications à enregistrer.'
            : 'Les modifications de ce programme n’altèrent jamais les anciennes séances.'}
        </p>
      </section>
      {p.days.map((d, di) => (
        <section className="card editor-day" key={d.id}>
          <div className="editor-day-header">
            <span className="badge">{String(di + 1).padStart(2, '0')}</span>
            <input
              aria-label={`Nom de la séance ${di + 1}`}
              value={d.name}
              maxLength={100}
              onChange={(e) => updateDay({ ...d, name: e.target.value })}
            />
            <div className="flex gap-sm">
              <Button
                variant="ghost"
                aria-label="Monter la séance"
                disabled={di === 0}
                onClick={() =>
                  update({
                    ...p,
                    days: move(p.days, di, -1).map((x, i) => ({ ...x, position: i })),
                  })
                }
              >
                <ArrowUp size={16} />
              </Button>
              <Button
                variant="ghost"
                aria-label="Descendre la séance"
                disabled={di === p.days.length - 1}
                onClick={() =>
                  update({ ...p, days: move(p.days, di, 1).map((x, i) => ({ ...x, position: i })) })
                }
              >
                <ArrowDown size={16} />
              </Button>
              <Button
                variant="ghost"
                aria-label="Supprimer la journée"
                disabled={p.days.length === 1}
                onClick={() => {
                  if (confirm(`Supprimer la séance type « ${d.name} » ?`))
                    update({
                      ...p,
                      days: p.days
                        .filter((x) => x.id !== d.id)
                        .map((x, i) => ({ ...x, position: i })),
                    });
                }}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
          {d.groups.map((g) => (
            <div className="group-band" key={g.id}>
              <Link2 size={16} />
              <strong>{g.name}</strong>
              <div className="field">
                Tours
                <NumberField
                  label="Tours du superset"
                  min={1}
                  max={30}
                  step={1}
                  value={g.rounds}
                  onChange={(n) =>
                    updateDay({
                      ...d,
                      groups: d.groups.map((x) => (x.id === g.id ? { ...x, rounds: n ?? 1 } : x)),
                    })
                  }
                />
              </div>
              <div className="field">
                Repos cible / tour
                <RestInput
                  value={g.rest_seconds}
                  label="Repos cible du superset"
                  onChange={(n) =>
                    updateDay({
                      ...d,
                      groups: d.groups.map((x) => (x.id === g.id ? { ...x, rest_seconds: n } : x)),
                    })
                  }
                />
              </div>
              <Button
                variant="ghost"
                onClick={() =>
                  updateDay({
                    ...d,
                    groups: d.groups.filter((x) => x.id !== g.id),
                    exercises: d.exercises.map((e) =>
                      e.group_id === g.id ? { ...e, group_id: null } : e,
                    ),
                  })
                }
              >
                Dissocier
              </Button>
            </div>
          ))}
          {!d.exercises.length && (
            <Empty
              icon={<Dumbbell />}
              title="Les bases d’une bonne séance"
              description="Ajoutez vos mouvements, puis réglez les séries, répétitions et temps de repos."
            />
          )}
          {d.exercises.map((e, ei) => (
            <div key={e.id} className="editor-exercise">
              <div className="editor-exercise-header">
                <input
                  type="checkbox"
                  aria-label={`Sélectionner ${e.name} pour un superset`}
                  checked={selected.includes(e.id)}
                  onChange={(x) =>
                    setSelected(
                      x.target.checked ? [...selected, e.id] : selected.filter((id) => id !== e.id),
                    )
                  }
                />
                <Link href={`/exercices/${e.exercise_id}`}>{e.name}</Link>
                {e.group_id && (
                  <span className="badge badge-green">
                    {d.groups.find((g) => g.id === e.group_id)?.name}
                  </span>
                )}
                <div className="tools">
                  <Button
                    variant="ghost"
                    disabled={ei === 0}
                    aria-label="Monter l’exercice"
                    onClick={() =>
                      updateDay({
                        ...d,
                        exercises: move(d.exercises, ei, -1).map((x, i) => ({ ...x, position: i })),
                      })
                    }
                  >
                    <ArrowUp size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={ei === d.exercises.length - 1}
                    aria-label="Descendre l’exercice"
                    onClick={() =>
                      updateDay({
                        ...d,
                        exercises: move(d.exercises, ei, 1).map((x, i) => ({ ...x, position: i })),
                      })
                    }
                  >
                    <ArrowDown size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label="Retirer l’exercice"
                    onClick={() =>
                      updateDay(
                        cleanGroups({
                          ...d,
                          exercises: d.exercises
                            .filter((x) => x.id !== e.id)
                            .map((x, i) => ({ ...x, position: i })),
                        }),
                      )
                    }
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
              <Targets
                entry={e}
                onChange={(next) =>
                  updateDay({ ...d, exercises: d.exercises.map((x) => (x.id === e.id ? next : x)) })
                }
              />
            </div>
          ))}
          <div className="actions" style={{ marginTop: 18 }}>
            <Button variant="secondary" onClick={() => setPicker(d.id)}>
              <Plus size={16} />
              Ajouter un exercice
            </Button>
            <Button
              variant="ghost"
              disabled={d.exercises.filter((e) => selected.includes(e.id)).length < 2}
              onClick={() => {
                const ids = d.exercises.filter((e) => selected.includes(e.id)).map((e) => e.id);
                const id = crypto.randomUUID();
                updateDay(
                  cleanGroups({
                    ...d,
                    groups: [
                      ...d.groups,
                      {
                        id,
                        name: `Superset ${String.fromCharCode(65 + d.groups.length)}`,
                        rounds: 3,
                        rest_seconds: 90,
                      },
                    ],
                    exercises: d.exercises.map((e) =>
                      ids.includes(e.id) ? { ...e, group_id: id } : e,
                    ),
                  }),
                );
                setSelected([]);
              }}
            >
              <Link2 size={16} />
              Regrouper en superset
            </Button>
          </div>
          <p className="muted" style={{ fontSize: 10, marginTop: 12 }}>
            Cochez au moins deux exercices pour créer un superset. Chaque exercice conserve ses
            propres séries.
          </p>
        </section>
      ))}
      <Button
        style={{ marginTop: 22 }}
        variant="secondary"
        onClick={() => update({ ...p, days: [...p.days, day(p.days.length)] })}
      >
        <Plus size={16} />
        Ajouter une séance
      </Button>
      {picker && (
        <ExercisePicker
          onClose={() => setPicker(null)}
          onSelect={(e) => {
            const d = p.days.find((d) => d.id === picker)!;
            updateDay({
              ...d,
              exercises: [
                ...d.exercises,
                newEntry(
                  e,
                  d.exercises.length,
                  data.progression.find((s) => s.exercise_id === e.id),
                ),
              ],
            });
            setPicker(null);
          }}
        />
      )}
    </>
  );
}
export function Targets({
  entry: e,
  onChange,
}: {
  entry: ProgramExercise;
  onChange: (e: ProgramExercise) => void;
}) {
  const set = (key: keyof ProgramExercise['target'], n: number | null) =>
    onChange({ ...e, target: { ...e.target, [key]: n } });
  if (e.load_kind === 'cardio')
    return (
      <div className="stack">
        <Field label="Nombre d’intervalles cardio">
          <NumberField
            label="Nombre d’intervalles cardio"
            min={1}
            max={30}
            step={1}
            value={e.target.sets}
            onChange={(n) => set('sets', n ?? 1)}
          />
        </Field>
        <p className="muted" style={{ fontSize: 12 }}>
          La durée et la distance seront saisies pendant la séance. Ajoutez l’allure, la résistance
          et l’objectif dans les notes de l’exercice.
        </p>
      </div>
    );
  return (
    <>
      <div className="field-grid">
        <Field label="Séries">
          <NumberField
            label="Nombre de séries"
            value={e.target.sets}
            min={1}
            max={30}
            step={1}
            onChange={(n) => set('sets', n)}
          />
        </Field>
        <Field label="Répétitions min.">
          <NumberField
            label="Répétitions minimales"
            value={e.target.reps_min}
            min={1}
            max={100}
            step={1}
            onChange={(n) => set('reps_min', n)}
          />
        </Field>
        <Field label="Répétitions max.">
          <NumberField
            label="Répétitions maximales"
            value={e.target.reps_max}
            min={1}
            max={100}
            step={1}
            onChange={(n) => set('reps_max', n)}
          />
        </Field>
        <Field label="Charge cible (kg)">
          <NumberField
            label="Charge cible"
            value={e.target.weight}
            onChange={(n) => set('weight', n)}
            nullable
          />
        </Field>
        <Field label="RPE cible · facultatif">
          <NumberField
            label="RPE cible"
            value={e.target.rpe}
            min={1}
            max={10}
            onChange={(n) => set('rpe', n)}
            nullable
          />
        </Field>
        <Field label="RIR cible · facultatif">
          <NumberField
            label="RIR cible"
            value={e.target.rir}
            min={0}
            max={10}
            onChange={(n) => set('rir', n)}
            nullable
          />
        </Field>
        <Field label="Repos cible">
          <RestInput
            value={e.target.rest_seconds}
            label="Repos cible"
            onChange={(n) => set('rest_seconds', n)}
          />
        </Field>
        <Field label="Incrément futur (kg)">
          <NumberField
            label="Incrément de progression"
            value={e.increment}
            min={0.1}
            max={100}
            onChange={(n) => onChange({ ...e, increment: n ?? 2.5 })}
          />
        </Field>
      </div>
      <div style={{ marginTop: 12 }}>
        <Field label="Consignes">
          <input
            value={e.notes}
            maxLength={2000}
            placeholder="Amplitude, prise, réglage de machine…"
            onChange={(x) => onChange({ ...e, notes: x.target.value })}
          />
        </Field>
      </div>
    </>
  );
}
