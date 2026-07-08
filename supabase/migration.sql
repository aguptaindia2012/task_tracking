-- VoiceTask schema. Run this once in the Supabase SQL Editor.
-- Every table is scoped to the logged-in user via Row Level Security,
-- so even with the public anon key, nobody but you can read or write your rows.

create table projects (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  name text not null,
  color text not null default '#6366f1',
  created_at timestamptz not null default now()
);

create table contacts (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  title text not null,
  description text not null default '',
  project_id uuid references projects (id) on delete set null,
  contact_id uuid references contacts (id) on delete set null,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  position double precision not null default 0,
  start_date date,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table notes (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  content text not null,
  project_id uuid references projects (id) on delete set null,
  source text not null default 'typed' check (source in ('voice', 'typed')),
  created_at timestamptz not null default now()
);

create table activity_log (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  task_id uuid not null references tasks (id) on delete cascade,
  action text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table projects enable row level security;
alter table contacts enable row level security;
alter table tasks enable row level security;
alter table notes enable row level security;
alter table activity_log enable row level security;

create policy "own rows" on projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on contacts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on activity_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index tasks_user_idx on tasks (user_id);
create index notes_user_idx on notes (user_id);
create index activity_task_idx on activity_log (task_id);
