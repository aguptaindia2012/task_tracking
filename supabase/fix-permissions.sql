-- Run this ONCE in the Supabase SQL Editor if you see "Sync error" in the app.
-- Enabling RLS is not enough: the logged-in role also needs table privileges.
-- Row Level Security still restricts every row to its owner (auth.uid() = user_id).

grant usage on schema public to authenticated, anon;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Apply the same grants automatically to any tables added later.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
