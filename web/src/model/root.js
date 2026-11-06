// What page this is, and where its content starts — in one place.
//
// `note`, `task`, `sheet` and `settings` each grew their own copy of the root,
// with different fallbacks, so a page could be "the content root" to one reader
// and "the whole body" to the next. Worse, each place that asked "is this a
// shell page?" re-derived the answer from the same selector, so whether a page
// was skinned at all depended on which code path happened to ask.
//
// There is one answer now: `pageShape(doc)`. It names
//
//   shell      the app's own chrome is present (rail, top bar, #mainContent)
//   shellFree  the page is a document of its own — a print window, a popup, an
//              outcome screen the app returns to
//   root       where the screen's content starts, by a fixed ladder:
//              `.contentContainer` → `#mainContent` → `.Content` → `body`
//   block      the finer `.Content` block inside the root, when the app prints
//              one (the confirmation/outcome screens do)
//   content    whether the root holds anything a reader could claim
//   titled     whether the page names itself
//
// Every reader takes its root from here, and the mount path takes its shape from
// here, so "is this an admin page or a print window" is decided once per page
// rather than once per module. Nothing here is a per-site branch: the selectors
// are the app's own vocabulary, kept in `model/appdom.js`.

import { CONTENT_BLOCK, CONTENT_ROOTS, PAGE_TITLE, SHELL } from './appdom.js';

// What counts as content rather than framing: a row, a control, a link or a
// paragraph. The same question the fetch decision asks, answered once.
const CONTENTFUL = 'table tr, input, select, textarea, a[href], p';

// The root's name for the decision stamp: `body`, `#mainContent`, `.Content`…
export function rootName(root) {
  if (!root) return 'none';
  if (root === root.ownerDocument.body) return 'body';
  if (root.id) return '#' + root.id;
  const cls = String(root.getAttribute('class') || '').trim().split(/\s+/)[0];
  return cls ? '.' + cls : root.tagName.toLowerCase();
}

function firstOf(doc, selectors) {
  if (!doc || typeof doc.querySelector !== 'function') return null;
  for (const selector of selectors) {
    const found = doc.querySelector(selector);
    if (found) return found;
  }
  return null;
}

// The page's shape, computed from the page itself and nothing else. `doc` is a
// document: the body is the last rung of the ladder, which is what makes a print
// window readable without any reader knowing about print windows.
export function pageShape(doc) {
  const empty = {
    shell: false,
    shellFree: false,
    root: null,
    rootName: 'none',
    block: null,
    content: false,
    titled: false
  };
  if (!doc || typeof doc.querySelector !== 'function') return empty;

  const shell = !!doc.querySelector(SHELL);
  const root = firstOf(doc, CONTENT_ROOTS) || doc.body || null;
  if (!root) return empty;

  const block = (root.querySelector && root.querySelector(CONTENT_BLOCK)) || null;
  const title = doc.querySelector(PAGE_TITLE);
  return {
    shell,
    // No shell means the page *is* the screen: a document served on its own.
    shellFree: !shell,
    root,
    rootName: rootName(root),
    block,
    content: !!(root.querySelector && root.querySelector(CONTENTFUL)),
    titled: !!(title && String(title.textContent || '').trim())
  };
}

// Where a screen's content starts. Every reader asks this and nothing else.
export function contentRoot(doc) {
  return pageShape(doc).root;
}

// The block a page prints *inside* its content root (`.Content`), when it does:
// an outcome screen puts its sentence and its button there, and the breadcrumb or
// button bar outside it belongs to the shell, not the screen. Readers that used
// to carry `.Content, #mainContent, body` themselves ask this instead.
export function contentBlockOf(doc) {
  const shape = pageShape(doc);
  return shape.block || shape.root;
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

// The app's own furniture selectors, re-exported because every reader that asks
// "where is the content" also asks "what is chrome".
export { CHROME, FURNITURE } from './appdom.js';
