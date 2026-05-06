## Newsletter Setup

This project now supports:

- unified subscriber capture across newsletter forms, registrations, and article comments
- optional newsletter opt-in from vault access and structured contact forms
- automatic 5-Day Clarity Challenge vault access after newsletter subscription
- draft newsletter campaign creation when a post is published from admin
- storage of subscriber events and campaign records in Supabase

### Supabase SQL

Open the admin setup screen and copy/run the updated SQL block from:

- `admin.html`

It now includes:

- `subscriber_events`
- `newsletter_campaigns`
- `newsletter_deliveries`

### Resend

Do not place the Resend API key in any frontend file.

Recommended server-side setup:

1. Create a Supabase Edge Function named `send-newsletter-campaign`
2. Add the secret `RESEND_API_KEY` to Supabase secrets
3. Send from `letters@atanda.site`
4. Use `letters@atanda.site` as `reply_to`

### Welcome guide automation

Create another Supabase Edge Function named:

```text
send-subscriber-welcome
```

Paste in:

```text
send-subscriber-welcome.example.ts
```

Required secrets:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
```

When a user subscribes through a newsletter/registration/opt-in flow, the frontend calls this function after saving the subscriber. The function:

1. creates or reuses an approved `vault_access_requests` row for `5-day-clarity-challenge`
2. generates a vault username and application number
3. emails the user the `vaultlibrary.html` link plus credentials
4. avoids resending if that access row already has `emailed_at`

### Suggested send flow

1. Admin publishes a post
2. A `draft` row is created in `newsletter_campaigns`
3. Admin reviews the campaign and clicks `Send`
4. Edge Function:
   - loads the campaign
   - loads matching subscribers
   - sends in batches through Resend
   - writes rows to `newsletter_deliveries`
   - updates campaign status to `sent`

### Suggested Edge Function payload

```json
{
  "campaignId": "camp-post-id"
}
```

### Suggested send template fields

- subject: campaign subject
- preview text: campaign preview_text
- title: post title
- excerpt: post excerpt
- image: post image
- cta url: `post.html?id=<post_id>`

### Important note

`subscriber_events` is intended to preserve every email capture event even when `subscribers` only keeps one unique row per email address.
