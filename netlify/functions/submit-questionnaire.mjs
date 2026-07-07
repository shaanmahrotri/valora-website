import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CONSENT_TOKEN_SECRET = process.env.CONSENT_TOKEN_SECRET;
const NOTIFY_EMAIL_FROM = process.env.NOTIFY_EMAIL_FROM;
const NOTIFY_EMAIL_TO = process.env.NOTIFY_EMAIL_TO;
const SITE_URL = process.env.URL || process.env.DEPLOY_PRIME_URL || '';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  const {
    questionnaireSlug,
    formVersion,
    clientToken,
    company, // honeypot - real users never see or fill this field
    answers,
    wantsReport,
    marketingConsent,
    name,
    organisation,
    email,
  } = payload;

  // Bots that fill every field (including hidden ones) get a quiet 200
  // with no write to the database - no signal to them anything failed.
  if (company) {
    return jsonResponse(200, { ok: true });
  }

  if (
    typeof questionnaireSlug !== 'string' || !questionnaireSlug ||
    typeof clientToken !== 'string' || !clientToken ||
    !Array.isArray(answers) || answers.length === 0
  ) {
    return jsonResponse(400, { error: 'Missing required fields' });
  }

  // Structural check only - not every question can be validated as
  // "answered" server-side (some are conditionally shown/optional based on
  // client-side logic: showIf follow-ups, open text, detail boxes). Full
  // re-validation of that branching would duplicate the whole question
  // schema server-side for a lead-capture survey, which isn't worth it here.
  for (const answer of answers) {
    if (!answer || typeof answer.id !== 'string' || typeof answer.prompt !== 'string' || typeof answer.type !== 'string') {
      return jsonResponse(400, { error: 'Malformed answer data' });
    }
  }

  const wantsReportBool = Boolean(wantsReport);
  const marketingConsentBool = Boolean(marketingConsent);
  const trimmedEmail = typeof email === 'string' ? email.trim() : '';

  if ((wantsReportBool || marketingConsentBool) && !isValidEmail(trimmedEmail)) {
    return jsonResponse(400, { error: 'A valid email is required' });
  }

  const row = {
    questionnaire_slug: questionnaireSlug,
    form_version: Number(formVersion) || 1,
    client_token: clientToken,
    answers,
    wants_report: wantsReportBool,
    report_consent_given_at: wantsReportBool ? new Date().toISOString() : null,
    name: typeof name === 'string' && name.trim() ? name.trim() : null,
    organisation: typeof organisation === 'string' && organisation.trim() ? organisation.trim() : null,
    email: trimmedEmail || null,
    marketing_consent: marketingConsentBool,
    marketing_consent_confirmed_at: null,
    privacy_policy_version: process.env.PRIVACY_POLICY_VERSION || null,
  };

  let insertedRow;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/questionnaire_responses`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        // ignore-duplicates relies on the unique constraint on client_token -
        // a resubmit from a double-clicked button becomes a harmless no-op
        // instead of a second row.
        Prefer: 'resolution=ignore-duplicates,return=representation',
      },
      body: JSON.stringify(row),
    });

    if (!res.ok) {
      console.error('Supabase insert failed', res.status, await res.text());
      return jsonResponse(502, { error: 'Could not save your answers' });
    }

    const inserted = await res.json();
    insertedRow = Array.isArray(inserted) ? inserted[0] : null;
  } catch (err) {
    console.error('Supabase insert threw', err);
    return jsonResponse(502, { error: 'Could not save your answers' });
  }

  // A duplicate clientToken resolves to an empty array (no error) under
  // ignore-duplicates - nothing new to email in that case.
  if (!insertedRow) {
    return jsonResponse(200, { ok: true });
  }

  const emailTasks = [];

  if (wantsReportBool && trimmedEmail) {
    emailTasks.push(sendReportEmail(trimmedEmail, row.name, answers));
  }

  if (marketingConsentBool && trimmedEmail && insertedRow.id) {
    const token = signConfirmationToken({ id: insertedRow.id, email: trimmedEmail, iat: Date.now() });
    emailTasks.push(sendConfirmationEmail(trimmedEmail, row.name, token));
  }

  if (NOTIFY_EMAIL_TO) {
    emailTasks.push(sendInternalNotification(questionnaireSlug, trimmedEmail, row.name));
  }

  await Promise.allSettled(emailTasks);

  return jsonResponse(200, { ok: true });
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function signConfirmationToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', CONSENT_TOKEN_SECRET).update(encoded).digest('hex');
  return `${encoded}.${signature}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function sendResendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY || !NOTIFY_EMAIL_FROM) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: NOTIFY_EMAIL_FROM, to, subject, html }),
  });
}

function formatAnswerValue(answer) {
  const { type, value, detail } = answer;
  let text;
  if (value == null) {
    text = '(no answer)';
  } else if (type === 'grid' && typeof value === 'object' && !Array.isArray(value)) {
    text = Object.values(value)
      .map((cell) => `${cell.value}${cell.detail ? ` (${cell.detail})` : ''}`)
      .join('; ');
  } else if (Array.isArray(value)) {
    text = value.length ? value.join(', ') : '(no answer)';
  } else {
    text = String(value);
  }
  if (detail && type !== 'grid') text += ` — ${detail}`;
  return text;
}

async function sendReportEmail(to, name, answers) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi,';
  const rows = answers
    .map((a) => `<tr><td style="padding:8px 0;color:#3A3827;">${escapeHtml(a.prompt)}</td><td style="padding:8px 0 8px 16px;color:#5C5A48;">${escapeHtml(formatAnswerValue(a))}</td></tr>`)
    .join('');
  const html = `
    <p>${greeting}</p>
    <p>Thank you for completing the Valora Partners questionnaire. Here's a copy of your answers:</p>
    <table style="border-collapse:collapse;width:100%;">${rows}</table>
    <p>We'll be in touch if there's anything more to discuss.</p>
  `;
  await sendResendEmail({ to, subject: 'Your Valora Partners questionnaire results', html });
}

async function sendConfirmationEmail(to, name, token) {
  const confirmUrl = `${SITE_URL}/.netlify/functions/confirm-subscription?t=${encodeURIComponent(token)}`;
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi,';
  const html = `
    <p>${greeting}</p>
    <p>You asked to hear from Valora Partners about our services. Please confirm this is really you:</p>
    <p><a href="${confirmUrl}">Confirm subscription</a></p>
    <p>If you didn't request this, you can ignore this email - you won't be added to anything.</p>
  `;
  await sendResendEmail({ to, subject: 'Please confirm - Valora Partners', html });
}

async function sendInternalNotification(slug, email, name) {
  const html = `<p>New questionnaire submission for <strong>${escapeHtml(slug)}</strong>.</p>
    <p>${email ? `Contact: ${escapeHtml(name || '')} &lt;${escapeHtml(email)}&gt;` : 'No contact details provided.'}</p>`;
  await sendResendEmail({ to: NOTIFY_EMAIL_TO, subject: 'New questionnaire submission', html });
}
