// The Island theme's type is embedded, not fetched, so the sheet that ships *is*
// the font. That makes two things worth guarding that no screenshot would catch:
//
//   - a data: URI that decodes to something other than the tracked .woff2 (a
//     truncated file, an HTML error page fetched instead of a font, or a hand
//     edit that swapped the face), which fails at paint time, in a browser,
//     silently; and
//   - the sheet drifting away from `tools/embed-font.mjs`, so the next
//     regeneration produces a diff nobody asked for.
//
// The size ceiling is the third: one variable face is ~52 KiB of base64, three
// static weights would be more than twice that, and the userscript carries this
// on every page view.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const here = fileURLToPath(new URL('.', import.meta.url));

const sheet = read('../src/acnh-fonts.css');
const faces = [...sheet.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);

test('the Island theme embeds one Nunito variable face, latin only', () => {
  assert.equal(faces.length, 1, 'one face covers 200-1000; extra cuts are waste');
  const [, body] = [null, faces[0]];
  assert.match(body, /font-family:\s*'Nunito'/, 'the family the theme asks for');
  assert.match(body, /font-weight:\s*200 1000/, 'a variable range, not one weight');
  assert.match(body, /font-style:\s*normal/);
  assert.match(body, /font-display:\s*swap/, 'the page paints before the face parses');
  assert.match(body, /unicode-range:\s*U\+0000-00FF/, 'latin, so other scripts fall through');
  assert.doesNotMatch(body, /url\((?!data:)/, 'nothing may be fetched at runtime');
});

test('the embedded bytes are the tracked woff2, byte for byte', () => {
  const source = readFileSync(new URL('../src/fonts/nunito-latin-var.woff2', import.meta.url));
  assert.equal(source.subarray(0, 4).toString('latin1'), 'wOF2', 'wOF2 magic');

  const [, base64] = faces[0].match(/data:font\/woff2;base64,([A-Za-z0-9+/=]+)/) || [];
  assert.ok(base64, 'the src is a base64 woff2 data: URI');

  const embedded = Buffer.from(base64, 'base64');
  assert.equal(embedded.length, source.length, 'same length as src/fonts/nunito-latin-var.woff2');
  assert.ok(embedded.equals(source), 'identical bytes to src/fonts/nunito-latin-var.woff2');
  // A Latin-only Nunito is ~39 KB. A subset that lost its hinting or a face that
  // swallowed another script's range would sit outside this window.
  assert.ok(embedded.length > 20000 && embedded.length < 60000, `plausible subset size (${embedded.length})`);
  assert.ok(sheet.length < 80 * 1024, `sheet stays under 80 KiB (${sheet.length})`);
});

test('the licence travels with the font', () => {
  assert.match(sheet, /SIL Open Font License 1\.1/);
  assert.match(sheet, /Copyright 2014 The Nunito Project Authors/);
  assert.match(sheet, /fonts\/OFL-nunito\.txt/, 'the notice names the full text');

  const licence = read('../src/fonts/OFL-nunito.txt');
  assert.match(licence, /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.match(licence, /Nunito Project Authors/);
  assert.match(licence, /PERMISSION & CONDITIONS/, 'it is the whole licence, not a stub');
});

test('the sheet still matches its generator', () => {
  assert.doesNotThrow(
    () => execFileSync(process.execPath, ['tools/embed-font.mjs', '--check'], { cwd: here + '..', stdio: 'pipe' }),
    'tools/embed-font.mjs --check: regenerate with `node tools/embed-font.mjs`',
  );
});
