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
import { CONTROLS } from '../model/controls.js';
import { pageRegions } from '../model/regions.js';
import { CHROME, CONTENT_BLOCK, NAV } from '../model/appdom.js';

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

// A table on the page is another reader's screen. Which tables are the page's is
// the shared judgement's (`model/regions.js`); this used to ask for
// `table tr td`, a scrape that counted a layout wrapper's cells as rows.
function hasTable(doc) {
  return pageRegions(doc).tables.length > 0;
}

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
  const root = qs(doc, CONTENT_BLOCK) || qs(doc, '#mainContent') || (doc && doc.body);
  if (!root) return null;

  const buttons = qsa(root, 'a, button').filter((el) => SUBMITS.test(el.getAttribute('onclick') || ''));
  if (buttons.length !== 1) return null;

  // A control someone could type into means a form, and a form has its own
  // readers. Hidden inputs are record ids, not fields.
  const typed = qsa(root, CONTROLS)
    .filter((el) => String(el.getAttribute('type') || '').toLowerCase() !== 'hidden');
  if (typed.length) return null;

  if (hasTable(doc)) return null;

  const links = qsa(root, 'a[href]')
    .filter((a) => !(a.closest && a.closest(CHROME + ', #idSearchSpan')));
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
    // The question's own answer bar, not everything the page links to: see
    // `exitsOf`.
    links: exitsOf(button),
    actions: [{
      label,
      id: button.getAttribute('id') || '',
      onclick: button.getAttribute('onclick') || ''
    }]
  };
}

// The app puts the way out beside the question's own button: on the live Drop
// Student page `Drop` and `Cancel` sit in one paragraph, and that paragraph is
// the answer bar. Every other anchor on the page is not an answer — the
// breadcrumb, and the names the sentence asks about ("…drop Lily from 520
// Contemporary 1") — and reading them all as buttons gave a two-answer dialog a
// row of five, three of which only made sense beside the original page.
function exitsOf(button) {
  const bar = button.parentElement;
  if (!bar) return [];
  return qsa(bar, 'a[href]')
    .filter((a) => a !== button && ANSWERS_NO.test(textOf(a)))
    .map((a) => ({ label: textOf(a), href: a.getAttribute('href') || '' }))
    .filter((link) => link.href && link.href !== '#');
}

// The page's own way onward, as destinations rather than prose.
//
// A confirmation states what happened and then offers where to go: "Review the
// account for …", "Return to Lily", "Go to Graduating Seniors". Those are
// commands, and a command is a thing a button can do.
//
// What it must not turn into buttons is everything else the app links to. The
// outcome sentence names its records with anchors ("[Lily] has been dropped from
// [520 Contemporary 1]"), every page prints its breadcrumb, and a response that
// also carries a list brings every row's link with it — offered as buttons that is
// the row of random buttons these pages were showing. So: the sentence's own
// anchors are excluded, the breadcrumb is not an option, and only command-shaped
// labels survive. A page with no command at all falls back to its last crumb, so
// there is always one way back and never a wall of names.
const MAX_LINKS = 3;

