<script>
  // A cell that goes somewhere — a student, a class, a charge.
  //
  // The link fills its cell, so the whole box is the target, and it stays quiet
  // until the pointer arrives: then the cell takes the accent wash and a hairline,
  // the name turns accent and underlines, and the chevron travels from beside the
  // name to the cell's right edge. Nothing else in the row moves: the row's own
  // hover was removed for exactly this reason.
  export let href = '';
  export let text = '';
  export let title = 'Open in the app';
</script>

<a class="sd-celllink" {href} {title}>
  <span class="sd-celllink-name">{text}</span>
  <span class="sd-celllink-gap"></span>
  <span class="sd-celllink-go" aria-hidden="true">›</span>
</a>
