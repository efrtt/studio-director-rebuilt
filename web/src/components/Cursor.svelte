<script>
  // The skin's pointer. The platform cursor is hidden while this is mounted and
  // this glyph takes its place, tip on the exact pixel the pointer is on, so
  // clicking is unchanged and only the body swings.
  //
  // The element is created here, not written in markup, because it has to be a
  // child of `#sd-root` itself: a `position: fixed` node inside an animated view
  // is measured from that view, which is the bug that put the calendar tooltip
  // below the pointer (see the entrance animation in wii.css).
  import { onMount } from 'svelte';
  import { advance, poseOf, restPose, settled } from '../lib/cursor.js';

  const GLYPH = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
    + '<path d="M2 2 L2 19.4 L6.9 14.8 L10.2 21.5 L13.5 20 L10.2 13.4 L16.9 13.1 Z"/>'
    + '</svg>';

  // After this long at rest the frame loop stops. The glyph stays exactly where it
  // is drawn, so this is a saving and not a state change.
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
    glyph.innerHTML = GLYPH;
    host.appendChild(glyph);
    // Only now: until this glyph exists there would be no pointer at all.
    document.documentElement.classList.add('sd-pointer');

    let target = null;
    let state = null;
    let frame = 0;
    let last = 0;
    let moved = 0;

    function draw() {
      const pose = poseOf(state);
      // Rotated about the tip (its `transform-origin` in wii.css), so the tip stays
      // on the pointer and the body swings around it.
      glyph.style.transform = 'translate3d(' + state.x + 'px, ' + state.y + 'px, 0)'
        + ' rotate(' + pose.tilt + 'deg)'
        + ' scale(' + pose.along + ', ' + pose.across + ')';
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
      if (!state) {
        // First sighting: start on the pointer, so it never flies in from a corner.
        state = restPose(target.x, target.y);
        draw();
      }
      glyph.classList.add('sd-cursor--on');
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    }

    // Out of the window there is no pointer to stand in for, and a glyph left
    // behind would sit where the pointer is not.
    function onOut(event) {
      if (!event.relatedTarget) glyph.classList.remove('sd-cursor--on');
    }

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    document.addEventListener('mouseout', onOut);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      document.removeEventListener('mouseout', onOut);
      document.documentElement.classList.remove('sd-pointer');
      glyph.remove();
    };
  });
</script>
