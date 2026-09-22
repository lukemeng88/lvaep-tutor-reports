-- Transactional helpers for the calendar. They run as the calling user
-- (security invoker), so Row Level Security still applies to every row.

-- Creates a weekly recurrence rule and its sessions in one transaction.
-- p_dates is computed by the app (see src/lib/recurrence.ts); days that
-- already have a session are skipped.
create or replace function public.create_recurring_sessions(
  p_student_id uuid,
  p_weekday integer,
  p_start_date date,
  p_end_date date,
  p_hours numeric,
  p_dates date[]
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_rule_id uuid;
begin
  insert into public.recurrence_rules (student_id, tutor_id, weekday, start_date, end_date, default_hours)
  values (p_student_id, auth.uid(), p_weekday, p_start_date, p_end_date, p_hours)
  returning id into v_rule_id;

  insert into public.sessions (student_id, tutor_id, session_date, hours, code, recurrence_rule_id)
  select p_student_id, auth.uid(), d, p_hours, null, v_rule_id
  from unnest(p_dates) as d
  on conflict (student_id, session_date) do nothing;

  return v_rule_id;
end;
$$;

-- Updates every session of a rule on or after a date, and the rule's default hours.
create or replace function public.update_recurring_sessions_from(
  p_rule_id uuid,
  p_from_date date,
  p_hours numeric,
  p_code text
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
  set hours = p_hours, code = p_code
  where recurrence_rule_id = p_rule_id and session_date >= p_from_date;
  get diagnostics v_count = row_count;

  if p_code is null then
    update public.recurrence_rules set default_hours = p_hours where id = p_rule_id;
  end if;

  return v_count;
end;
$$;

-- Deletes every session of a rule on or after a date and ends the rule the day before.
create or replace function public.delete_recurring_sessions_from(
  p_rule_id uuid,
  p_from_date date
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.sessions
  where recurrence_rule_id = p_rule_id and session_date >= p_from_date;
  get diagnostics v_count = row_count;

  update public.recurrence_rules
  set end_date = p_from_date - 1
  where id = p_rule_id;

  -- A rule that now ends before it starts has no days left; remove it.
  delete from public.recurrence_rules
  where id = p_rule_id and end_date < start_date;

  return v_count;
end;
$$;

revoke all on function public.create_recurring_sessions(uuid, integer, date, date, numeric, date[]) from public;
revoke all on function public.update_recurring_sessions_from(uuid, date, numeric, text) from public;
revoke all on function public.delete_recurring_sessions_from(uuid, date) from public;
grant execute on function public.create_recurring_sessions(uuid, integer, date, date, numeric, date[]) to authenticated;
grant execute on function public.update_recurring_sessions_from(uuid, date, numeric, text) to authenticated;
grant execute on function public.delete_recurring_sessions_from(uuid, date) to authenticated;
