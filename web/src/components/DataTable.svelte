<script>
  // One of the app's tables, drawn the way every view draws them.
  //
  // This lived inside `Sheet.svelte`, so the Trends page — which also shows one
  // of the app's tables (the Top 10 customers list) — drew its own bare
  // `<table>` with plain anchors: no link cell, no chevron, no amount pill, no
  // action pill, no right-aligned money column. The cell rules were in
  // `cellclass.js` and the components beside it all along; nothing shared them.
  //
  // `rows` is what the caller is actually showing (the sheet view filters them);
  // it defaults to the table's own rows.
  import CellHeading from './CellHeading.svelte';
  import CellAction from './CellAction.svelte';
  import CellLink from './CellLink.svelte';
  import DuePill from './DuePill.svelte';
  import { cellKind } from '../lib/cellclass.js';

  export let table;
  export let rows = null;
  // What the empty row says: the sheet view has a filter, a page's own table
  // says whatever the app printed under its headings.
  export let emptyText = '';

  $: shown = rows || table.rows;
</script>

{#if table.headings.length || shown.length}
  <div class="sd-tablewrap">
    <table class="sd-table">
      {#if table.headings.length}
        <thead>
          <tr>
            {#each table.headings as heading}<CellHeading text={heading} />{/each}
          </tr>
        </thead>
      {/if}
      <tbody>
        {#if shown.length}
          {#each shown as row}
            <tr>
              {#each row as cell}
                <td
                  class:sd-cell--right={cell.right}
                  class:sd-cell--link={cellKind(cell) === 'link'}
                  class:sd-cell--action={cellKind(cell) === 'action'}
                >
                  {#if cell.actions && cell.actions.length > 1}
                    <span class="sd-cell-actions">
                      {#each cell.actions as action}
                        <CellAction href={action.href} label={action.label} />
                      {/each}
                    </span>
                  {:else if cellKind(cell) === 'action' && cell.text}
                    <CellAction href={cell.href || '#'} label={cell.text} />
                  {:else if cell.href}
                    <CellLink href={cell.href} text={cell.text} due={cell.due || ''} />
                  {:else}{cell.text}{#if cell.due}<DuePill due={cell.due} />{/if}{/if}
                </td>
              {/each}
            </tr>
          {/each}
        {:else}
          <!-- A table with headings and no rows still belongs on the page:
               "Performance Info" with six costumes below it is not the same
               screen as "Costume Info" alone. -->
          <tr>
            <td class="sd-sheetempty" colspan={Math.max(table.headings.length, 1)}>
              {emptyText || table.message || 'No items to display.'}
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
{/if}
