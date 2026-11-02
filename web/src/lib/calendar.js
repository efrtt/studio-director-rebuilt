// Week calendar adapter.
//
// Confirmed from a live dump of page=CalendarPage. The page is seven
// `table.TimeBlock` sections, one per weekday:
//
//   table.TimeBlock > tbody > tr > th            "Monday"      (day heading)
//                              > tr > td / td     hour text, then the lanes
//
// Inside the second cell each class is absolutely positioned with inline styles:
//
//   <div style="top:90px;left:0%;width:25%;height:89px">
//     <div style="background-color:#00ffff;z-index:100000">
//       <a href="...page=EditClass&cident=..."> <b>3:45p</b>
//         Stu 1 - 818 Ballet - 6-7 - HM - 3:45 PM - 4:30 PM - 15 of 15 spots taken
//       </a>
//     </div>
//     <span style="display:none">Ballet<br>Ms. Rivera<br>Studio 1<br>
//       3 spots available<br>0 waitlisted<br>Ages: 6-7</span>
//   </div>
//
// `left` is the studio lane (25% steps = four studios) and the visible text
// carries the studio, the class number and the start/end times. The hidden span
// holds the details. Both are read as data; nothing here interprets colour.
//
// The view is built from the *times*, not from the app's pixels: one studio per
// column, one day per section, and each block as tall as its duration.

import { qsa, qs, textOf } from './shell.js';

// Vertical scale of the rebuilt week view: minutes -> pixels.
export const PX_PER_MIN = 2;

const TIME_RANGE =
  /(\d{1,2}):(\d{2})\s*([ap])\.?m\.?\s*[-\u2013\u2014]\s*(\d{1,2}):(\d{2})\s*([ap])\.?m/i;
const STUDIO = /^\s*stu(?:dio)?\s*(\d+)\b/i;
// Classes taught by the studio's own faculty pool are placeholders for open
// studio time, not classes anyone attends. They are left off the week view, and
// counted so the number left off is never a mystery.
const FACULTY = /^\s*(?:\S+\s+)*faculty\s*$/i;
const CAPACITY = /(\d+)\s+of\s+(\d+)\s+spots?/i;
// The block's short summary carries the instructor's initials as a field of
// their own, right before the start time:
//   "Stu 3 - 914 Tn/Ad Tap - 18+ - SB - 11:00 AM - 12:00 PM"
const INITIALS = /\s-\s([A-Z]{1,4})\s*-\s*\d{1,2}:\d{2}/;
const TITLE = /^(?:mr|mrs|ms|miss|dr|mx)\.?$/i;

// A block whose text carries no initials takes them from the tooltip's full
// name. A title is not a name, so "Ms. Rivera" is R, not MR.
function initialsOf(name) {
  const words = String(name || '').split(/\s+/).filter((w) => w && !TITLE.test(w));
  if (!words.length) return '';
  const first = words[0][0].toUpperCase();
  return words.length === 1 ? first : first + words[words.length - 1][0].toUpperCase();
}

function styleMap(value) {
  const out = {};
  for (const part of String(value || '').split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    if (key) out[key] = part.slice(i + 1).trim();
  }
  return out;
}

function number(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

// The tooltip is <br>-separated, so it is split on <br>, not on textContent.
function linesOf(el) {
  const lines = [];
  let current = '';
  const walk = (node) => {
    for (const child of Array.from(node.childNodes || [])) {
      if (child.nodeType === 3) current += child.textContent;
      else if (child.tagName === 'BR') { lines.push(current.trim()); current = ''; }
      else walk(child);
    }
  };
  if (el) walk(el);
  if (current.trim()) lines.push(current.trim());
  return lines.filter(Boolean);
}

// Some tooltips label their own lines ("Class Name: Ballet III"). The label is
// the app's, not the class's, so it is stripped from the value. Only a known
// label is removed: a class genuinely called "Tap: Level 2" keeps its colon.
const LABEL = /^\s*(class\s*name|instructor\s*name|teacher\s*name|location\s*name|name|instructor|teacher|location|studio|room)\s*:\s*/i;
const unlabel = (value) => (value == null ? value : String(value).replace(LABEL, '').trim() || null);

// Documented order: class name, instructor, location, N spots available,
// N waitlisted, Ages. Availability is matched by pattern so a reordered tooltip
// still parses; the text fields fall back to that order.
function detailsOf(lines) {
  const info = {
    name: null, instructor: null, location: null,
    spotsLeft: null, waitlisted: null, ages: null, note: null
  };
  const rest = [];

  for (const line of lines) {
    const spots = line.match(/^(\d+)\s+spots?\s+available/i);
    if (spots && info.spotsLeft === null) { info.spotsLeft = Number(spots[1]); continue; }

    const wait = line.match(/^(\d+)\s+waitlist/i);
    if (wait && info.waitlisted === null) { info.waitlisted = Number(wait[1]); continue; }

    const ages = line.match(/^ages?\s*:?\s*(.+)$/i);
    if (ages && info.ages === null) { info.ages = ages[1].trim(); continue; }

    rest.push(line);
  }

  info.name = unlabel(rest[0]);
  info.instructor = unlabel(rest[1]);
  info.location = unlabel(rest[2]);
  if (rest.length > 3) info.note = rest.slice(3).join(' · ');
  return info;
}

function clock(hours, minutes, meridiem) {
  const hour = (Number(hours) % 12) + (/p/i.test(meridiem) ? 12 : 0);
  return hour * 60 + Number(minutes);
}

export function fmtTime(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mm).padStart(2, '0')}${h24 < 12 ? 'a' : 'p'}`;
}

export function fmtHour(minutes) {
  const h24 = Math.floor(minutes / 60) % 24;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12} ${h24 < 12 ? 'AM' : 'PM'}`;
}

