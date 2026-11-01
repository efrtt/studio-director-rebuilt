// Report screens.
//
// The crawl found ~90 of them and they are one shape: a `table.Form` of filters
// and one control that runs the report.
//
//   select#classes_season, select#classes_type, input#classes_day__2, …
//   <a id="runreport">Run Report</a>          (no href: the app's own JS)
//   <table class="ReportTable">…</table>      what comes back
//
// One adapter covers all of them because the filters are ordinary form rows —
// the same rows the record editor already knows how to read and write — and the
// run control is a single named element.
//
// Running is not reimplemented: the changed filters are written into the app's
// live controls and its own Run Report is clicked, exactly like Save. The app
// decides what request to make and what the result looks like.

import { qs, qsa, textOf } from './shell.js';
import { readForm } from './form.js';
import { diffFields, applyFields } from '../model/diff.js';
import { readTable } from '../model/table.js';

// The app's own label on every report page seen so far.
const RUN = /^(run|generate|create|show|view|update|apply)\s+(the\s+)?report$|^run$/i;

// Ids that mean "this is a report", so a settings form with an Apply button is
// not mistaken for one.
const TRIGGER_IDS = ['runreport'];

export function reportTrigger(root) {
  for (const id of TRIGGER_IDS) {
    const el = root.querySelector('#' + id);
    if (el) return el;
  }

  // Some run controls are drawn as `<div class="Btn" onclick=…>`: no href, not a
  // button element, so the tag list alone found none of them and the screen grew
  // a header with no Run button at all.
  for (const el of qsa(root, 'a, button, .Btn, .BtnOutln, [onclick], input[type="submit"], input[type="button"]')) {
    const label = (el.getAttribute && el.getAttribute('value')) || textOf(el)
      || (el.getAttribute && el.getAttribute('title')) || '';
    if (RUN.test(label.trim())) return el;
  }
  return null;
}

// A report's output is `table.ReportTable`; a page that has run already shows
// one with rows in it.
function readResults(doc) {
  const tables = [];
  for (const table of qsa(doc, 'table.ReportTable, .ReportTable table')) {
    const read = readTable(table);
    if (read.headings.length || read.rows.length) tables.push(read);
  }
  return {
    tables,
    rows: tables.reduce((n, t) => n + t.rows.length, 0)
  };
}

export function readReport(doc) {
  const root = qs(doc, '.contentContainer') || qs(doc, '#mainContent') || doc.body;
  if (!root) return null;

  const trigger = reportTrigger(doc);
  const results = readResults(doc);
  const heading = textOf(qs(doc, '.ReportName'));

  // No run control and no report heading means this is not a report screen: a
  // settings form must not grow a Run Report button it does not have.
  if (!trigger && !(heading && results.tables.length)) return null;

  const form = readForm(doc);

  return {
    kind: 'report',
    title: heading || textOf(qs(doc, '.formTitle')) || 'Report',
    breadcrumb: qsa(doc, '.Breadcrumb a').map(textOf).filter(Boolean),
    // The editor's own field reader: reports and record pages share the shape.
    rows: form ? form.rows : [],
    fields: form ? form.fields : [],
    // Kept whole so running can compare against what the server sent.
    form,
    trigger: trigger
      ? {
        id: trigger.id || '',
        label: (textOf(trigger) || trigger.getAttribute('value') || 'Run Report').trim(),
        // No href means the app's JS builds the request; that is expected here.
        js: !trigger.getAttribute('href') || trigger.getAttribute('href') === '#'
      }
      : null,
    results
  };
}

// Write the edited filters into the page and press the app's own Run Report.
// Unlike Save, an unchanged filter set is still a valid run: the whole point of
// these screens is to run them with their defaults.
export function runReportInApp(doc, report, values) {
  if (!report || !report.form) return { applied: [], submitted: false, reason: 'no-filters' };

  const changed = diffFields(report.form.fields, values);

  const { applied, missing } = applyFields(doc, changed);
  // A filter that could not be written must not run the report: the app would
  // build a request from values this screen does not show.
  if (missing.length) return { applied, missing, submitted: false, reason: 'missing' };

  const trigger = reportTrigger(doc);
  if (!trigger) return { applied, submitted: false, reason: 'no-trigger' };

  trigger.click();
  return { applied, submitted: true, reason: 'ok' };
}
