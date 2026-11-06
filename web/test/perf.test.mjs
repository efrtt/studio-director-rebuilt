// The event page's Performance Info table: what it reads, and what it writes.
//
// The table is the one place in the app where a row's *position* is data, kept in
// a hidden input per row. Reading it wrong means writing the wrong order back, so
// the shapes below are the app's own: the drag div holding the number and the
// order input, the lock div beside the lock input, the song anchor, the row's X,
// and the blank spacer rows the app prints after the last performance.
//
// Filler only: no class, instructor or song name from a real studio.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

globalThis.DOMParser = DOMParser;
const { readPerf, applyOrder, pressLock } = await import('../src/lib/perf.js');
const { parseHtml } = await import('../src/lib/shell.js');

function row(ident, order, lock, extra = {}) {
  return `
    <tr>
      <td class="AR"><div class="dragable"><div>${order}</div>
        <input type="hidden" name="perf${ident}" value="${order}"></div></td>
      <td><div class="link" onclick="StudioDir.ManageEvents.lock(this)">
        <img src="images/${lock ? 'lock' : 'unlock'}.gif"></div>
        <input type="hidden" name="lock${ident}" value="${lock ? 1 : 0}"></td>
      <td><a href="admin.sd?page=ClassPerformance&amp;meth=edit&amp;cident=${ident}&amp;perf_ident=${ident}">${extra.song || 'Song ' + ident}</a></td>
      <td>Class ${ident}</td>
      <td>Teacher ${ident}</td>
      <td>${extra.day || 'Monday'}</td>
      <td>${extra.start || '5:30 PM'}</td>
      <td>${extra.length || '0 min 0 sec'}</td>
      <td>${extra.notes || ''}</td>
      <td class="AR"><a class="BtnX" href="admin.sd?page=ClassPerformance&amp;meth=del&amp;cident=${ident}&amp;perf_ident=${ident}">X</a></td>
    </tr>`;
}

function page(rows = row(901, 1, 0) + row(902, 2, 1)) {
  return parseHtml(`
    <html><body>
      <div class="ReportTable">Performance Info</div>
      <table id="PerfTable" class="ReportTable">
        <thead><tr>
          <th class="AR">Order</th><th>Locked</th><th>Performance Song</th>
          <th>Class Name</th><th>Instructor</th><th>Day</th><th>Start Time</th>
          <th>Performance Length</th><th>Performance Notes</th><th class="AR"></th>
        </tr></thead>
        <tbody>${rows}
          <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
          <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
        </tbody>
      </table>
      <div style="padding-top:8px">
        <a class="Btn" href="admin.sd?page=ManageEvents&amp;meth=addPerf&amp;methargs=77">Add New Performance</a>
        <input type="hidden" name="args77" value="77">
        <a href="#" onclick="StudioDir.onCallMethodSubmit('ManageEvents','orderPerformances','args77');;return false;">Automatically Order Performances</a>
        <a href="#" onclick="StudioDir.onCallMethodSubmit('ManageEvents','checkConflicts','');;return false;">Save and check for conflicts</a>
      </div>
    </body></html>`);
}

test('the table is read row by row, spacers and all', () => {
  const perf = readPerf(page());
  assert.equal(perf.title, 'Performance Info');
  assert.equal(perf.rows.length, 2, 'the two blank spacer rows are not performances');
  assert.deepEqual(perf.rows.map((r) => r.key), ['901', '902']);
  assert.deepEqual(perf.rows.map((r) => r.order), [1, 2]);
  assert.deepEqual(perf.rows.map((r) => r.locked), [false, true]);
});

test('a row keeps its columns, its song and its own two inputs', () => {
  const [first] = readPerf(page()).rows;
  assert.equal(first.className, 'Class 901');
  assert.equal(first.instructor, 'Teacher 901');
  assert.equal(first.day, 'Monday');
  assert.equal(first.start, '5:30 PM');
  assert.equal(first.length, '0 min 0 sec');
  assert.equal(first.song.label, 'Song 901');
  assert.match(first.song.href, /meth=edit&cident=901/);
  assert.match(first.deleteHref, /meth=del&cident=901/);
  assert.equal(first.orderSelector, 'input[name="perf901"]');
  assert.equal(first.lockSelector, 'input[name="lock901"]');
});

test('the three controls are the page’s own, addressed by their handler', () => {
  const { actions } = readPerf(page());
  assert.match(actions.add.href, /meth=addPerf&methargs=77/);
  assert.equal(actions.add.js, false, 'adding a performance is navigation');
  assert.equal(actions.autoOrder.js, true);
  assert.match(actions.autoOrder.onclick, /orderPerformances/);
  assert.match(actions.checkConflicts.onclick, /checkConflicts/);
  assert.equal(actions.autoOrder.exact, true);
});

