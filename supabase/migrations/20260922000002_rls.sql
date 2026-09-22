-- Row Level Security.
-- Tutors: full access to their own rows (tutor_id = auth.uid()).
-- Staff: read everything, write nothing.
-- Everyone signed in: read goal_definitions.

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.recurrence_rules enable row level security;
alter table public.sessions enable row level security;
alter table public.goal_definitions enable row level security;
alter table public.goal_achievements enable row level security;
alter table public.monthly_reports enable row level security;

-- profiles ------------------------------------------------------------------

create policy "profiles: read own or staff reads all"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_staff());

create policy "profiles: update own name"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));

-- Inserts happen only through the auth trigger (security definer), so no insert policy.

-- students ------------------------------------------------------------------

create policy "students: tutor reads own, staff reads all"
  on public.students for select
  to authenticated
  using (tutor_id = auth.uid() or public.is_staff());

create policy "students: tutor inserts own"
  on public.students for insert
  to authenticated
  with check (tutor_id = auth.uid());

create policy "students: tutor updates own"
  on public.students for update
  to authenticated
  using (tutor_id = auth.uid())
  with check (tutor_id = auth.uid());

create policy "students: tutor deletes own"
  on public.students for delete
  to authenticated
  using (tutor_id = auth.uid());

-- A helper used by the child tables: the student must belong to the caller.
create or replace function public.owns_student(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.students s
    where s.id = sid and s.tutor_id = auth.uid()
  );
$$;

revoke all on function public.owns_student(uuid) from public;
grant execute on function public.owns_student(uuid) to authenticated, service_role;

-- recurrence_rules ----------------------------------------------------------

create policy "recurrence_rules: tutor reads own, staff reads all"
  on public.recurrence_rules for select
  to authenticated
  using (tutor_id = auth.uid() or public.is_staff());

create policy "recurrence_rules: tutor inserts own"
  on public.recurrence_rules for insert
  to authenticated
  with check (tutor_id = auth.uid() and public.owns_student(student_id));

create policy "recurrence_rules: tutor updates own"
  on public.recurrence_rules for update
  to authenticated
  using (tutor_id = auth.uid())
  with check (tutor_id = auth.uid() and public.owns_student(student_id));

create policy "recurrence_rules: tutor deletes own"
  on public.recurrence_rules for delete
  to authenticated
  using (tutor_id = auth.uid());

-- sessions ------------------------------------------------------------------

create policy "sessions: tutor reads own, staff reads all"
  on public.sessions for select
  to authenticated
  using (tutor_id = auth.uid() or public.is_staff());

create policy "sessions: tutor inserts own"
  on public.sessions for insert
  to authenticated
  with check (tutor_id = auth.uid() and public.owns_student(student_id));

create policy "sessions: tutor updates own"
  on public.sessions for update
  to authenticated
  using (tutor_id = auth.uid())
  with check (tutor_id = auth.uid() and public.owns_student(student_id));

create policy "sessions: tutor deletes own"
  on public.sessions for delete
  to authenticated
  using (tutor_id = auth.uid());

-- goal_definitions ----------------------------------------------------------

create policy "goal_definitions: anyone signed in reads"
  on public.goal_definitions for select
  to authenticated
  using (true);

-- goal_achievements ---------------------------------------------------------

create policy "goal_achievements: tutor reads own, staff reads all"
  on public.goal_achievements for select
  to authenticated
  using (tutor_id = auth.uid() or public.is_staff());

create policy "goal_achievements: tutor inserts own"
  on public.goal_achievements for insert
  to authenticated
  with check (tutor_id = auth.uid() and public.owns_student(student_id));

create policy "goal_achievements: tutor updates own"
  on public.goal_achievements for update
  to authenticated
  using (tutor_id = auth.uid())
  with check (tutor_id = auth.uid() and public.owns_student(student_id));

create policy "goal_achievements: tutor deletes own"
  on public.goal_achievements for delete
  to authenticated
  using (tutor_id = auth.uid());

-- monthly_reports -----------------------------------------------------------

create policy "monthly_reports: tutor reads own, staff reads all"
  on public.monthly_reports for select
  to authenticated
  using (tutor_id = auth.uid() or public.is_staff());

create policy "monthly_reports: tutor inserts own"
  on public.monthly_reports for insert
  to authenticated
  with check (tutor_id = auth.uid() and public.owns_student(student_id));

-- Reports are versioned snapshots: no update or delete for anyone.
