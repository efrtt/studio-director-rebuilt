// Attendance: a grid of controls, read as a register rather than as a table.
//
// The page this works against is the live one (2026-11-04): one `table.SimpleSD`
// whose date cells each hold the app's own checkbox, the reason select and the
// studio-notes textarea it hides behind its `onChange`, and whose date headers
// carry the page's own Cancel Class control. Nothing here constructs a write:
// a tick clicks the app's checkbox, a reason is written into the app's select,
// and Save is the page's `#save`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

globalThis.DOMParser = DOMParser;

const {
  readAttendance, markAttendanceInApp, writeAbsenceInApp, writeNotesInApp, pressAttendanceSave
} = await import('../src/lib/attendance.js');
const { readSheet } = await import('../src/lib/sheet.js');
const { readPage } = await import('../src/readers/index.js');
const { clickActionInApp } = await import('../src/model/press.js');

const parseHtml = (html) => new DOMParser().parseFromString(html, 'text/html');

const cell = (sid, iso, { checked = true, reason = '', notes = '', mark = '' } = {}) => `
  <td>
    <input type="checkbox" id="${sid}_${iso}_0" onclick="StudioDir.Attendance.onChange(this);"${checked ? ' checked' : ''}>${mark ? `<sup>${mark}</sup>` : ''}
    <span style="display:none" id="${sid}_${iso}_0_reasoninfo">
      Reason:<br>
      <select name="${sid}_${iso}_0_reason">
        <option value="0"></option>
        <option value="1"${reason === 'Sick' ? ' selected' : ''}>Sick</option>
        <option value="2"${reason === 'Injury' ? ' selected' : ''}>Injury</option>
        <option value="3">Out of Town</option>
      </select><br>
      Studio notes:<br>
      <textarea rows="2" cols="20" name="${sid}_${iso}_0_notes">${notes}</textarea>
      <input type="hidden" name="${sid}_${iso}_0_absent" value="${checked ? '0' : '1'}">
    </span>
  </td>`;

const cancel = (iso, args) => `
  <div style="padding-top:4px">
    <input type="hidden" name="${args}" value="${iso.replace(/-/g, '_002d')}">
    <a href="#" onclick="StudioDir.onCallMethodSubmit('Attendance','cancelClass','${args}');;return false;">Cancel Class</a>
  </div>`;

const page = (opts = {}) => parseHtml(`<form id="idForm"><div class="contentContainer"><div class="Content">
  <div class="Breadcrumb">
    <a href="admin.sd?page=HomePage">Home</a>
    <a href="admin.sd?page=EditClass&amp;cident=1">818 Ballet</a>
  </div>
  <div class="formTitle">Attendance</div>
  <div class="contentInfo">
    <table class="SimpleSD">
      <tr class="freezetoprow">
        <th class="freezecolumn">First Name</th><th>Last Name</th>
        <th id="2026-11-02">Mon, Nov 2, 2026${cancel('2026-11-02', 'args1')}</th>
        <th id="2026-11-09">Mon, Nov 9, 2026${cancel('2026-11-09', 'args2')}</th>
      </tr>
      <tr>
        <td class="freezecolumn"><a href="admin.sd?page=EditStudent&amp;sident=11">Ada</a></td><td>Lovelace</td>
        ${cell(11, '2026-11-02', { mark: '1' })}
        ${cell(11, '2026-11-09', { mark: '9' })}
      </tr>
      <tr>
        <td class="freezecolumn"><a href="admin.sd?page=EditStudent&amp;sident=12">Grace</a></td><td>Hopper</td>
        ${cell(12, '2026-11-02', { mark: '2' })}
        ${cell(12, '2026-11-09', { checked: false, reason: 'Sick', notes: 'Home with a fever.' })}
      </tr>
      ${opts.extraRow || ''}
    </table>
    <table class="Layout"><tr><td class="Top">
      <p>The maximum class size for this class is 15.</p>
      <p><a href="#" onclick="StudioDir.onSubmitToMethod('Attendance', 'addMakeupWeeklySeries');;return false;">Schedule a make-up for this class</a></p>
      ${opts.hrefActions || ''}
      <p>1. <input type="hidden" name="args1" value="111"><a href="#" onclick="StudioDir.onCallMethodSubmit('Attendance','editStudentNotes','args1');;return false;">Make-up/Trial/Drop-in Student: Trial</a><br>
      2. <input type="hidden" name="args2" value="222"><a href="#" onclick="StudioDir.onCallMethodSubmit('Attendance','editStudentNotes','args2');;return false;">Make-up/Trial/Drop-in Student: Trial Class</a></p>
      <textarea name="att_notes" rows="6" cols="120">Bring water.</textarea>
    </td></tr></table>
    <a id="save" href="#" onclick="StudioDir.onSubmitToMethod('Attendance','save');">Save</a>
    <a href="#" onclick="StudioDir.onSubmitToMethod('Attendance', 'prev');;return false;">&lt;&lt; Prev</a>
    <a href="#" onclick="StudioDir.onSubmitToMethod('Attendance', 'next');;return false;">Next &gt;&gt;</a>
  </div>
</div></div></form>`);

