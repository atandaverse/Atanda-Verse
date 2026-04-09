## Contact Backend Setup

This adds one structured inbox across the site instead of scattered `mailto:` links.

### 1. Run this SQL in Supabase

```sql
create table if not exists contact_requests (
  id text primary key,
  category text not null default 'general',
  route_to text not null default 'hello',
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  package text default '',
  issue_type text default '',
  contact_method text default '',
  source_page text default '',
  page_url text default '',
  status text default 'new',
  meta text default '{}',
  created_at timestamptz default now(),
  acknowledged_at timestamptz
);
alter table contact_requests enable row level security;
drop policy if exists "public_read_contact_requests" on contact_requests;
drop policy if exists "public_write_contact_requests" on contact_requests;
create policy "public_write_contact_requests" on contact_requests for insert with check (true);
```

### 2. Create the Edge Function

Create a Supabase Edge Function named:

`send-contact-request`

Paste in:

`send-contact-request.example.ts`

### 3. Secrets required

This function needs:

- `RESEND_API_KEY`

Supabase already provides:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 4. Sender routing

- general contact -> `Atanda <hello@atanda.site>`
- session enquiries -> `Atanda Verse Sessions <sessions@atanda.site>`
- support/issues -> `Atanda Support <support@atanda.site>`

### Security note

- Public visitors should only be able to insert new `contact_requests`
- Reading requests and updating statuses should happen through your server-side function/service role

### 5. What happens

When a user submits the modal:

1. the request is saved into `contact_requests`
2. the edge function sends an acknowledgement to the user
3. the edge function sends an internal notification to the right inbox
4. the request status updates in Supabase

### 6. Current frontend behavior

The shared contact modal is now injected by `config.js` on pages that load it.
It automatically intercepts `mailto:` links for:

- `hello@atanda.site`
- `sessions@atanda.site`
- `support@atanda.site`

and replaces them with a structured form.
