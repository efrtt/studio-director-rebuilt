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

import { titleOf, railLinks, pageName } from '../lib/shell.js';
import { readWeek } from '../lib/calendar.js';
import { readList } from '../lib/list.js';
import { readReport } from '../lib/report.js';
import { readIndex } from '../lib/index-page.js';
import { readTask } from '../lib/task.js';
import { readSheet } from '../lib/sheet.js';
import { readSettings } from '../lib/settings.js';
import { confirmationOf } from '../lib/confirmation.js';
import { readNote } from '../lib/note.js';

// Most specific first, the smallest last.
const ORDER = [
  // A sentence is the screen; the list beside it is what you carry on from.
  { id: 'confirmation', key: 'confirm', after: [], read: (doc, ctx) => confirmationOf(doc, ctx.opts) },
  // table.TimeBlock, outside any tab panel.
  { id: 'week', key: 'week', after: ['confirmation'], read: (doc) => readWeek(doc) },
  // #idSearchSpan .searchResultList. Gated by the week only — see the note above.
  { id: 'list', key: 'list', after: ['week'], read: (doc, ctx) => readList(doc, { allowEmpty: !!ctx.allowEmpty }) },
  // A filter form plus a run control. Late, so NewClass keeps its list view.
  { id: 'report', key: 'report', after: ['confirmation', 'week', 'list'], read: (doc) => readReport(doc) },
  // A form with a control that is not Run Report.
  { id: 'task', key: 'task', after: ['confirmation', 'week', 'list', 'report'], read: (doc) => readTask(doc) },
  // Tables with rows: dashboards, print sheets, list-ish settings.
  { id: 'sheet', key: 'sheet', after: ['confirmation', 'week', 'list', 'report', 'task'], read: (doc) => readSheet(doc) },
  // Landing pages: what is left when there is nothing but links.
  { id: 'index', key: 'index', after: ['confirmation', 'week', 'list', 'report', 'task', 'sheet'], read: (doc) => readIndex(doc) },
  // A control and a save. After index, because a menu is not a settings card.
  { id: 'settings', key: 'settings', after: ['confirmation', 'week', 'list', 'report', 'task', 'sheet', 'index'], read: (doc) => readSettings(doc) },
  // Last of all, and the smallest: a sentence and the app's own button.
  { id: 'note', key: 'note', after: ['confirmation', 'week', 'list', 'report', 'task', 'sheet', 'index', 'settings'], read: (doc) => readNote(doc) }
];

export const READERS = ORDER.map((reader) => ({
  ...reader,
  claims: (doc, ctx) => !!reader.read(doc, ctx)
}));

// The view a claimed reader produces. One reader is named differently from its
// model key: a confirmation's view is `confirm`.
const viewOf = (id) => (id === 'confirmation' ? 'confirm' : id);

// Titles come from the model, except for the two readers that have none of their
// own (a week and a list take the page's own title).
const TITLED = ['report', 'task', 'sheet', 'index', 'settings', 'note'];

export function readPage(doc, url, opts = {}) {
  const ctx = {
    url,
    page: pageName(url),
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
    sheet: null,
    index: null,
    settings: null,
    note: null,
    confirm: null,
    view: null,
    title: titleOf(doc),
    url
  };

  // Every claimed model is carried, not only the winning one.
  for (const [id, value] of claimed) {
    const reader = ORDER.find((r) => r.id === id);
    model[reader.key] = value;
  }

  if (first) {
    model.view = viewOf(first.id);
    const value = claimed.get(first.id);
    model.title = first.id === 'confirmation'
      ? (value.title || (value.ok ? 'Saved' : 'Not saved'))
      : TITLED.includes(first.id)
        ? value.title
        : titleOf(doc);
  }

  return model;
}
