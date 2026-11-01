// Per-view layout, as data rather than as branches.
//
// The question this answers is "how should this page look", and the answer is one
// row per view. Adding a knob here costs a line and a CSS rule, and changing how
// one page lays out is an edit to its row, not a search through `App.svelte`.
//
// The knobs, all optional:
//
//   split    'beside' | 'stack' | 'none'   - where a record list goes, when the
//                                            page carries one. `beside` is the
//                                            editor's history; `stack` puts the
//                                            list above the main pane.
//   width    'contained' | 'wide'          - whether the built-in max widths
//                                            apply (tiles, filters, fields).
//   density  'comfortable' | 'compact'     - row and field padding.
//
// Defaults reproduce today's look exactly: a view absent from the table below
// gets `contained`, `comfortable` and no split, which is what every view but the
// two split ones already had.

export const LAYOUT = {
  // The editor is the one screen with a record list beside it: keeping the list
  // there is how you move from record to record without going back to Classes.
  form: { split: 'beside', width: 'contained' },
  confirm: { split: 'beside', width: 'contained' },
  // Tables and report results need the width; forms and menus read better capped.
  sheet: { width: 'wide' },
  report: { width: 'wide' }
};

export const DEFAULT_LAYOUT = Object.freeze({
  split: 'none',
  width: 'contained',
  density: 'comfortable'
});

// A split only means something when the model carries a list, so `hasList`
// decides it rather than the table alone.
export function layoutFor(view, hasList = false) {
  const row = LAYOUT[view] || {};
  const merged = { ...DEFAULT_LAYOUT, ...row };
  return {
    ...merged,
    split: hasList && merged.split !== 'none' ? merged.split : 'none'
  };
}
