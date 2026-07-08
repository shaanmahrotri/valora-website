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

const ROW_ID = 'row-bbbb-2222';
const EMAIL = 'confirm-jane@example.com';

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

async function loadConfirm(envOverrides = {}) {
  setEnv({ ...BASE_UNSUB_ENV, ...envOverrides });
  return importFresh('netlify/functions/confirm-subscription.mjs');
}

function rowLookupRule(row) {
  return {
    match: (url, method) => url.includes('/rest/v1/questionnaire_responses') && method === 'GET',
    respond: () => jsonResponse(200, row === null ? [] : [row]),
  };
}

const patchRule = {
  match: (url, method) => url.includes('/rest/v1/questionnaire_responses') && method === 'PATCH',
  respond: () => jsonResponse(204, undefined),
};

describe('confirm-subscription.mjs - GET', () => {
  test('valid, fresh token renders the confirm form, no fetch calls', async (t) => {
    const { handler } = await loadConfirm();
    const fetchMock = t.mock.method(globalThis, 'fetch', routedFetch([]));
    const token = freshToken();

    const res = await handler(getEvent(token));

    assert.equal(res.statusCode, 200);
    assert.match(res.body, /Confirm your subscription/);
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  test('token older than 7 days -> expiredPage (400) - expiry IS enforced here', async (t) => {
    const { handler } = await loadConfirm();
    t.mock.method(globalThis, 'fetch', routedFetch([]));
    const oldToken = freshToken({ iat: Date.now() - 8 * 24 * 60 * 60 * 1000 });

    const res = await handler(getEvent(oldToken));

    assert.equal(res.statusCode, 400);
    assert.match(res.body, /Link expired/);
  });
});

describe('confirm-subscription.mjs - POST happy path + Resend audience sync', () => {
  test('RESEND_API_KEY/RESEND_AUDIENCE_ID both unset: confirms successfully, Resend never contacted', async (t) => {
    const { handler } = await loadConfirm({ RESEND_API_KEY: undefined, RESEND_AUDIENCE_ID: undefined });
    const fetchMock = t.mock.method(globalThis, 'fetch', routedFetch([rowLookupRule({ email: EMAIL }), patchRule]));

    const res = await handler(postEvent(freshToken()));

    assert.equal(res.statusCode, 200);
    assert.match(res.body, /You're confirmed/);
    assert.equal(fetchMock.mock.calls.length, 2, 'expected only GET row + PATCH row, no Resend call');
    const patchBody = bodyJson(fetchMock.mock.calls.find((c) => callMethod(c) === 'PATCH'));
    assert.ok(patchBody.marketing_consent_confirmed_at, 'should stamp the confirmation timestamp');
  });

  test('RESEND_API_KEY/RESEND_AUDIENCE_ID both set: also POSTs the contact into the Resend Audience', async (t) => {
    const { handler } = await loadConfirm({ RESEND_API_KEY: 'resend-key', RESEND_AUDIENCE_ID: 'audience-123' });
    const fetchMock = t.mock.method(
      globalThis,
      'fetch',
      routedFetch([
        rowLookupRule({ email: EMAIL }),
        patchRule,
        {
          match: (url, method) => url === 'https://api.resend.com/contacts' && method === 'POST',
          respond: () => jsonResponse(200, { id: 'contact-1' }),
        },
      ])
    );

    const res = await handler(postEvent(freshToken()));

    assert.equal(res.statusCode, 200);
    assert.match(res.body, /You're confirmed/);
    assert.equal(fetchMock.mock.calls.length, 3);
    const resendCall = fetchMock.mock.calls.find((c) => callUrl(c).includes('api.resend.com'));
    assert.ok(resendCall);
    assert.deepEqual(bodyJson(resendCall), {
      email: EMAIL,
      unsubscribed: false,
      segments: [{ id: 'audience-123' }],
    });
  });

  test('Resend POST throws (network failure) -> user still sees confirmedPage, not errorPage', async (t) => {
    const { handler } = await loadConfirm({ RESEND_API_KEY: 'resend-key', RESEND_AUDIENCE_ID: 'audience-123' });
    t.mock.method(
      globalThis,
      'fetch',
      routedFetch([
        rowLookupRule({ email: EMAIL }),
        patchRule,
        {
          match: (url) => url.includes('api.resend.com'),
          respond: () => {
            throw new Error('simulated network failure');
          },
        },
      ])
    );

    const res = await handler(postEvent(freshToken()));

    assert.equal(res.statusCode, 200);
    assert.match(res.body, /You're confirmed/);
  });

  test('Resend POST returns non-2xx (e.g. duplicate contact) -> user still sees confirmedPage', async (t) => {
    const { handler } = await loadConfirm({ RESEND_API_KEY: 'resend-key', RESEND_AUDIENCE_ID: 'audience-123' });
    t.mock.method(
      globalThis,
      'fetch',
      routedFetch([
        rowLookupRule({ email: EMAIL }),
        patchRule,
        {
          match: (url) => url.includes('api.resend.com'),
          respond: () => jsonResponse(409, { message: 'duplicate' }),
        },
      ])
    );

    const res = await handler(postEvent(freshToken()));

    assert.equal(res.statusCode, 200);
    assert.match(res.body, /You're confirmed/);
  });
});

describe('confirm-subscription.mjs - guards still short-circuit before the new Resend call', () => {
  test('row missing -> expiredPage (400); Resend never attempted', async (t) => {
    const { handler } = await loadConfirm({ RESEND_API_KEY: 'resend-key', RESEND_AUDIENCE_ID: 'audience-123' });
    const fetchMock = t.mock.method(globalThis, 'fetch', routedFetch([rowLookupRule(null)]));

    const res = await handler(postEvent(freshToken()));

    assert.equal(res.statusCode, 400);
    assert.match(res.body, /Link expired/);
    assert.equal(fetchMock.mock.calls.length, 1, 'only the row lookup - no PATCH, no Resend call');
  });

  test('row.email mismatch -> expiredPage (400); Resend never attempted', async (t) => {
    const { handler } = await loadConfirm({ RESEND_API_KEY: 'resend-key', RESEND_AUDIENCE_ID: 'audience-123' });
    const fetchMock = t.mock.method(
      globalThis,
      'fetch',
      routedFetch([rowLookupRule({ email: 'someone-else@example.com' })])
    );

    const res = await handler(postEvent(freshToken()));

    assert.equal(res.statusCode, 400);
    assert.equal(fetchMock.mock.calls.length, 1);
  });

  test('tampered token on POST -> expiredPage (400), zero fetch calls', async (t) => {
    const { handler } = await loadConfirm();
    const fetchMock = t.mock.method(globalThis, 'fetch', routedFetch([]));

    const res = await handler(postEvent(tamperSignature(freshToken())));

    assert.equal(res.statusCode, 400);
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  test('Supabase throws during the row lookup -> errorPage (502); Resend never attempted', async (t) => {
    const { handler } = await loadConfirm({ RESEND_API_KEY: 'resend-key', RESEND_AUDIENCE_ID: 'audience-123' });
    const fetchMock = t.mock.method(
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
    assert.equal(fetchMock.mock.calls.length, 1, 'the function must return before ever reaching the Resend call');
  });
});

describe('confirm-subscription.mjs - method guard', () => {
  test('unsupported HTTP method -> 405, no fetch calls', async (t) => {
    const { handler } = await loadConfirm();
    const fetchMock = t.mock.method(globalThis, 'fetch', routedFetch([]));

    const res = await handler({ httpMethod: 'DELETE' });

    assert.equal(res.statusCode, 405);
    assert.equal(fetchMock.mock.calls.length, 0);
  });
});
