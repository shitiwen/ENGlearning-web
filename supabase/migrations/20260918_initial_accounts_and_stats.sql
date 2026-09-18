-- 在 Supabase Dashboard 的 SQL Editor 中完整执行一次。
-- 不要把 service_role / secret key 写入前端或提交到 Git。

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_statistics (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_study_minutes integer not null default 0 check (total_study_minutes >= 0),
  vocabulary_total integer not null default 0 check (vocabulary_total >= 0),
  vocabulary_mastered integer not null default 0 check (vocabulary_mastered >= 0),
  content_completed integer not null default 0 check (content_completed >= 0),
  training_sessions integer not null default 0 check (training_sessions >= 0),
  listening_sessions integer not null default 0 check (listening_sessions >= 0),
  reading_sessions integer not null default 0 check (reading_sessions >= 0),
  speaking_sessions integer not null default 0 check (speaking_sessions >= 0),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'phone', new.phone))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id, phone)
select id, coalesce(raw_user_meta_data ->> 'phone', phone) from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.user_statistics enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.user_statistics from anon;
grant select, update on table public.profiles to authenticated;
grant select, insert, update on table public.user_statistics to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "statistics_select_own" on public.user_statistics;
create policy "statistics_select_own" on public.user_statistics for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "statistics_insert_own" on public.user_statistics;
create policy "statistics_insert_own" on public.user_statistics for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "statistics_update_own" on public.user_statistics;
create policy "statistics_update_own" on public.user_statistics for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
