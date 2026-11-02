<script>
  import { onMount, tick } from 'svelte';
  import { DESTINATIONS } from '../lib/destinations.js';
  import { rowsFor, flatRows, step } from '../lib/jump.js';
  import { browserStore, keyOf, readRecent, recordRecent } from '../lib/usage.js';

  // The rail's own links plus the four menu pages' destinations: Ctrl-K has to
  // work on a calendar or an editor, and those pages carry no menu of their own.
  export let nav = [];
  export let here = '';

  let open = false;
  let query = '';
  let cursor = 0;
  let field = null;

  const store = browserStore();
  let recentKeys = readRecent(store);

  $: catalog = [
    ...nav.map((link) => ({ code: '', label: link.label, menu: 'Menu', href: link.href })),
    ...DESTINATIONS.map((d) => ({ code: d.code, label: d.label, menu: d.menu, href: 'admin.sd?page=' + d.code }))
  ];
  // Recents are stored as hrefs, so a later crawl's rename shows the new label.
  $: recent = recentKeys
    .map((key) => catalog.find((entry) => keyOf(entry.href) === key))
    .filter(Boolean);
  $: rows = rowsFor(catalog, query, { recent, here });
  $: flat = flatRows(rows);
  $: if (cursor > flat.length - 1) cursor = flat.length ? 0 : -1;

  async function show() {
    open = true;
    query = '';
    cursor = 0;
    await tick();
    if (field) field.focus();
  }

  function close() {
    open = false;
    query = '';
  }

  function choose(row) {
    if (!row) return;
    recentKeys = recordRecent(store, row.href);
    close();
    location.href = row.href;
  }

  function onKey(event) {
    const mod = event.ctrlKey || event.metaKey;
    if (mod && !event.altKey && (event.key === 'k' || event.key === 'K')) {
      event.preventDefault();
      if (open) close(); else show();
      return;
    }
    if (!open) return;

    if (event.key === 'Escape') {
      // The palette owns Escape while it is up: closing it must not also open the
      // app's own page underneath (App's handler would do exactly that).
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      cursor = step(cursor, flat.length, event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      choose(flat[cursor]);
    }
  }

  onMount(() => {
    // Capture phase on the document, so the palette sees Escape before the
    // shell's own window handler can act on it.
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  });
</script>

{#if open}
  <div class="sd-jump" role="dialog" aria-modal="true" aria-label="Jump to a page">
    <div class="sd-jump-scrim" on:click={close} role="presentation"></div>
    <div class="sd-jump-panel">
      <div class="sd-jump-field">
        <span class="sd-jump-icon" aria-hidden="true">⌕</span>
        <input
          bind:this={field}
          bind:value={query}
          on:input={() => (cursor = 0)}
          type="text"
          placeholder="Jump to a page, report or setting…"
          aria-label="Jump to a page, report or setting"
          autocomplete="off"
        />
        <kbd>Esc</kbd>
      </div>

      <div class="sd-jump-rows" role="listbox" aria-label="Destinations">
        {#each rows as group}
          <div class="sd-jump-group">{group.menu}</div>
          {#each group.rows as row}
            <button
              class="sd-jump-row"
              class:on={flat[cursor] === row}
              type="button"
              role="option"
              aria-selected={flat[cursor] === row}
              on:click={() => choose(row)}
              on:mousemove={() => (cursor = flat.indexOf(row))}
            >
              {#if group.menu === 'Recent'}
                <span class="sd-jump-tag">{row.menu}</span>
              {/if}
              <span class="sd-jump-label">{row.label}</span>
              <span class="sd-jump-code">{row.code}</span>
            </button>
          {/each}
        {/each}

        {#if !flat.length}
          <div class="sd-jump-group">No match</div>
          <div class="sd-jump-empty">Nothing here is called “{query}”.</div>
        {/if}
      </div>

      <div class="sd-jump-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
        <span><kbd>↵</kbd> open</span>
        <span><kbd>Ctrl</kbd><kbd>K</kbd> anytime</span>
        <span class="sd-jump-tally">{catalog.length} destinations indexed</span>
      </div>
    </div>
  </div>
{/if}
