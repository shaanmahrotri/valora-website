const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Pinged by an external uptime monitor (see docs/questionnaire-data-requests.md)
// so the Supabase free-tier project doesn't auto-pause after 7 days of
// database inactivity. Hitting the site's homepage doesn't touch Supabase at
// all, so this makes one cheap real query against it instead.
export async function handler() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/questionnaire_responses?select=id&limit=1`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    if (!res.ok) {
      return { statusCode: 502, body: 'Supabase ping failed' };
    }
    return { statusCode: 200, body: 'ok' };
  } catch {
    return { statusCode: 502, body: 'Supabase ping failed' };
  }
}
