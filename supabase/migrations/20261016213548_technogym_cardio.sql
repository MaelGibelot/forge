-- Extension additive : les historiques et politiques RLS restent conservés.
insert into public.muscles(name) values ('Adducteurs') on conflict do nothing;
alter table public.exercises drop constraint exercises_equipment_check;
alter table public.exercises add constraint exercises_equipment_check check(equipment in ('Barre','Haltères','Machine','Poulie','Poids du corps','Élastique','Cardio'));
alter table public.exercises drop constraint exercises_load_kind_check;
alter table public.exercises add constraint exercises_load_kind_check check(load_kind in ('external','bodyweight','assisted','cardio'));
alter table public.program_exercises drop constraint program_exercises_load_kind_check;
alter table public.program_exercises add constraint program_exercises_load_kind_check check(load_kind in ('external','bodyweight','assisted','cardio'));
alter table public.workout_exercises drop constraint workout_exercises_load_kind_check;
alter table public.workout_exercises add constraint workout_exercises_load_kind_check check(load_kind in ('external','bodyweight','assisted','cardio'));
alter table public.workout_sets add column duration_seconds integer check(duration_seconds between 0 and 86400);
alter table public.workout_sets add column distance_km numeric check(distance_km between 0 and 10000);
alter table public.workout_sets drop constraint workout_sets_check;
alter table public.workout_sets add constraint workout_sets_check check(not completed or reps > 0 or duration_seconds > 0);

-- Validation du mode au plus près des données, y compris en accès direct sous RLS.
create function private.check_workout_set_kind() returns trigger language plpgsql security invoker set search_path='' as $$
declare kind text;
begin
  select load_kind into strict kind from public.workout_exercises where id=new.workout_exercise_id and user_id=new.user_id;
  if kind='cardio' then
    if new.reps<>0 or new.weight is not null or new.rir is not null or new.type='drop' or (new.completed and coalesce(new.duration_seconds,0)<=0) then
      raise exception 'Intervalle cardio invalide';
    end if;
  elsif new.duration_seconds is not null or new.distance_km is not null or (new.completed and new.reps<=0) then
    raise exception 'Série de musculation invalide';
  end if;
  return new;
end $$;
revoke all on function private.check_workout_set_kind() from public,anon,authenticated;
create trigger workout_set_kind before insert or update on public.workout_sets for each row execute function private.check_workout_set_kind();

create or replace function public.save_workout(payload jsonb) returns integer language plpgsql security invoker set search_path='' as $$
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
      insert into public.workout_sets(id,user_id,workout_exercise_id,position,weight,reps,rpe,rir,rest_seconds,type,completed,notes,duration_seconds,distance_km) values((s->>'id')::uuid,u,(e->>'id')::uuid,(s->>'position')::integer,(s->>'weight')::numeric,(s->>'reps')::integer,(s->>'rpe')::numeric,(s->>'rir')::numeric,(s->>'rest_seconds')::integer,s->>'type',(s->>'completed')::boolean,s->>'notes',(s->>'duration_seconds')::integer,(s->>'distance_km')::numeric);
    end loop;
  end loop;
  for r in select value from jsonb_array_elements(payload->'round_rests') loop
    insert into public.workout_round_rests values(u,w,(r->>'group_id')::uuid,(r->>'round')::integer,(r->>'rest_seconds')::integer);
  end loop;
  return rev;
end $$;

