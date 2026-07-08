// Purpose binding between confirm-subscription.mjs and unsubscribe.mjs.
//
// The two endpoints mint/verify structurally similar tokens ({ id, email, iat,
// purpose }, same secret, same HMAC scheme) - but each now REJECTS the other's
// purpose. This replaces the earlier "tokens are cross-compatible by design"
// behaviour: an unsubscribe link must not be replayable against confirm to
// fabricate a marketing-consent confirmation, and vice-versa. The expiry
// asymmetry is preserved (confirm enforces a 7-day expiry; unsubscribe never
// expires) - it's just now checked with each endpoint's own purpose.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { importFresh, mintToken, jsonResponse, routedFetch, bodyJson, BASE_UNSUB_ENV, setEnv } from './helpers.mjs';

const ROW_ID = 'row-cccc-3333';
const EMAIL = 'cross-compat@example.com';

function loadBoth(envOverrides = {}) {
  setEnv({ ...BASE_UNSUB_ENV, ...envOverrides });
  return Promise.all([
    importFresh('netlify/functions/confirm-subscription.mjs'),
    importFresh('netlify/functions/unsubscribe.mjs'),
  ]);
}

function tokenFor(purpose, overrides = {}) {
  return mintToken(BASE_UNSUB_ENV.CONSENT_TOKEN_SECRET, {
    id: ROW_ID, email: EMAIL, iat: Date.now(), purpose, ...overrides,
  });
}

function rowLookupRule(row) {
  return {
    match: (url, method) => url.includes('/rest/v1/questionnaire_responses') && method === 'GET',
    respond: () => jsonResponse(200, [row]),
  };
}

const patchRule = {
  match: (url, method) => url.includes('/rest/v1/questionnaire_responses') && method === 'PATCH',
  respond: () => jsonResponse(204, undefined),
};

const postBody = (token) => ({ httpMethod: 'POST', headers: {}, body: new URLSearchParams({ t: token }).toString() });
const patchOf = (mock) => bodyJson(mock.mock.calls.find((c) => (c.arguments[1]?.method || '').toUpperCase() === 'PATCH'));

describe('token purpose binding between confirm-subscription.mjs and unsubscribe.mjs', () => {
  test('a confirm token works on confirm (GET) but is rejected by unsubscribe', async (t) => {
    const [confirmMod, unsubMod] = await loadBoth({ RESEND_CONTACTS_API_KEY: undefined, RESEND_AUDIENCE_ID: undefined });
    t.mock.method(globalThis, 'fetch', routedFetch([]));
    const token = tokenFor('confirm');

    const confirmRes = await confirmMod.handler({ httpMethod: 'GET', queryStringParameters: { t: token } });
    const unsubRes = await unsubMod.handler({ httpMethod: 'GET', queryStringParameters: { t: token } });

    assert.equal(confirmRes.statusCode, 200);
    assert.match(confirmRes.body, /Confirm your subscription/);
    assert.equal(unsubRes.statusCode, 400, 'a confirm token must NOT be honoured by unsubscribe');
    assert.match(unsubRes.body, /Link not valid/);
  });

  test('an unsubscribe token works on unsubscribe (GET) but is rejected by confirm', async (t) => {
    const [confirmMod, unsubMod] = await loadBoth({ RESEND_CONTACTS_API_KEY: undefined, RESEND_AUDIENCE_ID: undefined });
    t.mock.method(globalThis, 'fetch', routedFetch([]));
    const token = tokenFor('unsubscribe');

    const unsubRes = await unsubMod.handler({ httpMethod: 'GET', queryStringParameters: { t: token } });
    const confirmRes = await confirmMod.handler({ httpMethod: 'GET', queryStringParameters: { t: token } });

    assert.equal(unsubRes.statusCode, 200);
    assert.match(unsubRes.body, /Unsubscribe/);
    assert.equal(confirmRes.statusCode, 400, 'an unsubscribe token must NOT be honoured by confirm');
    assert.match(confirmRes.body, /Link expired/);
  });

  test('each POST path writes only for its own purpose; the wrong purpose writes nothing', async (t) => {
    const [confirmMod, unsubMod] = await loadBoth({ RESEND_CONTACTS_API_KEY: undefined, RESEND_AUDIENCE_ID: undefined });

    // Confirm token via confirm POST -> stamps the confirmation timestamp.
    const confirmToken = tokenFor('confirm');
    const confirmFetch = t.mock.method(globalThis, 'fetch', routedFetch([rowLookupRule({ email: EMAIL, marketing_consent: true }), patchRule]));
    const confirmRes = await confirmMod.handler(postBody(confirmToken));
    assert.equal(confirmRes.statusCode, 200);
    assert.match(confirmRes.body, /You're confirmed/);
    assert.ok(patchOf(confirmFetch).marketing_consent_confirmed_at);
    confirmFetch.mock.restore();

    // That same confirm token via unsubscribe POST -> rejected, zero writes.
    const rejectFetch = t.mock.method(globalThis, 'fetch', routedFetch([]));
    const rejectRes = await unsubMod.handler(postBody(confirmToken));
    assert.equal(rejectRes.statusCode, 400);
    assert.equal(rejectFetch.mock.calls.length, 0, 'a confirm token must not drive any unsubscribe write');
    rejectFetch.mock.restore();

    // Unsubscribe token via unsubscribe POST -> records the opt-out.
    const unsubToken = tokenFor('unsubscribe');
    const unsubFetch = t.mock.method(globalThis, 'fetch', routedFetch([rowLookupRule({ email: EMAIL }), patchRule]));
    const unsubRes = await unsubMod.handler(postBody(unsubToken));
    assert.equal(unsubRes.statusCode, 200);
    assert.match(unsubRes.body, /You're unsubscribed/);
    assert.equal(patchOf(unsubFetch).marketing_consent, false);
    assert.ok(patchOf(unsubFetch).unsubscribed_at);
  });

  test('expiry asymmetry preserved: a 30-day-old confirm token is rejected; a 30-day-old unsubscribe token still works', async (t) => {
    const [confirmMod, unsubMod] = await loadBoth({ RESEND_CONTACTS_API_KEY: undefined, RESEND_AUDIENCE_ID: undefined });
    t.mock.method(globalThis, 'fetch', routedFetch([]));
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const oldConfirm = tokenFor('confirm', { iat: Date.now() - thirtyDays });
    const oldUnsub = tokenFor('unsubscribe', { iat: Date.now() - thirtyDays });

    const confirmRes = await confirmMod.handler({ httpMethod: 'GET', queryStringParameters: { t: oldConfirm } });
    const unsubRes = await unsubMod.handler({ httpMethod: 'GET', queryStringParameters: { t: oldUnsub } });

    assert.equal(confirmRes.statusCode, 400, 'confirm-subscription.mjs must still enforce the 7-day expiry');
    assert.match(confirmRes.body, /Link expired/);
    assert.equal(unsubRes.statusCode, 200, 'unsubscribe.mjs must never expire a footer link');
    assert.match(unsubRes.body, /Unsubscribe/);
  });
});
