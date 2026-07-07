# Questionnaire: one-time setup and data-request handling

Covers the client questionnaire feature (`src/pages/questionnaire/[slug].astro`,
`netlify/functions/submit-questionnaire.mjs`,
`netlify/functions/confirm-subscription.mjs`). Two parts: setup steps that
need dashboard access we don't have, and the manual process for handling
an access/erasure request once the questionnaire is live.

## One-time setup

1. **Create a Supabase project** — region **EU West (Frankfurt)**, for
   UK/EU data residency.
2. Run `scripts/supabase-schema.sql` once in the Supabase SQL editor.
3. In Netlify (Project configuration → Environment variables), set the
   variables listed in `.env.example`: `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CONSENT_TOKEN_SECRET`
   (generate with `openssl rand -hex 32`), `NOTIFY_EMAIL_FROM`,
   `NOTIFY_EMAIL_TO`, `PRIVACY_POLICY_VERSION`.
4. Request Supabase's Data Processing Agreement (support ticket from the
   Supabase dashboard, or email support@supabase.io) — needed for the
   GDPR paper trail.
5. In Resend, verify a sending domain (adds SPF/DKIM/DMARC DNS records to
   the Valora domain) — required before `NOTIFY_EMAIL_FROM` can send.
6. Set up a free external uptime pinger (UptimeRobot or cron-job.org)
   hitting `/.netlify/functions/keepalive` every few days, so the Supabase
   free-tier project doesn't auto-pause from inactivity between prospect
   sends. This has to be the `keepalive` function specifically, not the
   site's homepage — the homepage never talks to Supabase, so pinging it
   does nothing for Supabase's own inactivity timer.
7. **Before sharing the questionnaire link with anyone**, verify RLS is
   actually blocking the anon key:
   ```bash
   curl -i "$SUPABASE_URL/rest/v1/questionnaire_responses?select=*" \
     -H "apikey: $SUPABASE_ANON_KEY" \
     -H "Authorization: Bearer $SUPABASE_ANON_KEY"
   ```
   Expect a 401/permission-denied response. If you get data back, stop and
   fix the RLS policy before going further.

## Handling an access or erasure request

The privacy policy (`src/content/legal/privacy.yaml`) promises access,
correction and deletion on request, handled manually (no self-serve UI in
this first version, given the expected low volume of submissions).

When someone emails `privacy@valorapartners.co.uk` asking about their
questionnaire data:

1. Open the Supabase project → **Table Editor** → `questionnaire_responses`.
2. Filter by their email address (the `email` column).
3. **For an access request**: export/screenshot the matching row(s) and
   reply with what's held — questionnaire answers, whether a report was
   sent, and their current consent status (`marketing_consent`,
   `marketing_consent_confirmed_at`).
4. **For an erasure request**: delete the matching row(s) directly in the
   Table Editor. This immediately and permanently removes their answers
   and contact details — there is no separate backup process to also
   clear.
5. Reply confirming what was actioned. Suggested template:

   > Hi [name],
   >
   > We've [located and shared / deleted] the data you asked about, held
   > from your questionnaire submission on [date]. [If deleted:] This has
   > now been permanently removed from our systems.
   >
   > Let us know if there's anything else we can help with.

No other place holds a copy of this data — Resend only sees the email
address at send time (governed by its own data retention as our
processor) and does not need any separate action for most requests; note
this to the requester if they ask about it specifically.
