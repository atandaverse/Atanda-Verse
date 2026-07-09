create extension if not exists pgcrypto;

create table if not exists events_campaigns (
  id text primary key,
  title text not null,
  slug text unique not null,
  kind text not null default 'campaign' check (kind in ('event', 'campaign', 'both')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  eyebrow text default '',
  summary text default '',
  details text default '',
  image_url text default '',
  location text default '',
  event_date timestamptz,
  end_date timestamptz,
  has_countdown boolean default false,
  countdown_label text default '',
  cta_label text default 'Learn More',
  cta_url text default '',
  funnel_url text default '',
  featured boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table events_campaigns enable row level security;

drop policy if exists "public_read_events_campaigns" on events_campaigns;
drop policy if exists "public_write_events_campaigns" on events_campaigns;
create policy "public_read_events_campaigns" on events_campaigns for select using (true);
create policy "public_write_events_campaigns" on events_campaigns for all using (true);

create or replace function set_events_campaigns_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_events_campaigns_updated_at on events_campaigns;
create trigger trg_events_campaigns_updated_at
before update on events_campaigns
for each row execute function set_events_campaigns_updated_at();

insert into events_campaigns (
  id,
  title,
  slug,
  kind,
  status,
  eyebrow,
  summary,
  details,
  image_url,
  location,
  event_date,
  end_date,
  has_countdown,
  countdown_label,
  cta_label,
  cta_url,
  funnel_url,
  featured,
  sort_order
) values (
  'free-session-launch',
  'Free Single Clarity Session',
  'free-single-clarity-session',
  'both',
  'published',
  'Launch Campaign',
  'A focused single clarity session for people ready to move from mental fog to direction.',
  'The launch campaign gives new visitors a simple first step into the Atanda Verse clarity path. Confirmation happens after registration.',
  'social-preview.png',
  'Online',
  null,
  null,
  true,
  'Free Session Ends In',
  'Book Session',
  'event-register.html?event=free-single-clarity-session',
  'event-register.html?event=free-single-clarity-session',
  true,
  10
) on conflict (id) do nothing;

create table if not exists event_registrations (
  id text primary key default gen_random_uuid()::text,
  event_id text references events_campaigns(id) on delete set null,
  event_slug text default '',
  full_name text not null,
  email text not null,
  phone text default '',
  country text default '',
  city text default '',
  preferred_contact text default '',
  note text default '',
  source text default 'event-funnel',
  registered_at timestamptz default now()
);

alter table event_registrations enable row level security;

drop policy if exists "public_read_event_registrations" on event_registrations;
drop policy if exists "public_write_event_registrations" on event_registrations;
create policy "public_read_event_registrations" on event_registrations for select using (true);
create policy "public_write_event_registrations" on event_registrations for all using (true);
