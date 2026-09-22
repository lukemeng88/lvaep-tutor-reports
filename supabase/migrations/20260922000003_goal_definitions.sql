-- Program goal list, copied verbatim from the paper form. Starred goals are
-- the ones the program specifically tracks.

insert into public.goal_definitions (id, category, category_label, number, label, starred) values
  ('A1', 'A', 'Economic', 1, '*Enter Employment', true),
  ('A2', 'A', 'Economic', 2, '*Retain Employment', true),
  ('A3', 'A', 'Economic', 3, 'Leave public assistance', false),

  ('B1', 'B', 'Educational', 1, 'Achieve work-based project learner goal', false),
  ('B2', 'B', 'Educational', 2, '*Enter Occupational Skills Training Program', true),
  ('B3', 'B', 'Educational', 3, '*Enter Postsecondary Education', true),
  ('B4', 'B', 'Educational', 4, '*Obtain High School Diploma', true),

  ('C1', 'C', 'Family', 1, 'Help more frequently with school', false),
  ('C2', 'C', 'Family', 2, 'Increase contact with child(ren)''s teachers', false),
  ('C3', 'C', 'Family', 3, 'More involvement in child(ren)''s school activities', false),
  ('C4', 'C', 'Family', 4, 'Purchase books or magazines', false),
  ('C5', 'C', 'Family', 5, 'Read to child(ren)', false),
  ('C6', 'C', 'Family', 6, 'Visit the library (with/for child(ren))', false),

  ('D1', 'D', 'Societal/Community', 1, '*Obtain citizenship', true),
  ('D2', 'D', 'Societal/Community', 2, 'Achieve civics skills', false),
  ('D3', 'D', 'Societal/Community', 3, 'Increase involvement in community activities', false),
  ('D4', 'D', 'Societal/Community', 4, 'Vote or register to vote', false),

  ('E1', 'E', 'Other(s)', 1, 'Other(s)', false)
on conflict (id) do update set
  category = excluded.category,
  category_label = excluded.category_label,
  number = excluded.number,
  label = excluded.label,
  starred = excluded.starred;
