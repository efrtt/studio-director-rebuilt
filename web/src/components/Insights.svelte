<script>
  // The Home dashboard's Insights tab, drawn as the app draws it: the student
  // donut with its three counts and names, then the eight stat cards in four
  // columns of two.
  //
  // The stat cells are filled row-major by the app (1, 23, 228, 347, then 53,
  // 21, 3, 0) but read as two per column, which is why the grid flows by column.
  import PageTabs from './PageTabs.svelte';

  export let insights;

  // Theme tokens, not the app's own chart colours: a theme sets the palette and
  // the donut follows it.
  const COLORS = ['var(--ok)', 'var(--accent)', 'var(--warn)', 'var(--dim)'];

  $: donut = insights.donut;
  $: stops = donut && donut.total
    ? (() => {
        let at = 0;
        return donut.legend
          .map((part, i) => {
            const from = at;
            at += (part.count / donut.total) * 100;
            return `${COLORS[i % COLORS.length]} ${from.toFixed(2)}% ${at.toFixed(2)}%`;
          })
          .join(', ');
      })()
    : '';
</script>

<div class="sd-insights">
  <PageTabs tabs={insights.tabs || []} />

  <div class="sd-insightsbody">
    {#if donut}
      <section class="sd-insightcard" aria-label="Students">
        <div
          class="sd-donut"
          style={`--sd-donut: conic-gradient(${stops})`}
          role="img"
          aria-label={`${donut.total}${donut.unit ? ' ' + donut.unit : ''}`}
        >
          <div class="sd-donuthole">
            <strong>{donut.total}</strong>
            {#if donut.unit}<span>{donut.unit}</span>{/if}
          </div>
        </div>
        <ul class="sd-donutlegend">
          {#each donut.legend as part, i}
            <li>
              <span class="sd-donutdot" style={`background:${COLORS[i % COLORS.length]}`}></span>
              <span class="sd-donutcount">{part.count}</span>
              {#if part.href}
                <a class="sd-celllink" href={part.href}>{part.label}</a>
              {:else}
                <span>{part.label}</span>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if insights.stats.length}
      <div class="sd-stats">
        {#each insights.stats as stat}
          <svelte:element
            this={stat.href ? 'a' : 'div'}
            class="sd-stat"
            href={stat.href || undefined}
          >
            <span class="sd-statvalue">{stat.value}</span>
            <span class="sd-statlbl">{stat.label}</span>
          </svelte:element>
        {/each}
      </div>
    {/if}
  </div>
</div>
