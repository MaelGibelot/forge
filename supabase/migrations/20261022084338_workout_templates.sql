create table public.workout_templates (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  revision integer not null default 1 check (revision > 0),
  name text not null check (length(btrim(name)) between 1 and 100),
  definition jsonb not null check (
    jsonb_typeof(definition) = 'object'
    and definition ?& array['exercises','groups']
    and jsonb_typeof(definition->'exercises') = 'array'
    and jsonb_array_length(definition->'exercises') between 1 and 60
    and jsonb_typeof(definition->'groups') = 'array'
    and jsonb_array_length(definition->'groups') <= 30
    and octet_length(definition::text) <= 250000
  ),
  created_at timestamptz not null default now()
);
create index workout_templates_user_created on public.workout_templates(user_id, created_at desc, id);
alter table public.workout_templates enable row level security;
revoke all on public.workout_templates from public, anon, authenticated;
grant select, insert, update, delete on public.workout_templates to authenticated;
create policy templates_select on public.workout_templates for select to authenticated using ((select auth.uid()) = user_id);
create policy templates_insert on public.workout_templates for insert to authenticated with check ((select auth.uid()) = user_id);
create policy templates_update on public.workout_templates for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy templates_delete on public.workout_templates for delete to authenticated using ((select auth.uid()) = user_id);
