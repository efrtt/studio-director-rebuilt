// The season (period) picker on the class calendar.
//
// Confirmed from the live CalendarPage: the control is a bare `<select>` inside
// `.contentInfo`, with no id, no name and no class:
//
//   <select onchange="window.location.href=StudioDir.getSelectValue(this)">
//     <option value="/srvda/admin.sd?page=CalendarPage&SEASON=Fall+2026-…"
//             selected>Fall 2026-Spring 2027 (8/3/26-6/10/27)</option>
//     …
//
// Every option's *value* is the URL of that season's calendar, so switching is a
// navigation the app already knows how to do. That is also what tells this
// control apart from the other selects on the site: a season picker's options are
// destinations, while a form's select (`#season` on a class editor, the week
// picker in a fixture) carries labels.
//
// This is deliberately not part of the model. The reader contract is
// `(doc, url) -> model`, and the goldens pin every model key; a control that only
// exists on the live page belongs with the handlers, beside `showAllTrigger`.

const URL_LIKE = /^(?:https?:\/\/|\/|admin\.sd|.*\/admin\.sd)/i;

function looksNavigable(value) {
  const v = String(value || '').trim();
  if (!v || v === '#') return false;
  return URL_LIKE.test(v) && /admin\.sd|\.sd\?|\?page=/i.test(v);
}

function labelFor(select) {
  const aria = select.getAttribute && select.getAttribute('aria-label');
  if (aria && aria.trim()) return aria.trim();

  // The app labels some selects with a table row ("Season"), and the calendar's
  // own sits unlabelled beside the week heading. Only a label in the same
  // container counts: a select on its own is simply "Season" on this screen.
  const row = select.closest && select.closest('tr');
  if (row) {
    const cell = row.querySelector('td, th');
    const text = cell ? (cell.textContent || '').trim() : '';
    if (text) return text;
  }
  return 'Season';
}

// The picker, or null when this page has none. null is the normal answer on every
// screen that is not the calendar, so nobody renders an empty control.
export function readPeriodControl(root) {
  if (!root || !root.querySelectorAll) return null;

  for (const select of root.querySelectorAll('select')) {
    const options = [...select.options].map((option) => ({
      label: (option.textContent || '').trim(),
      value: String(option.value || ''),
      selected: !!option.selected
    }));

    // A destination per option, and one of them current: this is a picker, not a
    // form field.
    if (options.length < 2) continue;
    if (!options.every((option) => looksNavigable(option.value))) continue;

    const chosen = options.find((option) => option.selected) || options[0];
    return {
      label: labelFor(select),
      options,
      value: chosen.value,
      current: chosen.label
    };
  }

  return null;
}

// Switch the app to another season, through the app's own control: the select is
// the thing that knows how to navigate, so its value is set and its `change`
// handed to the page's own handler.
export function choosePeriodInApp(root, value) {
  if (!root || !root.querySelectorAll) return { switched: false, reason: 'no-page' };

  for (const select of root.querySelectorAll('select')) {
    const match = [...select.options].some((option) => String(option.value || '') === String(value || ''));
    if (!match) continue;

    // Set the option, not the control: every DOM (and the app own script) agrees
    // on which option is selected, while a bare .value assignment is read-only in
    // some implementations.
    for (const option of select.options) {
      option.selected = String(option.value || "") === String(value || "");
    }
    const doc = select.ownerDocument;
    let event;
    try {
      event = new (select.ownerDocument.defaultView || globalThis).Event('change', { bubbles: true });
    } catch (e) {
      event = doc.createEvent('Event');
      event.initEvent('change', true, false);
    }
    select.dispatchEvent(event);
    return { switched: true, value };
  }

  return { switched: false, reason: 'no-option' };
}
