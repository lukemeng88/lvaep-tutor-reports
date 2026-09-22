-- Demo data for LVAEP Tutor Reports.
-- Safe to run more than once: it removes the demo accounts first and recreates them.
-- Run against the hosted project with `supabase db push --include-seed`
-- (or paste into the SQL editor). Locally, `supabase db reset` runs it automatically.
--
-- Demo accounts (password for all: Demo1234!)
--   staff@lvaep.demo    staff   Dana Rivera
--   tutor1@lvaep.demo   tutor   Maria Alvarez
--   tutor2@lvaep.demo   tutor   James Okafor
--
-- Dates are relative to today so the demo always shows the current fiscal year.

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  demo_password constant text := 'Demo1234!';
  staff_id  uuid := '11111111-1111-4111-8111-111111111111';
  tutor1_id uuid := '22222222-2222-4222-8222-222222222222';
  tutor2_id uuid := '33333333-3333-4333-8333-333333333333';

  rosa_id   uuid := 'aaaaaaaa-0001-4aaa-8aaa-aaaaaaaaaaaa';
  ahmed_id  uuid := 'aaaaaaaa-0002-4aaa-8aaa-aaaaaaaaaaaa';
  li_id     uuid := 'aaaaaaaa-0003-4aaa-8aaa-aaaaaaaaaaaa';
  fatima_id uuid := 'aaaaaaaa-0004-4aaa-8aaa-aaaaaaaaaaaa';
  carlos_id uuid := 'aaaaaaaa-0005-4aaa-8aaa-aaaaaaaaaaaa';

  today date := current_date;
  fy_start date := make_date(public.fiscal_year_of(current_date), 7, 1);
  fy_end date := public.fiscal_year_end(current_date);
  seed_start date := greatest(fy_start, today - 70);
  last_month_first date := date_trunc('month', today)::date - interval '1 month';
  last_month_last date := date_trunc('month', today)::date - 1;

  r record;
  d date;
  rule_id uuid;
  n integer;

  -- (student, weekday 0=Sun..6=Sat, start and end; hours are end minus start)
  schedule constant jsonb := '[
    {"student": "aaaaaaaa-0001-4aaa-8aaa-aaaaaaaaaaaa", "tutor": "22222222-2222-4222-8222-222222222222", "weekday": 1, "start_time": "10:00", "end_time": "11:30"},
    {"student": "aaaaaaaa-0001-4aaa-8aaa-aaaaaaaaaaaa", "tutor": "22222222-2222-4222-8222-222222222222", "weekday": 3, "start_time": "10:00", "end_time": "11:30"},
    {"student": "aaaaaaaa-0002-4aaa-8aaa-aaaaaaaaaaaa", "tutor": "22222222-2222-4222-8222-222222222222", "weekday": 2, "start_time": "18:00", "end_time": "19:00"},
    {"student": "aaaaaaaa-0004-4aaa-8aaa-aaaaaaaaaaaa", "tutor": "33333333-3333-4333-8333-333333333333", "weekday": 4, "start_time": "16:00", "end_time": "18:00"},
    {"student": "aaaaaaaa-0005-4aaa-8aaa-aaaaaaaaaaaa", "tutor": "33333333-3333-4333-8333-333333333333", "weekday": 6, "start_time": "11:00", "end_time": "12:15"}
  ]'::jsonb;
