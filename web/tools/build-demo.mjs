// Self-contained demo pages: each fixture inlined as inert text, plus the built
// bundle. No network, no fixture fetch, works from disk.
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const root = path.resolve(here, '..');
const bundle = fs.readFileSync(path.join(root, 'dist/sd.js'), 'utf8');

// demo/ is generated and gitignored, so a clean checkout does not have it. The
// build used to assume the directory was already there, which only showed once
// it was deleted.
fs.mkdirSync(path.join(root, 'demo'), { recursive: true });

const PAGES = [
  { fixture: 'calendar-page.html', out: 'demo/week.html', title: 'week calendar' },
  { fixture: 'editor-class.html', out: 'demo/classes.html', title: 'classes list' },
  { fixture: 'editor-family.html', out: 'demo/families.html', title: 'families list' },
  { fixture: 'editor-student.html', out: 'demo/students.html', title: 'students list' },
  { fixture: 'confirmation.html', out: 'demo/confirmation.html', title: 'saved' },
  { fixture: 'search-results.html', out: 'demo/search.html', title: 'search results' },
  { fixture: 'index-charges.html', out: 'demo/index.html', title: 'landing page' },
  { fixture: 'index-settings.html', out: 'demo/index-settings.html', title: 'settings landing page' },
  { fixture: 'task-email-group.html', out: 'demo/task.html', title: 'mail form' },
  { fixture: 'sheet-roster.html', out: 'demo/sheet.html', title: 'print sheet' },
  { fixture: 'settings-search.html', out: 'demo/settings.html', title: 'settings' },
  { fixture: 'report-roster.html', out: 'demo/report.html', title: 'report filters' },
  { fixture: 'report-results.html', out: 'demo/report-results.html', title: 'report results' },
  { fixture: 'sheet-perf.html', out: 'demo/sheet-perf.html', title: 'performance and costumes' },
  // Record pages: the rebuilt app defers these to its own editor, so most have no
  // demo. Edit Family gets one because the style guide frames it as the "Edit page"
  // screen — read by the same readers, with placeholder values from the capture.
  // The URL matters as much as the markup: a record page is only read as an
  // editor when the address says it is one, so the demo carries the address the
  // fixture was captured on instead of its own file:// URL.
  { fixture: 'edit-class.html', out: null, title: 'edit class' },
  {
    fixture: 'edit-family.html',
    out: 'demo/edit-family.html',
    title: 'edit family',
    url: 'https://app.thestudiodirector.com/studio1/admin.sd?page=EditFamily&fident=1782910697458'
  },
  { fixture: 'edit-student.html', out: null, title: 'edit student' }
];

const inert = (name) => fs.readFileSync(path.join(root, 'test/fixtures', name), 'utf8')
  .replace(/<\/script/gi, '<\\/script');

function pageHtml(fixture, title, url) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Studio Director ${title} — rebuilt UI (demo)</title>
<style>
  html, body { margin: 0; height: 100%; }
  body { font: 14px/1.45 system-ui, sans-serif; }
</style>
</head>
<body>
<!-- The page the adapters parse. Inert: never executed, never rendered. -->
<script type="text/plain" id="source-page">${inert(fixture)}</script>${url ? '\n<script type="text/plain" id="source-url">' + url + '</script>' : ''}
<script>${bundle.replace(/<\/script/gi, '<\\/script')}</script>
<script>
  var model = SD.modelFromHtml(
    document.getElementById('source-page').textContent,
    (document.getElementById('source-url') || {}).textContent || location.href
  );
  SD.mount({
    model: model,
    state: model.view ? 'ready' : 'none',
    // The demo's inert fixture has no app search to drive, but the box exists.
    onSearch: SD.searchEverything
  });
