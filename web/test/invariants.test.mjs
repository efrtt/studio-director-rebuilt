// Fixture invariants: what a model must be true of, read from the capture itself.
//
// A golden says "same as last time". That is why it agreed with the two-date bug
// for as long as it did: a misread, once captured, is pinned, and regenerating the
// golden approves whatever the reader now says. These checks go the other way. They
// do not compare the reader to its own history — they read the capture directly and
// ask whether the model is *true of the page*:
//
//   - every field addresses a control that exists, and addresses exactly one (or a
//     whole radio group);
//   - the value it prints is the value that control holds in the capture;
//   - every row it prints exists as a labelled row of a form table, and the rows
//     account for exactly the fields;
//   - every control it reports as unread is real and named;
//   - the view it claims agrees with what the page marks itself as.
//
// A reader can be wrong about a page in ways no snapshot notices. This is where
// that shows up: it is the layer the edit-payment misread and the dropped second
// date would both have failed, without needing a new golden or a live session.
//
// What it deliberately does not do is re-derive the reader. It counts labelled rows,
// resolves selectors and reads control values — the plain facts — and never decides
// which table is "the editor" or how a page should be classified. If a page's model
// cannot satisfy these facts, the model is wrong; if it satisfies them, that is not
// proof it is complete, which is what `unread` and the live checks are for.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { DOMParser } from 'linkedom';

import { readPage } from '../src/lib/page.js';
import { readForm } from '../src/lib/form.js';
import { contentRoot, isHidden } from '../src/model/root.js';

const FIXTURES = new URL('./fixtures/', import.meta.url);
const files = fs.readdirSync(FIXTURES).filter((name) => name.endsWith('.html')).sort();

const doc = (name) => new DOMParser().parseFromString(fs.readFileSync(new URL(name, FIXTURES), 'utf8'), 'text/html');
// Routing is structural, so the URL is a label here rather than an input; it is the
// shape the golden tool uses, kept identical so the two layers read the same page.
const urlOf = (name) => 'https://example.test/admin.sd?page=' + name.replace(/\.html$/, '');

const NOT_A_FIELD = /^(hidden|file|submit|button|reset|image)$/i;
const CHROME = '#sideNavBar, #sd-root, .topBarContainer, .topBar, .Breadcrumb, .copyright,'
  + ' .List, #idSearchSpan, .searchResultList';

const typeOf = (el) => {
  const tag = el.tagName.toLowerCase();
  return tag === 'input' ? (el.getAttribute('type') || 'text').toLowerCase() : tag;
};

const isFieldControl = (el) => !(el.tagName === 'INPUT' && NOT_A_FIELD.test(typeOf(el)));

// The value the control holds, read from the capture by the DOM's own rules.
function valueInDom(el) {
  const tag = el.tagName.toLowerCase();
  if (tag === 'select') {
    const options = Array.from(el.querySelectorAll('option'));
    const chosen = options.find((o) => o.hasAttribute('selected')) || options[0];
    if (!chosen) return '';
    const value = chosen.getAttribute('value');
    return value != null ? value : (chosen.textContent || '').trim();
  }
  if (tag === 'textarea') return (el.textContent || '').replace(/\s+/g, ' ').trim();
  if (typeOf(el) === 'checkbox') return el.hasAttribute('checked');
  return el.getAttribute('value') || '';
}

// Every labelled row of every form table the page is showing: the plain count of
// what a person would read as a field. Deliberately not the reader's own logic —
// a label cell with words, a value cell with a control.
function labelledRows(d) {
  const rows = [];
  for (const table of d.querySelectorAll('table.Form, table.FormEx')) {
    if (isHidden(table)) continue;
    for (const tr of table.querySelectorAll('tr')) {
      // Only this table's own rows; a field can hold a nested table.
      if (tr.closest('table') !== table) continue;
      const cells = Array.from(tr.children || []).filter((c) => c.tagName === 'TD');
      if (cells.length < 2) continue;
      const label = (cells[0].textContent || '').replace(/\s+/g, ' ').trim();
      if (!label) continue;
      // A control the reader is right to refuse is not a row the model owes: an
      // empty select is filled in by the app's own script (the class editor's
      // `dates__select`), and `name="-"` is its placeholder helper input.
      const controls = Array.from(cells[1].querySelectorAll('input, select, textarea'))
        .filter(isFieldControl)
        .filter((el) => !(el.tagName === 'SELECT' && !el.querySelector('option')))
        .filter((el) => (el.getAttribute('name') || '') !== '-');
      if (!controls.length) continue;
      rows.push({ label, controls });
    }
  }
  return rows;
}

// The field lists a page model can carry, whatever view claimed it.
function fieldLists(model, form) {
  const lists = [];
  if (form) lists.push({ owner: 'form', list: form });
  if (model.task && model.task.fields) lists.push({ owner: 'task', list: model.task });
  if (model.report && model.report.fields) lists.push({ owner: 'report', list: model.report });
  if (model.settings && model.settings.fields) lists.push({ owner: 'settings', list: model.settings });
  return lists;
}

