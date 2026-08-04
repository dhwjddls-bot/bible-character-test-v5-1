-- PII-free, expiring short links for test results.
-- Apply after schema.sql (or after 202608040000_expand_character_catalog.sql on an existing project).

create schema if not exists shared_links_private;
revoke all on schema shared_links_private from public, anon, authenticated, service_role;

create table if not exists public.shared_results (
  code text primary key,
  payload_version smallint not null default 2,
  primary_character text not null references public.character_catalog(id),
  primary_score smallint not null,
  second_character text not null references public.character_catalog(id),
  second_score smallint not null,
  third_character text not null references public.character_catalog(id),
  third_score smallint not null,
  discovery_character text references public.character_catalog(id),
  discovery_score smallint,
  question_count smallint not null,
  scoring_version text not null,
  question_bank_version text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  constraint shared_results_code_format check (code ~ '^[2-9A-HJ-NP-Z]{6}$'),
  constraint shared_results_payload_version check (payload_version = 2),
  constraint shared_results_score_range check (
    primary_score between 0 and 100
    and second_score between 0 and 100
    and third_score between 0 and 100
    and (discovery_score is null or discovery_score between 0 and 100)
  ),
  constraint shared_results_score_order check (
    primary_score >= second_score and second_score >= third_score
  ),
  constraint shared_results_character_distinctness check (
    primary_character <> second_character
    and primary_character <> third_character
    and second_character <> third_character
    and (
      discovery_character is null
      or discovery_character <> all (array[primary_character, second_character, third_character])
    )
  ),
  constraint shared_results_discovery_pair check (
    (discovery_character is null) = (discovery_score is null)
  ),
  constraint shared_results_question_count check (question_count in (16, 32, 48, 64)),
  constraint shared_results_version_format check (
    scoring_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,29}$'
    and question_bank_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,29}$'
  ),
  constraint shared_results_supported_versions check (
    scoring_version = 'v5.2-100' and question_bank_version = 'v5.1'
  ),
  constraint shared_results_retention check (
    expires_at > created_at and expires_at <= created_at + interval '91 days'
  )
);

create index if not exists shared_results_expiry_idx
  on public.shared_results (expires_at);

comment on table public.shared_results is
  'Expiring public result links. Never store names, email addresses, answers, trait scores, user IDs, or raw network identifiers here.';

alter table public.shared_results enable row level security;
revoke all on table public.shared_results from public, anon, authenticated, service_role;

create table if not exists shared_links_private.rate_limits (
  rate_key text not null,
  operation text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1,
  expires_at timestamptz not null,
  primary key (rate_key, operation, window_started_at),
  constraint shared_result_rate_key_format check (rate_key ~ '^[0-9a-f]{64}$'),
  constraint shared_result_rate_operation check (operation in ('create', 'resolve')),
  constraint shared_result_rate_count check (request_count > 0),
  constraint shared_result_rate_expiry check (expires_at > window_started_at)
);

create index if not exists shared_result_rate_expiry_idx
  on shared_links_private.rate_limits (expires_at);

comment on table shared_links_private.rate_limits is
  'Short-lived HMAC digests used for abuse prevention. Raw IP addresses are never stored.';

revoke all on table shared_links_private.rate_limits from public, anon, authenticated, service_role;

create or replace function shared_links_private.generate_code()
returns text
language plpgsql
volatile
set search_path = pg_catalog
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_entropy bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  v_code text := '';
  v_index integer;
begin
  for v_index in 0..5 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_entropy, v_index) % 32) + 1, 1);
  end loop;
  return v_code;
end;
$$;

revoke all on function shared_links_private.generate_code() from public, anon, authenticated, service_role;

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
      v_limit := 20;
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

