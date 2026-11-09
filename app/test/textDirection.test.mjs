import test from 'node:test';
import assert from 'node:assert/strict';
import { isolateMixed, textDirection, visibleBidiControls } from '../src/lib/textDirection.ts';
import { normalizeThemeMode } from '../src/state/settingsSchema.ts';
import { parsePairingLink } from '../src/lib/pairingLink.ts';

test('message direction follows first strong text, not the UI locale', () => {
  assert.equal(textDirection('Hello from OpenCode', true), 'ltr');
  assert.equal(textDirection('مرحبا من OpenCode', false), 'rtl');
  assert.equal(textDirection('123 — مرحبا', false), 'rtl');
  assert.equal(textDirection('123', true), 'rtl');
  assert.equal(textDirection('، ١٢٣ — Hello', true), 'ltr');
  assert.equal(textDirection('\u064e ١٢٣ — Hello', true), 'ltr');
  assert.equal(textDirection('١٢٣ — مرحبا', false), 'rtl');
  assert.equal(textDirection('Écrivez en français', true), 'ltr');
  assert.equal(textDirection('Привет', true), 'ltr');
  assert.equal(textDirection('שלום', false), 'rtl');
});

test('technical fragments in Arabic are bidi-isolated without changing their text', () => {
  assert.equal(
    isolateMixed('افتح /tmp/foo.txt ثم https://example.com/a?b=1'),
    'افتح \u2066/tmp/foo.txt\u2069 ثم \u2066https://example.com/a?b=1\u2069',
  );
  assert.equal(
    isolateMixed('افتح C:\\Users\\me\\foo.txt'),
    'افتح \u2066C:\\Users\\me\\foo.txt\u2069',
  );
  assert.equal(isolateMixed('A plain English path /tmp/foo.txt'), 'A plain English path /tmp/foo.txt');
});

test('invisible bidi overrides and isolates are displayed as visible markers', () => {
  assert.equal(visibleBidiControls('report\u202Eexe'), 'report⟦U+202E⟧exe');
  assert.equal(visibleBidiControls('x\u2066hidden\u2069'), 'x⟦U+2066⟧hidden⟦U+2069⟧');
  assert.equal(visibleBidiControls('safe\u200Ftext\u061C'), 'safe⟦U+200F⟧text⟦U+061C⟧');
  assert.equal(visibleBidiControls('a\u206Fz'), 'a⟦U+206F⟧z');
  assert.equal(visibleBidiControls('عربي English'), 'عربي English');
});

test('theme hydration accepts every supported mode and safely normalizes invalid values', () => {
  assert.equal(normalizeThemeMode('dark'), 'dark');
  assert.equal(normalizeThemeMode('light'), 'light');
  assert.equal(normalizeThemeMode('system'), 'system');
  assert.equal(normalizeThemeMode('unknown'), 'light');
  assert.equal(normalizeThemeMode(null), 'light');
});

test('parsePairingLink does not mistake long URLs for tokens', () => {
  const longUrl = 'https://my-long-tunnel-subdomain-12345678901234567890.example.com';
  assert.equal(parsePairingLink(longUrl), null);

  const plainWithToken = `URL: https://my-long-tunnel-subdomain-12345678901234567890.example.com Token: 12345678901234567890123456789012`;
  assert.deepEqual(parsePairingLink(plainWithToken), {
    url: 'https://my-long-tunnel-subdomain-12345678901234567890.example.com',
    token: '12345678901234567890123456789012',
  });

  const deepLink = 'opencode-mobile://connect?url=https%3A%2F%2Fexample.com&token=12345678901234567890123456789012';
  assert.deepEqual(parsePairingLink(deepLink), {
    url: 'https://example.com',
    token: '12345678901234567890123456789012',
  });
});
