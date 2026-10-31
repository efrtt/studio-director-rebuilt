// Where a page's content starts, in one place.
//
// `note`, `task`, `sheet` and `settings` each grew their own copy of this, with
// two slightly different fallback sets, so a page could be "the content root" to
// one reader and "the whole body" to the next. One definition, one fallback
// order, imported by all four.
//
// The shell is `#mainContent > .contentContainer`; older screens print directly
// into `.contentContainer`, and a print window has neither, which is why the
// body is the last resort rather than the first.

import { qs } from '../lib/shell.js';

// Navigation and shell furniture: never the screen being read, and never
// something to count as one of its controls. `#sd-root` is this build's own
// overlay, whose buttons carry the same words as the app's.
export const CHROME = '#sideNavBar, .topBarContainer, .topBar, .Breadcrumb, .copyright, #sd-root';

// Page furniture inside the content root: a title, a breadcrumb, a button row.
export const FURNITURE = '.formTitle, .Breadcrumb, .ButtonBar, .ButtonArea, .menu';

export function contentRoot(doc) {
  return qs(doc, '.contentContainer') || qs(doc, '#mainContent') || (doc && doc.body) || null;
}