function linksOf(doc, root, opts = {}) {
  const inside = opts.inside || null;
  const crumbs = new Set(qsa(doc, '.Breadcrumb a'));
  const seen = new Set();
  const commands = [];

  for (const anchor of qsa(root, 'a[href]')) {
    if (anchor.closest && anchor.closest(NAV + ', #idSearchSpan')) continue;
    // An anchor inside the sentence is a name the sentence is about — unless it is
    // a command the app appended to that same sentence ("Review the account for …"),
    // which is an action and reads as one.
    if (inside && inside.contains && inside.contains(anchor)
      && !COMMAND.test(textOf(anchor))) continue;
    if (crumbs.has(anchor)) continue;

    const label = textOf(anchor);
    const href = anchor.getAttribute('href');
    if (!label || !href || href === '#' || /^javascript:/i.test(href)) continue;
    if (!COMMAND.test(label)) continue;

    const key = href + '|' + label;
    if (seen.has(key)) continue;
    seen.add(key);
    commands.push({ label, href });
  }

  // The sentence's first anchor is the record the page is about. It is a name in
  // prose and it stays one, but after a drop the student it names is exactly where
  // you want to go back to, so it is offered once, as one button - not a row.
  // A command that already points at the same record keeps its own wording
  // ("Return to Lily"), so the name is dropped rather than duplicating it.
  const out = [];
  const subject = subjectOf(inside);
  if (subject && !commands.some((link) => link.href === subject.href)) out.push(subject);
  for (const link of commands) out.push(link);
  if (out.length) return out.slice(0, MAX_LINKS);

  // Nothing is being offered, so the app's own crumb is the way back. The last
  // one names the record or the list you came from.
  const last = qsa(doc, '.Breadcrumb a').pop();
  const href = last && last.getAttribute('href');
  return href ? [{ label: textOf(last), href }] : [];
}

// "Back to Lily" from "[Lily] has been dropped from [Graduating Seniors]": the
// app links the subject of its own sentence, and that link is the way back to the
// record the outcome is about. Only the first one, so the card still reads as an
// answer with somewhere to go rather than a list of everything the page mentions.
function subjectOf(inside) {
  if (!inside) return null;
  const anchor = qsa(inside, 'a[href]')[0];
  if (!anchor) return null;
  const label = textOf(anchor);
  const href = anchor.getAttribute('href') || '';
  if (!label || !href || href === '#' || /^javascript:/i.test(href)) return null;
  return { label: 'Back to ' + label, href };
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
  // The element is kept as well as the text, because the anchors inside it are
  // the names the sentence is about and must not come back as buttons.
  const deepest = matches.find(({ el }) => !matches.some((other) => other !== el && el.contains(other.el)));
  return deepest || matches[0];
}

export function confirmationOf(doc, opts = {}) {
  const root = qs(doc, CONTENT_BLOCK) || qs(doc, '#mainContent') || (doc && doc.body);
  if (!root) return null;

  let ok = true;
  let found = messageIn(root, CONFIRMED);

  if (!found && opts.allowRefused) {
    ok = false;
    found = messageIn(root, REFUSED);
  }

  if (!found) {
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
    message: found.text,
    // The app's own title is usually blank here; the message is the screen.
    title: textOf(qs(doc, '.formTitle')) || '',
    breadcrumb: qsa(doc, '.Breadcrumb a').map(textOf).filter(Boolean),
    // Where the page itself says you can go next — not the anchors inside the
    // sentence, which are the records it is talking about.
    links: linksOf(doc, root, { inside: found.el })
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
  const root = qs(doc, CONTENT_BLOCK) || qs(doc, '#mainContent') || (doc && doc.body);
  if (!root) return null;

  const sentence = (String(root.textContent || '').replace(/\s+/g, ' ').match(ASKS_ABOUT) || [])[0];
  if (!sentence) return null;

  const links = qsa(root, 'a[href]')
    .filter((a) => !(a.closest && a.closest(CHROME + ', #idSearchSpan')));
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
  return !(anchor.closest && anchor.closest(CHROME + ', #idSearchSpan'));
}

export function answeredQuestion(doc) {
  const root = qs(doc, CONTENT_BLOCK) || qs(doc, '#mainContent') || (doc && doc.body);
  if (!root) return null;

  const question = (String(root.textContent || '').replace(/\s+/g, ' ').match(ASKS_ABOUT) || [])[0];
  if (!question) return null;

  // A control to type into, or a table of rows, is a screen with its own reader.
  const typed = qsa(root, CONTROLS)
    .filter((el) => String(el.getAttribute('type') || '').toLowerCase() !== 'hidden');
  if (typed.length) return null;
  if (hasTable(doc)) return null;

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
    // Both answers are already actions; repeating Cancel as a link drew it twice
    // on the card. Nothing else on the page answers a question.
    links: [],
    actions: [action(yes[0]), action(no)]
  };
}
