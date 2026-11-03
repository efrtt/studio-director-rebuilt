/*
 * A due balance in a table cell.
 *
 * The app prints it inside the family cell, as its own red span holding a hidden
 * tooltip and a `$`:
 *
 *   <td><a href="admin.sd?page=EditFamily&fident=4401">Lovelace
 *     <span class="boldRed"><span class="Tooltip">Balance due: $120.00</span>$</span></a></td>
 *
 * Reading the cell's text read the tooltip too, so the name arrived with the
 * amount glued on and the pill never found it. These tests hold the split: the
 * name keeps the cell, the figure comes out as `cell.due`, and a cell with no
 * marker is untouched.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

globalThis.DOMParser = DOMParser;

const { parseHtml } = await import('../src/lib/shell.js');
const { readTable } = await import('../src/model/table.js');

const tableOf = (rows) => parseHtml(
  '<table id="enrollmenttable" class="SimpleSD"><tbody>'
  + '<tr><th>First Name</th><th>Last Name</th><th>Family</th><th class="AR">Actions</th></tr>'
  + rows
  + '</tbody></table>'
).querySelector('table');

const family = (name, money) => `<td><a href="admin.sd?page=EditFamily&amp;fident=4401">${name}`
  + (money ? ` <span class="boldRed"><span class="Tooltip">Balance due: ${money}</span>$</span>` : '')
  + '</a></td>';

test('the balance comes out of the cell’s words', () => {
  const table = tableOf(`<tr><td>Ada</td><td>Lovelace</td>${family('Lovelace', '$120.00')}<td class="action-cell"><a href="admin.sd?page=Unenroll&amp;sident=1">Edit</a></td></tr>`);
  const [row] = readTable(table).rows;
  assert.equal(row[2].text, 'Lovelace');
  assert.equal(row[2].due, '$120.00');
  assert.equal(row[2].href, 'admin.sd?page=EditFamily&fident=4401');
});

test('a four-figure balance keeps its commas', () => {
  const table = tableOf(`<tr><td>Ada</td><td>Lovelace</td>${family('Lovelace', '$1,204.50')}<td class="action-cell"><a href="admin.sd?page=Unenroll&amp;sident=1">Edit</a></td></tr>`);
  assert.equal(readTable(table).rows[0][2].due, '$1,204.50');
});

test('a balance with no name beside it stays text', () => {
  // The student's Family tab files the figure under its own heading and puts
  // nothing else in the cell — the live page looks like this, verified against
  // EditStudent&sident=…&searchidx=2975. A lone pill there is not a warning
  // about a name; the amount is the whole answer.
  const table = parseHtml('<table><tbody>'
    + '<tr><th>Detail</th><th>Value</th></tr>'
    + '<tr><td>Balance Due</td><td><span class="boldRed"><span class="Tooltip">Balance due: $1,205.00</span>$</span></td></tr>'
    + '</tbody></table>').querySelector('table');

  const cell = readTable(table).rows[0][1];
  assert.equal(cell.text, '$1,205.00');
  assert.equal(cell.due, undefined, 'no name, no pill');
});

test('a family that owes nothing is just a name', () => {
  const table = tableOf(`<tr><td>Ada</td><td>Lovelace</td>${family('Hopper')}<td class="action-cell"><a href="admin.sd?page=Unenroll&amp;sident=1">Edit</a></td></tr>`);
  const [, , cell] = readTable(table).rows[0];
  assert.equal(cell.text, 'Hopper');
  assert.equal(cell.due, undefined);
});

test('the action column keeps its tooltip label', () => {
  const table = tableOf('<tr><td>Ada</td><td>Lovelace</td>' + family('Lovelace', '$12.00')
    + '<td class="action-cell"><a href="admin.sd?page=Unenroll&amp;sident=1"><i class="fa-xmark"></i></a><span class="Tooltip">Drop</span></td></tr>');
  const cell = readTable(table).rows[0][3];
  assert.equal(cell.text, 'Drop');
  assert.equal(cell.action, true);
  assert.equal(cell.due, undefined);
});
