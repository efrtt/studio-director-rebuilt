// Form screens that are not records and not reports.
//
// The crawl found 47 of them: `EmailToGroupForm` (compose a message to a group),
// `EmailClasses` (select the classes to mail), `StatementForm` (print or email
// statements), `AddMultipleCharges` (a two-step wizard), the letter templates,
// the settings forms. They all have the same shape as a record editor — a
// `table.Form`/`table.FormEx` of labelled rows — but their submit control is not
// Save: it is `Compose Email`, `Select by Filter`, `Print letters`, `Next`.
//
// So this adapter reads the fields the same way the editor does, and offers the
// page's own controls instead of inventing a Save. Pressing one writes the
// edited fields into the live page and clicks the app's element, so the app
// builds the request, the validation and the result.
//
// A page with fields but no controls at all (ManageHolidays) is not a task: it
// yields nothing and stays with the app.

import { qs, qsa, textOf } from './shell.js';
import { readForm } from './form.js';
import { readActions, primaryAction, clickActionInApp } from './actions.js';
import { applyChanges } from './save.js';

function contentRoot(doc) {
  return qs(doc, '.contentContainer') || qs(doc, '#mainContent') || doc.body;
}

export function readTask(doc) {
  const root = contentRoot(doc);
  if (!root) return null;

  const form = readForm(doc);
  if (!form) return null;

  const actions = readActions(root);
  if (!actions.length) return null;

  const primary = primaryAction(actions);

  return {
    kind: 'task',
    title: textOf(qs(doc, '.formTitle')) || form.title || 'Form',
    breadcrumb: form.breadcrumb,
    rows: form.rows,
    fields: form.fields,
    // Kept whole so pressing an action can compare against what the server sent.
    form,
    actions,
    primary,
    // Links the page offers beside its buttons (a template download, a help
    // page). Shown, never pressed.
    links: qsa(root, 'a[href]')
      .filter((a) => !(a.closest && a.closest('table, ' + '#sideNavBar, .topBarContainer, .Breadcrumb')))
      .map((a) => ({ label: textOf(a), href: a.getAttribute('href') }))
      .filter((a) => a.label && a.href && a.href !== '#')
      .slice(0, 8)
  };
}

// Write the edited fields into the live page, then press the chosen control.
// An unchanged value is still fine here: "compose an email to this group" with
// the defaults is the whole point of the screen.
export function runTaskInApp(doc, task, values, action) {
  if (!task || !task.form) return { applied: [], submitted: false, reason: 'no-fields' };

  const changed = [];
  for (const field of task.form.fields) {
    const next = values[field.key];
    const same = field.type === 'checkbox'
      ? !!next === !!field.checked
      : String(next == null ? '' : next) === String(field.value == null ? '' : field.value);
    if (same) continue;
    changed.push(
      field.type === 'checkbox'
        ? { selector: field.selector, checked: !!next, key: field.key }
        : { selector: field.selector, value: String(next == null ? '' : next), key: field.key }
    );
  }

  const applied = applyChanges(doc, changed);

  // The caller passes the action that was pressed; without one, the page's own
  // primary control is used. Finding and pressing it is shared with the sheet
  // view, so an ambiguous label is refused in exactly one place.
  const target = action || task.primary;
  if (!target) return { applied, submitted: false, reason: 'no-action' };

  const pressed = clickActionInApp(doc, target);
  if (!pressed.submitted) return { applied, ...pressed, label: target.label };
  return { applied, submitted: true, reason: 'ok', label: target.label, via: pressed.via };
}
