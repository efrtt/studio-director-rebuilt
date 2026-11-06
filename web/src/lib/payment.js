// The New Payment screen.
//
// Measured on the live page (`?page=NewPayment&meth=onNewPayment_gateway`) on
// 2026-11-05: the whole screen is a `table.Layout` of two cells. The left cell is
// a `table.FlexForm` of labelled rows — Family, Amount, Payment Date, Deposit
// Date, Notes, and the card on file with its plan — followed by *three* split
// blocks ("Payment Split #1", "#2 (Optional)", "#3 (Optional)"), each a
// `table.FlexForm` holding one `select[name=paid_towardN]` and one
// `input[name=split_amtN]`, and then two anchors: "Add Another Split" and
// "Process Payment". The right cell holds "Current Unpaid Charges", which is a
// small `table.ReportTable` of three totals rather than a list of charges.
//
// Three things this reader is careful about, because they are what the page gets
// wrong by default:
//
//   - The app prints three split blocks whether or not you split. Here the splits
//     are read as a list (one per `paid_towardN`/`split_amtN` pair) and the view
//     hides them until asked for, so a plain payment is four fields.
//   - The amount and the split amounts must add up, and nothing on the app's page
//     says so. The model carries both and the view shows them side by side; it
//     never computes a total the app would not agree with.
//   - "Process Payment" is printed twice and "Add Another Split" is a bare
//     anchor. Neither can be a link here: the app's own script builds both
//     requests. They are read as actions and pressed where they stand.
//
// Nothing is submitted from here. `runPayment` writes the edited values into the
// app's live controls and clicks the app's own anchor, exactly as `saveInApp`
// does for the editor.

import { qs, qsa, textOf, pageName, breadcrumbOf } from './shell.js';
import { BUTTONS as APP_BUTTONS, OWN_ROOT } from '../model/appdom.js';
import { contentRoot } from '../model/root.js';
import { coverageOf } from '../model/coverage.js';
import { controlOf } from '../model/controls.js';
import { declaredFormTables, pageRegions } from '../model/regions.js';
import { isValueRow, labelledRows, rowCells } from '../model/rows.js';
import { diffFields, applyFields } from '../model/diff.js';

// The app's own controls. Anchors carry their word as text; a submit input
// carries it in `value`.
const BUTTONS = 'a, button, input[type="submit"], input[type="button"], ' + APP_BUTTONS;

// A control as the view needs it: a key, a live selector, what it holds now.
//
// The reading is `model/controls.js`'s — the one walk the record editor and the
// settings card use — so this screen cannot drift on addressing, on what a
// control holds, or on what is a field at all. It used to read its own value out
// of `el.value`, trusted the same address rule by copy, and had its own list of
// types; three places to be wrong about one control.
function fieldOf(el, doc, split) {
  if (!el) return null;
  // The edit screen prints each date as text beside the hidden input that
  // submits it, so that one exception is asked for here; everything else about
  // the reading is the shared walk's.
  const field = controlOf(el, doc, { includeHidden: true });
  if (!field) return null;
  return {
    ...field,
    // The view draws the printed text, and the hidden input is only what the
    // app submits it through, so the type is adapted where the page shape is
    // known rather than in the shared reading.
    type: field.type === 'hidden' ? 'text' : field.type,
    label: '',
    // Which split this belongs to, so the view can group the list without
    // re-deriving it from the name.
    split: split == null ? null : split
  };
}

function rowFor(rows, re) {
  return rows.find((row) => re.test(row.label)) || null;
}

