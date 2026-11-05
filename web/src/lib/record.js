// The record page ladder, out of `main.js`.
//
// A URL can say "record page" and still not be an editor. `PrintClassRoster` and
// `Attendance` carry dozens of controls and nothing that saves them; `Enroll` and
// `SwitchClasses` are the week calendar; `EnrollmentSearch` is a record list and
// `EmailTextHome(meth)` is a menu. Those screens are real, so a record URL is
// resolved in an order, and the order is the contract.
//
// It used to live inline in `main.js`'s mounting code, which is why the plan
// could only describe the order in prose: nothing could reach it without a
// browser. Here it is a function of the document, and the tests drive it.
//
// The editor itself is read with `readForm`, never through `readPage`: the class
// editor contains a hidden Calendar tab with seven TimeBlock tables, and the week
// reader would claim it.

import { readPage } from './page.js';
import { readList } from './list.js';
import { recordModel } from './editor.js';

// Kept as the module's own name for the editor, so callers that ask the record
// module do not have to know where it moved to.
export { recordModel };

// What a record URL turned out to be: the editor, or the reader that claims it,
// or nothing at all (the app keeps its page). `view` is the string `mountRecord`
// switches on; `model` is what to mount.
export function readRecordPage(doc, url) {
  // One registry decides this page too. `readers/index.js` puts the editor first
  // in its order and only claims a record URL, so a record URL that is a report,
  // a task, a sheet or a toggle is read by the same reader, in the same place in
  // the same order, as that page reached any other way — which is what this module
  // used to duplicate with a ladder of its own (attendance, task, sheet, settings)
  // that could not produce a report at all.
  //
  // The list is read here as well: a page with no list of its own still answers a
  // save or a delete beside the one the record panel showed.
  const page = readPage(doc, url);
  if (!page.view) return null;
  return { view: page.view, model: { ...page, list: page.list || readList(doc) } };
}
