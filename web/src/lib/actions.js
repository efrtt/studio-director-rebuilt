// The action reader moved to `model/press.js`.
//
// Kept as a module because it is the path the rest of the build imports, and
// because a move should not be a rename in twenty files. Nothing is added here:
// the implementation has one home.
export { readActions, primaryAction, clickActionInApp, actionHint } from '../model/press.js';
