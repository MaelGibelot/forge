-- Couverture des clés étrangères et des filtres RLS détectés sur le projet réel.
create index if not exists program_days_user_idx on public.program_days(user_id);
create index if not exists program_exercises_user_idx on public.program_exercises(user_id);
create index if not exists program_exercises_muscle_idx on public.program_exercises(primary_muscle);
create index if not exists program_groups_user_idx on public.program_superset_groups(user_id);
create index if not exists workout_exercises_user_idx on public.workout_exercises(user_id);
create index if not exists workout_exercises_muscle_idx on public.workout_exercises(primary_muscle);
create index if not exists workout_round_rests_group_idx on public.workout_round_rests(group_id,session_id,user_id);
create index if not exists workout_round_rests_user_idx on public.workout_round_rests(user_id);
create index if not exists workout_sessions_source_idx on public.workout_sessions(source_day_id);
create index if not exists workout_sets_user_idx on public.workout_sets(user_id);
create index if not exists workout_groups_user_idx on public.workout_superset_groups(user_id);
