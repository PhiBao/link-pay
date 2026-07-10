create or replace function public.release_payment_request(p_request_id uuid)
returns public.payment_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  released public.payment_requests;
begin
  update public.payment_requests
  set
    status = 'open',
    processing_started_at = null
  where id = p_request_id
    and status = 'processing'
  returning * into released;

  if released.id is not null then
    return released;
  end if;

  select * into released
  from public.payment_requests
  where id = p_request_id;

  return released;
end;
$$;

revoke all on function public.release_payment_request(uuid) from anon, authenticated;
