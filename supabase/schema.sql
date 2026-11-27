-- Analytics schema for the Mike Astyn site (Supabase / Postgres).
-- Not applied anywhere yet. It mirrors the shapes used by src/analytics/store-local.js
-- so the site can switch stores by setting VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.

create table if not exists public.events (
  id          uuid primary key,
  ts          timestamptz not null default now(),
  day         date        not null,
  name        text        not null check (name in (
                'page_view','play_start','play_progress','play_complete',
                'listen','skip','buy_click','lyrics_open','outbound_click')),
  track_id    text,
  value       numeric,
  meta        jsonb,
  visitor_id  uuid        not null,
  session_id  uuid        not null,
  path        text,
  device      text check (device in ('mobile','desktop'))
);

create index if not exists events_day_idx       on public.events (day);
create index if not exists events_track_day_idx on public.events (track_id, day) where track_id is not null;
create index if not exists events_ts_idx        on public.events (ts desc);

-- Visitors can write events and nothing else. Reads need a signed-in admin.
alter table public.events enable row level security;

create policy "anyone can record an event"
  on public.events for insert to anon, authenticated
  with check (true);

create policy "signed-in admins can read events"
  on public.events for select to authenticated
  using (true);

-- One row per day per song. The dashboard reads this, never the raw table.
create or replace view public.daily_track_stats
with (security_invoker = true) as
select
  day,
  track_id,
  count(*) filter (where name = 'play_start')                    as plays,
  count(distinct visitor_id) filter (where name = 'play_start')  as listeners,
  count(*) filter (where name = 'play_complete')                 as completes,
  coalesce(sum(value) filter (where name = 'listen'), 0)         as listen_seconds,
  count(*) filter (where name = 'skip')                          as skips,
  count(*) filter (where name = 'buy_click')                     as buy_clicks,
  count(*) filter (where name = 'lyrics_open')                   as lyrics_opens
from public.events
where track_id is not null
group by day, track_id;

-- One row per day for the whole site.
create or replace view public.daily_site_stats
with (security_invoker = true) as
select
  day,
  count(distinct visitor_id)                    as visitors,
  count(distinct session_id)                    as sessions,
  count(*) filter (where name = 'page_view')    as page_views
from public.events
group by day;

-- When traffic grows, replace the two views with tables refreshed by a nightly
-- job (pg_cron) so a dashboard load never scans `events` at all, and prune raw
-- rows older than the longest window the dashboard shows (90 days).
