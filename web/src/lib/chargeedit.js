// A page whose table you type into: Manage Additional Class Charges.
//
// This is the one shape the chain had no answer for. The app prints a single
// table of classes; four of its cells per row are its own controls
// (`_addcontrol_amount{n}`, `_addcontrol_due_date{n}__mon/day/year`,
// `_addcontrol_category{n}`, `_addcontrol_notes{n}`), every row ends in its own
// remove link, and the page carries Save, Add new and Remove all. Because the
// rows are typed into, `model/regions.js` classifies the table as a form rather
// than as records, the sheet reader refuses it, and the console said the truth:
// `no rebuilt view for this page - leaving the app alone`.
//
// Nothing here builds a write. Each control keeps the app's own id, which is
// both its key and its selector; the view hands back what changed, and the save
// writes those values into the live controls and presses the page's own Save —
// the same path the record editor uses (`lib/save.js`).
//
// The page's own twelve columns fold into the eight worth a column: Season and
// Class Type carry one value across every row and read as the class's context,
// Location rides under the schedule, and Day with Start Time is one schedule.
// Folding is driven by the page's own heading words, and a heading it does not
// recognise keeps its own column — the safe direction, because a column nobody
// folds is still a column you can read.

import { qs, qsa, textOf, titleOf, breadcrumbOf } from './shell.js';
import { pageSave } from './save.js';
import { contentRoot } from '../model/root.js';

// The app's own name for "a control this page will submit". The id is the same
// value as the name and is what makes a stable selector.
const CONTROL = 'input[id^="_addcontrol_"], select[id^="_addcontrol_"]';
// The app numbers the whole control, then names the part of a date after it:
// `_addcontrol_due_date0__mon`, `_addcontrol_amount0`, `_addcontrol_notes0`.
const NAME = /^_addcontrol_(amount|category|notes|due_date)(\d+)(__mon|__day|__year)?$/;

const FOLD = /^(season|class type)$/i;
const SCHEDULE = /^(day|start time)$/i;
// A studio name is a word or two on a line that already exists: it rides under
// the schedule rather than taking a column six words wide.
const LOCATION = /^location$/i;

const words = (el) => textOf(el).replace(/\s+/g, ' ').trim();

const optionValue = (option) => (option.getAttribute('value') != null
  ? option.getAttribute('value')
  : textOf(option));

function valueOf(el) {
  // A live select resolves its own default and that is the value the app will
  // submit. A parsed copy does not, so the selected (or first) option is read by
  // hand — the same reason `lib/attendance.js` reads a chosen option itself.
  if (el.tagName === 'SELECT') {
    const options = qsa(el, 'option');
    const chosen = options.find((option) => option.hasAttribute('selected')) || options[0];
    const fromOptions = chosen ? optionValue(chosen) : '';
    const live = typeof el.value === 'string' && el.value !== '' ? el.value : fromOptions;
    return String(live);
  }
  const attr = el.getAttribute('value');
  if (typeof el.value === 'string' && el.value !== '') return el.value;
  return attr != null ? String(attr) : '';
}

// One app control as a field this view can render and the save can write.
function fieldOf(el) {
  const id = el.getAttribute('id') || '';
  const named = NAME.exec(id);
  if (!named) return null;
  const kind = named[1];
  const part = named[3] ? named[3].replace('__', '') : '';
  const select = el.tagName === 'SELECT';
  return {
    key: id,
    // `diffFields`/`applyFields` write by selector, and the app's id is unique
    // on this page by construction: it is the row's own index.
    selector: '#' + id,
    id,
    // amount | category | notes | due
    kind: kind === 'due_date' ? 'due' : kind,
    // mon | day | year for a date, '' for everything else.
    part,
    type: select ? 'select' : 'text',
    value: valueOf(el),
    options: select
      ? qsa(el, 'option').map((option) => ({ value: optionValue(option), label: textOf(option) }))
      : null,
    width: kind === 'amount' ? 'sd-chargeamount' : kind === 'notes' ? 'sd-chargenotes' : ''
  };
}

// The controls of one cell, grouped: a date is one control made of three
// selects, and everything else stands alone.
function groupsOf(cell) {
  const groups = [];
  for (const el of qsa(cell, CONTROL)) {
    const field = fieldOf(el);
    if (!field) continue;
    const last = groups[groups.length - 1];
    if (field.part) {
      if (last && last.kind === 'date') last.fields.push(field);
      else groups.push({ kind: 'date', fields: [field] });
    } else {
      groups.push({ kind: 'field', field });
    }
  }
  return groups;
}

const linkIn = (cell) => (cell ? qs(cell, 'a[href]') : null);

function removeLinkIn(row) {
  return qsa(row, 'a[href]').find((anchor) => /[?&]meth=remove&/i.test(String(anchor.getAttribute('href') || '')));
}

function pageAction(doc, pattern) {
  const anchor = qsa(doc, 'a[href]').find((a) => pattern.test(String(a.getAttribute('href') || '')));
  return anchor ? { label: words(anchor) || '', href: anchor.getAttribute('href') } : null;
}

