-- 在初始账号 migration 之后执行；可重复执行，不会删除现有资料或学习统计。
alter table public.profiles add column if not exists age_band text;
alter table public.profiles add column if not exists learner_stage text;
alter table public.profiles add column if not exists grade_label text;
alter table public.profiles add column if not exists field_of_study text;
alter table public.profiles add column if not exists english_level text;
alter table public.profiles add column if not exists recent_exam_name text;
alter table public.profiles add column if not exists recent_exam_score numeric;
alter table public.profiles add column if not exists recent_exam_max_score numeric;
alter table public.profiles add column if not exists recent_exam_date date;
alter table public.profiles add column if not exists primary_goal text;
alter table public.profiles add column if not exists interests text[] not null default '{}';
alter table public.profiles add column if not exists onboarding_completed_at timestamptz;

-- 原有 profiles_select_own / profiles_update_own RLS 策略继续保护新增字段。
