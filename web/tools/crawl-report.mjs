// Turns web/data/pages.json into a readable map.
//
// Usage: node tools/crawl-report.mjs data/pages.json docs/crawl-map.md
//        node tools/crawl-report.mjs --fallbacks     (just the screens nothing claims)
//
// The point is to answer two questions without opening 447 entries by hand:
// which screens does the rebuilt UI already cover, and which ones are left.
// Coverage is predicted from the same rules the app routes on, so it stays true
// as the readers change:
//
//   table.TimeBlock                  -> week
//   #idSearchSpan .searchResultList   -> list
//   a run control (#runreport / "Run Report") -> report
//   a Form table + a control of its own -> task (settings, letters, mail)
//   a Form table + tabs (the a#save editors) -> editor with its panels
//   tables with rows                 -> sheet (dashboards, print sheets)
//   links, and fewer than two table rows -> index
//   a control plus a way to save     -> settings (single toggles)
//   no controls, <2 rows, <6 links   -> note (a sentence and the app's button)
//   anything else                    -> not rebuilt yet
//
// The record bar's `#save` lives in the content root and has no href, so it is
// recorded as an action with `href: null` — that is what makes the editor
// prediction work. On the live page `#save` is checked again at run time.
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const listFallbacks = argv.includes('--fallbacks');
const positional = argv.filter((a) => !a.startsWith('--'));
const input = positional[0] || 'data/pages.json';
const output = positional[1] || 'docs/crawl-map.md';
const crawl = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));

const hasRunReport = (p) => p.actions.some(
  (a) => /^runreport$/i.test(a.id || '') || /^run report$/i.test((a.label || '').trim())
);

// The crawl names tables by their classes, sometimes with the tag prefix
// ("table.FormEx"). A form table is what both the task and the editor need.
const hasFormTable = (p) => (p.tables || []).some((t) => /(^|\.)(Form|FormEx)$/.test(String(t.cls || '').trim()));
const jsActions = (p) => p.actions.filter((a) => a.js && !/^runreport$/i.test(a.id || ''));
const tabbed = (p) => (p.tabs || []).length >= 2;
const hasSave = (p) => p.actions.some((a) => a.id === 'save');

// A record editor ships its Calendar tab as TimeBlock tables too, so a tabbed
// page is never the week calendar: readWeek ignores tables inside a tab.
const hasTimeBlock = (p) => !(p.tabs || []).length
  && (p.tables || []).some((t) => /TimeBlock/.test(String(t.cls || '')));

function viewOf(p) {
  // The order the app tries them in: the week and the record list are page
  // shapes, not URL shapes, and a record page can be one of them —
  // `Enroll(sident)` is the week calendar, `EnrollmentSearch` a record list.
  if (p.kind === 'week' || hasTimeBlock(p)) return 'week';
  if (p.kind === 'list' || p.kind === 'record+list') return 'list';
  if (hasRunReport(p)) return 'report';

  const record = String(p.kind).startsWith('record');
  const form = hasFormTable(p) && (p.controlsTotal || 0) >= 4;

  // The four record editors: a form, tabs, and (on the live page) a Save.
  if (form && (tabbed(p) || hasSave(p))) return 'editor';
  // A form with its own control: settings, letter templates, compose mail.
  if (form && jsActions(p).length) return 'task';

  const rows = p.counts.rows || 0;
  const links = p.counts.links || 0;
  if (rows >= 2) return 'sheet';
  // A record page never becomes a tile menu: the record reader runs first on
  // those URLs, and a picker of 4,000 links is not a menu either.
    if (links >= 6) return 'index';
  // A toggle screen: a control, and a control that saves it. The crawl cannot
  // see the top bar's `#save`, so this is a floor — the live page may have more.
  if ((p.controlsTotal || 0) >= 1 && jsActions(p).length >= 1) return 'settings';
  // The notice, last of all. Same refusal order as `readNote`: a control makes
  // it a form, two data rows make it a table, six links make it a menu. What is
  // left is a sentence and the app's own button.
  if ((p.controlsTotal || 0) === 0 && rows < 2 && links < 6 && (p.actions || []).length) return 'note';
  return 'none';
}

