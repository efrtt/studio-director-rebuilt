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
    const fitted = new Map();

    function fit(svg, centred) {
      const box = svg.getBoundingClientRect();
      // The tip is the topmost painted thing: everything else hangs below it. Taking
      // that one path, rather than the union, keeps the hand's left edge from dragging
      // the hotspot sideways off the point you are aiming with.
      let tip = null;
      let left = Infinity;
      let right = -Infinity;
      for (const path of svg.querySelectorAll('path')) {
        const style = getComputedStyle(path);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const rect = path.getBoundingClientRect();
        if (!rect.width && !rect.height) continue;
        left = Math.min(left, rect.left);
        right = Math.max(right, rect.right);
        if (!tip || rect.top < tip.top - 0.5
          || (Math.abs(rect.top - tip.top) <= 0.5 && rect.left < tip.left)) {
          tip = { top: rect.top, left: rect.left };
        }
      }
      if (!tip) return;
      // The pointing sprites hang to the right of their tip, so their own top-left is
      // the hotspot. The fist is a closed shape and is centred instead — hanging it off
      // its fingertip threw the whole hand to the right of the pointer. Its y still
      // starts at the topmost edge, so the vertical position is unchanged.
      const x = centred ? (left + right) / 2 : tip.left;
      svg.style.transformOrigin = '0 0';
      svg.style.transform = 'translate(' + (box.left - x) + 'px, '
        + (box.top - tip.top) + 'px)';
    }

    function show(kind) {
      const markup = fitted.get(kind);
      if (markup) {
        if (glyph.dataset.sprite !== kind) {
          glyph.innerHTML = markup;
          glyph.dataset.sprite = kind;
        }
        return;
      }
      // Measure level: a rotated box's axis-aligned bounds are wider than the glyph
      // and 4px higher than its tip, so fitting while leaning bakes in the error.
      // The `draw()` that follows every `show()` puts the lean back in the same task,
      // so nothing is painted in between.
      glyph.style.transform = 'translate3d(0px, 0px, 0px)';
      glyph.innerHTML = SPRITES[kind];
      const svg = glyph.querySelector('svg');
      if (!svg) return;
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.style.overflow = 'visible';
      fit(svg, kind === 'holding');
      fitted.set(kind, glyph.innerHTML);
      glyph.dataset.sprite = kind;
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