function timesOf(text) {
  const m = String(text || '').match(TIME_RANGE);
  if (!m) return null;

  const start = clock(m[1], m[2], m[3]);
  let end = clock(m[4], m[5], m[6]);
  if (end <= start) end += 1440; // a class running past midnight
  return { start, end };
}

function laneOf(wrapper) {
  const style = styleMap(wrapper.getAttribute('style'));
  if (!style.left || !style.top) return null;

  const anchor = qs(wrapper, 'a[href]');
  if (!anchor) return null;

  const card = qsa(wrapper, 'div').find((d) => /background-color/i.test(d.getAttribute('style') || ''));
  const cardStyle = styleMap(card ? card.getAttribute('style') : '');
  const anchorStyle = styleMap(anchor.getAttribute('style'));

  // The block's bold lead field is not always the same field: the golden week
  // page sets the time there (`<b>3:45p</b> Stu 1 - 818 …`), the live calendar
  // sets the studio (`<b>Stu 3</b> - 914 Tn/Ad Tap …`). Neither is the class
  // number, so it is read for what it is rather than assumed to be the code.
  const bold = qs(anchor, 'b');
  const boldText = bold ? textOf(bold) : '';
  const boldIsStudio = STUDIO.test(boldText);
  const code = boldIsStudio ? '' : boldText;
  const raw = textOf(anchor);
  const text = code && raw.indexOf(code) === 0 ? raw.slice(code.length).trim() : raw;

  const tip = qsa(wrapper, 'span').find((s) => linesOf(s).length > 1);
  const details = linesOf(tip);
  const info = detailsOf(details);
  // The page's own initials win; the instructor's name is the fallback.
  info.initials = (raw.match(INITIALS) || [])[1] || initialsOf(info.instructor);

  // The visible text is the app's own summary: "Stu 2 - 122 Ballet - 14+ - JM -
  // 5:30 PM - 6:45 PM - 13 of 20 spots taken". Times come from it when present.
  const times = timesOf(text) || timesOf(details.join(' - '));
  // Three labels can carry the studio: the bold lead field, the start of the
  // visible text, and the tooltip's location line (which the app fills from the
  // class's own studio setting). The lane is the last resort only: a day with a
  // single studio open prints every block at `left:0%; width:100%`, which is not
  // studio 1 - reading the lane first put those classes in the wrong column.
  const studioMatch =
    boldText.match(STUDIO) ||
    text.match(STUDIO) ||
    String(info.location || '').match(STUDIO) ||
    null;
  const capacity = text.match(CAPACITY);
  const lane = {
    top: number(style.top) || 0,
    left: number(style.left) || 0,
    width: number(style.width) || 100,
    height: number(style.height) || 24
  };

  // Studio comes from one of the page's own labels, and from the lane the app
  // positioned the block in only when none of them names it.
  const studio = studioMatch ? Number(studioMatch[1]) : Math.round(lane.left / 25) + 1;

  return {
    code,
    text,
    label: info.name || text,
    name: info.name || text,
    instructor: info.instructor,
    location: info.location,
    ages: info.ages,
    initials: info.initials,
    note: info.note,
    spotsLeft: info.spotsLeft,
    waitlisted: info.waitlisted,
    taken: capacity ? Number(capacity[1]) : null,
    capacity: capacity ? Number(capacity[2]) : null,
    startsAt: times ? times.start : null,
    endsAt: times ? times.end : null,
    // Derived from the tooltip, never from colour. No tooltip -> unknown.
    status: info.spotsLeft == null ? 'unknown' : info.spotsLeft > 0 ? 'open' : 'full',
    href: anchor.getAttribute('href'),
    color: cardStyle['background-color'] || null,
    textColor: anchorStyle.color || null,
    studio,
    lane,
    details
  };
}

