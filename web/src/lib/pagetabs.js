// The app's own tab strip, read once.
//
// On the Home dashboard the tabs you are not on are anchors
// (`admin.sd?page=HomePage&tab=tab-insights`, `…&tab=tab-trends`) and the one you
// *are* on is a plain `div.selectedTab` with no href at all. Reading only the
// anchors lost the current tab; reading only the divs lost the others.
//
// It used to live in the sheet reader, which is why the dashboard had a strip
// and the Insights and Trends screens did not.

import { textOf, tabStrip } from './shell.js';

export function readPageTabs(doc) {
  const strip = tabStrip(doc);
  if (!strip) return [];

  const tabs = [];
  for (const el of Array.from(strip.children || [])) {
    if (/^(SCRIPT|STYLE|INPUT|SELECT|TABLE)$/.test(el.tagName)) continue;
    const label = textOf(el);
    if (!label) continue;

    const href = el.tagName === 'A' ? el.getAttribute('href') || '' : '';
    const selected = /(^|\s)(selectedTab|selected|active)(\s|$)/i.test(el.getAttribute('class') || '');
    // A tab with neither a destination nor the current marker is decoration.
    if (!href && !selected) continue;

    tabs.push({ label, href, selected });
  }

  // Two tabs make a strip; one tab is the page saying where you are.
  return tabs.length > 1 ? tabs : [];
}
