// The app's global search, driven from our own header.
//
// Search on that site looks through every field of every record type — family
// names, student names, phone numbers, emails, logins — server-side. None of
// that is in the HTML we read: the record panel carries labels only. So the
// rebuilt UI does not reimplement the search; it types into the app's own search
// box and lets its results page come back through the normal mount path.
//
// One action per press, never two: a search button is what a person would click;
// without one, the box's form is submitted; without a form, Enter is dispatched.

// Query parameters the app might use for a search, for prefilling the box after
// the results page loads. Only a prefill — nothing is built from these.
const QUERY_PARAMS = ['searchtext', 'searchstring', 'search', 'query', 'q', 'name', 'keyword'];

export function appSearchBox(root) {
  return root ? root.querySelector('.searchBox') : null;
}

export function appSearchInput(root) {
  const box = appSearchBox(root);
  if (!box) return null;
  return box.querySelector('input[type="search"], input[type="text"], input');
}

// The app writes `searchText`, but the casing is the app's habit, not a
// guarantee, so parameters are matched without it.
export function queryFromUrl(href) {
  try {
    const params = new URL(href, 'http://x/').searchParams;
    for (const [key, value] of params) {
      if (!QUERY_PARAMS.includes(String(key).toLowerCase())) continue;
      if (value && value.trim()) return value.trim();
    }
  } catch (e) { /* not a url */ }
  return '';
}

// Events are built from the element's own document: a `new Event` from another
// realm cannot be dispatched in this one (the app page, or linkedom in tests).
function fire(el, type) {
  const doc = el.ownerDocument;
  if (doc && typeof doc.createEvent === 'function') {
    const ev = doc.createEvent('Event');
    if (ev && typeof ev.initEvent === 'function') {
      ev.initEvent(type, true, false);
      el.dispatchEvent(ev);
      return;
    }
  }
  el.dispatchEvent(new Event(type, { bubbles: true }));
}

export function runSearch(root, rawQuery) {
  const query = String(rawQuery == null ? '' : rawQuery).trim();
  if (!query) return { submitted: false, reason: 'empty' };

  const box = appSearchBox(root);
  const input = appSearchInput(root);
  if (!box || !input) return { submitted: false, reason: 'no-box' };

  input.value = query;
  fire(input, 'input');
  fire(input, 'change');

  // 1. The app's own search button, if the box has one.
  const button = box.querySelector('button, input[type="submit"], input[type="image"]');
  if (button) {
    button.click();
    return { submitted: true, via: 'button', query };
  }

  // 2. The box's own form — but never the app's page form. On a record page the
  //    search box can sit inside `form#idForm`, and submitting that would re-post
  //    the editor (with `#idPage`/`#idMeth`) instead of searching. A form that
  //    carries those markers is left alone; Enter is tried below instead.
  const form = input.form || (input.closest && input.closest('form'));
  const pageForm = !!(form && (form.querySelector('#idPage, #idMeth, #idMethArgs')));
  if (form && !pageForm && typeof form.requestSubmit === 'function') {
    try {
      form.requestSubmit();
      return { submitted: true, via: 'form', query };
    } catch (e) { /* fall through to Enter */ }
  }

  // 3. A box the app submits from its own keydown handler.
  const fields = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
  let sent = 0;
  for (const type of ['keydown', 'keypress', 'keyup']) {
    const ev = keyEvent(input.ownerDocument, type, fields);
    if (!ev) break;
    try {
      input.dispatchEvent(ev);
      sent += 1;
    } catch (e) { /* a realm that refuses it: try nothing else */ }
  }

  return sent
    ? { submitted: true, via: 'enter', query }
    : { submitted: false, reason: 'no-search' };
}

// A KeyboardEvent in a realm that has one, and an equivalent Event carrying the
// same fields in a realm that does not (test DOM), so `e.key === 'Enter'` works
// either way.
function keyEvent(doc, type, fields) {
  try {
    if (typeof KeyboardEvent === 'function') return new KeyboardEvent(type, fields);
  } catch (e) { /* fall through */ }

  const ev = doc && typeof doc.createEvent === 'function' ? doc.createEvent('Event') : null;
  if (!ev) return null;
  ev.initEvent(type, true, true);
  for (const [name, value] of Object.entries(fields)) {
    try { Object.defineProperty(ev, name, { value, configurable: true }); } catch (e) { /* read-only */ }
  }
  return ev;
}
