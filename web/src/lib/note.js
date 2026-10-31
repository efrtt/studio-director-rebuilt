// Notice screens: a sentence telling you what to do next, and the app's own
// control to do it with.
//
// `AddMultiplePayments` is the shape of the whole bucket — a breadcrumb, a
// title, a button bar and a `contentInfo` block holding the instruction and one
// control. There is no form to edit and no table to read, so every other reader
// refuses it, and before this one the whole bucket landed on "no view".
//
// Rewritten against docs/contract.md as the first module of the rebuild. The
// behaviour is pinned, not remembered: `test/fixtures/notice-addmultiplepayments
// .html` through the golden gate, plus `note.test.mjs` and `choose.test.mjs` for
// the tiebreaker. Nothing here may change the model it produces.
//
// The reader is deliberately the last one tried, and it refuses anything another
// reader should own — a control (a form), two data rows (a table), six links (a
// menu). Those three refusals are exported as `contradictsNote` because main.js
// asks the same question of the *live* page before it trusts a note read from a
// fetched one: a screen whose form the app draws after load must not be covered
// with the server's empty shell.
//
// Two kinds of control live on these pages and only one is an action in the
// usual sense: an `a.Btn` the app's script drives, and a plain link that
// navigates. `readActions` drops plain links on purpose — on every other screen
// a link is navigation — so this reader adds the page's own in-content links.

import { qs, qsa, textOf } from './shell.js';
import { readActions, primaryAction } from './actions.js';
import { contentRoot, CHROME, FURNITURE } from '../model/root.js';

// How many lines of instruction to keep. These pages say one thing; a page that
// says more than eight is not a notice.
const MAX_LINES = 8;
// Six links is where `readIndex` starts calling a page a menu.
const MENU_LINKS = 6;
// Two data rows is where `readSheet` starts calling a page a table.
const TABLE_ROWS = 2;

// The one content-root definition (model/root.js), under this reader's name.
const rootOf = contentRoot;

function dataRows(root) {
  let rows = 0;
  for (const table of qsa(root, 'table')) {
    for (const tr of qsa(table, 'tr')) {
      if (tr.querySelector('td')) rows += 1;
    }
  }
  return rows;
}

// The three refusals, as one question. Exported because the live page is asked
// it too — see main.js and choose.js.
export function contradictsNote(doc) {
  const root = rootOf(doc);
  if (!root) return false;
  if (qsa(root, 'input, select, textarea').length > 0) return true;
  if (dataRows(root) >= TABLE_ROWS) return true;
  return qsa(root, 'a[href]').length >= MENU_LINKS;
}

// The page's own in-content links: "pick a family", "add", "continue".
function linksInContent(root) {
  const out = [];
  for (const anchor of qsa(root, 'a[href]')) {
    if (anchor.closest && anchor.closest(CHROME)) continue;
    const label = textOf(anchor);
    const href = anchor.getAttribute('href') || '';
    if (!label || !href || href === '#' || /^javascript:/i.test(href)) continue;
    out.push({
      label,
      id: anchor.getAttribute('id') || '',
      href,
      js: false,
      onclick: ''
    });
  }
  return out;
}

// The app's buttons plus the page's own links, each counted once.
function actionsOf(root) {
  const seen = new Set();
  const out = [];
  for (const action of readActions(root).concat(linksInContent(root))) {
    const key = action.id + '|' + action.label;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(action);
  }
  return out;
}

// The instruction, in document order. Paragraphs and list items first; a
// `contentInfo` block carrying bare text and no paragraphs is the fallback.
function linesOf(root, actions) {
  const paragraphs = qsa(root, 'p, li');
  const nodes = paragraphs.length ? paragraphs : qsa(root, '.contentInfo');
  const labels = new Set(actions.map((a) => a.label));
  const seen = new Set();
  const lines = [];

  for (const node of nodes) {
    if (node.closest && node.closest(FURNITURE)) continue;
    const text = textOf(node);
    if (!text || text.length > 240) continue;
    // A paragraph that only holds the button repeats the button's own label.
    if (labels.has(text) || seen.has(text)) continue;
    seen.add(text);
    lines.push(text);
    if (lines.length >= MAX_LINES) break;
  }

  return lines;
}

export function readNote(doc) {
  const root = rootOf(doc);
  if (!root) return null;

  // A control to type into is a form, two rows are a table, six links are a
  // menu. This reader only ever presses.
  if (contradictsNote(doc)) return null;

  const actions = actionsOf(root);
  if (!actions.length) return null;

  const lines = linesOf(root, actions);
  if (!lines.length) return null;

  return {
    kind: 'note',
    title: textOf(qs(doc, '.formTitle, .ReportName, h1')) || 'Notice',
    breadcrumb: qsa(doc, '.Breadcrumb a').map(textOf).filter(Boolean),
    lines,
    actions,
    primary: primaryAction(actions)
  };
}
