import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  importFresh,
  jsonResponse,
  routedFetch,
  decodePayload,
  setEnv,
} from './helpers.mjs';

const BASE_ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  CONSENT_TOKEN_SECRET: 'test-shared-secret',
  RESEND_API_KEY: 'resend-key',
  NOTIFY_EMAIL_FROM: 'Valora Partners <hello@valorapartners.co.uk>',
  URL: 'https://astro-rebuild--valora.netlify.app',
};

async function loadSubmit(envOverrides = {}) {
  setEnv({ ...BASE_ENV, NOTIFY_EMAIL_TO: undefined, ...envOverrides });
  return importFresh('netlify/functions/submit-questionnaire.mjs');
}

function basePayload(overrides = {}) {
  return {
    questionnaireSlug: 'family-office-tech',
    formVersion: 1,
    clientToken: 'client-token-aaaa-bbbb',
    answers: [{ id: 'q1', prompt: 'Question one?', type: 'single', value: 'Yes' }],
    wantsReport: false,
    marketingConsent: false,
    name: 'Jane Prospect',
    organisation: 'Acme Family Office',
    email: 'jane@example.com',
    ...overrides,
  };
}

function postEvent(payload) {
  return { httpMethod: 'POST', body: JSON.stringify(payload) };
}

function insertRule(insertedRow) {
  return {
    match: (url, method) => url.includes('/rest/v1/questionnaire_responses') && method === 'POST',
    respond: () => jsonResponse(201, [insertedRow]),
  };
}

function resendEmailsRule(capturedEmails) {
  return {
    match: (url, method) => url === 'https://api.resend.com/emails' && method === 'POST',
    respond: (url, method, opts) => {
      capturedEmails.push(JSON.parse(opts.body));
      return jsonResponse(200, { id: `mock-${capturedEmails.length}` });
    },
  };
}

describe('submit-questionnaire.mjs - happy path: report + marketing consent + internal notification together', () => {
  test('sends three distinct emails; report and confirmation carry a working unsubscribe link, internal does not', async (t) => {
    const { handler } = await loadSubmit({ NOTIFY_EMAIL_TO: 'internal@valorapartners.co.uk' });
    const insertedRow = { id: 'row-xyz-999' };
    const captured = [];
    t.mock.method(globalThis, 'fetch', routedFetch([insertRule(insertedRow), resendEmailsRule(captured)]));

    const res = await handler(
      postEvent(basePayload({ wantsReport: true, marketingConsent: true }))
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { ok: true });
    assert.equal(captured.length, 3, 'expected report + confirmation + internal-notification emails');

    const report = captured.find((e) => e.subject === 'Your Valora Partners questionnaire results');
    const confirmation = captured.find((e) => e.subject === 'Please confirm - Valora Partners');
    const internal = captured.find((e) => e.subject === 'New questionnaire submission');
    assert.ok(report, 'report email must be sent');
    assert.ok(confirmation, 'confirmation email must be sent');
    assert.ok(internal, 'internal notification must be sent');

    const unsubscribeLinkPattern = /href="(https:\/\/astro-rebuild--valora\.netlify\.app\/\.netlify\/functions\/unsubscribe\?t=[^"]+)"/;

    // Report email: working unsubscribe link.
    const reportMatch = report.html.match(unsubscribeLinkPattern);
    assert.ok(reportMatch, 'report email must contain an unsubscribe link');
    assert.match(report.html, /Unsubscribe from marketing emails/);
    const reportToken = decodeURIComponent(new URL(reportMatch[1]).searchParams.get('t'));
    const reportPayload = decodePayload(reportToken);
    assert.equal(reportPayload.id, insertedRow.id);
    assert.equal(reportPayload.email, 'jane@example.com');

    // Confirmation email: working unsubscribe link AND the confirm-subscription link.
    const confirmMatch = confirmation.html.match(unsubscribeLinkPattern);
    assert.ok(confirmMatch, 'confirmation email must contain an unsubscribe link');
    assert.match(confirmation.html, /Unsubscribe from marketing emails/);
    assert.match(confirmation.html, /\/\.netlify\/functions\/confirm-subscription\?t=/);

    // Internal notification: no unsubscribe link anywhere, and the footer
    // renders exactly as it did before emailShell gained its optional 2nd
    // argument (nothing appended after the address, byte-for-byte).
    assert.doesNotMatch(internal.html, /unsubscribe/i, 'internal notification must carry no unsubscribe link');
    assert.match(
      internal.html,
      /71-75 Shelton Street, London, WC2H 9JQ\s*<\/td>/,
      'internal notification footer must be unchanged - nothing appended after the address'
    );
  });
});

describe('submit-questionnaire.mjs - emailShell backward compatibility (no 2nd arg -> unchanged output)', () => {
  test('internal-notification-only submission (no report, no marketing consent) still omits the unsubscribe line', async (t) => {
    const { handler } = await loadSubmit({ NOTIFY_EMAIL_TO: 'internal@valorapartners.co.uk' });
    const insertedRow = { id: 'row-internal-only' };
    const captured = [];
    t.mock.method(globalThis, 'fetch', routedFetch([insertRule(insertedRow), resendEmailsRule(captured)]));

    const res = await handler(postEvent(basePayload({ wantsReport: false, marketingConsent: false })));

    assert.equal(res.statusCode, 200);
    assert.equal(captured.length, 1, 'only the internal notification should be sent');
    const [internal] = captured;
    assert.equal(internal.subject, 'New questionnaire submission');
    assert.doesNotMatch(internal.html, /unsubscribe/i);
    assert.match(internal.html, /71-75 Shelton Street, London, WC2H 9JQ\s*<\/td>/);
  });
});

