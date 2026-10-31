<script>
  export let index;

  let query = '';

  $: q = query.trim().toLowerCase();
  // Filtering happens over every link the page has; only the drawing is capped.
  // `Enroll(cident)` is 4,271 students, and all of them have to be findable by
  // name even though 300 tiles are on screen at a time.
  $: matches = index.groups
    .map((group) => ({ ...group, items: group.items.filter((i) => !q || i.label.toLowerCase().includes(q)) }))
    .filter((group) => group.items.length);
  $: shown = matches.reduce((n, g) => n + g.items.length, 0);

  const limit = index.limit || 300;
  $: capped = shown > limit;
  // Keep the cap across groups, in the page's own order, rather than per group.
  $: groups = drawCapped(matches, capped ? limit : Infinity);

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
</script>

<div class="sd-index">
  <div class="sd-listbar">
    <input
      class="sd-filter"
      type="search"
      placeholder={`Filter ${index.title.toLowerCase()}`}
      bind:value={query}
    />
    <span class="sd-count">{shown} of {index.count}</span>
  </div>

  <div class="sd-indexbody">
    {#each groups as group}
      <section class="sd-indexgroup">
        <h3 class="sd-indexhead">{group.label}</h3>
        <div class="sd-tiles">
          {#each group.items as item}
            <a class="sd-tile" href={item.href} title={item.label}>
              <span class="sd-tilelabel">{item.label}</span>
              <span class="sd-go" aria-hidden="true">&rsaquo;</span>
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
