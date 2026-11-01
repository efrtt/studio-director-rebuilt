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

// The screen is sometimes *before* the outcome: the app asks, then saves. The
// button that asks is the app's own scripted control, not a link and not a save.
const SUBMITS = /onCallMethodSubmit\s*\(/i;
// More links than this is a menu, and a menu is not a question.
const QUESTION_LINKS = 5;

// A message is a short piece of text, not a container holding the page.
const MAX_LENGTH = 240;

// A paragraph can hold the sentence and the button that answers it - that is how
// `Unenroll` is drawn live, though the captured fixture had them apart. So take the
// node's own words and drop the controls, rather than dropping the node: otherwise
// the one sentence on the page disappears along with the button.
function textWithoutControls(node) {
  if (!node || !node.cloneNode) return textOf(node);
  const copy = node.cloneNode(true);
  if (copy.querySelectorAll) {
    copy.querySelectorAll('a[href], [onclick], .Btn').forEach((el) => el.remove());
  }
  return textOf(copy);
}

// A page waiting for a yes: `Unenroll` is the shape. A warning sentence, no
// control to type into, no rows, and exactly one app button that calls back into
// the app. It is rendered as the same card one step earlier, with the app's own
// button, because pressing anything else would be inventing a save this page
// does not have.
export function pendingConfirmation(doc) {
  const root = qs(doc, '.Content') || qs(doc, '#mainContent') || (doc && doc.body);
  if (!root) return null;

  const buttons = qsa(root, 'a, button').filter((el) => SUBMITS.test(el.getAttribute('onclick') || ''));
  if (buttons.length !== 1) return null;

  // A control someone could type into means a form, and a form has its own
  // readers. Hidden inputs are record ids, not fields.
  const typed = qsa(root, 'input, select, textarea')
    .filter((el) => String(el.getAttribute('type') || '').toLowerCase() !== 'hidden');
  if (typed.length) return null;

  if (qs(root, 'table tr td')) return null;

  const links = qsa(root, 'a[href]')
    .filter((a) => !(a.closest && a.closest('#sideNavBar, .topBarContainer, .Breadcrumb, #idSearchSpan')));
  if (links.length > QUESTION_LINKS) return null;

  const button = buttons[0];
  const label = textOf(button);
  const title = textOf(qs(doc, '.formTitle, .ReportName, h1'));
  const lines = qsa(root, 'p, li')
    .map((node) => textWithoutControls(node))
    .filter((text) => text && text !== label && text.length <= MAX_LENGTH);

  if (!label || !title || !lines.length) return null;

  return {
    kind: 'confirm',
    // Not an outcome: nothing has happened yet.
    pending: true,
    ok: true,
    message: lines[0],
    lines,
    title,
    breadcrumb: qsa(doc, '.Breadcrumb a').map(textOf).filter(Boolean),
    actions: [{
      label,
      id: button.getAttribute('id') || '',
      onclick: button.getAttribute('onclick') || ''
    }]
  };
}

function messageIn(root, pattern) {
  const matches = qsa(root, 'div, p, span, h1, h2, h3, td, b, strong')
    .filter((el) => !(el.closest && el.closest('#idSearchSpan')))
    // The outcome line often ends in a link ("Review the account for …"), and
    // the link's words are not part of the sentence the app is stating: read as
    // text they ran on from the message ("… Contemporary 1Review the account").
    .map((el) => ({ el, text: textWithoutControls(el) }))
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

  if (!message) {
    // No outcome sentence: this may be the same screen one step earlier, waiting
    // for the app's own button.
    const pending = pendingConfirmation(doc);
    if (pending) return pending;
    return null;
  }

  return {
    kind: 'confirm',
    ok,
    message,
    // The app's own title is usually blank here; the message is the screen.
    title: textOf(qs(doc, '.formTitle')) || '',
    breadcrumb: qsa(doc, '.Breadcrumb a').map(textOf).filter(Boolean)
  };
}
