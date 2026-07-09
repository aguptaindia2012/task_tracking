-- VoiceTask schema v2. Run this ONCE in the Supabase SQL Editor after the
-- original migration.sql. Adds project timelines, archiving, and SOP templates.
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS).

alter table projects add column if not exists start_date date;
alter table projects add column if not exists end_date date;
alter table projects add column if not exists archived_at timestamptz;

alter table tasks add column if not exists archived_at timestamptz;

create table if not exists templates (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  name text not null,
  tasks jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table templates enable row level security;

drop policy if exists "own rows" on templates;
create policy "own rows" on templates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on templates to authenticated;
