# Build: LVAEP Tutor Session Reporting App

You are implementing a full web application from scratch in this empty repository. Read this entire brief before writing any code. Work in phases (listed at the end), commit after each phase with a clear message, and keep going until every phase is done and verified. Do not stop to ask questions unless something below is truly contradictory; where a detail is unspecified, make a sensible choice and record it in the README under "Assumptions and decisions."

## 1. Context

Literacy Volunteers of America, Essex/Passaic County (LVAEP) runs a tutoring program. Tutors are assigned adult learners ("students") and meet with them over a fiscal year (July through June). Tutors must record every session (date, student, hours) and staff need those records collected into monthly reports.

Today this is done with a paper/PDF form, one form per student, containing:

- Header fields: Tutor, Student, Tutoring Site, Day(s), Time(s)
- A 31-row by 12-column attendance grid (days 1-31 down, months Jul through Jun across, fiscal year 2026-2027) where the tutor writes hours tutored in each cell, plus a Total. Internal codes: TA = Tutor Absent, SA = Student Absent, H = Holiday.
- A STOPPED checkbox ("Please place a check in the box if your student is no longer being tutored and notify the office ASAP") with a Reason line.
- An ACHIEVEMENTS section ("Place a check next to each student's goal when attained") with these categories and goals, keep the exact wording and asterisks:
  - A. Economic: 1. *Enter Employment; 2. *Retain Employment; 3. Leave public assistance
  - B. Educational: 1. Achieve work-based project learner goal; 2. *Enter Occupational Skills Training Program; 3. *Enter Postsecondary Education; 4. *Obtain High School Diploma
  - C. Family: 1. Help more frequently with school; 2. Increase contact with child(ren)'s teachers; 3. More involvement in child(ren)'s school activities; 4. Purchase books or magazines; 5. Read to child(ren); 6. Visit the library (with/for child(ren))
  - D. Societal/Community: 1. *Obtain citizenship; 2. Achieve civics skills; 3. Increase involvement in community activities; 4. Vote or register to vote
  - E. Other(s): free text
- Contact information: LVAEP, Bloomfield Public Library, 90 Broad Street, Bloomfield, NJ 07003, info@lvaep.org, (973) 566-6200 x216
- A footer note: "Please consider adding extra time to all meetings, coordinating an extra session whenever possible, and regularly assigning homework (give your students credit for all completed work.)"

Problems with the current workflow that this app must fix:

- One separate form per student is inconvenient for tutors. A tutor should have one account that holds all their students.
- STOPPED as a checkbox is awkward. Instead, "Mark as stopped" is an action on an existing student that asks for a reason.
- Entering dates one by one into a 31x12 grid is tedious. Replace it with a calendar: add a tutoring day, make it recurring, edit hours, and mark TA/SA/H by color.
- Seeing every goal on one page is overwhelming for tutors. Use collapsible sections (one per category) instead.
- Staff currently receive piles of individual files. Staff need to pick a tutor, pick a student, and see that student's full record in one place.

## 2. Stack and conventions

