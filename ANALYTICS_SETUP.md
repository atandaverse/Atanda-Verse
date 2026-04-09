## Analytics Setup

This project now supports first-party post analytics through Supabase.

### What changed

- `post.html` records views through a shared helper in `config.js`
- `blog.html` reads post counts from Supabase
- `admin.html` dashboard and analytics read the same counts
- `admin.html` analytics also uses the event table for:
  - unique visitors in the last 24 hours
  - tracked sessions in the last 24 hours
  - recent post activity across the last 7 days
- view tracking is designed to use a Supabase Edge Function first, with a simpler direct fallback if the function is not deployed yet

### Supabase SQL

Run the updated SQL from the admin setup block in:

- `admin.html`

New analytics tables included there:

- `post_views`
- `post_view_events`

### Recommended production setup

For the more durable analytics path:

1. Create a Supabase Edge Function named `track-post-view`
2. Paste the code from:
   - `track-post-view.example.ts`
3. Deploy the function

This gives you:

- first-party view tracking
- dedupe by `post_id + visitor_key + hourly bucket`
- raw event rows in `post_view_events`
- aggregated counts in `post_views`
- richer admin analytics without relying on third-party counters

### Notes

- The client already throttles repeat view writes locally
- The Edge Function adds a second layer of dedupe server-side
- If the function is missing, the site falls back to a simpler direct counter update so the UI still works

### Best practice

Use the Edge Function in production and treat the direct fallback as a temporary safety net, not the long-term analytics path.

Recommended standard for this project:

1. Deploy `track-post-view`
2. Use the admin analytics panel as the primary monitoring surface
3. Keep the direct fallback only as continuity protection
4. If traffic grows substantially, add server-side daily rollups as a later optimization
