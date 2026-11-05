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

// `scheduled` and `cancelled` are the drop flow's own outcomes: "Lily has been
// scheduled to drop in on class …" when it is booked, "… session in … has been
// cancelled" when it is dropped again. Without them those pages read as no view
// at all, because every other reader refuses a page that is one sentence and a
// handful of links. Both spellings of cancelled, because the app is American.
const CONFIRMED = /\bhas been\s+(updated|saved|added|created|deleted|removed|changed|cloned|unenrolled|enrolled|dropped|withdrawn|scheduled|cancell?ed)\b/i;
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
//
// The names in the sentence are links too. "Are you sure you want to drop Lily from
// 520 Contemporary 1?" is three text nodes and two anchors, and "…has been dropped"
// ends in a link of its own ("Review the account for …"). Dropping every anchor lost
// the names ("drop from ?"); keeping every anchor kept the command. So: keep the
// words, drop the links that are commands, and put a space between them - the app's
// markup has none, which is how "1Review" happened.
const COMMAND = /^(review|open|view|print|email|edit|manage|see|show|go to|back to|return)\b/i;

function isCommand(el) {
  const onclick = el.getAttribute && el.getAttribute('onclick');
  if (onclick) return true;
  if (el.classList && el.classList.contains('Btn')) return true;
  return COMMAND.test(String(el.textContent || '').trim());
}

function sentenceOf(node) {
  if (!node || !node.childNodes) return textOf(node);

  let out = '';
  let own = '';
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3) {
      out += child.textContent;
      own += child.textContent;
      continue;
    }
    if (child.nodeType !== 1) continue;
    if (String(child.tagName || '').toLowerCase() === 'br') {
      out += ' ';
      continue;
    }
    const text = String(child.textContent || '').trim();
    if (!text || isCommand(child)) continue;
    out += ' ' + text;
  }

  // A paragraph made only of links is the app's action bar, not a sentence. Read
  // as prose it put "Switch Classes" into the drop question, and made the Email
  // Class menu look like a question at all. Only words the page states itself
  // count; the names inside a sentence are still kept, because the surrounding
  // sentence is text of its own.
  if (!/\S/.test(own)) return '';

  return out.replace(/\s+/g, ' ').trim();
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
    .map((node) => sentenceOf(node))
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
    links: linksOf(doc, root),
    actions: [{
      label,
      id: button.getAttribute('id') || '',
      onclick: button.getAttribute('onclick') || ''
    }]
  };
}

// The page's own way onward, as destinations rather than prose.
//
// A confirmation states what happened and then lists where you can go: the
// breadcrumb ("Families > Hopper Family"), "Review the account for …", "Back to
// the student". Those are the app's links, so they are offered as buttons - and a
// referrer link is only a fallback, because the page before a save can be one step
// short of where you want to return to.
// The page's own ways onward, kept in the page's order: the breadcrumb first,
// then the record it changed and where to go next. Five cut the drop-in's outcome
// short — three crumbs and "Return to Lily" / "Review the account" used the budget
// and "Go to Graduating Seniors", the link that screen exists to offer, fell off.
const MAX_LINKS = 8;

function linksOf(doc, root) {
  const seen = new Set();
  const out = [];

  for (const anchor of qsa(root, 'a[href]')) {
    if (anchor.closest && anchor.closest('#sideNavBar, .topBarContainer, #idSearchSpan')) continue;

    const label = textOf(anchor);
    const href = anchor.getAttribute('href');
    if (!label || !href || href === '#' || /^javascript:/i.test(href)) continue;

    const key = href + '|' + label;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, href });
    if (out.length >= MAX_LINKS) break;
  }

  return out;
}

function messageIn(root, pattern) {
  const matches = qsa(root, 'div, p, span, h1, h2, h3, td, b, strong')
    .filter((el) => !(el.closest && el.closest('#idSearchSpan')))
    // The outcome line often ends in a link ("Review the account for …"), and
    // the link's words are not part of the sentence the app is stating: read as
    // text they ran on from the message ("… Contemporary 1Review the account").
    .map((el) => ({ el, text: sentenceOf(el) }))
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
    // …or the same screen one step before a delete, which the app draws as a
    // question over the list rather than as a form.
    const asked = askedConfirmation(doc);
    if (asked) return asked;
    // …or a question the page answers with two links of its own.
    return answeredQuestion(doc);
  }

  return {
    kind: 'confirm',
    ok,
    message,
    // The app's own title is usually blank here; the message is the screen.
    title: textOf(qs(doc, '.formTitle')) || '',
    breadcrumb: qsa(doc, '.Breadcrumb a').map(textOf).filter(Boolean),
    // Where the page itself says you can go next.
    links: linksOf(doc, root)
  };
}

// The app's own "are you sure?" before a delete.
//
// Measured live on Manage Vendors (2026-11-02): pressing Delete does not post.
// It navigates to a bare `admin.sd` — no `page=`, so no reader can match it by
// URL — whose body is the sentence, two links, and the record list beside them:
//
//   .Content > .formTitle "Manage Vendors"
//   .Content > .ButtonBar                     (empty on this page)
//   .Content > .contentInfo > table.Layout
//     td.Top  "Are you sure you want to delete testaa?"
//             <a class="BtnDestr" id="delete" href="…&meth=delconfirmed&vendor_ident=…">Delete</a>
//             <a class="BtnOutln" id="cancel" href="…&meth=edit&vendor_ident=…">Cancel</a>
//     td.RHS  the "Existing Vendors" table
//
// Both answers are plain links, so the yes is the app's own GET and nothing here
// has to build a request. `pendingConfirmation` cannot see this page: it asks for
// a scripted button and refuses any table, and this page has neither. Without
// this reader it fell through to the table reader and drew as a list with the
// question dropped.
// No `\b` before "are": the app's markup is minified, so the title runs straight
// into the sentence with no whitespace between them ("Manage VendorsAre you
// sure…"). A word boundary there does not exist, and matching on one meant the
// real page was never recognised while the fixture — written with indentation —
// was.
const ASKS_ABOUT = /are you sure\b[^?]{0,200}\?/i;
const AFFIRM = /^(delete|remove|drop)\b/i;

