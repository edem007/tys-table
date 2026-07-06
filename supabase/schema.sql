-- ============================================================
-- Ty's Table — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension (already enabled by default in Supabase)
create extension if not exists "uuid-ossp";


-- ── Profiles ────────────────────────────────────────────────────
-- One row per authenticated user, created automatically on sign-up.
create table if not exists profiles (
  id                uuid references auth.users on delete cascade primary key,
  display_name      text not null default '',
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  city              text not null default 'Dallas',
  avatar_url        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can view their own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

-- Auto-create a profile row when a new user signs up
create or replace function handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();


-- ── User Preferences ────────────────────────────────────────────
create table if not exists user_preferences (
  user_id         uuid references profiles (id) on delete cascade primary key,
  cuisines        text[] not null default '{}',
  monthly_budget  integer not null default 400 check (monthly_budget >= 0),
  cook_nights     integer not null default 4 check (cook_nights between 0 and 7),
  dine_out_nights integer not null default 3 check (dine_out_nights between 0 and 7),
  party_size      integer not null default 2 check (party_size between 1 and 20),
  onboarded       boolean not null default false,
  updated_at      timestamptz not null default now()
);

alter table user_preferences enable row level security;

create policy "Users can view their own preferences"
  on user_preferences for select using (auth.uid() = user_id);

create policy "Users can insert their own preferences"
  on user_preferences for insert with check (auth.uid() = user_id);

create policy "Users can update their own preferences"
  on user_preferences for update using (auth.uid() = user_id);


-- ── Funds (Savings Goals) ────────────────────────────────────────
create table if not exists funds (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references profiles (id) on delete cascade not null,
  name          text not null,
  target_amount integer not null check (target_amount > 0),
  is_active     boolean not null default true,
  cashed_out    boolean not null default false,
  cashed_out_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists funds_user_id_idx on funds (user_id);
create index if not exists funds_user_active_idx on funds (user_id, is_active);

alter table funds enable row level security;

create policy "Users can view their own funds"
  on funds for select using (auth.uid() = user_id);

create policy "Users can insert their own funds"
  on funds for insert with check (auth.uid() = user_id);

create policy "Users can update their own funds"
  on funds for update using (auth.uid() = user_id);


-- ── Deposits (Cook Nights) ───────────────────────────────────────
create table if not exists deposits (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references profiles (id) on delete cascade not null,
  fund_id     uuid references funds (id) on delete cascade not null,
  dish        text not null default '',
  amount      integer not null default 16 check (amount > 0),
  date        date not null default current_date,
  created_at  timestamptz not null default now()
);

create index if not exists deposits_user_id_idx on deposits (user_id);
create index if not exists deposits_fund_id_idx on deposits (fund_id);
create index if not exists deposits_date_idx on deposits (user_id, date desc);

alter table deposits enable row level security;

create policy "Users can view their own deposits"
  on deposits for select using (auth.uid() = user_id);

create policy "Users can insert their own deposits"
  on deposits for insert with check (auth.uid() = user_id);


-- ── AI Suggestions ───────────────────────────────────────────────
-- Stores generated suggestions for analytics + caching.
create table if not exists suggestions (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references profiles (id) on delete cascade not null,
  fund_id       uuid references funds (id) on delete set null,
  type          text not null check (type in ('cook', 'dine_out')),
  title         text not null,
  description   text not null default '',
  estimated_cost integer,
  reason        text not null default '',
  was_accepted  boolean,
  generated_at  timestamptz not null default now(),
  date          date not null default current_date
);

create index if not exists suggestions_user_id_idx on suggestions (user_id);
create index if not exists suggestions_date_idx on suggestions (user_id, date desc);

alter table suggestions enable row level security;

create policy "Users can view their own suggestions"
  on suggestions for select using (auth.uid() = user_id);

create policy "Users can insert their own suggestions"
  on suggestions for insert with check (auth.uid() = user_id);

create policy "Users can update their own suggestions"
  on suggestions for update using (auth.uid() = user_id);


-- ── Helper: updated_at trigger ───────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on profiles
  for each row execute procedure set_updated_at();

create trigger set_preferences_updated_at
  before update on user_preferences
  for each row execute procedure set_updated_at();

create trigger set_funds_updated_at
  before update on funds
  for each row execute procedure set_updated_at();
