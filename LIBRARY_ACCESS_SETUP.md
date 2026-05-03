# Library Access Setup

Run this in Supabase SQL Editor if the admin activity panel says the access log table is not ready.

```sql
create table if not exists library_access_logs (
  id bigserial primary key,
  username text,
  event_type text not null,
  resource_id text,
  resource_title text,
  category text,
  page_url text,
  user_agent text,
  created_at timestamptz default now()
);

alter table library_access_logs enable row level security;

drop policy if exists "public_read_library_access_logs" on library_access_logs;
drop policy if exists "public_write_library_access_logs" on library_access_logs;

create policy "public_read_library_access_logs"
on library_access_logs for select
using (true);

create policy "public_write_library_access_logs"
on library_access_logs for all
using (true);
```

Admin controls live in `workspace.html` under Settings -> Library Access.

Notes:

- Public snippets stay visible on `library.html`.
- Full-resource buttons ask for the username and password saved from the admin settings.
- The admin stores a password hash for verification, not the readable password.
- Opens, successful logins, failed logins, and access-needed events are logged when Supabase is connected.
- This is a practical site access gate for a static frontend. For hard file privacy, move protected file delivery behind a Supabase Edge Function or private Storage policy.
