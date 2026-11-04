-- Additive coaching context; existing RLS and RPC permissions stay in place.
alter table public.user_preferences add column coaching jsonb not null default '{}'
  check (jsonb_typeof(coaching)='object' and pg_column_size(coaching)<=10000);
alter table public.exercise_progression add column available_weights numeric[] not null default '{}'
  check (coalesce(array_length(available_weights,1),0)<=100 and 0<=all(available_weights) and 2000>=all(available_weights) and array_position(available_weights,null) is null);
alter table public.workout_exercises add column feedback jsonb not null default '{}'
  check (jsonb_typeof(feedback)='object' and pg_column_size(feedback)<=2000
    and (feedback->>'effort' is null or feedback->>'effort' in ('easy','controlled','hard'))
    and (feedback->>'recovery' is null or feedback->>'recovery' in ('good','poor'))
    and (not feedback ? 'pain' or jsonb_typeof(feedback->'pain')='boolean')
    and (not feedback ? 'technique_issue' or jsonb_typeof(feedback->'technique_issue')='boolean'));

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
    insert into public.workout_exercises(id,user_id,session_id,exercise_id,name,primary_muscle,load_kind,supports_1rm,position,group_id,technique_ok,target_sets,reps_min,reps_max,target_weight,target_rpe,target_rir,target_rest_seconds,increment,notes,feedback)
    values((e->>'id')::uuid,u,w,(e->>'exercise_id')::uuid,e->>'name',e->>'primary_muscle',e->>'load_kind',(e->>'supports_1rm')::boolean,(e->>'position')::integer,(e->>'group_id')::uuid,(e->>'technique_ok')::boolean,(e->'target'->>'sets')::integer,(e->'target'->>'reps_min')::integer,(e->'target'->>'reps_max')::integer,(e->'target'->>'weight')::numeric,(e->'target'->>'rpe')::numeric,(e->'target'->>'rir')::numeric,(e->'target'->>'rest_seconds')::integer,(e->>'increment')::numeric,e->>'notes',coalesce(e->'feedback','{}'::jsonb));
    for s in select value from jsonb_array_elements(e->'sets') loop
      insert into public.workout_sets(id,user_id,workout_exercise_id,position,weight,reps,rpe,rir,rest_seconds,type,completed,notes,duration_seconds,distance_km,reached_failure) values((s->>'id')::uuid,u,(e->>'id')::uuid,(s->>'position')::integer,(s->>'weight')::numeric,(s->>'reps')::integer,(s->>'rpe')::numeric,(s->>'rir')::numeric,(s->>'rest_seconds')::integer,s->>'type',(s->>'completed')::boolean,s->>'notes',(s->>'duration_seconds')::integer,(s->>'distance_km')::numeric,coalesce((s->>'reached_failure')::boolean,false));
    end loop;
  end loop;
  for r in select value from jsonb_array_elements(payload->'round_rests') loop
    insert into public.workout_round_rests values(u,w,(r->>'group_id')::uuid,(r->>'round')::integer,(r->>'rest_seconds')::integer);
  end loop;
  return rev;
end $$;

