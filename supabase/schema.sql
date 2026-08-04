-- 성경인물 성향 테스트: 개인 검사 기록
-- Supabase SQL Editor에서 한 번 실행합니다.

create extension if not exists pgcrypto;

create table if not exists public.test_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_result_id text not null,
  tested_at timestamptz not null default now(),
  primary_character text not null,
  primary_score smallint not null check (primary_score between 0 and 100),
  second_character text,
  second_score smallint check (second_score between 0 and 100),
  third_character text,
  third_score smallint check (third_score between 0 and 100),
  trait_scores jsonb not null check (jsonb_typeof(trait_scores) = 'object'),
  question_count smallint not null check (question_count in (16, 32, 48, 64)),
  test_mode text not null default 'self' check (test_mode in ('self', 'other')),
  scoring_version text not null default 'v5.1',
  question_bank_version text not null default 'v5.1',
  schema_version integer not null default 1 check (schema_version > 0),
  created_at timestamptz not null default now(),
  unique (user_id, client_result_id)
);

create index if not exists test_results_user_timeline_idx
  on public.test_results (user_id, tested_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'test_results_text_limits'
      and conrelid = 'public.test_results'::regclass
  ) then
    alter table public.test_results
      add constraint test_results_text_limits check (
        char_length(client_result_id) between 1 and 128
        and char_length(scoring_version) between 1 and 30
        and char_length(question_bank_version) between 1 and 30
      );
  end if;
end
$$;

create table if not exists public.character_catalog (
  id text primary key,
  active boolean not null default true,
  catalog_version text not null default 'v5.2-100'
);

insert into public.character_catalog (id) values
  ('david'),('moses'),('joseph'),('esther'),('peter'),('paul'),('ruth'),('nehemiah'),('daniel'),('jeremiah'),('mary'),('martha'),
  ('adam'),('eve'),('noah'),('abraham'),('sarah'),('hagar'),('isaac'),('rebekah'),('jacob'),('leah'),('rachel'),('judah'),
  ('tamar_genesis'),('aaron'),('miriam'),('jochebed'),('jethro'),('bezalel'),('joshua'),('caleb'),('rahab'),('deborah'),('gideon'),('samson'),
  ('naomi'),('boaz'),('hannah'),('samuel'),('saul'),('jonathan'),('abigail'),('mephibosheth'),('nathan'),('solomon'),('elijah'),('widow_zarephath'),
  ('micaiah'),('elisha'),('shunammite_woman'),('naaman'),('huldah'),('hezekiah'),('josiah'),('job'),('jonah'),('amos'),('isaiah'),('ebed_melech'),
  ('ezekiel'),('mordecai'),('ezra'),('habakkuk'),('zechariah_priest'),('elizabeth'),('mary_mother'),('joseph_nazareth'),('simeon'),('anna_prophetess'),('john_baptist'),('andrew'),
  ('james_zebedee'),('john_zebedee'),('thomas'),('nathanael'),('mary_magdalene'),('joanna'),('samaritan_woman'),('nicodemus'),('zacchaeus'),('bartimaeus'),('joseph_arimathea'),('stephen'),
  ('philip_evangelist'),('ethiopian_eunuch'),('cornelius'),('ananias_damascus'),('barnabas'),('silas'),('john_mark'),('timothy'),('lydia'),('priscilla'),('aquila'),('apollos'),
  ('phoebe'),('tabitha'),('onesimus'),('epaphroditus')
on conflict (id) do update set active = true, catalog_version = excluded.catalog_version;

revoke all on table public.character_catalog from anon, authenticated;

