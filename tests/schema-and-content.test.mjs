// Non-application-code checks: scripts/supabase-schema.sql,
// src/content/legal/privacy.yaml, and the nocodb/ ops config are not
// exercised by any running Netlify Function, so there's nothing to invoke a
// handler against. These are lightweight content/sanity assertions instead
// (per changes.md's own "What the Tester should focus on": "nothing to unit
// test, but worth a read-through for accuracy"). The build itself
// (`npm run build`) was additionally run manually and independently
// confirmed to succeed with the new privacy.yaml sentence rendering
// correctly - see test-results.md.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './helpers.mjs';

function read(relPath) {
  return readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

describe('scripts/supabase-schema.sql - re-runnable ALTERs', () => {
  const sql = read('scripts/supabase-schema.sql');

  test('all three new columns use "add column if not exists" (safe against fresh AND already-live tables)', () => {
    assert.match(
      sql,
      /alter table questionnaire_responses add column if not exists unsubscribed_at timestamptz;/
    );
    assert.match(
      sql,
      /alter table questionnaire_responses add column if not exists status text not null default 'new';/
    );
    assert.match(
      sql,
      /alter table questionnaire_responses add column if not exists notes text;/
    );
  });

  test('the ALTERs come after the RLS block, not inside the create table body (no drift between fresh installs and the ALTERs)', () => {
    const rlsIndex = sql.indexOf('enable row level security');
    const alterIndex = sql.indexOf('add column if not exists unsubscribed_at');
    assert.ok(rlsIndex > -1 && alterIndex > -1);
    assert.ok(alterIndex > rlsIndex, 'ALTERs should be appended after the RLS block per spec');
  });
});

describe('src/content/legal/privacy.yaml - single-sentence consent-paragraph change', () => {
  const yaml = read('src/content/legal/privacy.yaml');

  test('contains the exact one-click unsubscribe sentence from the spec, verbatim', () => {
    const expected =
      'Where you ask to be contacted about our services, we send a confirmation email and only treat that consent as active once you have clicked to confirm it. Every marketing email includes a one-click unsubscribe link, or you can withdraw either form of consent at any time by contacting us at <a href="mailto:privacy@valorapartners.co.uk" class="legal__link">privacy@valorapartners.co.uk</a>.';
    assert.ok(yaml.includes(expected), 'expected the exact sentence specified in spec.md task 1h');
  });

  test('lastUpdated is untouched (content-owner decision, not the Coder\'s to bump)', () => {
    assert.match(yaml, /^lastUpdated: 6 July 2026$/m);
  });

  test('unrelated sections/paragraphs are untouched', () => {
    assert.ok(yaml.includes('We use strictly necessary cookies only.'), 'Cookies section paragraph should be unchanged');
    assert.ok(
      yaml.includes('Under UK GDPR you have the right to access, correct or request deletion'),
      'Your rights section paragraph should be unchanged'
    );
    assert.ok(
      yaml.includes('Supabase (database hosting, EU region) and Resend (transactional email delivery)'),
      'data-processors paragraph should be unchanged'
    );
  });
});

describe('nocodb/docker-compose.yml <-> nocodb/.env.example - no hidden env var/behaviour change', () => {
  const compose = read('nocodb/docker-compose.yml');
  const envExample = read('nocodb/.env.example');

  test('every ${VAR} referenced in the compose file has a matching placeholder in .env.example (or is NC_AUTH_JWT_SECRET, declared separately)', () => {
    const referenced = [...compose.matchAll(/\$\{([A-Z_]+)\}/g)].map((m) => m[1]);
    assert.ok(referenced.length > 0, 'sanity check: the compose file should reference at least one env var');
    const declared = [...envExample.matchAll(/^([A-Z_]+)=/gm)].map((m) => m[1]);
    for (const name of referenced) {
      assert.ok(declared.includes(name), `${name} is referenced in docker-compose.yml but not declared in .env.example`);
    }
  });

  test('the pinned image tag is not "latest"', () => {
    const match = compose.match(/image:\s*nocodb\/nocodb:(\S+)/);
    assert.ok(match, 'expected an image: nocodb/nocodb:<tag> line');
    assert.notEqual(match[1], 'latest');
  });

  test('the reworded NC_DB comment carries no functional/env-var change (comment-only diff)', () => {
    // The spec's literal comment text referenced "OPEN QUESTION 2", an
    // internal .pipeline/spec.md-only pointer that wouldn't mean anything
    // once committed - changes.md flags this as a deliberate wording-only
    // deviation. Confirm here that the actual NC_DB value/shape is
    // unaffected: still the pg://HOST:PORT?u=USER&p=PASSWORD&d=DATABASE
    // format against the same four connection placeholders.
    assert.match(
      compose,
      /NC_DB: "pg:\/\/\$\{SUPABASE_DB_HOST\}:\$\{SUPABASE_DB_PORT\}\?u=\$\{SUPABASE_DB_USER\}&p=\$\{SUPABASE_DB_PASSWORD\}&d=\$\{SUPABASE_DB_NAME\}"/
    );
  });
});
