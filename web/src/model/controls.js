// One control discovery, for every form-shaped reader.
//
// Two readers grew their own walk over this: the record editor's row reader and
// the settings card's flat pass over the page. They asked the same questions —
// is this control a field at all, what does it hold, what address does the live
// page answer to, what is it called — and answered them in two places, which is
// how the settings card came to trust an id the editor had learned not to.
//
// So there is one walk here, and the readers differ only in the container they
// hand it:
//
//   the record editor  a row's value cell      `table.Form`/`FormEx` rows
//   the settings card  the page's content root  div groups and unclassed tables
//
// The container is what the page shapes force. A settings page prints its
// controls in plain divs and in bare `<table>` rows with no class at all (the
// calendar-filters page: `SetTimeBlockCalendarFilters`), so it has no row
// container to offer; and an editor may not walk bare tables, because a list
// page's rows would arrive as fields. The walk, the address and the value are
// shared; the container is chosen where the page shape is known.
//
// Radios and same-named checkboxes are *grouped* by each reader rather than
// here, and that is the one place the two models genuinely differ: an editor's
// radio pair is one field of one row, while a toggle page's radio pair is one
// setting whose label is the block around the choices, and its weekday boxes
// (`DAYS`, one box per bit) are one field of seven. Grouping is a question about
// the screen, not about a control.

import { qsa } from '../lib/shell.js';
import { selectorOf, notAField, valueOfControl, weekdayOf } from './fields.js';

export const CONTROLS = 'input, select, textarea';

// The canonical field for a control: its address, its key, and what it holds.
//
// `type` is the control's own reading and includes `multiselect`, because that is
// what the control is. A reader whose view cannot draw a set adapts it itself —
// the editor's row prints one select bound to one value, and does that mapping
// where its fields are built (`lib/form.js`), not here.
export function controlOf(el, doc) {
  if (notAField(el)) return null;

  const selector = selectorOf(el, doc);
  if (!selector) return null;

  const read = valueOfControl(el);
  // An empty select cannot be edited: the class page's date picker is filled in
  // by the app's own JS, so it is not offered as a field.
  if (!read) return null;

  const id = el.getAttribute('id');
  const name = el.getAttribute('name') || '';

  return {
    key: id || 'name:' + name,
    selector,
    id,
    name,
    type: read.type,
    // What the rebuilt editor prints for this control.
    label: weekdayOf(id),
    value: read.type === 'checkbox' ? null : read.value,
    checked: read.type === 'checkbox' ? read.value : null,
    options: read.options || null,
    // The app masks phone inputs with JS; it stays masked, we just carry the text.
    masked: /(^|\s)masked(\s|$)/.test(el.getAttribute('class') || '')
  };
}

// Walk a container and classify every control in it, in document order.
//
//   entries   controls that could be a field. `field` is null when this page
//             cannot address or read one (an id shared with another element, an
//             empty select) — the reader decides what that means for its screen,
//             and reports it as passed over rather than losing it.
//   ignored   the page's own plumbing (`hidden` ids, submit buttons, and whatever
//             a reader's own chrome rule adds), which is never a field.
export function controlsIn(container, doc, opts = {}) {
  const entries = [];
  const ignored = [];

  for (const el of qsa(container, CONTROLS)) {
    if (notAField(el) || (opts.skipClass && opts.skipClass.test(el.getAttribute('class') || ''))) {
      ignored.push(el);
      continue;
    }
    entries.push({ el, field: controlOf(el, doc) });
  }

  return { entries, ignored };
}