export function askedConfirmation(doc) {
  const root = qs(doc, '.Content') || qs(doc, '#mainContent') || (doc && doc.body);
  if (!root) return null;

  const sentence = (String(root.textContent || '').replace(/\s+/g, ' ').match(ASKS_ABOUT) || [])[0];
  if (!sentence) return null;

  const links = qsa(root, 'a[href]')
    .filter((a) => !(a.closest && a.closest('#sideNavBar, .topBarContainer, .Breadcrumb, #idSearchSpan')));
  // One way to say yes, and it has to be a link: that is the app's own next step.
  const yes = links.filter((a) => AFFIRM.test(textOf(a)) && (a.getAttribute('href') || ''));
  if (yes.length !== 1) return null;

  const no = links.find((a) => /^cancel\b/i.test(textOf(a)));
  const button = yes[0];
  const label = textOf(button);

  // The question names the record ("… delete testaa?"); that name is what the
  // dialog is about, so it is read out of the app's own sentence.
  const name = sentence
    .replace(/^.*?\b(delete|remove|drop)\s+/i, '')
    .replace(/\?\s*$/, '')
    .trim();

  return {
    kind: 'confirm',
    pending: true,
    ok: true,
    // The app's sentence, verbatim: nothing is invented about what it asked.
    message: sentence,
    // The card the view draws reads `lines`. The delete case never noticed this
    // was missing, because it always arrives beside the list it changes and is
    // drawn over that instead — but the same question on a page with no list
    // (dropping a student from one date) came up blank.
    lines: [sentence],
    title: textOf(qs(doc, '.formTitle')) || '',
    breadcrumb: qsa(doc, '.Breadcrumb a').map(textOf).filter(Boolean),
    // What the modal asks, for the screen that draws it over the list.
    ask: {
      label: label || 'Delete',
      name,
      href: button.getAttribute('href') || '',
      cancelHref: no ? no.getAttribute('href') || '' : ''
    },
    links: no ? [{ label: textOf(no), href: no.getAttribute('href') || '' }] : [],
    actions: [{
      label,
      id: button.getAttribute('id') || '',
      href: button.getAttribute('href') || '',
      onclick: button.getAttribute('onclick') || ''
    }]
  };
}

// A question the page answers with two links of its own.
//
// Measured live (2026-11-05) in the drop-in flow: after picking a date the app
// asks "…Are you sure you want to schedule a trial/drop-in for Lily on this
// day?" and offers `a.Btn` Continue (`meth=pickCharge`) beside `a.BtnOutln`
// Cancel. Neither is a scripted button, so `pendingConfirmation` refuses the
// page and the yes is not a Delete, so `askedConfirmation` refuses it too — and
// the one screen in the flow that asks before it acts was the one screen left
// unskinned. Both answers are plain GET links, so both are the app's own next
// step and nothing here builds a request.
const ANSWERS_YES = /^(continue|yes|ok|proceed|confirm|add|schedule|enroll|save|update)\b/i;
const ANSWERS_NO = /^(cancel|no|back|go back|return)\b/i;

function outsideChrome(anchor) {
  return !(anchor.closest && anchor.closest('#sideNavBar, .topBarContainer, .Breadcrumb, #idSearchSpan'));
}

export function answeredQuestion(doc) {
  const root = qs(doc, '.Content') || qs(doc, '#mainContent') || (doc && doc.body);
  if (!root) return null;

  const question = (String(root.textContent || '').replace(/\s+/g, ' ').match(ASKS_ABOUT) || [])[0];
  if (!question) return null;

  // A control to type into, or a table of rows, is a screen with its own reader.
  const typed = qsa(root, 'input, select, textarea')
    .filter((el) => String(el.getAttribute('type') || '').toLowerCase() !== 'hidden');
  if (typed.length) return null;
  if (qs(root, 'table tr td')) return null;

  const title = textOf(qs(doc, '.formTitle, .ReportName, h1'));
  if (!title) return null;

  const links = qsa(root, 'a[href]').filter(outsideChrome);
  const yes = links.filter((a) => ANSWERS_YES.test(textOf(a)));
  const no = links.find((a) => ANSWERS_NO.test(textOf(a)));
  // One way to say yes, and a way out: anything else is a menu, not a question.
  if (yes.length !== 1 || !no) return null;

  const action = (anchor) => ({
    label: textOf(anchor),
    id: anchor.getAttribute('id') || '',
    href: anchor.getAttribute('href') || '',
    onclick: anchor.getAttribute('onclick') || ''
  });

  // What the page says before it asks — "11 out of 15 students are enrolled …" —
  // belongs on the screen: it is the reason the question is being asked.
  const lines = qsa(root, 'p, li')
    .map(sentenceOf)
    .filter((text) => text && text !== textOf(yes[0]) && text !== textOf(no) && text.length <= MAX_LENGTH);

  return {
    kind: 'confirm',
    // Nothing has happened yet: this is the page asking, not the app's answer.
    pending: true,
    ok: true,
    message: question,
    lines: lines.length ? lines : [question],
    title,
    breadcrumb: qsa(doc, '.Breadcrumb a').map(textOf).filter(Boolean),
    links: [action(no)],
    actions: [action(yes[0]), action(no)]
  };
}