function lanesIn(cell) {
  const out = [];
  for (const div of qsa(cell, 'div')) {
    const entry = laneOf(div);
    if (entry) out.push(entry);
  }
  return out;
}

// How many are enrolled, not how many seats are left: "3 enrolled" is what a
// teacher reads off a block. A tooltip that only reports availability has it
// subtracted from the capacity, and an unknown stays unknown rather than "0".
function enrolledOf(entry) {
  const enrolled = entry.taken != null
    ? entry.taken
    : entry.capacity != null && entry.spotsLeft != null
      ? entry.capacity - entry.spotsLeft
      : null;
  return enrolled == null ? '' : `${enrolled} enrolled`;
}

function buildDay(label, blocks, studioCount) {
  const timed = blocks.filter((b) => b.startsAt != null && b.endsAt != null);

  if (!timed.length) {
    // Nothing to place on a clock: keep the day (and its classes) rather than
    // dropping them, but show them as plain entries.
    return { label, blocks, columns: [], hours: [], height: 0, untimed: blocks };
  }

  const dayStart = Math.floor(Math.min(...timed.map((b) => b.startsAt)) / 60) * 60;
  const dayEnd = Math.ceil(Math.max(...timed.map((b) => b.endsAt)) / 60) * 60;
  const height = (dayEnd - dayStart) * PX_PER_MIN;

  for (const block of blocks) {
    block.enrolled = enrolledOf(block);
    if (block.startsAt == null) continue;
    block.top = (block.startsAt - dayStart) * PX_PER_MIN;
    block.height = (block.endsAt - block.startsAt) * PX_PER_MIN;
    block.timeLabel = `${fmtTime(block.startsAt)}\u2013${fmtTime(block.endsAt)}`;
    block.meta = [block.timeLabel, block.enrolled].filter(Boolean).join(' \u00b7 ');
  }

  // Every day shows the same columns, so a class in studio 3 is always third
  // from the left even on a day when studios 1 and 2 are empty.
  const columns = Array.from({ length: studioCount }, (_, i) => i + 1).map((studio) => ({
    studio,
    label: `Studio ${studio}`,
    blocks: blocks
      .filter((b) => b.studio === studio && b.startsAt != null)
      .sort((a, b) => a.startsAt - b.startsAt || a.name.localeCompare(b.name))
  }));

  const hours = [];
  for (let minute = dayStart; minute <= dayEnd; minute += 60) {
    hours.push({ label: fmtHour(minute), top: (minute - dayStart) * PX_PER_MIN });
  }

  return {
    label,
    blocks,
    columns,
    hours,
    height,
    untimed: blocks.filter((b) => b.startsAt == null)
  };
}


// ---- the compact week ----
//
// The app draws a sparse week as one table, not seven TimeBlock sections:
//
//   <table class="WeekCal">
//     <tr><th colspan="4">Monday 8/24</th> … seven headings, one per day
//     <tr><td>3:00 - 4:15</td><td><a><span class="openClass">Jazz Master…
//         <td><a><img …></a></td><td>GI</td>        one class = four cells
//
// Each class takes the four cells of its day in one row: time, name, a type
// icon and the location, every one of them carrying the same href and the same
// `title` tooltip. Those columns are a class’s parts, not studios, so this is
// read as a list (`layout: "list"`) and drawn as one - forcing it onto the
// studio timeline would put classes in columns that mean nothing.
//
// An empty week is this same table with only its heading row, which is why it
// is a week with seven empty days rather than no view at all.

const AVAIL = /Avail:\s*(\d+)\s+of\s+(\d+)\s+slots?/i;
const WAIT = /Waitlisted:\s*(\d+)/i;

