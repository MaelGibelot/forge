-- FORGE / Schéma initial. Appliqué une fois par les migrations Supabase.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.login_identities (
  username text primary key check (username ~ '^[a-z0-9][a-z0-9_.-]{2,31}$'),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);
alter table private.login_identities enable row level security;
create table private.login_attempts (key text primary key, window_start timestamptz not null default now(), attempts integer not null default 1);
alter table private.login_attempts enable row level security;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Athlète' check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);
create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  recommendations boolean not null default true,
  history_count integer not null default 3 check (history_count between 2 and 20),
  max_rpe numeric check (max_rpe between 1 and 10), min_rir numeric check (min_rir between 0 and 10)
);
create table public.muscles (name text primary key);
insert into public.muscles(name) values ('Pectoraux'),('Dos'),('Épaules'),('Biceps'),('Triceps'),('Quadriceps'),('Ischio-jambiers'),('Fessiers'),('Mollets'),('Abdominaux');
create table public.exercises (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120), english_name text,
  description text not null default '', category text not null default 'Musculation',
  equipment text not null check (equipment in ('Barre','Haltères','Machine','Poulie','Poids du corps','Élastique')),
  primary_muscle text not null references public.muscles(name),
  instructions text[] not null default '{}', tips text not null default '', mistakes text not null default '',
  load_kind text not null default 'external' check (load_kind in ('external','bodyweight','assisted')),
  supports_1rm boolean not null default false, created_at timestamptz not null default now()
);
create index exercises_owner_idx on public.exercises(user_id);
create index exercises_muscle_idx on public.exercises(primary_muscle);
create table public.exercise_muscles (
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  muscle text not null references public.muscles(name), role text not null check (role in ('primary','secondary')),
  primary key(exercise_id,muscle)
);
create index exercise_muscles_muscle_idx on public.exercise_muscles(muscle);
create table public.exercise_progression (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  increment numeric not null default 2.5 check (increment > 0 and increment <= 100),
  reps_min integer not null default 8 check (reps_min between 1 and 100),
  reps_max integer not null default 12 check (reps_max between reps_min and 100),
  primary key(user_id,exercise_id)
);
create index exercise_progression_exercise_idx on public.exercise_progression(exercise_id);
create table public.programs (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100), description text not null default '',
  active boolean not null default false, revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create index programs_owner_idx on public.programs(user_id);
