<script>
  export let confirm;
  export let onPress = null;
  // The page that posted the form, when there is one.
  export let back = null;

  // The app's own sentence, verbatim. Nothing is invented: if the page said
  // "Hopper Family has been updated." that is the whole screen.
  $: message = confirm.message || (confirm.ok ? 'Saved.' : 'Not saved.');

  let status = '';

  function press(action) {
    if (!onPress) {
      status = 'No handler was attached for this page.';
      return;
    }
    status = '';
    const result = onPress(action);
    if (!result || !result.submitted) {
      status = `Could not press \u201c${action.label}\u201d \u2014 use Original.`;
      return;
    }
    status = `Asked the app to run \u201c${action.label}\u201d\u2026`;
  }
</script>

{#if confirm.pending}
  <div class="sd-confirm">
    <div class="sd-confirm-card">
      <div class="sd-confirm-mark sd-confirm-mark--ask" aria-hidden="true">?</div>
      <p class="sd-confirm-msg">{confirm.title}</p>
      {#each confirm.lines as line}
        <p class="sd-confirm-hint">{line}</p>
      {/each}
      <div class="sd-editor-actions sd-confirm-actions">
        {#each confirm.actions as action}
          <button
            class="sd-btn sd-primary"
            type="button"
            title={action.onclick || action.label}
            on:click={() => press(action)}
          >{action.label}</button>
        {/each}
      </div>
      {#if status}<p class="sd-editorstatus">{status}</p>{/if}
    </div>
  </div>
{:else}
  <div class="sd-confirm">
    <div class="sd-confirm-card" class:sd-confirm-card--bad={!confirm.ok}>
      <div class="sd-confirm-mark" aria-hidden="true">{confirm.ok ? '✓' : '!'}</div>
      <p class="sd-confirm-msg">{message}</p>
      <p class="sd-confirm-hint">
        {confirm.ok ? 'Saved by the app itself.' : 'The app did not accept the change.'}
      </p>
      {#if confirm.links && confirm.links.length}
        <div class="sd-editor-actions sd-confirm-actions">
          {#each confirm.links as link}
            <a class="sd-btn" href={link.href} title={link.href}>{link.label}</a>
          {/each}
        </div>
      {:else if back && back.href}
        <div class="sd-editor-actions sd-confirm-actions">
          <a class="sd-btn" href={back.href} title={back.href}>{back.label}</a>
        </div>
      {/if}
    </div>
  </div>
{/if}
