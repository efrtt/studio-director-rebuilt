/*
 * Toggle settings screens.
 *
 * 45 pages in the crawl are one or two controls and a button: SetPerforming (a
 * select and an OK), SearchDisplayFormat (two selects), ManageFamilyStudentMax
 * (two numbers), ConfigureCalendar (a radio pair), PortalAccess (eleven selects).
 * They have no record form to read — the controls live in plain blocks — so the
 * adapter walks the controls and finds each one's label the way a reader does.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser } from 'linkedom';

globalThis.DOMParser = DOMParser;

const here = path.dirname(fileURLToPath(import.meta.url));
const { parseHtml } = await import('../src/lib/shell.js');
const { readSettings, settingsChanges, saveSettingsInApp } = await import('../src/lib/settings.js');
const { readPage } = await import('../src/lib/page.js');

const load = (name) => parseHtml(fs.readFileSync(path.join(here, 'fixtures', name), 'utf8'));

const pageDoc = load('settings-search.html');
const settings = readSettings(pageDoc);

test('a toggle page is its controls, with the labels the page prints', () => {
  assert.ok(settings, 'SearchDisplayFormat is a settings screen');
  assert.equal(settings.kind, 'settings');
  assert.equal(settings.title, 'Search Display Format');

  assert.deepEqual(settings.fields.map((f) => f.label),
    ['Format', 'Order by', 'Show inactive', 'Page size', 'Calendar style', 'Notice shown above results', 'Legacy header']);
});

test('each of the app’s label shapes is read', () => {
  const byLabel = Object.fromEntries(settings.fields.map((f) => [f.label, f]));

  assert.equal(byLabel.Format.source, 'block', 'a div above the control');
  assert.equal(byLabel.Format.type, 'select');
  assert.equal(byLabel.Format.value, 'table', 'the selected option is the value');

  assert.equal(byLabel['Show inactive'].source, 'cell', 'a table cell before it');
  assert.equal(byLabel['Show inactive'].type, 'checkbox');
  assert.equal(byLabel['Show inactive'].value, true);

  assert.equal(byLabel['Notice shown above results'].source, 'title', 'aria-label');

  // Nothing on the page names it, so the field's own name stands in — and says
  // so, rather than passing a guess off as the app's wording.
  assert.equal(byLabel['Legacy header'].source, 'name');
  assert.equal(byLabel['Legacy header'].type, 'text');
});

test('a radio pair is one setting with two choices, not two settings', () => {
  const calendar = settings.fields.find((f) => f.type === 'radio');
  assert.ok(calendar, 'admincal is a radio group');
  assert.equal(calendar.key, 'radio:admincal');
  assert.equal(calendar.label, 'Calendar style', 'named after the block, not the first choice');
  assert.deepEqual(calendar.options.map((o) => o.label), ['Admin calendar', 'Calendar table']);
  assert.deepEqual(calendar.options.map((o) => o.value), ['admincal', 'caltable']);
  assert.equal(calendar.value, 'admincal', 'the checked one');
  assert.equal(calendar.selector, '[name="admincal"]', 'the choice is written to the set');
});

test('routing sends a toggle page to the settings view', () => {
  const page = readPage(pageDoc, 'https://app.thestudiodirector.com/studio1/admin.sd?page=SearchDisplayFormat');
  assert.equal(page.view, 'settings');
  assert.equal(page.title, 'Search Display Format');
  assert.equal(page.settings.fields.length, 7);
});

test('a menu is still a menu, and a record page is still a form', () => {
  const menu = readPage(load('index-charges.html'), 'https://x/admin.sd?page=ChargesHome');
  assert.equal(menu.view, 'index');
  assert.equal(menu.settings, null, 'a landing page is never a settings card');

  const record = readPage(load('editor-class.html'), 'https://x/admin.sd?page=NewClass');
  assert.equal(record.view, 'list');
  assert.equal(record.settings, null);

  const report = readPage(load('report-roster.html'), 'https://x/admin.sd?page=ClassRosterForm');
  assert.equal(report.view, 'report');
  assert.equal(report.settings, null);
});

test('a table with headings is a sheet, not a settings card', () => {
  const doc = parseHtml(`<form id="idForm"><div class="contentContainer"><div class="Content">
      <div class="formTitle">Manage Sizes</div>
      <table class="ReportTable"><tr><th>Size</th></tr>
        <tr><td>Child Small</td></tr><tr><td>Child Medium</td></tr></table>
      <div class="SettingRow"><div>Sort</div><input type="text" name="sort" value="1"></div>
      <a id="save" href="#">Save</a>
    </div></div></form>`);
  assert.equal(readSettings(doc), null);
  assert.equal(readPage(doc, 'https://x/admin.sd?page=ManageSizes').view, 'sheet');
});

test('a page with controls but no way to save is left to the app', () => {
  const doc = parseHtml(`<form id="idForm"><div class="contentContainer"><div class="Content">
      <div class="formTitle">Manage Portal</div>
      <div class="SettingRow"><div>Portal</div>
        <select name="portal"><option value="1" selected>On</option><option value="0">Off</option></select></div>
    </div></div></form>`);
  assert.equal(readSettings(doc), null);
});

test('the app’s own Save in the top bar counts as a way to save', () => {
  const doc = parseHtml(`<form id="idForm">
      <div class="topBarContainer"><a id="save" href="#">Save</a></div>
      <div class="contentContainer"><div class="Content">
        <div class="formTitle">Manage Portal</div>
        <div class="SettingRow"><div>Portal</div>
          <select name="portal"><option value="1" selected>On</option><option value="0">Off</option></select></div>
      </div></div></form>`);
  const read = readSettings(doc);
  assert.ok(read, 'a titled page with a save link is a screen');
  assert.equal(read.save.label, 'Save');
  assert.equal(read.fields.length, 1);
});

test('only what changed is written, radios included', () => {
  const values = {};
  for (const field of settings.fields) values[field.key] = field.value;

  assert.deepEqual(settingsChanges(settings, values), [], 'nothing edited, nothing written');

  const at = (label) => settings.fields.find((f) => f.label === label).key;
  values[at('Format')] = 'list';
  values.show_inactive = false;
  values['radio:admincal'] = 'caltable';

  const changes = settingsChanges(settings, values);
  assert.deepEqual(changes.map((c) => c.key).sort(),
    ['name:fmt', 'radio:admincal', 'show_inactive'], 'the page’s own order');
  assert.equal(changes.find((c) => c.key === at('Format')).selector, '[name="fmt"]');
  assert.equal(changes.find((c) => c.key === 'radio:admincal').radio, true);
});

test('saving writes the live page and clicks the app’s own Save', () => {
  const live = load('settings-search.html');
  let clicks = 0;
  live.getElementById('save').addEventListener('click', (e) => {
    e.preventDefault();
    clicks += 1;
  });

  const values = {};
  for (const field of settings.fields) values[field.key] = field.value;
  const at = (label) => settings.fields.find((f) => f.label === label).key;
  values[at('Format')] = 'list';
  values.show_inactive = false;
  values['radio:admincal'] = 'caltable';
  values.page_size = '100';

  const result = saveSettingsInApp(live, settings, values);
  assert.equal(result.submitted, true);
  assert.equal(result.label, 'Save');
  assert.deepEqual(result.applied.sort(), ['name:fmt', 'page_size', 'radio:admincal', 'show_inactive']);
  assert.equal(clicks, 1, 'the app decides what the request is');

  const fmt = Array.from(live.querySelectorAll('[name="fmt"] option')).find((o) => o.hasAttribute('selected'));
  assert.equal(fmt.getAttribute('value'), 'list');

  assert.equal(live.getElementById('show_inactive').hasAttribute('checked'), false);
  assert.equal(live.getElementById('page_size').getAttribute('value'), '100');

  const radios = Array.from(live.querySelectorAll('[name="admincal"]'));
  assert.deepEqual(radios.map((r) => r.hasAttribute('checked')), [false, true]);
});

test('a page that lost its Save says so instead of claiming success', () => {
  const live = load('settings-search.html');
  live.getElementById('save').remove();

  const values = {};
  for (const field of settings.fields) values[field.key] = field.value;
  values[settings.fields.find((f) => f.label === 'Format').key] = 'list';

  const result = saveSettingsInApp(live, settings, values);
  assert.equal(result.submitted, false);
  assert.equal(result.reason, 'missing');
  assert.deepEqual(result.applied, ['name:fmt'], 'the edit still reached the page');
});

// The enroll step is the page that caught this: two date pickers built by the
// app, and its two buttons are divs carrying the app's own onclick. Reading only
// a/button/input found no button at all, so the card offered nothing to press.
const ENROLL = `<form id="idForm">
  <div class="topBarContainer"><a id="save" href="#">Save</a></div>
  <div class="contentContainer"><div class="Content">
    <div class="formTitle">Enroll Student</div>
    <select id="enroll_time"><option value="1" selected>Fri, Oct 30, 2026</option></select>
    <select id="start_classes_time"><option value="1" selected>Fri, Oct 30, 2026</option></select>
    <div class="ButtonArea">
      <div class="Btn" onclick="StudioDir.onSubmit('Enroll');">Enroll</div>
      <div class="BtnOutln" onclick="StudioDir.onSubmit('Cancel');">Cancel</div>
    </div>
  </div></div></form>`;

test('the app’s buttons are divs on some screens, and they are still buttons', () => {
  const doc = parseHtml(ENROLL);
  const read = readSettings(doc);

  assert.ok(read, 'the enroll step is a small form with a save');
  // Nothing on the page names these two, so their field names stand in. The
  // view no longer annotates that: the label is the label.
  assert.deepEqual(read.fields.map((f) => f.label), ['Enroll time', 'Start classes time']);
  assert.deepEqual(read.fields.map((f) => f.source), ['name', 'name']);

  assert.deepEqual(read.actions.map((a) => a.label), ['Enroll', 'Cancel'],
    'a div with the app’s onclick is a control, not decoration');
  assert.deepEqual(read.actions.map((a) => a.js), [true, true]);
  assert.equal(read.save.label, 'Save');
});

test('pressing Enroll writes the dates and clicks the app’s own div', () => {
  const live = parseHtml(ENROLL);
  const read = readSettings(live);

  // The div has no click behaviour of its own beyond its onclick attribute,
  // which this DOM does not run — so count the click itself.
  const presses = [];
  for (const el of live.querySelectorAll('.Btn, .BtnOutln')) {
    el.addEventListener('click', () => presses.push(el.textContent.trim()));
  }

  const values = {};
  for (const field of read.fields) values[field.key] = field.value;
  values.enroll_time = '2';

  const enroll = read.actions.find((a) => a.label === 'Enroll');
  const result = saveSettingsInApp(live, read, values, enroll);

  assert.equal(result.submitted, true);
  assert.equal(result.label, 'Enroll');
  assert.deepEqual(result.applied, ['enroll_time']);
  assert.deepEqual(presses, ['Enroll'], 'Cancel was not pressed on the way');
  assert.equal(live.getElementById('start_classes_time').value, '1', 'the untouched date keeps its value');
});

test('the overlay’s own Enroll button is never the one pressed', () => {
  // The card shows Enroll too, so the live document holds two things called
  // Enroll: the app's div and this UI's button. Pressing must find the app's.
  const live = parseHtml(ENROLL);
  const overlay = live.createElement('div');
  overlay.id = 'sd-root';
  overlay.innerHTML = '<button type="button">Enroll</button>';
  live.querySelector('.contentContainer').after(overlay);

  const read = readSettings(live);
  const presses = [];
  live.querySelector('.Btn').addEventListener('click', () => presses.push('app'));
  overlay.querySelector('button').addEventListener('click', () => presses.push('overlay'));

  const enroll = read.actions.find((a) => a.label === 'Enroll');
  const result = saveSettingsInApp(live, read, {}, enroll);

  assert.equal(result.submitted, true);
  assert.equal(result.via, 'label');
  assert.deepEqual(presses, ['app'], 'the app’s control runs, not this UI’s twin');
});

test('a wrapper carrying the handler is not a second button', () => {
  const doc = parseHtml(`<div class="contentContainer"><div class="Content">
      <div class="formTitle">Next Step</div>
      <div class="SettingRow"><div>Amount</div><input id="amount" type="text" value="5"></div>
      <div class="Btn" onclick="StudioDir.next();"><a href="#" id="next">Next</a></div>
      <a id="save" href="#">Save</a>
    </div></div>`);
  const read = readSettings(doc);
  // One Next, not two; the `#save` in the content root is the card's own Save,
  // which the view folds into its Save button rather than showing twice.
  assert.deepEqual(read.actions.map((a) => a.label), ['Next', 'Save']);
  assert.equal(read.save.id, 'save');
});

test('an empty select is not offered: the app fills it in later', () => {
  const doc = parseHtml(`<form id="idForm"><div class="contentContainer"><div class="Content">
      <div class="formTitle">Split Performances</div>
      <div class="SettingRow"><div>Event</div><select name="events"></select></div>
      <div class="SettingRow"><div>Show</div>
        <select name="show"><option value="1" selected>Yes</option><option value="0">No</option></select></div>
      <a id="save" href="#">Save</a>
    </div></div></form>`);
  const read = readSettings(doc);
  assert.deepEqual(read.fields.map((f) => f.label), ['Show']);
});
