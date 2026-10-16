import { WorkoutPage } from '@/components/workout';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkoutPage id={id} />;
}
