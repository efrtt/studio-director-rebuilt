import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser } from 'linkedom';

// The adapters are browser-shaped on purpose; give them a DOMParser first.
globalThis.DOMParser = DOMParser;

const here = path.dirname(fileURLToPath(import.meta.url));
const { parseHtml, pageName, oneLabel, railLinks, isLoginPage, hasShell,
  recordParams, recordId, isRecordPage } = await import('../src/lib/shell.js');
const { readWeek, PX_PER_MIN } = await import('../src/lib/calendar.js');
const { readList } = await import('../src/lib/list.js');
const { readPage } = await import('../src/lib/page.js');
const { readForm } = await import('../src/lib/form.js');
const { recordModel } = await import('../src/lib/record.js');
const { readTabs } = await import('../src/lib/tabs.js');
const { showAllTrigger, expandInApp } = await import('../src/lib/expand.js');
const { confirmationOf } = await import('../src/lib/confirmation.js');
const { runSearch, queryFromUrl } = await import('../src/lib/search.js');
const { changesFrom, applyChanges, saveInApp } = await import('../src/lib/save.js');

const load = (name) => parseHtml(fs.readFileSync(path.join(here, 'fixtures', name), 'utf8'));

const calendarDoc = load('calendar-page.html');
const classDoc = load('editor-class.html');
const studentDoc = load('editor-student.html');
const familyDoc = load('editor-family.html');
const editFamilyDoc = load('edit-family.html');
const editStudentDoc = load('edit-student.html');
const editClassDoc = load('edit-class.html');
const confirmationDoc = load('confirmation.html');
const searchDoc = load('search-results.html');
const weekOnlyDoc = parseHtml(`<table class="TimeBlock"><tbody>
  <tr><th>Monday</th></tr>
  <tr><td>4:00p</td><td><div>
    <div style="top:0px;left:0%;width:100%;height:30px">
      <div style="background-color:#ffffff"><a href="admin.sd?page=EditClass&amp;cident=9">Ballet</a></div>
    </div>
  </div></td></tr>
</tbody></table>`);
const loginDoc = parseHtml('<div class="LoginContainer"><form id="idForm" action="login.sd"></form></div>');
const bareDoc = parseHtml('<form id="idForm"><div id="mainContent"><div class="contentContainer"><div class="Content"></div></div></div></form>');

/* ---------------- week calendar (from the CalendarPage dump) --------------- */

test('the week calendar is one section per day', () => {
  const week = readWeek(calendarDoc);
  assert.equal(week.kind, 'week');
  assert.deepEqual(week.days.map((d) => d.label), ['Monday', 'Tuesday', 'Sunday']);
  assert.equal(week.week, 'Week of October 26');

  assert.equal(week.days[0].blocks.length, 8);
  assert.equal(week.days[1].blocks.length, 2);
  assert.equal(week.days[2].blocks.length, 1);
});

test('each day gets one column per studio, left to right', () => {
  const monday = readWeek(calendarDoc).days[0];

  assert.deepEqual(monday.columns.map((c) => c.label),
    ['Studio 1', 'Studio 2', 'Studio 3', 'Studio 4']);
  assert.deepEqual(monday.columns.map((c) => c.blocks.length), [2, 2, 2, 2]);

  // Every day keeps all four columns, even when a studio is empty: a class in
  // studio 3 must stay third from the left on Tuesday too.
  const tuesday = readWeek(calendarDoc).days[1];
  assert.equal(tuesday.columns.length, 4);
  assert.deepEqual(tuesday.columns.map((c) => c.blocks.length), [1, 0, 1, 0]);
  assert.equal(readWeek(calendarDoc).studioCount, 4);
  assert.deepEqual(monday.columns[0].blocks.map((b) => b.name),
    ['Ballet', 'Senior Ballet Co Tech']);

  // Studio comes from the app's own label; the lane is the fallback (25% steps).
  assert.deepEqual(monday.blocks.map((b) => b.studio), [1, 2, 3, 4, 1, 2, 3, 4]);
  const bare = parseHtml(`<table class="TimeBlock"><tbody>
    <tr><th>Monday</th></tr>
    <tr><td>3PM</td><td><div>
      <div style="top:0px;left:50.0%;width:25.0%;height:60px">
        <div style="background-color:#ffffff"><a href="admin.sd?page=EditClass&amp;cident=9">Ballet</a></div>
      </div>
    </div></td></tr>
  </tbody></table>`);
  assert.equal(readWeek(bare).days[0].blocks[0].studio, 3);
});

