// The Wii skin's pointer, tested where it can be: the spring is a pure function of
// numbers, so the feel (does it arrive? does it overshoot? is it the same at 30 and
// 60 frames a second? does the glyph lean the right way?) is checkable without a
// browser. What this cannot say is how it looks — that is a live-page question.
import test from 'node:test';
import assert from 'node:assert/strict';

import { advance, poseOf, restPose, settled, MAX_DT } from '../src/lib/cursor.js';

const run = (state, target, steps, dt) => {
  let out = state;
  for (let i = 0; i < steps; i += 1) out = advance(out, target, dt);
  return out;
};

test('the pointer catches the mouse, with weight and no slingshot', () => {
  const target = { x: 400, y: 300 };
  let state = restPose(0, 0);
  let furthest = 0;
  for (let i = 0; i < 120; i += 1) {
    state = advance(state, target, 1 / 60);
    furthest = Math.max(furthest, state.x);
  }

  assert.ok(settled(state, target), `still moving after 2s: ${JSON.stringify(state)}`);
  // A damped spring overshoots; what it must not do is fly past far enough to read
  // as a lost pointer.
  assert.ok(furthest < target.x * 1.12, `overshot to ${furthest}`);
  assert.ok(furthest > target.x, 'the overshoot is what gives it weight');
});

test('a long frame is clamped, so a stalled tab cannot fling it', () => {
  const target = { x: 900, y: 0 };
  const afterStall = advance(restPose(0, 0), target, 1);
  const oneFrame = advance(restPose(0, 0), target, MAX_DT);

  assert.deepEqual(afterStall, oneFrame, 'a 1s gap is stepped as one frame');
  assert.ok(Number.isFinite(afterStall.x) && afterStall.x < 900);
});

test('the same gesture looks the same at 30 and at 60 frames a second', () => {
  const target = { x: 500, y: 200 };
  const fast = run(restPose(0, 0), target, 60, 1 / 60);
  const slow = run(restPose(0, 0), target, 30, 1 / 30);

  assert.ok(Math.abs(fast.x - slow.x) < 6, `x drifted: ${fast.x} vs ${slow.x}`);
  assert.ok(Math.abs(fast.y - slow.y) < 6, `y drifted: ${fast.y} vs ${slow.y}`);
});

test('a resting pointer is level; a moving one leans into its travel', () => {
  const still = poseOf({ x: 0, y: 0, vx: 0, vy: 0 });
  assert.equal(still.tilt, 0);
  assert.equal(still.along, 1);
  assert.equal(still.across, 1);

  // Right: the tail swings left, which is a positive rotation about the tip.
  const right = poseOf({ x: 0, y: 0, vx: 600, vy: 0 });
  assert.ok(right.tilt > 8 && right.tilt < 11, `tilt ${right.tilt}`);
  // Down: the tail swings up, the other way.
  assert.ok(poseOf({ x: 0, y: 0, vx: 0, vy: 600 }).tilt < -8);
  // Down-right is the arrow's own diagonal: it needs no rock at all.
  assert.equal(poseOf({ x: 0, y: 0, vx: 500, vy: 500 }).tilt, 0);

  assert.ok(right.along > 1 && right.across < 1, 'it stretches along the travel');
});

test('the lean is capped, so a very fast flick is still the same shape', () => {
  const flick = poseOf({ x: 0, y: 0, vx: 9000, vy: 0 });
  assert.ok(flick.tilt <= 15, `tilt ran away: ${flick.tilt}`);
  assert.ok(flick.along <= 1.081, `squash ran away: ${flick.along}`);
});
