
create table public.storylines (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  thesis text not null,
  tags text[] not null default '{}',
  risk_score integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.storylines enable row level security;

create policy "storylines_public_read" on public.storylines for select using (true);

create table public.storyline_events (
  storyline_id uuid not null references public.storylines(id) on delete cascade,
  event_id uuid not null,
  ordinal integer not null default 0,
  rationale text,
  created_at timestamptz not null default now(),
  primary key (storyline_id, event_id)
);

alter table public.storyline_events enable row level security;

create policy "storyline_events_public_read" on public.storyline_events for select using (true);

create index storyline_events_event_idx on public.storyline_events(event_id);
