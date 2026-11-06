<script>
  import RecordPage from './RecordPage.svelte';

  export let confirm;
  export let onPress = null;
  // The page that posted the form, when there is one.
  export let back = null;
  // The page's own bar (New) and URL, when this answer also carries the list.
  export let bar = null;
  export let url = '';
  // The list the save came from, read from the same response.
  export let records = null;

  // The app's own sentence, verbatim. Nothing is invented: if the page said
  // "Hopper Family has been updated." that is the whole screen.
  $: message = confirm.message || (confirm.ok ? 'Saved.' : 'Not saved.');

  // A save lands on the app's answer page, which shows the sentence and the list
  // you carried on from. Drawn as that list with the sentence above it — that is
  // what the original looks like, and it means a save returns you to the table
  // instead of to a card with nowhere to go. A refusal has no list to return to,
  // so it keeps the card that says so.
  // The app's own delete question has the same shape: the list it will change, and
  // one sentence about it. That one is drawn as the list with the question in a
  // dialog over it, so answering it looks like the editing it belongs to.
  $: asked = confirm && confirm.pending && confirm.ask ? confirm.ask : null;
  $: table = confirm.ok && records && records.tables && records.tables.length
    && (!confirm.pending || asked)
    ? records
    : null;

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

{#if table}
  <RecordPage
    source={table}
    {url}
    {bar}
    title={confirm.title || ''}
    notice={confirm.pending ? '' : message}
    question={asked}
  />
{:else if confirm.pending}
  <div class="sd-confirm">
    <div class="sd-confirm-card">
      <div class="sd-confirm-mark sd-confirm-mark--ask" aria-hidden="true">?</div>
      <p class="sd-confirm-msg">{confirm.title}</p>
      {#each confirm.lines || [] as line}
        <p class="sd-confirm-hint">{line}</p>
      {/each}
      <div class="sd-editor-actions sd-confirm-actions">
        <!-- The page's first answer is the one it is asking you to take; the
             second (Cancel, usually) is the way out and stays plain. -->
        {#each confirm.actions as action, i}
          <button
            class="sd-btn"
            class:sd-primary={i === 0}
            type="button"
            title={action.href || action.onclick || action.label}
            on:click={() => press(action)}
          >{action.label}</button>
        {/each}
        <!-- The page's way out, beside its answer: the drop question offers
             Drop and Cancel, and this card is the whole screen. -->
        {#each confirm.links || [] as link}
          <a class="sd-btn" href={link.href} title={link.href}>{link.label}</a>
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
        {confirm.ok ? 'Saved.' : 'The app did not accept the change.'}
      </p>
      {#if confirm.links && confirm.links.length}
        <div class="sd-editor-actions sd-confirm-actions">
          <!-- The first is the record the outcome is about ("Back to Lily"), or
               the page's own crumb when it offers nothing else: the way on. -->
          {#each confirm.links as link, i}
            <a class="sd-btn" class:sd-primary={i === 0} href={link.href} title={link.href}>{link.label}</a>
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
