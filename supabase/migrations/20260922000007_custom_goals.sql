-- Custom goals replace the single "Other(s)" row. A tutor can add any number
-- of goals of their own for a student, each with a label, an attained flag
-- and a date. The rows are secured exactly like goal_achievements: the tutor
-- who owns the student reads and writes them, staff read them all.

create table public.custom_goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 500),
  attained boolean not null default false,
  attained_on date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index custom_goals_student_id_idx on public.custom_goals (student_id, sort_order, created_at);
create index custom_goals_tutor_id_idx on public.custom_goals (tutor_id);

create trigger custom_goals_set_updated_at
  before update on public.custom_goals
  for each row execute function public.set_updated_at();

alter table public.custom_goals enable row level security;

create policy "custom_goals: tutor reads own, staff reads all"
  on public.custom_goals for select
  to authenticated
  using (tutor_id = auth.uid() or public.is_staff());

create policy "custom_goals: tutor inserts own"
  on public.custom_goals for insert
  to authenticated
  with check (public.is_tutor() and tutor_id = auth.uid() and public.owns_student(student_id));

create policy "custom_goals: tutor updates own"
  on public.custom_goals for update
  to authenticated
  using (public.is_tutor() and tutor_id = auth.uid())
  with check (public.is_tutor() and tutor_id = auth.uid() and public.owns_student(student_id));

create policy "custom_goals: tutor deletes own"
  on public.custom_goals for delete
  to authenticated
  using (public.is_tutor() and tutor_id = auth.uid());

-- Anything recorded against the old "Other(s)" row becomes a custom goal,
-- then the row itself goes: nothing else refers to it.
insert into public.custom_goals (student_id, tutor_id, label, attained, attained_on, sort_order)
select student_id, tutor_id, btrim(other_text), attained, attained_on, 0
from public.goal_achievements
where goal_id = 'E1' and other_text is not null and char_length(btrim(other_text)) > 0;

delete from public.goal_achievements where goal_id = 'E1';
delete from public.goal_definitions where id = 'E1';
