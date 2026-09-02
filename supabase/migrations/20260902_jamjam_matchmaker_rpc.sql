-- Jawk / جمجم: standalone matchmaking migration.
-- Safe to run after or instead of the base schema. Never put a service-role key in the client.

create extension if not exists "uuid-ossp";

create table if not exists public.regions (
  id uuid primary key default uuid_generate_v4(),
  country_code text not null default 'IQ',
  name text not null,
  parent_name text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  unique (country_code, name)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  city text,
  role text not null default 'player',
  status text not null default 'available',
  avatar_url text,
  latitude double precision,
  longitude double precision,
  is_online boolean not null default false,
  is_available boolean not null default true,
  rating numeric(3,2) not null default 0,
  skill_level numeric(4,1) not null default 0,
  allow_jawk_requests boolean not null default false,
  region_id uuid references public.regions(id) on delete set null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.venues (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text,
  latitude double precision,
  longitude double precision,
  region_id uuid references public.regions(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid references public.venues(id) on delete set null,
  region_id uuid references public.regions(id) on delete set null,
  format text not null default '5×5',
  starts_at timestamptz not null default now(),
  max_players integer not null default 10,
  required_level numeric(4,1) not null default 0,
  allow_outside_region boolean not null default true,
  status text not null default 'open',
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

create table if not exists public.match_invitations (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references public.matches(id) on delete cascade,
  inviter_id uuid references public.profiles(id) on delete cascade,
  invitee_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (match_id, invitee_id)
);

create table if not exists public.player_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  active boolean not null default false,
  region_id uuid references public.regions(id) on delete set null,
  latitude double precision,
  longitude double precision,
  available_until timestamptz,
  updated_at timestamptz not null default now(),
  constraint player_presence_latitude_check check (latitude is null or latitude between -90 and 90),
  constraint player_presence_longitude_check check (longitude is null or longitude between -180 and 180)
);

alter table public.profiles add column if not exists skill_level numeric(4,1) not null default 0;
alter table public.profiles add column if not exists allow_jawk_requests boolean not null default false;
alter table public.profiles add column if not exists region_id uuid references public.regions(id) on delete set null;
alter table public.matches add column if not exists required_level numeric(4,1) not null default 0;
alter table public.matches add column if not exists region_id uuid references public.regions(id) on delete set null;
alter table public.matches add column if not exists allow_outside_region boolean not null default true;

create index if not exists player_presence_active_region_idx
  on public.player_presence (active, region_id, updated_at desc);

-- Remove the earlier duplicate RPC. The application uses only jamjam_matchmaker.
drop function if exists public.jawk_find_candidates(uuid, integer);
drop function if exists public.jamjam_matchmaker(uuid, double precision, integer);

create or replace function public.jamjam_matchmaker(
  p_match_id uuid,
  p_max_distance_km double precision default 10,
  p_limit integer default 10
)
returns table (
  player_id uuid,
  player_name text,
  distance_km double precision,
  match_score double precision,
  player_skill_level double precision,
  player_region_id uuid,
  presence_updated_at timestamptz,
  is_active boolean
)
language sql
security definer
set search_path = public
as $$
  with target as (
    select
      m.id,
      m.region_id,
      m.allow_outside_region,
      coalesce(m.required_level, 0)::double precision as required_level,
      v.latitude as venue_latitude,
      v.longitude as venue_longitude
    from public.matches m
    left join public.venues v on v.id = m.venue_id
    where m.id = p_match_id and m.status = 'open'
  ), eligible as (
    select
      p.id as player_id,
      coalesce(p.display_name, 'لاعب جوك') as player_name,
      case
        when t.venue_latitude is null or t.venue_longitude is null
          or pp.latitude is null or pp.longitude is null then null
        else (6371 * acos(least(1, greatest(-1,
          cos(radians(t.venue_latitude)) * cos(radians(pp.latitude)) *
          cos(radians(pp.longitude) - radians(t.venue_longitude)) +
          sin(radians(t.venue_latitude)) * sin(radians(pp.latitude))
        ))))::double precision
      end as distance_km,
      p.skill_level::double precision as player_skill_level,
      pp.region_id as player_region_id,
      pp.updated_at as presence_updated_at,
      pp.active as is_active,
      t.required_level,
      case when pp.region_id = t.region_id then 35 else 0 end as region_bonus,
      greatest(0, 30 - abs(coalesce(p.skill_level, 0) - t.required_level) * 10) as skill_score
    from target t
    join public.player_presence pp on pp.active = true
      and pp.updated_at > now() - interval '30 minutes'
      and (pp.available_until is null or pp.available_until > now())
    join public.profiles p on p.id = pp.user_id
      and p.allow_jawk_requests = true
      and p.is_available = true
      and (pp.region_id = t.region_id or t.allow_outside_region = true)
    where not exists (
      select 1 from public.match_participants mp
      where mp.match_id = t.id and mp.user_id = p.id and mp.status = 'confirmed'
    )
    and not exists (
      select 1 from public.match_invitations mi
      where mi.match_id = t.id and mi.invitee_id = p.id and mi.status in ('pending', 'accepted')
    )
  )
  select
    e.player_id,
    e.player_name,
    e.distance_km,
    (e.region_bonus + e.skill_score + case
      when e.distance_km is null then 0
      else greatest(0, 35 - (e.distance_km * 2))
    end)::double precision as match_score,
    e.player_skill_level,
    e.player_region_id,
    e.presence_updated_at,
    e.is_active
  from eligible e
  where e.distance_km is null or e.distance_km <= greatest(0, p_max_distance_km)
  order by match_score desc, e.distance_km nulls last
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;

revoke all on function public.jamjam_matchmaker(uuid, double precision, integer) from public, anon;
grant execute on function public.jamjam_matchmaker(uuid, double precision, integer) to authenticated;

-- Backward-compatible name: it delegates to the single Jamjam engine above.
drop function if exists public.jawk_find_candidates(uuid, integer);
create or replace function public.jawk_find_candidates(p_match_id uuid, p_limit integer default 20)
returns table (
  user_id uuid,
  display_name text,
  role text,
  region_id uuid,
  distance_km numeric,
  match_score numeric
)
language sql
security definer
set search_path = public
as $$
  select
    j.player_id as user_id,
    j.player_name as display_name,
    p.role,
    j.player_region_id as region_id,
    j.distance_km::numeric,
    j.match_score::numeric
  from public.jamjam_matchmaker(p_match_id, 10, p_limit) j
  join public.profiles p on p.id = j.player_id;
$$;

revoke all on function public.jawk_find_candidates(uuid, integer) from public, anon;
grant execute on function public.jawk_find_candidates(uuid, integer) to authenticated;
