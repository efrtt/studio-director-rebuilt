<script>
  import { onMount, tick } from 'svelte';
  import { changesFrom } from '../lib/save.js';

  export let title = 'Record';
  export let eyebrow = 'Editing';
  export let rows = [];
  export let fields = [];
  export let width = 'mid';
  export let saveLabel = 'Save';
  // Where Cancel goes. Empty when the dialog was opened on its own page instead
  // of by a URL, and then Cancel just closes it.
  export let cancelHref = '';
  export let onCancel = null;
  // The record's own bar controls — Delete, Print — pressed on the live page.
  export let actions = [];
  export let onAction = null;
  // (values) => { submitted, reason?, missing? } — the page's own save.
  export let onSave = null;

  // Seeded from the server's values, so an untouched field is never written back
  // and the app keeps everything this screen does not show.
  const initial = {};
  for (const field of fields) {
    initial[field.key] = field.type === 'checkbox' ? !!field.checked : field.value;
  }
  let values = { ...initial };
  let status = '';
  let busy = false;
  let body = null;
  // A question this screen asks itself. The browser's confirm() is not used
  // here: it blocks the page the dialog is covering and looks nothing like it.
  let asked = null;

  $: changes = changesFrom({ fields }, values);
  $: dirty = changes.length > 0;

  const why = {
    missing: 'A field on this form is not on the page — use Original.',
    'no-save-link': 'This page has no Save control — use Original.',
    unchanged: 'Nothing changed.'
  };

  function finish() {
    if (onCancel) {
      onCancel();
      return;
    }
    if (cancelHref) location.href = cancelHref;
  }

  function close() {
    if (dirty) {
      asked = { kind: 'discard' };
      return;
    }
    finish();
  }

  function onBackdrop(e) {
    if (e.target === e.currentTarget) close();
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (asked) asked = null;
      else close();
      return;
    }
    // The dialog is the screen while it is open: one save shortcut, in the same
    // place the rest of the rebuild puts it.
    if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 's') {
      e.preventDefault();
      submit();
    }
  }

  function accept() {
    asked = null;
    finish();
  }

  // One request, made by clicking the app's own control on the live page: the
  // app's validation and its own next screen are unchanged.
  function press(action) {
    if (busy) return;
    if (!onAction) {
      status = 'This page has no handler for its own controls.';
      return;
    }
    busy = true;
    status = '';
    const result = onAction(action);
    busy = false;
    if (!result || !result.submitted) {
      status = result && result.reason === 'ambiguous'
        ? `“${action.label}” appears ${result.matches} times on the page — use Original.`
        : `The app’s “${action.label}” control is not on this page — use Original.`;
      return;
    }
    status = `Asked the app to run “${action.label}”…`;
  }

  function submit() {
    if (busy) return;
    if (!dirty) { status = 'Nothing changed.'; return; }
    if (!onSave) { status = 'No save handler was attached to this page.'; return; }
    busy = true;
    status = '';
    const result = onSave(values);
    if (!result || !result.submitted) {
      busy = false;
      status = why[result && result.reason] || 'The save did not go through — use Original.';
      return;
    }
    status = 'Saved. The app is taking you back to the list…';
  }

  onMount(async () => {
    await tick();
    const first = body && body.querySelector('input:not([type="hidden"]), select, textarea');
    if (first && first.focus) first.focus();
  });
</script>

<svelte:window on:keydown={onKey} />

<div class="sd-overlay" role="presentation" on:click={onBackdrop}>
  <div
    class="sd-dialog sd-dialog--{width}"
    role="dialog"
    aria-modal="true"
    aria-label={title}
  >
    <div class="sd-dialog-head">
      <div>
        <div class="sd-eyebrow">{eyebrow}</div>
        <h2 class="sd-dialog-title">{title}</h2>
      </div>
      <button class="sd-dialog-x" type="button" aria-label="Close" title="Close" on:click={close}>✕</button>
    </div>

    <div class="sd-dialog-body" bind:this={body}>
      <table class="sd-fields">
        <tbody>
          {#each rows as row}
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

      {#if status}<p class="sd-dialogstatus">{status}</p>{/if}
    </div>

    {#if asked}
      <div class="sd-dialog-ask">
        <span>{changes.length} unsaved change{changes.length === 1 ? '' : 's'} will be lost.</span>
        <span class="sd-dialog-actions">
          <button class="sd-btn" type="button" on:click={() => (asked = null)}>Go back</button>
          <button class="sd-btn sd-primary" type="button" on:click={accept}>Discard changes</button>
        </span>
      </div>
    {/if}

    <div class="sd-dialog-foot">
      <span class="sd-dialog-left">
        {#each actions as action}
          <button
            class="sd-btn"
            class:sd-btn--danger={action.danger}
            type="button"
            title={action.onclick || action.label}
            disabled={busy}
            on:click={() => press(action)}
          >{action.label}</button>
        {/each}
        <span class="sd-dirty">
          {dirty ? `${changes.length} unsaved change${changes.length === 1 ? '' : 's'}` : 'No changes'}
        </span>
      </span>
      <span class="sd-dialog-actions">
        <button class="sd-btn" type="button" disabled={busy} on:click={close}>Cancel</button>
        <button
          class="sd-btn sd-primary"
          type="button"
          disabled={!dirty || busy}
          title="Save these changes with the app’s own Save"
          on:click={submit}
        >{busy ? 'Saving…' : saveLabel}</button>
      </span>
    </div>
  </div>
</div>
