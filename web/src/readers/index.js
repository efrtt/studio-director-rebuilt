// The reader registry: one ordered list, one dispatcher.
//
// This was a nine-term `confirm || week || list || …` expression in `page.js`.
// Every term had to know about every earlier term, so adding a reader meant
// editing the condition of all the ones after it, and getting one wrong silently
// changed what a screen became.
//
// The order below is that same order, written once, as data. `after` records the
// gate each reader had: the readers that must not have claimed the page. It is
// the ladder's behaviour, spelled out rather than repeated nine times.
//
// One quirk is deliberately preserved, because the goldens pin it: `list` is
// gated by `week` but **not** by `confirmation`. A confirmation page therefore
// carries both `confirm` and `list` — the sentence is the screen, the record
// panel beside it is what you carry on from. Gating the list on the confirmation
// would be tidier and would change 16 models.
//
// `claims` is a view of `read` rather than a second copy of each reader's
// thresholds. Repeating "does this page have a form and a control?" here would
// recreate the duplication this file exists to remove: two places to change, and
// the day they disagree is the day a settings page becomes a task.

import { titleOf, railLinks, isRecordPage } from '../lib/shell.js';
import { recordModel } from '../lib/editor.js';
import { readWeek } from '../lib/calendar.js';
import { readList } from '../lib/list.js';
import { readReport } from '../lib/report.js';
import { readIndex } from '../lib/index-page.js';
import { readTask } from '../lib/task.js';
import { readSheet } from '../lib/sheet.js';
import { readInsights } from '../lib/insights.js';
import { readTrends } from '../lib/trends.js';
import { readAttendance } from '../lib/attendance.js';
import { readSettings } from '../lib/settings.js';
import { confirmationOf } from '../lib/confirmation.js';
import { readNote } from '../lib/note.js';

// Most specific first, the smallest last.
const ORDER = [
  // The record editor. First because a record URL is the one thing the URL
  // itself names (`isRecordPage` is the app's own contract), and it is read with
  // `readForm` rather than through the chain: the class editor carries a hidden
  // Calendar tab with seven TimeBlock tables, which the week reader would claim.
  { id: 'editor', key: 'form', merge: 'page', after: [], read: (doc, ctx) => (isRecordPage(ctx.url) ? recordModel(doc, ctx.url) : null) },
  // A sentence is the screen; the list beside it is what you carry on from.
  { id: 'confirmation', key: 'confirm', after: ['editor'], title: (value) => value.title || (value.ok ? 'Saved' : 'Not saved'), read: (doc, ctx) => confirmationOf(doc, ctx.opts) },
  // table.TimeBlock, outside any tab panel.
  { id: 'week', key: 'week', after: ['editor', 'confirmation'], read: (doc) => readWeek(doc) },
  // #idSearchSpan .searchResultList. Gated by the week only — see the note above.
  { id: 'list', key: 'list', after: ['editor', 'week'], read: (doc, ctx) => readList(doc, { allowEmpty: !!ctx.allowEmpty }) },
  // A filter form plus a run control. Late, so NewClass keeps its list view.
  { id: 'report', key: 'report', after: ['editor', 'confirmation', 'week', 'list'], read: (doc) => readReport(doc) },
  // A form with a control that is not Run Report.
  { id: 'task', key: 'task', after: ['editor', 'confirmation', 'week', 'list', 'report'], read: (doc) => readTask(doc) },
  // The dashboard's Insights tab: stat cells and a donut, no records at all.
  { id: 'insights', key: 'insights', after: ['editor', 'confirmation', 'week', 'list', 'report', 'task'], read: (doc) => readInsights(doc) },
  // The dashboard's Trends tab: the app's own chart images in a layout table.
  { id: 'trends', key: 'trends', after: ['editor', 'confirmation', 'week', 'list', 'report', 'task', 'insights'], read: (doc) => readTrends(doc) },
  // A grid of controls is the app's own form, never a table of records: every
  // student on every date is a tick box with a reason and notes behind it.
  { id: 'attendance', key: 'attendance', after: ['editor', 'confirmation', 'week', 'list', 'report', 'task', 'insights', 'trends'], read: (doc) => readAttendance(doc) },
  // Tables with rows: dashboards, print sheets, list-ish settings.
  { id: 'sheet', key: 'sheet', after: ['editor', 'confirmation', 'week', 'list', 'report', 'task', 'insights', 'trends', 'attendance'], read: (doc) => readSheet(doc) },
  // Landing pages: what is left when there is nothing but links.
  { id: 'index', key: 'index', after: ['editor', 'confirmation', 'week', 'list', 'report', 'task', 'insights', 'trends', 'attendance', 'sheet'], read: (doc) => readIndex(doc) },
  // A control and a save. After index, because a menu is not a settings card.
  { id: 'settings', key: 'settings', after: ['editor', 'confirmation', 'week', 'list', 'report', 'task', 'insights', 'trends', 'attendance', 'sheet', 'index'], read: (doc) => readSettings(doc) },
  // Last of all, and the smallest: a sentence and the app's own button.
  { id: 'note', key: 'note', after: ['editor', 'confirmation', 'week', 'list', 'report', 'task', 'insights', 'trends', 'attendance', 'sheet', 'index', 'settings'], read: (doc) => readNote(doc) }
];

