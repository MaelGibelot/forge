'use client';
import { Button } from '@/components/ui';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <h1>Une erreur est survenue.</h1>
      <p>Réessayez. Vos séances enregistrées sont conservées en base.</p>
      <Button onClick={reset}>Réessayer</Button>
    </main>
  );
}
