// Golden models: freeze what each reader produces, so a rewrite can be diffed
// instead of argued about.
//
// The readers are pure — html in, model out — which is the one property that
// makes this project rewritable at all. So the reference behaviour does not have
// to live in the implementation: it can live in JSON, produced from the fixtures
// in test/fixtures and compared against whatever the code does next.
//
//   npm run golden:write   record (or re-record) test/golden/*.json
//   npm run golden         compare the current code against those files
//
// `npm run golden` exits 1 and prints the differing lines when any reader's
// output changes. That is the acceptance test for a rewrite: run it before
// touching anything, then require the new code to produce byte-identical models
// from the same fixtures. A rewrite that changes a model shape now fails a diff
// instead of quietly shipping 445 screens with a field renamed.
//
// What this deliberately does *not* cover: anything with a live page in it. The
// DOM fallbacks in main.js (the note tiebreaker, the live re-read, the search
// panel) need a browser and a session, so those stay verified by hand — see the
// live sample in docs/live-sample.json and tools/save-check.js.

import fs from 'node:fs';
import path from 'node:path';
import { DOMParser } from 'linkedom';
import { readPage } from '../src/lib/page.js';
import { readForm } from '../src/lib/form.js';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const root = path.resolve(here, '..');
const FIXTURES = path.join(root, 'test', 'fixtures');
const GOLDEN = path.join(root, 'test', 'golden');

// The URL each fixture stands for. Routing is structural, so this is mostly a
// label — but it is the label the fixture was captured on, and `readPage` puts it
// on the model, so it belongs in the snapshot.
const URLS = {
  'calendar-page.html': 'https://app.thestudiodirector.com/studio1/admin.sd?page=CalendarPage',
  'confirmation.html': 'https://app.thestudiodirector.com/studio1/admin.sd',
  'edit-class.html': 'https://app.thestudiodirector.com/studio1/admin.sd?page=EditClass&cident=1782910697458',
  'edit-family.html': 'https://app.thestudiodirector.com/studio1/admin.sd?page=EditFamily&fident=1503525685676',
  'edit-student.html': 'https://app.thestudiodirector.com/studio1/admin.sd?page=EditStudent&sident=1629799984805',
  'editor-class.html': 'https://app.thestudiodirector.com/studio1/admin.sd?page=EditClass&cident=1782910697458',
  'editor-family.html': 'https://app.thestudiodirector.com/studio1/admin.sd?page=NewFamily',
  'editor-locations.html': 'https://app.thestudiodirector.com/studio1/admin.sd?page=NewEditDel&content=LocationsContent&state=new',
  'editor-season.html': 'https://app.thestudiodirector.com/studio1/admin.sd?page=NewEditArchive&content=SeasonContent&state=new',
  'editor-student.html': 'https://app.thestudiodirector.com/studio1/admin.sd?page=EditStudent&sident=1629799984805',
  'index-charges.html': 'https://app.thestudiodirector.com/studio1/admin.sd?page=ChargesHome',
  'report-results.html': 'https://app.thestudiodirector.com/studio1/admin.sd?page=ClassRosterForm',
  'report-roster.html': 'https://app.thestudiodirector.com/studio1/admin.sd?page=ClassRosterForm',
  'search-results.html': 'https://app.thestudiodirector.com/studio1/admin.sd?page=SearchResults&searchText=smith',
  'settings-search.html': 'https://app.thestudiodirector.com/studio1/admin.sd?page=SearchDisplayFormat',
  'sheet-roster.html': 'https://app.thestudiodirector.com/studio1/admin.sd?page=PrintClassRoster',
  'task-holidays.html': 'https://app.thestudiodirector.com/studio1/admin.sd?page=ManageHolidays',
  'task-email-group.html': 'https://app.thestudiodirector.com/studio1/admin.sd?page=EmailToGroupForm'
};

// Key order is an artefact of how a reader happens to build its object, not a
// behaviour. Sorting makes a reimplementation's diff about values, not ordering.
function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sorted(value[key]);
    return out;
  }
  return value;
}

function modelOf(file) {
  const html = fs.readFileSync(path.join(FIXTURES, file), 'utf8');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const url = URLS[file]
    || 'https://app.thestudiodirector.com/studio1/admin.sd?page=' + file.replace(/\.html$/, '');

  const model = readPage(doc, url);
  // Record pages are not routed through readPage — main.js recognises them by
  // `a#save` and reads them with readForm alone — so the form is snapshotted
  // beside the page model rather than inside it.
  let form = null;
  try {
    form = readForm(doc);
  } catch (err) {
    form = { error: String(err && err.message ? err.message : err) };
  }

  return sorted({ file, url, view: model.view, model, form });
}

function render(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function files() {
  return fs.readdirSync(FIXTURES).filter((name) => name.endsWith('.html')).sort();
}

function reportDiff(file, expected, actual) {
  const a = expected.split('\n');
  const b = actual.split('\n');
  const shown = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max && shown.length < 12; i += 1) {
    if (a[i] !== b[i]) {
      shown.push('    line ' + (i + 1));
      shown.push('      golden:  ' + (a[i] === undefined ? '(absent)' : a[i].trim()));
      shown.push('      current: ' + (b[i] === undefined ? '(absent)' : b[i].trim()));
    }
  }
  console.log('  DIFF ' + file);
  for (const line of shown) console.log(line);
  if (shown.length >= 12) console.log('    … more differences not shown');
}

function main() {
  const mode = (process.argv[2] || 'check').toLowerCase();
  if (mode !== 'write' && mode !== 'check') {
    console.error('usage: node tools/golden.mjs [write|check]');
    process.exit(2);
  }

  if (mode === 'write') fs.mkdirSync(GOLDEN, { recursive: true });

  let changed = 0;
  let missing = 0;
  const all = files();

  for (const file of all) {
    const actual = render(modelOf(file));
    const target = path.join(GOLDEN, file.replace(/\.html$/, '.json'));

    if (mode === 'write') {
      fs.writeFileSync(target, actual);
      continue;
    }

    if (!fs.existsSync(target)) {
      console.log('  MISSING ' + path.basename(target) + ' — run npm run golden:write');
      missing += 1;
      continue;
    }

    const expected = fs.readFileSync(target, 'utf8');
    if (expected !== actual) {
      reportDiff(file, expected, actual);
      changed += 1;
    }
  }

  if (mode === 'write') {
    console.log('wrote ' + all.length + ' golden model' + (all.length === 1 ? '' : 's')
      + ' to test/golden/ (' + all.length + ' fixtures)');
    return;
  }

  if (!changed && !missing) {
    console.log('golden: ' + all.length + ' models match');
    return;
  }

  console.log('golden: ' + changed + ' changed, ' + missing + ' missing, of ' + all.length);
  process.exit(1);
}

main();