test('start and end times are read from the block\u2019s own text', () => {
  const monday = readWeek(calendarDoc).days[0];
  const ballet = monday.blocks[0];

  assert.equal(ballet.startsAt, 15 * 60 + 45);
  assert.equal(ballet.endsAt, 16 * 60 + 30);
  assert.equal(ballet.studio, 1);
  assert.equal(ballet.taken, 15);
  assert.equal(ballet.capacity, 15);
  assert.equal(ballet.timeLabel, '3:45p\u20134:30p');
  assert.equal(ballet.meta, '3:45p–4:30p · 15 enrolled');
});

test('blocks are sized by duration, not by the app\u2019s pixels', () => {
  const monday = readWeek(calendarDoc).days[0];
  const span = monday.blocks.find((b) => b.name === 'Pre-Pointe');

  // 4:00 PM - 5:30 PM is 90 minutes; the day starts at 3 PM.
  assert.equal(span.top, (16 * 60 - 15 * 60) * PX_PER_MIN);
  assert.equal(span.height, 90 * PX_PER_MIN);
  assert.equal(monday.height, (19 * 60 - 15 * 60) * PX_PER_MIN);
  assert.deepEqual(monday.hours.map((h) => h.label), ['3 PM', '4 PM', '5 PM', '6 PM', '7 PM']);

  // A 15-minute class is a short block, not a full row.
  const tuesday = readWeek(calendarDoc).days[1];
  assert.equal(tuesday.blocks.find((b) => b.name === 'Faculty').height, 15 * PX_PER_MIN);
});

test('the hidden tooltip supplies name, instructor, location, spots and ages', () => {
  const monday = readWeek(calendarDoc).days[0];
  const blocks = monday.columns[0].blocks;
  const ballet = blocks[0];

  assert.equal(ballet.name, 'Ballet');
  assert.equal(ballet.instructor, 'Ms. Rivera');
  assert.equal(ballet.location, 'Studio 1');
  assert.equal(ballet.spotsLeft, 0);
  assert.equal(ballet.waitlisted, 0);
  assert.equal(ballet.ages, '6-7');
  assert.equal(ballet.href, 'admin.sd?page=EditClass&cident=818');

  assert.deepEqual(monday.blocks.map((b) => b.spotsLeft), [0, 12, 4, 9, 17, 13, 14, 21]);
  assert.deepEqual(monday.blocks.map((b) => b.waitlisted), [0, 0, 2, 0, 0, 0, 0, 0]);
  assert.equal(readWeek(calendarDoc).days[1].blocks[0].note, 'Bring ballet shoes');
});

test('a tooltip label is not part of the class name', () => {
  const page = (tip) => parseHtml(`<table class="TimeBlock"><tbody>
    <tr><th>Monday</th></tr>
    <tr><td>3PM</td><td><div>
      <div style="top:0px;left:0%;width:25.0%;height:60px">
        <div style="background-color:#ffffff"><a href="admin.sd?page=EditClass&amp;cident=9" style="color:#000"><b>3:00p</b>Stu 1 - 9 - 3:00 PM - 4:00 PM</a></div>
        <span>${tip}</span>
      </div>
    </div></td></tr>
  </tbody></table>`);

  const labelled = readWeek(page(
    'Class Name: Ballet III<br>Ms. Rivera<br>Studio 1<br>3 spots available<br>0 waitlisted<br>Ages: 6-7'))
    .days[0].blocks[0];
  assert.equal(labelled.name, 'Ballet III');
  assert.equal(labelled.label, 'Ballet III');
  assert.equal(labelled.instructor, 'Ms. Rivera');

  // A colon that is part of the name survives: only known labels are removed.
  const own = readWeek(page(
    'Tap: Level 2<br>Mr. Cole<br>Studio 2<br>3 spots available<br>0 waitlisted'))
    .days[0].blocks[0];
  assert.equal(own.name, 'Tap: Level 2');
});

test('availability is derived from spots, never from colour', () => {
  const monday = readWeek(calendarDoc).days[0];
  assert.deepEqual(monday.blocks.map((b) => b.status),
    ['full', 'open', 'open', 'open', 'open', 'open', 'open', 'open']);
  // Enrolled, not remaining: 15 of 15 is the full one, and the next reports a
  // count even though it still has seats.
  assert.equal(monday.blocks[0].enrolled, '15 enrolled');
  assert.match(monday.blocks[1].enrolled, /^[0-9]+ enrolled$/);

  // A lane without a tooltip stays unknown: white does not mean "full".
  const bare = parseHtml(`<table class="TimeBlock"><tbody>
    <tr><th>Monday</th></tr>
    <tr><td>3PM</td><td><div>
      <div style="top:0px;left:0%;width:25.0%;height:60px">
        <div style="background-color:#ffffff"><a href="admin.sd?page=EditClass&amp;cident=9">Ballet</a></div>
      </div>
    </div></td></tr>
  </tbody></table>`);
  const entry = readWeek(bare).days[0].blocks[0];
  assert.equal(entry.status, 'unknown');
  assert.equal(entry.spotsLeft, null);
  assert.equal(entry.name, 'Ballet');
});

