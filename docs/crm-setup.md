# CRM Tier 1: NocoDB over Supabase

Self-hosting [NocoDB](https://nocodb.com) as a lightweight CRM view over the
questionnaire lead-capture table that already lives in Supabase Postgres.
No new data store, no export/import, no sync job to maintain.

Covers the `nocodb/` compose setup (`nocodb/docker-compose.yml`,
`nocodb/.env.example`). For handling an individual access or erasure
request, see `docs/questionnaire-data-requests.md` - that stays the
canonical process regardless of which tool (Table Editor or NocoDB) you use
to action it.

## Model

NocoDB connects **directly** to the existing Supabase Postgres database -
there is no data duplication and nothing to keep in sync. It reads and
writes `questionnaire_responses` live, in place. `status` and `notes`
(added by `scripts/supabase-schema.sql`) are the two CRM working fields;
everything else in the table - answers, consent flags, contact details -
stays exactly as `submit-questionnaire.mjs`, `confirm-subscription.mjs` and
`unsubscribe.mjs` already write it.

## Why NocoDB can read a table with "no policies"

`scripts/supabase-schema.sql` deliberately leaves `questionnaire_responses`
with row level security **enabled** and **no policies** defined - by
design, the anon key (and any PostgREST request using it) gets
permission-denied on every read and write. That lockdown is specifically a
PostgREST/anon-key concern, not a blanket block on the table itself.

NocoDB doesn't go through PostgREST or the anon key at all - it opens a
normal Postgres connection using Supabase's own connection details, as the
`postgres` role (table owner / superuser). In Postgres, an enabled RLS
policy set only restricts a role once the table has also been altered with
`FORCE ROW LEVEL SECURITY` - the schema only ever runs plain `ENABLE ROW
LEVEL SECURITY`. A direct Postgres connection as the owning role therefore
**bypasses RLS entirely** and sees every row, with no policy changes
needed on the Supabase side.

## Connection details

From the Supabase dashboard: **Project Settings → Database**. These map
straight onto the placeholders in `nocodb/.env.example`:

- `SUPABASE_DB_HOST` - the connection host.
- `SUPABASE_DB_PORT` - the connection port.
- `SUPABASE_DB_NAME` - `postgres`.
- `SUPABASE_DB_USER` / `SUPABASE_DB_PASSWORD` - the database credentials
  shown on the same page.

That page offers a few connection modes. Prefer the **direct connection**
or the **session-mode pooler** - NocoDB is a persistent app that holds its
own connections open, which is what both of those modes are meant for.
Avoid the **transaction-mode pooler**: it's built for short-lived
serverless connections and doesn't suit a long-running app like NocoDB.

**IPv4/IPv6 gotcha**: Supabase's direct-connection host is IPv6-only.
Wherever the compose file ends up hosted (see Hosting, below), if that host
doesn't have outbound IPv6, use the session-mode pooler instead - its
hostname is IPv4-reachable - or Supabase's paid IPv4 add-on.

## Metadata trade-off

Pointing `NC_DB` straight at Supabase - as `nocodb/docker-compose.yml`
does - means NocoDB also creates its own `nc_*` metadata tables (users,
view configuration, and similar) inside that same Postgres database. This
is harmless and namespaced; it won't collide with
`questionnaire_responses`. If you'd rather keep the Supabase project down
to only the tables this repo defines, the alternative is to run NocoDB
with a local metadata volume instead and add Supabase as an **external
data source** from inside the NocoDB UI. The compose file as committed
takes the simpler direct-`NC_DB` approach; switching to the alternative is
a NocoDB configuration change, not a code change.

## Hosting

`nocodb/docker-compose.yml` needs to run somewhere both Shaan and Tom can
reach over HTTPS - not a laptop's `localhost`. A couple of lite, low-effort
options, without committing to either: **Railway** or **Render** (**Fly.io**
as a third). All three can run the single container the compose file
defines (or an equivalent one-service deploy) and terminate HTTPS at their
own edge, so there's no certificate to manage separately.

## Security

- NocoDB has its own accounts, entirely separate from Supabase and from
  anything on the main site. Create one account each for Shaan and Tom once
  the instance is reachable.
- Set a strong, random `NC_AUTH_JWT_SECRET` (e.g. `openssl rand -hex 32`) -
  this signs NocoDB's own session tokens.
- Once both accounts exist, restrict further signups with
  `NC_INVITE_ONLY_SIGNUP=true` (confirmed against NocoDB's current
  environment-variable docs) - this disables public signup, so new users
  can only join via an invitation sent from inside NocoDB. As of NocoDB
  0.99.0 the same toggle is also available from the super admin settings
  menu in the UI, so it can be set there instead if that's easier once
  logged in.
- Never expose the raw Postgres port publicly - only NocoDB's own HTTPS
  port should be reachable from outside. The Postgres connection itself is
  outbound-only, from NocoDB to Supabase.

## Data-request tie-in

NocoDB is a live view, not a copy - deleting a row inside NocoDB deletes it
in Supabase, exactly as deleting it in the Supabase Table Editor would. It
doesn't change how access or erasure requests are handled, only which tool
is used to action them. The canonical steps stay in
`docs/questionnaire-data-requests.md`; use NocoDB or the Table Editor
interchangeably for step 1 there.
