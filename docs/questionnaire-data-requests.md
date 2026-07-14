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
   `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_CONTACTS_API_KEY`,
   `RESEND_AUDIENCE_ID`, `CONSENT_TOKEN_SECRET` (generate with
   `openssl rand -hex 32`), `NOTIFY_EMAIL_FROM`, `NOTIFY_EMAIL_TO`,
   `PRIVACY_POLICY_VERSION`, `DEPLOY_BASE_URL`.
   - `RESEND_API_KEY` and `RESEND_CONTACTS_API_KEY` must be **two separate
     keys** from the Resend dashboard, not the same value twice.
     `RESEND_API_KEY` only ever sends emails — give it **Sending access**
     (Resend's own recommended default). `RESEND_CONTACTS_API_KEY` needs
     **Full access** (or at minimum Contacts permissions) since it manages
     the Audience/Segment — confirmed live that a Sending-access key gets
     a 401 `restricted_api_key` error from the Contacts API. Keeping them
     separate means a leaked sending key still can't touch the contact
     list.
   - Set `DEPLOY_BASE_URL` with a **different value per deploy context**
     (Netlify: this variable → "Different value for each deploy context")
     — `https://valorapartners.co.uk` for Production, the `astro-rebuild`
     branch's own URL for Branch deploys. Functions have no built-in way
     to detect their own deploy context (confirmed against Netlify's docs
     — only `URL`, `SITE_NAME`, `SITE_ID` are available to functions at
     runtime; `DEPLOY_PRIME_URL` and similar are build-time only), so
     without this, every confirm/unsubscribe link generated from any
     environment — including a branch deploy — points at production.
4. Request Supabase's Data Processing Agreement (support ticket from the
   Supabase dashboard, or email support@supabase.io) — needed for the
   GDPR paper trail.
5. In Resend, verify a sending domain (adds SPF/DKIM/DMARC DNS records to
   the Valora domain) — required before `NOTIFY_EMAIL_FROM` can send.
   Afterwards, create a Resend **Audience/Segment** and set its ID as
   `RESEND_AUDIENCE_ID`, so confirmed marketing contacts sync into it.
   Create the **second** API key here too (Full access, for
   `RESEND_CONTACTS_API_KEY`) — see step 3 above for why it must be
   separate from the sending key.
6. ~~Set up a free external uptime pinger~~ — no action needed.
   `netlify/functions/keepalive.mjs` is a **Netlify Scheduled Function**
   (`export const config = { schedule: '0 6 * * *' }`), so Netlify itself
   calls it once a day automatically once this deploys — no external
   account, no URL to hand to a third-party service, nothing to configure
   here. (Originally this step asked you to point an external service like
   UptimeRobot or cron-job.org at `/.netlify/functions/keepalive` — switched
   090726 because scheduled functions are simpler and don't depend on a
   third-party free-tier feature gate. Hitting the site's homepage still
   wouldn't work for this — the homepage never talks to Supabase, so only
   this function's own scheduled run resets Supabase's inactivity timer.)
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
correction and deletion on request. Marketing opt-out is self-serve — every
marketing email footer includes an unsubscribe link that sets
`marketing_consent = false`, stamps `unsubscribed_at`, and (best-effort)
removes the person from the Resend Audience too, so no further manual
action is needed there on top of the Supabase flag. Access, correction and
full erasure remain manual, handled by email given the expected low volume
of submissions.

An unsubscribed person's row shows `marketing_consent = false` with
`unsubscribed_at` set, while `marketing_consent_confirmed_at` stays
populated as the historical record of their earlier opt-in.

When someone emails `privacy@valorapartners.co.uk` asking about their
questionnaire data:

1. Open the Supabase project → **Table Editor** → `questionnaire_responses`
   (or the NocoDB CRM view, if set up — see `docs/crm-setup.md`).
2. Filter by their email address (the `email` column).
3. **For an access request**: export/screenshot the matching row(s) and
   reply with what's held — questionnaire answers, whether a report was
   sent, and their current consent status (`marketing_consent`,
   `marketing_consent_confirmed_at`, `unsubscribed_at`).
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
