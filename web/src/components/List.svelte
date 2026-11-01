<script>
  import { onMount } from 'svelte';
  import { recordId } from '../lib/shell.js';
  import { keepWidest, isComplete } from '../lib/follow.js';

  export let list;
  export let current = '';
  export let onLoadAll = null;
  // Reads the live panel again without pressing anything. The app fills its
  // panel by script, so the list is not the first snapshot.
  export let onRefresh = null;
  // Only the standalone list pages widen by themselves. The panel beside an
  // editor does not: pressing the app's Show All there could re-render the form
  // being edited, so that one waits for a click.
  export let auto = false;

  let query = '';
  let busy = false;
  let failure = '';
  let autoTried = false;

  // The widened reading, once one arrives. Never shrinks: the app clears the
  // panel between fills, and a moment of zero rows is not a shorter list.
  let live = null;
  let seen = list;

  $: if (list !== seen) { seen = list; live = null; }
  $: data = live || list;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // A list that arrives as one window widens itself on open: no button to press.
  // Once per mounted list, so a panel that refuses to grow is not retried in a
  // loop — the button stays for a second attempt.
  onMount(() => {
    if (!auto || autoTried || (!onLoadAll && !onRefresh)) return;
    autoTried = true;
    widen();
  });

  async function widen() {
    if (busy) return;
    busy = true;
    failure = '';
    try {
      // The app's own control first, when the page still offers one. It is gone
      // once the app has drawn the whole list, so it is not the plan — the watch
      // below is.
      if (onLoadAll && data.truncated) {
        const result = await onLoadAll();
        if (result && result.list) live = keepWidest(data, result.list);
      }
      await follow();
    } finally {
      busy = false;
    }
  }

  // Keep re-reading until the panel reaches its own total, or stops growing.
  // Bounded: 50 looks at 400ms is ~20s, after which a panel that never fills is
  // reported rather than watched forever.
  async function follow() {
    if (!onRefresh) return;
    let stable = 0;
    let last = (live || data).items.length;

    for (let i = 0; i < 50; i += 1) {
      await sleep(400);
      const next = onRefresh();
      if (!next) continue;

      const held = live || data;
      const wider = keepWidest(held, next);
      if (wider !== held) live = wider;
      if (isComplete(wider)) return;

      const count = wider.items.length;
      if (count === last) {
        stable += 1;
        if (stable >= 5) return;
      } else {
        stable = 0;
        last = count;
      }
    }
  }

  function retry() {
    widen();
  }

  $: here = recordId(current);

  $: q = query.trim().toLowerCase();
  $: items = q ? data.items.filter((i) => i.label.toLowerCase().includes(q)) : data.items;
  $: short = data.total != null ? data.total - data.items.length : 0;
</script>

<div class="sd-list">
  <div class="sd-listbar">
    <input
      class="sd-filter"
      type="search"
      placeholder={`Filter ${data.label.toLowerCase()}`}
      bind:value={query}
    />
    <span class="sd-count">{items.length} of {data.total || data.items.length}</span>
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
            {#if data.mixed && item.type}<span class="sd-type">{item.type}</span>{/if}
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

    {#if data.truncated}
      <!-- Honest, not silent: this page carries one window of the record set. -->
      <div class="sd-note">
        <span>
          {#if busy}
            Loading all {data.total}\u2026 ({data.items.length} so far)
          {:else}
            First {data.items.length} of {data.total} \u2014 the app sends its list in windows.
          {/if}
        </span>
        {#if onLoadAll || onRefresh}
          <button class="sd-btn sd-primary" type="button" on:click={retry} disabled={busy}>
            {busy ? 'Loading\u2026' : (short > 0 ? `Load ${short} more` : 'Load all')}
          </button>
        {:else}
          <span><strong>Esc</strong> or <strong>Original</strong> opens the app's own list.</span>
        {/if}
      </div>
      {#if failure}<p class="sd-note sd-note--warn">{failure}</p>{/if}
    {/if}
  </div>
</div>
