
-- profiles
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- user_interests
create table public.user_interests (
  user_id uuid not null references auth.users on delete cascade,
  topic text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, topic)
);
alter table public.user_interests enable row level security;
create policy "interests_select_own" on public.user_interests for select using (auth.uid() = user_id);
create policy "interests_insert_own" on public.user_interests for insert with check (auth.uid() = user_id);
create policy "interests_delete_own" on public.user_interests for delete using (auth.uid() = user_id);

-- events (public read)
create table public.events (
  id uuid primary key default gen_random_uuid(),
  headline text not null,
  summary text not null,
  category text not null,
  sentiment numeric not null default 0,
  risk_score int not null default 0,
  confidence int not null default 0,
  countries text[] not null default '{}',
  industries text[] not null default '{}',
  sources text[] not null default '{}',
  breaking boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;
create policy "events_public_read" on public.events for select using (true);
create index events_created_at_idx on public.events (created_at desc);

-- event_impacts
create table public.event_impacts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  country_code text not null,
  country_name text not null,
  lat numeric not null,
  lng numeric not null,
  impact_score int not null default 0,
  narrative text not null,
  created_at timestamptz not null default now()
);
alter table public.event_impacts enable row level security;
create policy "impacts_public_read" on public.event_impacts for select using (true);
create index event_impacts_event_idx on public.event_impacts (event_id);

-- event_predictions
create table public.event_predictions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  horizon text not null,
  prediction text not null,
  confidence int not null default 50,
  created_at timestamptz not null default now()
);
alter table public.event_predictions enable row level security;
create policy "predictions_public_read" on public.event_predictions for select using (true);
create index event_predictions_event_idx on public.event_predictions (event_id);

-- votes
create table public.votes (
  user_id uuid not null references auth.users on delete cascade,
  event_id uuid not null references public.events on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
alter table public.votes enable row level security;
create policy "votes_public_read" on public.votes for select using (true);
create policy "votes_insert_own" on public.votes for insert with check (auth.uid() = user_id);
create policy "votes_update_own" on public.votes for update using (auth.uid() = user_id);
create policy "votes_delete_own" on public.votes for delete using (auth.uid() = user_id);

-- saved_events
create table public.saved_events (
  user_id uuid not null references auth.users on delete cascade,
  event_id uuid not null references public.events on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
alter table public.saved_events enable row level security;
create policy "saved_select_own" on public.saved_events for select using (auth.uid() = user_id);
create policy "saved_insert_own" on public.saved_events for insert with check (auth.uid() = user_id);
create policy "saved_delete_own" on public.saved_events for delete using (auth.uid() = user_id);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
