-- Shared Wi-Fi environments (churches, schools, events) can legitimately
-- finish many tests together. Keep the same HMAC/network-key protection while
-- allowing up to 120 result links per ten-minute window.

create or replace function shared_links_private.consume_rate_limit(
  p_rate_key text,
  p_operation text
)
returns table (allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = pg_catalog, shared_links_private
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_seconds integer;
  v_limit integer;
  v_window_started_at timestamptz;
  v_count integer;
begin
  if p_rate_key !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'INVALID_RATE_KEY';
  end if;

  case p_operation
    when 'create' then
      v_window_seconds := 600;
      v_limit := 120;
    when 'resolve' then
      v_window_seconds := 60;
      v_limit := 120;
    else
      raise exception using errcode = '22023', message = 'INVALID_RATE_OPERATION';
  end case;

  v_window_started_at := to_timestamp(
    floor(extract(epoch from v_now) / v_window_seconds) * v_window_seconds
  );

  delete from shared_links_private.rate_limits
  where rate_key = p_rate_key
    and operation = p_operation
    and expires_at <= v_now;

  if random() < 0.01 then
    delete from shared_links_private.rate_limits where expires_at <= v_now;
  end if;

  insert into shared_links_private.rate_limits (
    rate_key,
    operation,
    window_started_at,
    request_count,
    expires_at
  ) values (
    p_rate_key,
    p_operation,
    v_window_started_at,
    1,
    v_window_started_at + make_interval(secs => v_window_seconds * 2)
  )
  on conflict (rate_key, operation, window_started_at)
  do update set
    request_count = case
      when shared_links_private.rate_limits.request_count < 2147483647
        then shared_links_private.rate_limits.request_count + 1
      else shared_links_private.rate_limits.request_count
    end,
    expires_at = excluded.expires_at
  returning request_count into v_count;

  allowed := v_count <= v_limit;
  retry_after := greatest(
    1,
    ceil(extract(epoch from (v_window_started_at + make_interval(secs => v_window_seconds) - v_now)))::integer
  );
  return next;
end;
$$;

revoke all on function shared_links_private.consume_rate_limit(text, text)
  from public, anon, authenticated, service_role;