test('a class with no time is kept, outside the timeline', () => {
  const sunday = readWeek(calendarDoc).days[2];
  assert.deepEqual(sunday.columns, []);
  assert.deepEqual(sunday.hours, []);
  assert.equal(sunday.height, 0);
  assert.deepEqual(sunday.untimed.map((b) => b.name), ['Company Rehearsal']);
  assert.equal(sunday.untimed[0].code, '10:00a');
});

test('faculty-pool classes are left off, and counted', () => {
  const lane = (cident, name, instructor, top) => `
    <div style="top:${top}px;left:0%;width:25.0%;height:60px">
      <div style="background-color:#ffffff">
        <a href="admin.sd?page=EditClass&amp;cident=${cident}" style="color:#000"><b>3:00p</b>Stu 1 - ${name} - 3:00 PM - 4:00 PM - 4 of 10 spots taken</a>
      </div>
      <span>${name}<br>${instructor}<br>Studio 1<br>4 spots available<br>0 waitlisted</span>
    </div>`;

  const doc = parseHtml(`<table class="TimeBlock"><tbody>
    <tr><th>Monday</th></tr>
    <tr><td>3PM</td><td><div>${lane(1, 'Ballet III', 'Ms. Rivera', 0)}${lane(2, 'Open Studio', 'studio1 Faculty', 60)}${lane(3, 'Jazz', 'studio1 faculty', 120)}</div></td></tr>
  </tbody></table>`);

  const week = readWeek(doc);
  assert.deepEqual(week.days[0].blocks.map((b) => b.name), ['Ballet III']);
  assert.equal(week.totals.classes, 1);
  assert.equal(week.hidden, 2); // case does not matter
  assert.equal(week.days[0].columns[0].blocks.length, 1);
});

test('a day with no classes keeps its section instead of disappearing', () => {
  const page = parseHtml(`<table class="TimeBlock"><tbody>
    <tr><th>Wednesday</th></tr>
    <tr><td>6PM</td><td></td></tr>
  </tbody></table>`);
  const week = readWeek(page);
  assert.equal(week.days.length, 1);
  assert.equal(week.days[0].label, 'Wednesday');
  assert.deepEqual(week.days[0].blocks, []);
  assert.deepEqual(week.totals, { classes: 0, spots: 0, waitlisted: 0, full: 0 });
});

test('weekly totals add up across days', () => {
  const week = readWeek(calendarDoc);
  assert.deepEqual(week.totals, { classes: 11, spots: 142, waitlisted: 2, full: 1 });
});

/* ---------------- record lists (from the NewClass dump) ------------------- */

test('the side panel becomes a record list, with its heading verbatim', () => {
  const list = readList(classDoc);
  assert.equal(list.kind, 'list');
  assert.equal(list.label, 'Classes');
  assert.equal(list.items.length, 3);
  assert.equal(list.items[0].label, 'Ballet III - Mon 4:00p');
  assert.equal(list.items[0].href, 'admin.sd?page=NewClass&cident=101');
});

test('the panel says how many records exist, and we do not pretend to have them', () => {
  const page = parseHtml(`<div id="idSearchSpan" class="searchResultPanel">
    <div class="searchResultBar"><div class="searchResultLabel">Families</div></div>
    <div class="searchResultLabel"><input id="filter" name="filter" type="text" placeholder="Filter 4291 items"><p>2 of 2</p></div>
    <div class="searchResultList">
      <div class="searchResultItem"><a href="admin.sd?page=NewFamily&amp;fident=1">Abbott Family</a></div>
      <div class="searchResultItem"><a href="admin.sd?page=NewFamily&amp;fident=2">Abene Family</a></div>
    </div>
  </div>`);
  const list = readList(page);
  assert.equal(list.total, 4291);
  assert.equal(list.truncated, true);
  assert.equal(list.items.length, 2);

  // No total on the page -> no total claimed, and nothing flagged as cut off.
  const silent = readList(classDoc);
  assert.equal(silent.total, null);
  assert.equal(silent.truncated, false);
});

test('the live panel\u2019s heading is a count, so it is the total and not the name', () => {
  const page = parseHtml(`<div id="idSearchSpan" class="searchResultPanel">
    <div class="searchResultBar"><div class="searchResultLabel">4291 Items</div></div>
    <div class="searchResultLabel"><input id="filter" name="filter" placeholder="New Name Search"><p>500 of 500</p></div>
    <div class="searchResultList">
      <div class="searchResultItem"><a href="admin.sd?page=NewFamily&amp;fident=1">Abbott Family</a></div>
    </div>
    <div class="showAll">Show All</div>
  </div>`);
  const list = readList(page);
  assert.equal(list.total, 4291);
  assert.equal(list.truncated, true);
  // "4291 Items" is not a name; with no .formTitle on this stub it falls back.
  assert.equal(list.label, 'Records');
});

