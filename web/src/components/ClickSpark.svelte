<script>
  // The game's click acknowledgement, on the app's own clicks.
  //
  // Three decisions are in here, and each of them is about not disturbing the page
  // the artefact is injected into:
  //
  // - it listens on `pointerdown` in the capture phase, and never calls
  //   `preventDefault` or `stopPropagation`: the app's own handler still runs, and
  //   the click still does what it did before the theme existed;
  // - it only draws when the OSRS theme is the one on, checked at the moment of the
  //   click rather than at mount, so cycling the theme does not need a re-mount;
  // - the spark is a decorative span with `pointer-events: none` in a layer that
  //   has the same, so nothing it draws can be clicked, hovered or focused.
  //
  // It lives inside `#sd-root`, which is the fixed full-viewport shell, so a spark
  // positioned at the pointer's client coordinates lands where the pointer was.

  import { onMount, onDestroy } from 'svelte';
  import { SPARK_SVG } from '../lib/spark.js';

  let layer = null;
  // Three frames of 120ms; the node outlives the animation by a little so the last
  // frame gets its full turn, then it is removed - which is how the sprite leaves.
  const LIFE = 410;

  function sparkAt(x, y) {
    if (!layer) return;
    const dot = document.createElement('span');
    dot.className = 'sd-spark';
    dot.setAttribute('aria-hidden', 'true');
    dot.style.left = x + 'px';
    dot.style.top = y + 'px';
    dot.innerHTML = SPARK_SVG;
    layer.appendChild(dot);
    setTimeout(() => dot.remove(), LIFE);
  }

  function onPointerDown(event) {
    if (document.documentElement.getAttribute('data-sd-theme') !== 'osrs') return;
    if (event.button !== undefined && event.button !== 0) return;
    const target = event.target;
    if (!target || !target.closest || !target.closest('#sd-root .sd-main')) return;
    sparkAt(event.clientX, event.clientY);
  }

  onMount(() => {
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  });

  onDestroy(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('pointerdown', onPointerDown, true);
    }
  });
</script>

<div class="sd-sparklayer" bind:this={layer} aria-hidden="true"></div>
