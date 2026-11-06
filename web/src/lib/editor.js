// The record editor's model, out of `lib/record.js`.
//
// It lives on its own because two things need it now: the record ladder, and the
// reader registry that decides what every page is. `readers/index.js` cannot
// import `record.js` (that module asks the registry `readPage`), so the one
// definition of "an editor" moved here, below both.
//
// A record editor is a form *plus a way to save it*. The app puts Save in the top
// bar, so `#save` is the check; the tabbed record pages are editors even when that
// id differs, because they are the only record screens with tabs.
//
// The editor is read with `readForm`, never through the reader chain: the class
// editor carries a hidden Calendar tab with seven TimeBlock tables, and the week
// reader would claim it.

import { railLinks } from './shell.js';
import { readForm } from './form.js';
import { readBar } from './bar.js';
import { readTabs } from './tabs.js';
import { readList } from './list.js';
import { pageSave } from './save.js';

export function recordModel(doc, url, form = readForm(doc, { url })) {
  if (!form) return null;

  const tabs = readTabs(doc);
  const tabbed = !!(tabs && tabs.tabs.length > 1);
  if (!pageSave(doc) && !tabbed) return null;

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