test('Show All is found by its own label, never a container that contains it', () => {
  const trigger = { textContent: ' Show All ', click() {} };
  const label = (t) => ({ textContent: t, children: [], querySelector: () => null });
  const panel = {
    querySelectorAll: (sel) => [label('Results'), trigger, label('Show All and more')]
  };
  const root = { querySelector: (sel) => (sel === '#idSearchSpan' ? panel : null) };
  assert.equal(showAllTrigger(root), trigger);

  const none = { querySelector: () => ({ querySelectorAll: () => [label('Results')] }) };
  assert.equal(showAllTrigger(none), null);
});

test('expanding clicks the app\u2019s control and waits for the rows to arrive', async () => {
  const make = (start, after) => {
    const state = { n: start };
    const label = {
      tagName: 'DIV',
      className: 'showAll',
      textContent: 'Show All',
      click: () => { state.n = after; },
      dispatchEvent: () => { state.n = after; },
      closest: () => null,
      querySelector: () => null
    };
    return {
      state,
      root: {
        querySelector: (sel) => (sel === '#idSearchSpan' ? { querySelectorAll: () => [label] } : null),
        querySelectorAll: () => new Array(state.n).fill(null)
      }
    };
  };

  const grow = make(3, 6);
  const result = await expandInApp(grow.root, { step: 1, stableTicks: 2, wait: 200 });
  assert.equal(result.clicked, true);
  assert.equal(result.before, 3);
  assert.equal(result.count, 6);
  assert.equal(result.changed, true);
  assert.ok(result.tried.length > 0);

  // A page with no such control reports that, rather than pretending to load.
  const empty = { querySelector: () => null, querySelectorAll: () => [] };
  const nothing = await expandInApp(empty, { step: 1, stableTicks: 1, wait: 50 });
  assert.equal(nothing.clicked, false);
  assert.equal(nothing.count, 0);

  // A control that is pressed but does nothing says so, and says what it tried:
  // "loading..." then back to the button is never the whole story.
  const stuck = make(3, 3);
  const noop = await expandInApp(stuck.root, { step: 1, stableTicks: 1, wait: 40, probeWait: 10 });
  assert.equal(noop.changed, false);
  assert.equal(noop.count, 3);
  assert.ok(noop.tried.length > 0);
  assert.ok(Array.isArray(noop.requests));
});

test('Students and Families need no new code: the same panel shape works', () => {
  const students = readList(studentDoc);
  assert.equal(students.label, 'Students');
  assert.equal(students.items.length, 3);
  assert.deepEqual(students.items.map((i) => i.label),
    ['Ada Lovelace', 'Grace Hopper', 'Katherine Johnson']);
  assert.equal(students.items[1].href, 'admin.sd?page=NewStudent&sid=9002');

  const families = readList(familyDoc);
  assert.equal(families.label, 'Families');
  assert.equal(families.items.length, 3);
  assert.deepEqual(families.items.map((i) => i.label),
    ['Lovelace Family', 'Hopper Family', 'Rivera Family']);
  assert.equal(families.items[0].href, 'admin.sd?page=NewFamily&fident=4401');
});

/* ---------------- routing ------------------------------------------------- */

/* ---------------- the page the app returns after a save ------------------- */

test('the save confirmation is found by its sentence, not by a class name', () => {
  const confirm = confirmationOf(confirmationDoc);
  assert.equal(confirm.ok, true);
  assert.equal(confirm.message, 'Hopper Family has been updated.');
  assert.deepEqual(confirm.breadcrumb, ['Families', 'Hopper Family']);

  // The same page is routed to the confirmation view, with the list beside it.
  const page = readPage(confirmationDoc, 'https://example/studio1/admin.sd');
  assert.equal(page.view, 'confirm');
  assert.equal(page.title, 'Saved');
  assert.equal(page.list.label, 'Records'); // heading is "4291 Items"
  assert.equal(page.list.total, 4291);
  assert.equal(page.week, null);
});

test('a record called \u201c...has been updated\u201d is not a confirmation', () => {
  const page = parseHtml(`<div class="contentContainer">
    <div id="idSearchSpan" class="searchResultPanel">
      <div class="searchResultBar"><div class="searchResultLabel">Families</div></div>
      <div class="searchResultList">
        <div class="searchResultItem"><a href="admin.sd?page=EditFamily&amp;fident=1">Anne has been updated Family</a></div>
      </div>
    </div>
    <div class="Content"><div class="formTitle">Families</div></div>
  </div>`);
  assert.equal(confirmationOf(page), null);
  assert.equal(readPage(page, 'https://example/').view, 'list');
});

