<script>
  import { changesFrom } from '../lib/save.js';
  import { cellKind } from '../lib/cellclass.js';
  import CellHeading from './CellHeading.svelte';
  import CellAction from './CellAction.svelte';
  import CellLink from './CellLink.svelte';
  import DuePill from './DuePill.svelte';
  import RecordPage from './RecordPage.svelte';
  import { recordsOf } from '../lib/records.js';

  export let task;
  export let onAct = null;
  // The page's own URL. It is what says whether this is the list, one record's
  // edit page, or the new page — the same three URLs the app itself uses.
  export let url = '';
  // The page's own button bar, read where its controls can be pressed: New and
  // Delete are the app's, and the add page prints no bar at all.
  export let bar = null;
  export let onAction = null;

  // Same seeding as the record editor: what the server sent, so an untouched
  // field is never written back.
  const initial = {};
  for (const field of task.fields) {
    initial[field.key] = field.type === 'checkbox' ? !!field.checked : field.value;
  }
  let values = { ...initial };
  let status = '';
  let busy = false;
  let pressed = '';

  $: changes = changesFrom(task.form, values);
  $: dirty = changes.length > 0;

  const why = {
    missing: (label) => `The app’s “${label}” control is not on this page — use Original.`,
    ambiguous: (label, n) => `“${label}” appears ${n} times on this page — use Original.`,
    'no-action': () => 'This page has no control to press — use Original.'
  };

  function act(action) {
    if (busy) return;
    if (!onAct) {
      status = 'No handler was attached for this page.';
      return;
    }
    busy = true;
    pressed = action.label;
    status = '';
    const result = onAct(values, action);
    if (!result || !result.submitted) {
      busy = false;
      const make = why[result && result.reason];
      status = make
        ? make(action.label, result && result.matches)
        : `Could not press “${action.label}” — use Original.`;
      return;
    }
    status = `Asked the app to run “${action.label}”${result.applied && result.applied.length ? ` after ${result.applied.length} change${result.applied.length === 1 ? '' : 's'}` : ''}…`;
  }

  function reset() {
    values = { ...initial };
    status = '';
  }

  function onKey(e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && task.primary) {
      e.preventDefault();
      act(task.primary);
    }
  }

  // A task page that prints a list of records beside its form — ManageVendors,
  // ManageHolidays — is drawn as the list, with the form in a dialog. Those list
  // pages carry an empty stub form, which is what used to fill the screen with
  // fourteen blank fields above a table nobody could click into.
  $: recordList = !!recordsOf(task, url);

  function saveRecord(values) {
    if (!onAct) return { submitted: false, reason: 'no-action' };
    return onAct(values, task.primary);
  }
</script>

<svelte:window on:keydown={onKey} />

{#if recordList}
  <RecordPage
    source={task}
    {url}
    title={task.title}
    saveLabel={task.primary ? task.primary.label : 'Save'}
    {bar}
    {onAction}
    onSave={saveRecord}
  />
{:else}
<div class="sd-task">
  <div class="sd-editorbar">
    <span class="sd-dirty">
      {task.fields.length} field{task.fields.length === 1 ? '' : 's'}{dirty ? ` · ${changes.length} edited` : ''}
    </span>
    <div class="sd-editor-actions">
      {#if task.primary}
        <button
          class="sd-btn sd-primary"
          type="button"
          disabled={busy}
          title={task.primary.onclick || task.primary.label}
          on:click={() => act(task.primary)}
        >{pressed === task.primary.label && busy ? `${task.primary.label}…` : task.primary.label}</button>
      {/if}
      <button class="sd-btn" type="button" disabled={!dirty || busy} on:click={reset}>Reset</button>
      {#each task.actions.filter((a) => a !== task.primary) as action}
        <button
          class="sd-btn"
          class:sd-primary={action === task.primary}
          type="button"
          disabled={busy}
          title={action.onclick || action.label}
          on:click={() => act(action)}
        >{pressed === action.label && busy ? `${action.label}…` : action.label}</button>
      {/each}
    </div>
  </div>

  {#if status}<p class="sd-editorstatus">{status}</p>{/if}

  <div class="sd-editorbody">
    <table class="sd-fields">
      <tbody>
        {#each task.rows as row}
          <tr>
            <th scope="row">{row.label}</th>
            <td>
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
                  <textarea class="sd-input sd-textarea" bind:value={values[field.key]} rows="3"></textarea>
                {:else if field.type === 'password'}
                  <input class="sd-input" type="password" bind:value={values[field.key]} />
                {:else}
                  <input class="sd-input" type="text" bind:value={values[field.key]} />
                {/if}
              {/each}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    <!-- A task page prints tables too: `ManageHolidays` lists every holiday
         beside the form that adds one. Read-only here, rows are links. -->
    {#if task.tables && task.tables.length}
      {#each task.tables as block}
        {#if block.section}<h4 class="sd-section">{block.section}</h4>{/if}
        <div class="sd-tablewrap">
          <table class="sd-table">
            {#if block.headings.length}
              <thead>
                <tr>
                  {#each block.headings as heading}<CellHeading text={heading} />{/each}
                </tr>
              </thead>
            {/if}
            <tbody>
              {#each block.rows as row}
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
            </tbody>
          </table>
        </div>
      {/each}
    {/if}

    {#if task.links.length}
      <p class="sd-panelnote">
        Also on this page:
        {#each task.links as link, i}{#if i} · {/if}<a href={link.href}>{link.label}</a>{/each}
      </p>
    {/if}
  </div>
</div>
{/if}
