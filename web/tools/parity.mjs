// Reader parity between two builds, in one command each.
//
// The rebuild reads the page it is given; a change to a reader is only safe if
// the same live page still reads the same way. The golden models cover the
// captured pages, but the live admin page is heavier and is the only place a
// mount, a theme or a timing bug shows up. This tool is the live half:
//
//   node tools/parity.mjs snapshot [ref]     two builds, side by side
//   node tools/parity.mjs compare a.json b.json
//   node tools/parity.mjs fixtures           freeze the dumps into test/parity/
//
// `snapshot` builds the working tree, copies the artefact, extracts the other
// ref's committed artefact with `git show`, and writes both into `web/parity/`
// (gitignored) together with a manifest of labels, versions and URLs. The builds
// are served by the ordinary dev server:
//
//   node web/tools/serve.mjs . 4801
//
// Then, in a signed-in app tab, inject `web/tools/parity-probe.js`, run each
// build against the same page (reloading between builds — the overlay is not torn
// down), and the probe POSTs `web/parity/<label>.json` to the dev server. Compare
// them here; the exit status is 1 when the readers disagree.
//
// `fixtures` is what turns a live pass into a gate. It copies the agreeing pairs
// out of the gitignored working area into `web/test/parity/`, one file per page
// shape, and `npm test` (test/parity.test.mjs) then requires every frozen pair to
// keep agreeing on every run. Each pair records the build it was captured with,
// and the suite compares that against the shipped artefact's `@version`: a pair
// older than the build we ship is skew, and it must either be re-collected or
// carry an explicit `stale` declaration (captured version plus why) — prose in a
// `note` is not enough. So a live pass is argued once, and a change to
// `normalise`, `differences` or the fixture set fails in CI rather than after the
// next manual session. It refuses to freeze a pair the builds disagree on, or one
// carrying money-like text; a shape with no reference build records why instead.
//
// What parity means: the view the reader chose, the tabs, the rows, the labels,
// the control types and a digest of the values, all in document order. Versions
// and themes are reported but not compared — the two builds deliberately differ,
// and `main` has no Wii theme.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, '..');
const repo = path.resolve(web, '..');
const outDir = path.join(web, 'parity');
const fixtureDir = path.join(web, 'test', 'parity');
const ARTEFACT = 'studio-director-rebuilt.user.js';
const PROBE_PATH = 'web/tools/parity-probe.js';
const PORT = 4801;

function usage() {
  console.log(`usage:
  node tools/parity.mjs snapshot [ref] [--no-build]   build both sides into web/parity/
  node tools/parity.mjs compare <a.json> <b.json>     compare two dumps (exit 1 on a difference)
  node tools/parity.mjs fixtures                      freeze web/parity/*.json into test/parity/`);
}

function versionOf(text) {
  const match = String(text || '').match(/^\/\/\s*@version\s+(\S+)/m);
  return match ? match[1] : 'unknown';
}

