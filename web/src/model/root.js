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
import { CONTENT } from './appdom.js';

// The selectors themselves are `model/appdom.js`'s data, the one place the
// app's own vocabulary is written down; re-exported here because every reader
// that asks "where is the content" also asks "what is furniture".
export { CHROME, FURNITURE } from './appdom.js';

export function contentRoot(doc) {
  return qs(doc, CONTENT) || (doc && doc.body) || null;
}

// Is this element, or anything above it, something the app keeps rather than
// shows? The class editor marks its hidden tab forms `table-hidden`, and that is
// the signal: a table the page itself calls hidden is storage, not a field.
//
// `display:none` is deliberately *not* a signal, and this is measured rather than
// assumed: the family and student editors arrive with their own form inside a
// `.tabContent` that is `display:none` in the served HTML and is revealed by the
// app's tab script on load. Treating that as hidden made three live captures
// unreadable — a reader that trusts initial visibility would refuse to read the
// screen it is looking at.
//
// Nothing here reads a stylesheet: only what the page says about itself.
export function isHidden(el) {
  for (let node = el; node && node.getAttribute; node = node.parentElement) {
    if (node.hasAttribute && node.hasAttribute('hidden')) return true;
    if (/(^|\s)table-hidden(\s|$)/.test(node.getAttribute('class') || '')) return true;
  }
  return false;
}
