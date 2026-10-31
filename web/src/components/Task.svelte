<script>
  import { changesFrom } from '../lib/save.js';

  export let task;
  export let onAct = null;
  export let onOriginal = null;

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
    missing: (label) => `The app’s “${label}” control is not on this page — use Full page.`,
    ambiguous: (label, n) => `“${label}” appears ${n} times on this page — use Full page.`,
    'no-action': () => 'This page has no control to press — use Full page.'
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
        : `Could not press “${action.label}” — use Full page.`;
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
</script>

<svelte:window on:keydown={onKey} />

<div class="sd-task">
  <div class="sd-editorbar">
    <span class="sd-dirty">
      {task.fields.length} field{task.fields.length === 1 ? '' : 's'}{dirty ? ` · ${changes.length} edited` : ''}
    </span>
    <div class="sd-editor-actions">
      <button class="sd-btn" type="button" disabled={!dirty || busy} on:click={reset}>Reset</button>
      {#each task.actions as action}
        <button
          class="sd-btn"
          class:sd-primary={action === task.primary}
          type="button"
          disabled={busy}
          title={action.onclick || action.label}
          on:click={() => act(action)}
        >{pressed === action.label && busy ? `${action.label}…` : action.label}</button>
      {/each}
      {#if onOriginal}
        <button class="sd-btn" type="button" on:click={onOriginal}>Full page</button>
      {/if}
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
