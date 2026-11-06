// The Wii skin's pointer, tested where it can be: the position must be the mouse
// and nothing else, and the lean is a pure function of a smoothed velocity. Whether
// it *looks* right is a live-page question; whether it is on the pixel you are
// pointing with is not.
import test from 'node:test';
import assert from 'node:assert/strict';

import { advance, poseOf, restPose, settled } from '../src/lib/cursor.js';

const run = (state, target, steps, dt) => {
  let out = state;
  for (let i = 0; i < steps; i += 1) out = advance(out, target, dt);
  return out;
};

test('the glyph stands on the mouse, with no positional drag at all', () => {
  const state = advance(restPose(100, 100), { x: 640, y: 480 }, 1 / 60);

  assert.equal(state.x, 640, 'x is the pointer, not near it');
  assert.equal(state.y, 480, 'same for y');
});

test('a fast move leans, and the lean bleeds off when the mouse stops', () => {
  // Steady travel to the right at 900px/s.
  let state = restPose(0, 300);
  for (let i = 0; i < 12; i += 1) state = advance(state, { x: (i + 1) * 15, y: 300 }, 1 / 60);
  const moving = poseOf(state);
  assert.ok(moving.tilt > 6, `leans while moving: ${moving.tilt}`);

  // Then hold still for a second.
  const target = { x: 180, y: 300 };
  state = run(state, target, 60, 1 / 60);
  assert.ok(Math.abs(poseOf(state).tilt) < 0.5, `level once stopped: ${poseOf(state).tilt}`);
  assert.ok(settled(state, target, 0.5), 'and the loop may park');
});

test('the lean follows the diagonal the arrow rocks about', () => {
  // Right: the tail swings left, a positive rotation.
  assert.ok(poseOf({ x: 0, y: 0, vx: 600, vy: 0 }).tilt > 8);
  // Down: it swings the other way.
  assert.ok(poseOf({ x: 0, y: 0, vx: 0, vy: 600 }).tilt < -8);
  // Down-right is the arrow's own diagonal: no rock needed.
  assert.equal(poseOf({ x: 0, y: 0, vx: 500, vy: 500 }).tilt, 0);
  // And at rest it is level.
  assert.equal(poseOf({ x: 0, y: 0, vx: 0, vy: 0 }).tilt, 0);
});

test('a flick is capped, and a whole second in one frame cannot fling it', () => {
  const flick = advance(restPose(0, 0), { x: 900, y: 0 }, 1);
  assert.equal(flick.x, 900, 'still exactly on the pointer');
  assert.ok(Math.abs(poseOf(flick).tilt) <= 15, `tilt ran away: ${poseOf(flick).tilt}`);
  assert.ok(Math.abs(poseOf({ x: 0, y: 0, vx: 9000, vy: 0 }).tilt) <= 15);
});

test('a zero-length frame is not a divide by zero', () => {
  const state = advance(restPose(10, 10), { x: 11, y: 10 }, 0);
  assert.ok(Number.isFinite(state.vx) && Number.isFinite(state.vy));
  assert.equal(state.x, 11);
});

test('settled waits for the lean, not just for arrival', () => {
  const target = { x: 240, y: 0 };
  let state = restPose(0, 0);
  for (let i = 0; i < 6; i += 1) state = advance(state, { x: (i + 1) * 40, y: 0 }, 1 / 60);

  assert.equal(state.x, target.x, 'arrived immediately');
  assert.equal(settled(state, target, 0.5), false, 'but still leaning');
});
