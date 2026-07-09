create table if not exists post_views (
  post_id text primary key,
  views integer not null default 0,
  updated_at timestamptz default now()
);

alter table post_views enable row level security;

drop policy if exists "public_read_post_views" on post_views;
drop policy if exists "public_write_post_views" on post_views;
create policy "public_read_post_views" on post_views for select using (true);
create policy "public_write_post_views" on post_views for all using (true);

create table if not exists post_view_events (
  id text primary key default gen_random_uuid()::text,
  post_id text not null,
  visitor_key text default '',
  session_id text default '',
  path text default '',
  href text default '',
  referrer text default '',
  user_agent text default '',
  language text default '',
  viewport_width integer default 0,
  viewport_height integer default 0,
  screen_width integer default 0,
  screen_height integer default 0,
  timezone text default '',
  created_at timestamptz default now()
);

alter table post_view_events enable row level security;

drop policy if exists "public_read_post_view_events" on post_view_events;
drop policy if exists "public_write_post_view_events" on post_view_events;
create policy "public_read_post_view_events" on post_view_events for select using (true);
create policy "public_write_post_view_events" on post_view_events for all using (true);

create index if not exists idx_post_view_events_post_created on post_view_events(post_id, created_at desc);
create index if not exists idx_post_view_events_created on post_view_events(created_at desc);

create or replace function increment_post_view(
  p_post_id text,
  p_visitor_key text default '',
  p_session_id text default '',
  p_path text default '',
  p_href text default '',
  p_referrer text default '',
  p_user_agent text default '',
  p_language text default '',
  p_viewport_width integer default 0,
  p_viewport_height integer default 0,
  p_screen_width integer default 0,
  p_screen_height integer default 0,
  p_timezone text default ''
)
returns table(post_id text, views integer)
language plpgsql
security definer
as $$
begin
  insert into post_view_events (
    post_id,
    visitor_key,
    session_id,
    path,
    href,
    referrer,
    user_agent,
    language,
    viewport_width,
    viewport_height,
    screen_width,
    screen_height,
    timezone
  ) values (
    p_post_id,
    p_visitor_key,
    p_session_id,
    p_path,
    p_href,
    p_referrer,
    p_user_agent,
    p_language,
    p_viewport_width,
    p_viewport_height,
    p_screen_width,
    p_screen_height,
    p_timezone
  );

  insert into post_views (post_id, views, updated_at)
  values (p_post_id, 1, now())
  on conflict (post_id)
  do update set views = post_views.views + 1, updated_at = now();

  return query select pv.post_id, pv.views from post_views pv where pv.post_id = p_post_id;
end;
$$;