test('a refused save is only read as one when the caller asks for it', () => {
  const refused = parseHtml(`<div class="Content">
    <div class="contentInfo"><div>Hopper Family could not be saved: Last Name is invalid.</div></div>
  </div>`);

  // Ordinary pages are full of "invalid" and "required": success only by default.
  assert.equal(confirmationOf(refused), null);

  const outcome = confirmationOf(refused, { allowRefused: true });
  assert.equal(outcome.ok, false);
  assert.match(outcome.message, /could not be saved/);

  const page = readPage(refused, 'https://example/studio1/admin.sd', { allowRefused: true });
  assert.equal(page.view, 'confirm');
  assert.equal(page.title, 'Not saved');
});

/* ---------------- search results page ------------------------------------- */

test('search results are a list like any other, and not a record page', () => {
  const url = 'https://x/studio1/admin.sd?page=SearchResults&searchText=hopper';

  // `searchText` is the query, not an id: this page must never be treated as
  // one record (which would hand it back to the app untouched).
  assert.equal(isRecordPage(url), false);
  assert.deepEqual(recordParams(url), []);
  assert.equal(queryFromUrl(url), 'hopper');

  const page = readPage(searchDoc, url);
  assert.equal(page.view, 'list');
  assert.equal(page.list.label, 'Search Results');
  assert.equal(page.list.items.length, 3);
  // Mixed types in one list, each opening its own editor.
  assert.deepEqual(page.list.items.map((i) => i.href.split('page=')[1].split('&')[0]),
    ['EditFamily', 'EditStudent', 'EditClass']);
  assert.deepEqual(page.list.items.map((i) => i.label),
    ['Hopper Family', 'Grace Hopper', 'Ballet III - Ages 6-9']);

  // Mixed types are labelled per row; a single-type list gets no badges.
  assert.deepEqual(page.list.items.map((i) => i.type), ['Family', 'Student', 'Class']);
  assert.equal(page.list.mixed, true);
  assert.equal(readPage(classDoc, 'https://x/?page=NewClass').list.mixed, false);
});

test('the app\u2019s own \u201cFamily: \u201d label becomes the badge, not the name', () => {
  const page = parseHtml(`<div id="idSearchSpan" class="searchResultPanel">
    <div class="searchResultBar"><div class="searchResultLabel">Search Results</div></div>
    <div class="searchResultList">
      <div class="searchResultItem"><a href="admin.sd?page=EditFamily&amp;fident=2">Family: Frank/Naz Abedini</a></div>
      <div class="searchResultItem"><a href="admin.sd?page=EditStudent&amp;sident=9">Student: Ada Lovelace</a></div>
      <div class="searchResultItem"><a href="admin.sd?page=SearchResults&amp;searchText=x">Classes: Ballet III</a></div>
    </div>
  </div>`);
  const list = readList(page);
  assert.deepEqual(list.items.map((i) => i.label),
    ['Frank/Naz Abedini', 'Ada Lovelace', 'Ballet III']);
  assert.deepEqual(list.items.map((i) => i.type), ['Family', 'Student', 'Class']);
});

test('an empty result panel is a result, not a missing page', () => {
  const empty = parseHtml(`<div class="contentContainer">
    <div id="idSearchSpan" class="searchResultPanel">
      <div class="searchResultBar"><div class="searchResultLabel">Search Results</div></div>
      <div class="searchResultList"></div>
    </div>
    <div class="Content"><div class="formTitle">Search Results</div></div>
  </div>`);

  assert.equal(readList(empty), null);
  assert.equal(readList(empty, { allowEmpty: true }).items.length, 0);

  const page = readPage(empty, 'https://x/studio1/admin.sd?page=SearchResults&searchText=zzz', { allowEmpty: true });
  assert.equal(page.view, 'list');
  assert.equal(page.list.items.length, 0);
});

/* ---------------- global search ------------------------------------------- */

