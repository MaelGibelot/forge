import { configured, supabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Login } from '@/components/login';
export const dynamic = 'force-dynamic';
export default async function LoginPage() {
  const ready = configured();
  if (ready) {
    const db = await supabase();
    const { data } = await db.auth.getUser();
    if (data.user) redirect('/tableau-de-bord');
  }
  return <Login configured={ready} />;
}
