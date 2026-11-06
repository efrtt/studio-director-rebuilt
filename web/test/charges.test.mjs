// The editable table: Manage Additional Class Charges.
//
// The page is the one shape no reader claimed: a table of records whose cells are
// the app's own controls, which makes the table a form to every other reader. The
// suite pins both halves — what the model says about the page, and that a change
// is written into the app's own fields rather than into a request of our own.

import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { readPage } from '../src/lib/page.js';
import { readCharges } from '../src/lib/chargeedit.js';
import { diffFields, applyFields } from '../src/model/diff.js';
import { saveInApp } from '../src/lib/save.js';

const URL = 'https://app.thestudiodirector.com/srvda/admin.sd';
const docOf = (html) => parseHTML(html).document;

function rowsHtml(count) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(`<tr>
        <td>Fall 2026-Spring 2027</td>
        <td><a href="admin.sd?page=EditClass&amp;cident=${100 + i}">${120 + i} Ballet</a></td>
        <td>*Ballet</td>
        <td>R. Ellis</td>
        <td>Studio 1</td>
        <td>Tuesday</td>
        <td>6:30 PM</td>
        <td class="AR"><input type="text" id="_addcontrol_amount${i}" name="_addcontrol_amount${i}" value="${12 + i}.00"></td>
        <td class="AR">
          <select id="_addcontrol_due_date${i}__mon" name="_addcontrol_due_date${i}__mon" style="vertical-align:middle"><option>Jan</option><option selected>Nov</option></select>
          <select id="_addcontrol_due_date${i}__day" name="_addcontrol_due_date${i}__day"><option>1</option><option selected>2</option></select>
          <select id="_addcontrol_due_date${i}__year" name="_addcontrol_due_date${i}__year"><option selected>2026</option><option>2027</option></select>
          <a class="calendarBtn"></a>
        </td>
        <td><select id="_addcontrol_category${i}" name="_addcontrol_category${i}"><option>Late Fee</option><option selected>Surcharge</option></select></td>
        <td><input type="text" id="_addcontrol_notes${i}" name="_addcontrol_notes${i}" value="Note ${i}"></td>
        <td class="AR"><a class="BtnX" href="admin.sd?page=ManageAddtlClassCharges&amp;meth=remove&amp;methargs=${i}%2C1">X</a>
          <input type="hidden" name="row" value="${i},1"></td>
      </tr>`);
  }
  return out.join('\n');
}

function pageHtml({ save = true, removeAll = true, rows = 2 } = {}) {
  return `<!doctype html><html><head><title>Manage Additional Class Charges</title></head><body>
  <form id="idForm" action="admin.sd" method="post">
    <div id="mainContent" class="mainContent wideContent"><div class="Content"><div class="contentInfo">
      <div class="ButtonBar">${save ? '<a id="save" onclick="StudioDir.onCallMethodSubmit(\'ManageAddtlClassCharges\',\'save\',\'\');">Save</a>' : ''}</div>
      <a href="admin.sd?page=ManageAddtlClassCharges&amp;meth=addNew">Add New Additional Class Charges</a>
      <table class="ReportTable"><tbody>
        <tr><th><div>Season</div></th><th><div>Class Name</div></th><th><div>Class Type</div></th><th><div>Instructor</div></th><th><div>Location</div></th><th><div>Day</div></th><th><div>Start Time</div></th><th class="AR"><div>Amount</div></th><th class="AR"><div>Due Date</div></th><th><div>Category</div></th><th><div>Notes</div></th><th class="AR"><div>Remove</div></th></tr>
        ${rowsHtml(rows)}
      </tbody></table>
      ${removeAll ? '<p><a href="admin.sd?page=ManageAddtlClassCharges&amp;meth=removeAll">Remove all existing Additional Class Charges</a></p>' : ''}
    </div></div></div>
  </form></body></html>`;
}

// ---- the model ---------------------------------------------------------------