test('search types into the app\u2019s own box and presses one thing', () => {
  const withButton = parseHtml(`<form><div class="searchBox">
    <input id="q" type="text"><button id="go">Go</button>
  </div></form>`);
  let clicks = 0;
  withButton.getElementById('go').click = () => { clicks += 1; };

  const byButton = runSearch(withButton, '  ada  ');
  assert.equal(byButton.submitted, true);
  assert.equal(byButton.via, 'button');
  assert.equal(clicks, 1);
  assert.equal(withButton.getElementById('q').value, 'ada'); // trimmed

  const withForm = parseHtml(`<form id="f"><div class="searchBox"><input id="q" type="text"></div></form>`);
  let submits = 0;
  withForm.getElementById('f').requestSubmit = () => { submits += 1; };
  const byForm = runSearch(withForm, 'hopper');
  assert.equal(byForm.via, 'form');
  assert.equal(submits, 1, 'the form is submitted once, not once per event');

  // The app's page form is never submitted: that would re-post the editor
  // (`#idPage`/`#idMeth`) instead of searching. Enter is tried instead.
  const pageForm = parseHtml(`<form id="idForm" action="admin.sd" method="post">
    <input id="idPage" type="hidden" value="EditFamily">
    <div class="searchBox"><input id="q" type="text"></div>
  </form>`);
  let posted = 0;
  pageForm.getElementById('idForm').requestSubmit = () => { posted += 1; };
  const onEditPage = runSearch(pageForm, 'hopper');
  assert.equal(onEditPage.via, 'enter');
  assert.equal(posted, 0, 'the editor form must not be submitted by search');

  // Nothing to drive: say so instead of pretending a search happened.
  assert.equal(runSearch(bareDoc, 'x').reason, 'no-box');
  assert.equal(runSearch(withButton, '   ').reason, 'empty');
});

test('a search query survives into the rebuilt box via the URL', () => {
  assert.equal(queryFromUrl('https://x/studio1/admin.sd?page=AdvSearch&searchtext=ada'), 'ada');
  assert.equal(queryFromUrl('https://x/studio1/admin.sd?page=Search&q=hopper'), 'hopper');
  assert.equal(queryFromUrl('https://x/studio1/admin.sd?page=AdvSearch'), '');
  assert.equal(queryFromUrl('not a url'), '');
});

test('routing is structural, so all three editor pages resolve to the list view', () => {
  const cal = readPage(calendarDoc, 'https://example/studio1/admin.sd?page=CalendarPage');
  assert.equal(cal.view, 'week');
  assert.equal(cal.list, null);
  assert.equal(cal.week.kind, 'week');

  for (const doc of [classDoc, studentDoc, familyDoc]) {
    const page = readPage(doc, 'https://example/studio1/admin.sd?page=NewClass');
    assert.equal(page.view, 'list');
    assert.equal(page.week, null);
  }

  const none = readPage(bareDoc, 'https://example/studio1/admin.sd?page=Settings');
  assert.equal(none.view, null);
});

test('the editor form is never mistaken for the list', () => {
  // Both pages carry a table.Form with 13-19 rows of controls. The list adapter
  // must read only the panel, and the week adapter must ignore the form table.
  for (const doc of [classDoc, familyDoc, studentDoc]) {
    assert.equal(readWeek(doc), null);
    const list = readList(doc);
    assert.equal(list.items.some((i) => /^guardian$|^first_name$/i.test(i.label)), false);
    assert.equal(list.items.every((i) => i.href && /\?page=New/.test(i.href)), true);
  }
});

test('the full rail is read on every page, not just five entries', () => {
  for (const doc of [calendarDoc, classDoc, familyDoc, studentDoc]) {
    const nav = railLinks(doc);
    assert.equal(nav.length, 11);
    assert.deepEqual(nav.map((n) => n.label), [
      'Home', 'Class Calendar', 'Classes', 'Families', 'Students', 'Instructors',
      'Charges & Payments', 'Communications', 'Advanced Search', 'Reports', 'Settings'
    ]);
    assert.equal(nav[6].href, 'admin.sd?page=ChargesHome&clicktab=Charges');
  }
});

test('the two adapters never claim each other\u2019s pages', () => {
  assert.equal(readWeek(classDoc), null);
  assert.equal(readList(calendarDoc), null);
  assert.equal(readWeek(null), null);
  assert.equal(readList(null), null);
  assert.equal(readWeek(bareDoc), null);
});

/* ---------------- shell --------------------------------------------------- */

test('doubled rail labels are folded, shortened to one copy each', () => {
  assert.equal(oneLabel('HomeHome'), 'Home');
  assert.equal(oneLabel('Class CalendarClass Calendar'), 'Class Calendar');
  assert.equal(oneLabel('StudentsStudents'), 'Students');
  assert.equal(oneLabel('Tap II'), 'Tap II');

  const nav = railLinks(calendarDoc);
  assert.equal(nav[1].label, 'Class Calendar');
  assert.equal(nav[1].href, 'admin.sd?page=CalendarPage&clicktab=Class+Calendar');
});

test('page names come from the query, so clicktab is ignored', () => {
  assert.equal(pageName('admin.sd?page=CalendarPage&clicktab=1'), 'CalendarPage');
  assert.equal(pageName('admin.sd?page=NewStudent&clicktab=Students'), 'NewStudent');
  assert.equal(pageName('admin.sd?clicktab=1'), '');
  assert.equal(pageName('not a url'), '');
});

