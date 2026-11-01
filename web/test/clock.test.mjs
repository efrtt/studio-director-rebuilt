// The Wii Menu's clock and date.
//
// Small, but exactly the kind of thing that looks right at noon and wrong at
// 12:05 AM, or on the 3rd of the month when the pad would be "03". The formatter
// takes `now` as an argument for that reason, and the locale is pinned, so the
// answers do not depend on the machine running the test.

import test from 'node:test';
import assert from 'node:assert/strict';

import { formatClock, formatMenuDate } from '../src/lib/clock.js';

test('an afternoon time splits into digits and meridiem', () => {
  const { time, meridiem } = formatClock(new Date(2026, 2, 21, 14, 7));
  assert.equal(time, '2:07', 'the separator and the zero-padded minutes survive');
  assert.equal(meridiem, 'PM');
});

test('a morning time keeps its hour and says AM', () => {
  const { time, meridiem } = formatClock(new Date(2026, 2, 21, 9, 30));
  assert.equal(time, '9:30');
  assert.equal(meridiem, 'AM');
});

test('midnight and noon are not confused', () => {
  assert.equal(formatClock(new Date(2026, 2, 21, 0, 5)).time, '12:05');
  assert.equal(formatClock(new Date(2026, 2, 21, 12, 0)).time, '12:00');
  assert.equal(formatClock(new Date(2026, 2, 21, 0, 5)).meridiem, 'AM');
  assert.equal(formatClock(new Date(2026, 2, 21, 12, 0)).meridiem, 'PM');
});

test('the date is the weekday, then the month and day', () => {
  // 21 March 2026 is a Saturday; the day is not zero-padded, the Menu prints it
  // the way a person writes it.
  assert.equal(formatMenuDate(new Date(2026, 2, 21, 14, 7)), 'Sat 3/21');
  assert.equal(formatMenuDate(new Date(2026, 0, 1, 12, 0)), 'Thu 1/1');
});
