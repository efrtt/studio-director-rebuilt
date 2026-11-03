// A table heading that names the column the controls are in.
//
// "Actions" tells you nothing the cells below do not already say with their
// shape, and it costs the widest column in the sheet. The word stays in the
// markup for a screen reader; only the ink goes away.
export function isActionHeading(heading) {
  return /^\s*actions?\s*$/i.test(String(heading == null ? '' : heading));
}