// The card on file is printed as one row under the form rather than as a
// labelled two-cell row: "Payment Method: VISA: XXXXXXXXXXXX9002 Expires: Nov 29
// Automatic/Recurring Payment Plan: Yes Notes: Click here to change". So it is
// found by its words and the parts are cut out of that one string.
function methodOf(table) {
  if (!table) return null;
  const rows = qsa(table, 'tr').filter((tr) => !tr.closest || tr.closest('table') === table);
  const cardRow = rows.find((tr) => /payment method|card on file/i.test(textOf(tr)));
  if (!cardRow) return null;

  const planRow = rows.find((tr) => /payment plan|recurring/i.test(textOf(tr))) || cardRow;

  const raw = textOf(cardRow);
  const card = raw
    .replace(/^[\s\S]*?payment method\s*:?\s*/i, '')
    .split(/expires:?/i)[0]
    .trim();
  const brand = (card.match(/^[A-Za-z]+/) || [''])[0].toUpperCase();
  const digits = card.replace(/\D+/g, '');
  const last4 = digits.length >= 4 ? digits.slice(-4) : '';
  const expiry = /expires?:?\s*([A-Za-z]{3,9}\s*\d{1,2}|\d{1,2}\/\d{2,4})/i.exec(raw);
  // "Automatic/Recurring Payment Plan: Yes" — the answer follows the words, and
  // a row that says "Recurring" first must not answer with "Payment".
  const planText = textOf(planRow);
  // The live row runs "Yes" straight into the next word ("YesNotes:"), so the
  // answer is read as yes/no where the app offers one, and only then as a word.
  const planMatch = /payment plan\s*:?\s*(yes|no)/i.exec(planText)
    || /payment plan\s*:?\s*([A-Za-z]+)/i.exec(planText)
    || /recurring[^A-Za-z]*([A-Za-z]+)/i.exec(planText);

  const links = [cardRow, planRow]
    .filter((row, i, all) => all.indexOf(row) === i)
    .reduce((all, row) => all.concat(qsa(row, 'a[href]')), [])
    .map((a) => ({ label: textOf(a), href: a.getAttribute('href') || '' }))
    .filter((a) => a.href && a.href !== '#');

  const change = links.find((a) => /change/i.test(a.label)) || links[0] || null;
  const notes = links.find((a) => a !== change) || null;

  return {
    card,
    brand,
    last4,
    expires: expiry ? expiry[1].trim() : '',
    plan: planMatch ? planMatch[1] : '',
    changeHref: change ? change.href : '',
    planHref: notes ? notes.href : ''
  };
}

// The three totals under "Current Unpaid Charges". The app prints them as
// label/value rows with no headings, so the last cell of the row is the figure.
function totalsOf(doc) {
  // Which table holds the totals is the page-wide judgement's: the one the
  // classifier calls data on this screen, rather than a class this reader looks
  // up itself (`table.ReportTable`) — a second way to answer "which table is
  // this page's records".
  const found = pageRegions(doc).tables.find((entry) => entry.kind === 'data');
  const table = found ? found.table : null;
  if (!table) return [];

  const out = [];
  for (const tr of qsa(table, 'tr')) {
    const cells = rowCells(tr, table);
    if (!isValueRow(cells)) continue;
    const label = textOf(cells[0]);
    const value = textOf(cells[cells.length - 1]);
    if (!label || !value) continue;
    out.push({
      label,
      value,
      strong: /balance due/i.test(label),
      muted: /not applied|unapplied/i.test(label)
    });
  }
  return out;
}

// An anchor the app's own script drives. Found by its word, anywhere in the
// content — including inside `table.Layout` cells, which is where this page puts
// them, and which the shared action reader deliberately skips (it treats a link
// in a data table as a row).
function actionOf(el) {
  return {
    label: (textOf(el) || el.getAttribute('value') || '').trim(),
    id: el.getAttribute('id') || '',
    href: el.getAttribute('href') || '',
    js: true,
    onclick: el.getAttribute('onclick') || ''
  };
}

function actionIn(root, re) {
  const el = qsa(root, BUTTONS)
    .find((node) => re.test((textOf(node) || node.getAttribute('value') || '').trim()));
  return el ? actionOf(el) : null;
}

// A control the app's own float bar also prints, with no handler at all. Picking
// it would do nothing and look like a failure, so the one that carries the
// submit wins; the decoy is only used if it is the only one there.
function isReal(el) {
  const handler = (el.getAttribute('onclick') || '').trim();
  return !!handler && !/^void\(0\)/i.test(handler);
}

// The app's own name for the screen, from its URL: `page=NewPayment`,
// `page=EditPayment`. A name is a statement; a button label is presentation.
//
// This existed as a text guess first, and it shipped a bug: an edit of an
// existing payment rendered as a new one, because the mode read "Process
// Payment" vs "Save" and anything else on the screen — the float bar repeats
// some of these controls — could answer for it. The mode decides the title, the
// primary button and whether the splits start open, so being wrong about it is
// wrong three times. The route is read where the app states it; the labels are
// the fallback for a route this code has never seen, and `modeSource` says which
// one answered so a guess is never silent.
const PAYMENT_PAGE = /payment/i;
function modeFromUrl(url) {
  const page = pageName(url);
  if (!page || !PAYMENT_PAGE.test(page)) return null;
  if (/edit/i.test(page)) return 'edit';
  if (/new/i.test(page)) return 'new';
  return null;
}

