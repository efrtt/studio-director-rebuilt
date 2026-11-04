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

const cell = (sid, iso, { checked = true, reason = '', notes = '' } = {}) => `
  <td>
    <input type="checkbox" id="${sid}_${iso}_0" onclick="StudioDir.Attendance.onChange(this);"${checked ? ' checked' : ''}>
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
        ${cell(11, '2026-11-02')}
        ${cell(11, '2026-11-09')}
      </tr>
      <tr>
        <td class="freezecolumn"><a href="admin.sd?page=EditStudent&amp;sident=12">Grace</a></td><td>Hopper</td>
        ${cell(12, '2026-11-02')}
        ${cell(12, '2026-11-09', { checked: false, reason: 'Sick', notes: 'Home with a fever.' })}
      </tr>
      ${opts.extraRow || ''}
    </table>
    <table class="Layout"><tr><td class="Top">
      <p>The maximum class size for this class is 15.</p>
      <p><a href="#" onclick="StudioDir.onSubmitToMethod('Attendance', 'addMakeupWeeklySeries');;return false;">Schedule a make-up for this class</a></p>
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
