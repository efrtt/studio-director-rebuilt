// The app's own DOM vocabulary, in one place.
//
// Every reader has to recognise the same few things on the page: where the
// screen starts, which element is Save, which links are the rail, which pieces
// are furniture. Those are the app's markup, not ours, and they are the only
// site knowledge left in this project — kept here as named data so a reader
// never carries a selector of its own, and so a change is one edit rather than
// a hunt through fourteen modules. Nothing here is a hostname, a page name or a
// per-site branch: everything else (tables, rows, labels, controls, menus,
// reports) is decided by structure in `model/regions.js`, `model/rows.js`,
// `model/table.js` and `lib/index-page.js`.
//
// A selector earns a place here only when it names something the app itself
// prints and no general rule can find it: the content root, the Save anchor,
// page furniture, the rail, the login block. A new app class goes in this file,
// and every reader that asks sees it.

// The shell. `#mainContent` is the inner screen, `.standardMainContent` the
// wrapper that carries it on older pages.
export const SHELL = '#mainContent, .standardMainContent';

// Where a screen's content starts, in fallback order: the content container,
// then the main panel, then (a print window) the body.
export const CONTENT = '.contentContainer, #mainContent';

// A printed content block, used by the outcome screens the app returns to.
export const CONTENT_BLOCK = '.Content';

// The app's Save link. It is clicked, never reimplemented.
export const SAVE_LINK = '#save';

// The sign-in screen: a form that posts to `login.sd`, or its own container.
export const LOGIN_FORM = 'form#idForm';
export const LOGIN = '.LoginContainer';

// The rail, and the one link shape it prints.
export const RAIL_LINK = '#sideNavBar a.sideNavLink';

// Panels that carry their own reader: a tab, the menu, the button bar, the
// record list, the global search box. A table inside one is that reader's
// content, never the form's.
export const PANELS = '.tabContent, .menu, .ButtonBar, .ButtonArea, .List, #idSearchSpan';

// Navigation and shell furniture: never the screen being read, and never
// something to count as one of its controls. `#sd-root` is this build's own
// overlay, whose buttons carry the same words as the app's.
//
// `NAV` is that set without the breadcrumb, because on an outcome screen the
// breadcrumb is not furniture — it is one of the page's own ways onward, and the
// option list leads with it.
export const NAV = '#sideNavBar, .topBarContainer, .topBar, .copyright, #sd-root';
export const CHROME = NAV + ', .Breadcrumb';

// Page furniture inside the content root: a title, a breadcrumb, a button row.
export const FURNITURE = '.formTitle, .Breadcrumb, .ButtonBar, .ButtonArea, .menu';

// The page's own title, in the order the app uses it.
export const PAGE_TITLE = '.formTitle, .ReportName, h1';

// One record in the app's result panel. Named here because two readers and the
// search route's wait all ask for it, and the panel's vocabulary belongs in one
// place rather than in whichever file needed it first.
export const RESULT_ITEM = '.searchResultItem';

// A subtitle or band above a table.
export const HEADING = '.formTitle, .ReportTableSubtitle, .sectionHeader, .sectionTitle, h2, h3, h4';
