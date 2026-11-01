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
                <a class="sd-weekrow" href={row.href} title={titleOfRow(row)}>
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
                      class:sd-block--full={block.status === 'full'}
                      class:sd-block--low={block.status === 'open' && block.spotsLeft <= 2}
                      class:sd-block--short={block.height < 46}
                      href={block.href}
                      title={titleOf(block)}
                      style={`top:${block.top}px;height:${block.height}px;` +
                        `background:${block.color || 'transparent'};` +
                        `color:${block.textColor || inkFor(block.color) || 'inherit'}`}
                    >
                      <span class="sd-block-name">{block.name}</span>
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
              <a class="sd-chip" href={block.href} title={titleOf(block)}>
                {block.code}{block.code ? ' ' : ''}{block.name}
              </a>
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  {/if}
</div>
