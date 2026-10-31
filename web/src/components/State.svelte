<script>
  export let kind = 'none';
  export let message = '';
  export let onAction = () => {};

  const COPY = {
    expired: {
      title: 'Session expired',
      body: 'The Studio Director signed this session out. Open the original page, sign in, then reload.'
    },
    error: {
      title: 'Could not load that page',
      body: 'The request failed. The original page is still there.'
    },
    none: {
      title: 'No view for this page yet',
      body: 'This screen has no form, table or control that this build can read. The original page is one click away.'
    }
  };

  $: copy = COPY[kind] || COPY.none;
</script>

<div class="sd-state">
  <h2>{copy.title}</h2>
  <p>{message || copy.body}</p>
  <button class="sd-btn" type="button" on:click={onAction}>Open the original page</button>
</div>
