// The Wii Menu's clock.
//
// The Menu prints the time in large digits with a small AM/PM beside them, and
// the date under it in the form `Fri 3/21`.
//
// The format is pinned rather than inherited from the machine. `undefined` as a
// locale gave whatever the OS preferred, which on a 24-hour or non-English
// machine is "14:07" with no meridiem at all - three different clocks on three
// machines. The interface is English and the Wii is a 12-hour clock, so both are
// stated here and the result is the same everywhere.
//
// Pure and injectable (`now` is a parameter) so a test can pin an afternoon and
// a single-digit day without freezing a global.

const LOCALE = 'en-US';

const TIME = new Intl.DateTimeFormat(LOCALE, {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
});

const WEEKDAY = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
const NUMERIC = new Intl.DateTimeFormat(LOCALE, { month: 'numeric', day: 'numeric' });

// "2:07 PM" -> { time: "2:07", meridiem: "PM" }: the Menu sets the digits and the
// meridiem at different sizes, so they cannot be one string.
export function formatClock(now = new Date()) {
  let time = '';
  let meridiem = '';
  for (const part of TIME.formatToParts(now)) {
    if (part.type === 'dayPeriod') {
      meridiem = part.value.toUpperCase();
      continue;
    }
    // Every other part joins as-is, separators included: dropping the literals
    // turned "2:07" into "207".
    time += part.value;
  }
  return { time: time.trim() || TIME.format(now), meridiem };
}

// "Fri 3/21": the weekday, then the month and day.
export function formatMenuDate(now = new Date()) {
  return `${WEEKDAY.format(now)} ${NUMERIC.format(now)}`;
}
