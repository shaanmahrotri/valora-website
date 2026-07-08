// Dedicated coverage for the specific behaviour changes.md/spec.md call out
// as worth confirming explicitly: confirm-subscription.mjs and
// unsubscribe.mjs mint/verify structurally identical tokens
// (`{ id, email, iat }`, same secret, same HMAC scheme) by design, so a
// token is accepted by *either* endpoint - and unsubscribe.mjs's
// verifyToken has deliberately had its expiry check removed, so an old
// token that confirm-subscription now rejects still works there.
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

describe('token cross-compatibility between confirm-subscription.mjs and unsubscribe.mjs', () => {
  test('a freshly minted token GETs successfully on both endpoints', async (t) => {
    const [confirmMod, unsubMod] = await loadBoth({ RESEND_CONTACTS_API_KEY: undefined, RESEND_AUDIENCE_ID: undefined });
    t.mock.method(globalThis, 'fetch', routedFetch([]));
    const token = mintToken(BASE_UNSUB_ENV.CONSENT_TOKEN_SECRET, { id: ROW_ID, email: EMAIL, iat: Date.now() });

    const confirmRes = await confirmMod.handler({ httpMethod: 'GET', queryStringParameters: { t: token } });
    const unsubRes = await unsubMod.handler({ httpMethod: 'GET', queryStringParameters: { t: token } });

    assert.equal(confirmRes.statusCode, 200);
    assert.match(confirmRes.body, /Confirm your subscription/);
    assert.equal(unsubRes.statusCode, 200);
    assert.match(unsubRes.body, /Unsubscribe/);
  });

  test('the same token also writes successfully through the full POST path on both endpoints', async (t) => {
    const [confirmMod, unsubMod] = await loadBoth({ RESEND_CONTACTS_API_KEY: undefined, RESEND_AUDIENCE_ID: undefined });
    const token = mintToken(BASE_UNSUB_ENV.CONSENT_TOKEN_SECRET, { id: ROW_ID, email: EMAIL, iat: Date.now() });
    const postEvent = { httpMethod: 'POST', headers: {}, body: new URLSearchParams({ t: token }).toString() };

    const confirmFetch = t.mock.method(globalThis, 'fetch', routedFetch([rowLookupRule({ email: EMAIL }), patchRule]));
    const confirmRes = await confirmMod.handler(postEvent);
    assert.equal(confirmRes.statusCode, 200);
    assert.match(confirmRes.body, /You're confirmed/);
    const confirmPatchBody = bodyJson(confirmFetch.mock.calls.find((c) => (c.arguments[1]?.method || '').toUpperCase() === 'PATCH'));
    assert.ok(confirmPatchBody.marketing_consent_confirmed_at);
    confirmFetch.mock.restore();

    const unsubFetch = t.mock.method(globalThis, 'fetch', routedFetch([rowLookupRule({ email: EMAIL }), patchRule]));
    const unsubRes = await unsubMod.handler(postEvent);
    assert.equal(unsubRes.statusCode, 200);
    assert.match(unsubRes.body, /You're unsubscribed/);
    const unsubPatchBody = bodyJson(unsubFetch.mock.calls.find((c) => (c.arguments[1]?.method || '').toUpperCase() === 'PATCH'));
    assert.equal(unsubPatchBody.marketing_consent, false);
    assert.ok(unsubPatchBody.unsubscribed_at);
  });

  test('expiry asymmetry: a 30-day-old token is REJECTED by confirm-subscription but ACCEPTED by unsubscribe', async (t) => {
    const [confirmMod, unsubMod] = await loadBoth({ RESEND_CONTACTS_API_KEY: undefined, RESEND_AUDIENCE_ID: undefined });
    t.mock.method(globalThis, 'fetch', routedFetch([]));
    const oldToken = mintToken(BASE_UNSUB_ENV.CONSENT_TOKEN_SECRET, {
      id: ROW_ID,
      email: EMAIL,
      iat: Date.now() - 30 * 24 * 60 * 60 * 1000,
    });

    const confirmRes = await confirmMod.handler({ httpMethod: 'GET', queryStringParameters: { t: oldToken } });
    const unsubRes = await unsubMod.handler({ httpMethod: 'GET', queryStringParameters: { t: oldToken } });

    assert.equal(confirmRes.statusCode, 400, 'confirm-subscription.mjs must still enforce the 7-day expiry');
    assert.match(confirmRes.body, /Link expired/);

    assert.equal(unsubRes.statusCode, 200, 'unsubscribe.mjs must never expire a footer link');
    assert.match(unsubRes.body, /Unsubscribe/);
  });
});