create table public.program_days (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, program_id uuid not null,
  name text not null check (char_length(name) between 1 and 100), position integer not null check (position >= 0), unique(id,user_id),
  foreign key(program_id,user_id) references public.programs(id,user_id) on delete cascade
);
create index program_days_parent_idx on public.program_days(program_id,user_id);
create table public.program_superset_groups (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, day_id uuid not null,
  name text not null, rounds integer not null check (rounds between 1 and 30), rest_seconds integer check (rest_seconds between 0 and 7200),
  unique(id,day_id,user_id), foreign key(day_id,user_id) references public.program_days(id,user_id) on delete cascade
);
create index program_groups_day_idx on public.program_superset_groups(day_id,user_id);
create table public.program_exercises (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, day_id uuid not null,
  exercise_id uuid not null references public.exercises(id), name text not null,
  primary_muscle text not null references public.muscles(name), load_kind text not null check (load_kind in ('external','bodyweight','assisted')), supports_1rm boolean not null,
  position integer not null check (position >= 0), group_id uuid,
  target_sets integer not null check (target_sets between 1 and 30), reps_min integer not null check (reps_min between 1 and 100), reps_max integer not null check (reps_max between reps_min and 100),
  target_weight numeric check (target_weight between 0 and 2000), target_rpe numeric check (target_rpe between 1 and 10), target_rir numeric check (target_rir between 0 and 10), target_rest_seconds integer check (target_rest_seconds between 0 and 7200),
  increment numeric not null check (increment > 0 and increment <= 100), notes text not null default '',
  foreign key(day_id,user_id) references public.program_days(id,user_id) on delete cascade,
  foreign key(group_id,day_id,user_id) references public.program_superset_groups(id,day_id,user_id)
);
create index program_exercises_day_idx on public.program_exercises(day_id,user_id);
create index program_exercises_exercise_idx on public.program_exercises(exercise_id);
create index program_exercises_group_idx on public.program_exercises(group_id,day_id,user_id);
create table public.workout_sessions (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  source_day_id uuid references public.program_days(id) on delete set null,
  name text not null check (char_length(name) between 1 and 100), status text not null check (status in ('active','draft','completed')),
  started_at timestamptz not null, finished_at timestamptz, notes text not null default '',
  revision integer not null default 1 check (revision > 0), updated_at timestamptz not null default now(),
  check (status <> 'completed' or (finished_at is not null and finished_at >= started_at)), unique(id,user_id)
);
create index workouts_owner_date_idx on public.workout_sessions(user_id,started_at desc,id);
create table public.workout_superset_groups (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, session_id uuid not null,
  name text not null, rounds integer not null check (rounds between 1 and 30), rest_seconds integer check (rest_seconds between 0 and 7200),
  unique(id,session_id,user_id), foreign key(session_id,user_id) references public.workout_sessions(id,user_id) on delete cascade
);
create index workout_groups_session_idx on public.workout_superset_groups(session_id,user_id);
create table public.workout_exercises (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, session_id uuid not null,
  exercise_id uuid not null references public.exercises(id), name text not null,
  primary_muscle text not null references public.muscles(name), load_kind text not null check (load_kind in ('external','bodyweight','assisted')), supports_1rm boolean not null,
  position integer not null check (position >= 0), group_id uuid, technique_ok boolean not null default false,
  target_sets integer not null check (target_sets between 1 and 30), reps_min integer not null check (reps_min between 1 and 100), reps_max integer not null check (reps_max between reps_min and 100),
  target_weight numeric check (target_weight between 0 and 2000), target_rpe numeric check (target_rpe between 1 and 10), target_rir numeric check (target_rir between 0 and 10), target_rest_seconds integer check (target_rest_seconds between 0 and 7200),
  increment numeric not null check (increment > 0 and increment <= 100), notes text not null default '', unique(id,user_id),
  foreign key(session_id,user_id) references public.workout_sessions(id,user_id) on delete cascade,
  foreign key(group_id,session_id,user_id) references public.workout_superset_groups(id,session_id,user_id)
);
create index workout_exercises_session_idx on public.workout_exercises(session_id,user_id);
create index workout_exercises_exercise_idx on public.workout_exercises(exercise_id);
create index workout_exercises_group_idx on public.workout_exercises(group_id,session_id,user_id);
create table public.workout_sets (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, workout_exercise_id uuid not null,
  position integer not null check (position >= 0), weight numeric check (weight between 0 and 2000), reps integer not null check (reps between 0 and 500),
  rpe numeric check (rpe between 1 and 10), rir numeric check (rir between 0 and 10), rest_seconds integer check (rest_seconds between 0 and 7200),
  type text not null check (type in ('normal','warmup','drop')), completed boolean not null default false, notes text not null default '',
  check (not completed or reps > 0), foreign key(workout_exercise_id,user_id) references public.workout_exercises(id,user_id) on delete cascade
);
create index sets_exercise_idx on public.workout_sets(workout_exercise_id,user_id);
create table public.workout_round_rests (
  user_id uuid not null references auth.users(id) on delete cascade, session_id uuid not null, group_id uuid not null,
  round integer not null check (round between 1 and 30), rest_seconds integer check (rest_seconds between 0 and 7200),
  primary key(group_id,round), foreign key(group_id,session_id,user_id) references public.workout_superset_groups(id,session_id,user_id) on delete cascade
);
create index round_rests_session_idx on public.workout_round_rests(session_id,user_id);
create table public.bodyweight_entries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  date date not null, weight numeric not null check (weight > 0 and weight <= 700), created_at timestamptz not null default now(), unique(user_id,date)
);

