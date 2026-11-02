<script>
  import { PX_PER_MIN } from '../lib/calendar.js';
  import { inkFor } from '../lib/color.js';

  export let week;
  // The app's own season picker, read on the live page (see lib/period.js).
  // Absent on the demos and on any page without one, so nothing renders.
  export let period = null;
  export let onPeriod = null;
  // The app's own toolbar: previous and next week, and the other views
  // (lib/calnav.js). Also read at mount time, so nothing is invented here.
  export let nav = null;

  $: hourHeight = 60 * PX_PER_MIN;
  $: viewLinks = nav && nav.views ? nav.views : [];

  function switchSeason(event) {
    const value = event.currentTarget.value;
    if (onPeriod) onPeriod(value);
  }

  function titleOf(block) {
    return block.details.length ? block.details.join('\n') : [block.name, block.meta].filter(Boolean).join('\n');
  }

  function titleOfRow(row) {
    return row.details.length ? row.details.join('\n') : row.name;
  }

  // The app's own hover card, rebuilt: the class's detail lines, following the
  // pointer so the block underneath stays readable. The card never takes the
  // pointer, so there is nothing to flicker on the way to it.
  let tip = null;

  function noteOf(source) {
    const details = source.details || [];
    // A newline without a backslash escape: the patch that wrote this file
    // through a shell turned the escape into a real line break.
    const sep = String.fromCharCode(10);
    const text = details.length
      ? details.join(sep)
      : (source.time !== undefined ? titleOfRow(source) : titleOf(source));
    return text.split(sep).filter(Boolean);
  }

  // Flip the card to the left of the pointer near the right edge, and lift it
  // near the bottom, so it is never half outside the window.
  function placeAt(x, y) {
    const left = x + 16 + 288 > window.innerWidth ? Math.max(8, x - 304) : x + 16;
    const top = Math.max(8, Math.min(y + 20, window.innerHeight - 140));
    return 'left:' + left + 'px;top:' + top + 'px';
  }

  function showTip(event, source) {
    const lines = noteOf(source);
    if (!lines.length) return;
    tip = { lines, pos: placeAt(event.clientX, event.clientY) };
  }

  function moveTip(event) {
    if (!tip) return;
    tip = { lines: tip.lines, pos: placeAt(event.clientX, event.clientY) };
  }

  function hideTip() {
    tip = null;
  }
</script>

<div class="sd-week">
  {#if nav || (period && period.options.length)}
    <div class="sd-monthbar sd-weekbar">
      <div class="sd-monthnav">
        {#if nav}
          {#if nav.prev}
            <a class="sd-btn sd-monthstep" href={nav.prev.href} title={nav.prev.text}>‹ Prev</a>
          {:else}
            <span class="sd-btn sd-monthstep sd-monthstep--off">‹ Prev</span>
          {/if}
          {#if nav.range || week.week}<span class="sd-monthlabel">{nav.range || week.week}</span>{/if}
          {#if nav.next}
            <a class="sd-btn sd-monthstep" href={nav.next.href} title={nav.next.text}>Next ›</a>
          {:else}
            <span class="sd-btn sd-monthstep sd-monthstep--off">Next ›</span>
          {/if}
        {/if}
      </div>

      <div class="sd-monthtools">
        {#if viewLinks.length}
          <span class="sd-viewswitch">
            {#each viewLinks as view}
              <a class="sd-viewlink" href={view.href}>{view.label}</a>
            {/each}
            <span class="sd-viewlink sd-viewlink--on" aria-current="page">Week</span>
          </span>
        {/if}

        {#if period && period.options.length}
          <label class="sd-periodlabel" for="sd-week-period">{period.label}</label>
          <select id="sd-week-period" class="sd-periodselect" on:change={switchSeason}>
            {#each period.options as option}
              <option value={option.value} selected={option.value === period.value}>{option.label}</option>
            {/each}
          </select>
        {/if}
      </div>
    </div>
  {/if}

  {#if !nav && week.week}
    <div class="sd-period">{week.week}</div>
  {/if}

  {#if week.layout === 'list'}
    <!-- The app's compact week: one row per class, time first, location last.
         Its columns are a class's parts, not studios, so it is drawn as a list
         rather than forced onto the studio timeline. -->
    <div class="sd-weeklist">
      {#each week.days as day}
        <section class="sd-dayblock sd-dayblock--list">
          <h3 class="sd-dayname">{day.label}</h3>

          {#if day.rows.length}
            <div class="sd-dayrows">
              {#each day.rows as row}
                <a
                  class="sd-weekrow"
                  href={row.href}
                  on:pointerenter={(event) => showTip(event, row)}
                  on:pointermove={moveTip}
                  on:pointerleave={hideTip}
                >
                  <span class="sd-weekrow-time">{row.time}</span>
                  <span class="sd-weekrow-name">
                    {row.name}
                    {#if row.status === 'full'}<span class="sd-weekrow-tag">Full</span>{/if}
                  </span>
                  {#if row.location}<span class="sd-weekrow-loc">{row.location}</span>{/if}
                </a>
              {/each}
            </div>
          {:else}
            <p class="sd-none">No classes</p>
          {/if}
        </section>
      {/each}
    </div>
  {:else}
    {#each week.days as day}
      <section class="sd-dayblock">
        <h3 class="sd-dayname">{day.label}</h3>

        {#if day.columns.length}
          <div class="sd-headrow" style={`--cols:${day.columns.length}`}>
            <div class="sd-headspacer"></div>
            {#each day.columns as column}
              <div class="sd-studiohead">{column.label}</div>
            {/each}
          </div>

          <div class="sd-timeline" style={`height:${day.height + 18}px;--hour:${hourHeight}px`}>
            <div class="sd-gutter">
              {#each day.hours as hour}
                <span class="sd-hourlabel" style={`top:${hour.top}px`}>{hour.label}</span>
              {/each}
            </div>

            <div class="sd-studiocols" style={`--cols:${day.columns.length}`}>
              {#each day.columns as column}
                <div class="sd-studiocol">
                  {#each column.blocks as block}
                    <a
                      class="sd-block"
                      class:sd-block--short={block.height < 46}
                      href={block.href}
                      on:pointerenter={(event) => showTip(event, block)}
                      on:pointermove={moveTip}
                      on:pointerleave={hideTip}
                      style={`top:${block.top}px;height:${block.height}px;` +
                        `background:${block.color || 'transparent'};` +
                        `color:${block.textColor || inkFor(block.color) || 'inherit'}`}
                    >
                      <span class="sd-block-name">
                        {block.name}{#if block.initials}<span class="sd-block-init">&nbsp;({block.initials})</span>{/if}
                      </span>
                      {#if block.meta}<span class="sd-block-meta">{block.meta}</span>{/if}
                    </a>
                  {/each}
                </div>
              {/each}
            </div>
          </div>
        {:else if !day.untimed.length}
          <p class="sd-none">No classes</p>
        {/if}

        {#if day.untimed.length}
          <div class="sd-untimed">
            <span class="sd-untimed-label">No time given</span>
            {#each day.untimed as block}
              <a
                class="sd-chip"
                href={block.href}
                on:pointerenter={(event) => showTip(event, block)}
                on:pointermove={moveTip}
                on:pointerleave={hideTip}
              >
                {block.code}{block.code ? ' ' : ''}{block.name}
              </a>
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  {/if}
  {#if tip}
    <div class="sd-tip" role="tooltip" style={tip.pos}>
      {#each tip.lines as line}<div class="sd-tip-line">{line}</div>{/each}
    </div>
  {/if}
</div>
