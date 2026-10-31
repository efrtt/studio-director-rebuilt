<script>
  export let note;
  export let onPress = null;
  export let onOriginal = null;

  let status = '';

  function press(action) {
    if (!onPress) {
      status = 'No handler was attached for this page.';
      return;
    }
    status = '';
    const result = onPress(action);
    if (!result || !result.submitted) {
      status = `Could not press “${action.label}” — use Full page.`;
      return;
    }
    status = `Asked the app to run “${action.label}”…`;
  }
</script>

<div class="sd-task">
  <div class="sd-editorbar">
    <span class="sd-dirty">
      {note.lines.length} line{note.lines.length === 1 ? '' : 's'} &middot; {note.actions.length} control{note.actions.length === 1 ? '' : 's'}
    </span>
    <div class="sd-editor-actions">
      {#each note.actions as action}
        <button
          class="sd-btn"
          class:sd-primary={action === note.primary}
          type="button"
          title={action.onclick || action.label}
          on:click={() => press(action)}
        >{action.label}</button>
      {/each}
      {#if onOriginal}
        <button class="sd-btn" type="button" on:click={onOriginal}>Full page</button>
      {/if}
    </div>
  </div>

  {#if status}<p class="sd-editorstatus">{status}</p>{/if}

  <div class="sd-editorbody">
    {#each note.lines as line}
      <p class="sd-noteline">{line}</p>
    {/each}
    <p class="sd-panelnote">
      These are the app’s own controls: pressing one sends the page through the
      app, so its validation and any follow-on step happen as usual.
    </p>
  </div>
</div>