// The screens no rule can place. They are the only ones that need a reader
// written from scratch, so they are named rather than counted:
//   node tools/crawl-report.mjs --fallbacks
if (listFallbacks) {
  const none = crawl.pages.filter((p) => viewOf(p) === 'none');
  console.log(none.length + ' screen(s) with no predicted view:');
  for (const p of none) {
    console.log('  ' + p.shape + '  |  ' + (p.title || '(no title)')
      + '  |  rows ' + p.counts.rows
      + ', controls ' + p.controlsTotal
      + ', links ' + p.counts.links
      + ', tabs ' + (p.tabs || []).length);
    console.log('     ' + p.url);
  }
  process.exit(0);
}

// Modules, in the order a person meets them in the rail. The first matching
// pattern wins, so the specific families come before the broad ones.
const MODULES = [
  { name: 'Week calendar', test: (p) => p.kind === 'week' || /^CalendarPage|ConfigureCalendar/.test(p.page) },
  { name: 'Printing', test: (p) => /^Print/.test(p.page) },
  { name: 'Records: classes', test: (p) => /^EditClass|^CopyClass|^AltStartTimes|^PreapproveStudents|^PerfCostumeMgmt|^ClassDocuments|^ClassSkills|^TagClassStudents/.test(p.page) },
  { name: 'Records: families', test: (p) => /^EditFamily|^ManageFamilyNotes|^ManagePortalText|^PickCategory/.test(p.page) },
  { name: 'Records: students', test: (p) => /^EditStudent|^Override|^UnenrollAll|^ViewOld|^UnenrollAll/.test(p.page) },
  { name: 'Records: instructors', test: (p) => /^EditInstructor/.test(p.page) },
  { name: 'Lists', test: (p) => /^New(Class|Family|Student|Instructor)$/.test(p.page) || /^Edit.*(searchidx)/.test(p.shape) },
  { name: 'Enrollment & attendance', test: (p) => /Enroll|SwitchClasses|Makeup|Attendance|SignIn|Uncancel|Cancelled|Register|Waitlist|StudentPerf/.test(p.page) },
  { name: 'Documents & waivers', test: (p) => /Documents|Accept|Upload|Waivers/.test(p.page) },
  { name: 'Charges & payments', test: (p) => /Charge|Payment|Deposit|Statement|Invoice|Aging|Ledger|Tax|Surcharge|Discount|Promo|PayPlan|Balance|Tuition|BuyInventory/.test(p.page) },
  { name: 'Communications', test: (p) => /Email|Text|SMS|Drip|Mail|Retrieve|AdvSearch/.test(p.page) },
  { name: 'Costumes & inventory', test: (p) => /Costume|Perf|Size|Vendor|Catalog|Inventory|Measurement/.test(p.page) },
  { name: 'Reports & dashboards', test: (p) => /Form$|Report|List$|Summary|History|Trends|Alerts|LargeTrend|Roster|Schedule|HomePage/.test(p.page) },
  { name: 'Settings & portal', test: () => true }
];

const moduleOf = (p) => (MODULES.find((m) => m.test(p)) || { name: 'Other' }).name;
const moduleRank = (name) => {
  const i = MODULES.findIndex((m) => m.name === name);
  return i < 0 ? MODULES.length : i;
};

const groups = new Map();
for (const page of crawl.pages) {
  const name = moduleOf(page);
  if (!groups.has(name)) groups.set(name, []);
  groups.get(name).push({ ...page, view: viewOf(page) });
}

const VIEW_ORDER = ['week', 'list', 'editor', 'report', 'task', 'sheet', 'index', 'settings', 'note', 'none'];
const tally = (pages) => {
  const out = Object.fromEntries(VIEW_ORDER.map((v) => [v, 0]));
  for (const p of pages) out[p.view] += 1;
  return out;
};

const all = crawl.pages.map((p) => ({ ...p, view: viewOf(p) }));
const counts = tally(all);
const lines = [];

lines.push('# Studio Director — screen map');
lines.push('');
lines.push(`Generated from \`${path.basename(input)}\` — **${crawl.pages.length} screens** crawled `
  + `on ${String(crawl.startedAt || '').slice(0, 10)}`
  + `, ${crawl.counts.skipped} links deliberately not followed, ${crawl.counts.errors} errors.`);
lines.push('');
const riskyLinks = crawl.followedRisky || [];
if (riskyLinks.length) {
  lines.push(`**${riskyLinks.length} links the safety rule flagged were followed on purpose** - see the`);
  lines.push('section at the end of this map for what they are and why they were safe.');
  lines.push('');
}
lines.push(crawl.stoppedEarly
  ? `**Incomplete:** ${crawl.remaining} page shapes were still queued when it stopped.`
  : '**Complete:** the queue was drained, so every page the app links to is in here.');
