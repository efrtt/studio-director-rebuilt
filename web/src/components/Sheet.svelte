<script>
  import DataTable from './DataTable.svelte';
  import PageTabs from './PageTabs.svelte';
  export let sheet;
  export let onPress = null;

  let query = '';
  let status = '';

  // The page often has its own Print control (which builds the app's PDF). A
  // second one that prints this view would be a different thing under the same
  // name, so it only appears when the page has none.
  $: pagePrints = sheet.actions.some((a) => /^print/i.test(a.label));

  // One filter across every table on the page: a dashboard's three tables are
  // one screen, and a name hidden in the second one should still be findable.
  $: q = query.trim().toLowerCase();
  $: tables = sheet.tables.map((table) => ({
    ...table,
    rows: q
      ? table.rows.filter((row) => row.some((cell) => String(cell.text).toLowerCase().includes(q)))
      : table.rows
  }));
  $: shown = tables.reduce((n, t) => n + t.rows.length, 0);
  $: empty = q && !shown;

  function press(action) {
    if (!onPress) {
      status = 'No handler was attached for this page.';
      return;
    }
    const result = onPress(action);
    if (!result || !result.submitted) {
      status = result && result.reason === 'ambiguous'
        ? `“${action.label}” appears ${result.matches} times on this page — use Original.`
        : `“${action.label}” could not be pressed — use Original.`;
      return;
    }
    status = `Asked the app to run “${action.label}”…`;
  }

  function print() {
    try { window.print(); } catch (e) { status = 'This view cannot be printed here.'; }
  }
</script>

<div class="sd-sheet">
  <div class="sd-editorbar">
    <span class="sd-dirty">
      {sheet.rows} row{sheet.rows === 1 ? '' : 's'}{sheet.truncated ? ` · showing ${sheet.shown}` : ''}{q ? ` · ${shown} match${shown === 1 ? '' : 'es'}` : ''}
    </span>
    <div class="sd-editor-actions">
      {#each sheet.actions as action}
        <button class="sd-btn" type="button" title={action.onclick || action.label} on:click={() => press(action)}>
          {action.label}
        </button>
      {/each}
      {#if !pagePrints}
        <button class="sd-btn" type="button" on:click={print}>Print this view</button>
      {/if}
    </div>
  </div>

  {#if status}<p class="sd-editorstatus">{status}</p>{/if}

  <PageTabs tabs={sheet.tabs || []} />

  <div class="sd-sheetbody">
    <div class="sd-listbar">
      <input
        class="sd-filter"
        type="search"
        placeholder={`Filter ${sheet.title.toLowerCase()}`}
        bind:value={query}
      />
      {#if q}<span class="sd-count">{shown} of {sheet.rows}</span>{/if}
    </div>

    {#each tables as table}
      {#if table.section}<h3 class="sd-sheethead">{table.section}</h3>{/if}
      {#if table.caption}<h3 class="sd-sheetcaption">{table.caption}</h3>{/if}
      <DataTable
        {table}
        emptyText={q ? 'No rows match the filter.' : (table.message || 'No items to display.')}
      />
      {#if table.total}<p class="sd-sheetnote">{table.total}</p>{/if}
      {#if table.links}
        <p class="sd-sheetlinks">
          {#each table.links as link}
            <a class="sd-action" href={link.href}>{link.label}</a>
          {/each}
        </p>
      {/if}
    {/each}

    {#if empty}
      <p class="sd-empty">Nothing matches “{query}”.</p>
    {:else if !sheet.tables.length}
      <p class="sd-panelnote">This page has no table to show.</p>
    {/if}
  </div>
</div>
