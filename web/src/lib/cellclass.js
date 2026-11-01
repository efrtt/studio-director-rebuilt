// What a table cell is, for the purpose of styling it.
//
// The app draws both kinds of cell the same way — a bare `<a>` — but they are not
// the same thing. A link goes somewhere (a class, a student, a charge); a control
// acts on the row it sits in (Drop, Approve, Enroll) and the app draws it as
// `href="#"` with an onclick, or as `javascript:`. Reading a control as a link
// made the ledger's action column look like more prose.
//
// The model already distinguishes the cases it can (`cell.href`, and `cell.actions`
// when a cell holds several controls); this turns that into one answer the three
// table renderers share, rather than each repeating a regex.

const ACTION = /^(#|javascript:)/i;

export function isActionHref(href) {
  return !!href && ACTION.test(String(href).trim());
}

// 'action' | 'link' | null
export function cellKind(cell) {
  if (!cell || !cell.href) return null;
  return isActionHref(cell.href) ? 'action' : 'link';
}
