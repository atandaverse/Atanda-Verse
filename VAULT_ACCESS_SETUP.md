# Vault Library Access Setup

Run this in Supabase SQL Editor before using the approval flow.

```sql
create table if not exists vault_access_requests (
  id text primary key,
  application_no text unique,
  full_name text not null,
  email text not null,
  reason text,
  requested_resource_id text,
  requested_resource_title text,
  status text default 'pending',
  vault_username text,
  access_code_hash text,
  admin_note text,
  warning_note text,
  source_page text,
  page_url text,
  created_at timestamptz default now(),
  decided_at timestamptz,
  warned_at timestamptz,
  restricted_at timestamptz,
  emailed_at timestamptz,
  terms_emailed_at timestamptz
);

alter table vault_access_requests
add column if not exists warning_note text;

alter table vault_access_requests
add column if not exists warned_at timestamptz;

alter table vault_access_requests
add column if not exists restricted_at timestamptz;

alter table vault_access_requests
add column if not exists emailed_at timestamptz;

alter table vault_access_requests
add column if not exists terms_emailed_at timestamptz;

create table if not exists vault_activity_logs (
  id bigserial primary key,
  request_id text,
  application_no text,
  vault_username text,
  event_type text,
  resource_id text,
  resource_title text,
  page_url text,
  user_agent text,
  created_at timestamptz default now()
);

create table if not exists vault_resources (
  id text primary key,
  title text not null,
  module text,
  format text,
  summary text,
  access_level text default 'approved',
  file_url text,
  cover_url text,
  duration text,
  sort_order int default 0,
  status text default 'published',
  tags text,
  notes text,
  updated_at timestamptz default now()
);

alter table vault_access_requests enable row level security;
alter table vault_activity_logs enable row level security;
alter table vault_resources enable row level security;

drop policy if exists "public_read_vault_access_requests" on vault_access_requests;
drop policy if exists "public_write_vault_access_requests" on vault_access_requests;
drop policy if exists "public_read_vault_activity_logs" on vault_activity_logs;
drop policy if exists "public_write_vault_activity_logs" on vault_activity_logs;
drop policy if exists "public_read_vault_resources" on vault_resources;
drop policy if exists "public_write_vault_resources" on vault_resources;

create policy "public_read_vault_access_requests"
on vault_access_requests for select
using (true);

create policy "public_write_vault_access_requests"
on vault_access_requests for all
using (true);

create policy "public_read_vault_activity_logs"
on vault_activity_logs for select
using (true);

create policy "public_write_vault_activity_logs"
on vault_activity_logs for all
using (true);

create policy "public_read_vault_resources"
on vault_resources for select
using (true);

create policy "public_write_vault_resources"
on vault_resources for all
using (true);

insert into storage.buckets (id, name, public, file_size_limit)
values ('innerverse-media', 'innerverse-media', true, 52428800)
on conflict (id) do update
set public = true,
    file_size_limit = 52428800;

insert into storage.buckets (id, name, public, file_size_limit)
values ('atanda-vault-private', 'atanda-vault-private', false, 52428800)
on conflict (id) do update
set public = false,
    file_size_limit = 52428800;

drop policy if exists "public_read_innerverse_media" on storage.objects;
drop policy if exists "public_insert_innerverse_media" on storage.objects;
drop policy if exists "public_update_innerverse_media" on storage.objects;
drop policy if exists "public_delete_innerverse_media" on storage.objects;
drop policy if exists "admin_insert_atanda_vault_private" on storage.objects;
drop policy if exists "admin_update_atanda_vault_private" on storage.objects;

create policy "public_read_innerverse_media"
on storage.objects for select
using (bucket_id = 'innerverse-media');

create policy "public_insert_innerverse_media"
on storage.objects for insert
with check (bucket_id = 'innerverse-media');

create policy "public_update_innerverse_media"
on storage.objects for update
using (bucket_id = 'innerverse-media')
with check (bucket_id = 'innerverse-media');

create policy "public_delete_innerverse_media"
on storage.objects for delete
using (bucket_id = 'innerverse-media');

create policy "admin_insert_atanda_vault_private"
on storage.objects for insert
with check (bucket_id = 'atanda-vault-private');

create policy "admin_update_atanda_vault_private"
on storage.objects for update
using (bucket_id = 'atanda-vault-private')
with check (bucket_id = 'atanda-vault-private');
```

The Storage policies above are what allow Workspace uploads for vault files, cover images, blog covers, testimonials, and library images. If uploads fail with `new row violates row-level security policy`, this Storage section is the missing part.

Vault material files should be uploaded into `atanda-vault-private`. Covers can remain in `innerverse-media` because they are preview images, not protected materials. New private vault files are stored as `vault-private:path/to/file.pdf` and opened through the `serve-vault-file` Edge Function after validating the reader.

Deploy `send-vault-access.example.ts` as the Supabase Edge Function named:

```text
send-vault-access
```

Deploy `serve-vault-file.example.ts` as:

```text
serve-vault-file
```

Required Edge Function secrets:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
```

Flow:

1. Visitor requests vault access from `library.html`.
2. Admin reviews the request in `workspace.html -> Vault Access`.
3. Approval generates a vault username and uses the application number as the login code.
4. The user receives the vault link, username, and application number by email.
5. Approved users log into `vaultlibrary.html`.
6. Admin uploads advanced vault materials from `workspace.html -> Vault Access -> Vault Materials`.

Security note:

This is a controlled static-site access flow. For hard file privacy, keep actual vault files in private Supabase Storage and deliver them through an Edge Function after validating the application number server-side.
