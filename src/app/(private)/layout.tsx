import { configured, supabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Shell } from '@/components/shell';
import { DataProvider } from '@/components/store';
export const dynamic = 'force-dynamic';
export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  if (!configured()) redirect('/connexion');
  const db = await supabase();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect('/connexion');
  const { data: profile } = await db
    .from('profiles')
    .select('display_name')
    .eq('user_id', data.user.id)
    .single();
  return (
    <Shell name={profile?.display_name ?? 'Athlète'}>
      <DataProvider>{children}</DataProvider>
    </Shell>
  );
}
