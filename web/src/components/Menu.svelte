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
    if (onClose) onClose();
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

<div class="sd-menu-screen" role="dialog" aria-modal="true" aria-label="Studio menu" bind:this={screen}>
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
