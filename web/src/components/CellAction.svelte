<script>
  // One control in a table cell — Drop, Enroll, Edit.
  //
  // The label decides the shape: a known verb becomes a 26px round button holding
  // Font Awesome's own path as a mask, with the word kept for screen readers and
  // for anything that never loads the CSS. An unknown verb keeps its text pill,
  // because a guessed icon is worse than a word.
  import { actionIcon } from '../lib/actionicon.js';

  export let href = '';
  export let label = '';
  export let title = '';
  // A guard the caller wants between the press and the app's own link: the
  // event page's delete asks before it leaves, and an unsaved arrangement asks
  // before anything navigates away from it.
  export let onPress = null;

  $: icon = actionIcon(label);
</script>

<a
  class="sd-pill"
  class:sd-pill--icon={!!icon}
  {href}
  title={title || label}
  on:click={(e) => { if (onPress) onPress(e); }}
>
  {#if icon}
    <span class="sd-icon sd-icon--{icon}" aria-hidden="true"></span>
    <span class="sd-sr">{label}</span>
  {:else}{label}{/if}
</a>
