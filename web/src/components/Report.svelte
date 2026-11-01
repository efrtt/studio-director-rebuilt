<script>
  export let report;
  export let onRun = null;

  const initial = {};
  for (const field of report.fields) {
    initial[field.key] = field.type === 'checkbox' ? !!field.checked : field.value;
  }
  let values = { ...initial };
  let status = '';
  let busy = false;

  $: dirty = report.fields.some((field) => {
    const next = values[field.key];
    return field.type === 'checkbox'
      ? !!next !== !!field.checked
      : String(next == null ? '' : next) !== String(field.value == null ? '' : field.value);
  });

  function run() {
    if (busy) return;
    if (!onRun) {
      status = 'No run handler was attached.';
      return;
    }
    busy = true;
    status = '';
    const result = onRun(values);
    if (!result || !result.submitted) {
      busy = false;
      status = result && result.reason === 'no-trigger'
        ? `This page has no ${report.trigger ? report.trigger.label : 'report'} control - use Original.`
        : 'Could not run this report - use Original.';
      return;
    }
    // The app now owns the request and will re-render or navigate.
    status = 'Asked the app to run it...';
  }

  function reset() {
    values = { ...initial };
    status = '';
  }

  function onKey(e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      run();
    }
  }
</script>

<svelte:window on:keydown={onKey} />

<div class="sd-report">
  <div class="sd-editorbar">
    <span class="sd-dirty">
      {#if report.fields.length}{report.rows.length} filter{report.rows.length === 1 ? '' : 's'}{dirty ? ' · edited' : ''}{:else}Result only{/if}
    </span>
    <div class="sd-editor-actions">
      {#if report.fields.length}
        <button class="sd-btn" type="button" disabled={!dirty || busy} on:click={reset}>Reset</button>
      {/if}
      {#if report.trigger}
        <button class="sd-btn sd-primary" type="button" disabled={busy} on:click={run}>
          {busy ? 'Running...' : report.trigger.label}
        </button>
      {/if}
    </div>
  </div>

  {#if status}<p class="sd-editorstatus">{status}</p>{/if}

  <div class="sd-reportbody">
    {#if report.fields.length}
      <div class="sd-filters">
        {#each report.rows as row}
          <div class="sd-filter">
            <span class="sd-filterlabel">{row.label}</span>
            <span class="sd-filterfield">
              {#each row.fields as field}
                {#if field.type === 'checkbox'}
                  <label class="sd-check">
                    <input type="checkbox" bind:checked={values[field.key]} />
                    <span>{field.label || field.name || field.key}</span>
                  </label>
                {:else if field.options}
                  <select bind:value={values[field.key]} class="sd-input">
                    {#each field.options as option}
                      <option value={option.value}>{option.label}</option>
                    {/each}
                  </select>
                {:else if field.type === 'textarea'}
                  <textarea class="sd-input sd-textarea" bind:value={values[field.key]} rows="2"></textarea>
                {:else}
                  <input class="sd-input" type="text" bind:value={values[field.key]} />
                {/if}
              {/each}
            </span>
          </div>
        {/each}
      </div>
    {:else}
      <p class="sd-panelnote">This report takes no filters.</p>
    {/if}

    {#if report.results.tables.length}
      <h3 class="sd-reporthead">
        Result{report.results.rows === 1 ? '' : 's'} &middot; {report.results.rows} row{report.results.rows === 1 ? '' : 's'}
      </h3>
      {#each report.results.tables as block}
        <div class="sd-tablewrap">
          <table class="sd-table">
            {#if block.headings.length}
              <thead>
                <tr>
                  {#each block.headings as heading}<th>{heading}</th>{/each}
                </tr>
              </thead>
            {/if}
            <tbody>
              {#each block.rows as row}
                <tr>
                  {#each row as cell}
                    <td class:sd-cell--right={cell.right}>
                      {#if cell.href}<a href={cell.href} title="Open in the app's editor">{cell.text}</a>{:else}{cell.text}{/if}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/each}
    {:else}
      <p class="sd-panelnote">
        Set the filters and press {report.trigger ? `“${report.trigger.label}”` : 'Run Report'} — the app builds and runs the report.
      </p>
    {/if}
  </div>
</div>