test('a page showing one record is handed back to the app', () => {
  // Navigation and the client-side filter are not record parameters.
  assert.deepEqual(recordParams('admin.sd?page=NewClass&clicktab=Classes'), []);
  assert.equal(isRecordPage('admin.sd?page=NewClass&clicktab=Classes'), false);
  assert.equal(isRecordPage('admin.sd?page=CalendarPage&clicktab=1'), false);
  assert.equal(isRecordPage('admin.sd?page=NewStudent&filter=ada'), false);
  // The build's own probe switch is not a record parameter. It was, once, and
  // every page visited with `?sdprobe=1` went through mountRecord instead of its
  // own route: the calendar and ChargesHome both mounted from a fetched copy.
  assert.equal(isRecordPage('admin.sd?page=CalendarPage&clicktab=1&sdprobe=1'), false);
  assert.deepEqual(recordParams('admin.sd?page=ChargesHome&sdprobe=1'), []);
  assert.equal(isRecordPage('https://x/studio1/admin.sd'), false);

  // The calendar's own link, verbatim from the dump.
  assert.equal(isRecordPage('admin.sd?page=EditClass&cident=1782910697458'), true);
  // A list item that edits in place on the New* page.
  assert.equal(isRecordPage('admin.sd?page=NewClass&cident=101'), true);
  assert.equal(isRecordPage('admin.sd?page=NewFamily&fident=4401'), true);
  assert.deepEqual(recordParams('admin.sd?page=EditStudent&sid=9001'), ['sid']);
  // An Edit page is a record page even without an id.
  assert.equal(isRecordPage('admin.sd?page=EditFamily'), true);
});

test('the record id is read for the list\u2019s current-row marker', () => {
  assert.equal(recordId('admin.sd?page=EditClass&cident=101&searchidx=2'), '101');
  assert.equal(recordId('admin.sd?page=EditClass&cident=101'), '101');
  assert.equal(recordId('admin.sd?page=NewClass&clicktab=Classes'), '');
  assert.equal(recordId(''), '');
});

/* ---------------- record editors (from the EditFamily / EditStudent dumps) - */

test('the family editor is read field by field, with its values', () => {
  const form = readForm(editFamilyDoc);
  assert.equal(form.kind, 'form');
  assert.equal(form.title, 'Edit Family');
  assert.deepEqual(form.breadcrumb, ['Families', 'Lovelace']);
  // 19 controls by id, plus the three phone-type selects, which carry a name and
  // no id: 22 fields, with the types as editable as the numbers they name.
  assert.equal(form.fields.length, 22);
  assert.deepEqual(form.rows.map((r) => r.label).slice(0, 6),
    ['Guardian Name(s)', 'Last Name', 'Address 1', 'Address 2', 'City', 'State']);

  const byKey = Object.fromEntries(form.fields.map((f) => [f.key, f]));
  assert.equal(byKey.guardian.value, 'Dana Lovelace');
  assert.equal(byKey.zip.value, '10001');
  assert.equal(byKey.state.type, 'select');
  assert.equal(byKey.state.value, 'NY');
  assert.equal(byKey.state.options.length, 2);
  assert.equal(byKey.opt_out.value, '1');
  assert.equal(byKey.phone1.masked, true);
  assert.equal(byKey.phone1.value, '(555) 010-2000');
  assert.equal(byKey.tags.options.length, 3);

  // The phone type is the row's own choice: a select of the app's ten types.
  assert.equal(byKey['name:phone1_label'].type, 'select');
  assert.equal(byKey['name:phone1_label'].options.length, 10);
  assert.equal(byKey.fident, undefined);
  // The unnamed helper input is not a field.
  assert.equal(form.fields.some((f) => f.key === 'name:-'), false);
});

test('the student editor reaches controls that carry only a name', () => {
  const form = readForm(editStudentDoc);
  assert.equal(form.title, 'Edit Student');

  const keys = form.fields.map((f) => f.key);
  assert.deepEqual(keys, [
    'first_name', 'student_last_name', 'name:family',
    'birthday__mon', 'birthday__day', 'birthday__year',
    'sex', 'medcond', 'comments', 'waiver', 'performing',
    'field1', 'field2', 'field3', 'tags'
  ]);

  const family = form.fields.find((f) => f.key === 'name:family');
  assert.equal(family.selector, '[name="family"]');
  assert.equal(family.value, '4401');
  assert.equal(form.fields.find((f) => f.key === 'birthday__mon').value, '12');
});