begin
  -- Start clean. Cascades remove profiles, students, sessions, goals and reports.
  delete from auth.users where email in ('staff@lvaep.demo', 'tutor1@lvaep.demo', 'tutor2@lvaep.demo');

  -- Auth users. The on_auth_user_created trigger creates the profile rows.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
    ('00000000-0000-0000-0000-000000000000', staff_id, 'authenticated', 'authenticated', 'staff@lvaep.demo',
      extensions.crypt(demo_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{"full_name":"Dana Rivera","role":"staff"}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', tutor1_id, 'authenticated', 'authenticated', 'tutor1@lvaep.demo',
      extensions.crypt(demo_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{"full_name":"Maria Alvarez","role":"tutor"}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', tutor2_id, 'authenticated', 'authenticated', 'tutor2@lvaep.demo',
      extensions.crypt(demo_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{"full_name":"James Okafor","role":"tutor"}', now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), u.id, u.id::text,
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
         'email', now(), now(), now()
  from auth.users u
  where u.id in (staff_id, tutor1_id, tutor2_id);

  -- Students. Days and times are not typed on a student any more: the
  -- form's Day(s) and Time(s) come from the schedules and sessions below.
  insert into public.students (id, tutor_id, full_name, tutoring_site, is_stopped, stopped_reason, stopped_at) values
    (rosa_id,   tutor1_id, 'Rosa Mendes',  'Bloomfield Public Library', false, null, null),
    (ahmed_id,  tutor1_id, 'Ahmed Khan',   'Montclair Public Library', false, null, null),
    (li_id,     tutor1_id, 'Li Wei',       'Bloomfield Public Library', true, 'Moved out of the area and no longer able to meet.', today - 21),
    (fatima_id, tutor2_id, 'Fatima Noor',  'Bloomfield Public Library', false, null, null),
    (carlos_id, tutor2_id, 'Carlos Ruiz',  'Nutley Public Library', false, null, null);

  -- Recurring schedules, materialized through the end of the fiscal year,
  -- the same way the app does it: every day gets the schedule's start and
  -- end, and hours are the difference in quarter hours.
  for r in select * from jsonb_to_recordset(schedule) as x(student uuid, tutor uuid, weekday integer, start_time time, end_time time)
  loop
    -- first matching weekday on or after seed_start
    d := seed_start + ((r.weekday - extract(dow from seed_start)::integer + 7) % 7);

    insert into public.recurrence_rules (student_id, tutor_id, weekday, start_date, default_hours, start_time, end_time)
    values (r.student, r.tutor, r.weekday, d, round(extract(epoch from (r.end_time - r.start_time)) / 900) / 4, r.start_time, r.end_time)
    returning id into rule_id;

    while d <= fy_end loop
      insert into public.sessions (student_id, tutor_id, session_date, hours, code, recurrence_rule_id, start_time, end_time)
      values (r.student, r.tutor, d, round(extract(epoch from (r.end_time - r.start_time)) / 900) / 4, null, rule_id, r.start_time, r.end_time)
      on conflict (student_id, session_date) do nothing;
      d := d + 7;
    end loop;
  end loop;

  -- A few realistic edits: absences, a holiday and a longer session. Coded
  -- days have no times; a longer day keeps its start and ends later.
  update public.sessions set hours = 0, code = 'SA', start_time = null, end_time = null
    where student_id = rosa_id and session_date = (select min(session_date) from public.sessions where student_id = rosa_id and session_date >= seed_start + 7);
  update public.sessions set hours = 0, code = 'TA', start_time = null, end_time = null
    where student_id = rosa_id and session_date = (select min(session_date) from public.sessions where student_id = rosa_id and session_date >= seed_start + 21);
  update public.sessions set hours = 0, code = 'H', start_time = null, end_time = null
    where student_id = ahmed_id and session_date = (select min(session_date) from public.sessions where student_id = ahmed_id and session_date >= seed_start + 14);
  update public.sessions set hours = 2.5, start_time = '10:00', end_time = '12:30'
    where student_id = rosa_id and session_date = (select max(session_date) from public.sessions where student_id = rosa_id and session_date <= today);
  update public.sessions set hours = 0, code = 'SA', start_time = null, end_time = null
    where student_id = fatima_id and session_date = (select min(session_date) from public.sessions where student_id = fatima_id and session_date >= seed_start + 7);

  -- One extra session outside the schedule.
  insert into public.sessions (student_id, tutor_id, session_date, hours, start_time, end_time, notes)
  values (ahmed_id, tutor1_id, greatest(seed_start, today - 10), 0.75, '17:00', '17:45', 'Extra practice before the citizenship interview.')
  on conflict (student_id, session_date) do update set hours = 0.75, code = null, start_time = '17:00', end_time = '17:45';

  -- The stopped student has a little history and no active schedule.
  n := 0;
  d := seed_start + ((6 - extract(dow from seed_start)::integer + 7) % 7);
  while d <= today - 21 and n < 6 loop
    insert into public.sessions (student_id, tutor_id, session_date, hours, start_time, end_time)
    values (li_id, tutor1_id, d, 1.5, '09:00', '10:30')
    on conflict do nothing;
    d := d + 7;
    n := n + 1;
  end loop;

  -- Goals.
  insert into public.goal_achievements (student_id, tutor_id, goal_id, attained, attained_on, other_text) values
    (rosa_id,   tutor1_id, 'C4', true,  today - 30, null),
    (rosa_id,   tutor1_id, 'C5', true,  today - 12, null),
    (rosa_id,   tutor1_id, 'A1', false, null, null),
    (ahmed_id,  tutor1_id, 'D1', true,  today - 5, null),
    (ahmed_id,  tutor1_id, 'D4', true,  today - 5, null),
    (ahmed_id,  tutor1_id, 'E1', true,  today - 8, 'Passed the driver''s license written test'),
    (fatima_id, tutor2_id, 'C6', true,  today - 20, null),
    (carlos_id, tutor2_id, 'A2', true,  today - 40, null);

  -- Submitted reports for last month (only when last month is inside this fiscal year).
  if last_month_first >= fy_start then
    insert into public.monthly_reports (student_id, tutor_id, fiscal_year, month, version, submitted_at, snapshot)
    select
      s.id, s.tutor_id,
      public.fiscal_year_of(last_month_first),
      extract(month from last_month_first)::integer,
      1,
      last_month_last + interval '1 day' + interval '9 hours',
      jsonb_build_object(
        'tutor_name', p.full_name,
        'student_name', s.full_name,
        'tutoring_site', s.tutoring_site,
        'default_days', s.default_days,
        'default_times', s.default_times,
        'fiscal_year', public.fiscal_year_of(last_month_first),
        'month', extract(month from last_month_first)::integer,
        'sessions', coalesce((
          select jsonb_agg(jsonb_build_object('date', to_char(x.session_date, 'YYYY-MM-DD'), 'hours', x.hours, 'code', x.code) order by x.session_date)
          from public.sessions x
          where x.student_id = s.id and x.session_date between last_month_first and last_month_last
        ), '[]'::jsonb),
        'total_hours', coalesce((
          select sum(x.hours) from public.sessions x
          where x.student_id = s.id and x.session_date between last_month_first and last_month_last
        ), 0),
        'is_stopped', s.is_stopped,
        'stopped_reason', s.stopped_reason,
        'goals', coalesce((
          select jsonb_agg(jsonb_build_object('goal_id', g.goal_id, 'attained', g.attained, 'attained_on', to_char(g.attained_on, 'YYYY-MM-DD'), 'other_text', g.other_text) order by g.goal_id)
          from public.goal_achievements g where g.student_id = s.id
        ), '[]'::jsonb)
      )
    from public.students s
    join public.profiles p on p.id = s.tutor_id
    where s.id in (rosa_id, ahmed_id, fatima_id)
      and exists (select 1 from public.sessions x where x.student_id = s.id and x.session_date between last_month_first and last_month_last);
  end if;
end $$;
