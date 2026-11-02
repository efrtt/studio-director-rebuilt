<script>
  // The accent choice, as a swatch button with a small menu.
  //
  // A picker rather than a cycle: the theme button cycles because there are four
  // named schemes and you can read the name on the button, but six colours shown
  // only as a word would need reading before choosing. A dot says it.
  import { ACCENTS, ACCENT_LABEL, ACCENT_SWATCH } from '../lib/accent.js';

  export let accent = 'blue';
  export let onPick = null;

  let open = false;
  let wrap = null;

  function choose(name) {
    open = false;
    if (name !== accent && onPick) onPick(name);
  }

  // Escape closes the menu without reaching the shell, where Escape opens the
  // app's own page underneath.
  function onKey(e) {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      open = false;
    }
  }

  // A click anywhere else closes it: the menu is a popover, not a mode.
  function onWindowClick(e) {
    if (!open) return;
    if (wrap && e.target instanceof Node && wrap.contains(e.target)) return;
    open = false;
  }
</script>

<svelte:window on:click={onWindowClick} />

<div class="sd-accwrap" bind:this={wrap} on:keydown={onKey}>
  <button
    class="sd-btn sd-accbtn"
    type="button"
    aria-haspopup="true"
    aria-expanded={open}
    title="Accent colour: {ACCENT_LABEL[accent]}"
    on:click={() => (open = !open)}
  >
    <span class="sd-accdot" style="--dot: {ACCENT_SWATCH[accent]}" aria-hidden="true"></span>
    Accent
  </button>

  {#if open}
    <div class="sd-menu sd-accmenu" role="menu" aria-label="Accent colour">
      {#each ACCENTS as name}
        <button
          class="sd-menuitem sd-accitem"
          class:sd-accitem--on={name === accent}
          type="button"
          role="menuitemradio"
          aria-checked={name === accent}
          on:click={() => choose(name)}
        >
          <span class="sd-accdot" style="--dot: {ACCENT_SWATCH[name]}" aria-hidden="true"></span>
          {ACCENT_LABEL[name]}
        </button>
      {/each}
    </div>
  {/if}
</div>
