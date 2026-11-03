<script>
  export let kind = 'none';
  export let message = '';
  export let onAction = () => {};

  const COPY = {
    expired: {
      title: 'Session expired',
      body: 'The Studio Director signed this session out.'
    },
    error: {
      title: 'Could not load that page',
      body: 'The request failed.'
    },
    none: {
      title: 'No view for this page yet',
      body: 'This screen has no form, table or control to read.'
    }
  };

  $: copy = COPY[kind] || COPY.none;
</script>

<div class="sd-state">
  <h2>{copy.title}</h2>
  <p>{message || copy.body}</p>
  <button class="sd-btn" type="button" on:click={onAction}>Open the original page</button>
</div>