export const READERS = ORDER.map((reader) => ({
  ...reader,
  claims: (doc, ctx) => !!reader.read(doc, ctx)
}));

// The view a claimed reader produces. One reader is named differently from its
// model key: a confirmation's view is `confirm`.
const viewOf = (id) => (id === 'confirmation' ? 'confirm' : id);

// How a claim becomes part of the page model, declared per reader:
//
//   key   file it under the reader's own key alongside the others (a week, a
//         list, a settings card) — the default.
//   page  the claim *is* the page: its keys replace the model's, because an
//         editor is not a table beside a form but the form, the app's bar and
//         the record's tabs.
//
// A hard-coded `if (first.id === 'editor')` used to do this, which put a reader's
// name in the one function that must not know reader names. The reader now says
// how it merges.
const MERGE = {
  key: (model, reader, value) => {
    model[reader.key] = value;
  },
  page: (model, reader, value) => {
    Object.assign(model, value);
  }
};

// Titles come from the model, except for the two readers that have none of their
// own (a week and a list take the page's own title).
const TITLED = ['report', 'task', 'insights', 'trends', 'attendance', 'sheet', 'index', 'settings', 'note'];

export function readPage(doc, url, opts = {}) {
  const ctx = {
    url,
    isRecord: false,
    allowEmpty: !!opts.allowEmpty,
    allowRefused: !!opts.allowRefused,
    // Passed through untouched: the confirmation reader has always been handed
    // the caller's own options, and its refusals depend on them.
    opts
  };

  const claimed = new Map();
  for (const reader of ORDER) {
    if (reader.after.some((id) => claimed.has(id))) continue;
    const model = reader.read(doc, ctx);
    if (model) claimed.set(reader.id, model);
  }

  // Document order of the registry decides the view: the first claimed reader.
  const first = ORDER.find((reader) => claimed.has(reader.id)) || null;

  const model = {
    nav: railLinks(doc),
    week: null,
    list: null,
    report: null,
    task: null,
    insights: null,
    trends: null,
    attendance: null,
    sheet: null,
    index: null,
    settings: null,
    note: null,
    confirm: null,
    view: null,
    title: titleOf(doc),
    url
  };

  // Every claimed model is carried, not only the winning one — each filed the way
  // its own entry says. A page-merge claim is applied last, so it overwrites the
  // page's own keys rather than being overwritten by a later reader.
  for (const [id, value] of claimed) {
    const reader = ORDER.find((r) => r.id === id);
    if (reader.merge === 'page') continue;
    MERGE.key(model, reader, value);
  }

  if (first) {
    model.view = viewOf(first.id);
    const value = claimed.get(first.id);
    if (first.merge === 'page') MERGE.page(model, first, value);

    // The title is the reader's if it declares one, else the model's for the
    // readers that carry a title, else the page's own.
    model.title = first.title
      ? first.title(value)
      : TITLED.includes(first.id)
        ? value.title
        : titleOf(doc);
  }

  return model;
}
