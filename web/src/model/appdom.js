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

// Where a screen's content starts, as a priority ladder rather than one selector
// list: the content container, then the main panel, then the printed `.Content`
// block, and — for a print window, which has none of them — the document body.
// The order is data here and resolved in one place (`model/root.js`), because a
// comma-separated selector would return whichever came first in the document
// rather than the most specific root.
export const CONTENT_ROOTS = ['.contentContainer', '#mainContent', '.Content'];

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

// The page's own title, in the order the app uses it: the named div, the report
// header, then a bare heading. `lib/shell.js#titleOf` reads it, and no reader
// carries the list itself.
export const PAGE_TITLE = '.formTitle, .ReportName, h1';

// The title div and nothing else. A record editor, a record list and a notice
// name themselves in the div, and a heading deeper in the content belongs to
// that content rather than to the page: asking for it would let a section's
// `<h1>` become the screen's name.
export const TITLE_DIV = '.formTitle';

// The title div, or a bare heading when the app prints no div. The dashboard's
// cards and the settings card draw their name as a heading and never print a
// report header, so this is a different fact about the page rather than a
// preference: a reader that takes it must not be handed `.ReportName` and read
// a neighbour's header as its own name.
export const TITLE_DIV_OR_H1 = '.formTitle, h1';

// The report header on its own. A report names itself here and a reader has to
// be able to ask for exactly that: the fallback title is the div, which a report
// page may print for something else. The notice reader also strips it (and the
// div) out of the page's prose, so both are named once and used twice.
export const TITLE_REPORT = '.ReportName';

// The title readings a reader may ask for, by name. `shell.titleOf` is the only
// consumer of these selectors: a reader says which title it means (`'div'`,
// `'heading'`, `'report'`) and never carries a selector of its own, so a new
// shape is one entry here rather than a new call site everywhere.
export const TITLES = {
  page: PAGE_TITLE,
  div: TITLE_DIV,
  heading: TITLE_DIV_OR_H1,
  report: TITLE_REPORT
};

// A subtitle or band above a table.
export const HEADING = '.formTitle, .ReportTableSubtitle, .sectionHeader, .sectionTitle, h2, h3, h4';

// A block the app prints *inside* a content root: the way around a calendar, a
// report's own controls, a notice's instruction. It is a block of the page, not a
// candidate root — that ladder is `CONTENT_ROOTS` above.
export const CONTENT_INFO = '.contentInfo';

// The breadcrumb, and the links it is read through: `lib/shell.js#breadcrumbOf`
// reads it, so no reader carries the selector itself.
export const BREADCRUMB = '.Breadcrumb';
export const BREADCRUMB_LINK = BREADCRUMB + ' a';

// A report prints its own name in this crumb, ahead of the run timestamp.
export const REPORT_CRUMB = '.ReportBreadcrumb';

// The app's tab panel. A table inside one belongs to the tab, not to the page.
export const TAB_PANEL = '.tabContent';

// The strip that owns those panels. Both tab readers ask `shell.tabStrip` for
// it, so neither carries the selector or searches the document on its own.
export const TAB_STRIP = '.tabContainer';

// The record list's panel, its rows, its heading and the filter bar above it.
// `RESULT_PANEL` is what a `.closest()` may ask for both wrappers at once; the
// two names are also kept apart, because a page can print one inside the other
// and the readers that walk up deliberately ask for them in that order.
export const RESULT_LIST_CLASS = 'searchResultList';
export const RESULT_ITEM = '.searchResultItem';
export const RESULT_LABEL = '.searchResultLabel';
export const RESULT_BAR = '.searchResultBar';
export const RESULT_PANEL_CLASS = '.searchResultPanel';
export const SEARCH_SPAN = '#idSearchSpan';
export const RESULT_LIST = '.' + RESULT_LIST_CLASS;
export const RESULT_PANEL = RESULT_PANEL_CLASS + ', ' + SEARCH_SPAN;

// This build's own overlay. Never page evidence: a reader that scopes a walk, a
// table list or a control count to the page excludes it by this one name.
export const OWN_ROOT = '#sd-root';

// The class names a table carries when the page itself says it is a form. A new
// app class is added here and every reader that asks sees it.
export const FORM_CLASSES = ['Form', 'FormEx', 'FlexForm'];

// The classes the app puts on a calendar grid, by what the grid is. `form` is the
// weekday tick-box grid, which is a form's control rather than a calendar.
export const GRID_CLASSES = {
  month: 'MonthCal',
  week: 'WeekCal',
  day: 'TimeBlock',
  form: 'WeekdayCheckboxes'
};

// The app's own buttons: `a.Btn`, `a.BtnOutln`, and the `div.Btn` its own script
// drives. Named once because "is this one of the app's buttons" is asked by the
// confirmation, the note, the report, the payment reader and the press helper.
export const BUTTON = '.Btn';
export const BUTTON_OUTLINE = '.BtnOutln';
export const BUTTONS = BUTTON + ', ' + BUTTON_OUTLINE;

// The table the app prints a report's output in.
export const REPORT_TABLE_CLASS = 'ReportTable';
export const REPORT_TABLE = '.' + REPORT_TABLE_CLASS;

// The class attribute's words, and the trimmed attribute itself: the two forms
// the app's own tests are written against (a word inside a list, or the whole
// attribute).
export function classWords(el) {
  return String((el && el.getAttribute && el.getAttribute('class')) || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

// Does the page say this table is one of its forms?
export function declaredForm(el) {
  return classWords(el).some((word) => FORM_CLASSES.some((name) => name.toLowerCase() === word.toLowerCase()));
}

// Which calendar grid the app's own class says this table is, if any. The test is
// the whole class attribute, exactly as the app writes it (`class="MonthCal"`).
export function gridClassOf(el) {
  const cls = String((el && el.getAttribute && el.getAttribute('class')) || '').trim().toLowerCase();
  for (const [kind, name] of Object.entries(GRID_CLASSES)) {
    if (cls === name.toLowerCase()) return kind;
  }
  return '';
}

// Is this element the table the app prints a report in, or inside one?
export function inReportTable(el) {
  if (!el) return false;
  if (classWords(el).some((word) => word.toLowerCase() === REPORT_TABLE_CLASS.toLowerCase())) return true;
  return !!(el.closest && el.closest(REPORT_TABLE));
}
