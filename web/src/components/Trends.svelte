<script>
  // The Home dashboard's Trends tab: the app's own chart images, grouped under
  // the columns it prints them in, each with the caption the app gives it, then
  // the tables the page carries (the Top 10 customers list).
  //
  // The charts stay images. They are server-rendered PNGs, 430x140, and
  // redrawing them here would be a second, different chart of the same numbers.
  import PageTabs from './PageTabs.svelte';
  import { cellKind } from '../lib/cellclass.js';

  export let trends;

  // In the page's order, one group per column heading. A chart with no column
  // of its own still gets a group, so nothing is dropped for lack of a label.
  $: groups = (() => {
    const out = [];
    for (const chart of trends.charts) {
      let group = out.find((g) => g.section === chart.section);
      if (!group) {
        group = { section: chart.section, charts: [] };
        out.push(group);
      }
      group.charts.push(chart);
    }
    return out;
  })();
</script>

<div class="sd-trends">
  <PageTabs tabs={trends.tabs || []} />

  <div class="sd-editorbar">
    <span class="sd-dirty">
      {trends.charts.length} chart{trends.charts.length === 1 ? '' : 's'}{trends.tables.length
        ? ` · ${trends.tables.length} table${trends.tables.length === 1 ? '' : 's'}`
        : ''}
    </span>
  </div>

  <div class="sd-trendsbody">
    {#each groups as group}
      {#if group.section}<h3 class="sd-sheethead">{group.section}</h3>{/if}
      <div class="sd-chartgrid">
        {#each group.charts as chart}
          <figure class="sd-chart">
            {#if chart.title}<figcaption class="sd-charttitle">{chart.title}</figcaption>{/if}
            {#if chart.href}
              <a class="sd-chartlink" href={chart.href} title={`${chart.title || 'Chart'} — larger version`}>
                <img src={chart.src} alt={chart.title || 'Trend chart'} loading="lazy" />
              </a>
            {:else}
              <img src={chart.src} alt={chart.title || 'Trend chart'} loading="lazy" />
            {/if}
            {#if chart.caption}<p class="sd-chartcap">{chart.caption}</p>{/if}
          </figure>
        {/each}
      </div>
    {/each}

    {#each trends.tables as table}
      {#if table.caption}<h3 class="sd-sheethead">{table.caption}</h3>{/if}
      <div class="sd-tablewrap">
        <table class="sd-table">
          {#if table.headings.length}
            <thead>
              <tr>
                {#each table.headings as heading}<th>{heading}</th>{/each}
              </tr>
            </thead>
          {/if}
          <tbody>
            {#each table.rows as row}
              <tr>
                {#each row as cell}
                  <td
                    class:sd-cell--right={cell.right}
                    class:sd-cell--link={cellKind(cell) === 'link'}
                  >
                    {#if cell.href}<a href={cell.href}>{cell.text}</a>{:else}{cell.text}{/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/each}

    {#if trends.links.length}
      <p class="sd-sheetlinks">
        {#each trends.links as link}
          <a class="sd-action" href={link.href}>{link.label}</a>
        {/each}
      </p>
    {/if}
  </div>
</div>
