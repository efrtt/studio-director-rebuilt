// Which icon, if any, an action's own words ask for.
//
// The app labels its row controls itself — "Drop" here, "Unenroll" there,
// "Remove" in a ledger — so the shape has to come from the words rather than
// from a column position. A label this cannot place keeps its text: guessing
// would put a tick on something that cancels.
//
// 'dates' | 'attendance' | 'edit' | 'drop' | 'done' | ''
//
// The first two come before the verbs on purpose. A student's enrollment row is
// "Edit Enroll Dates", "Edit Attendance", "Drop", and the first two would both
// match `edit` and draw the same pencil — two controls that look identical next
// to each other. What tells them apart is not the verb but the record they open,
// so the record is the shape. Every other "Edit …" the app prints keeps the
// pencil.

const RULES = [
  // The dates of an enrollment, and its attendance, are two different records.
  ['dates', /\benroll(?:ment)?\s*dates?\b/i],
  ['attendance', /\battendance\b/i],
  ['done', /^(enroll|approve|accept|confirm|complete|add|save|activate)\b/i],
  ['drop', /^(drop|unenroll|remove|delete|withdraw|cancel|decline|deactivate)\b/i],
  ['edit', /^(edit|change|modify|update|manage|adjust)\b/i]
];

export function actionIcon(label) {
  const text = String(label == null ? '' : label).trim();
  if (!text) return '';
  for (const [icon, test] of RULES) {
    if (test.test(text)) return icon;
  }
  return '';
}
