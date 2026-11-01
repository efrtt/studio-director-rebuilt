<script>
  import { changesFrom } from '../lib/save.js';
  import { cellKind } from '../lib/cellclass.js';

  export let task;
  export let registerPrimary = null;
  export let onAct = null;

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

  // The header owns the page's main action; this view supplies it with its own
  // state, which the shell cannot see.
  $: if (registerPrimary) {
    registerPrimary(task.primary
      ? {
        label: busy ? task.primary.label + '…' : task.primary.label,
        disabled: busy,
        title: task.primary.onclick || task.primary.label,
        run: () => act(task.primary)
      }
      : null);
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
</script>

<svelte:window on:keydown={onKey} />

<div class="sd-task">
  <div class="sd-editorbar">
    <span class="sd-dirty">
      {task.fields.length} field{task.fields.length === 1 ? '' : 's'}{dirty ? ` · ${changes.length} edited` : ''}
    </span>
    <div class="sd-editor-actions">
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
                  {#each block.headings as heading}<th>{heading}</th>{/each}
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
                            <a class="sd-pill" href={action.href} title={action.label}>{action.label}</a>
                          {/each}
                        </span>
                      {:else if cell.href}
                        <a href={cell.href} title="Open in the app's editor">{cell.text}</a>
                      {:else}{cell.text}{/if}
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

    <p class="sd-panelnote">
      The buttons above are the app’s own controls: pressing one sends the page
      through the app, so its validation and any follow-on step happen as usual.
    </p>
  </div>
</div>
