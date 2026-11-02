<script>
  import { onMount } from 'svelte';
  import { recordId } from '../lib/shell.js';
  import { keepWidest, isComplete } from '../lib/follow.js';
  import { displayLabel, letterGroups, classShelves } from '../lib/names.js';
  import RecordRow from './RecordRow.svelte';

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
  // Browsing by letter needs room for the rail. At 260px, in the panel beside an
  // editor, the list stays plain rows; measured rather than guessed, so a stacked
  // split on a wide window gets the index and a narrow window does not.
  let root = null;
  let wide = false;

  onMount(() => {
    if (!auto || autoTried || (!onLoadAll && !onRefresh)) return;
    autoTried = true;
    widen();
  });

  onMount(() => {
    const measure = () => { wide = !!root && root.clientWidth >= 520; };
    if (typeof ResizeObserver !== 'function' || !root) {
      measure();
      return;
    }
    const watch = new ResizeObserver(measure);
    watch.observe(root);
    measure();
    return () => watch.disconnect();
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
  $: items = q
    ? data.items.filter((i) => displayLabel(i.label).toLowerCase().includes(q)
      || String(i.label || '').toLowerCase().includes(q))
    : data.items;
  $: short = data.total != null ? data.total - data.items.length : 0;

  // A standalone list page can be browsed by name. A mixed result set is a list
  // of answers, not a directory, and the narrow panel beside an editor has no
  // room for an index — both stay plain rows.
  const BROWSED = { Family: 'letters', Student: 'letters', Class: 'shelves' };
  $: lone = data.mixed ? '' : (data.types && data.types.length === 1 ? data.types[0] : '');
  $: view = (BROWSED[lone] && (auto || wide)) ? BROWSED[lone] : 'plain';

  $: letters = letterGroups(items, lone);
  $: shelves = classShelves(items);

  let groups = null;
  let activeLetter = '';

  // Sticky headings mean the section at the top of the pane is the one in view,
  // so the rail marks it instead of leaving the reader to guess where they are.
  function onGroupsScroll() {
    if (!groups) return;
    const top = groups.scrollTop;
    let found = '';
    for (const node of groups.querySelectorAll('[data-letter]')) {
      if (node.offsetTop <= top + 8) found = node.getAttribute('data-letter');
      else break;
    }
    activeLetter = found;
  }

  function jump(letter, event) {
    if (event) event.preventDefault();
    if (!groups) return;
    const node = groups.querySelector(`[data-letter="${letter}"]`);
    if (!node) return;
    groups.scrollTop = node.offsetTop;
    activeLetter = letter;
  }
</script>

<div class="sd-list" data-sd-view={view} bind:this={root}>
  <div class="sd-listbar">
    <input
      class="sd-filter"
      type="search"
      placeholder={`Filter ${data.label.toLowerCase()}`}
      bind:value={query}
    />
    <span class="sd-count">{items.length} of {data.total || data.items.length}</span>
    {#if view === 'letters' && letters.length}
      <span class="sd-count">{letters.length} letters</span>
    {:else if view === 'shelves' && shelves.length}
      <span class="sd-count">{shelves.length} shelves</span>
    {/if}
  </div>

  <div class="sd-listbody" class:sd-listbody--letters={view === 'letters'}>
    {#if view === 'letters'}
      <nav class="sd-letterrail" aria-label="Jump to a letter">
        {#each letters as group (group.letter)}
          <a
            href={`#sd-letter-${group.letter}`}
            class:sd-letterrail--on={activeLetter === group.letter}
            on:click={(event) => jump(group.letter, event)}
          >
            <span class="sd-letterrail-key">{group.letter}</span>
            <span class="sd-letterrail-count">{group.items.length}</span>
          </a>
        {/each}
      </nav>

      <div class="sd-groups" bind:this={groups} on:scroll={onGroupsScroll}>
        {#each letters as group (group.letter)}
          <section class="sd-group" data-letter={group.letter} id={`sd-letter-${group.letter}`}>
            <h3 class="sd-grouphead">
              <span class="sd-groupletter">{group.letter}</span>
              <span class="sd-groupcount">{group.items.length}</span>
            </h3>
            <ul class="sd-records">
              {#each group.items as item (item.href || item.label)}
                <RecordRow {item} mixed={data.mixed} {here} />
              {/each}
            </ul>
          </section>
        {/each}

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
                Loading all {data.total}&hellip; ({data.items.length} so far)
              {:else}
                First {data.items.length} of {data.total} &mdash; the app sends its list in windows.
              {/if}
            </span>
            {#if onLoadAll || onRefresh}
              <button class="sd-btn sd-primary" type="button" on:click={retry} disabled={busy}>
                {busy ? 'Loading&hellip;' : (short > 0 ? `Load ${short} more` : 'Load all')}
              </button>
            {:else}
              <span><strong>Esc</strong> or <strong>Original</strong> opens the app's own list.</span>
            {/if}
          </div>
          {#if failure}<p class="sd-note sd-note--warn">{failure}</p>{/if}
        {/if}
      </div>
    {:else}
      {#if view === 'shelves'}
        <div class="sd-shelves">
          {#each shelves as shelf (shelf.label)}
            <section class="sd-shelf">
              <h3 class="sd-shelfhead">
                <span>{shelf.label}</span>
                <span class="sd-shelfcount">{shelf.items.length}</span>
              </h3>
              <ul class="sd-records">
                {#each shelf.items as item (item.href || item.label)}
                  <RecordRow {item} when={true} {here} />
                {/each}
              </ul>
            </section>
          {/each}
        </div>
      {:else}
        <ul class="sd-records">
          {#each items as item (item.href || item.label)}
            <RecordRow {item} mixed={data.mixed} {here} />
          {/each}
        </ul>
      {/if}

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
              Loading all {data.total}&hellip; ({data.items.length} so far)
            {:else}
              First {data.items.length} of {data.total} &mdash; the app sends its list in windows.
            {/if}
          </span>
          {#if onLoadAll || onRefresh}
            <button class="sd-btn sd-primary" type="button" on:click={retry} disabled={busy}>
              {busy ? 'Loading&hellip;' : (short > 0 ? `Load ${short} more` : 'Load all')}
            </button>
          {:else}
            <span><strong>Esc</strong> or <strong>Original</strong> opens the app's own list.</span>
          {/if}
        </div>
        {#if failure}<p class="sd-note sd-note--warn">{failure}</p>{/if}
      {/if}
    {/if}
  </div>
</div>
