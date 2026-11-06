<script>
  // The app's editable table, drawn as a table you can type into.
  //
  // Every box is the app's own control: the same `_addcontrol_*` input or select,
  // at the same id, which is what makes the save a write into the page and not a
  // request of our own. The view holds what the boxes say; only the difference is
  // ever written, and the app's Save is what submits.
  //
  // The three page controls are likewise the app's: Add new and Remove all are
  // its own links (so they navigate), and Save presses the page's `#save`.
  import { diffFields } from '../model/diff.js';

  export let charges;
  export let onSave = null;
  export let onPress = null;

  // What the page sent, and what the boxes hold. `fields` is the baseline the
  // diff compares against, so a successful save moves it forward and Save goes
  // quiet again instead of staying dirty over values the page now carries.
  let fields = charges.fields.map((field) => ({ ...field }));
  let values = {};
  for (const field of fields) values[field.key] = field.value;

  let query = '';
  let status = '';
  let busy = false;

  $: changes = diffFields(fields, values);
  $: dirty = changes.length > 0;
  $: q = query.trim().toLowerCase();
  $: rows = q ? charges.rows.filter((row) => String(row.text || '').toLowerCase().includes(q)) : charges.rows;
  $: actions = charges.actions || {};

  const why = {
    unchanged: () => 'Nothing has changed yet.',
    missing: (keys) => `The app’s own field for ${keys.join(', ')} is not on this page — use Original.`,
    'no-save-link': () => 'This page has no Save — use the app’s own page.'
  };

  function save() {
    if (busy || !dirty) return;
    if (!onSave) {
      status = 'No save handler was attached for this page.';
      return;
    }
    busy = true;
    status = '';
    const result = onSave({ ...values });
    busy = false;

    if (!result || !result.submitted) {
      const make = why[result && result.reason];
      status = make ? make(result && result.missing) : 'The app did not take the change.';
      return;
    }
    // The page carries these values now: the baseline moves with them.
    fields = fields.map((field) => ({ ...field, value: values[field.key] }));
    status = 'Sent the changes to the app’s own Save…';
  }

  function askRemove(event, row) {
    const name = (row.cells.find((cell) => cell.kind === 'identity') || {}).text || 'this charge';
    const also = dirty ? '\n\nUnsaved edits on this page are lost.' : '';
    const question = `Remove ${name}?${also}\n\nThis runs the app’s own remove. It is not undone from here.`;
    if (!confirm(question)) {
      event.preventDefault();
      return;
    }
    if (onPress) event.preventDefault();
  }

  // Remove all is the app's own link, and it clears every charge on the page.
  // The count is the page's, so the question says what is about to go.
  function askRemoveAll(event) {
    const also = dirty ? '\n\nUnsaved edits on this page are lost.' : '';
    const question = `Remove all ${charges.rows.length} additional class charges?${also}\n\n`
      + 'This runs the app’s own Remove All. It is not undone from here.';
    if (!confirm(question)) {
      event.preventDefault();
      return;
    }
    if (onPress) event.preventDefault();
  }
</script>

