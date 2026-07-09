create table public.keepalive_pings (
  id bigint primary key generated always as identity,
  pinged_at timestamptz not null default now()
);

alter table public.keepalive_pings enable row level security;
alter table public.keepalive_pings force row level security;

revoke all on table public.keepalive_pings from anon, authenticated;
