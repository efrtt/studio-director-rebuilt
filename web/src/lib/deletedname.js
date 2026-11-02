// The app's delete answer has no subject.
//
// Measured live on Manage Vendors (2026-11-02), deleting a vendor answers with:
//
//   <td class="Top"><a href="admin.sd?page=ManageVendors&amp;meth=neu"></a> has been deleted.</td>
//
// The anchor that used to hold the record's name is empty — the record is gone,
// so the app has nothing left to print there. Read literally the screen says
// "has been deleted.", which confirms nothing: not what, not which. The name was
// on the question one page earlier ("Are you sure you want to delete testaa?"),
// so it is carried across that navigation, keyed by the page it belongs to. It
// lives in sessionStorage because it is one tab's one flow, and because a reload
// of the answer page should still read properly.

import { labelOf } from './records.js';

const KEY = 'sd.deleted';

function pageOf(href) {
  try {
    return new URL(href || '', 'http://x/').searchParams.get('page') || '';
  } catch (err) {
    return '';
  }
}

// Called where the app asks the question: that page is the last one that knows
// which record the answer will be about.
export function rememberDeleted(href, name) {
  const page = pageOf(href);
  const label = String(name || '').trim();
  if (!page || !label) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ page, name: label }));
  } catch (err) { /* no storage: the sentence keeps the fallback */ }
}

function remembered(href) {
  const page = pageOf(href);
  if (!page) return '';
  try {
    const stored = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    return stored && stored.page === page ? String(stored.name || '') : '';
  } catch (err) {
    return '';
  }
}

const CAPITAL = (text) => {
  const value = String(text || '');
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
};

// Give the subjectless sentence back its subject.
//
// Only the shape that lost one is touched: a message the app states in full
// ("test has been updated.", "It has been dropped.") is left exactly as sent.
// When the name could not be carried — the answer page opened cold, in a new
// tab — the page's own label stands in ("Vendor has been deleted."), which says
// what the app meant without pretending to know which one.
export function confirmSubject(confirm, href) {
  if (!confirm || confirm.pending || !confirm.ok) return confirm;
  const message = String(confirm.message || '').trim();
  if (!/^has been\b/i.test(message)) return confirm;
  const name = remembered(href) || CAPITAL(labelOf(confirm.title));
  if (!name) return confirm;
  return { ...confirm, message: `${name} ${message}` };
}
