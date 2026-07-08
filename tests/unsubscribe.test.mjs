import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  importFresh,
  mintToken,
  tamperSignature,
  jsonResponse,
  routedFetch,
  bodyJson,
  callMethod,
  callUrl,
  BASE_UNSUB_ENV,
  setEnv,
} from './helpers.mjs';

const ROW_ID = 'row-aaaa-1111';
const EMAIL = 'jane@example.com';

function freshToken(overrides = {}) {
  return mintToken(BASE_UNSUB_ENV.CONSENT_TOKEN_SECRET, {
    id: ROW_ID,
    email: EMAIL,
    iat: Date.now(),
    ...overrides,
  });
}

function getEvent(token) {
  return { httpMethod: 'GET', queryStringParameters: token === undefined ? {} : { t: token } };
}

function postEvent(token) {
  return {
    httpMethod: 'POST',
    headers: {},
    body: token === undefined ? '' : new URLSearchParams({ t: token }).toString(),
  };
}

async function loadUnsubscribe(envOverrides = {}) {
  setEnv({ ...BASE_UNSUB_ENV, ...envOverrides });
  return importFresh('netlify/functions/unsubscribe.mjs');
}

describe('unsubscribe.mjs - GET (render only, never writes)', () => {
  test('valid, freshly minted token renders the unsubscribe form and touches Supabase/Resend zero times', async (t) => {
    const { handler } = await loadUnsubscribe();
    const fetchMock = t.mock.method(globalThis, 'fetch', routedFetch([]));
    const token = freshToken();

    const res = await handler(getEvent(token));

    assert.equal(res.statusCode, 200);
    assert.match(res.body, /Unsubscribe/);
    assert.match(res.body, /<form method="POST">/);
    assert.match(res.body, new RegExp(`name="t" value="${token}"`));
    assert.equal(fetchMock.mock.calls.length, 0, 'GET must not contact Supabase or Resend at all');
  });

  test('a token minted long ago (no expiry check on this endpoint) still renders successfully', async (t) => {
    const { handler } = await loadUnsubscribe();
    t.mock.method(globalThis, 'fetch', routedFetch([]));
    const oldToken = freshToken({ iat: Date.now() - 365 * 24 * 60 * 60 * 1000 }); // 1 year ago

    const res = await handler(getEvent(oldToken));

    assert.equal(res.statusCode, 200);
    assert.match(res.body, /Unsubscribe/);
  });

  test('missing token -> expiredPage (400), no fetch calls', async (t) => {
    const { handler } = await loadUnsubscribe();
    const fetchMock = t.mock.method(globalThis, 'fetch', routedFetch([]));

    const res = await handler(getEvent(undefined));

    assert.equal(res.statusCode, 400);
    assert.match(res.body, /Link not valid/);
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  test('tampered signature -> expiredPage (400), no fetch calls', async (t) => {
    const { handler } = await loadUnsubscribe();
    const fetchMock = t.mock.method(globalThis, 'fetch', routedFetch([]));
    const badToken = tamperSignature(freshToken());

    const res = await handler(getEvent(badToken));

    assert.equal(res.statusCode, 400);
    assert.match(res.body, /Link not valid/);
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  test('malformed token (no "." separator) -> expiredPage (400)', async (t) => {
    const { handler } = await loadUnsubscribe();
    const fetchMock = t.mock.method(globalThis, 'fetch', routedFetch([]));

    const res = await handler(getEvent('not-a-real-token'));

    assert.equal(res.statusCode, 400);
    assert.equal(fetchMock.mock.calls.length, 0);
  });
});

describe('unsubscribe.mjs - POST (happy path + idempotency)', () => {
  test('happy path with RESEND_CONTACTS_API_KEY unset: unsubscribes, correct PATCH body, Resend never called', async (t) => {
    const { handler } = await loadUnsubscribe({ RESEND_CONTACTS_API_KEY: undefined });
    const fetchMock = t.mock.method(
      globalThis,
      'fetch',
      routedFetch([
        {
          match: (url, method) => url.includes('/rest/v1/questionnaire_responses') && method === 'GET',
          respond: () => jsonResponse(200, [{ email: EMAIL }]),
        },
        {
          match: (url, method) => url.includes('/rest/v1/questionnaire_responses') && method === 'PATCH',
          respond: () => jsonResponse(204, undefined),
        },
      ])
    );

    const before = Date.now();
    const res = await handler(postEvent(freshToken()));
    const after = Date.now();

    assert.equal(res.statusCode, 200);
    assert.match(res.body, /You're unsubscribed/);

    assert.equal(fetchMock.mock.calls.length, 2, 'expected exactly GET row + PATCH row, no Resend call');
    const patchCall = fetchMock.mock.calls.find((c) => callMethod(c) === 'PATCH');
    const patchBody = bodyJson(patchCall);
    assert.equal(patchBody.marketing_consent, false);
    assert.ok(patchBody.unsubscribed_at, 'unsubscribed_at must be set');
    const stampMs = Date.parse(patchBody.unsubscribed_at);
    assert.ok(stampMs >= before && stampMs <= after, 'unsubscribed_at should be "now"');
    assert.ok(!('marketing_consent_confirmed_at' in patchBody), 'must not touch the historical opt-in audit field');
    assert.ok(
      !fetchMock.mock.calls.some((c) => callUrlIncludesResend(c)),
      'Resend must not be contacted when RESEND_CONTACTS_API_KEY is unset'
    );
  });

  test('happy path with RESEND_CONTACTS_API_KEY set: also best-effort PATCHes the Resend contact to unsubscribed:true', async (t) => {
    const { handler } = await loadUnsubscribe({ RESEND_CONTACTS_API_KEY: 'resend-key' });
    const fetchMock = t.mock.method(
      globalThis,
      'fetch',
      routedFetch([
        {
          match: (url, method) => url.includes('/rest/v1/questionnaire_responses') && method === 'GET',
          respond: () => jsonResponse(200, [{ email: EMAIL }]),
        },
        {
          match: (url, method) => url.includes('/rest/v1/questionnaire_responses') && method === 'PATCH',
          respond: () => jsonResponse(204, undefined),
        },
        {
          match: (url, method) => url.includes('api.resend.com/contacts/') && method === 'PATCH',
          respond: () => jsonResponse(200, { object: 'contact' }),
        },
      ])
    );

    const res = await handler(postEvent(freshToken()));

    assert.equal(res.statusCode, 200);
    assert.match(res.body, /You're unsubscribed/);
    assert.equal(fetchMock.mock.calls.length, 3);
    const resendCall = fetchMock.mock.calls.find((c) => callUrlIncludesResend(c));
    assert.ok(resendCall, 'Resend contact PATCH must be attempted');
    assert.equal(callMethod(resendCall), 'PATCH');
    assert.equal(callUrl(resendCall), `https://api.resend.com/contacts/${encodeURIComponent(EMAIL)}`);
    assert.deepEqual(bodyJson(resendCall), { unsubscribed: true });
  });

  test('idempotency: POSTing the same token twice succeeds both times with no "already unsubscribed" branching', async (t) => {
    const { handler } = await loadUnsubscribe({ RESEND_CONTACTS_API_KEY: undefined });
    const fetchMock = t.mock.method(
      globalThis,
      'fetch',
      routedFetch([
        {
          match: (url, method) => url.includes('/rest/v1/questionnaire_responses') && method === 'GET',
          respond: () => jsonResponse(200, [{ email: EMAIL }]),
        },
        {
          match: (url, method) => url.includes('/rest/v1/questionnaire_responses') && method === 'PATCH',
          respond: () => jsonResponse(204, undefined),
        },
      ])
    );
    const token = freshToken();

    const first = await handler(postEvent(token));
    const second = await handler(postEvent(token));

    assert.equal(first.statusCode, 200);
    assert.match(first.body, /You're unsubscribed/);
    assert.equal(second.statusCode, 200);
    assert.match(second.body, /You're unsubscribed/);
    assert.equal(fetchMock.mock.calls.length, 4, 'both calls should independently GET+PATCH - no short-circuit on repeat');
  });
});

describe('unsubscribe.mjs - POST guards (row-mismatch, tampering, malformed input)', () => {
  test('row missing (e.g. already erased) -> expiredPage (400), PATCH never attempted', async (t) => {
    const { handler } = await loadUnsubscribe();
    const fetchMock = t.mock.method(
      globalThis,
      'fetch',
      routedFetch([
        {
          match: (url, method) => url.includes('/rest/v1/questionnaire_responses') && method === 'GET',
          respond: () => jsonResponse(200, []),
        },
      ])
    );

    const res = await handler(postEvent(freshToken()));

    assert.equal(res.statusCode, 400);
    assert.match(res.body, /Link not valid/);
    assert.equal(fetchMock.mock.calls.length, 1, 'only the row lookup should happen, no PATCH');
    assert.equal(callMethod(fetchMock.mock.calls[0]), 'GET');
  });

  test('row.email no longer matches payload.email -> expiredPage (400), PATCH never attempted', async (t) => {
    const { handler } = await loadUnsubscribe();
    const fetchMock = t.mock.method(
      globalThis,
      'fetch',
      routedFetch([
        {
          match: (url, method) => url.includes('/rest/v1/questionnaire_responses') && method === 'GET',
          respond: () => jsonResponse(200, [{ email: 'someone-else@example.com' }]),
        },
      ])
    );

    const res = await handler(postEvent(freshToken()));

    assert.equal(res.statusCode, 400);
    assert.match(res.body, /Link not valid/);
    assert.equal(fetchMock.mock.calls.length, 1);
  });

  test('tampered token on POST -> expiredPage (400), zero fetch calls (fails before touching Supabase)', async (t) => {
    const { handler } = await loadUnsubscribe();
    const fetchMock = t.mock.method(globalThis, 'fetch', routedFetch([]));

    const res = await handler(postEvent(tamperSignature(freshToken())));

    assert.equal(res.statusCode, 400);
    assert.match(res.body, /Link not valid/);
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  test('missing token on POST -> expiredPage (400), zero fetch calls', async (t) => {
    const { handler } = await loadUnsubscribe();
    const fetchMock = t.mock.method(globalThis, 'fetch', routedFetch([]));

    const res = await handler(postEvent(undefined));

    assert.equal(res.statusCode, 400);
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  test('malformed JSON body (Content-Type: application/json) does not throw, returns expiredPage (400)', async (t) => {
    const { handler } = await loadUnsubscribe();
    const fetchMock = t.mock.method(globalThis, 'fetch', routedFetch([]));

    const res = await handler({
      httpMethod: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not valid json',
    });

    assert.equal(res.statusCode, 400);
    assert.match(res.body, /Link not valid/);
    assert.equal(fetchMock.mock.calls.length, 0);
  });
});

describe('unsubscribe.mjs - Resend failure isolation', () => {
  test('Resend PATCH throws (network failure) -> user still sees the success page, not errorPage', async (t) => {
    const { handler } = await loadUnsubscribe({ RESEND_CONTACTS_API_KEY: 'resend-key' });
    t.mock.method(
      globalThis,
      'fetch',
      routedFetch([
        {
          match: (url, method) => url.includes('/rest/v1/questionnaire_responses') && method === 'GET',
          respond: () => jsonResponse(200, [{ email: EMAIL }]),
        },
        {
          match: (url, method) => url.includes('/rest/v1/questionnaire_responses') && method === 'PATCH',
          respond: () => jsonResponse(204, undefined),
        },
        {
          match: (url) => url.includes('api.resend.com'),
          respond: () => {
            throw new Error('simulated network failure');
          },
        },
      ])
    );

    const res = await handler(postEvent(freshToken()));

    assert.equal(res.statusCode, 200, 'a Resend failure must never surface as an error page');
    assert.match(res.body, /You're unsubscribed/);
  });

  test('Resend PATCH returns non-2xx (e.g. contact does not exist) -> user still sees the success page', async (t) => {
    const { handler } = await loadUnsubscribe({ RESEND_CONTACTS_API_KEY: 'resend-key' });
    t.mock.method(
      globalThis,
      'fetch',
      routedFetch([
        {
          match: (url, method) => url.includes('/rest/v1/questionnaire_responses') && method === 'GET',
          respond: () => jsonResponse(200, [{ email: EMAIL }]),
        },
        {
          match: (url, method) => url.includes('/rest/v1/questionnaire_responses') && method === 'PATCH',
          respond: () => jsonResponse(204, undefined),
        },
        {
          match: (url) => url.includes('api.resend.com'),
          respond: () => jsonResponse(404, { message: 'Contact not found' }),
        },
      ])
    );

    const res = await handler(postEvent(freshToken()));

    assert.equal(res.statusCode, 200);
    assert.match(res.body, /You're unsubscribed/);
  });
});

describe('unsubscribe.mjs - other failure paths', () => {
  test('Supabase throws during the row-lookup -> errorPage (502), distinct from expiredPage', async (t) => {
    const { handler } = await loadUnsubscribe();
    t.mock.method(
      globalThis,
      'fetch',
      routedFetch([
        {
          match: (url, method) => url.includes('/rest/v1/questionnaire_responses') && method === 'GET',
          respond: () => {
            throw new Error('simulated Supabase outage');
          },
        },
      ])
    );

    const res = await handler(postEvent(freshToken()));

    assert.equal(res.statusCode, 502);
    assert.match(res.body, /Something went wrong/);
  });

  test('unsupported HTTP method -> 405, no fetch calls', async (t) => {
    const { handler } = await loadUnsubscribe();
    const fetchMock = t.mock.method(globalThis, 'fetch', routedFetch([]));

    const res = await handler({ httpMethod: 'PUT' });

    assert.equal(res.statusCode, 405);
    assert.equal(res.body, 'Method not allowed');
    assert.equal(fetchMock.mock.calls.length, 0);
  });
});

function callUrlIncludesResend(call) {
  return callUrl(call).includes('api.resend.com');
}