lines.push('');
lines.push('## Coverage');
lines.push('');
lines.push('| Rebuilt view | Screens |');
lines.push('|---|---|');
const VIEW_LABEL = {
  week: 'Week calendar',
  list: 'Record lists (Classes, Families, Students, Instructors)',
  editor: 'Record editors, with their tabs',
  report: 'Reports (filters + Run Report)',
  task: 'Forms with the app\'s own control (settings, letters, mail)',
  sheet: 'Table screens (dashboards, settings lists, print sheets)',
  index: 'Landing pages (tile index)',
  settings: 'Toggle settings (a control and a Save)',
  note: 'Notices (a sentence and the app\'s own button)',
  none: 'Not rebuilt — falls back to the app'
};
for (const view of VIEW_ORDER) lines.push(`| ${VIEW_LABEL[view]} | ${counts[view]} |`);
lines.push(`| **Total** | **${all.length}** |`);
lines.push('');
lines.push('Coverage is predicted from the routing rules in `src/lib/page.js`, so a page listed as');
lines.push('covered is one this build takes over. `Not rebuilt` is the honest remainder.');
lines.push('');
lines.push('The notice row is the least certain of them, because the app fills these pages in after the');
lines.push('HTML arrives. All 61 of these shapes have now been opened in a browser and measured (see');
lines.push('`docs/live-sample.json`): 50 really are notices and 11 are not. Five of those eleven were');
lines.push('then walked live and mounted as an index: `ChargesHome` (18 links) and `ManageWidgets` (8)');
lines.push('from the live document, `MergeFamily` (9), `EmailFamily` (8) and');
lines.push('`ManagePaymentMethods_studio` (7) from a fetched copy. The other six left the app its own');
lines.push('page, which is the safe answer rather than a wrong one. `PrintClass` and `PrintFamily` are');
lines.push('pickers of three and five list items, and since 0.17.0 the index reader takes a short menu when');
lines.push('every link is alone in its own list item; both now mount as tiles. `PreapproveStudents` keeps');
lines.push('three links that share a paragraph, which is a notice\u2019s shape, so it stays with the app, as do');
lines.push('`EmailClass`, read from its anchor count, looked like four destinations in 86 characters; the four');
lines.push('were its breadcrumb. It offers two choices, a link and an action the app runs, and since 0.20.0 it');
lines.push('renders as a note with both. `SendEmail` is the picker that count described: four links to itself');
lines.push('and no action, so it stays with the app on purpose. `Unenroll` is a confirmation, and since 0.18.0');
lines.push('it renders as the ask-before-doing card');
lines.push('with the app\u2019s own Continue button. Two');
lines.push('of the `AddStudentMakeup` shapes redirect to the `tidExpired` notice rather than');
lines.push('drawing their own screen.');
lines.push('');
lines.push('So the honest reading of the notice row is 50 confirmed notices, not 68: the 18-point gap is');
lines.push('the cost of classifying from fetched HTML alone. The table above still reflects the crawl,');
lines.push('because that is what the crawler could see; the measured numbers are here.');
lines.push('Probe mode (`?sdprobe=1`) records what a screen really contained.');
lines.push('');

// What is left, by the shape of the work rather than by module: one adapter can
// cover a whole bucket, which is what makes it worth building or not.
const leftover = all.filter((p) => p.view === 'none');
const bucketOf = (p) => {
  const rows = p.counts.rows || 0;
  const controls = p.controlsTotal || 0;
  const links = p.counts.links || 0;
  if (controls >= 4) return 'A form with a save/submit button';
  if (rows >= 2 && controls >= 1) return 'A table with a few controls';
  if (rows >= 2) return 'A table on its own';
  if (controls >= 1) return 'A couple of controls, no rows';
  if (links >= 15) return 'A long list of links (15 or more)';
  return 'A thin page (title and a link or two)';
};
const buckets = new Map();
for (const p of leftover) {
  const key = bucketOf(p);
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push(p);
}

