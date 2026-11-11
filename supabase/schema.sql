-- Farm dashboard: one JSON document holds all data. Run once in the Supabase SQL editor.
create table if not exists public.app_state (
  id text primary key,
  data jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

-- Lock the table: with row level security on and no policies, the public (anon) key can read nothing.
-- Only the server, using the service-role key, can reach it.
alter table public.app_state enable row level security;
