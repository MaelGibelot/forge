-- Add climbing without changing existing strength/cardio histories or permissions.
alter table public.exercises drop constraint exercises_load_kind_check;
alter table public.exercises add constraint exercises_load_kind_check check(load_kind in ('external','bodyweight','assisted','cardio','climbing','bouldering'));
alter table public.program_exercises drop constraint program_exercises_load_kind_check;
alter table public.program_exercises add constraint program_exercises_load_kind_check check(load_kind in ('external','bodyweight','assisted','cardio','climbing','bouldering'));
alter table public.workout_exercises drop constraint workout_exercises_load_kind_check;
alter table public.workout_exercises add constraint workout_exercises_load_kind_check check(load_kind in ('external','bodyweight','assisted','cardio','climbing','bouldering'));
alter table public.workout_sets add column climbing jsonb;
alter table public.workout_sets drop constraint workout_sets_check;
alter table public.workout_sets add constraint workout_sets_check check(not completed or reps > 0 or duration_seconds > 0 or climbing is not null);

create or replace function private.check_workout_set_kind() returns trigger language plpgsql security invoker set search_path='' as $$
declare kind text; info jsonb;
begin
  select load_kind into strict kind from public.workout_exercises where id=new.workout_exercise_id and user_id=new.user_id;
  if kind in ('climbing','bouldering') then
    info := new.climbing;
    if info is null or jsonb_typeof(info) is distinct from 'object' or pg_column_size(info)>2000 then raise exception 'Passage escalade invalide'; end if;
    if not (info ?& array['grade','attempts','result','style']) then raise exception 'Champs escalade manquants'; end if;
    if jsonb_typeof(info->'grade') not in ('null','string') or jsonb_typeof(info->'attempts') <> 'number' or jsonb_typeof(info->'result') <> 'string' or jsonb_typeof(info->'style') not in ('null','string') then raise exception 'Types escalade invalides'; end if;
    if (info->>'grade') is not null and not ((info->>'grade')=any(array['1','1a','1a+','1b','1b+','1c','1c+','2','2a','2a+','2b','2b+','2c','2c+','3','3a','3a+','3b','3b+','3c','3c+','4','4a','4a+','4b','4b+','4c','4c+','5','5a','5a+','5b','5b+','5c','5c+','6','6a','6a+','6b','6b+','6c','6c+','7','7a','7a+','7b','7b+','7c','7c+','8','8a','8a+','8b','8b+','8c','8c+','9','9a','9a+','9b','9b+','9c','9c+'])) then raise exception 'Cotation invalide'; end if;
    if not coalesce((info->>'attempts') ~ '^[0-9]+$',false) then raise exception 'Essais invalides'; end if;
    if (info->>'attempts')::integer not between 1 and 100 or not coalesce((info->>'result') in ('attempt','sent'),false) or ((info->>'style') is not null and (info->>'style') not in ('lead','toprope')) then raise exception 'Résultat escalade invalide'; end if;
    if new.reps<>0 or new.weight is not null or new.rpe is not null or new.rir is not null or new.reached_failure or new.type<>'normal' or new.duration_seconds is not null or new.distance_km is not null or (new.completed and (info->>'grade') is null) or (kind='bouldering' and (info->>'style') is not null) then raise exception 'Passage escalade incohérent'; end if;
  elsif new.climbing is not null then raise exception 'Cotation réservée à escalade';
  elsif kind='cardio' then
    if new.reps<>0 or new.weight is not null or new.rir is not null or new.type='drop' or new.reached_failure or (new.completed and coalesce(new.duration_seconds,0)<=0) then raise exception 'Intervalle cardio invalide'; end if;
  elsif new.duration_seconds is not null or new.distance_km is not null or (new.completed and new.reps<=0) then raise exception 'Série de musculation invalide';
  end if;
  return new;
end $$;

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
      insert into public.workout_sets(id,user_id,workout_exercise_id,position,weight,reps,rpe,rir,rest_seconds,type,completed,notes,duration_seconds,distance_km,reached_failure,climbing) values((s->>'id')::uuid,u,(e->>'id')::uuid,(s->>'position')::integer,(s->>'weight')::numeric,(s->>'reps')::integer,(s->>'rpe')::numeric,(s->>'rir')::numeric,(s->>'rest_seconds')::integer,s->>'type',(s->>'completed')::boolean,s->>'notes',(s->>'duration_seconds')::integer,(s->>'distance_km')::numeric,coalesce((s->>'reached_failure')::boolean,false),nullif(s->'climbing','null'::jsonb));
    end loop;
  end loop;
  for r in select value from jsonb_array_elements(payload->'round_rests') loop
    insert into public.workout_round_rests values(u,w,(r->>'group_id')::uuid,(r->>'round')::integer,(r->>'rest_seconds')::integer);
  end loop;
  return rev;
end $$;


insert into public.exercises(id,name,english_name,description,category,equipment,primary_muscle,instructions,tips,mistakes,load_kind,supports_1rm) values ('40000000-0000-4000-8000-000000000001','Escalade — voies','Sport climbing routes','Consignez une cotation, vos essais et le résultat de chaque passage.','Sports · Escalade','Poids du corps','Dos',array['Ajoutez une ligne par voie ou bloc travaillé.','Choisissez la cotation affichée ou celle du topo et indiquez le nombre d’essais.','Distinguez une réussite d’un projet encore tenté. Précisez la salle, le secteur ou la couleur dans les notes.'],'Les cotations restent des repères de difficulté. Voies et blocs ont des historiques distincts ; les couleurs d’une salle ne sont pas converties automatiquement.','Une tentative enregistrée ne constitue pas une réussite. Les passages ne comptent pas comme des séries de musculation.','climbing',false) on conflict(id) do nothing;
insert into public.exercise_muscles values ('40000000-0000-4000-8000-000000000001','Dos','primary'),('40000000-0000-4000-8000-000000000001','Biceps','secondary'),('40000000-0000-4000-8000-000000000001','Abdominaux','secondary'),('40000000-0000-4000-8000-000000000001','Épaules','secondary'),('40000000-0000-4000-8000-000000000001','Quadriceps','secondary'),('40000000-0000-4000-8000-000000000001','Fessiers','secondary') on conflict do nothing;
insert into public.exercises(id,name,english_name,description,category,equipment,primary_muscle,instructions,tips,mistakes,load_kind,supports_1rm) values ('40000000-0000-4000-8000-000000000002','Escalade — bloc','Bouldering','Consignez une cotation, vos essais et le résultat de chaque passage.','Sports · Escalade','Poids du corps','Dos',array['Ajoutez une ligne par voie ou bloc travaillé.','Choisissez la cotation affichée ou celle du topo et indiquez le nombre d’essais.','Distinguez une réussite d’un projet encore tenté. Précisez la salle, le secteur ou la couleur dans les notes.'],'Les cotations restent des repères de difficulté. Voies et blocs ont des historiques distincts ; les couleurs d’une salle ne sont pas converties automatiquement.','Une tentative enregistrée ne constitue pas une réussite. Les passages ne comptent pas comme des séries de musculation.','bouldering',false) on conflict(id) do nothing;
insert into public.exercise_muscles values ('40000000-0000-4000-8000-000000000002','Dos','primary'),('40000000-0000-4000-8000-000000000002','Biceps','secondary'),('40000000-0000-4000-8000-000000000002','Abdominaux','secondary'),('40000000-0000-4000-8000-000000000002','Épaules','secondary'),('40000000-0000-4000-8000-000000000002','Quadriceps','secondary'),('40000000-0000-4000-8000-000000000002','Fessiers','secondary') on conflict do nothing;
