// Shared test utilities for the Netlify Functions test suite.
//
// These functions are plain `.mjs` files exporting a single `handler` (no
// framework, no shared module between them - see CLAUDE.md / spec.md). Tests
// invoke `handler(event)` directly and stub `global.fetch` (the only I/O
// boundary - Supabase and Resend are both raw `fetch` calls), rather than
// spinning up a server.
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export const REPO_ROOT = path.resolve(import.meta.dirname, '..');

let cacheBustCounter = 0;

// Netlify Functions read top-level `const X = process.env.X` once, at
// import time. To let different tests exercise different env-var
// combinations (e.g. RESEND_API_KEY set vs. unset) in the same process,
// each import gets a unique query string so Node's ESM loader treats it as
// a distinct module instance instead of returning a cached one. Set the
// desired process.env values immediately before calling this.
export async function importFresh(relPathFromRepoRoot) {
  const abs = path.resolve(REPO_ROOT, relPathFromRepoRoot);
  const url = `${pathToFileURL(abs).href}?t=${Date.now()}-${cacheBustCounter++}`;
  return import(url);
}

// Mirrors signConfirmationToken (submit-questionnaire.mjs) and the
// verifyToken checks in confirm-subscription.mjs / unsubscribe.mjs. This is
// the documented external token contract - `{ id, email, iat }`, HMAC-SHA256
// over base64url(JSON), same shared secret - not a peek at private
// internals. Minting tokens this way is exactly what any correctly-signed
// caller (i.e. the real submit-questionnaire.mjs) produces.
export function mintToken(secret, payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('hex');
  return `${encoded}.${signature}`;
}

// Flips one hex character of a valid token's signature so it no longer
// matches - simulates a tampered/corrupted link without touching the
// payload itself.
export function tamperSignature(token) {
  const [encoded, signature] = token.split('.');
  const lastChar = signature.at(-1);
  const replacement = lastChar === '0' ? '1' : '0';
  return `${encoded}.${signature.slice(0, -1)}${replacement}`;
}

// Decodes a token's payload without verifying its signature - used only to
// assert *what* a token produced by the code under test encodes (e.g. that
// buildUnsubscribeUrl embedded the right id/email), the same way any
// consumer would read it.
export function decodePayload(token) {
  const [encoded] = token.split('.');
  return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
}

export function jsonResponse(status, data) {
  return new Response(data === undefined ? null : JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Small URL/method-routed fetch double. `rules` is checked in order; the
// first whose `match(url, method, opts)` returns true handles the call. An
// unmatched call throws loudly instead of silently resolving to undefined -
// that turns "an extra network call nobody expected" into a visible test
// failure instead of a false pass.
export function routedFetch(rules) {
  return async (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    for (const rule of rules) {
      if (rule.match(String(url), method, opts)) {
        return rule.respond(String(url), method, opts);
      }
    }
    throw new Error(`Unhandled mock fetch call: ${method} ${url}`);
  };
}

export function bodyJson(call) {
  const opts = call.arguments[1] || {};
  return opts.body ? JSON.parse(opts.body) : undefined;
}

export function callUrl(call) {
  return String(call.arguments[0]);
}

export function callMethod(call) {
  return (call.arguments[1]?.method || 'GET').toUpperCase();
}

export const BASE_UNSUB_ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  CONSENT_TOKEN_SECRET: 'test-shared-secret',
};

export function setEnv(overrides) {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
