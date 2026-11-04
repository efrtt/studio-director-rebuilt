<script>
  import { onMount, onDestroy } from 'svelte';
  import { formatClock, formatMenuDate } from '../lib/clock.js';
  import { isActiveHref } from '../lib/activelink.js';
  import { initialOf } from '../lib/navicons.js';

  // The Wii's front end: one screen of channels, the clock, and the two round
  // buttons at the bottom. Every channel is one of the app's own nav links, so
  // this is a second rendering of the rail's model, not a second navigation.
  export let nav = [];
  export let icons = null;
  export let current = '';
  export let onClose = null;

  // The screen drops in from above the top edge, fading as it falls, and leaves
  // the same way. The two states are one class apart (`.sd-menu--offscreen`, in
  // wii.css) so the browser's transition runs either way - in when the class is
  // taken off on the first frame, out when it is put back before closing. A CSS
  // animation could only ever play forwards, and the exit has to be the entrance
  // run backwards. Only the Wii skin has it, and a reader who asked for less
  // motion gets the screen with no fall at all.
  const wii = typeof document !== 'undefined' && document.documentElement.getAttribute('data-sd-theme') === 'wii';
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Must match the transition in wii.css: the screen is gone once it has finished
  // travelling, not before.
  const FALL = 300;
  const animated = wii && !still;
  let offscreen = animated;
  let leaving = false;

  let clock = formatClock();
  let date = formatMenuDate();
  let timer = null;
  let screen = null;

  onMount(() => {
    timer = setInterval(() => {
      const now = new Date();
      clock = formatClock(now);
      date = formatMenuDate(now);
    }, 15000);
    // Open with the pointer's first target already focused: the Menu is keyboard
    // navigable from the moment it appears.
    const first = screen && screen.querySelector('.sd-channel');
    if (first) first.focus();
    // It is painted off-screen for one frame, so there is a state to travel from.
    // Reading the layout commits that frame; taking the class off on the next one
    // is what starts the fall. A background tab runs no frames, so a timer lifts
    // it as well - the screen comes in either way, just without the travel.
    return () => clearInterval(timer);
  });

  onDestroy(() => {
    if (timer) clearInterval(timer);
  });

  // A real Menu is mostly white channels with a few in colour, so the colour is
  // an accent that walks the grid rather than a theme per section.
  const TONES = ['plain', 'blue', 'plain', 'green', 'plain', 'aqua', 'plain', 'orange'];
  const toneOf = (i) => TONES[i % TONES.length];

  function isActive(link) {
    return isActiveHref(current || location.href, link.href, location.origin);
  }

  function close() {
    if (leaving) return;
    if (!animated) {
      if (onClose) onClose();
      return;
    }
    // Send it back up the way it came, then close for real.
    leaving = true;
    offscreen = true;
    setTimeout(() => {
      if (onClose) onClose();
    }, FALL);
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  }
</script>

<svelte:window on:keydown={onKey} />

<div
  class="sd-menu-screen"
  class:sd-menu--offscreen={offscreen}
  role="dialog"
  aria-modal="true"
  aria-label="Studio menu"
  bind:this={screen}
>
  <div class="sd-menu-grid">
    {#each nav as link, i}
      <a
        class="sd-channel sd-channel--{toneOf(i)}"
        class:sd-channel--on={isActive(link)}
        href={link.href}
        title={link.label}
        aria-current={isActive(link) ? 'page' : undefined}
      >
        {#if icons && icons[link.href]}
          <i class="sd-channel-icon {icons[link.href]}" aria-hidden="true"></i>
        {:else}
          <span class="sd-channel-initial" aria-hidden="true">{initialOf(link.label)}</span>
        {/if}
        <span class="sd-channel-name">{link.label}</span>
      </a>
    {/each}
  </div>

  <div class="sd-menu-bar">
    <button class="sd-menu-round" type="button" on:click={close} title="Back to the page" aria-label="Back to the page">
      <span class="sd-menu-wii" aria-hidden="true">Wii</span>
    </button>

    <div class="sd-menu-clock">
      <span class="sd-menu-time">
        {clock.time}{#if clock.meridiem}<span class="sd-menu-meridiem">{clock.meridiem}</span>{/if}
      </span>
      <span class="sd-menu-date">{date}</span>
    </div>

    <button class="sd-menu-round sd-menu-round--close" type="button" on:click={close} title="Close the menu" aria-label="Close the menu">
      <span class="sd-menu-cross" aria-hidden="true">✕</span>
    </button>
  </div>
</div>
