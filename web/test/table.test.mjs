// The table parser, and the one cell shape that hid a control.
//
// The class enrollment tab prints each student's Drop control as an icon link
// with the word beside it:
//
//   <td class="action-cell"><span class="actionIcon">
//     <a href="admin.sd?page=Unenroll&sident=…&cident=…"><i class="fa-xmark"></i></a>
//     <span class="Tooltip">Drop</span>
//   </span></td>
//
// Reading the anchor's own text gave '', so the Actions column held a link with
// no label — the Drop button did not appear. Verified against the live page on
// 2026-11-01.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

import { readTable } from '../src/model/table.js';

const doc = (html) => new DOMParser().parseFromString(html, 'text/html');
const tableOf = (html) => doc(html).querySelector('table');

test('an icon link keeps the label that sits beside it', () => {
  const model = readTable(tableOf(`<table class="SimpleSD"><tbody>
    <tr><th>First Name</th><th class="AR">Actions</th></tr>
    <tr>
      <td>Sample</td>
      <td class="action-cell"><span class="actionIcon">
        <a href="admin.sd?page=Unenroll&amp;sident=9001&amp;cident=42"><i class="fa-solid fa-xmark fa-border"></i></a>
        <span class="Tooltip">Drop</span>
      </span></td>
    </tr>
  </tbody></table>`));

  assert.equal(model.headings.length, 2);
  assert.equal(model.rows[0][1].text, 'Drop', 'the icon link has no words of its own');
  assert.equal(model.rows[0][1].href, 'admin.sd?page=Unenroll&sident=9001&cident=42');
  assert.equal(model.rows[0][1].right, true, 'the Actions heading is right-aligned');
});

test('a link with words still reads as its own label, tooltip and all', () => {
  const model = readTable(tableOf(`<table><tbody>
    <tr><th>Student</th><th class="AR">Actions</th></tr>
    <tr>
      <td><a href="admin.sd?page=EditStudent&amp;sident=7">Sample Student</a><span class="Tooltip">Edit</span></td>
      <td class="action-cell"><span class="actionIcon">
        <a href="admin.sd?page=Unenroll&amp;sident=7"><i class="fa-solid fa-xmark"></i></a>
        <span class="Tooltip">Drop</span>
      </span></td>
    </tr>
  </tbody></table>`));

  assert.equal(model.rows[0][0].text, 'Sample Student', 'the tooltip is not echoed');
  assert.equal(model.rows[0][1].text, 'Drop');
});

test('a cell with no link is still its own text', () => {
  const model = readTable(tableOf(`<table><tbody>
    <tr><th>Age</th><th>Guardian</th></tr>
    <tr><td>9</td><td>Sample Guardian</td></tr>
  </tbody></table>`));

  assert.equal(model.rows[0][0].text, '9');
  assert.equal(model.rows[0][0].href, null);
});

test('two controls in one cell stay two controls', () => {
  // The class waitlist: Enroll and Drop sit side by side in the Actions cell.
  // Keeping only the first anchor merged them into one link whose words ran
  // together, and pressing it always went to Unenroll.
  const model = readTable(tableOf(`<table class="SimpleSD"><tbody>
    <tr><th>First Name</th><th class="AR">Actions</th></tr>
    <tr>
      <td>Sample</td>
      <td class="action-cell">
        <span class="actionIcon">
          <a href="admin.sd?page=Enroll&amp;cident=42&amp;sident=9001"><i class="fa-check"></i></a>
          <span class="Tooltip">Enroll</span>
        </span>
        <span class="actionIcon">
          <a href="admin.sd?page=Unenroll&amp;cident=42&amp;sident=9001"><i class="fa-xmark"></i></a>
          <span class="Tooltip">Drop</span>
        </span>
      </td>
    </tr>
  </tbody></table>`));

  const cell = model.rows[0][1];
  assert.equal(cell.actions.length, 2, 'both controls are kept');
  assert.deepEqual(cell.actions.map((a) => a.label), ['Enroll', 'Drop']);
  assert.match(cell.actions[0].href, /page=Enroll/);
  assert.match(cell.actions[1].href, /page=Unenroll/);
});

test('a single control stays a plain cell, so old models do not grow fields', () => {
  const model = readTable(tableOf(`<table><tbody>
    <tr><th>Name</th><th class="AR">Actions</th></tr>
    <tr><td>Sample</td><td class="action-cell"><span class="actionIcon"><a href="admin.sd?page=Unenroll&amp;sident=7"><i class="fa-xmark"></i></a><span class="Tooltip">Drop</span></span></td></tr>
  </tbody></table>`));

  assert.equal(model.rows[0][1].actions, undefined);
  assert.equal(model.rows[0][1].text, 'Drop');
});
