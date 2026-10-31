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
//
// The order and the readers themselves live in `readers/index.js`. This module
// stays as the import path the tests, the golden tool and main.js already use.

export { readPage, READERS } from '../readers/index.js';