for (const file of files) {
  test('the model is true of ' + file, () => {
    const d = doc(file);
    const model = readPage(d, urlOf(file));
    const form = readForm(d);
    const root = contentRoot(d);

    for (const { owner, list } of fieldLists(model, form)) {
      const fields = list.fields;
      // A report that has already run can legitimately have no filters at all; a
      // page whose form tables hold controls and whose model holds none is the
      // shortfall this suite exists to catch.
      const ownsControls = Array.from(d.querySelectorAll('table.Form, table.FormEx'))
        .some((table) => table.querySelector('input, select, textarea'));
      assert.ok(fields.length || !ownsControls, owner + ': a page with form controls has fields');
      if (!fields.length) continue;

      // ---- what it addresses ----
      for (const field of fields) {
        assert.ok(field.selector, owner + ': every field has a selector');
        const nodes = Array.from(d.querySelectorAll(field.selector));
        assert.ok(nodes.length, owner + ': ' + field.selector + ' addresses a control on the page');

        if (field.type === 'radio' || field.type === 'checkboxes') {
          assert.equal(nodes.length, (field.options || []).length,
            owner + ': ' + field.selector + ' addresses the whole group');
        } else {
          assert.equal(nodes.length, 1,
            owner + ': ' + field.selector + ' addresses one control, not ' + nodes.length);
          assert.ok(nodes[0].closest && nodes[0].closest(CHROME) === null,
            owner + ': ' + field.selector + ' is not inside another reader\u2019s panel');
        }
      }

      const keys = fields.map((f) => f.key);
      assert.equal(new Set(keys).size, keys.length, owner + ': field keys are unique');

      // ---- what it prints ----
      for (const field of fields) {
        // A group's value is a set of keys or a chosen radio; its members are
        // checked below through the options the model carries.
        if (field.type === 'checkboxes') continue;
        const nodes = Array.from(d.querySelectorAll(field.selector));

        if (field.type === 'radio') {
          const chosen = nodes.find((n) => n.hasAttribute('checked'));
          assert.equal(String(field.value), chosen ? String(chosen.getAttribute('value') || '') : '',
            owner + ': ' + field.key + ' prints the radio that is checked');
          continue;
        }

        // A box carries `checked` in the editor and `value` on a settings card —
        // two readers describing the same thing — so either representation is
        // read, and both must agree with the capture.
        if (field.type === 'checkbox') {
          const shown = field.checked != null ? !!field.checked : !!field.value;
          assert.equal(shown, nodes[0].hasAttribute('checked'),
            owner + ': ' + field.key + ' prints whether the box is ticked');
          continue;
        }

        const el = nodes[0];
        const expected = valueInDom(el);
        assert.equal(String(field.value == null ? '' : field.value), String(expected),
          owner + ': ' + field.key + ' prints the value the control holds');
      }

      // ---- what it lays out ----
      if (list.rows) {
        const placed = list.rows.reduce((n, row) => n + row.fields.length, 0);
        assert.equal(placed, fields.length, owner + ': the rows account for every field');
        for (const row of list.rows) {
          assert.ok(row.label && row.label.trim(), owner + ': every row is labelled');
          assert.ok(row.fields.length, owner + ': every row has a field');
        }
      }

      // ---- what it says it left ----
      for (const unread of list.unread || []) {
        const selector = unread.id ? '#' + unread.id : (unread.name ? '[name="' + unread.name + '"]' : '');
        assert.ok(selector, owner + ': an unread control is named');
        assert.ok(d.querySelector(selector), owner + ': unread ' + selector + ' exists on the page');
      }
    }

    // ---- what it says the page is ----
    // The view is a claim about the page, and these are the page's own markers.
    if (model.view === 'form') {
      assert.ok(d.getElementById('save') || d.querySelector('.tabContainer'),
        'a form view is a page with a Save or a tab strip');
    }
    if (model.view === 'list') {
      assert.ok(d.querySelector('.searchResultList'),
        'a list view is a page with a record panel');
    }
    if (model.view === 'settings') {
      assert.ok(d.getElementById('save') || d.querySelector('a[href], button, .Btn'),
        'a settings view is a page with something to save it');
    }

    // An editor's rows are the labelled rows of the page it read. This is the
    // number the two-date bug got wrong: it printed one row where the capture has
    // two, and a golden could not see the difference.
    if (form && d.getElementById('save')) {
      const rows = labelledRows(d);
      assert.equal(form.rows.length, rows.length,
        'an editor prints one row per labelled row of its form tables');
      for (const row of rows) {
        assert.ok(form.rows.some((printed) => printed.label === row.label),
          'the editor prints the row "' + row.label + '" the capture has');
      }
    }

    // Whatever it did not print must be accounted for, or said out loud. On a page
    // that is an editor, a visible control inside its form tables is either a field
    // or one of the ones it reports.
    if (form && d.getElementById('save')) {
      const inForms = Array.from(d.querySelectorAll('table.Form, table.FormEx'))
        .filter((table) => !isHidden(table))
        .flatMap((table) => Array.from(table.querySelectorAll('input, select, textarea')))
        .filter((el) => isFieldControl(el) && !(el.closest && el.closest(CHROME)))
        .filter((el) => !(el.tagName === 'SELECT' && !el.querySelector('option')));
      const keys = new Set(form.fields.map((f) => f.key));
      const unread = new Set((form.unread || []).map((u) => u.id || u.name).filter(Boolean));
      for (const el of inForms) {
        const id = el.getAttribute('id') || '';
        const name = el.getAttribute('name') || '';
        // Two controls can be neither shown nor a shortfall: `name="-"` is the
        // app's placeholder helper input, and a control with no id and no name is
        // not submitted by the browser at all, so there is nothing to write and
        // nothing to owe.
        const known = name === '-' || (!id && !name)
          || (id && keys.has(id)) || (name && keys.has('name:' + name)) || (name && keys.has('radio:' + name))
          || (name && keys.has('checks:' + name))
          || (id && unread.has(id)) || (name && unread.has(name));
        assert.ok(known, 'a form control is either shown or reported: ' + (id || name || el.tagName.toLowerCase()));
      }
    }
  });
}

test('the fixture set is the one these invariants run over', () => {
  // A guard against the suite quietly testing nothing if the folder is renamed.
  assert.ok(files.length >= 20, 'fixtures were found (' + files.length + ')');
});
