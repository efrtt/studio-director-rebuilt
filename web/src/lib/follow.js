// Following the app's record panel to the end of its list.
//
// Confirmed on the live SearchResults page: the panel heading said "2114 Items"
// and the first paint carried 500 rows. A few seconds later the app's own script
// had drawn all 2114 and the "Show All" control was gone — and in between it
// emptied the panel entirely before redrawing it. So neither a single reading nor
// a single press is the list: what is needed is to keep looking until the count
// stops moving, and never to accept a smaller reading than the one already held.
//
// Both rules are here, pure, because the component around them is a timer.

// The wider of two readings of the same panel.
//
// A reading that is shorter is the panel mid-redraw, not news: the list only ever
// grows towards its total. The total is kept from whichever reading knows it, so
// a narrowed panel does not make a 2114-row list claim to be 500 rows long.
export function keepWidest(current, candidate) {
  if (!candidate || !Array.isArray(candidate.items)) return current;
  if (!current || !Array.isArray(current.items)) return candidate;

  const wider = candidate.items.length > current.items.length;
  const knowsTotal = current.total == null && candidate.total != null;

  if (wider) {
    return {
      ...candidate,
      total: candidate.total != null ? candidate.total : current.total
    };
  }
  if (knowsTotal) return { ...current, total: candidate.total };
  // Same size, and the newcomer knows nothing the current one does not: keep the
  // current list so its identity stays stable and the view does not re-render.
  return current;
}

// Has the panel reached the total it announced? The only certain end of the wait.
export function isComplete(list) {
  return !!list && list.total != null && Array.isArray(list.items) && list.items.length >= list.total;
}
