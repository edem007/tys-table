-- Ty's Table: meal-planning + restaurant-matching rebuild
-- Run this AFTER supabase/schema.sql on a fresh project, or as an additive
-- migration on an existing one. Purely additive — does not drop funds/deposits.
--
-- Run in: Supabase Dashboard → SQL Editor → New Query

-- ============================================================
-- STEP 1: Allergies on user_preferences (party_size already exists)
-- ============================================================
alter table user_preferences
  add column if not exists allergies text[] not null default '{}';

-- ============================================================
-- STEP 2: Weekly meal plans (replaces the multi-fund savings model)
-- ============================================================
create table if not exists weekly_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles (id) on delete cascade not null,
  week_start date not null,
  saved_so_far integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create index if not exists weekly_plans_user_id_idx on weekly_plans (user_id);

alter table weekly_plans enable row level security;

create policy "Users can view their own weekly plans"
  on weekly_plans for select using (auth.uid() = user_id);

create policy "Users can insert their own weekly plans"
  on weekly_plans for insert with check (auth.uid() = user_id);

create policy "Users can update their own weekly plans"
  on weekly_plans for update using (auth.uid() = user_id);

create trigger set_weekly_plans_updated_at
  before update on weekly_plans
  for each row execute procedure set_updated_at();

-- ============================================================
-- STEP 3: Per-day plan entries (cook night recipe, or eat-out options)
-- ============================================================
create table if not exists plan_days (
  id uuid primary key default uuid_generate_v4(),
  weekly_plan_id uuid references weekly_plans (id) on delete cascade not null,
  day_date date not null,
  day_type text not null check (day_type in ('cook', 'eat-out')),
  recipe jsonb,
  restaurant_options jsonb,
  chosen_restaurant_id text,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (weekly_plan_id, day_date)
);

create index if not exists plan_days_weekly_plan_id_idx on plan_days (weekly_plan_id);

alter table plan_days enable row level security;

create policy "Users can view their own plan days"
  on plan_days for select using (
    auth.uid() = (select user_id from weekly_plans where id = weekly_plan_id)
  );

create policy "Users can insert their own plan days"
  on plan_days for insert with check (
    auth.uid() = (select user_id from weekly_plans where id = weekly_plan_id)
  );

create policy "Users can update their own plan days"
  on plan_days for update using (
    auth.uid() = (select user_id from weekly_plans where id = weekly_plan_id)
  );

-- ============================================================
-- NOTE: funds / deposits / suggestions tables are left untouched.
-- Once the new weekly-plan flow is confirmed working for real users,
-- a follow-up migration can retire them — do not drop them here.
-- ============================================================
