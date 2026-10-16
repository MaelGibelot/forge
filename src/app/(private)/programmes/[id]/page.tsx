import { ProgramEditor } from '@/components/programs';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProgramEditor id={id} />;
}