describe('submit-questionnaire.mjs - report-only submission (no marketing consent)', () => {
  test('report email still gets its own unsubscribe link; no confirmation email is sent', async (t) => {
    const { handler } = await loadSubmit();
    const insertedRow = { id: 'row-report-only' };
    const captured = [];
    t.mock.method(globalThis, 'fetch', routedFetch([insertRule(insertedRow), resendEmailsRule(captured)]));

    const res = await handler(postEvent(basePayload({ wantsReport: true, marketingConsent: false })));

    assert.equal(res.statusCode, 200);
    assert.equal(captured.length, 1, 'no NOTIFY_EMAIL_TO and no marketing consent -> only the report email');
    const [report] = captured;
    assert.equal(report.subject, 'Your Valora Partners questionnaire results');
    assert.match(report.html, /Unsubscribe from marketing emails/);
  });
});

describe('submit-questionnaire.mjs - other behaviour', () => {
  test('duplicate clientToken (ignore-duplicates resolves empty) -> 200 ok, no emails, no crash building an unsubscribe URL', async (t) => {
    const { handler } = await loadSubmit({ NOTIFY_EMAIL_TO: 'internal@valorapartners.co.uk' });
    const fetchMock = t.mock.method(
      globalThis,
      'fetch',
      routedFetch([
        {
          match: (url, method) => url.includes('/rest/v1/questionnaire_responses') && method === 'POST',
          respond: () => jsonResponse(201, []), // no row returned - duplicate insert
        },
      ])
    );

    const res = await handler(postEvent(basePayload({ wantsReport: true, marketingConsent: true })));

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { ok: true });
    assert.equal(fetchMock.mock.calls.length, 1, 'only the insert attempt - no email tasks should run at all');
  });

  test('malformed JSON body -> 400 Invalid JSON, no fetch calls', async (t) => {
    const { handler } = await loadSubmit();
    const fetchMock = t.mock.method(globalThis, 'fetch', routedFetch([]));

    const res = await handler({ httpMethod: 'POST', body: '{not valid json' });

    assert.equal(res.statusCode, 400);
    assert.deepEqual(JSON.parse(res.body), { error: 'Invalid JSON' });
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  test('missing required fields (no questionnaireSlug) -> 400 Missing required fields', async (t) => {
    const { handler } = await loadSubmit();
    const fetchMock = t.mock.method(globalThis, 'fetch', routedFetch([]));
    const payload = basePayload();
    delete payload.questionnaireSlug;

    const res = await handler(postEvent(payload));

    assert.equal(res.statusCode, 400);
    assert.deepEqual(JSON.parse(res.body), { error: 'Missing required fields' });
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  test('wrong HTTP method (GET) -> 405, no fetch calls', async (t) => {
    const { handler } = await loadSubmit();
    const fetchMock = t.mock.method(globalThis, 'fetch', routedFetch([]));

    const res = await handler({ httpMethod: 'GET' });

    assert.equal(res.statusCode, 405);
    assert.equal(fetchMock.mock.calls.length, 0);
  });
});

describe('submit-questionnaire.mjs - SITE_URL resolves to the current deploy, not always production', () => {
  test('DEPLOY_BASE_URL wins over URL, so a branch deploy (once configured) links back to itself', async (t) => {
    // A prior attempt at this used DEPLOY_PRIME_URL as the branch-aware
    // fallback - wrong: confirmed against Netlify's own docs that
    // DEPLOY_PRIME_URL is build-time only and is simply undefined inside a
    // running function, so that "fix" silently never changed anything and
    // every link kept pointing at production. DEPLOY_BASE_URL is a custom
    // env var Shaan sets in the Netlify UI, scoped per deploy context, which
    // functions genuinely can read from process.env at runtime.
    const { handler } = await loadSubmit({
      URL: 'https://valorapartners.co.uk',
      DEPLOY_BASE_URL: 'https://astro-rebuild--valora.netlify.app',
    });
    const insertedRow = { id: 'row-xyz-999' };
    const captured = [];
    t.mock.method(globalThis, 'fetch', routedFetch([insertRule(insertedRow), resendEmailsRule(captured)]));

    await handler(postEvent(basePayload({ wantsReport: true, marketingConsent: true })));

    for (const email of captured) {
      assert.doesNotMatch(email.html, /href="https:\/\/valorapartners\.co\.uk\//,
        `${email.subject} must not link back to the production domain`);
    }
    const confirmationEmail = captured.find((e) => e.subject.startsWith('Please confirm'));
    assert.match(confirmationEmail.html, /href="https:\/\/astro-rebuild--valora\.netlify\.app\/\.netlify\/functions\/confirm-subscription\?t=/);
  });

  test('DEPLOY_BASE_URL absent (not yet configured for this context) falls back to URL', async (t) => {
    const { handler } = await loadSubmit({ URL: 'https://valorapartners.co.uk', DEPLOY_BASE_URL: undefined });
    const insertedRow = { id: 'row-xyz-999' };
    const captured = [];
    t.mock.method(globalThis, 'fetch', routedFetch([insertRule(insertedRow), resendEmailsRule(captured)]));

    await handler(postEvent(basePayload({ wantsReport: true, marketingConsent: true })));

    const confirmationEmail = captured.find((e) => e.subject.startsWith('Please confirm'));
    assert.match(confirmationEmail.html, /href="https:\/\/valorapartners\.co\.uk\/\.netlify\/functions\/confirm-subscription\?t=/);
  });
});
