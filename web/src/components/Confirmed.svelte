<script>
  export let confirm;

  // The app's own sentence, verbatim. Nothing is invented: if the page said
  // "Hopper Family has been updated." that is the whole screen.
  $: message = confirm.message || (confirm.ok ? 'Saved.' : 'Not saved.');
</script>

<div class="sd-confirm">
  <div class="sd-confirm-card" class:sd-confirm-card--bad={!confirm.ok}>
    <div class="sd-confirm-mark" aria-hidden="true">{confirm.ok ? '✓' : '!'}</div>
    <p class="sd-confirm-msg">{message}</p>
    <p class="sd-confirm-hint">
      {confirm.ok ? 'Saved by the app itself.' : 'The app did not accept the change.'}
    </p>
  </div>
</div>