</script>
</body>
</html>
`;
}

// Two common screens have nothing to capture. A record editor and the attendance
// register only exist behind a class's own page, and the probe refuses a page
// whose money-like values it cannot hash. So these are assembled from the model
// the reader would have produced instead: the components are the same ones, the
// page is the same page, and the model is the only invented part. Structure,
// never data — every name and figure below is a placeholder.
const control = (key, type, value, options, label) => ({
  key,
  id: key,
  name: key,
  type,
  value,
  label: label || null,
  masked: false,
  selector: '#' + key,
  options: options ? options.map((v) => ({ label: v, value: v, selected: v === value })) : null,
  checked: type === 'checkbox' ? Boolean(value) : null
});

const EDIT_ROWS = [
  { label: 'Name', fields: [control('name', 'text', 'Ballet III')] },
  { label: 'Season', fields: [control('season', 'select', 'Winter', ['Fall', 'Winter', 'Spring', 'Summer'])] },
  { label: 'Day', fields: [
    control('day_mon', 'checkbox', true, null, 'Mon'),
    control('day_wed', 'checkbox', true, null, 'Wed'),
    control('day_fri', 'checkbox', false, null, 'Fri')
  ] },
  { label: 'Start Time', fields: [control('start_time', 'select', '4:00p', ['3:00p', '4:00p', '5:30p'])] },
  { label: 'Length', fields: [control('length', 'select', '60', ['45', '60', '75'])] },
  { label: 'Instructor', fields: [control('instructor', 'select', 'Ms. Rivera', ['Ms. Rivera', 'Mr. Cole'])] },
  { label: 'Description', fields: [control('description', 'textarea', 'Ballet technique for ages 6-9.')] },
  { label: 'Max Size', fields: [control('max_size', 'text', '12')] },
  { label: 'Location', fields: [control('location', 'select', 'Studio A', ['Studio A', 'Studio B'])] },
  { label: 'Session Charge', fields: [control('session_charge', 'text', '120.00')] }
];

const EDITOR = {
  view: 'form',
  title: 'Edit class',
  // The shell every model carries: the app's own nav (the palette and the Wii
  // menu read it) and the address the page was read from.
  url: 'https://app.example/classes?content=ClassContent&id=31&state=edit',
  nav: [],
  // A record page is drawn as the list you came from beside the record, so the
  // editor needs that list too — `SPLIT` puts `List` next to a `form` view.
  list: {
    label: 'Classes',
    types: ['Class'],
    mixed: false,
    total: 3,
    truncated: false,
    items: [
      { label: 'Ballet III', href: '?content=ClassContent&id=31&state=edit' },
      { label: 'Hip Hop', href: '?content=ClassContent&id=32&state=edit' },
      { label: 'Jazz I', href: '?content=ClassContent&id=33&state=edit' }
    ]
  },
  form: {
    kind: 'form',
    title: 'Edit class',
    breadcrumb: ['Classes', 'Ballet III'],
    rows: EDIT_ROWS,
    fields: EDIT_ROWS.flatMap((row) => row.fields),
    tables: []
  },
  tabs: {
    tabs: [
      { label: 'Class', kind: 'form' },
      {
        label: 'Roster',
        kind: 'list',
        actions: [{ label: 'Enroll', href: '#', js: false }],
        blocks: [{
          section: '',
          headings: ['Student', 'Balance'],
          rows: [
            [{ text: 'Ada Lovelace', href: '#' }, { text: '$120.00', right: true }],
            [{ text: 'Grace Hopper', href: '#' }, { text: '—', right: true }]
          ]
        }],
        note: '',
        controls: 0
      }
    ]
  },
  bar: {
    items: [
      { id: 'new', label: 'New', href: '#', js: true, danger: false, hint: '', onclick: '' },
      { id: 'print', label: 'Print', href: '#', js: true, danger: false, hint: '', onclick: '' },
      { id: 'clone', label: 'Clone', href: '#', js: true, danger: false, hint: '', onclick: '' },
      { id: 'delete', label: 'Delete', href: '#', js: true, danger: true, hint: '', onclick: '' }
    ],
    menu: [],
    moreLabel: 'More'
  }
};

const REASONS = [
  { value: '', label: 'Ill' },
  { value: 'travel', label: 'Travel' },
  { value: 'other', label: 'Other' }
];

const attCell = (present, reasonLabel) => ({
  boxId: 'box',
  present,
  reason: { value: present ? '' : 'travel', label: present ? '' : (reasonLabel || 'Travel') },
  notes: { value: '' },
  options: REASONS
});

const ATT_DATES = ['Mon Jan 12', 'Wed Jan 14', 'Mon Jan 19'].map((label, i) => ({
  key: 'd' + i,
  label,
  cancel: { label: 'Cancel class', onclick: '' }
}));

const ATT_STUDENTS = [
  { name: 'Ada Lovelace', href: '#', absent: null },
  { name: 'Grace Hopper', href: '#', absent: 'd1' },
  { name: 'Alan Turing', href: '#', absent: null },
  { name: 'Katherine Johnson', href: '#', absent: null }
];

const ATTENDANCE = {
  view: 'attendance',
  title: 'Attendance',
  url: 'https://app.example/attendance?content=ClassContent&id=31',
  nav: [],
  attendance: {
    title: 'Attendance',
    className: 'Ballet III',
    dates: ATT_DATES,
    students: ATT_STUDENTS.map((student) => {
      const cells = {};
      for (const date of ATT_DATES) cells[date.key] = attCell(student.absent !== date.key);
      return { name: student.name, href: student.href, cells };
    }),
    actions: [
      { label: 'Add student', href: '#' },
      { label: 'Print roster', href: '#' }
    ],
    nav: [
      { label: 'Prev', onclick: '' },
      { label: 'Next', onclick: '' }
    ],
    save: { label: 'Save attendance', onclick: '' },
    notes: { value: 'Bring water bottles; Studio B is booked after 6.' }
  }
};

// The page the two model screens are drawn on: the bundle, then one mount with
// the model inline. No fixture, because there is no page to read.
function modelHtml(model, title) {
  const json = JSON.stringify(model).replace(/<\//g, '<\\/');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Studio Director ${title} — rebuilt UI (demo)</title>
<style>
  html, body { margin: 0; height: 100%; }
  body { font: 14px/1.45 system-ui, sans-serif; }
</style>
</head>
<body>
<script>${bundle.replace(/<\/script/gi, '<\\/script')}</script>
<script>
  SD.mount({ model: ${json}, state: 'ready' });
</script>
</body>
</html>
`;
}

