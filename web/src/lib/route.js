// Which entry point a URL belongs to, decided once.
//
// `main.js` asked three separate questions inline, in the middle of mounting:
// is this SearchResults, is this a record page, is this the bare `admin.sd`
// response. Each answer chose a different path — live read, fetch then read the
// form, live read with `allowRefused` — and the fall-through was "fetch and read
// the chain". Written here, the five paths are cases of one decision that a test
// can reach without a browser.
//
// The order matters. `SearchResults` is checked first because its panel is drawn
// by the app's own script: it must be read live even though it is not a record.
// A record page is checked before the page name, because a record can arrive
// without one — the URL the app leaves behind after a refused save still carries
// the editor.

import { pageName, isRecordPage } from './shell.js';

export const ROUTES = ['search', 'record', 'admin', 'page'];

export function routeOf(href) {
  const name = pageName(href);
  // Rows are drawn after load; the fetched HTML is a shell with DWR iframes.
  if (name === 'SearchResults') return 'search';
  // The editor: read with readForm, never through the chain, or the class
  // editor's hidden Calendar tab becomes the week view.
  if (isRecordPage(href)) return 'record';
  // A save posts the editor and the app answers with a bare `admin.sd` page.
  // That response is already in the browser; a GET of the same URL is not it.
  if (!name) return 'admin';
  return 'page';
}
