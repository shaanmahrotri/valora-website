const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Runs on Netlify's own cron schedule (see `config` below) so the Supabase
// free-tier project doesn't auto-pause after 7 days of database inactivity.
// Hitting the site's homepage doesn't touch Supabase at all, so this makes
// one cheap real query against it instead. Originally designed to be pinged
// by an external uptime service (UptimeRobot/cron-job.org) - switched to a
// Netlify Scheduled Function instead so there's no third-party account or
// free-tier feature gate to depend on. Scheduled functions use the newer
// Request/Response handler shape (export default), not the classic
// `handler(event)` shape the other three functions in this repo use - that's
// a Netlify requirement for cron scheduling, not a stylistic choice.
export default async () => {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/questionnaire_responses?select=id&limit=1`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    if (!res.ok) {
      console.error('Supabase keepalive ping failed', res.status, await res.text());
      return new Response('Supabase ping failed', { status: 502 });
    }
    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('Supabase keepalive ping threw', err);
    return new Response('Supabase ping failed', { status: 502 });
  }
};

export const config = {
  // Once a day, comfortably inside Supabase's 7-day inactivity window even
  // if several consecutive runs fail. Netlify's own scheduler triggers this -
  // no external service, no URL to give anyone.
  schedule: '0 6 * * *',
};