{
  const model = readPage(docOf(pageHtml()), URL);
  assert.equal(model.view, 'charges', 'the editable table is its own view');
  assert.equal(model.title, 'Additional Class Charges');

  const charges = model.charges;
  assert.equal(charges.rows.length, 2, 'one row per class');

  // Eight columns, not the app's twelve: Season and Class Type ride under the
  // name and Location under the schedule.
  assert.deepEqual(
    charges.columns.map((column) => column.label),
    ['Class', 'Instructor', 'Schedule', 'Amount', 'Due Date', 'Category', 'Notes', '']
  );

  const first = charges.rows[0];
  const identity = first.cells[0];
  assert.equal(identity.kind, 'identity');
  assert.equal(identity.text, '120 Ballet');
  assert.equal(identity.href, 'admin.sd?page=EditClass&cident=100');
  assert.equal(identity.sub, '*Ballet · Fall 2026-Spring 2027', 'type first, then season');

  const schedule = first.cells.find((cell) => cell.kind === 'schedule');
  assert.equal(schedule.text, 'Tuesday · 6:30 PM');
  assert.equal(schedule.sub, 'Studio 1', 'the location rides on the schedule');

  // The four editable cells keep the app's own fields, by the app's own ids.
  assert.equal(first.cells.filter((cell) => cell.kind === 'fields').length, 4);
  const date = first.cells.find((cell) => cell.kind === 'fields'
    && cell.groups.some((group) => group.kind === 'date'));
  const parts = date.groups[0].fields;
  assert.deepEqual(parts.map((field) => field.part), ['mon', 'day', 'year']);
  assert.deepEqual(parts.map((field) => field.value), ['Nov', '2', '2026']);
  assert.equal(parts[0].selector, '#_addcontrol_due_date0__mon');

  const amount = charges.fields.find((field) => field.id === '_addcontrol_amount0');
  assert.equal(amount.value, '12.00');
  assert.equal(amount.type, 'text');
  const category = charges.fields.find((field) => field.id === '_addcontrol_category0');
  assert.equal(category.type, 'select');
  assert.equal(category.value, 'Surcharge');

  assert.equal(first.remove, 'admin.sd?page=ManageAddtlClassCharges&meth=remove&methargs=0%2C1');
  assert.equal(charges.actions.save.label, 'Save');
  assert.equal(charges.actions.add.href, 'admin.sd?page=ManageAddtlClassCharges&meth=addNew');
  assert.equal(charges.actions.removeAll.href, 'admin.sd?page=ManageAddtlClassCharges&meth=removeAll');
}

// A page of controls with nothing to keep or clear them is not this screen: the
// view would be a table nobody can save.
{
  assert.equal(readCharges(docOf(pageHtml({ save: false, removeAll: false })), URL), null);
}

// The register is typed into as well, and must keep its own view.
{
  const register = `<!doctype html><html><head><title>Attendance</title></head><body>
    <div id="mainContent"><table class="SimpleSD"><tr><th id="2026-11-02">Mon, Nov 2, 2026</th></tr>
    <tr><td>Student <input type="checkbox" id="x_2026-11-02_0" onclick="StudioDir.Attendance.onChange(this)" checked></td></tr></table>
    <textarea name="att_notes"></textarea><a id="save">Save</a></div></body></html>`;
  const model = readPage(docOf(register), URL);
  assert.notEqual(model.view, 'charges', 'a register stays a register');
}

// ---- the write ---------------------------------------------------------------

{
  const model = readCharges(docOf(pageHtml()), URL);
  const values = {};
  for (const field of model.fields) values[field.key] = field.value;

  // Two edits: an amount and the month of a due date.
  values._addcontrol_amount0 = '99.00';
  values._addcontrol_due_date0__mon = 'Jan';

  const changes = diffFields(model.fields, values);
  assert.equal(changes.length, 2, 'only what changed is written');
  assert.deepEqual(changes.map((change) => change.selector).sort(),
    ['#_addcontrol_amount0', '#_addcontrol_due_date0__mon']);

  // The live page is the page: the write lands in the app's own controls.
  const live = docOf(pageHtml());
  const { applied, missing } = applyFields(live, changes);
  assert.deepEqual(missing, [], 'every changed field was found on the page');
  assert.deepEqual(applied.sort(), ['_addcontrol_amount0', '_addcontrol_due_date0__mon']);
  assert.equal(live.getElementById('_addcontrol_amount0').value, '99.00');
  assert.equal(live.getElementById('_addcontrol_amount0').getAttribute('value'), '99.00');
  const mon = live.getElementById('_addcontrol_due_date0__mon');
  const chosen = Array.from(mon.children).filter((option) => option.hasAttribute('selected'));
  assert.equal(chosen.length, 1, 'one month stays chosen');
  assert.equal(chosen[0].textContent, 'Jan');

  // And Save is the page's own: pressing it is the whole submit.
  const result = saveInApp(live, changes);
  assert.equal(result.submitted, true);
  assert.equal(result.reason, 'ok');

  // Nothing changed is not a save.
  const same = saveInApp(live, []);
  assert.deepEqual(same, { applied: [], submitted: false, reason: 'unchanged' });
}

console.log('charges: ok');
