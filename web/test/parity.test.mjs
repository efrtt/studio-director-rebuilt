/*
 * The frozen live readings.
 *
 * `web/parity/` is the working area: dumps the probe POSTs while a session is
 * signed in, gitignored and disposable. `web/test/parity/` is the part worth
 * keeping — one file per page shape, holding what the working build read on a
 * real page and what the reference build read on the same page. Before this
 * suite, that evidence lived only in a chat log and a manual comparison, so a
 * change to the comparator or to the fixture set could quietly stop meaning
 * anything. Now `npm test` runs the same comparison over the frozen set.
 *
 * What it does and does not cover: the dumps are reader *output*, so this gates
 * the view/row/label/control shapes the readers produced, not the readers' code
 * paths. Reader code is gated by `npm run golden` over `test/fixtures/`. A shape
 * with no reference build (payment) is frozen with its reason and is never
 * counted as an agreeing pair.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalise, differences, compareVersions, shippedVersion } from '../tools/parity.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(here, 'parity');

const files = fs.readdirSync(DIR).filter((name) => name.endsWith('.json')).sort();
const pairs = files.map((file) => ({
  file,
  ...JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'))
}));

// Every reader that now takes its content root and its rows from
// model/regions.js, plus the classifier consumers that were already routed
// through it. Losing the last pair for a reader is a coverage regression, not a
// tidy-up, so the required set is written down here.
const REQUIRED_READERS = [
  'attendance',
  'calendar',
  'confirmation',
  'form',
  'index-page',
  'insights',
  'list',
  'month',
  'note',
  'payment',
  'record',
  'report',
  'settings',
  'sheet',
  'trends'
];

test('a frozen pair is well formed', () => {
  assert.ok(pairs.length > 0, 'test/parity/ holds no fixtures');
  for (const pair of pairs) {
    assert.match(pair.file, /^[a-z0-9-]+\.json$/, `${pair.file}: fixtures are named for the page shape`);
    assert.equal(pair.name, pair.file.replace(/\.json$/, ''), `${pair.file}: name must match the file`);
    assert.equal(typeof pair.reader, 'string', `${pair.file}: no reader named`);
    // The probe records `location.pathname + search` in the app tab, so a dump
    // names the app page it read. The one pair collected on a saved page names
    // that page instead, which is why both forms are accepted.
    assert.match(pair.url, /^(?:\/srvda\/admin\.sd(?:\?.*)?|\/web\/parity\/[a-z0-9-]+\.html)$/, `${pair.file}: no captured URL`);
    assert.equal(typeof pair.current.view.kind, 'string', `${pair.file}: the current dump has no view kind`);
    assert.equal(pair.current.kind, undefined, `${pair.file}: dumps hold the kind under view.kind`);
    assert.equal(typeof pair.current.version, 'string', `${pair.file}: the frozen reading has no build version`);
    if (pair.stale !== undefined) {
      assert.equal(typeof pair.stale.captured, 'string', `${pair.file}: the stale declaration has no captured version`);
      assert.equal(typeof pair.stale.why, 'string', `${pair.file}: the stale declaration has no reason`);
    }
  }
});

// The frozen set is evidence about the builds that produced it. A pair captured
// with an older build still proves something — that shape read that way then —
// but it stops being evidence about the artefact we ship, and the gap used to be
// explained in prose where nothing checked it. Now the shipped `@version` is the
// baseline: every pair behind it is listed on every run, and a pair without an
// explicit `stale` declaration fails the suite instead of quietly ageing.
test('a frozen pair older than the shipped build is declared, not just noted', (t) => {
  const shipped = shippedVersion();
  const behind = pairs.filter((pair) => compareVersions(pair.current.version, shipped) < 0);

  for (const pair of behind) {
    t.diagnostic(`parity: ${pair.name} was captured with ${pair.current.version}, shipped artefact is ${shipped}`);
  }
  // Printed on every run, including when nothing is behind: the number is how a
  // reader of the test output tells "the fixture set is current" from "nobody
  // looked".
  t.diagnostic(`parity: ${behind.length} of ${pairs.length} frozen pairs predate the shipped ${shipped}`);

  for (const pair of behind) {
    assert.ok(pair.stale && typeof pair.stale === 'object',
      `${pair.file}: captured with ${pair.current.version}, older than the shipped ${shipped};`
      + ' re-collect it on the live page, or add `stale` to the pair in tools/parity.mjs saying why it stands');
    assert.equal(pair.stale.captured, pair.current.version,
      `${pair.file}: the stale declaration must name the build the reading actually came from`);
    assert.ok(String(pair.stale.why || '').length > 40,
      `${pair.file}: say why this pair stands at an older build, not just that it does`);
  }

  for (const pair of pairs.filter((entry) => !behind.includes(entry))) {
    assert.equal(pair.stale, undefined,
      `${pair.file}: captured with the shipped ${shipped} but still declares a stale capture; drop the declaration`);
  }
});

test('both builds read every frozen pair the same way', () => {
  const compared = pairs.filter((pair) => pair.reference);
  assert.ok(compared.length > 0, 'no frozen pair has a reference build');

  for (const pair of compared) {
    const diffs = differences(normalise(pair.current), normalise(pair.reference));
    const detail = diffs.slice(0, 10).map((diff) => `  ${diff.at}\n    current:   ${JSON.stringify(diff.left)}\n    reference: ${JSON.stringify(diff.right)}`).join('\n');
    assert.equal(diffs.length, 0, `${pair.file} (${pair.url}) disagrees on ${diffs.length} leaf/leaves\n${detail}`);
  }
});

test('a pair with no reference states why, and payment is the only one', () => {
  const unpaired = pairs.filter((pair) => !pair.reference);
  assert.deepEqual(unpaired.map((pair) => pair.name), ['payment'], 'only the payment reader has no reference build');
  for (const pair of unpaired) {
    assert.equal(typeof pair.reason, 'string', `${pair.file}: no reason recorded`);
    assert.ok(pair.reason.length > 40, `${pair.file}: the reason should say what the reference build does instead`);
    assert.equal(pair.current.view.kind, 'editor', `${pair.file}: the frozen reading should be the editor the current build renders`);
  }
});

test('the comparator still notices a changed reading', () => {
  const pair = pairs.find((entry) => entry.reference);
  const left = normalise(pair.current);

  const kind = JSON.parse(JSON.stringify(left));
  kind.view.kind = 'other';
  assert.equal(differences(left, kind).length, 1, 'a different view kind is a difference');

  const control = JSON.parse(JSON.stringify(left));
  const list = control.view.editor ? control.view.editor.controls : control.view.attendance ? control.view.attendance.counts : null;
  assert.ok(Array.isArray(list) && list.length, `${pair.file}: expected a list of readings to perturb`);
  list[0] = typeof list[0] === 'string' ? 'perturbed' : { ...list[0], v: 'perturbed' };
  assert.ok(differences(left, control).length >= 1, 'a changed value inside a list is a difference');

  // Build stamps are normalised away, because they differ on purpose.
  const stamped = JSON.parse(JSON.stringify(pair.current));
  stamped.version = '9.9.9';
  stamped.foot = 'something else';
  stamped.theme = 'wii';
  stamped.digest = 'deadbeef';
  stamped.label = 'other';
  stamped.decision = null;
  assert.equal(differences(normalise(pair.current), normalise(stamped)).length, 0, 'versions, themes and digests are not readings');
});

test('the frozen set covers every reader routed through the classifier', () => {
  const readers = new Set(pairs.map((pair) => pair.reader));
  for (const reader of REQUIRED_READERS) {
    assert.ok(readers.has(reader), `no frozen pair for the ${reader} reader — collect one before dropping its coverage`);
  }
  for (const reader of readers) {
    assert.ok(REQUIRED_READERS.includes(reader), `${reader} is frozen but not named in REQUIRED_READERS; add it there so it stays covered`);
  }
});
