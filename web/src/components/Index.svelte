<script>
  import { onMount } from 'svelte';
  import { browserStore, readUsage, recordUse, topUsed } from '../lib/usage.js';

  export let index;

  // Two ways to draw a menu, chosen by the reader (lib/menu.js): a grouped list
  // with a rail for the long reference pages, task cards for the short ones.
  $: layout = index.layout || 'grouped';

  let query = '';
  let usage = readUsage(browserStore());
  // Which card has been expanded, by label. Cards are short; this is a set of
  // exceptions rather than state for every group.
  let expanded = {};
  // The group the rail has underlined, set by the click that scrolled to it.
  let active = 0;

  $: q = query.trim().toLowerCase();
  // Filtering happens over every link the page has; only the drawing is capped.
  // `Enroll(cident)` is 4,271 students, and all of them have to be findable by
  // name even though 300 links are on screen at a time.
  $: matched = index.groups
    .map((group) => ({ ...group, items: group.items.filter((i) => !q || i.label.toLowerCase().includes(q)) }))
    .filter((group) => group.items.length);
  $: shown = matched.reduce((n, g) => n + g.items.length, 0);

  const limit = index.limit || 300;
  $: capped = layout !== 'cards' && shown > limit;
  $: groups = layout === 'cards' ? matched : drawCapped(matched, capped ? limit : Infinity);

  // "Most used" is measured, not guessed: the destinations this browser has
  // opened before, most first. A page with no history has no row.
  $: used = topUsed(usage, index.groups.flatMap((g) => g.items));

  function drawCapped(groupsIn, budget) {
    let left = budget;
    const out = [];
    for (const group of groupsIn) {
      if (left <= 0) break;
      const items = group.items.slice(0, left);
      left -= items.length;
      out.push({ ...group, items, hidden: group.items.length - items.length });
    }
    return out;
  }

  // A card shows this many links before offering the rest. Seven is enough for
  // "what can I do here" to be the question the card answers; ten is a list.
  const CARD_SHOW = 7;

  // What each card draws, as a value rather than as a helper called from the
  // markup. Svelte re-runs a template expression when a variable it names
  // changes, and a helper's identity never does — so `{#each cardItems(group)}`
  // kept drawing the cut list forever: the button flipped to "Show fewer" and
  // the other three links never appeared. A reactive array fixes the dependency.
  $: cardGroups = groups.map((group) => ({
    ...group,
    visible: expanded[group.label] || q ? group.items : group.items.slice(0, CARD_SHOW)
  }));

  function toggle(label) {
    expanded = { ...expanded, [label]: !expanded[label] };
  }

  // The app's own page name for a destination, shown beside the label the way the
  // original menu prints it: it is what people recognise, and what they search.
  function codeOf(href) {
    const match = /[?&]page=([^&]+)/.exec(href || '');
    return match ? decodeURIComponent(match[1]) : '';
  }

  // A click on one of these links is the only evidence this build has about what
  // people use, so it is counted before the browser navigates. Best effort: a
  // failed write must not stand between the click and the page.
  function countClick(event) {
    const anchor = event.target.closest && event.target.closest('a[href]');
    if (!anchor) return;
    usage = recordUse(browserStore(), anchor.getAttribute('href'));
  }

  // A listener on the view itself rather than on:click on a plain div: the div
  // is not a control, and pretending it is would be a lie to a screen reader.
  let root = null;
  onMount(() => {
    if (!root) return null;
    root.addEventListener('click', countClick);
    return () => root.removeEventListener('click', countClick);
  });

  function toGroup(event, i) {
    event.preventDefault();
    active = i;
    const el = document.getElementById('sd-grp-' + i);
    if (el) el.scrollIntoView({ block: 'start' });
  }
</script>

<div class="sd-index sd-index--{layout}" bind:this={root}>
  <div class="sd-indexbar">
    <input
      class="sd-filter"
      type="search"
      placeholder={layout === 'cards'
        ? 'Filter ' + index.title.toLowerCase() + '…'
        : `Filter ${index.count} ${index.title.toLowerCase()} links…`}
      bind:value={query}
    />
    <span class="sd-count">{shown} of {index.count}</span>
  </div>

  {#if used.length}
    <div class="sd-mostrow">
      <span class="sd-chiplabel">Most used</span>
      {#each used as item}
        <a class="sd-chip" href={item.href} title={item.label}>
          <span aria-hidden="true">★</span>
          {item.label}
        </a>
      {/each}
    </div>
  {/if}

  {#if layout === 'cards'}
    <div class="sd-indexbody">
      <div class="sd-cards">
        {#each cardGroups as group}
          <section class="sd-card">
            <h3 class="sd-cardhead">
              {group.label}
              <span class="sd-indexcount">{group.items.length}</span>
            </h3>
            <div class="sd-cardlinks">
              {#each group.visible as item}
                <a class="sd-cardlink" href={item.href} title={item.label}>
                  <span class="sd-cardlabel">{item.label}</span>
                  {#if codeOf(item.href)}
                    <span class="sd-rowcode">{codeOf(item.href)}</span>
                  {/if}
                </a>
              {/each}
            </div>
            {#if group.items.length > CARD_SHOW}
              <button class="sd-cardmore" type="button" on:click={() => toggle(group.label)}>
                {expanded[group.label] ? 'Show fewer' : `Show all ${group.items.length}`}
              </button>
            {/if}
          </section>
        {/each}
      </div>
      {#if !shown}
        <p class="sd-empty">Nothing matches “{query}”.</p>
      {/if}
    </div>
  {:else}
    <div class="sd-indexbody">
      <div class="sd-grpsplit">
        <nav class="sd-grprail" aria-label="Groups on this page">
          {#each groups as group, i}
            <a
              href={'#sd-grp-' + i}
              class:on={i === active}
              on:click={(event) => toGroup(event, i)}
            >
              <span>{group.label}</span>
              <b>{group.items.length}</b>
            </a>
          {/each}
        </nav>

        <div class="sd-grpcols">
          {#each groups as group, i}
            <section class="sd-indexgroup" id={'sd-grp-' + i}>
              <h3 class="sd-indexhead">
                {group.label}
                <span class="sd-indexcount">{group.items.length}</span>
              </h3>
              <div class="sd-linkcols">
                {#each group.items as item}
                  <a class="sd-rowlink" href={item.href} title={item.label}>
                    <span class="sd-rowlabel">{item.label}</span>
                    <span class="sd-rowcode">{codeOf(item.href)}</span>
                  </a>
                {/each}
              </div>
              {#if group.hidden}
                <p class="sd-panelnote">{group.hidden} more in this group — type to narrow.</p>
              {/if}
            </section>
          {/each}

          {#if !shown}
            <p class="sd-empty">Nothing matches “{query}”.</p>
          {:else if capped}
            <p class="sd-panelnote">
              Showing {limit} of {shown}{q ? ' matching' : ''} links — type a few letters to narrow.
            </p>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
