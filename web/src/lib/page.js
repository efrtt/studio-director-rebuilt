// Routing: one pure function, no DOM globals beyond the document it is given.
//
// The rule is structural, not a table of page names:
//   table.TimeBlock                  -> week view
//   #idSearchSpan .searchResultList  -> list view
//   a run control + table.Form       -> report view
//   table.Form + a control of its own -> task view (settings, letters, mail)
//   tables with rows                 -> sheet view (dashboards, print sheets)
//   links and no rows                -> index view
//   a control and a save            -> settings view (single toggles)
//
// Record editors are deliberately *not* routed here. The New* pages carry a form
// too, so a form-first rule would replace every list with an editor. Record pages
// are identified by URL (see isRecordPage) and read with readForm alone, in
// main.js — which also keeps the class editor's Calendar tab from being mistaken
// for the week calendar.

import { titleOf, railLinks } from './shell.js';
import { readWeek } from './calendar.js';
import { readList } from './list.js';
import { readReport } from './report.js';
import { readIndex } from './index-page.js';
import { readTask } from './task.js';
import { readSheet } from './sheet.js';
import { readSettings } from './settings.js';
import { confirmationOf } from './confirmation.js';
import { readNote } from './note.js';

export function readPage(doc, url, opts = {}) {
  // A confirmation page also carries the record panel, so it is checked first:
  // the sentence is the screen, the list is what you carry on from.
  const confirm = confirmationOf(doc, opts);
  const week = confirm ? null : readWeek(doc);
  const list = week ? null : readList(doc, { allowEmpty: !!opts.allowEmpty });
  // A report is a filter form plus a run control. It is checked last so the
  // list and week pages keep their own views: NewClass is a form too.
  const report = confirm || week || list ? null : readReport(doc);
  // A form with a control that is not Run Report: settings pages, the letter
  // templates, the compose-mail screens. Checked after the report so a report's
  // own controls are not mistaken for a plain submit.
  const task = confirm || week || list || report ? null : readTask(doc);
  // Tables with rows: dashboards, the print sheets, the list-ish settings
  // pages. After task, because a form with its own control is the more specific
  // screen.
  const sheet = confirm || week || list || report || task ? null : readSheet(doc);
  // Landing pages last: a menu is what is left when the page is none of the
  // above — no week, no list, no form, no table, and nothing but links.
  const index = confirm || week || list || report || task || sheet ? null : readIndex(doc);
  // Last, and deliberately so: a menu with one search box on it is still a
  // menu, and a settings card must never replace a landing page.
  const settings = confirm || week || list || report || task || sheet || index
    ? null
    : readSettings(doc);
  // Last of all, and the smallest: a sentence and the app's own button. The 68
  // screens that are a step rather than a form used to reach "no view".
  const note = confirm || week || list || report || task || sheet || index || settings
    ? null
    : readNote(doc);

  return {
    nav: railLinks(doc),
    week,
    list,
    report,
    task,
    sheet,
    index,
    settings,
    note,
    confirm,
    view: confirm ? 'confirm'
      : week ? 'week'
        : list ? 'list'
          : report ? 'report'
            : task ? 'task'
              : sheet ? 'sheet'
                : index ? 'index'
                  : settings ? 'settings'
                    : note ? 'note'
                      : null,
    title: confirm
      ? (confirm.title || (confirm.ok ? 'Saved' : 'Not saved'))
      : report ? report.title
        : task ? task.title
          : sheet ? sheet.title
            : index ? index.title
              : settings ? settings.title
                : note ? note.title
                  : titleOf(doc),
    url
  };
}