-- Toutes les données privées sont protégées en base, y compris les enfants.
do $$ declare t text; begin
  foreach t in array array['profiles','user_preferences','exercise_progression','programs','program_days','program_superset_groups','program_exercises','workout_sessions','workout_superset_groups','workout_exercises','workout_sets','workout_round_rests','bodyweight_entries'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy owner on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',t);
    execute format('grant select, insert, update, delete on public.%I to authenticated',t);
  end loop;
end $$;
alter table public.exercises enable row level security;
create policy readable on public.exercises for select to authenticated using (user_id is null or user_id = (select auth.uid()));
create policy own_custom on public.exercises for insert to authenticated with check (user_id = (select auth.uid()));
grant select,insert on public.exercises to authenticated;
alter table public.muscles enable row level security;
create policy readable on public.muscles for select to authenticated using (true);
grant select on public.muscles to authenticated;
alter table public.exercise_muscles enable row level security;
create policy readable on public.exercise_muscles for select to authenticated using (exists(select 1 from public.exercises e where e.id=exercise_id));
create policy own_custom on public.exercise_muscles for insert to authenticated with check (exists(select 1 from public.exercises e where e.id=exercise_id and e.user_id=(select auth.uid())));
grant select,insert on public.exercise_muscles to authenticated;
grant usage on schema public to authenticated;

-- Empêche les références à l'exercice privé ou à la journée d'un autre compte.
create function private.check_exercise_access() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.exercises where id=new.exercise_id) then raise exception 'Exercice inaccessible'; end if;
  return new;
end $$;
create trigger exercise_access before insert or update on public.program_exercises for each row execute function private.check_exercise_access();
create trigger exercise_access before insert or update on public.workout_exercises for each row execute function private.check_exercise_access();
create trigger exercise_access before insert or update on public.exercise_progression for each row execute function private.check_exercise_access();
create function private.check_source_access() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.source_day_id is not null and not exists(select 1 from public.program_days where id=new.source_day_id and user_id=new.user_id) then raise exception 'Journée inaccessible'; end if;
  return new;
end $$;
create trigger source_access before insert or update on public.workout_sessions for each row execute function private.check_source_access();

