-- Staff are read-only over tutor data. The first RLS pass only checked
-- tutor_id = auth.uid(), which let a staff account create rows under its own
-- id. Every write policy now also requires the tutor role.

create or replace function public.is_tutor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'tutor'
  );
$$;

revoke all on function public.is_tutor() from public;
grant execute on function public.is_tutor() to authenticated, anon, service_role;

-- students ------------------------------------------------------------------

drop policy if exists "students: tutor inserts own" on public.students;
drop policy if exists "students: tutor updates own" on public.students;
drop policy if exists "students: tutor deletes own" on public.students;

create policy "students: tutor inserts own"
  on public.students for insert
  to authenticated
  with check (public.is_tutor() and tutor_id = auth.uid());

create policy "students: tutor updates own"
  on public.students for update
  to authenticated
  using (public.is_tutor() and tutor_id = auth.uid())
  with check (public.is_tutor() and tutor_id = auth.uid());

create policy "students: tutor deletes own"
  on public.students for delete
  to authenticated
  using (public.is_tutor() and tutor_id = auth.uid());

-- recurrence_rules ----------------------------------------------------------

drop policy if exists "recurrence_rules: tutor inserts own" on public.recurrence_rules;
drop policy if exists "recurrence_rules: tutor updates own" on public.recurrence_rules;
drop policy if exists "recurrence_rules: tutor deletes own" on public.recurrence_rules;

create policy "recurrence_rules: tutor inserts own"
  on public.recurrence_rules for insert
  to authenticated
  with check (public.is_tutor() and tutor_id = auth.uid() and public.owns_student(student_id));

create policy "recurrence_rules: tutor updates own"
  on public.recurrence_rules for update
  to authenticated
  using (public.is_tutor() and tutor_id = auth.uid())
  with check (public.is_tutor() and tutor_id = auth.uid() and public.owns_student(student_id));

create policy "recurrence_rules: tutor deletes own"
  on public.recurrence_rules for delete
  to authenticated
  using (public.is_tutor() and tutor_id = auth.uid());

-- sessions ------------------------------------------------------------------

drop policy if exists "sessions: tutor inserts own" on public.sessions;
drop policy if exists "sessions: tutor updates own" on public.sessions;
drop policy if exists "sessions: tutor deletes own" on public.sessions;

create policy "sessions: tutor inserts own"
  on public.sessions for insert
  to authenticated
  with check (public.is_tutor() and tutor_id = auth.uid() and public.owns_student(student_id));

create policy "sessions: tutor updates own"
  on public.sessions for update
  to authenticated
  using (public.is_tutor() and tutor_id = auth.uid())
  with check (public.is_tutor() and tutor_id = auth.uid() and public.owns_student(student_id));

create policy "sessions: tutor deletes own"
  on public.sessions for delete
  to authenticated
  using (public.is_tutor() and tutor_id = auth.uid());

-- goal_achievements ---------------------------------------------------------

drop policy if exists "goal_achievements: tutor inserts own" on public.goal_achievements;
drop policy if exists "goal_achievements: tutor updates own" on public.goal_achievements;
drop policy if exists "goal_achievements: tutor deletes own" on public.goal_achievements;

create policy "goal_achievements: tutor inserts own"
  on public.goal_achievements for insert
  to authenticated
  with check (public.is_tutor() and tutor_id = auth.uid() and public.owns_student(student_id));

create policy "goal_achievements: tutor updates own"
  on public.goal_achievements for update
  to authenticated
  using (public.is_tutor() and tutor_id = auth.uid())
  with check (public.is_tutor() and tutor_id = auth.uid() and public.owns_student(student_id));

create policy "goal_achievements: tutor deletes own"
  on public.goal_achievements for delete
  to authenticated
  using (public.is_tutor() and tutor_id = auth.uid());

-- monthly_reports -----------------------------------------------------------

drop policy if exists "monthly_reports: tutor inserts own" on public.monthly_reports;

create policy "monthly_reports: tutor inserts own"
  on public.monthly_reports for insert
  to authenticated
  with check (public.is_tutor() and tutor_id = auth.uid() and public.owns_student(student_id));