test('a grid of the app’s own attendance controls is a register', () => {
  const read = readAttendance(page());
  assert.ok(read, 'the reader claims the page');
  assert.equal(read.title, 'Attendance');
  assert.equal(read.className, '818 Ballet');

  // One column per date, in the order the page prints them.
  assert.deepEqual(read.dates.map((d) => d.key), ['2026-11-02', '2026-11-09']);
  assert.equal(read.dates[0].label, 'Mon, Nov 2, 2026');
  // The date's own control, not a page-wide one.
  assert.equal(read.dates[0].cancel.label, 'Cancel Class');
  assert.match(read.dates[0].cancel.onclick, /cancelClass','args1'/);

  // One row per student, named the way the page names them.
  assert.deepEqual(read.students.map((s) => s.name), ['Ada Lovelace', 'Grace Hopper']);
  assert.equal(read.students[0].href, 'admin.sd?page=EditStudent&sident=11');

  // The tick is the app's own, so its id is what a write addresses.
  const first = read.students[0].cells['2026-11-02'];
  assert.equal(first.boxId, '11_2026-11-02_0');
  assert.equal(first.present, true);

  // An absence carries the reason the app saved, and its notes.
  const out = read.students[1].cells['2026-11-09'];
  assert.equal(out.present, false);
  assert.equal(out.reason.value, '1');
  assert.equal(out.reason.label, 'Sick');
  assert.equal(out.reason.name, '12_2026-11-09_0_reason');
  assert.equal(out.notes.value, 'Home with a fever.');
  assert.equal(out.notes.name, '12_2026-11-09_0_notes');
  // Every choice the app offers is kept, including the blank one it starts on.
  assert.deepEqual(out.options.map((o) => o.label), ['', 'Sick', 'Injury', 'Out of Town']);

  // The class's single notes field, its own controls, the page's Save.
  assert.deepEqual(read.notes, { name: 'att_notes', value: 'Bring water.' });
  assert.deepEqual(read.actions.map((a) => a.label), ['Schedule a make-up for this class']);
  assert.deepEqual(read.nav.map((a) => a.label), ['<< Prev', 'Next >>']);
  assert.equal(read.save.id, 'save');
  assert.match(read.save.onclick, /'Attendance','save'/);
});

test('the page’s own href links are controls too, not just its onclick ones', () => {
  // The live page (2026-11-06) puts these two in the notes cell as plain links
  // to the app's own pages, with no handler at all. They used to be dropped.
  const doc = page({
    hrefActions: `
      <a href="admin.sd?page=AddStudentMakeup&amp;cident=1&amp;sident=11">Schedule a make-up class for Ada</a>
      <p><a href="admin.sd?page=AddStudentDropIn&amp;sident=11">Add a trial/drop-in for Ada</a></p>
      <p><a href="#">A link with nowhere to go</a></p>`
  });
  const read = readAttendance(doc);
  const labels = read.actions.map((a) => a.label);

  assert.ok(labels.includes('Schedule a make-up class for Ada'), 'the make-up link is a control');
  assert.ok(labels.includes('Add a trial/drop-in for Ada'), 'so is the drop-in link');
  assert.equal(labels.includes('A link with nowhere to go'), false, 'a bare # goes nowhere');

  // The destination is the app's own, carried so the view can link to it.
  const makeup = read.actions.find((a) => a.label === 'Schedule a make-up class for Ada');
  assert.equal(makeup.href, 'admin.sd?page=AddStudentMakeup&cident=1&sident=11');
  assert.equal(makeup.onclick, '');

  // The onclick control is still read as a press, and keeps the handler that
  // names it.
  const weekly = read.actions.find((a) => a.label === 'Schedule a make-up for this class');
  assert.equal(weekly.href, '#');
  assert.match(weekly.onclick, /addMakeupWeeklySeries/);
});

// The live page (2026-11-06) for a class whose dates all fall outside the view:
// the register prints its two name columns and nothing else, while the class's
// own links and its notes sit beside it. That is still the attendance page, and
// the reader has to claim it before the ladder turns it into a form.
const emptyRegister = () => parseHtml(`<form id="idForm"><div class="contentContainer"><div class="Content">
  <div class="Breadcrumb">
    <a href="admin.sd?page=HomePage">Home</a>
    <a href="admin.sd?page=EditClass&amp;cident=1">818 Ballet</a>
  </div>
  <div class="formTitle">Attendance</div>
  <div class="contentInfo">
    <table class="SimpleSD"><tr class="freezetoprow"><th class="freezecolumn">First Name</th><th>Last Name</th></tr></table>
    <table class="Layout"><tr><td class="Top">
      <a href="admin.sd?page=AddStudentMakeup&amp;cident=1&amp;sident=11">Schedule a make-up class for Ada</a>
      <p><a href="admin.sd?page=AddStudentDropIn&amp;sident=11">Add a trial/drop-in for Ada</a></p>
      <p><a href="#" onclick="StudioDir.onCallMethodSubmit('Attendance','enterTimesheet','');;return false;">Enter instructor timesheet info / substitute teachers for this class</a></p>
      <div class="MultiTable">Attendance Notes</div>
      <textarea name="att_notes" rows="6" cols="120"></textarea>
    </td></tr></table>
    <a id="save" href="#" onclick="StudioDir.onSubmitToMethod('Attendance','save');">Save</a>
    <a href="#" onclick="StudioDir.onSubmitToMethod('Attendance', 'prev');;return false;">&lt;&lt; Prev</a>
    <a href="#" onclick="StudioDir.onSubmitToMethod('Attendance', 'next');;return false;">Next &gt;&gt;</a>
  </div>
</div></div></form>`);

test('a register with no dates is still the attendance page, links and all', () => {
  const read = readAttendance(emptyRegister());
  assert.ok(read, 'the notes field is what names the page');
  assert.equal(read.title, 'Attendance');

  // No columns, so no register rows — but the page is still here.
  assert.deepEqual(read.dates, []);
  assert.deepEqual(read.students, []);
  assert.deepEqual(read.notes, { name: 'att_notes', value: '' });

  // The class's own controls, in the page's order: two links and one handler.
  assert.deepEqual(read.actions.map((a) => a.label), [
    'Schedule a make-up class for Ada',
    'Add a trial/drop-in for Ada',
    'Enter instructor timesheet info / substitute teachers for this class'
  ]);
  assert.equal(read.actions[0].href, 'admin.sd?page=AddStudentMakeup&cident=1&sident=11');
  assert.equal(read.actions[1].href, 'admin.sd?page=AddStudentDropIn&sident=11');
  assert.match(read.actions[2].onclick, /enterTimesheet/);
  assert.deepEqual(read.nav.map((a) => a.label), ['<< Prev', 'Next >>']);
  assert.equal(read.save.id, 'save');
});

test('the ladder reads that shape as attendance, not as a form with one field', () => {
  const model = readPage(emptyRegister(), 'https://app.thestudiodirector.com/studio1/admin.sd?page=Attendance');
  assert.equal(model.view, 'attendance', 'the app’s own attendance field names the screen');
  assert.ok(model.attendance, 'and carries its links and notes');
  assert.equal(model.attendance.actions.length, 3);
  assert.equal(model.task, null, 'the form reader does not take it as a task');
});

test('a make-up, drop-in or trial registration is named by the page’s own key', () => {
  const read = readAttendance(page());

  // The cell's superscript, named by the page's numbered key.
  assert.deepEqual(read.students[0].cells['2026-11-02'].mark, {
    n: '1',
    label: 'Trial',
    title: 'Make-up/Trial/Drop-in Student: Trial'
  });
  assert.equal(read.students[1].cells['2026-11-02'].mark.label, 'Trial Class');

  // A number with no line in the key still says a registration is there; the
  // number is what the page printed, so it is what is shown.
  assert.deepEqual(read.students[0].cells['2026-11-09'].mark, { n: '9', label: '', title: '' });

  // An ordinary registration is not one, and an absent student keeps the mark
  // their cell carries without one.
  assert.equal(read.students[1].cells['2026-11-09'].mark, null);

  // The key's own lines are not controls of this screen.
  assert.deepEqual(read.actions.map((a) => a.label), ['Schedule a make-up for this class']);
});

test('the register is not a sheet, and the sheet reader keeps refusing it', () => {
  assert.equal(readSheet(page()), null, 'a grid of controls stays the app’s own');
  const model = readPage(page(), 'https://app.thestudiodirector.com/studio1/admin.sd?page=Attendance');
  assert.equal(model.view, 'attendance', 'the ladder claims it before the sheet does');
  assert.ok(model.attendance, 'and carries the register');
});

test('a printed roster of tick boxes is still a table, not a register', () => {
  const roster = parseHtml(`<div class="contentContainer"><div class="Content">
    <table class="AttendanceRoster">
      <tr><th>First Name</th><th>Last Name</th><th>Mon, Nov 2</th></tr>
      <tr><td>Ada</td><td>Lovelace</td><td><input type="checkbox" checked></td></tr>
      <tr><td>Grace</td><td>Hopper</td><td><input type="checkbox" checked></td></tr>
    </table></div></div>`);
  assert.equal(readAttendance(roster), null, 'no onChange, no register');
  assert.ok(readSheet(roster), 'and the sheet still reads it');
});

test('a family’s own note on an absence is read as text, and never written', () => {
  // Measured live (2026-11-06): when the family marks the absence themselves the
  // app prints their note after the studio's, as a `disabled` textarea named
  // `…_family`. There is no write to offer, so the reader keeps it as text.
  const markup = page().documentElement.innerHTML.replace(
    '<input type="hidden" name="12_2026-11-09_0_absent"',
    '<br>Family notes: <textarea rows="2" cols="20" name="12_2026-11-09_0_family" disabled>Practice ran late.</textarea>'
      + '<input type="hidden" name="12_2026-11-09_0_absent"'
  );
  const doc = parseHtml(markup);
  const read = readAttendance(doc);
  const out = read.students[1].cells['2026-11-09'];

  assert.deepEqual(out.family, { name: '12_2026-11-09_0_family', value: 'Practice ran late.' });
  // The studio's own notes are still the studio's, and still the first textarea.
  assert.equal(out.notes.value, 'Home with a fever.');
  assert.equal(read.students[0].cells['2026-11-02'].family, null, 'an ordinary absence has none');

  // Writing the reason and the studio notes leaves the family's words alone.
  assert.deepEqual(writeAbsenceInApp(doc, out, '2', 'Late call.'), { ok: true });
  assert.equal(doc.querySelector('[name="12_2026-11-09_0_family"]').textContent, 'Practice ran late.');
  assert.equal(doc.querySelector('[name="12_2026-11-09_0_family"]').hasAttribute('disabled'), true);
});

test('a tick presses the app’s own checkbox, so its onChange runs', () => {
  const doc = page();
  const box = doc.getElementById('11_2026-11-02_0');
  // A browser's click toggles the box; in this DOM the attribute is the state.
  let clicks = 0;
  box.click = function click() {
    clicks += 1;
    if (this.hasAttribute('checked')) this.removeAttribute('checked');
    else this.setAttribute('checked', '');
  };

  // Already present: nothing to do, and the app is not disturbed.
  assert.deepEqual(markAttendanceInApp(doc, '11_2026-11-02_0', true), { ok: true, unchanged: true });
  assert.equal(clicks, 0);

  // Marking absent is a press, never an assignment: the app's handler is what
  // reveals the reason and sets the hidden `_absent`.
  assert.deepEqual(markAttendanceInApp(doc, '11_2026-11-02_0', false), { ok: true });
  assert.equal(clicks, 1);
  assert.equal(box.hasAttribute('checked'), false);

  // A tick box that is not on the page says so instead of claiming a change.
  assert.equal(markAttendanceInApp(doc, 'nope', false).ok, false);
});

test('the reason and the notes are written where the app keeps them', () => {
  const doc = page();
  const read = readAttendance(doc);
  const out = read.students[1].cells['2026-11-09'];

  // Read back the way a parsed copy stores a choice: the selected option.
  const selected = (name) => {
    const select = doc.querySelector(`[name="${name}"]`);
    const chosen = [...select.querySelectorAll('option')].find((option) => option.hasAttribute('selected'));
    return chosen ? chosen.getAttribute('value') : null;
  };

  assert.deepEqual(writeAbsenceInApp(doc, out, '2', 'Late call.'), { ok: true });
  assert.equal(selected('12_2026-11-09_0_reason'), '2');
  assert.equal(doc.querySelector('[name="12_2026-11-09_0_notes"]').textContent, 'Late call.');

  // A reason the app does not offer is refused rather than invented.
  assert.equal(writeAbsenceInApp(doc, out, '999', '').ok, false);
  assert.equal(selected('12_2026-11-09_0_reason'), '2');

  assert.deepEqual(writeNotesInApp(doc, read.notes, 'Bring water and a mat.'), { ok: true });
  assert.equal(doc.querySelector('[name="att_notes"]').textContent, 'Bring water and a mat.');
});

test('Save is the page’s own Save', () => {
  const doc = page();
  const save = doc.getElementById('save');
  let clicked = 0;
  save.click = () => { clicked += 1; };
  assert.deepEqual(pressAttendanceSave(doc), { submitted: true });
  assert.equal(clicked, 1);
  assert.equal(pressAttendanceSave({ getElementById: () => null }).submitted, false);
});

test('a control is pressed by the app’s own handler when its words repeat', () => {
  // Every date's Cancel Class reads the same; the handler is what tells them
  // apart, so the date you pressed is the date that is asked for.
  const doc = page();
  const anchors = [...doc.querySelectorAll('a[onclick*="cancelClass"]')];
  assert.equal(anchors.length, 2);
  const pressed = [];
  for (const anchor of anchors) anchor.click = () => pressed.push(anchor.getAttribute('onclick'));

  const read = readAttendance(doc);
  const result = clickActionInApp(doc, read.dates[1].cancel);
  assert.equal(result.submitted, true);
  assert.equal(result.via, 'onclick');
  assert.deepEqual(pressed, [read.dates[1].cancel.onclick]);
});
