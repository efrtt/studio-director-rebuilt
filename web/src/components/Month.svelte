<script>
  // The month grid: the calendar's own view, drawn as a calendar. Seven columns,
  // one row per week, the date in the corner of its cell, events as chips with
  // their time set apart from their name. The app's own controls are kept —
  // prev/next, the season picker, the Daily Staff / Week links — because those
  // are the ways out of this screen.
  export let month;
  export let period = null;
  export let onPeriod = null;

  function switchSeason(event) {
    if (onPeriod) onPeriod(event.currentTarget.value);
  }

  // "Aug 2026" against today's own date, so the current day can be marked
  // without the page having to say which day it is.
  $: stamp = (() => {
    const match = String(month.label || '').match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
    if (!match) return null;
    const when = new Date(`${match[1]} 1, ${match[2]}`);
    return Number.isNaN(when.getTime()) ? null : { month: when.getMonth(), year: when.getFullYear() };
  })();

  const today = new Date();
  function isToday(day) {
    return !!stamp
      && stamp.year === today.getFullYear()
      && stamp.month === today.getMonth()
      && day.day === today.getDate();
  }
</script>

<div class="sd-month">
  <div class="sd-monthbar">
    <div class="sd-monthnav">
      {#if month.prev}
        <a class="sd-btn sd-monthstep" href={month.prev.href} title={month.prev.text}>‹ Prev</a>
      {:else}
        <span class="sd-btn sd-monthstep sd-monthstep--off">‹ Prev</span>
      {/if}
      <span class="sd-monthlabel">{month.label || month.title}</span>
      {#if month.next}
        <a class="sd-btn sd-monthstep" href={month.next.href} title={month.next.text}>Next ›</a>
      {:else}
        <span class="sd-btn sd-monthstep sd-monthstep--off">Next ›</span>
      {/if}
    </div>

    <div class="sd-monthtools">
      {#if month.views && month.views.length}
        <span class="sd-viewswitch">
          {#each month.views as view}
            <a class="sd-viewlink" href={view.href}>{view.label}</a>
          {/each}
          <span class="sd-viewlink sd-viewlink--on" aria-current="page">Month</span>
        </span>
      {/if}

      {#if period && period.options.length}
        <label class="sd-periodlabel" for="sd-month-period">{period.label}</label>
        <select id="sd-month-period" class="sd-periodselect" on:change={switchSeason}>
          {#each period.options as option}
            <option value={option.value} selected={option.value === period.value}>{option.label}</option>
          {/each}
        </select>
      {/if}
    </div>
  </div>

  <div class="sd-monthgrid">
    <div class="sd-monthhead">
      {#each month.weekdays as weekday}
        <div class="sd-monthweekday">{weekday}</div>
      {/each}
    </div>

    {#each month.weeks as week}
      <div class="sd-monthweek">
        {#each week as day}
          <div
            class="sd-day"
            class:sd-day--blank={day.day == null}
            class:sd-day--weekend={day.weekend}
            class:sd-day--today={isToday(day)}
            class:sd-day--holiday={!!day.holiday}
          >
            {#if day.day != null}
              <div class="sd-daytop">
                {#if day.href}
                  <a class="sd-daynum" href={day.href} title="Open {day.day} in the app">{day.day}</a>
                {:else}
                  <span class="sd-daynum">{day.day}</span>
                {/if}
                {#if day.holiday}<span class="sd-holiday">{day.holiday}</span>{/if}
              </div>

              {#if day.events.length}
                <div class="sd-dayevents">
                  {#each day.events as event}
                    <a class="sd-event" href={event.href} title={event.title || event.label}>
                      {#if event.time}<span class="sd-eventtime">{event.time}</span>{/if}
                      <span class="sd-eventname">{event.text}</span>
                    </a>
                  {/each}
                </div>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    {/each}
  </div>
</div>