alter table public.test_results drop constraint if exists test_results_character_contract;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'test_results_primary_character_fkey') then
    alter table public.test_results add constraint test_results_primary_character_fkey foreign key (primary_character) references public.character_catalog(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'test_results_second_character_fkey') then
    alter table public.test_results add constraint test_results_second_character_fkey foreign key (second_character) references public.character_catalog(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'test_results_third_character_fkey') then
    alter table public.test_results add constraint test_results_third_character_fkey foreign key (third_character) references public.character_catalog(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'test_results_character_distinctness') then
    alter table public.test_results add constraint test_results_character_distinctness check (
      second_character is not null and second_score is not null
      and third_character is not null and third_score is not null
      and primary_character <> second_character
      and primary_character <> third_character
      and second_character <> third_character
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'test_results_trait_contract'
      and conrelid = 'public.test_results'::regclass
  ) then
    alter table public.test_results
      add constraint test_results_trait_contract check (
        octet_length(trait_scores::text) <= 2048
        and trait_scores ?& array['courage','empathy','planning','duty','emotion','leadership','faith','adapt','calm','justice','service','reflection']
        and (trait_scores - array['courage','empathy','planning','duty','emotion','leadership','faith','adapt','calm','justice','service','reflection']::text[]) = '{}'::jsonb
        and jsonb_typeof(trait_scores->'courage') = 'number' and (trait_scores->>'courage')::numeric between 0 and 100
        and jsonb_typeof(trait_scores->'empathy') = 'number' and (trait_scores->>'empathy')::numeric between 0 and 100
        and jsonb_typeof(trait_scores->'planning') = 'number' and (trait_scores->>'planning')::numeric between 0 and 100
        and jsonb_typeof(trait_scores->'duty') = 'number' and (trait_scores->>'duty')::numeric between 0 and 100
        and jsonb_typeof(trait_scores->'emotion') = 'number' and (trait_scores->>'emotion')::numeric between 0 and 100
        and jsonb_typeof(trait_scores->'leadership') = 'number' and (trait_scores->>'leadership')::numeric between 0 and 100
        and jsonb_typeof(trait_scores->'faith') = 'number' and (trait_scores->>'faith')::numeric between 0 and 100
        and jsonb_typeof(trait_scores->'adapt') = 'number' and (trait_scores->>'adapt')::numeric between 0 and 100
        and jsonb_typeof(trait_scores->'calm') = 'number' and (trait_scores->>'calm')::numeric between 0 and 100
        and jsonb_typeof(trait_scores->'justice') = 'number' and (trait_scores->>'justice')::numeric between 0 and 100
        and jsonb_typeof(trait_scores->'service') = 'number' and (trait_scores->>'service')::numeric between 0 and 100
        and jsonb_typeof(trait_scores->'reflection') = 'number' and (trait_scores->>'reflection')::numeric between 0 and 100
      );
  end if;
end
$$;

create or replace function public.prepare_test_result_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.tested_at := now();
  new.created_at := now();

  if auth.uid() is null or new.user_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'RESULT_OWNER_MISMATCH';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  if not exists (
    select 1 from public.test_results
    where user_id = new.user_id and client_result_id = new.client_result_id
  ) and (select count(*) from public.test_results where user_id = auth.uid()) >= 500 then
    raise exception using errcode = 'P0001', message = 'RESULT_LIMIT_REACHED';
  end if;

  return new;
end;
$$;

revoke all on function public.prepare_test_result_insert() from public;

drop trigger if exists prepare_test_result_insert on public.test_results;
create trigger prepare_test_result_insert
  before insert on public.test_results
  for each row execute function public.prepare_test_result_insert();

alter table public.test_results enable row level security;

revoke all on table public.test_results from anon;
revoke all on table public.test_results from authenticated;
grant select, insert, delete on table public.test_results to authenticated;

drop policy if exists "Users can read their own test results" on public.test_results;
create policy "Users can read their own test results"
  on public.test_results
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own test results" on public.test_results;
create policy "Users can insert their own test results"
  on public.test_results
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id and test_mode = 'self');

drop policy if exists "Users can delete their own test results" on public.test_results;
create policy "Users can delete their own test results"
  on public.test_results
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