<div class="sd-charges">
  <div class="sd-editorbar">
    <span class="sd-dirty">
      {charges.rows.length} charge{charges.rows.length === 1 ? '' : 's'}{dirty ? ` · ${changes.length} edited` : ''}
      {q && rows.length !== charges.rows.length ? ` · ${rows.length} shown` : ''}
    </span>
    <div class="sd-editor-actions">
      {#if actions.add}
        <a class="sd-btn" href={actions.add.href} title={actions.add.label || 'Add a new charge'} on:click={dirty ? (event) => { if (!confirm('Unsaved edits on this page are lost. Continue?')) event.preventDefault(); } : null}>Add new</a>
      {/if}
      {#if actions.add && (actions.removeAll || actions.save)}<span class="sd-barsep" aria-hidden="true"></span>{/if}
      {#if actions.removeAll}
        <a class="sd-btn sd-btn--danger" href={actions.removeAll.href} title={actions.removeAll.label} on:click={askRemoveAll}>Remove all</a>
      {/if}
      {#if actions.save}
        <button class="sd-btn sd-primary" type="button" disabled={!dirty || busy} title="Save with the app’s own Save" on:click={save}>Save</button>
      {/if}
    </div>
  </div>

  {#if status}<p class="sd-editorstatus" role="status">{status}</p>{/if}

  <div class="sd-editorbody">
    <div class="sd-listbar">
      <input
        class="sd-filter"
        type="search"
        placeholder="Filter these charges"
        aria-label="Filter these charges"
        bind:value={query}
      />
      {#if q}<span class="sd-count">{rows.length} of {charges.rows.length}</span>{/if}
    </div>

    <div class="sd-tablewrap">
      <table class="sd-table sd-chargestable">
        <thead>
          <tr>
            {#each charges.columns as column}
              <th class:sd-cell--right={column.kind === 'remove'}>
                {#if column.kind === 'remove'}<span class="sd-sr">Remove</span>{:else}{column.label}{/if}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each rows as row (row.key)}
            <tr>
              {#each row.cells as cell}
                <td class:sd-cell--right={cell.kind === 'remove'} class:sd-cell--action={cell.kind === 'remove'}>
                  {#if cell.kind === 'identity'}
                    {#if cell.href}
                      <a class="sd-chargename" href={cell.href} title={`Open ${cell.text}`}>{cell.text}</a>
                    {:else}
                      <span class="sd-chargename">{cell.text}</span>
                    {/if}
                    {#if cell.sub}<span class="sd-chargesub">{cell.sub}</span>{/if}

                  {:else if cell.kind === 'schedule'}
                    {cell.text}

                  {:else if cell.kind === 'remove'}
                    <a
                      class="sd-pill sd-pill--icon"
                      href={cell.href}
                      title={`Remove ${(row.cells.find((c) => c.kind === 'identity') || {}).text || 'this charge'}`}
                      on:click={(event) => askRemove(event, row)}
                    >
                      <span class="sd-icon sd-icon--drop" aria-hidden="true"></span>
                      <span class="sd-sr">Remove</span>
                    </a>

                  {:else if cell.kind === 'fields'}
                    {#each cell.groups as group}
                      {#if group.kind === 'date'}
                        <!-- The app's three selects, and nothing else: the calendar
                             glyph beside them only opens its own date picker. -->
                        <span class="sd-chargedate">
                          {#each group.fields as field}
                            <select
                              class="sd-input sd-input--{field.part}"
                              aria-label="{field.label || 'Due'} {field.part}"
                              bind:value={values[field.key]}
                            >
                              {#each field.options as option}
                                <option value={option.value}>{option.label}</option>
                              {/each}
                            </select>
                          {/each}
                        </span>
                      {:else if group.field.type === 'select'}
                        <select
                          class="sd-input sd-chargecat"
                          aria-label={group.field.kind}
                          bind:value={values[group.field.key]}
                        >
                          {#each group.field.options as option}
                            <option value={option.value}>{option.label}</option>
                          {/each}
                        </select>
                      {:else}
                        <input
                          class="sd-input {group.field.width}"
                          type="text"
                          aria-label={group.field.kind}
                          bind:value={values[group.field.key]}
                        />
                      {/if}
                    {/each}

                  {:else}
                    {cell.text}
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if !charges.rows.length}
      <p class="sd-panelnote">This page has no charges yet. Add new opens the app’s own add screen.</p>
    {:else if q && !rows.length}
      <p class="sd-empty">Nothing matches “{query}”.</p>
    {:else}
      <p class="sd-panelnote">
        Every box on this page is the app’s own field, and Save is the app’s own Save. Removing one charge or all of
        them uses the app’s own links.
      </p>
    {/if}
  </div>
</div>
