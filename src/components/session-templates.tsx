'use client';
import { useEffect, useState } from 'react';
import { BookmarkPlus, Play, Pencil, Trash2 } from 'lucide-react';
import { Button, Modal, Field, ErrorBox, api } from './ui';
import { useStartWorkout } from './dashboard';
import { templateFromWorkout, type WorkoutTemplate } from '@/lib/templates';
import type { Workout } from '@/lib/domain';

function SaveDialog({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const [candidate] = useState(() => templateFromWorkout(workout));
  const [name, setName] = useState(workout.name),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [saved, setSaved] = useState(false);
  return (
    <Modal title="Enregistrer un modèle" onClose={onClose}>
      {saved ? (
        <div className="stack">
          <p role="status">Modèle enregistré. Retrouvez-le dans « Séances ».</p>
          <Button onClick={onClose}>Fermer</Button>
        </div>
      ) : (
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await api('/api/workout-templates', {
                method: 'POST',
                body: JSON.stringify({ ...candidate, name }),
              });
              setSaved(true);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Nom du modèle">
            <input
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <p className="muted">
            Exercices, prises, ordre, supersets et nombre de séries conservés. Charges, répétitions
            et résultats seront vides à chaque démarrage.
          </p>
          <ErrorBox message={error} />
          <Button type="submit" busy={busy} disabled={!name.trim()}>
            Enregistrer le modèle
          </Button>
        </form>
      )}
    </Modal>
  );
}
export function SaveTemplateButton({ workout }: { workout: Workout }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        disabled={!workout.exercises.length}
        onClick={() => setOpen(true)}
      >
        <BookmarkPlus size={15} />
        Créer un modèle
      </Button>
      {open && <SaveDialog workout={workout} onClose={() => setOpen(false)} />}
    </>
  );
}

export function SessionTemplates() {
  const [templates, setTemplates] = useState<WorkoutTemplate[] | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [renaming, setRenaming] = useState<WorkoutTemplate | null>(null),
    [name, setName] = useState('');
  const launch = useStartWorkout();
  useEffect(() => {
    let live = true;
    api<WorkoutTemplate[]>('/api/workout-templates')
      .then((rows) => {
        if (live) setTemplates(rows);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <section className="stack" aria-label="Modèles de séance" style={{ marginBottom: 28 }}>
      <div>
        <h2>Mes modèles de séance</h2>
        <p className="muted">
          Votre structure habituelle, avec des charges et répétitions à renseigner. Créez un modèle
          depuis une séance terminée.
        </p>
      </div>
      <ErrorBox message={error ?? launch.error} />
      {templates === null ? (
        <p role="status" className="muted">
          Chargement des modèles…
        </p>
      ) : !templates.length ? (
        <p className="muted">Aucun modèle enregistré pour le moment.</p>
      ) : (
        <div className="grid-3">
          {templates.map((t) => (
            <article className="card stack" key={t.id}>
              <h3>{t.name}</h3>
              <p className="muted">
                {t.definition.exercises.length} exercices ·{' '}
                {t.definition.exercises.reduce((n, e) => n + e.sets.length, 0)} séries / intervalles
              </p>
              <Button
                busy={launch.busy}
                disabled={busy}
                onClick={() => launch.start(undefined, t)}
                aria-label={`Démarrer le modèle ${t.name}`}
              >
                <Play size={15} />
                Démarrer
              </Button>
              <div className="actions">
                <Button
                  variant="ghost"
                  disabled={busy || launch.busy}
                  aria-label={`Renommer le modèle ${t.name}`}
                  onClick={() => {
                    setRenaming(t);
                    setName(t.name);
                  }}
                >
                  <Pencil size={14} />
                  Renommer
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy || launch.busy}
                  aria-label={`Supprimer le modèle ${t.name}`}
                  onClick={async () => {
                    if (
                      !confirm(
                        `Supprimer le modèle « ${t.name} » ? Vos séances restent conservées.`,
                      )
                    )
                      return;
                    setBusy(true);
                    setError(null);
                    try {
                      await api('/api/workout-templates', {
                        method: 'DELETE',
                        body: JSON.stringify({ id: t.id, revision: t.revision }),
                      });
                      setTemplates((rows) => rows!.filter((x) => x.id !== t.id));
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Trash2 size={14} />
                  Supprimer
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      {renaming && (
        <Modal title="Renommer le modèle" onClose={() => setRenaming(null)}>
          <form
            className="stack"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError(null);
              try {
                const updated = await api<WorkoutTemplate>('/api/workout-templates', {
                  method: 'PATCH',
                  body: JSON.stringify({ id: renaming.id, revision: renaming.revision, name }),
                });
                setTemplates((rows) => rows!.map((t) => (t.id === updated.id ? updated : t)));
                setRenaming(null);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Nouveau nom du modèle">
              <input
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <ErrorBox message={error} />
            <Button type="submit" busy={busy} disabled={!name.trim()}>
              Enregistrer le nom
            </Button>
          </form>
        </Modal>
      )}
    </section>
  );
}
