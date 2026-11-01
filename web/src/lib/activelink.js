// Which rail link is the page you are on.
//
// Measured on the live app: every nav link carries the same `clicktab=1`
// (`admin.sd?page=NewClass&clicktab=1`, `admin.sd?page=AdminHome&clicktab=1`, …).
// The parameter is a tab *index*, not a tab name. Comparing it as a name marked
// all eleven links active at once, and each one drew the active fill — which is
// what read as "every nav item is a bordered box" on most pages. Edit pages
// looked right only because they were not reached through the app's nav at all.
//
// So: a numeric clicktab is not a name. Only a word-like clicktab identifies a
// section; otherwise the page name decides, which gives exactly one winner.

function tabNameOf(url) {
  const raw = url.searchParams.get('clicktab');
  if (!raw) return null;
  const value = raw.trim();
  if (!value || /^\d+$/.test(value)) return null;
  return value.toLowerCase();
}

function pageOf(url) {
  return (url.searchParams.get('page') || '').trim().toLowerCase();
}

export function isActiveHref(currentUrl, linkHref, base) {
  try {
    const here = new URL(currentUrl || '', base || 'http://x/');
    const there = new URL(linkHref || '', base || here.origin || 'http://x/');

    const mine = tabNameOf(here);
    const theirs = tabNameOf(there);
    if (mine && theirs) return mine === theirs;

    const page = pageOf(here);
    return !!page && page === pageOf(there);
  } catch (e) {
    return false;
  }
}
