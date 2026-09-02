-- Jawk production enablement: RLS, Realtime, and Storage.
-- Run once in Supabase SQL Editor after schema.sql and jamjam_matchmaker_rpc.sql.

alter table public.venues add column if not exists name_ar text;
alter table public.venues add column if not exists address_ar text;
alter table public.messages add column if not exists message_type text not null default 'text';
alter table public.messages add column if not exists attachment_url text;
alter table public.messages add column if not exists attachment_name text;
alter table public.profiles add column if not exists allow_jawk_requests boolean not null default false;
alter table public.profiles add column if not exists is_available boolean not null default true;
alter table public.profiles add column if not exists is_online boolean not null default false;
alter table public.profiles add column if not exists last_seen_at timestamptz not null default now();
alter table public.profiles add column if not exists region_id uuid;

create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'system',
  title text not null,
  body text not null,
  match_id uuid references public.matches(id) on delete cascade,
  invitation_id uuid references public.match_invitations(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.matches enable row level security;
alter table public.match_participants enable row level security;
alter table public.messages enable row level security;
alter table public.match_invitations enable row level security;
alter table public.match_ratings enable row level security;
alter table public.stories enable row level security;

-- Publicly readable catalogue data; writes remain restricted.
drop policy if exists "authenticated read profiles" on public.profiles;
create policy "authenticated read profiles" on public.profiles for select to authenticated using (true);
drop policy if exists "authenticated read venues" on public.venues;
create policy "authenticated read venues" on public.venues for select to authenticated using (true);
drop policy if exists "authenticated read matches" on public.matches;
create policy "authenticated read matches" on public.matches for select to authenticated using (true);
drop policy if exists "authenticated read participants" on public.match_participants;
create policy "authenticated read participants" on public.match_participants for select to authenticated using (true);
drop policy if exists "authenticated read stories" on public.stories;
create policy "authenticated read stories" on public.stories for select to authenticated using (true);

-- Users can edit only their own profile and presence-related fields.
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles for update to authenticated
using (auth.uid() = id) with check (auth.uid() = id);

-- Match messages: only participants can read/send.
drop policy if exists "participants read messages" on public.messages;
create policy "participants read messages" on public.messages for select to authenticated using (
  exists (select 1 from public.match_participants mp where mp.match_id = messages.match_id and mp.user_id = auth.uid())
);
drop policy if exists "participants send messages" on public.messages;
create policy "participants send messages" on public.messages for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.match_participants mp where mp.match_id = messages.match_id and mp.user_id = auth.uid())
);

-- Invitations are visible to the inviter or invitee; only the invitee can respond.
drop policy if exists "users read own invitations" on public.match_invitations;
create policy "users read own invitations" on public.match_invitations for select to authenticated using (auth.uid() = inviter_id or auth.uid() = invitee_id);
drop policy if exists "users create invitations" on public.match_invitations;
create policy "users create invitations" on public.match_invitations for insert to authenticated with check (auth.uid() = inviter_id);
drop policy if exists "invitees respond invitations" on public.match_invitations;
create policy "invitees respond invitations" on public.match_invitations for update to authenticated using (auth.uid() = invitee_id) with check (auth.uid() = invitee_id);

-- Ratings are visible after a match and writable only by the rater.
drop policy if exists "authenticated read ratings" on public.match_ratings;
create policy "authenticated read ratings" on public.match_ratings for select to authenticated using (true);
drop policy if exists "users create ratings" on public.match_ratings;
create policy "users create ratings" on public.match_ratings for insert to authenticated with check (auth.uid() = rater_id);
drop policy if exists "users update ratings" on public.match_ratings;
create policy "users update ratings" on public.match_ratings for update to authenticated using (auth.uid() = rater_id) with check (auth.uid() = rater_id);

-- Notifications are private to their recipient.
drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications for select to authenticated using (auth.uid() = user_id);
drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications" on public.notifications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Public bucket metadata; object writes are limited to the owner folder.
insert into storage.buckets (id, name, public) values ('stories', 'stories', true) on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public) values ('chat-attachments', 'chat-attachments', false) on conflict (id) do nothing;

drop policy if exists "users upload stories" on storage.objects;
create policy "users upload stories" on storage.objects for insert to authenticated with check (
  bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "users update stories" on storage.objects;
create policy "users update stories" on storage.objects for update to authenticated using (
  bucket_id = 'stories' and owner_id = auth.uid()::text
);
drop policy if exists "users upload chat attachments" on storage.objects;
create policy "users upload chat attachments" on storage.objects for insert to authenticated with check (
  bucket_id = 'chat-attachments' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "users read chat attachments" on storage.objects;
create policy "users read chat attachments" on storage.objects for select to authenticated using (
  bucket_id = 'chat-attachments' and owner_id = auth.uid()::text
);

-- Enable live updates without failing if a table is already in the publication.
do $$
begin
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.match_participants; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.player_presence; exception when duplicate_object then null; end;
end $$;