export function readCharges(doc) {
  const root = contentRoot(doc) || (doc && doc.body) || doc;
  if (!root || typeof root.querySelectorAll !== 'function') return null;

  // The editable table: a row carrying two or more of the app's own controls.
  const table = qsa(root, 'table').find((candidate) => qsa(candidate, 'tr')
    .some((tr) => qsa(tr, CONTROL).length >= 2));
  if (!table) return null;

  const trs = qsa(table, 'tr').filter((tr) => !tr.closest || tr.closest('table') === table);
  const headRow = trs.find((tr) => qs(tr, 'th')) || null;
  const headings = headRow
    ? Array.from(headRow.children).filter((cell) => cell.tagName === 'TH').map(words)
    : [];

  // A charge is a row of this table that carries the app's controls. A heading
  // row, a message row and a totals row are not charges.
  const bodyRows = trs.filter((tr) => tr !== headRow && qsa(tr, 'td').length && qsa(tr, CONTROL).length);

  const saveLink = pageSave(doc);
  const actions = {
    save: saveLink ? { label: words(saveLink) || 'Save' } : null,
    add: pageAction(doc, /[?&]meth=addNew\b/i),
    removeAll: pageAction(doc, /[?&]meth=removeAll\b/i)
  };

  // Controls but no way to keep or clear them is not this screen: rebuild what
  // can be saved, and leave the rest to the app.
  if (!bodyRows.length || !(actions.save || actions.removeAll)) return null;

  const first = qsa(bodyRows[0], 'td');

  // Which column names the row: the cell that links to the class, else the
  // column the page calls Class Name, else the first one.
  const classColumn = headings.findIndex((heading) => /^class name$/i.test(heading));
  const linkColumn = first.findIndex((cell) => linkIn(cell));
  const identityAt = linkColumn >= 0 ? linkColumn : classColumn >= 0 ? classColumn : 0;

  // What folds into the identity cell, type first: the design reads
  // "*Ballet · Fall 2026–Spring 2027", and both are the class's context.
  const folds = [];
  for (const re of [/^class type$/i, /^season$/i, FOLD]) {
    headings.forEach((heading, i) => {
      if (re.test(heading) && !folds.includes(i)) folds.push(i);
    });
  }

  const scheduleAt = headings
    .map((heading, i) => (SCHEDULE.test(heading) ? i : -1))
    .filter((i) => i >= 0);
  const dayAt = headings.findIndex((heading) => /^day$/i.test(heading));
  const startAt = headings.findIndex((heading) => /^start time$/i.test(heading));
  // The app's own order where it names both, else whatever the page prints.
  const scheduleSources = dayAt >= 0 && startAt >= 0 ? [dayAt, startAt] : scheduleAt;
  const locationAt = headings.findIndex((heading) => LOCATION.test(heading));

  // One column of the design per slot, each saying which page cell it came from.
  const plan = [];
  let scheduled = false;
  for (let i = 0; i < first.length; i += 1) {
    const heading = headings[i] || '';
    if (FOLD.test(heading)) continue;
    if (LOCATION.test(heading)) continue;
    if (i === identityAt) {
      plan.push({ kind: 'identity', label: 'Class', source: i });
      continue;
    }
    if (SCHEDULE.test(heading)) {
      if (!scheduled) {
        scheduled = true;
        plan.push({ kind: 'schedule', label: 'Schedule', source: i });
      }
      continue;
    }
    if (removeLinkIn(first[i])) {
      plan.push({ kind: 'remove', label: '', source: i });
      continue;
    }
    if (qsa(first[i], CONTROL).length) {
      plan.push({ kind: 'fields', label: heading, source: i });
      continue;
    }
    plan.push({ kind: 'text', label: heading, source: i });
  }

  const rows = [];
  const allFields = [];

  bodyRows.forEach((tr, index) => {
    const cells = qsa(tr, 'td');
    const out = [];
    for (const slot of plan) {
      const cell = cells[slot.source] || null;

      if (slot.kind === 'identity') {
        const anchor = linkIn(cell);
        out.push({
          kind: 'identity',
          text: cell ? words(anchor || cell) : '',
          href: anchor ? anchor.getAttribute('href') : '',
          sub: folds.map((i) => (cells[i] ? words(cells[i]) : '')).filter(Boolean).join(' · ')
        });
        continue;
      }

      if (slot.kind === 'schedule') {
        out.push({
          kind: 'schedule',
          text: scheduleSources.map((i) => (cells[i] ? words(cells[i]) : '')).filter(Boolean).join(' · '),
          sub: locationAt >= 0 && cells[locationAt] ? words(cells[locationAt]) : ''
        });
        continue;
      }

      if (slot.kind === 'remove') {
        const anchor = removeLinkIn(tr);
        out.push({
          kind: 'remove',
          href: anchor ? anchor.getAttribute('href') : '',
          label: anchor ? words(anchor) || 'Remove' : 'Remove'
        });
        continue;
      }

      if (slot.kind === 'fields') {
        const groups = cell ? groupsOf(cell) : [];
        for (const group of groups) {
          for (const field of group.fields || []) allFields.push(field);
          if (group.field) allFields.push(group.field);
        }
        out.push({ kind: 'fields', groups });
        continue;
      }

      out.push({ kind: 'text', text: cell ? words(cell) : '' });
    }

    rows.push({
      key: (allFields.length ? allFields[allFields.length - 1].id : '') || `row${index}`,
      cells: out,
      remove: (out.find((cell) => cell.kind === 'remove') || {}).href || '',
      // What the filter reads: the row's own words, its folded context, the
      // values in its boxes and the choices its selects offer.
      text: out.map((cell) => {
        if (cell.kind === 'fields') {
          return (cell.groups || []).map((group) => (group.fields
            ? group.fields.map((f) => `${f.value} ${(f.options || []).map((o) => o.label).join(' ')}`).join(' ')
            : `${group.field.value}`)).join(' ');
        }
        return `${cell.text || ''} ${cell.sub || ''}`;
      }).join(' ')
    });
  });

  if (!allFields.length) return null;

  return {
    kind: 'charges',
    title: titleOf(doc) || 'Additional Class Charges',
    breadcrumb: breadcrumbOf(doc),
    columns: plan,
    rows,
    fields: allFields,
    actions
  };
}
