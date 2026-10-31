# Rebuild plan

The execution plan for the rewrite. `docs/rebuild-spec.md` says what the replacement must keep;
this file says in what order, with what gate, and what is checked at each stop.

Baseline is commit `7ce29c9`, tag `pre-rebuild`, branch `rebuild`.

## 0. Prep — done

- Branch `rebuild` off `main`; `main` stays a working copy of the shipped userscript.
- The userscript header's `@version` is injected from `package.json`, and the build fails if the
  written file does not carry that version — as it fails if any header placeholder is left
  unfilled. The template used to carry its own literal (`0.2.0` against a package `0.13.0`, and
  it also had no `@updateURL`/`@downloadURL` at all); a version nobody verifies is a version that
  ships stale.
- Baseline measured before any code moved (2026-10-31):

| | |
|---|---|
| `studio-director-rebuilt.user.js` | 180,756 bytes |
| `dist/sd.js` | 177,414 bytes (49,440 gzipped) |
| Suites / assertions | 12 / 144 passing |
| Goldens | 20 models |

The spec's §9 table says 180,758 / 177,416 / 142 tests. Those were recorded before the last
`choose.js` extraction; the measured numbers above are the ones used for deltas below.

## 1. Shared model — done

| Module | Absorbs |
|---|---|
| `model/root.js` | the `contentRoot`/chrome definitions in `note`, `task`, `sheet`, `settings` |
| `model/table.js` | `readTable`, which did not belong in a view module (`tabs.js`) |
| `model/fields.js` | the overlap of `form.js` and `settings.js`, plus radio groups |
| `model/diff.js` | `diffFields` + `applyFields` returning `{ applied, missing }` |
| `model/press.js` | `actions.js`, behaviour frozen |

The four write paths now share one diff and one applier. **The bug this designed out:** `saveInApp`
answered `{ submitted: true }` whenever the app's control existed, even when a change had not been
written. A missing field now refuses, names the field, and does not press.

Two slips found by the gates rather than by reading, both fixed:

- the shared `selectorOf` lost the editor's `name="-"` guard, which turned the app's placeholder
  input into a field called `-` and changed one golden;
- the shared checkbox comparison used `value` while the editor fills `checked`, which read every
  checked box as an edit and failed two task tests.

Radios now read as one field per group in a record form. No fixture carries one, so no golden moved.

## 2. Reader registry — done

`readers/index.js` holds the order as data, with each reader's `after` gate spelled out — the
ladder's behaviour written once instead of nine times. `lib/page.js` keeps the import path and
delegates.

One quirk is preserved deliberately, because 16 goldens pin it: `list` is gated by `week` but not by
`confirmation`, so a confirmation page carries both the sentence and the record panel beside it.

**Deviation from the spec's sketch:** the spec has each reader export `{ id, claims, read }` where
`claims` is its own threshold check. Here `claims` is a view of `read` (`!!read(doc, ctx)`), because
a second copy of every threshold is exactly the duplication this file exists to remove. `readPage`
calls `read` once per reader; `claims` exists for tests.

## 3. One dispatcher — done

`lib/route.js` answers the five entry points as one decision (`search`, `record`, `admin`, `page`),
replacing three inline questions in `main.js`. The record-page rule is untouched: `readForm`
directly, never through the chain.

What is left of the spec's §3 is the *note tiebreaker* and the shell-less case, which still run in
`main.js` because they need the live document and a timeout. They call the same tested helpers.

## 4. Live DOM first — **not done**

`chooseSource({ liveView, liveHasShell, liveIsEmpty })` is implemented and tested, but `main.js`
still fetches first and reads live as the fallback. Flipping the default changes which document
every model comes from on all 447 crawled screens, and no fixture or golden can see the difference —
only a signed-in browser can. Shipping that blind, in a build whose whole premise is not guessing
about client records, would be the wrong trade. It needs one session against the real app first.

## 5. Views keyed by kind — done

`views/registry.js` holds the `kind → component` map, the prop assembly, and one `titleOf` /
`footerOf` pair. `App.svelte` is now three derived values and a `<svelte:component>`, with the split
layout (list beside editor/confirmation) as a `SPLIT` set rather than a nested branch.

## 6. Close-out

| Step | userscript | dist | gz | suites / assertions |
|---|---|---|---|---|
| baseline | 180,756 | 177,414 | 49,440 | 12 / 144 |
| shared model | 181,293 | 177,715 | 49,607 | 13 / 152 |
| registry + routing | 181,293 | 177,715 | 49,607 | 14 / 158 |
| view map | 172,763 | 169,185 | 48,784 | 14 / 158 |

The bundle is **7,993 bytes smaller** than the reference build and 656 bytes smaller gzipped, after
gaining five model modules and two test suites — the old `{#if}` chain and the duplicated readers
were most of what went.

No test and no golden was edited. The new coverage lives in two new suites (`model.test.mjs`,
`readers.test.mjs`), added to the `test` script; the twelve original suites pass unchanged.

## Not verified here

These need a signed-in session on the live paid app, so they are listed as unchecked rather than
claimed:

- a record save persisting (`tools/save-check.js`);
- `ChargesHome` routing to its live index rather than its fetched notice;
- `Unenroll` leaving the app untouched;
- the report, task and settings write transports, none of which has ever been measured against the
  real site;
- the live-first read path (§4), which is why it was not switched on.
