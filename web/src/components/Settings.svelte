<script>
  import { settingsChanges } from '../lib/settings.js';

  export let settings;
  export let onSave = null;
  export let onOriginal = null;

  const initial = {};
  for (const field of settings.fields) initial[field.key] = field.value;
  let values = { ...initial };
  let status = '';
  let busy = false;

  $: changes = settingsChanges(settings, values);
  $: dirty = changes.length > 0;

  // Every control the page has. Some of these pages are not "flip a setting and
  // save": the enroll step is two date pickers and the app's own Enroll and
  // Cancel. Showing only a Save button left that screen with no way forward, so
  // the whole row is offered and each one presses its own control on the live
  // page.
  $: pageSave = (settings.actions || []).find((a) => a.id === 'save');
  $: buttons = (settings.actions || []).filter((a) => a !== pageSave && a.id !== 'save' && !/^save$/i.test(a.label));
  // A page with buttons of its own has its own submit; the top bar's Save is
  // the generic one and must not be offered beside them. That is the trap the
  // enroll step fell into: "Save" where the app wanted "Enroll".
  $: saveTarget = buttons.length
    ? pageSave
    : (pageSave || settings.save || settings.primary);
  // A label that came from the field's own name is a guess, and says so.
  $: guessed = settings.fields.filter((f) => f.source === 'name').length;
  // "One button that saves" reads very differently from "a step with its own
  // two buttons", and the footnote has to say which this page is.
  $: flow = buttons.length > 0;

  function press(action) {
    if (busy) return;
    const isSave = !action || action === saveTarget;
    if (isSave && !dirty) {
      status = 'Nothing to save.';
      return;
    }
    if (!onSave) {
      status = 'No save handler was attached.';
      return;
    }
    busy = true;
    const result = onSave(values, action || saveTarget);
    busy = false;

    if (!result || !result.submitted) {
      const label = (action && action.label) || 'Save';
      status = result && result.reason === 'ambiguous'
        ? `“${label}” appears ${result.matches} times on the page — use Full page.`
        : `The app’s “${label}” control is not on this page — use Full page.`;
      return;
    }
    const n = result.applied.length;
    status = n
      ? `Sent ${n} change${n === 1 ? '' : 's'} to the app’s ${result.label || 'Save'}…`
      : `Asked the app to run “${result.label || 'Save'}”…`;
  }

  function save() {
    press(null);
  }

  function reset() {
    values = { ...initial };
    status = '';
  }

  function onKey(e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  }
</script>

<svelte:window on:keydown={onKey} />

<div class="sd-settings">
  <div class="sd-editorbar">
    <span class="sd-dirty">
      {settings.fields.length} setting{settings.fields.length === 1 ? '' : 's'}{dirty ? ` · ${changes.length} changed` : ''}
    </span>
    <div class="sd-editor-actions">
      <button class="sd-btn" type="button" disabled={!dirty || busy} on:click={reset}>Reset</button>
      {#if saveTarget}
        <button class="sd-btn sd-primary" type="button" disabled={!dirty || busy} on:click={save}>
          {busy ? 'Saving…' : (saveTarget.label || 'Save')}
        </button>
      {/if}
      {#each buttons as action (action.id + action.label)}
        <button
          class="sd-btn"
          class:sd-primary={!saveTarget && action === settings.primary}
          type="button"
          disabled={busy}
          title={action.onclick || `${action.label} (the app’s own control)`}
          on:click={() => press(action)}
        >{action.label}</button>
      {/each}
      {#if onOriginal}
        <button class="sd-btn" type="button" on:click={onOriginal}>Full page</button>
      {/if}
    </div>
  </div>

  {#if status}<p class="sd-editorstatus">{status}</p>{/if}

  <div class="sd-settingsbody">
    <div class="sd-settinglist">
      {#each settings.fields as field}
        <div class="sd-setting">
          <label class="sd-settinglabel" for={field.type === 'radio' ? undefined : field.selector}>
            <span class="sd-settingtext">{field.label}</span>
            {#if field.source === 'name'}
              <!-- Under the name, not beside it: a chip on the same line reads as
                   a second label, which is exactly how it looked on the enroll
                   screen. This is a note about where the name came from. -->
              <span class="sd-settingguess" title="The page prints no label for this control; this is its field name">from field name</span>
            {/if}
          </label>
          <div class="sd-settingcontrol">
            {#if field.type === 'radio'}
              <div class="sd-radios">
                {#each field.options as option}
                  <label class="sd-check">
                    <input type="radio" name={field.group} value={option.value} bind:group={values[field.key]} />
                    <span>{option.label}</span>
                  </label>
                {/each}
              </div>
            {:else if field.type === 'checkbox'}
              <label class="sd-check">
                <input type="checkbox" bind:checked={values[field.key]} />
                <span>{values[field.key] ? 'On' : 'Off'}</span>
              </label>
            {:else if field.type === 'select'}
              <select class="sd-input" bind:value={values[field.key]}>
                {#each field.options as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            {:else if field.type === 'textarea'}
              <textarea class="sd-input sd-textarea" rows="4" bind:value={values[field.key]}></textarea>
            {:else}
              <input class="sd-input" type="text" bind:value={values[field.key]} />
            {/if}
          </div>
        </div>
      {/each}
    </div>

    {#if guessed}
      <p class="sd-panelnote">
        {#if guessed === 1}
          One control here has no label on the page, so its field name stands in — marked “from field name”.
        {:else}
          {guessed} controls here have no label on the page, so their field names stand in — marked “from field name”.
        {/if}
      </p>
    {/if}

    {#if flow}
      <p class="sd-panelnote">
        The buttons are the app’s own controls: the values here are written into the
        page and then that control is pressed, so its validation and whatever follows
        are unchanged.
      </p>
    {:else}
      <p class="sd-panelnote">
        The button is the app’s own: the change is written into this page and the app
        saves it, so validation and anything it does afterwards are unchanged.
      </p>
    {/if}
  </div>
</div>
