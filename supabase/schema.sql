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
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own test results" on public.test_results;
create policy "Users can delete their own test results"
  on public.test_results
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