-- RPC de lecture ne contournant pas les RLS. Les objets JSON sont uniquement
-- des transports : les données sont stockées dans les tables relationnelles.
create function public.read_programs() returns jsonb language sql stable security invoker set search_path='' as $$
select coalesce(jsonb_agg(p order by p->>'created_at' desc),'[]') from (
 select to_jsonb(p) || jsonb_build_object('days',coalesce((select jsonb_agg(to_jsonb(d) || jsonb_build_object(
  'groups',coalesce((select jsonb_agg(g) from public.program_superset_groups g where g.day_id=d.id),'[]'),
  'exercises',coalesce((select jsonb_agg(to_jsonb(e) || jsonb_build_object('target',jsonb_build_object('sets',e.target_sets,'reps_min',e.reps_min,'reps_max',e.reps_max,'weight',e.target_weight,'rpe',e.target_rpe,'rir',e.target_rir,'rest_seconds',e.target_rest_seconds)) order by e.position) from public.program_exercises e where e.day_id=d.id),'[]')) order by d.position) from public.program_days d where d.program_id=p.id),'[]')) p from public.programs p
) q;
$$;
create function public.read_workouts(page_offset integer default 0, page_size integer default 30, since_date timestamptz default null, only_id uuid default null, only_exercise uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$
select coalesce(jsonb_agg(w order by w->>'started_at' desc,w->>'id'),'[]') from (
 select to_jsonb(w) || jsonb_build_object(
 'groups',coalesce((select jsonb_agg(g) from public.workout_superset_groups g where g.session_id=w.id),'[]'),
 'round_rests',coalesce((select jsonb_agg(r) from public.workout_round_rests r where r.session_id=w.id),'[]'),
 'exercises',coalesce((select jsonb_agg(to_jsonb(e) || jsonb_build_object('target',jsonb_build_object('sets',e.target_sets,'reps_min',e.reps_min,'reps_max',e.reps_max,'weight',e.target_weight,'rpe',e.target_rpe,'rir',e.target_rir,'rest_seconds',e.target_rest_seconds), 'sets',coalesce((select jsonb_agg(s order by s.position) from public.workout_sets s where s.workout_exercise_id=e.id),'[]')) order by e.position) from public.workout_exercises e where e.session_id=w.id),'[]')) w
 from (select * from public.workout_sessions s where (since_date is null or started_at >= since_date) and (only_id is null or id=only_id) and (only_exercise is null or exists(select 1 from public.workout_exercises e where e.session_id=s.id and e.exercise_id=only_exercise)) order by started_at desc,id limit least(greatest(page_size,1),200) offset greatest(page_offset,0)) w
) q;
$$;

create function public.save_program(payload jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare u uuid := auth.uid(); p uuid := (payload->>'id')::uuid; d jsonb; e jsonb; g jsonb; rev integer;
begin
  if u is null then raise exception 'Authentification requise'; end if;
  if (payload->>'revision')::integer = 0 then
    insert into public.programs(id,user_id,name,description,active) values(p,u,payload->>'name',payload->>'description',(payload->>'active')::boolean) returning revision into rev;
  else
    update public.programs set name=payload->>'name',description=payload->>'description',active=(payload->>'active')::boolean, revision=revision+1,updated_at=now() where id=p and user_id=u and revision=(payload->>'revision')::integer returning revision into rev;
    if rev is null then raise exception 'CONFLICT'; end if;
  end if;
  -- Reconcile days without deleting unchanged IDs (history keeps its source).
  delete from public.program_exercises where day_id in (select id from public.program_days where program_id=p);
  delete from public.program_superset_groups where day_id in (select id from public.program_days where program_id=p);
  delete from public.program_days where program_id=p and id not in (select (value->>'id')::uuid from jsonb_array_elements(payload->'days'));
  for d in select value from jsonb_array_elements(payload->'days') loop
    insert into public.program_days(id,user_id,program_id,name,position) values((d->>'id')::uuid,u,p,d->>'name',(d->>'position')::integer)
    on conflict(id) do update set name=excluded.name,position=excluded.position where program_days.program_id=p and program_days.user_id=u;
    if not found then raise exception 'Journée inaccessible'; end if;
    for g in select value from jsonb_array_elements(d->'groups') loop
      insert into public.program_superset_groups values((g->>'id')::uuid,u,(d->>'id')::uuid,g->>'name',(g->>'rounds')::integer,(g->>'rest_seconds')::integer);
    end loop;
    for e in select value from jsonb_array_elements(d->'exercises') loop
      insert into public.program_exercises(id,user_id,day_id,exercise_id,name,primary_muscle,load_kind,supports_1rm,position,group_id,target_sets,reps_min,reps_max,target_weight,target_rpe,target_rir,target_rest_seconds,increment,notes)
      values((e->>'id')::uuid,u,(d->>'id')::uuid,(e->>'exercise_id')::uuid,e->>'name',e->>'primary_muscle',e->>'load_kind',(e->>'supports_1rm')::boolean,(e->>'position')::integer,(e->>'group_id')::uuid,(e->'target'->>'sets')::integer,(e->'target'->>'reps_min')::integer,(e->'target'->>'reps_max')::integer,(e->'target'->>'weight')::numeric,(e->'target'->>'rpe')::numeric,(e->'target'->>'rir')::numeric,(e->'target'->>'rest_seconds')::integer,(e->>'increment')::numeric,e->>'notes');
    end loop;
  end loop;
  return rev;
end $$;

create function public.save_workout(payload jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare u uuid := auth.uid(); w uuid := (payload->>'id')::uuid; e jsonb; s jsonb; g jsonb; r jsonb; rev integer;
begin
  if u is null then raise exception 'Authentification requise'; end if;
  if (payload->>'revision')::integer = 0 then
    insert into public.workout_sessions(id,user_id,source_day_id,name,status,started_at,finished_at,notes) values(w,u,(payload->>'source_day_id')::uuid,payload->>'name',payload->>'status',(payload->>'started_at')::timestamptz,(payload->>'finished_at')::timestamptz,payload->>'notes') returning revision into rev;
  else
    update public.workout_sessions set name=payload->>'name',status=payload->>'status',started_at=(payload->>'started_at')::timestamptz,finished_at=(payload->>'finished_at')::timestamptz,notes=payload->>'notes',revision=revision+1,updated_at=now() where id=w and user_id=u and revision=(payload->>'revision')::integer returning revision into rev;
    if rev is null then raise exception 'CONFLICT'; end if;
  end if;
  delete from public.workout_exercises where session_id=w;
  delete from public.workout_superset_groups where session_id=w;
  for g in select value from jsonb_array_elements(payload->'groups') loop
    insert into public.workout_superset_groups values((g->>'id')::uuid,u,w,g->>'name',(g->>'rounds')::integer,(g->>'rest_seconds')::integer);
  end loop;
  for e in select value from jsonb_array_elements(payload->'exercises') loop
    insert into public.workout_exercises(id,user_id,session_id,exercise_id,name,primary_muscle,load_kind,supports_1rm,position,group_id,technique_ok,target_sets,reps_min,reps_max,target_weight,target_rpe,target_rir,target_rest_seconds,increment,notes)
    values((e->>'id')::uuid,u,w,(e->>'exercise_id')::uuid,e->>'name',e->>'primary_muscle',e->>'load_kind',(e->>'supports_1rm')::boolean,(e->>'position')::integer,(e->>'group_id')::uuid,(e->>'technique_ok')::boolean,(e->'target'->>'sets')::integer,(e->'target'->>'reps_min')::integer,(e->'target'->>'reps_max')::integer,(e->'target'->>'weight')::numeric,(e->'target'->>'rpe')::numeric,(e->'target'->>'rir')::numeric,(e->'target'->>'rest_seconds')::integer,(e->>'increment')::numeric,e->>'notes');
    for s in select value from jsonb_array_elements(e->'sets') loop
      insert into public.workout_sets values((s->>'id')::uuid,u,(e->>'id')::uuid,(s->>'position')::integer,(s->>'weight')::numeric,(s->>'reps')::integer,(s->>'rpe')::numeric,(s->>'rir')::numeric,(s->>'rest_seconds')::integer,s->>'type',(s->>'completed')::boolean,s->>'notes');
    end loop;
  end loop;
  for r in select value from jsonb_array_elements(payload->'round_rests') loop
    insert into public.workout_round_rests values(u,w,(r->>'group_id')::uuid,(r->>'round')::integer,(r->>'rest_seconds')::integer);
  end loop;
  return rev;
end $$;

-- Seul le service serveur peut résoudre un identifiant ou limiter les essais.
create function public.resolve_login(login text) returns text language sql stable security definer set search_path='' as $$
select email from private.login_identities where username=login;
$$;
create function public.register_login(login text, identity uuid, technical_email text) returns void language sql security definer set search_path='' as $$
insert into private.login_identities(username,user_id,email) values(login,identity,technical_email);
$$;
create function public.lookup_login_user(login text) returns uuid language sql stable security definer set search_path='' as $$
select user_id from private.login_identities where username=login;
$$;
create function public.consume_login_attempt(bucket text, max_attempts integer) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 delete from private.login_attempts where window_start < now()-interval '1 day';
 insert into private.login_attempts(key) values(bucket) on conflict(key) do update set
 attempts=case when login_attempts.window_start < now()-interval '15 minutes' then 1 else login_attempts.attempts+1 end,
 window_start=case when login_attempts.window_start < now()-interval '15 minutes' then now() else login_attempts.window_start end
 returning attempts into n;
 return n <= max_attempts;
end $$;
revoke execute on all functions in schema public from public,anon;
grant execute on function public.read_programs(), public.read_workouts(integer,integer,timestamptz,uuid,uuid), public.save_program(jsonb), public.save_workout(jsonb) to authenticated;
revoke execute on function public.resolve_login(text), public.register_login(text,uuid,text), public.lookup_login_user(text), public.consume_login_attempt(text,integer) from authenticated;
grant execute on function public.resolve_login(text), public.register_login(text,uuid,text), public.lookup_login_user(text), public.consume_login_attempt(text,integer) to service_role;
grant all on all tables in schema public to service_role;