function weekCalDays(table) {
  const rows = qsa(table, "tr");
  if (!rows.length) return null;
  const headings = qsa(rows[0], "th");
  if (headings.length !== 7) return null;

  const days = headings.map((th) => ({ label: textOf(th), rows: [] }));

  for (const tr of rows.slice(1)) {
    const cells = qsa(tr, "td");
    const per = Math.round(cells.length / 7);
    if (!per) continue;

    for (let d = 0; d < 7; d += 1) {
      const group = cells.slice(d * per, d * per + per);
      const anchor = group.map((cell) => qs(cell, "a[href]")).find(Boolean);
      if (!anchor) continue;

      const holder = group.find((cell) => cell.getAttribute("title")) || null;
      const title = holder ? String(holder.getAttribute("title") || "") : "";
      const nameCell = group.find((cell) => qs(cell, ".openClass")) || null;
      const name = nameCell ? textOf(qs(nameCell, ".openClass")) : textOf(group[1] || group[0]);

      const avail = title.match(AVAIL);
      const wait = title.match(WAIT);
      const filled = avail ? Number(avail[1]) : null;
      const total = avail ? Number(avail[2]) : null;
      const spotsLeft = total != null && filled != null ? total - filled : null;

      days[d].rows.push({
        time: textOf(group[0]),
        name,
        href: anchor.getAttribute("href") || "",
        location: textOf(group[per - 1]),
        details: title.split(/[\r\n]+/).map((line) => line.trim()).filter(Boolean),
        spotsLeft,
        waitlisted: wait ? Number(wait[1]) : null,
        status: spotsLeft == null ? null : spotsLeft <= 0 ? "full" : "open"
      });
    }
  }

  return days;
}

function compactWeek(doc) {
  const table = qsa(doc, "table.WeekCal").find((t) => !(t.closest && t.closest(".tabContent"))) || null;
  if (!table) return null;
  const days = weekCalDays(table);
  if (!days) return null;

  const totals = { classes: 0, spots: 0, waitlisted: 0, full: 0 };
  for (const day of days) {
    for (const row of day.rows) {
      totals.classes += 1;
      if (row.spotsLeft != null) totals.spots += row.spotsLeft;
      if (row.waitlisted != null) totals.waitlisted += row.waitlisted;
      if (row.status === "full") totals.full += 1;
    }
  }

  return {
    kind: "week",
    layout: "list",
    days,
    studioCount: 0,
    hidden: 0,
    totals,
    week: textOf(qs(doc, ".contentInfo p")) || null,
    title: textOf(qs(doc, ".formTitle, .ReportName, h1")) || ""
  };
}

export function readWeek(doc) {
  // A record page's Calendar *tab* is also seven TimeBlock tables, shipped
  // hidden in the record's HTML. Those belong to the tab, not to the week view:
  // reading them would turn an editor into a calendar.
  const tables = qsa(doc, 'table.TimeBlock').filter((table) => !(table.closest && table.closest('.tabContent')));
  // No studio timeline: the app may still be drawing the week, compactly. A week
  // with no classes at all is that same compact table with nothing in it.
  if (!tables.length) return compactWeek(doc);

  const days = [];
  const allBlocks = [];
  let hidden = 0;

  for (const table of tables) {
    const label = textOf(qs(table, 'th'));
    const blocks = [];

    for (const tr of qsa(table, 'tr')) {
      const cells = qsa(tr, 'td');
      if (!cells.length) continue;
      for (const block of lanesIn(cells[1] || cells[0])) {
        if (FACULTY.test(String(block.instructor || '').trim())) {
          hidden += 1;
          continue;
        }
        blocks.push(block);
      }
    }

    // A day with a heading is kept even when nothing is scheduled in it: the
    // original always shows all seven sections, and a missing Wednesday reads
    // as a missing day rather than an empty one.
    if (label) days.push({ label, blocks });
    allBlocks.push(...blocks);
  }

  if (!days.length) return null;

  // Four studios is the app's own layout; a page with more studios gets its own
  // count rather than having classes dropped into the wrong column.
  const studioCount = Math.max(4, ...allBlocks.map((b) => b.studio || 0));
  for (const day of days) Object.assign(day, buildDay(day.label, day.blocks, studioCount));

  const totals = days.reduce((acc, day) => {
    for (const block of day.blocks) {
      acc.classes += 1;
      if (block.spotsLeft != null) acc.spots += block.spotsLeft;
      if (block.waitlisted != null) acc.waitlisted += block.waitlisted;
      if (block.status === 'full') acc.full += 1;
    }
    return acc;
  }, { classes: 0, spots: 0, waitlisted: 0, full: 0 });

  return {
    kind: 'week',
    days,
    studioCount,
    // Classes left out of the view because the faculty pool teaches them.
    hidden,
    totals,
    week: textOf(qs(doc, '.contentInfo p')) || null,
    title: textOf(qs(doc, '.formTitle, .ReportName, h1')) || ''
  };
}
