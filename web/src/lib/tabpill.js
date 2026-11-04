// The pill behind the selected tab.
//
// The Wii skin draws the current tab as one glossed key, and a key that
// teleports is the one thing that does not read as a press. So the strip owns a
// single pill: this action measures the label that already carries
// `sd-tab--on` and copies its box onto a `<span>` behind the labels, so CSS can
// animate between the two positions. Nothing here decides what "active" means -
// it watches the class the caller sets, which keeps the component's own markup
// and click handling untouched.
//
// The other themes never give the pill a background, so adding it is invisible
// outside the Wii skin.

export function tabpill(node) {
  const doc = node.ownerDocument;
  const ind = doc.createElement('span');
  ind.className = 'sd-tabind';
  ind.setAttribute('aria-hidden', 'true');
  node.prepend(ind);

  const frame =
    typeof requestAnimationFrame === 'function'
      ? (fn) => requestAnimationFrame(fn)
      : (fn) => setTimeout(fn, 16);
  const cancel =
    typeof cancelAnimationFrame === 'function' ? (id) => cancelAnimationFrame(id) : (id) => clearTimeout(id);

  let ready = false;
  let pending = 0;

  function place() {
    const tab = node.querySelector('.sd-tab--on');
    if (!tab) {
      ind.style.opacity = '0';
      return;
    }
    const box = node.getBoundingClientRect();
    const at = tab.getBoundingClientRect();
    if (!at.width) return;
    ind.style.opacity = '1';
    ind.style.setProperty('--tab-ind-x', `${at.left - box.left - node.clientLeft}px`);
    ind.style.setProperty('--tab-ind-y', `${at.top - box.top - node.clientTop}px`);
    ind.style.setProperty('--tab-ind-w', `${at.width}px`);
    ind.style.setProperty('--tab-ind-h', `${at.height}px`);
    if (!ready) {
      // The first placement is where the pill already belongs. Only a later
      // change moves it, so the transition is switched on one frame after.
      ready = true;
      frame(() => ind.setAttribute('data-ready', '1'));
    }
  }

  function schedule() {
    cancel(pending);
    pending = frame(place);
  }

  // A tab gaining or losing `sd-tab--on` is the event; `style` is left out on
  // purpose, because this action writes the pill's style itself.
  const observers = [];
  if (typeof MutationObserver === 'function') {
    const mo = new MutationObserver(schedule);
    mo.observe(node, { attributes: true, subtree: true, childList: true, attributeFilter: ['class'] });
    observers.push(mo);
  }
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(schedule);
    ro.observe(node);
    observers.push(ro);
  }
  const onWindow = () => schedule();
  node.ownerDocument.defaultView?.addEventListener('resize', onWindow);

  schedule();

  return {
    destroy() {
      cancel(pending);
      for (const o of observers) o.disconnect();
      node.ownerDocument.defaultView?.removeEventListener('resize', onWindow);
      ind.remove();
    }
  };
}
