create table if not exists public.settings (
  key text primary key,
  value text
);

alter table public.settings enable row level security;

drop policy if exists "public_read_settings" on public.settings;
drop policy if exists "public_write_settings" on public.settings;

create policy "public_read_settings" on public.settings for select using (true);
create policy "public_write_settings" on public.settings for all using (true);

insert into public.settings (key, value)
values
  ('countdownTarget', to_json((now() + interval '30 days')::timestamptz)::text),
  ('countdownLabel', to_json('Free Access Ends In'::text)::text)
on conflict (key) do nothing;