lines.push('## What is left, by shape');
lines.push('');
lines.push('| Shape of the remainder | Screens | Examples |');
lines.push('|---|---|---|');
for (const [key, pages] of [...buckets.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const examples = pages.slice(0, 4).map((p) => `\`${p.shape}\``).join(', ');
  lines.push(`| ${key} | ${pages.length} | ${examples} |`);
}
lines.push('');
lines.push('That ordering is the work order: one adapter per row covers every screen in it.');
lines.push('');

// What a plain GET could not see. A crawl fetches HTML and never runs the app's
// JS, so a screen the app builds after load arrives as a form with nothing in
// it; and until the crawler recorded `[onclick]`/`.Btn`, its div buttons were
// not counted at all. Both are listed, because both are screens where a reader
// written from the crawl alone would miss the controls the page really has.
const emptyShell = all.filter((p) => (p.counts.controls || 0) === 0
  && (p.counts.forms || 0) >= 1
  && (p.counts.rows || 0) === 0
  && (p.counts.links || 0) < 20);
// A control the earlier crawler could not record: an anchor with no href
// (Save, Delete, More — the record bar's `onclick` links) or an element that is
// not an anchor at all (the phone-label `span.link`). `href` is null only when
// the attribute is absent; older crawl files have no field, so they say nothing.
const blind = (p) => (p.actions || []).filter((a) => a.tag !== 'a'
  || (a.tag === 'a' && a.href === null));
const divButtons = all.filter((p) => blind(p).length);
const ownActions = (p) => (p.actions || []).filter((a) => a.js && a.id !== 'save' && !/^save$/i.test(a.label || ''));
const multiButton = all.filter((p) => p.view === 'settings' && ownActions(p).length >= 2);

lines.push('## Blind spots');
lines.push('');
lines.push('A crawl is a GET: it never runs the app\'s JavaScript. Two kinds of screen therefore need');
lines.push('reading twice — once from the HTML, once from the page as drawn.');
lines.push('');
lines.push(`### Screens with no controls in the HTML — ${emptyShell.length}`);
lines.push('');
lines.push('A form, zero controls, zero rows — but these are not blank pages. Measured live, the HTML of');
lines.push('this bucket carried 0.7–1.8 kB of content in its content container; what it lacks is controls.');
lines.push('Most are notices, whose text and buttons the notice reader already handles. A minority have');
lines.push('their form drawn by the app after load, and only a rendered page shows which is which.');
lines.push('');
if (emptyShell.length) {
  lines.push('| Page | Title | Links |');
  lines.push('|---|---|---|');
  for (const p of emptyShell.sort((a, b) => a.shape.localeCompare(b.shape))) {
    lines.push(`| \`${p.shape}\` | ${(p.title || '').replace(/\|/g, '\\|').slice(0, 46) || '—'} | ${p.counts.links} |`);
  }
} else {
  lines.push('None: every crawled form carried its controls in the HTML.');
}
lines.push('');
lines.push(`### Controls with no href, or not an anchor at all — ${divButtons.length} screens`);
lines.push('');
lines.push('The crawler used to record `a[href], button, input[type=…]` only. The record bar\'s controls');
lines.push('are `<a id="save" onclick="StudioDir.onSubmit(\'SaveStudent\')">` — **no href at all** — so');
lines.push('Save, Delete and More were invisible in every earlier crawl, and so were the phone-label');
lines.push('`span.link`s on a family page. This is that set, per screen.');
lines.push('');
if (divButtons.length) {
  lines.push('| Page | Title | Blink controls | Element |');
  lines.push('|---|---|---|---|');
  for (const p of divButtons) {
    for (const a of blind(p).slice(0, 6)) {
      const kind = a.tag === 'a' ? 'a (no href)' : a.tag + (a.cls ? '.' + a.cls.split(' ')[0] : '');
      const name = (a.id ? '#' + a.id : (a.label || '(no text)')).replace(/\|/g, '\\|').slice(0, 40);
      lines.push(`| \`${p.shape}\` | ${(p.title || '').replace(/\|/g, '\\|').slice(0, 34) || '—'} | ${name} | ${kind} |`);
    }
  }
} else {
  lines.push('_None recorded._');
}
lines.push('');
lines.push(`### Settings cards with more than one control of their own — ${multiButton.length}`);
lines.push('');
lines.push('These route to the small-form card, which used to offer a single Save button. Each one has');
lines.push('its own buttons (OK, Accept, Enroll), so the card offers all of them.');
lines.push('');
if (multiButton.length) {
  lines.push('| Page | Title | Controls |');
  lines.push('|---|---|---|');
  for (const p of multiButton.sort((a, b) => a.shape.localeCompare(b.shape))) {
    lines.push(`| \`${p.shape}\` | ${(p.title || '').replace(/\|/g, '\\|').slice(0, 40) || '—'} | ${ownActions(p).map((a) => (a.label || '(no text)').replace(/\|/g, '\\|')).join(' / ')} |`);
  }
} else {
  lines.push('_None._');
}
lines.push('');
lines.push('## Screens by module');
lines.push('');

for (const [name, pages] of [...groups.entries()].sort((a, b) => moduleRank(a[0]) - moduleRank(b[0]))) {
  const c = tally(pages);
  const summary = VIEW_ORDER.filter((v) => c[v]).map((v) => `${c[v]} ${v}`).join(', ');
  lines.push(`### ${name} — ${pages.length} screens (${summary})`);
  lines.push('');
  lines.push('| Page | Title | Kind | Rows | Controls | Tabs | View |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const p of pages.sort((a, b) => a.shape.localeCompare(b.shape))) {
    const title = (p.title || '').replace(/\|/g, '\\|').slice(0, 60);
    lines.push(`| \`${p.shape}\` | ${title} | ${p.kind} | ${p.counts.rows} | ${p.controlsTotal} | ${p.tabs.length} | ${p.view} |`);
  }
  lines.push('');
}

lines.push('## Links not followed');
lines.push('');
lines.push('Anything whose page name contains an action verb is recorded and never requested, because');
lines.push('a crawl must not delete, charge, or email. These are the screens behind those links:');
lines.push('');
const skippedByPage = new Map();
for (const s of crawl.skipped || []) skippedByPage.set(s.page, (skippedByPage.get(s.page) || 0) + 1);
if (!skippedByPage.size) lines.push('None, because this run followed every flagged link. It says so below.');
for (const [page, n] of [...skippedByPage.entries()].sort()) lines.push(`- \`${page}\` (${n})`);
lines.push('');

lines.push('## Links the safety rule flagged');
lines.push('');
lines.push('`tools/scrape-all.js` will not request a link whose page name contains an action verb,');
lines.push('because a crawl must not delete, charge, or email. A run with `{ all: true }` follows them');
lines.push('anyway and records each one in `followedRisky`; this crawl was such a run, and followed');
lines.push(`${riskyLinks.length} of them.`);
lines.push('');
const riskyByUrl = new Map(crawl.pages.map((p) => [p.url, p]));
const flagged = riskyLinks.map((r) => riskyByUrl.get(r.url)).filter(Boolean);
lines.push(`Every one was a plain GET, and ${flagged.length} of ${riskyLinks.length} are in this map as screens.`);
lines.push('What the rule matched is the name of the screen behind the link, not an act:');
lines.push('');
const flaggedKinds = new Map();
for (const p of flagged) {
  if (!flaggedKinds.has(p.kind)) flaggedKinds.set(p.kind, []);
  flaggedKinds.get(p.kind).push(p);
}
lines.push('| Kind | Screens | Examples |');
lines.push('|---|---|---|');
for (const [kind, pages] of [...flaggedKinds.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const names = pages.map((p) => `\`${p.shape}\``);
  const shown = names.slice(0, 3).join(', ') + (names.length > 3 ? `, +${names.length - 3} more` : '');
  lines.push(`| ${kind} | ${pages.length} | ${shown} |`);
}
lines.push('');
const confirmations = flagged.filter((p) => /confirm|updated|saved|success/i.test(p.title || ''));
if (!confirmations.length) {
  lines.push('None came back with a confirmation title, so no GET changed a record: the destinations are');
  lines.push('the charge, delete, reset and email *forms* themselves, which is where the crawl had to go');
  lines.push('to map them. The `Login` and `Register` links point at the public portal sign-in page.');
} else {
  lines.push(`${confirmations.length} came back with a confirmation title, so those GETs may have acted.`);
  lines.push('They are listed here so the next crawl can decide whether to follow them again.');
  for (const p of confirmations) lines.push(`- \`${p.shape}\` (${p.title})`);
}
lines.push('');

fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
fs.writeFileSync(path.resolve(output), lines.join('\n'));
console.log(`wrote ${output} (${lines.length} lines, ${crawl.pages.length} screens)`);
console.log('coverage:', counts);
