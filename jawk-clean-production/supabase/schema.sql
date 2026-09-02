create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  city text,
  role text not null default 'player' check (role in ('player','keeper','referee','coach')),
  status text not null default 'available' check (status in ('available','radar')),
  avatar_url text,
  latitude double precision,
  longitude double precision,
  is_online boolean not null default false,
  is_available boolean not null default true,
  rating numeric(3,2) not null default 0,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.venues (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid references public.venues(id) on delete set null,
  format text not null default '5×5',
  starts_at timestamptz not null,
  max_players integer not null default 10,
  status text not null default 'open' check (status in ('open','full','finished','cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.match_participants (
  match_id uuid references public.matches(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'confirmed',
  joined_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

create table if not exists public.map_pins (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid references public.venues(id) on delete cascade,
  top text not null,
  left text not null,
  active boolean not null default false
);

create table if not exists public.stories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.fazaa_requests (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references public.matches(id) on delete cascade,
  requester_id uuid references public.profiles(id) on delete cascade,
  need text not null,
  starts_at timestamptz not null,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.fazaa_responses (
  request_id uuid references public.fazaa_requests(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'accepted',
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

create table if not exists public.campaigns (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  subtitle text,
  raised_amount numeric(14,2) not null default 0,
  goal_amount numeric(14,2) not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_donations (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references public.matches(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.match_invitations (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references public.matches(id) on delete cascade,
  inviter_id uuid references public.profiles(id) on delete cascade,
  invitee_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (match_id, invitee_id)
);

create table if not exists public.match_ratings (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references public.matches(id) on delete cascade,
  rater_id uuid references public.profiles(id) on delete cascade,
  player_id uuid references public.profiles(id) on delete cascade,
  value numeric(2,1) not null check (value between 0 and 5),
  created_at timestamptz not null default now(),
  unique (match_id, rater_id, player_id)
);

create table if not exists public.player_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  games integer not null default 0,
  wins integer not null default 0,
  goals integer not null default 0
);

create table if not exists public.player_badges (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.recent_games (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  pitch text not null,
  rating numeric(2,1),
  played_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.phone, 'لاعب جوك'))
  on conflict (id) do nothing;
  insert into public.player_stats (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.matches enable row level security;
alter table public.match_participants enable row level security;
alter table public.map_pins enable row level security;
alter table public.stories enable row level security;
alter table public.fazaa_requests enable row level security;
alter table public.fazaa_responses enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_donations enable row level security;
alter table public.messages enable row level security;
alter table public.match_invitations enable row level security;
alter table public.match_ratings enable row level security;
alter table public.player_stats enable row level security;
alter table public.player_badges enable row level security;
alter table public.recent_games enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['profiles','venues','matches','match_participants','map_pins','stories','fazaa_requests','fazaa_responses','campaigns','campaign_donations','messages','match_invitations','match_ratings','player_stats','player_badges','recent_games'] loop
    execute format('drop policy if exists "authenticated read %1$s" on public.%1$s', table_name);
    execute format('create policy "authenticated read %1$s" on public.%1$s for select to authenticated using (true)', table_name);
  end loop;
end $$;

create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "users insert own participant" on public.match_participants for insert to authenticated with check (auth.uid() = user_id);
create policy "users insert own fazaa response" on public.fazaa_responses for insert to authenticated with check (auth.uid() = user_id);
create policy "users insert own donation" on public.campaign_donations for insert to authenticated with check (auth.uid() = user_id);
create policy "users insert own message" on public.messages for insert to authenticated with check (auth.uid() = user_id);
create policy "users insert invitation" on public.match_invitations for insert to authenticated with check (auth.uid() = inviter_id);
create policy "users insert own rating" on public.match_ratings for insert to authenticated with check (auth.uid() = rater_id);
create policy "users update own rating" on public.match_ratings for update to authenticated using (auth.uid() = rater_id) with check (auth.uid() = rater_id);

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.match_participants;