create or replace function public.create_shared_result(
  p_payload jsonb,
  p_rate_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, shared_links_private
as $$
declare
  v_rate record;
  v_item jsonb;
  v_ids text[] := array[]::text[];
  v_scores smallint[] := array[]::smallint[];
  v_discovery_character text;
  v_discovery_score smallint;
  v_expected_character_count integer := 3;
  v_active_character_count integer;
  v_code text;
  v_created_at timestamptz;
  v_expires_at timestamptz;
  v_attempt integer;
  v_index integer;
begin
  if coalesce(p_rate_key, '') !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_rate_key');
  end if;

  select * into v_rate
  from shared_links_private.consume_rate_limit(p_rate_key, 'create');

  if not v_rate.allowed then
    return jsonb_build_object(
      'ok', false,
      'error', 'rate_limited',
      'retryAfter', v_rate.retry_after
    );
  end if;

  if jsonb_typeof(p_payload) <> 'object'
    or not (p_payload ?& array['v', 's', 'b', 'q', 'r', 'd'])
    or (p_payload - array['v', 's', 'b', 'q', 'r', 'd']::text[]) <> '{}'::jsonb
  then
    return jsonb_build_object('ok', false, 'error', 'invalid_payload');
  end if;

  if jsonb_typeof(p_payload->'v') <> 'number'
    or p_payload->>'v' <> '2'
    or jsonb_typeof(p_payload->'s') <> 'string'
    or (p_payload->>'s') !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,29}$'
    or p_payload->>'s' <> 'v5.2-100'
    or jsonb_typeof(p_payload->'b') <> 'string'
    or (p_payload->>'b') !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,29}$'
    or p_payload->>'b' <> 'v5.1'
    or jsonb_typeof(p_payload->'q') <> 'number'
    or (p_payload->>'q') !~ '^(16|32|48|64)$'
    or jsonb_typeof(p_payload->'r') <> 'array'
    or jsonb_array_length(p_payload->'r') <> 3
  then
    return jsonb_build_object('ok', false, 'error', 'invalid_payload');
  end if;

  for v_index in 0..2 loop
    v_item := p_payload->'r'->v_index;
    if jsonb_typeof(v_item) <> 'array'
      or jsonb_array_length(v_item) <> 2
      or jsonb_typeof(v_item->0) <> 'string'
      or (v_item->>0) !~ '^[a-z][a-z0-9_]{0,63}$'
      or jsonb_typeof(v_item->1) <> 'number'
      or (v_item->>1) !~ '^(0|[1-9][0-9]?|100)$'
    then
      return jsonb_build_object('ok', false, 'error', 'invalid_payload');
    end if;

    v_ids := array_append(v_ids, v_item->>0);
    v_scores := array_append(v_scores, (v_item->>1)::smallint);
  end loop;

  if v_ids[1] = v_ids[2]
    or v_ids[1] = v_ids[3]
    or v_ids[2] = v_ids[3]
    or v_scores[1] < v_scores[2]
    or v_scores[2] < v_scores[3]
  then
    return jsonb_build_object('ok', false, 'error', 'invalid_payload');
  end if;

  if p_payload->'d' <> 'null'::jsonb then
    v_item := p_payload->'d';
    if jsonb_typeof(v_item) <> 'array'
      or jsonb_array_length(v_item) <> 2
      or jsonb_typeof(v_item->0) <> 'string'
      or (v_item->>0) !~ '^[a-z][a-z0-9_]{0,63}$'
      or jsonb_typeof(v_item->1) <> 'number'
      or (v_item->>1) !~ '^(0|[1-9][0-9]?|100)$'
      or (v_item->>0) = any (v_ids)
    then
      return jsonb_build_object('ok', false, 'error', 'invalid_payload');
    end if;

    v_discovery_character := v_item->>0;
    v_discovery_score := (v_item->>1)::smallint;
    v_expected_character_count := 4;
  end if;

  select count(*) into v_active_character_count
  from public.character_catalog
  where active
    and id = any (
      case
        when v_discovery_character is null then v_ids
        else array_append(v_ids, v_discovery_character)
      end
    );

  if v_active_character_count <> v_expected_character_count then
    return jsonb_build_object('ok', false, 'error', 'invalid_payload');
  end if;

  if random() < 0.01 then
    delete from shared_links_private.rate_limits where expires_at <= clock_timestamp();
    delete from public.shared_results where expires_at <= clock_timestamp();
  end if;

  for v_attempt in 1..12 loop
    begin
      v_code := shared_links_private.generate_code();
      v_created_at := clock_timestamp();
      v_expires_at := v_created_at + interval '90 days';

      insert into public.shared_results (
        code,
        payload_version,
        primary_character,
        primary_score,
        second_character,
        second_score,
        third_character,
        third_score,
        discovery_character,
        discovery_score,
        question_count,
        scoring_version,
        question_bank_version,
        created_at,
        expires_at
      ) values (
        v_code,
        2,
        v_ids[1],
        v_scores[1],
        v_ids[2],
        v_scores[2],
        v_ids[3],
        v_scores[3],
        v_discovery_character,
        v_discovery_score,
        (p_payload->>'q')::smallint,
        p_payload->>'s',
        p_payload->>'b',
        v_created_at,
        v_expires_at
      );
      exit;
    exception when unique_violation then
      v_code := null;
    end;
  end loop;

  if v_code is null then
    return jsonb_build_object('ok', false, 'error', 'code_generation_failed');
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', v_code,
    'expiresAt', v_expires_at
  );
end;
$$;

revoke all on function public.create_shared_result(jsonb, text)
  from public, anon, authenticated;
grant execute on function public.create_shared_result(jsonb, text) to service_role;

create or replace function public.resolve_shared_result(
  p_code text,
  p_rate_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, shared_links_private
as $$
declare
  v_rate record;
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_result record;
  v_discovery jsonb := 'null'::jsonb;
begin
  if coalesce(p_rate_key, '') !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_rate_key');
  end if;

  select * into v_rate
  from shared_links_private.consume_rate_limit(p_rate_key, 'resolve');

  if not v_rate.allowed then
    return jsonb_build_object(
      'ok', false,
      'error', 'rate_limited',
      'retryAfter', v_rate.retry_after
    );
  end if;

  if v_code !~ '^[2-9A-HJ-NP-Z]{6}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select
    payload_version,
    primary_character,
    primary_score,
    second_character,
    second_score,
    third_character,
    third_score,
    discovery_character,
    discovery_score,
    question_count,
    scoring_version,
    question_bank_version,
    expires_at
  into v_result
  from public.shared_results
  where code = v_code and expires_at > clock_timestamp();

  if not found then
    delete from public.shared_results where code = v_code and expires_at <= clock_timestamp();
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_result.discovery_character is not null then
    v_discovery := jsonb_build_array(v_result.discovery_character, v_result.discovery_score);
  end if;

  return jsonb_build_object(
    'ok', true,
    'payload', jsonb_build_object(
      'v', v_result.payload_version,
      's', v_result.scoring_version,
      'b', v_result.question_bank_version,
      'q', v_result.question_count,
      'r', jsonb_build_array(
        jsonb_build_array(v_result.primary_character, v_result.primary_score),
        jsonb_build_array(v_result.second_character, v_result.second_score),
        jsonb_build_array(v_result.third_character, v_result.third_score)
      ),
      'd', v_discovery
    ),
    'expiresAt', v_result.expires_at
  );
end;
$$;

revoke all on function public.resolve_shared_result(text, text)
  from public, anon, authenticated;
grant execute on function public.resolve_shared_result(text, text) to service_role;