const MODELS = [
  { out: 'demo/screen-editor.html', title: 'edit class', model: EDITOR },
  { out: 'demo/screen-attendance.html', title: 'attendance', model: ATTENDANCE }
];

const emit = (out, fixture, title, url) => {
  const html = pageHtml(fixture, title, url);
  fs.writeFileSync(path.join(root, out), html);
  console.log(out, html.length, 'bytes');
};

for (const page of PAGES) {
  if (!page.out) continue;
  emit(page.out, page.fixture, page.title, page.url);
}

for (const page of MODELS) {
  const html = modelHtml(page.model, page.title);
  fs.writeFileSync(path.join(root, page.out), html);
  console.log(page.out, html.length, 'bytes');
}

// Any `live-*.html` dropped into test/fixtures becomes a demo page of the same
// name, so a fresh capture can be reviewed without touching this list. See
// tools/capture-page.js for the console snippet that produces one.
const captures = fs.readdirSync(path.join(root, 'test/fixtures'))
  .filter((name) => /^live-.+\.html$/.test(name))
  .sort();
for (const fixture of captures) {
  const name = fixture.replace(/^live-/, '').replace(/\.html$/, '');
  emit('demo/' + name + '.html', fixture, name + ' (live capture)');
}

// The demo server's root is this folder, so the userscript the pages reference
// has to exist here too. It is the same built file, copied rather than written
// twice: the real artifact stays next to README.md at the repo root.
const userscript = path.resolve(root, '..', 'studio-director-rebuilt.user.js');
if (fs.existsSync(userscript)) {
  fs.copyFileSync(userscript, path.join(root, 'studio-director-rebuilt.user.js'));
  console.log('studio-director-rebuilt.user.js (copied for the demo server)');
}

// The same fixtures as real pages, with the built userscript attached: this is
// the actual deployment path (GET the page, parse it, cover it), not a stub.
for (const page of PAGES) {
  const body = fs.readFileSync(path.join(root, 'test/fixtures', page.fixture), 'utf8');
  const html = body.replace('</body>', '  <script src="/studio-director-rebuilt.user.js"></script>\n</body>');
  const out = 'demo/live-' + page.fixture.replace('calendar-page', 'week').replace('editor-', '') + '';
  fs.writeFileSync(path.join(root, out), html);
  console.log(out, html.length, 'bytes');
}
