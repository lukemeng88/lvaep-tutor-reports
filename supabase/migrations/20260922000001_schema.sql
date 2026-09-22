-- LVAEP Tutor Reports: core schema.
-- Apply with `supabase db push` or paste into the Supabase SQL editor.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- Fiscal year runs July 1 through June 30. The fiscal year is named after the
-- calendar year in which it starts: months 7-12 belong to that year, months
-- 1-6 belong to the previous year. Matches fiscalYearOf() in src/lib/fiscal-year.ts.
create or replace function public.fiscal_year_of(d date)
returns integer
language sql
immutable
as $$
  select case
    when extract(month from d) >= 7 then extract(year from d)::integer
    else extract(year from d)::integer - 1
  end;
$$;

create or replace function public.fiscal_year_end(d date)
returns date
language sql
immutable
as $$
  select make_date(public.fiscal_year_of(d) + 1, 6, 30);
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null check (role in ('tutor', 'staff')),
  created_at timestamptz not null default now()
);

-- Reads the signed-in user's role. SECURITY DEFINER so it can be used inside
-- RLS policies on profiles without recursion.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'staff'
  );
$$;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated, anon, service_role;

-- Create the profile row when a user signs up. The sign up form stores
-- full_name and role in the user's metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data ->> 'role', 'tutor');
begin
  if requested_role not in ('tutor', 'staff') then
    requested_role := 'tutor';
  end if;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    requested_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Generic updated_at maintenance.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------

create table public.students (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  full_name text not null,
  tutoring_site text not null,
  default_days text,
  default_times text,
  is_stopped boolean not null default false,
  stopped_reason text,
  stopped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index students_tutor_id_idx on public.students (tutor_id);

create trigger students_set_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- recurrence_rules
-- ---------------------------------------------------------------------------

create table public.recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  start_date date not null,
  end_date date,
  default_hours numeric(4, 2) not null default 1
    check (default_hours >= 0 and default_hours <= 12 and default_hours = round(default_hours * 4) / 4),
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create index recurrence_rules_student_id_idx on public.recurrence_rules (student_id);
create index recurrence_rules_tutor_id_idx on public.recurrence_rules (tutor_id);

-- end_date defaults to the end of the fiscal year that contains start_date.
create or replace function public.recurrence_rule_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.end_date is null then
    new.end_date := public.fiscal_year_end(new.start_date);
  end if;
  return new;
end;
$$;

create trigger recurrence_rules_defaults
  before insert on public.recurrence_rules
  for each row execute function public.recurrence_rule_defaults();

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  session_date date not null,
  hours numeric(4, 2) not null default 0
    check (hours >= 0 and hours <= 12 and hours = round(hours * 4) / 4),
  code text check (code in ('TA', 'SA', 'H')),
  recurrence_rule_id uuid references public.recurrence_rules (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, session_date),
  -- Hours and absence/holiday codes are mutually exclusive.
  check (code is null or hours = 0)
);

create index sessions_student_id_idx on public.sessions (student_id);
create index sessions_tutor_id_idx on public.sessions (tutor_id);
create index sessions_recurrence_rule_id_idx on public.sessions (recurrence_rule_id);
create index sessions_student_date_idx on public.sessions (student_id, session_date);

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- goal_definitions and goal_achievements
-- ---------------------------------------------------------------------------

create table public.goal_definitions (
  id text primary key,
  category text not null check (category in ('A', 'B', 'C', 'D', 'E')),
  category_label text not null,
  number integer not null,
  label text not null,
  starred boolean not null default false
);

create table public.goal_achievements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  goal_id text not null references public.goal_definitions (id),
  attained boolean not null default false,
  attained_on date,
  other_text text,
  updated_at timestamptz not null default now(),
  unique (student_id, goal_id)
);

create index goal_achievements_student_id_idx on public.goal_achievements (student_id);
create index goal_achievements_tutor_id_idx on public.goal_achievements (tutor_id);
create index goal_achievements_goal_id_idx on public.goal_achievements (goal_id);

create trigger goal_achievements_set_updated_at
  before update on public.goal_achievements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- monthly_reports
-- ---------------------------------------------------------------------------

create table public.monthly_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  fiscal_year integer not null,
  month integer not null check (month between 1 and 12),
  version integer not null check (version >= 1),
  submitted_at timestamptz not null default now(),
  snapshot jsonb not null,
  unique (student_id, fiscal_year, month, version)
);

create index monthly_reports_student_id_idx on public.monthly_reports (student_id);
create index monthly_reports_tutor_id_idx on public.monthly_reports (tutor_id);
create index monthly_reports_submitted_at_idx on public.monthly_reports (submitted_at);
