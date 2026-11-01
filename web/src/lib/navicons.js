// The app's own navigation icons, borrowed rather than reinvented.
//
// Live markup, confirmed on the CalendarPage:
//
//   <a class="sideNavLink" href="admin.sd?page=HomePage&clicktab=1">
//     <div class="sideNavItem">
//       <i class="fa-solid fa-house fa-lg"></i>
//       <span class="sideItemText">Home</span>
//       <span class="Tooltip">Home</span>
//     </div>
//   </a>
//
// The <i> is Font Awesome, and the app loads the font on every page, so using the
// same classes costs nothing and the rail matches the original. Keyed by href so
// the rail can look an icon up while rendering the model's own links; a page with
// no icons (a fixture, a print window) simply gets no entries.
export function readNavIcons(root) {
  const out = {};
  if (!root || !root.querySelectorAll) return out;

  for (const anchor of root.querySelectorAll('#sideNavBar a.sideNavLink')) {
    const href = anchor.getAttribute && anchor.getAttribute('href');
    if (!href) continue;

    const icon = anchor.querySelector('i');
    const classes = icon && typeof icon.className === 'string' ? icon.className.trim() : '';
    if (!classes) continue;

    // Only the icon's own classes: Font Awesome's font is what makes them glyphs.
    out[href] = classes;
  }

  return out;
}

// What the rail shows when the page offers no icon: one letter, never nothing.
export function initialOf(label) {
  return String(label || '').trim().charAt(0).toUpperCase();
}
