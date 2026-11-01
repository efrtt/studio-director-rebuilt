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

import { railLinks } from './shell.js';
import { readPage } from './page.js';
import { readForm } from './form.js';
import { readBar } from './bar.js';
import { readTabs } from './tabs.js';
import { readList } from './list.js';
import { readTask } from './task.js';
import { readSheet } from './sheet.js';
import { readSettings } from './settings.js';

// The record editor's model, or null when the page is not one.
//
// A record editor is a form *plus a way to save it*. The app puts Save in the
// top bar, so `#save` is the check; the tabbed record pages are editors even
// when that id differs, because they are the only record screens with tabs.
export function recordModel(doc, url, form = readForm(doc)) {
  if (!form) return null;

  const tabs = readTabs(doc);
  const tabbed = !!(tabs && tabs.tabs.length > 1);
  if (!doc.getElementById('save') && !tabbed) return null;

  return {
    nav: railLinks(doc),
    form,
    // The bar above the tabs: New, Print, Email, Delete, Edit Family, More.
    bar: readBar(doc),
    // Enrollment, Skills, Calendar: the page already carries them hidden, so
    // they are rebuilt from the same response as the form.
    tabs,
    list: readList(doc),
    view: 'form',
    title: form.title,
    url
  };
}

// What a record URL turned out to be: the editor, or the reader that claims it,
// or nothing at all (the app keeps its page). `view` is the string `mountRecord`
// switches on; `model` is what to mount.
export function readRecordPage(doc, url) {
  const nav = railLinks(doc);
  const list = readList(doc);

  const form = readForm(doc);
  const editor = recordModel(doc, url, form);
  if (editor) return { view: 'form', model: editor };

  // A form without a save control is not an editor: `PrintClassRoster` and
  // `Attendance` carry forty and a hundred controls, and an editor built from
  // them would be a dead wall of inputs. Their own controls do the work, so they
  // are read as a task, or as a table when that is all they have.
  const task = form ? readTask(doc) : null;
  if (task) {
    return { view: 'task', model: { nav, list, url, task, view: 'task', title: task.title } };
  }

  const sheet = readSheet(doc);
  if (sheet) {
    return { view: 'sheet', model: { nav, list, url, sheet, view: 'sheet', title: sheet.title } };
  }

  const settings = readSettings(doc);
  if (settings) {
    return { view: 'settings', model: { nav, list, url, settings, view: 'settings', title: settings.title } };
  }

  // Not an editor, a form, a table or a toggle, but a page can carry a record
  // parameter and still be something else entirely. Those are real screens, so
  // the page router gets the last word before the app does.
  const other = readPage(doc, url);
  if (other.view) return { view: other.view, model: { ...other, list: other.list || list } };

  return null;
}