// Which payment screen this is, and the control that ends it.
function primaryAction(root, url) {
  const find = (re) => {
    const candidates = qsa(root, BUTTONS)
      .filter((el) => re.test((textOf(el) || el.getAttribute('value') || '').trim()));
    return candidates.length ? actionOf(candidates.find(isReal) || candidates[0]) : null;
  };
  const process = find(/^process payment$/i);
  const save = find(/^save$/i);

  const named = modeFromUrl(url);
  if (named) {
    return { mode: named, primary: named === 'edit' ? save : process, source: 'url' };
  }
  if (process) return { mode: 'new', primary: process, source: 'label' };
  if (save) return { mode: 'edit', primary: save, source: 'label' };
  return { mode: 'new', primary: null, source: 'none' };
}

// What only an edit of an existing payment carries: the receipt the app has and
// the allocations behind the figure. Plain links, so they are followed where they
// stand rather than rebuilt.
const EXTRA = /^(print receipt|email receipt|see details)$/i;

function extrasOf(root) {
  const out = [];
  for (const a of qsa(root, 'a[href]')) {
    const label = (textOf(a) || '').trim();
    if (!EXTRA.test(label)) continue;
    const href = a.getAttribute('href') || '';
    if (!href || href === '#' || out.some((x) => x.href === href)) continue;
    out.push({ label, href });
  }
  return out;
}

export function readPayment(doc, url) {
  const root = contentRoot(doc);
  if (!root) return null;

  // The controls this screen draws, kept as nodes as well as fields: coverage is
  // a fact about the page, so it needs the elements rather than the model.
  const shown = [];
  const take = (el) => {
    const field = fieldOf(el, doc);
    if (field) shown.push(el);
    return field;
  };

  const amount = take(qs(root, '[name="amount"]'));
  // Without an amount this is not the payment screen, whatever else it has.
  if (!amount) return null;

  // The declared form classes are `model/regions.js`'s list; `FlexForm` is the
  // payment screen's member of it, so which tables are forms is the shared
  // judgement's. Which of them is this screen's *base* form is the fact the
  // screen states: the one carrying the amount control. This used to re-test the
  // class string here, a second copy of the app vocabulary that would have kept
  // working (wrongly) after the classifier's list changed.
  const baseTable = declaredFormTables(doc, root)
    .find((table) => qs(table, '[name="amount"]')) || null;
  const rows = labelledRows(baseTable);

  const due = take(qs(root, '[name="due_date"]'));
  const deposit = take(qs(root, '[name="deposit_date"]'));
  const notes = take(qs(root, '[name="notes"]'));

  const named = {
    amount: 'Amount',
    due_date: 'Payment date',
    deposit_date: 'Deposit date',
    notes: 'Notes'
  };
  const labelOf = (field) => {
    const row = rows.find((r) => qs(r.cell, '[name="' + field.name + '"]'));
    return (row && row.label) || named[field.name] || '';
  };

  const base = [amount, due, deposit, notes].filter(Boolean);
  for (const field of base) field.label = labelOf(field);

  // One split per `paid_towardN` select, paired with its `split_amtN` amount.
  // The app prints three of these whether you asked for them or not.
  const splits = [];
  const splitFields = [];
  for (const select of qsa(root, 'select[name]')) {
    const found = /^paid_toward(\d+)$/.exec(select.getAttribute('name') || '');
    if (!found) continue;
    const idx = Number(found[1]);
    const amountEl = qs(root, '[name="split_amt' + found[1] + '"]');
    const toward = fieldOf(select, doc, idx);
    const splitAmount = fieldOf(amountEl, doc, idx);
    if (!toward || !splitAmount) continue;
    shown.push(select, amountEl);
    toward.label = 'Paid toward';
    splitAmount.label = 'Amount';
    splits.push({ idx, toward, amount: splitAmount });
    splitFields.push(toward, splitAmount);
  }
  splits.sort((a, b) => a.idx - b.idx);

  const totals = totalsOf(doc);
  if (!splits.length && !totals.length) return null;

  // "Split Payment" is what makes the app draw its split rows: on a fresh page
  // there is not one `paid_toward` select, only this anchor. Pressing it is the
  // only honest way to offer splits, because the rows it builds are the ones the
  // form submits.
  const splitPayment = actionIn(root, /^split payment$/i);

  const familyRow = rowFor(rows, /^family$/i);
  const primary = primaryAction(root, url);
  const editing = primary.mode === 'edit';
  const unread = coverageOf(root, shown);

  return {
    kind: 'payment',
    view: 'payment',
    // The app names both screens, and its name is what the chrome says: an edit
    // keeps the family, the amount and the dates, but not the word "New".
    title: editing ? 'Edit Payment' : 'New Payment',
    mode: primary.mode,
    // 'url' when the app named the screen, 'label' when the words decided,
    // 'none' when neither did. A crawl can ask which pages are being guessed at.
    modeSource: primary.source,
    breadcrumb: breadcrumbOf(doc),
    // Shown, never edited: the family is the page's subject, not one of its inputs.
    family: familyRow ? textOf(familyRow.cell) : '',
    base,
    splits,
    // An amount already in a split means the page arrived mid-split, so the view
    // opens the table rather than hiding it.
    filled: splits.some((s) => Number(String(s.amount.value).replace(/[^0-9.]/g, '')) > 0),
    totals,
    method: methodOf(baseTable),
    // Every editable control, in one list, for diffing and writing back.
    fields: base.concat(splitFields),
    primary: primary.primary,
    addSplit: actionIn(root, /^add another split$/i),
    splitPayment,
    // Only the edit screen has these; a new payment has nothing to receipt yet.
    extras: editing ? extrasOf(root) : [],
    // Controls on the page that this screen does not draw. Empty on both payment
    // shapes measured so far, which is the point: the field is the check.
    ...(unread.length ? { unread } : {}),
    url: ''
  };
}

