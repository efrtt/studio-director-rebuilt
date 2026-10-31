// The page the app returns after a save.
//
// Saving posts the editor, and the app answers with a plain `admin.sd` page —
// no `page=` parameter, so nothing in the URL says which screen this is. What
// it says is in the text: "<Family> has been updated." beside the record list.
//
// No dump of that response exists yet, which is exactly why this looks for the
// sentence instead of a class name: it finds the element whose own text is the
// message, whatever the app calls it. The record panel is skipped so a family
// can never be mistaken for a message.
//
// The same screen is used when a save is refused, so a failure sentence is
// recognised too — but only when the caller asks for it. That keeps ordinary
// pages, which are full of the words "required" and "invalid", from being
// mistaken for an outcome screen.

import { qs, qsa, textOf } from './shell.js';

const CONFIRMED = /\bhas been\s+(updated|saved|added|created|deleted|removed|changed|cloned|unenrolled|enrolled)\b/i;
const REFUSED = /\b(has not been|was not|could not be|cannot be|unable to|not saved|not updated|error|failed|requires?|invalid)\b/i;

// A message is a short piece of text, not a container holding the page.
const MAX_LENGTH = 240;

function messageIn(root, pattern) {
  const matches = qsa(root, 'div, p, span, h1, h2, h3, td, b, strong')
    .filter((el) => !(el.closest && el.closest('#idSearchSpan')))
    .map((el) => ({ el, text: textOf(el) }))
    .filter(({ text }) => text && text.length <= MAX_LENGTH && pattern.test(text));

  if (!matches.length) return null;

  // Prefer the deepest match: the outer .Content also contains the sentence.
  const deepest = matches.find(({ el }) => !matches.some((other) => other !== el && el.contains(other.el)));
  return (deepest || matches[0]).text;
}

export function confirmationOf(doc, opts = {}) {
  const root = qs(doc, '.Content') || qs(doc, '#mainContent') || (doc && doc.body);
  if (!root) return null;

  let ok = true;
  let message = messageIn(root, CONFIRMED);

  if (!message && opts.allowRefused) {
    ok = false;
    message = messageIn(root, REFUSED);
  }

  if (!message) return null;

  return {
    kind: 'confirm',
    ok,
    message,
    // The app's own title is usually blank here; the message is the screen.
    title: textOf(qs(doc, '.formTitle')) || '',
    breadcrumb: qsa(doc, '.Breadcrumb a').map(textOf).filter(Boolean)
  };
}