- Next.js (latest stable, App Router, TypeScript, `src/` directory)
- Supabase: Auth (email + password only, no OAuth), Postgres, Row Level Security. Use `@supabase/ssr` with server and browser clients, and middleware that refreshes the session.
- Tailwind CSS. You may add shadcn/ui for primitives (button, dialog, select, tabs, toast, collapsible). Keep the look clean and neutral: white/gray backgrounds, one blue accent, consistent heading font.
- Deployable to Vercel with no changes. Read all config from environment variables. Ship `.env.example`.
- Supabase schema lives in `supabase/migrations/*.sql` so it can be applied with the Supabase CLI or pasted into the SQL editor. Include a `supabase/seed.sql` with one staff user, two tutor users, and a handful of students, sessions, and goals so the app can be demoed immediately (document the seed credentials in the README).
- Style rules for user-facing copy: plain, non-technical language. No em dashes anywhere in copy or code comments. No arrows on buttons. Every destructive or irreversible action gets a confirmation dialog.
- Every page has a persistent top nav (app name, links appropriate to the role, the signed-in user's name, sign out) and breadcrumbs on nested pages so the user can always get back to Home.

## 3. Roles and auth

Two roles: `tutor` and `staff`. The role is chosen on the sign up form (radio: "I am a tutor" / "I am staff"). Store it in a `profiles` table keyed by `auth.users.id` with `full_name`, `role`, `created_at`. Create the profile row via a Postgres trigger on `auth.users` insert that reads `role` and `full_name` from `raw_user_meta_data`.

Pages: `/login`, `/signup`. Email confirmation: disable it in the Supabase project for the demo and say so in the README. After sign in, route by role: tutors go to `/home`, staff go to `/staff`. Unauthenticated users hitting any app route are redirected to `/login`. A tutor hitting `/staff` or a staff user hitting tutor-only routes is redirected to their own home.

Enforce roles in RLS, not only in the UI:

- Tutors can select/insert/update/delete only rows where `tutor_id = auth.uid()` (students, sessions, recurrence rules, goal achievements, reports).
- Staff can select everything, and cannot insert/update/delete tutor data except where noted (none for now).
- Use a `is_staff()` SQL helper that reads `profiles.role`.

## 4. Data model

Use these tables (add indexes on foreign keys and on `(student_id, session_date)`):

- `profiles`: id (uuid, pk, references auth.users), full_name text, role text check in ('tutor','staff'), created_at
- `students`: id uuid pk, tutor_id uuid references profiles, full_name text, tutoring_site text, default_days text (free text, e.g. "Mon, Wed"), default_times text (free text), is_stopped bool default false, stopped_reason text, stopped_at timestamptz, created_at, updated_at
- `recurrence_rules`: id uuid pk, student_id, tutor_id, weekday int (0-6), start_date date, end_date date (defaults to the end of the fiscal year containing start_date), default_hours numeric(4,2), created_at
- `sessions`: id uuid pk, student_id, tutor_id, session_date date, hours numeric(4,2) default 0 check (hours >= 0 and hours <= 12 and hours = round(hours*4)/4), code text null check in ('TA','SA','H'), recurrence_rule_id uuid null, notes text null, created_at, updated_at, unique (student_id, session_date)
- `goal_definitions`: id text pk (e.g. 'A1', 'B3'), category text ('A'..'E'), category_label text, number int, label text, starred bool. Seed all rows from section 1 exactly.
- `goal_achievements`: id uuid pk, student_id, tutor_id, goal_id text references goal_definitions, attained bool default false, attained_on date null, other_text text null (only used for E), updated_at, unique (student_id, goal_id)
- `monthly_reports`: id uuid pk, student_id, tutor_id, fiscal_year int (the year the FY starts, e.g. 2026), month int (1-12), version int, submitted_at timestamptz, snapshot jsonb, unique (student_id, fiscal_year, month, version)

Rules:

- Fiscal year is derived from a date: months 7-12 belong to FY of that year, months 1-6 belong to FY of the previous year. Put a `fiscal_year_of(date)` SQL function and a matching TS helper in one place. Nothing is hardcoded to 2026-2027.
- Hours and codes are mutually exclusive on a session. Setting a code (TA/SA/H) sets hours to 0. Setting hours greater than 0 clears the code. Enforce with a check constraint: `code is null or hours = 0`.
- Hours granularity is 0.25, max 12 per day.
- A student with `is_stopped = true` still keeps all history, and can be reactivated.

## 5. Tutor experience

### 5.1 Home (`/home`)

- Heading with the tutor's name and a "Total hours" summary card (see 5.5).
- "Add student" button opens a dialog: full name (required), tutoring site (required), usual days (optional), usual times (optional).
- Active students list: card or row per student showing name, site, hours this month, hours this fiscal year, number of goals attained, and a "next session" hint if one exists. Actions per student: Edit, Submit report, Mark as stopped.
- Stopped students appear below in a greyed-out "Stopped students" section showing the reason and date, with a "Reactivate" action. They still open in read-only-ish detail (editing allowed, but show a banner that the student is marked stopped).
- "Mark as stopped" opens a dialog requiring a reason, and reminds the tutor to notify the office (show the office email and phone in the dialog).

### 5.2 Student detail (`/students/[id]`)

Tabs across the top: "Tutoring days" and "Goals". Both tabs auto-save on change (optimistic update, debounced writes for text fields, a small "Saved" indicator; on failure show a toast and revert). Header shows student name, site, default days/times (inline editable), and buttons for Submit report and Mark as stopped. Breadcrumb: Home / Student name.

### 5.3 Tutoring days tab (calendar)

A month-view calendar in the style of Google Calendar, scoped to the fiscal year (you can page from July to June of the current FY; also allow moving to other FYs with a small selector so past years remain viewable).

- Click an empty day: popover to add a session with hours (number input, 0.25 steps, default 1) and an optional "Repeat weekly" toggle. When repeating, the rule creates a `recurrence_rules` row and materializes a `sessions` row for every matching weekday from that date through the end of the fiscal year (skip dates that already have a session). Materialize in one server action / transaction.
- Click an existing session: popover shows hours, the code selector (None / Tutor absent / Student absent / Holiday), and Delete. If the session belongs to a recurrence, editing offers "This day only" or "This and future days" (future edit updates all sessions with that rule id on or after the date, and updates the rule's default_hours; deleting future sets the rule's end_date to the day before and deletes those rows).
- Day cells are color coded: sessions with hours in blue with the hours shown, TA in orange, SA in yellow, H in gray. A legend sits above the calendar. Today is outlined.
- A summary strip above the calendar shows hours for the visible month and hours for the fiscal year.
- Keep the whole tab keyboard accessible and usable on a narrow screen (cells can shrink, popovers become bottom sheets on mobile).

### 5.4 Goals tab

One collapsible section per category (A. Economic, B. Educational, C. Family, D. Societal/Community, E. Other(s)). Each goal is a row with the exact label from section 1, a checkbox for "Attained", and a date picker that appears when checked (defaults to today). Category E has a free-text field plus the attained checkbox. Section headers show "2 of 4 attained". Keep the asterisks in the labels and show a small note explaining that starred goals are the ones the program specifically tracks (the tutor does not need to do anything different). Auto-save each change.

### 5.5 Total hours

- Home shows a card with total hours this month, total hours this fiscal year, and total hours all time, across all of the tutor's students.
- A `/hours` page (linked from the card) shows: a bar chart of hours per month for the current fiscal year, a table of hours per student per month, and a running total. Use a light-weight chart library (recharts is fine). Only sessions with hours count; TA/SA/H count as 0.

### 5.6 Submit report

Button on the home row and on the student header. Flow:

1. Dialog asks for the month to submit. Default to the most recent month that has sessions but no submission; list all FY months with a badge showing "Submitted" (and version) or "Not submitted".
2. Validation runs before showing the confirm step. Required: student full name, tutoring site, tutor full name on profile, and at least one session (with hours or a code) in that month. If the student is marked stopped, a reason is required. Goal rows are never required. If validation fails, list exactly what is missing with a link to fix it; do not submit.
3. Confirm step: "Are you sure you want to submit the report for [Student], [Month Year]? Staff will be able to see it. You can resubmit later if something changes." Buttons: Cancel / Submit.
4. On submit, write a `monthly_reports` row with version = previous max + 1 and a JSON snapshot containing: tutor name, student name, site, days, times, fiscal year, month, every session in that month (date, hours, code), month total hours, the stopped flag and reason, and the full goal achievement state at that moment. Show a success toast. The live data stays editable afterward; resubmitting creates a new version.

## 6. Staff experience

### 6.1 Staff home (`/staff`)

- Left: list of tutors (search box, count of active students each). Selecting a tutor shows their students in the middle (active and stopped, with stopped greyed). Selecting a student opens the record on the right / on its own page `/staff/students/[id]`. On narrow screens this becomes a drill-down.
- Top summary: total submitted reports this month, tutors who have students with no submission for last month (a simple "missing reports" list, since that is the main thing staff chase).

### 6.2 Student record (`/staff/students/[id]`)

Render the full-year form, laid out like the original document, assembled from submitted reports:

- Header: Tutor, Student, Tutoring Site, Day(s), Time(s), fiscal year selector.
- The 31 x 12 grid. For each month, cells come from that month's latest submitted snapshot. Show hours, or the code letters (TA/SA/H) with the same colors as the tutor calendar. Months with no submission render blank with a light "Not submitted" watermark in the column header. Column totals and the grand Total row.
- STOPPED status and reason.
- ACHIEVEMENTS with every category and goal, check marks and attained dates, from the latest snapshot.
- Contact information block and the footer note, exactly as in the original.
- Actions: "Print / Save as PDF" (use a print stylesheet so it fits on one letter page in portrait; hide nav and buttons), "Download CSV" of all sessions for the FY, and a "Submission history" panel listing every version per month with timestamps and the ability to view an older version.
- Staff can also open a "Live view" toggle that shows current unsubmitted data for the calendar grid, clearly labeled as not yet submitted, so staff can see progress before month end.

## 7. Quality bar

- TypeScript strict, no `any` in app code. Zod validation on every server action input.
- All data access through server actions or route handlers using the server Supabase client; the browser client is used only for auth and optimistic reads where needed.
- Loading and empty states on every list. Error states with a retry.
- Add Vitest unit tests for: fiscal year helper, recurrence materialization (correct dates, skips duplicates, stops at FY end), hours/code exclusivity, report validation, and snapshot totals. Add one Playwright smoke test: sign up as tutor, add student, add recurring session, submit a report, sign in as staff, see it in the record.
- `npm run lint`, `npm run typecheck`, `npm run test` must all pass. Run them before your final commit.
- README must include: what the app does, how to run it locally (Supabase project setup, env vars, migrations, seed, disabling email confirmation), demo accounts, a short architecture overview (folder layout, data model diagram in Mermaid, RLS summary), the "Assumptions and decisions" list, and "What I would do next." Write it so a reviewer with no context can run and evaluate it in ten minutes.

## 8. Assumptions to record in the README (and follow)

- The original form is submitted monthly per student; the year grid exists so the same sheet accumulates. The app mirrors that: tutors submit per student per month, staff see the assembled year.
- Fiscal year runs July 1 through June 30.
- Only hours tutored matter; there is no notion of lateness or partial credit beyond hours.
- TA/SA/H days always count as 0 hours.
- Goal wording, asterisks, contact info, and footer note are program-provided and copied verbatim.
- Submitting a report does not lock data; each submission is a versioned snapshot.
- Stopped students remain visible (greyed) and can be reactivated; history is never deleted.
- Staff are read-only over tutor data.
- No email confirmation and no OAuth, to keep the demo frictionless.

## 9. Phases (commit after each)

1. Project scaffold, Tailwind, shadcn, Supabase clients, middleware, env example, lint/typecheck/test scripts.
2. Migrations: tables, constraints, functions (`fiscal_year_of`, `is_staff`), profile trigger, RLS policies, goal_definitions seed, seed.sql.
3. Auth pages, role routing, nav shell, breadcrumbs.
4. Tutor home: add/edit/stop/reactivate students, list with per-student stats.
5. Student detail shell with tabs and auto-save plumbing; Goals tab.
6. Calendar tab: month view, add/edit/delete sessions, recurrence with this-only / this-and-future, codes and colors, summary strip.
7. Total hours card and `/hours` page with chart.
8. Submit report flow: month picker, validation, confirm, snapshot, versions.
9. Staff home, student record page with year grid, print stylesheet, CSV, submission history, live view toggle.
10. Tests, README, final lint/typecheck/test pass, polish (empty states, mobile, focus states).

Begin with phase 1 now.