test('the class editor’s calendar tab is not the week calendar', () => {
  // Seven TimeBlock tables live in the Calendar tab of the class editor, shipped
  // hidden in the record's HTML. readWeek ignores anything inside a tab panel,
  // so a record page can no longer be read as a calendar by accident — the tabs
  // adapter is what those tables belong to.
  assert.equal(readWeek(editClassDoc), null);

  const tabs = readTabs(editClassDoc);
  const calendar = tabs.tabs.find((t) => t.label === 'Calendar');
  assert.deepEqual(calendar.blocks.map((b) => b.headings[0]), ['Monday', 'Wednesday']);

  const form = readForm(editClassDoc);
  assert.equal(form.fields.length, 24);
  // The weekday checkboxes belong to the form's Day row, once each, not twice
  // (the nested table's own rows are not rows of the form).
  assert.equal(form.fields.filter((f) => f.key === 'day__2').length, 1);
});

test('a small form is a form; being an editor is the page having a way to save', () => {
  // This used to assert that `readForm` refused anything under four fields, which
  // is how a report's two filters and a settings page's one select were "not a
  // form" at all. The floor goes with the rest of the size contest: the shape is
  // the table, read row by row, and whether the page is an *editor* is a separate
  // fact — its own Save, which is `recordModel`'s question.
  assert.equal(readForm(calendarDoc), null);
  assert.equal(readForm(weekOnlyDoc), null);
  assert.equal(readForm(null), null);

  const tiny = parseHtml(`<table class="Form"><tbody>
    <tr><td>A</td><td><input id="a"></td></tr>
    <tr><td>B</td><td><input id="b"></td></tr>
  </tbody></table>`);
  const form = readForm(tiny);
  assert.equal(form.rows.length, 2, 'two labelled rows are two rows, however few');
  assert.equal(form.fields.length, 2);
  assert.equal(recordModel(tiny, 'https://x.test/admin.sd?page=Thing'), null,
    'no Save, so a form it may be, an editor it is not');

  // The New* stub is the capture the floor used to refuse outright. It has three
  // controls and no Save: read as a form, still not an editor.
  assert.equal(readForm(classDoc).fields.length, 3);
  assert.equal(recordModel(classDoc, 'https://x.test/admin.sd?page=EditClass'), null);
});

test('only the fields that changed are written back to the live page', () => {
  const form = readForm(editFamilyDoc);
  const live = load('edit-family.html');

  const values = Object.fromEntries(form.fields.map((f) => [f.key, f.value]));
  values.guardian = 'Dana R. Lovelace';
  values.state = 'CA';

  const changes = changesFrom(form, values);
  assert.deepEqual(changes.map((c) => c.key), ['guardian', 'state']);

  const events = [];
  live.querySelector('#guardian').addEventListener('input', () => events.push('guardian:input'));
  live.querySelector('#state').addEventListener('change', () => events.push('state:change'));

  assert.deepEqual(applyChanges(live, changes), ['guardian', 'state']);
  assert.equal(live.querySelector('#guardian').value, 'Dana R. Lovelace');

  const chosen = Array.from(live.querySelectorAll('#state option'))
    .filter((o) => o.hasAttribute('selected'))
    .map((o) => o.getAttribute('value'));
  assert.deepEqual(chosen, ['CA']);
  // Untouched fields keep exactly what the server sent.
  assert.equal(live.querySelector('#last_name').value, 'Lovelace');
  assert.equal(live.querySelector('#phone1').value, '(555) 010-2000');
  assert.deepEqual(events, ['guardian:input', 'state:change']);
});

test('save clicks the app\u2019s own Save link, and never claims success without one', () => {
  const form = readForm(editStudentDoc);
  const values = Object.fromEntries(form.fields.map((f) => [f.key, f.value]));

  assert.equal(changesFrom(form, values).length, 0);
  assert.deepEqual(saveInApp(load('edit-student.html'), []),
    { applied: [], submitted: false, reason: 'unchanged' });

  values.comments = 'Loves tap and jazz';
  const changes = changesFrom(form, values);
  assert.equal(changes.length, 1);

  const live = load('edit-student.html');
  let clicked = 0;
  live.querySelector('#save').addEventListener('click', () => { clicked += 1; });

  const result = saveInApp(live, changes);
  assert.equal(clicked, 1);
  assert.equal(result.submitted, true);
  assert.deepEqual(result.applied, ['comments']);
  assert.equal(live.querySelector('#comments').value, 'Loves tap and jazz');
  // The app's hidden submit ids are never touched by the editor.
  assert.equal(live.querySelector('#idMeth').value, '');

  live.querySelector('#save').remove();
  assert.equal(saveInApp(live, changes).reason, 'no-save-link');
});

test('the sign-in page is recognised and never replaced', () => {
  assert.equal(isLoginPage(loginDoc), true);
  assert.equal(isLoginPage(calendarDoc), false);
  assert.equal(hasShell(calendarDoc), true);
  assert.equal(hasShell(loginDoc), false);
});
