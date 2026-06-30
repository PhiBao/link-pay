create extension if not exists pgcrypto;

create type public.payment_request_status as enum (
  'open',
  'processing',
  'submitted',
  'paid',
  'expired',
  'cancelled'
);

create type public.payment_status as enum (
  'submitted',
  'confirmed',
  'failed'
);

create type public.notification_status as enum (
  'pending',
  'sent',
  'skipped',
  'failed'
);

create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  version integer not null default 1,
  kind text not null check (kind = 'linkpay.payment-request'),
  request_hash text not null unique,
  payload jsonb not null,
  signature text not null,
  amount numeric(18, 2) not null check (amount > 0),
  memo text not null default '',
  recipient_address text not null,
  recipient_address_lc text generated always as (lower(recipient_address)) stored,
  recipient_label text not null,
  recipient_email text,
  chain_id integer not null,
  token_address text not null,
  token_symbol text not null check (token_symbol = 'USDC'),
  status public.payment_request_status not null default 'open',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  processing_started_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  last_payment_id uuid,
  updated_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.payment_requests(id) on delete cascade,
  amount numeric(18, 2) not null check (amount > 0),
  payer_address text,
  payer_address_lc text generated always as (lower(coalesce(payer_address, ''))) stored,
  payer_email text,
  transaction_id text not null,
  transaction_hash text,
  status public.payment_status not null default 'submitted',
  failure_reason text,
  raw_result jsonb,
  submitted_at timestamptz not null default now(),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.payment_requests(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  recipient_email text,
  recipient_address text not null,
  channel text not null default 'email',
  status public.notification_status not null default 'pending',
  subject text,
  message text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_requests
  add constraint payment_requests_last_payment_fk
  foreign key (last_payment_id) references public.payments(id) on delete set null;

create index payment_requests_recipient_idx on public.payment_requests(recipient_address_lc, created_at desc);
create index payment_requests_status_idx on public.payment_requests(status, expires_at);
create index payments_request_idx on public.payments(request_id, created_at desc);
create index payments_payer_idx on public.payments(payer_address_lc, created_at desc);
create unique index payments_transaction_hash_unique
  on public.payments(transaction_hash)
  where transaction_hash is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger payment_requests_set_updated_at
before update on public.payment_requests
for each row execute function public.set_updated_at();

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create trigger notifications_set_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

create or replace function public.claim_payment_request(p_request_id uuid)
returns public.payment_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.payment_requests;
begin
  update public.payment_requests
  set
    status = 'processing',
    processing_started_at = now()
  where id = p_request_id
    and expires_at > now()
    and (
      status = 'open'
      or (
        status = 'processing'
        and processing_started_at < now() - interval '10 minutes'
      )
    )
  returning * into claimed;

  if claimed.id is not null then
    return claimed;
  end if;

  select * into claimed
  from public.payment_requests
  where id = p_request_id;

  return claimed;
end;
$$;

create or replace function public.record_payment_submission(
  p_request_id uuid,
  p_amount numeric,
  p_payer_address text,
  p_payer_email text,
  p_transaction_id text,
  p_transaction_hash text,
  p_raw_result jsonb default '{}'::jsonb
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  target_request public.payment_requests;
  existing_payment public.payments;
  created_payment public.payments;
begin
  select *
  into target_request
  from public.payment_requests
  where id = p_request_id
  for update;

  if target_request.id is null then
    raise exception 'payment request not found';
  end if;

  select *
  into existing_payment
  from public.payments
  where request_id = p_request_id
    and transaction_id = p_transaction_id
  limit 1;

  if existing_payment.id is not null then
    return existing_payment;
  end if;

  if target_request.status = 'paid' then
    raise exception 'payment request already paid';
  end if;

  if target_request.status not in ('open', 'processing', 'submitted') then
    raise exception 'payment request is not payable';
  end if;

  if target_request.expires_at <= now() then
    update public.payment_requests
    set status = 'expired'
    where id = p_request_id;
    raise exception 'payment request expired';
  end if;

  if target_request.amount <> p_amount then
    raise exception 'payment amount mismatch';
  end if;

  insert into public.payments (
    request_id,
    amount,
    payer_address,
    payer_email,
    transaction_id,
    transaction_hash,
    status,
    raw_result
  )
  values (
    p_request_id,
    p_amount,
    nullif(p_payer_address, ''),
    nullif(p_payer_email, ''),
    p_transaction_id,
    nullif(p_transaction_hash, ''),
    'submitted',
    coalesce(p_raw_result, '{}'::jsonb)
  )
  returning * into created_payment;

  update public.payment_requests
  set
    status = 'paid',
    paid_at = now(),
    last_payment_id = created_payment.id,
    processing_started_at = null
  where id = p_request_id;

  return created_payment;
end;
$$;

alter table public.payment_requests enable row level security;
alter table public.payment_requests force row level security;
alter table public.payments enable row level security;
alter table public.payments force row level security;
alter table public.notifications enable row level security;
alter table public.notifications force row level security;

revoke all on table public.payment_requests from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;
revoke all on function public.claim_payment_request(uuid) from anon, authenticated;
revoke all on function public.record_payment_submission(uuid, numeric, text, text, text, text, jsonb) from anon, authenticated;