// Version order, for the skew gate: a frozen pair is evidence about the build
// that produced it, so a pair older than the shipped artefact has to say so.
export function compareVersions(left, right) {
  const a = String(left || '0').split('.').map((part) => parseInt(part, 10) || 0);
  const b = String(right || '0').split('.').map((part) => parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length, 3); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

// The version of the build this repository would actually ship: the artefact's
// own `@version`, which is what a user installs. The package version is the
// fallback for the moment before the first build.
export function shippedVersion() {
  const artefact = path.join(repo, ARTEFACT);
  if (fs.existsSync(artefact)) {
    const version = versionOf(fs.readFileSync(artefact, 'utf8'));
    if (version !== 'unknown') return version;
  }
  return JSON.parse(fs.readFileSync(path.join(web, 'package.json'), 'utf8')).version;
}

function npmBuild() {
  // `.cmd` shims need a shell on Windows, and a shell is harmless on POSIX.
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const res = spawnSync(npm, ['run', 'userscript'], {
    cwd: web,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (res.error) throw new Error('npm run userscript: ' + res.error.message);
  if (res.status !== 0) throw new Error('npm run userscript failed (status ' + res.status + ')');
}

function refArtefact(ref) {
  const res = spawnSync('git', ['-C', repo, 'show', `${ref}:${ARTEFACT}`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (res.status !== 0) throw new Error(`git show ${ref}:${ARTEFACT} failed\n${res.stderr || ''}`);
  return res.stdout;
}

function safeName(ref) {
  return String(ref).replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function snapshot(ref, opts = {}) {
  const label = 'current';
  const other = safeName(ref);

  if (!opts.noBuild) npmBuild();
  const built = path.join(repo, ARTEFACT);
  if (!fs.existsSync(built)) throw new Error(`no artefact at ${built}; run npm run userscript`);
  const builtText = fs.readFileSync(built, 'utf8');

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${label}.user.js`), builtText);
  const otherText = refArtefact(ref);
  fs.writeFileSync(path.join(outDir, `${other}.user.js`), otherText);

  const base = `http://127.0.0.1:${PORT}/web`;
  const builds = [
    { label, ref: 'working tree', version: versionOf(builtText), url: `${base}/parity/${label}.user.js` },
    { label: other, ref, version: versionOf(otherText), url: `${base}/parity/${other}.user.js` }
  ];
  const manifest = {
    generated: new Date().toISOString(),
    probe: `${base}/tools/parity-probe.js`,
    builds,
    compare: `node tools/parity.mjs compare web/parity/${builds[0].label}.json web/parity/${builds[1].label}.json`
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  console.log(`parity: snapshot in web/parity/ (ignored by git)`);
  for (const build of builds) console.log(`  ${build.label.padEnd(8)} ${build.version.padEnd(10)} ${build.url}`);
  console.log(`\nServe the repo root:   node web/tools/serve.mjs . ${PORT}

On the live page, once per build (reload between builds):
  const s = document.createElement('script');
  s.src = '${manifest.probe}?t=' + Date.now();
  document.head.appendChild(s);
  await new Promise((r) => { s.onload = r; });
  await sdParity.run('<build url>', '<label>');

The probe writes web/parity/<label>.json. Then:
  ${manifest.compare}`);
}

// Everything that is a version stamp or a theme choice rather than a reading.
export function normalise(dump) {
  const copy = JSON.parse(JSON.stringify(dump));
  delete copy.label;
  delete copy.at;
  delete copy.version;
  delete copy.foot;
  delete copy.theme;
  delete copy.digest;
  // The decision stamp is instrumentation the older build does not carry; it is
  // reported above the diff instead of counted as a rendering difference.
  delete copy.decision;
  return copy;
}

function pathLine(dump) {
  const d = dump && dump.decision;
  if (!d) return 'decision: none recorded (older build)';
  const tables = d.tables ? Object.entries(d.tables).filter(([, n]) => n).map(([k, n]) => k + ':' + n).join(',') : '';
  const rows = d.rows ? Object.entries(d.rows).filter(([, n]) => n).map(([k, n]) => k + ':' + n).join(',') : '';
  return `decision: ${d.path} · root ${d.root} · source ${d.source} · controls ${d.controls} · links ${d.links}`
    + ` · tables ${tables || 'none'} · rows ${rows || 'none'} · fallback ${d.fallback}`;
}

// The comparison itself: every leaf of the reading, in document order, with the
// build stamps normalised away. Cheap enough to run on every `npm test`.
export function differences(left, right, at = '', out = []) {
  if (left === right) return out;
  const both = left && right && typeof left === 'object' && typeof right === 'object';
  if (!both) {
    out.push({ at: at || '(root)', left, right });
    return out;
  }
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    const here = Array.isArray(left) ? `[${key}]` : `.${key}`;
    differences(left[key], right[key], at + here, out);
  }
  return out;
}

function show(value) {
  if (value === undefined) return 'missing';
  const text = JSON.stringify(value);
  return text && text.length > 90 ? text.slice(0, 90) + '…' : text;
}

function compare(leftPath, rightPath) {
  const left = JSON.parse(fs.readFileSync(leftPath, 'utf8'));
  const right = JSON.parse(fs.readFileSync(rightPath, 'utf8'));

  console.log(`parity: ${left.label || leftPath} ${left.foot || ''} [${left.theme || 'no theme'}]`);
  console.log(`        ${pathLine(left)}`);
  console.log(`        ${right.label || rightPath} ${right.foot || ''} [${right.theme || 'no theme'}]`);
  console.log(`        ${pathLine(right)}`);

  const diffs = differences(normalise(left), normalise(right));
  if (!diffs.length) {
    console.log('parity: readers agree — same view, rows, labels, controls and values');
    return 0;
  }

  console.log(`parity: ${diffs.length} difference${diffs.length === 1 ? '' : 's'}`);
  for (const diff of diffs.slice(0, 25)) {
    console.log(`  ${diff.at}`);
    console.log(`    left:  ${show(diff.left)}`);
    console.log(`    right: ${show(diff.right)}`);
  }
  if (diffs.length > 25) console.log(`  … ${diffs.length - 25} more`);
  return 1;
}

// The frozen set. `current` and `reference` are dump file stems in web/parity/;
// `reference: null` means the reference build cannot read that shape at all, and
// then `reason` is checked into the fixture so the gap is stated, not implied.
// `reader` names the module whose reading the pair freezes (src/lib), which is
// what test/parity.test.mjs holds coverage against.
const PAIRS = [
  { name: 'attendance', reader: 'attendance', current: 'v9-attendance-current', reference: 'v9-attendance-main' },
  {
    name: 'confirm', reader: 'confirmation', current: 'v9-confirm-current', reference: 'v9-confirm-main',
    note: 'An Unenroll question page. Both builds route it to the settings view, so this freezes the confirmation guard rejecting a typed page rather than the confirm view itself.'
  },
  {
    name: 'drop-question', reader: 'settings', current: 'v9-question-current', reference: 'v9-question-main',
    note: 'EditClass&meth=dropStudents. A question page the app draws with typed controls, so it reads as settings on both builds.'
  },
  { name: 'editor', reader: 'form', current: 'v8-editor-current', reference: 'v8-editor-main' },
  { name: 'index', reader: 'index-page', current: 'v8-index-current', reference: 'v8-index-main' },
  { name: 'insights', reader: 'insights', current: 'v9-insights-current', reference: 'v9-insights-main' },
  { name: 'list', reader: 'list', current: 'v8-list-current', reference: 'v8-list-main' },
  { name: 'month', reader: 'month', current: 'v8-month-current', reference: 'v8-month-main' },
  { name: 'note', reader: 'note', current: 'v9-note-current', reference: 'v9-note-main' },
  {
    name: 'payment', reader: 'payment', current: 'v9-payment-current', reference: null,
    reason: 'main (0.28.x) has no payment reader: no Payment component and no paid_toward handling, so it reads the New Payment screen as a sheet. The current dump is frozen so the reading is recorded; there is nothing to compare it against.'
  },
  { name: 'record', reader: 'record', current: 'v8-record-current', reference: 'v8-record-main' },
  { name: 'report', reader: 'report', current: 'v8-report-current', reference: 'v8-report-main' },
  { name: 'settings', reader: 'settings', current: 'v8-settings-current', reference: 'v8-settings-main' },
  {
    name: 'sheet', reader: 'sheet', current: 'v9-sheet-current', reference: 'v9-sheet-main',
    note: 'A print window: the class roster from a class\'s Print menu (PrintClassRoster&cident=…). No shell, no #mainContent — the document body is the content root, and the roster is the page\'s one data table.'
  },
  {
    name: 'sheet-rehearsals', reader: 'sheet', current: 'v8s-sheet-extra-rehearsals-current', reference: 'v8s-sheet-extra-rehearsals-main',
    note: 'A print window for a rehearsal date: the rehearsal class\'s roster print (PrintClassRoster&cident=…&class_day=…), reached from the Extra Rehearsals season on the calendar. No shell; the body is the content root, and the roster is the page\'s one data table.'
  },
  { name: 'trends', reader: 'trends', current: 'v9-trends-current', reference: 'v9-trends-main' },
  {
    name: 'week', reader: 'calendar', current: 'v8-week-current', reference: 'v8-week-main',
    note: 'The Calendar page forced to its week view with DATASPEC_VIEW=WEEK, which is deliberate: the calendar\'s chosen view is session state, so a bare CalendarPage URL renders whichever view the session last used (verified — a bare URL returned the week after the week was viewed, and the month earlier in the same session; the two readings differed only in their recorded URL). The parameter is what makes this capture repeatable; the pair freezes the real week grid — seven weekday columns, the 11/2–11/8 range line and the two time rows — not the month view.'
  }
];

function readDump(stem) {
  const file = path.join(outDir, `${stem}.json`);
  if (!fs.existsSync(file)) throw new Error(`no dump at ${file}; collect it on the live page first`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Capture stamps, not readings: the label is the local file stem, `at` the clock
// and `foot` is a status line. The build version is lifted out of the foot so the
// fixture says which build produced each side, then the stamp itself is dropped.
function reading(dump) {
  const copy = JSON.parse(JSON.stringify(dump));
  delete copy.label;
  delete copy.at;
  const version = String(copy.foot || '').match(/\bv(\d+\.\d+\.\d+)\b/);
  if (version) copy.version = version[1];
  delete copy.foot;
  return copy;
}

// Values are hashed by the probe and app field names are kept, so a money-like
// leaf is a bug in the probe and must not be frozen into a fixture.
const MONEY = /\d+\.\d{2}/;

function moneyLike(value, at = '', out = []) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => moneyLike(item, at + `[${i}]`, out));
    return out;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) moneyLike(value[key], at + `.${key}`, out);
    return out;
  }
  if (typeof value === 'string' && MONEY.test(value)) out.push(at);
  return out;
}

function fixtures() {
  fs.mkdirSync(fixtureDir, { recursive: true });
  const names = new Set();
  let frozen = 0;
  let unreferenced = 0;

  for (const pair of PAIRS) {
    const current = reading(readDump(pair.current));
    const reference = pair.reference ? reading(readDump(pair.reference)) : null;

    if (!current.view || typeof current.view.kind !== 'string') {
      throw new Error(`${pair.name}: web/parity/${pair.current}.json has no reading (view.kind); re-collect it`);
    }

    if (reference) {
      const diffs = differences(normalise(current), normalise(reference));
      if (diffs.length) {
        throw new Error(`${pair.name}: the two builds disagree (${diffs.length} difference${diffs.length === 1 ? '' : 's'},`
          + ` first at ${diffs[0].at}); fix the reader before freezing this pair`);
      }
    } else if (!pair.reason) {
      throw new Error(`${pair.name}: no reference dump and no reason; state why the shape cannot be compared`);
    }

    const money = [current, reference].filter(Boolean).flatMap((dump) => moneyLike({ view: dump.view, panel: dump.panel, tabs: dump.tabs }));
    if (money.length) {
      throw new Error(`${pair.name}: refusing to freeze money-like text at ${money.join(', ')}; the probe should hash values`);
    }

    // Skew is a fact about the evidence, so `fixtures` refuses to freeze a pair
    // older than the shipped artefact unless the pair declares that it stands at
    // that build. A pair that is fresh again must drop the declaration.
    const shipped = shippedVersion();
    const behind = compareVersions(current.version || '0', shipped) < 0;
    if (behind && !pair.stale) {
      throw new Error(`${pair.name}: captured with ${current.version || 'an unstamped build'}, but ${shipped} is shipped;`
        + ' re-collect it on the live page, or record `stale` on the pair and say why it stands');
    }
    if (!behind && pair.stale) {
      throw new Error(`${pair.name}: declares a stale capture but was collected with the shipped ${shipped}; drop the declaration`);
    }

    const entry = {
      name: pair.name,
      reader: pair.reader,
      url: current.url,
      note: pair.note,
      stale: pair.stale ? { captured: current.version, why: pair.stale } : undefined,
      current,
      reference,
      reason: reference ? undefined : pair.reason
    };
    fs.writeFileSync(path.join(fixtureDir, `${pair.name}.json`), JSON.stringify(entry, null, 2) + '\n');
    names.add(`${pair.name}.json`);
    frozen += 1;
    if (!reference) unreferenced += 1;
  }

  for (const file of fs.readdirSync(fixtureDir)) {
    if (file.endsWith('.json') && !names.has(file)) fs.rmSync(path.join(fixtureDir, file));
  }

  console.log(`parity: froze ${frozen} pair${frozen === 1 ? '' : 's'} in test/parity/`
    + (unreferenced ? ` (${unreferenced} without a reference build, reason recorded)` : ''));
  if (!frozen) process.exit(1);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invoked) {
  const [command, ...rest] = process.argv.slice(2);
  try {
    if (command === 'snapshot') {
      const positional = rest.filter((arg) => !arg.startsWith('--'));
      snapshot(positional[0] || 'main', { noBuild: rest.includes('--no-build') });
    } else if (command === 'compare') {
      if (rest.length < 2) {
        usage();
        process.exit(2);
      }
      process.exit(compare(rest[0], rest[1]));
    } else if (command === 'fixtures') {
      fixtures();
    } else {
      usage();
      process.exit(command ? 2 : 0);
    }
  } catch (error) {
    console.error('parity: ' + (error && error.message ? error.message : String(error)));
    process.exit(2);
  }
}
