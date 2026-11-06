// The Wii skin's pointer.
//
// The glyph *is* the pointer: it is drawn exactly where the mouse is, so a click
// lands on the picture of its tip and nothing about aiming changes. What carries
// momentum is the lean — the glyph rotates about its tip, and that angle is fed by
// a smoothed velocity which bleeds off when the mouse stops.
//
// No positional spring on purpose: a cursor that trails the mouse by 50px reads as
// broken, not as weight. Only the rotation lags.
//
// Pure functions over numbers, so the feel is testable without a browser
// (test/cursor.test.mjs); the component owns the element, the listeners and the
// frame loop.

// How long the lean takes to bleed away: ~70ms, so a flick rocks and is level
// again almost before you have stopped.
const LEAN_TAU = 0.07; // seconds
// A stuttered frame can hand back one huge pointer delta; the measured speed is
// capped rather than trusted.
const MAX_SPEED = 6000; // px/s
const TILT_PER_SPEED = 0.016; // degrees per pixel/second along the trail axis
const MAX_TILT = 15; // degrees

// The glyph at rest on the pointer: no movement, so no lean.
export function restPose(x, y) {
  return { x, y, vx: 0, vy: 0 };
}

// One step. The position is the pointer, exactly and immediately; the velocity is
// a smoothed reading of how fast it is travelling, which is what the lean is made
// of.
export function advance(state, target, dt) {
  const real = Math.max(dt, 1 / 240);
  let vx = (target.x - state.x) / real;
  let vy = (target.y - state.y) / real;

  const speed = Math.hypot(vx, vy);
  if (speed > MAX_SPEED) {
    vx = (vx / speed) * MAX_SPEED;
    vy = (vy / speed) * MAX_SPEED;
  }

  const blend = 1 - Math.exp(-real / LEAN_TAU);
  return {
    x: target.x,
    y: target.y,
    vx: state.vx + (vx - state.vx) * blend,
    vy: state.vy + (vy - state.vy) * blend
  };
}

// What to rotate by. The arrow points up-left with its tail hanging down-right, at
// 45°; rocking about that diagonal is what the eye reads as weight. Travelling
// right swings the tail left (a positive rotation), travelling down swings it up
// (negative), and a diagonal move down-right needs neither — which is exactly
// `vx - vy`, the velocity along that axis.
export function poseOf(state) {
  const rock = (state.vx - state.vy) * TILT_PER_SPEED;
  return {
    speed: Math.hypot(state.vx, state.vy),
    tilt: Math.max(-MAX_TILT, Math.min(MAX_TILT, rock))
  };
}

// Whether the lean has faded: the frame loop stops there instead of ticking
// forever on a parked pointer.
export function settled(state, target, epsilon = 0.4) {
  return state.x === target.x && state.y === target.y
    && Math.hypot(state.vx, state.vy) < epsilon;
}
