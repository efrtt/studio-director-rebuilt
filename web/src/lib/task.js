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
// A form with no control of any kind is not a task: it yields nothing and stays
// with the app. `ManageHolidays` used to be the example of that; live it carries
// an `a#save` in its ButtonBar and is read here, which is why the task view also
// prints the holiday list the page shows beside the form.

import { qs, qsa, textOf } from './shell.js';
import { readForm } from './form.js';
import { readActions, primaryAction, clickActionInApp } from './actions.js';
import { diffFields, applyFields } from '../model/diff.js';
import { contentRoot } from '../model/root.js';
import { CHROME } from '../model/appdom.js';

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
    // Whatever the page prints beside its form — `ManageHolidays` puts its list
    // of holidays on the right of the holiday form. Read by the form reader, so
    // the task view shows it too.
    tables: form.tables || [],
    // Kept whole so pressing an action can compare against what the server sent.
    form,
    actions,
    primary,
    // Links the page offers beside its buttons (a template download, a help
    // page). Shown, never pressed.
    links: qsa(root, 'a[href]')
      .filter((a) => !(a.closest && a.closest('table, ' + CHROME)))
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

  const changed = diffFields(task.form.fields, values);

  const { applied, missing } = applyFields(doc, changed);
  // The app would build its request from values this screen does not show, so a
  // field that could not be written refuses the press instead of guessing.
  if (missing.length) return { applied, missing, submitted: false, reason: 'missing' };

  // The caller passes the action that was pressed; without one, the page's own
  // primary control is used. Finding and pressing it is shared with the sheet
  // view, so an ambiguous label is refused in exactly one place.
  const target = action || task.primary;
  if (!target) return { applied, submitted: false, reason: 'no-action' };

  const pressed = clickActionInApp(doc, target);
  if (!pressed.submitted) return { applied, ...pressed, label: target.label };
  return { applied, submitted: true, reason: 'ok', label: target.label, via: pressed.via };
}
