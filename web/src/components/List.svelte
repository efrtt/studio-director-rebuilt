<script>
  import { onMount } from 'svelte';
  import { recordId } from '../lib/shell.js';

  export let list;
  export let current = '';
  export let onLoadAll = null;
  // Only the standalone list pages widen by themselves. The panel beside an
  // editor does not: pressing the app's Show All there could re-render the form
  // being edited, so that one waits for a click.
  export let auto = false;

  let query = '';
  let busy = false;
  let failure = '';
  let autoTried = false;

  // A list that arrives as one window widens itself on open: no button to press.
  // Once per mounted list, so a panel that refuses to grow is not retried in a
  // loop — the button stays for a second attempt.
  onMount(() => {
    if (auto && !autoTried && onLoadAll && list.truncated) {
      autoTried = true;
      loadAll();
    }
  });

  async function loadAll() {
    if (!onLoadAll || busy) return;
    busy = true;
    failure = '';
    const result = await onLoadAll();
    busy = false;

    if (!result || !result.list) {
      failure = result && result.reason === 'no-trigger'
        ? 'This page has no Show All control \u2014 use Original.'
        : 'Could not read the wider list \u2014 use Original.';
      return;
    }

    if (!result.changed) {
      const urls = [...new Set((result.requests || []).map((r) => `${r.method} ${r.url}`))]
        .filter((u) => !/google-analytics|googletagmanager/i.test(u))
        .slice(0, 3);
      failure = urls.length
        ? `Show All requested ${urls.join(' , ')} but the list did not grow. Press Esc and use the app's own Show All; that request is the clue.`
        : 'Show All did nothing: no request, no growth. Press Esc and use the app\u2019s own Show All to get the rest.';
    }
  }

  $: here = recordId(current);

  $: q = query.trim().toLowerCase();
  $: items = q ? list.items.filter((i) => i.label.toLowerCase().includes(q)) : list.items;
</script>

<div class="sd-list">
  <div class="sd-listbar">
    <input
      class="sd-filter"
      type="search"
      placeholder={`Filter ${list.label.toLowerCase()}`}
      bind:value={query}
    />
    <span class="sd-count">{items.length} of {list.total || list.items.length}</span>
  </div>

  <div class="sd-listbody">
    <ul class="sd-records">
      {#each items as item}
        <li>
          <a
            href={item.href || '#'}
            title="Open in the app's editor"
            class:sd-record--current={here && recordId(item.href) === here}
            aria-current={here && recordId(item.href) === here ? 'true' : undefined}
          >
            {#if list.mixed && item.type}<span class="sd-type">{item.type}</span>{/if}
            <span class="sd-record-label">{item.label}</span>
            <span class="sd-go" aria-hidden="true">&rsaquo;</span>
          </a>
        </li>
      {/each}
    </ul>

    {#if !items.length}
      <p class="sd-empty">
        {query ? `Nothing matches "${query}".` : 'No records to show.'}
      </p>
    {/if}

    {#if list.truncated}
      <!-- Honest, not silent: this page carries one window of the record set. -->
      <div class="sd-note">
        <span>
          {#if busy}
            Loading all {list.total}\u2026 ({list.items.length} so far)
          {:else}
            First {list.items.length} of {list.total} — the app sends its list in windows.
          {/if}
        </span>
        {#if onLoadAll}
          <button class="sd-btn sd-primary" type="button" on:click={loadAll} disabled={busy}>
            {busy ? 'Loading\u2026' : `Load all ${list.total}`}
          </button>
        {:else}
          <span><strong>Esc</strong> or <strong>Original</strong> opens the app's own list.</span>
        {/if}
      </div>
      {#if failure}<p class="sd-note sd-note--warn">{failure}</p>{/if}
    {/if}
  </div>
</div>
