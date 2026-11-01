// The page an action started from.
//
// After a save the app answers with a bare `admin.sd` page - the URL says nothing
// about where you were. The browser knows: `document.referrer` is the page that
// posted the form (the student's enrollment page, for an enrollment).
//
// Only same-origin referrers are offered, and never the current page: a link back
// into another site, or to itself, is not a way back. Pure, so the rule is tested
// without a browser.

export function backTarget(referrer, here) {
  if (!referrer) return null;

  try {
    const from = new URL(referrer);
    const to = new URL(here || from.href);

    if (from.origin !== to.origin) return null;
    if (from.href === to.href) return null;
    if (!/^https?:$/.test(from.protocol)) return null;

    return { href: from.href, label: 'Back to the page you came from' };
  } catch (e) {
    return null;
  }
}