test('a page without the table has no performance model at all', () => {
  assert.equal(readPerf(parseHtml('<html><body><p>Nothing here.</p></body></html>')), null);
});

test('saving writes only the rows that moved, numbered from one', () => {
  const doc = page();
  const perf = readPerf(doc);
  const swapped = [perf.rows[1], perf.rows[0]];
  const { applied, missing } = applyOrder(doc, swapped);

  assert.deepEqual(missing, []);
  // In the order the rows now run: the second row is written first.
  assert.deepEqual(applied, ['902', '901'], 'both numbers changed');
  assert.equal(doc.querySelector('input[name="perf901"]').value, '2');
  assert.equal(doc.querySelector('input[name="perf902"]').value, '1');
});

test('an unchanged arrangement writes nothing', () => {
  const doc = page();
  const perf = readPerf(doc);
  const { applied } = applyOrder(doc, perf.rows);
  assert.deepEqual(applied, []);
  assert.equal(doc.querySelector('input[name="perf901"]').value, '1');
});

test('a missing order input refuses the save instead of half-writing', () => {
  const doc = page();
  const perf = readPerf(doc);
  // The app re-rendered and this row's input is gone.
  doc.querySelector('input[name="perf902"]').remove();
  const { applied, missing } = applyOrder(doc, [perf.rows[1], perf.rows[0]]);
  assert.deepEqual(missing, ['902']);
  assert.deepEqual(applied, ['901'], 'what it could write, it wrote');
});

test('the lock is flipped with the app’s own control in that row', () => {
  const doc = page();
  const perf = readPerf(doc);
  const cells = doc.querySelectorAll('#PerfTable tbody tr');
  let clicked = 0;
  cells[1].querySelector('div.link').addEventListener('click', () => {
    clicked += 1;
    // What the app's own handler does: set the hidden value and swap the icon.
    doc.querySelector('input[name="lock902"]').value = '0';
  });

  const result = pressLock(doc, perf.rows[1]);
  assert.equal(clicked, 1, 'the row’s own div.link was pressed, not another row’s');
  assert.equal(result.pressed, true);
  assert.equal(result.via, 'toggle');
  assert.equal(result.locked, false);
});

test('without the toggle the hidden value is written, and reported', () => {
  const doc = page();
  const perf = readPerf(doc);
  doc.querySelectorAll('#PerfTable tbody tr')[0].querySelector('div.link').remove();

  const result = pressLock(doc, perf.rows[0]);
  assert.equal(result.pressed, true);
  assert.equal(result.via, 'input');
  assert.equal(result.locked, true);
  assert.equal(doc.querySelector('input[name="lock901"]').value, '1');

  assert.deepEqual(pressLock(doc, { key: 'nope', lockSelector: 'input[name="locknope"]' }),
    { pressed: false, reason: 'missing', locked: false });
});
test('a heading row printed inside the body still names the columns', () => {
  // What the app actually sends: no <thead> at all, the headings are the first
  // row of <th> cells inside <tbody>. Reading only a thead left every column
  // empty here, on the one page where the columns are the point.
  const head = '<tr>'
    + ['Order', 'Locked', 'Performance Song', 'Class Name', 'Instructor', 'Day',
      'Start Time', 'Performance Length', 'Performance Notes', '']
      .map((h) => '<th class="AR"><div>' + h + '</div></th>').join('')
    + '</tr>';
  const doc = parseHtml(
    '<html><body>'
    + '<div class="ReportTable">Performance Info</div>'
    + '<table id="PerfTable" class="ReportTable"><tbody>'
    + head + row(901, 1, 0) + row(902, 2, 1)
    + '<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'
    + '</tbody></table>'
    + '<div><a class="Btn" href="admin.sd?page=ManageEvents&amp;meth=addPerf&amp;methargs=77">Add New Performance</a></div>'
    + '</body></html>'
  );

  const perf = readPerf(doc);
  assert.equal(perf.rows.length, 2, 'the heading row is not a performance');
  assert.equal(perf.rows[0].order, 1);
  assert.equal(perf.rows[0].className, 'Class 901');
  assert.equal(perf.rows[0].instructor, 'Teacher 901');
  assert.equal(perf.rows[0].start, '5:30 PM');
  assert.equal(perf.rows[1].length, '0 min 0 sec');
  assert.equal(perf.rows[0].song.label, 'Song 901');
  assert.match(perf.rows[0].song.href, /meth=edit&cident=901/);
  assert.match(perf.rows[0].deleteHref, /meth=del&cident=901/);
});
