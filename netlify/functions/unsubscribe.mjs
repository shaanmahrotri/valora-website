import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CONSENT_TOKEN_SECRET = process.env.CONSENT_TOKEN_SECRET;
// Deliberately separate from submit-questionnaire.mjs's RESEND_API_KEY (a
// Sending-access key) - confirmed live that a Sending-access key gets a 401
// restricted_api_key from the Contacts API. Same key as
// confirm-subscription.mjs's RESEND_CONTACTS_API_KEY.
const RESEND_CONTACTS_API_KEY = process.env.RESEND_CONTACTS_API_KEY;

// Self-serve opt-out for the marketing-consent checkbox - reached via the
// unsubscribe link in every marketing email footer (see
// submit-questionnaire.mjs's emailShell). Split into GET (renders a button,
// changes nothing) and POST (the only path that writes to the database) for
// the same Safe-Links / link-prefetch reason as confirm-subscription.mjs -
// corporate mail scanners (Microsoft Safe Links, Proofpoint, Mimecast)
// prefetch every link in an inbound email before a human opens it - an
// auto-unsubscribing GET would act on a click that never actually happened.
export async function handler(event) {
  if (event.httpMethod === 'GET') {
    const token = event.queryStringParameters?.t;
    const payload = verifyToken(token);
    if (!payload) {
      return htmlResponse(400, expiredPage());
    }
    return htmlResponse(200, unsubscribePage(token));
  }

  if (event.httpMethod === 'POST') {
    const token = extractPostedToken(event);
    const payload = verifyToken(token);
    if (!payload) {
      return htmlResponse(400, expiredPage());
    }

    try {
      const getRes = await fetch(
        `${SUPABASE_URL}/rest/v1/questionnaire_responses?id=eq.${encodeURIComponent(payload.id)}&select=email`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );
      const rows = await getRes.json();
      const row = Array.isArray(rows) ? rows[0] : null;

      if (!row || row.email !== payload.email) {
        return htmlResponse(400, expiredPage());
      }

      await fetch(
        `${SUPABASE_URL}/rest/v1/questionnaire_responses?id=eq.${encodeURIComponent(payload.id)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ marketing_consent: false, unsubscribed_at: new Date().toISOString() }),
        }
      );
    } catch {
      return htmlResponse(502, errorPage());
    }

    // Best-effort, outside the try/catch above: a Resend failure must never
    // turn a successful unsubscribe into an error page - the person still
    // sees "you're unsubscribed" regardless of Resend's state.
    try {
      await unsubscribeFromResend(payload.email);
    } catch (err) {
      console.error('Resend unsubscribe sync failed', err);
    }

    return htmlResponse(200, unsubscribedPage());
  }

  return { statusCode: 405, body: 'Method not allowed' };
}

async function unsubscribeFromResend(email) {
  if (!RESEND_CONTACTS_API_KEY) {
    console.error('Resend unsubscribe sync skipped - RESEND_CONTACTS_API_KEY not set for this deploy context');
    return;
  }
  const res = await fetch(`https://api.resend.com/contacts/${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${RESEND_CONTACTS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ unsubscribed: true }),
  });
  if (!res.ok) {
    console.error('Resend unsubscribe sync got a non-2xx response', res.status, await res.text());
  }
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;

  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  const expected = crypto.createHmac('sha256', CONSENT_TOKEN_SECRET).update(encoded).digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  const signatureBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== signatureBuf.length || !crypto.timingSafeEqual(expectedBuf, signatureBuf)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!payload || typeof payload.id !== 'string' || typeof payload.email !== 'string' || typeof payload.iat !== 'number') {
    return null;
  }

  return payload;
}

function extractPostedToken(event) {
  const contentType = event.headers?.['content-type'] || event.headers?.['Content-Type'] || '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(event.body || '{}').t;
    } catch {
      return null;
    }
  }
  const params = new URLSearchParams(event.body || '');
  return params.get('t');
}

function htmlResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body,
  };
}

function shell(title, bodyHtml) {
  // Matches the real site's tokens (docs/Valora-Design-System.md: Ink
  // #3A3827, Sand #E6DDD0, Paper #EFE9DE, Divider #CEC6B6, Gold #FEAD00,
  // Albert Sans, Light-300 headings, the slash+wordmark+gold-rule mark) -
  // kept identical to confirm-subscription.mjs's shell() (no shared module
  // between functions is the established convention here, so both copies
  // are maintained by hand in parallel).
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>${title} — Valora Partners</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@300;400;500;600;700&display=swap" />
<style>
  body { font-family: 'Albert Sans', Arial, sans-serif; background: #E6DDD0; color: #3A3827; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; }
  .page { max-width: 420px; width: 100%; }
  .brand { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 12px; }
  .brand__slash { font-size: 22px; font-weight: 700; color: #3A3827; opacity: 0.55; line-height: 1; }
  .brand__word { font-size: 14px; font-weight: 400; letter-spacing: 0.36em; text-transform: uppercase; color: #3A3827; }
  .gold-rule { width: 40px; height: 3px; background: #FEAD00; margin: 0 auto 32px; }
  .card { background: #EFE9DE; border: 1px solid #CEC6B6; padding: 48px 40px; text-align: center; }
  h1 { font-size: 24px; font-weight: 300; letter-spacing: -0.2px; margin: 0 0 16px; }
  p { font-size: 15px; font-weight: 300; line-height: 1.7; color: #5C5A48; margin: 0 0 24px; }
  button { font-family: inherit; background: #FEAD00; color: #2E2C20; border: none; padding: 14px 28px; font-size: 12px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; }
</style>
</head>
<body>
  <div class="page">
    <div class="brand"><span class="brand__slash">/</span><span class="brand__word">Valora</span></div>
    <div class="gold-rule"></div>
    <div class="card">${bodyHtml}</div>
  </div>
</body>
</html>`;
}

function unsubscribePage(token) {
  // token is HMAC-base64url output only (safe alphabet) - not raw user input.
  return shell(
    'Unsubscribe',
    `<h1>Unsubscribe</h1>
     <p>Click below to stop receiving marketing emails from Valora Partners.</p>
     <form method="POST">
       <input type="hidden" name="t" value="${token}" />
       <button type="submit">Unsubscribe</button>
     </form>`
  );
}

function unsubscribedPage() {
  return shell(
    "You're unsubscribed",
    `<h1>You're unsubscribed</h1><p>You won't receive any further marketing emails from us. You can opt back in at any time by completing a new questionnaire.</p>`
  );
}

function expiredPage() {
  return shell(
    'Link not valid',
    `<h1>Link not valid</h1><p>This unsubscribe link is not valid, or the request could not be completed. To stop receiving marketing emails from Valora Partners, use the unsubscribe link in any recent email from us, or contact us at <a href="mailto:privacy@valorapartners.co.uk">privacy@valorapartners.co.uk</a>.</p>`
  );
}

function errorPage() {
  return shell('Something went wrong', `<h1>Something went wrong</h1><p>Please try again shortly.</p>`);
}
