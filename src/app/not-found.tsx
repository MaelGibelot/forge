import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="standalone">
      <div className="eyebrow">404 · HORS DU PROGRAMME</div>
      <h1>Cette page est introuvable.</h1>
      <Link href="/tableau-de-bord" className="btn btn-primary">
        Revenir au tableau de bord
      </Link>
    </main>
  );
}
