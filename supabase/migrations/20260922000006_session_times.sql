-- Sessions record when they start and end. Hours stay as the stored total
-- (end minus start, in quarter hours) so every sum, report and snapshot keeps
-- working unchanged. Both times are optional: absence and holiday days have
-- none, and older rows may have hours only. students.default_days and
-- students.default_times remain in place but the app no longer reads them.

alter table public.sessions
  add column start_time time,
  add column end_time time,
  add constraint sessions_times_in_order check (start_time is null or end_time is null or end_time > start_time),
  add constraint sessions_times_together check ((start_time is null) = (end_time is null)),
  add constraint sessions_times_step check (
    (start_time is null or extract(minute from start_time)::integer % 15 = 0)
    and (end_time is null or extract(minute from end_time)::integer % 15 = 0)
  );

-- A weekly schedule remembers the times it was created with, so days added
-- to it later start from the same times.
alter table public.recurrence_rules
  add column start_time time,
  add column end_time time,
  add constraint recurrence_rules_times_in_order check (start_time is null or end_time is null or end_time > start_time);

-- The calendar helpers take the times too. The old signatures are dropped;
-- the app is deployed with this migration.
drop function if exists public.create_recurring_sessions(uuid, integer, date, date, numeric, date[]);
drop function if exists public.update_recurring_sessions_from(uuid, date, numeric, text);

create or replace function public.create_recurring_sessions(
  p_student_id uuid,
  p_weekday integer,
  p_start_date date,
  p_end_date date,
  p_hours numeric,
  p_dates date[],
  p_start_time time default null,
  p_end_time time default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_rule_id uuid;
begin
  insert into public.recurrence_rules (student_id, tutor_id, weekday, start_date, end_date, default_hours, start_time, end_time)
  values (p_student_id, auth.uid(), p_weekday, p_start_date, p_end_date, p_hours, p_start_time, p_end_time)
  returning id into v_rule_id;

  insert into public.sessions (student_id, tutor_id, session_date, hours, code, recurrence_rule_id, start_time, end_time)
  select p_student_id, auth.uid(), d, p_hours, null, v_rule_id, p_start_time, p_end_time
  from unnest(p_dates) as d
  on conflict (student_id, session_date) do nothing;

  return v_rule_id;
end;
$$;

-- Updates every session of a rule on or after a date, its times included,
-- and the rule's defaults when the days are not coded.
create or replace function public.update_recurring_sessions_from(
  p_rule_id uuid,
  p_from_date date,
  p_hours numeric,
  p_code text,
  p_start_time time default null,
  p_end_time time default null
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.sessions
  set hours = p_hours, code = p_code, start_time = p_start_time, end_time = p_end_time
  where recurrence_rule_id = p_rule_id and session_date >= p_from_date;
  get diagnostics v_count = row_count;

  if p_code is null then
    update public.recurrence_rules
    set default_hours = p_hours, start_time = p_start_time, end_time = p_end_time
    where id = p_rule_id;
  end if;

  return v_count;
end;
$$;

revoke all on function public.create_recurring_sessions(uuid, integer, date, date, numeric, date[], time, time) from public;
revoke all on function public.update_recurring_sessions_from(uuid, date, numeric, text, time, time) from public;
grant execute on function public.create_recurring_sessions(uuid, integer, date, date, numeric, date[], time, time) to authenticated;
grant execute on function public.update_recurring_sessions_from(uuid, date, numeric, text, time, time) to authenticated;
