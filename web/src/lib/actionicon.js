// Which icon, if any, an action's own words ask for.
//
// The app labels its row controls itself — "Drop" here, "Unenroll" there,
// "Remove" in a ledger — so the shape has to come from the words rather than
// from a column position. A label this cannot place keeps its text: guessing
// would put a tick on something that cancels.
//
// 'edit' | 'drop' | 'done' | ''

const RULES = [
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