// Press one of the page's own controls.
//
// This deliberately does not use `clickActionInApp`: that reader skips anything
// inside a table, because a link in a data table is usually a row. This screen
// wraps its whole form — buttons included — in `table.Layout`, so the shared
// filter would report the app's own Process Payment as missing. The buttons are
// found by their word here, and the app's first "Process Payment" is the same
// submit as the second one it also prints.
function press(doc, action) {
  if (!action) return { ok: false, reason: 'no-action' };

  if (action.id) {
    const byId = doc.getElementById(action.id);
    if (byId) {
      byId.click();
      return { ok: true, via: 'id' };
    }
  }

  const matches = qsa(doc, BUTTONS)
    .filter((el) => !(el.closest && el.closest(OWN_ROOT)))
    .filter((el) => ((textOf(el) || el.getAttribute('value') || '').trim() === action.label));
  if (!matches.length) return { ok: false, reason: 'missing' };

  const target = matches.find(isReal) || matches[0];
  target.click();
  return { ok: true, via: matches.length > 1 ? 'first' : 'label' };
}

// Write the edited values and press the app's own Process Payment. Only changes
// are written, so every field this screen does not show keeps what the app sent.
export function runPayment(doc, payment, values) {
  if (!payment) return { ok: false, reason: 'no-payment', applied: [] };

  const changes = diffFields(payment.fields, values);
  const { applied, missing } = applyFields(doc, changes);
  if (missing.length) return { ok: false, reason: 'missing', missing, applied };

  const pressed = press(doc, payment.primary);
  if (!pressed.ok) return { ok: false, reason: pressed.reason, applied };
  return { ok: true, reason: 'ok', applied, via: pressed.via };
}

// Press the app's own Add Another Split, then read the page again: the app is
// what builds the extra row, and its indices are what the form submits. Returns
// the fresh model so the view can draw the row it just caused.
export function addSplitInApp(doc, payment, url) {
  // On a fresh page the app has not drawn a split yet, so the only control is
  // "Split Payment", which builds the first rows; after that it is "Add Another
  // Split". Both are the app's own anchor and both are followed by a re-read.
  const pressed = press(doc, payment && (payment.addSplit || payment.splitPayment));
  if (!pressed.ok) return { ok: false, reason: pressed.reason };

  const next = readPayment(doc, url);
  if (!next) return { ok: false, reason: 'reread' };
  return { ok: true, payment: next, via: pressed.via };
}
