// The Wii skin's pointer.
//
// The system cursor is hidden while this runs, so this glyph *is* the pointer: its
// tip sits on the exact pixel the pointer is on, and a click lands where it points.
// What moves is the body, which swings about that tip.
//
// The swing is not keyframed. A damped spring chases the pointer, and the glyph's
// tilt is that spring's velocity projected onto the diagonal the arrow can rock
// about: it leans while it travels, rocks back past level when it stops (the
// spring's own overshoot), and settles at zero. Pure functions over numbers, so
// the feel is testable without a browser (test/cursor.test.mjs); the component
// owns the element, the listeners and the frame loop.

// Stiff enough to feel attached, soft enough to show its weight: natural frequency
// sqrt(PULL) ≈ 14.5/s, damping ratio ≈ 0.7, so it settles in about a third of a
// second with a little overshoot on a flick.
const PULL = 210; // 1/s²
const DRAG = 21; // 1/s
const TILT_PER_SPEED = 0.016; // degrees per pixel/second along the trail axis
const MAX_TILT = 15; // degrees
const SQUASH_PER_SPEED = 1 / 9000; // of the glyph's size, per pixel/second
const MAX_SQUASH = 0.08;

// One frame of time at most. A backgrounded tab hands back a huge gap, and stepped
// at face value the spring would teleport (and, past a large enough step, diverge).
export const MAX_DT = 1 / 30;

// The glyph at rest on the pointer: no velocity, so no tilt and no squash.
export function restPose(x, y) {
  return { x, y, vx: 0, vy: 0 };
}

// One step of a damped spring, integrated semi-implicitly: the acceleration is
// applied to the velocity, then the new velocity moves the glyph.
export function advance(state, target, dt) {
  const step = Math.min(Math.max(dt, 0), MAX_DT);
  const ax = (target.x - state.x) * PULL - state.vx * DRAG;
  const ay = (target.y - state.y) * PULL - state.vy * DRAG;
  return {
    x: state.x + (state.vx + ax * step) * step,
    y: state.y + (state.vy + ay * step) * step,
    vx: state.vx + ax * step,
    vy: state.vy + ay * step
  };
}

// What to draw, in CSS terms. The arrow points up-left with its tail hanging
// down-right, at 45°; rocking about that diagonal is what the eye reads as weight.
// Travelling right swings the tail left (a positive rotation), travelling down
// swings it up (negative), and a diagonal move down-right needs neither — which is
// exactly `vx - vy`, the velocity along that axis.
export function poseOf(state) {
  const speed = Math.hypot(state.vx, state.vy);
  const rock = (state.vx - state.vy) * TILT_PER_SPEED;
  const squash = Math.min(speed * SQUASH_PER_SPEED, MAX_SQUASH);
  return {
    speed,
    tilt: Math.max(-MAX_TILT, Math.min(MAX_TILT, rock)),
    along: 1 + squash,
    across: 1 - squash * 0.5
  };
}

// Whether it has arrived: the frame loop stops there instead of ticking forever on
// a parked pointer.
export function settled(state, target, epsilon = 0.4) {
  return Math.hypot(state.x - target.x, state.y - target.y) < epsilon
    && Math.hypot(state.vx, state.vy) < epsilon;
}
