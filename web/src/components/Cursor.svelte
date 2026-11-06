<script>
  // The skin's pointer. The platform cursor is hidden while this is mounted and
  // the glyph takes its place, drawn exactly where the mouse is so a click lands on
  // the picture of its tip; only the rotation lags, which is where the weight is.
  //
  // The element is created here, not written in markup, because it has to be a
  // child of `#sd-root` itself: a `position: fixed` node inside an animated view is
  // measured from that view, which is the bug that put the calendar tooltip below
  // the pointer (see the entrance animation in wii.css).
  import { onMount } from 'svelte';
  import { advance, poseOf, restPose, settled } from '../lib/cursor.js';
  import pointer from '../cursors/PointerP1.svg?raw';
  import over from '../cursors/PointerP1-highlight.svg?raw';
  import holding from '../cursors/HandClosedP1.svg?raw';

  // Resting on the page, over something you can click, and with the button held.
  const SPRITES = { pointer, over, holding };

  // Something the app would draw a hand over, if it were drawing its own cursor.
  const INTERACTIVE = 'a, button, input, select, textarea, summary, label, [role="button"], [onclick]';

  // How long the outgoing hand is squeezed before the cross-over. It is deliberately a
  // little longer than the out-animation in wii.css (55ms): the squeezed pose needs a
  // frame of its own, or the swap cuts it before it is ever painted and the hand
  // appears to change with no transition at all.
  const SQUEEZE_MS = 65;

  // How long the incoming hand takes to settle. A swap younger than this is not
  // squeezed away again: the fist that has just landed hands straight back.
  const SETTLE_MS = 85;

  const IDLE_AFTER = 900;

  onMount(() => {
    // Reduced motion keeps the platform's own pointer, untouched. So does a touch
    // or pen device, which has no hover cursor to replace.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!matchMedia('(pointer: fine)').matches) return;

    const host = document.getElementById('sd-root') || document.body;
    const glyph = document.createElement('div');
    glyph.className = 'sd-cursor';
    glyph.setAttribute('aria-hidden', 'true');
    host.appendChild(glyph);
    // Only now: until this glyph exists there would be no pointer at all.
    document.documentElement.classList.add('sd-pointer');

    // Each sprite is fitted once, then cached as markup with the fit baked in: the
    // painted top-left becomes the element's own corner, so `transform-origin: 0 0`
    // *is* the tip and the rotation happens about the pixel you are pointing with.
    // One animation at a time per wrapper: every one of these writes `transform`, and
    // a class left over from the last swap would be replayed by the next one, leaving
    // two animations fighting over the same element.
    const SWAP_CLASSES = ['sd-cursor-pop', 'sd-cursor-in--stretch', 'sd-cursor-in--squash',
      'sd-cursor-out--stretch', 'sd-cursor-out--squash'];

    function play(el, name) {
      el.classList.remove(...SWAP_CLASSES);
      // Forcing a style read restarts an animation the element already ran.
      void el.offsetWidth;
      el.classList.add(name);
    }

    const fitted = new Map();

    // One canvas, and a shared hotspot sideways only. Measuring the x offset per sprite
    // was the browser bug: the topmost painted path is not the same one in all three files
    // (the closed hand's finger line is shorter), so Chrome and Firefox expanded the two
    // by different stroke amounts and the change of hand slid sideways. One x measurement
    // for the whole set, taken from the first sprite to have a size, removes that.
    //
    // The y offset stays per sprite, because it is what puts each hand's top on the point:
    // a shared y would hang the closed hand below the cursor, its shorter finger line no
    // longer reaching the origin. It is measured once per sprite here, and the cached
    // markup carries it, so a swap still costs nothing.
    //
    // Returns false when nothing could be measured (the glyph can be inserted before the
    // stylesheet gives it a size), so the caller does not cache an unfitted sprite.
    let sharedX = null;

    function fit(svg) {
      const box = svg.getBoundingClientRect();
      // The tip is the topmost painted thing: taking that one path, rather than the union
      // of the artwork, keeps the hand's left edge from dragging the hotspot off the point
      // you are aiming with.
      let tip = null;
      for (const path of svg.querySelectorAll('path')) {
        const style = getComputedStyle(path);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const rect = path.getBoundingClientRect();
        if (!rect.width && !rect.height) continue;
        if (!tip || rect.top < tip.top - 0.5
          || (Math.abs(rect.top - tip.top) <= 0.5 && rect.left < tip.left)) {
          tip = { top: rect.top, left: rect.left };
        }
      }
      if (!tip) return false;
      if (sharedX === null) sharedX = box.left - tip.left;
      svg.style.transformOrigin = '0 0';
      svg.style.transform = 'translate(' + sharedX + 'px, ' + (box.top - tip.top) + 'px)';
      return true;
    }

    // The two pictures never share the screen. Changing hand is: squeeze the one that
    // is already there, cross over, then the other lands pulled out of shape and
    // settles into it. The squeeze is short enough to be felt rather than waited for.
    let pending = 0;
    let want = null;
    let swappedAt = 0;

    // Writes a sprite in and hands back its wrapper. The fit is measured level: a
    // rotated box's axis-aligned bounds are wider than the glyph and 4px higher than
    // its tip, so fitting while leaning bakes in the error. The `draw()` that follows
    // every `show()` puts the lean back in the same task.
    function cross(kind) {
      let markup = fitted.get(kind);
      if (!markup) {
        glyph.style.transform = 'translate3d(0px, 0px, 0px)';
        glyph.innerHTML = '<span class="sd-cursor-sprite">' + SPRITES[kind] + '</span>';
        const svg = glyph.querySelector('svg');
        if (!svg) return null;
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.overflow = 'visible';
        const measured = fit(svg);
        markup = glyph.innerHTML;
        if (measured) fitted.set(kind, markup);
      }
      glyph.innerHTML = markup;
      glyph.dataset.sprite = kind;
      swappedAt = performance.now();
      return glyph.firstElementChild;
    }

    function show(kind) {
      // Whatever the page wants now. A squeeze in flight crosses over to this, never to
      // the state that started it, so a click released mid-squeeze lands on the hand
      // that is under the pointer and the fist is never left behind.
      want = kind;
      const current = glyph.dataset.sprite;
      if (kind === current || !current) {
        // Back where it started: drop the squeeze, no swap.
        if (pending) {
          clearTimeout(pending);
          pending = 0;
          const busy = glyph.firstElementChild;
          if (busy) busy.classList.remove(...SWAP_CLASSES);
        }
        if (!current) cross(kind);
        return;
      }
      const shape = (current === 'holding') !== (kind === 'holding');
      if (!shape) {
        if (pending) {
          clearTimeout(pending);
          pending = 0;
          const busy = glyph.firstElementChild;
          if (busy) busy.classList.remove(...SWAP_CLASSES);
        }
        const wrap = cross(kind);
        if (wrap) play(wrap, 'sd-cursor-pop');
        return;
      }
      if (pending) return;
      // A fist that has only just landed is not worth squeezing back out: a quick click
      // gets the pointing hand straight away instead of waiting out another squeeze.
      // Only the way out of the fist is ever shortened. A press right after a hover
      // change must still squeeze, or pointing at a link and clicking straight away
      // swaps to the fist with no transition at all — which is most presses.
      const fresh = current === 'holding' && performance.now() - swappedAt < SETTLE_MS;
      const out = glyph.firstElementChild;
      if (!out || fresh) {
        const wrap = cross(kind);
        if (wrap) play(wrap, kind === 'holding' ? 'sd-cursor-in--stretch' : 'sd-cursor-in--squash');
        return;
      }
      play(out, current === 'holding' ? 'sd-cursor-out--stretch' : 'sd-cursor-out--squash');
      pending = setTimeout(() => {
        pending = 0;
        const next = want;
        if (!next || next === glyph.dataset.sprite) return;
        const wrap = cross(next);
        if (wrap) play(wrap, next === 'holding' ? 'sd-cursor-in--stretch' : 'sd-cursor-in--squash');
      }, SQUEEZE_MS);
    }

    let target = null;
    let state = null;
    let frame = 0;
    let last = 0;
    let moved = 0;
    let kind = 'pointer';

    function pick(x, y) {
      const under = document.elementFromPoint(x, y);
      return under && under.closest && under.closest(INTERACTIVE) ? 'over' : 'pointer';
    }

    function draw() {
      glyph.style.transform = 'translate3d(' + state.x + 'px, ' + state.y + 'px, 0)'
        + ' rotate(' + poseOf(state).tilt + 'deg)';
    }

    function tick(now) {
      state = advance(state, target, (now - last) / 1000);
      last = now;
      draw();
      if (now - moved > IDLE_AFTER && settled(state, target, 0.5)) {
        frame = 0;
        return;
      }
      frame = requestAnimationFrame(tick);
    }

    function onMove(event) {
      target = { x: event.clientX, y: event.clientY };
      moved = performance.now();
      // `buttons` is the truth about whether something is held: a release outside
      // the window never delivers a pointerup, and a stuck closed hand would be a
      // cursor that lies about the state of the page.
      const next = event.buttons ? 'holding' : pick(event.clientX, event.clientY);
      if (next !== kind) {
        // A context change is not a move: start the new sprite level, so the swap
        // does not read as a jump in the lean.
        kind = next;
        state = null;
      }
      show(kind);
      if (!state) {
        // First sighting: stand on the pointer, so it never flies in from a corner.
        state = restPose(target.x, target.y);
        draw();
      }
      glyph.classList.add('sd-cursor--on');
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    }

    function onDown(event) {
      kind = 'holding';
      target = { x: event.clientX, y: event.clientY };
      moved = performance.now();
      show(kind);
      state = restPose(target.x, target.y);
      draw();
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    }

    // Released: back to whatever is under the pointer, level.
    function onUp(event) {
      kind = pick(event.clientX, event.clientY);
      target = { x: event.clientX, y: event.clientY };
      moved = performance.now();
      show(kind);
      state = restPose(target.x, target.y);
      draw();
    }

    // Out of the window there is no pointer to stand in for, and a glyph left
    // behind would sit where the pointer is not.
    function onOut(event) {
      if (!event.relatedTarget) glyph.classList.remove('sd-cursor--on');
    }

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onUp, { passive: true });
    document.addEventListener('mouseout', onOut);

    return () => {
      clearTimeout(pending);
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.removeEventListener('mouseout', onOut);
      document.documentElement.classList.remove('sd-pointer');
      glyph.remove();
    };
  });
</script>
