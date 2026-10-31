# Rebuild plan

The execution plan for the rewrite. `docs/rebuild-spec.md` says what the replacement must keep;
this file says in what order, with what gate, and what is checked at each stop.

Baseline is commit `7ce29c9`, tag `pre-rebuild`, on branch `rebuild`.

## 0. Prep

- Branch `rebuild` off `main`; `main` stays a working copy of the shipped userscript.
- The userscript header's `@version` is injected from `package.json` by
  `tools/build-userscript.mjs`, and the build fails if the written file does not carry that
  version. The template's own literal was `0.2.0` against a package `0.13.0`; a version that is
  never checked is how a stale value survives to a release.
- Baseline measured before any code moved (2026-10-31):

| | |
|---|---|
| `studio-director-rebuilt.user.js` | 180,756 bytes |
| `dist/sd.js` | 177,414 bytes (49,440 gzipped) |
| Suites / assertions | 12 / 144 passing |
| Goldens | 20 models |

The spec's §9 table says 180,758 / 177,416 / 142 tests. Those were recorded before the last
`choose.js` extraction; the measured numbers above are the ones used for deltas below.

## 1. Shared model, extracted from duplicated code

No reader changes. Code moves, and the moved code gains the tests it never had.

| Step | Module | Absorbs |
|---|---|---|
| 1.1 | `model/root.js` | the `contentRoot`/chrome definitions in `note`, `task`, `sheet`, `settings` |
| 1.2 | `model/table.js` | `readTable`, which does not belong in a view module (`tabs.js`) |
| 1.3 | `model/fields.js` | the overlap of `form.js` (no radios) and `settings.js` |
| 1.4 | `model/diff.js` | `diffFields` + `applyFields` returning `{ applied, missing }` |
| 1.5 | `model/press.js` | `actions.js`, behaviour frozen |

Then the four write paths (`save.js`, `report.js`, `task.js`, `settings.js`) move onto
`diff.js`/`press.js`, and their private copies go.

**The bug this designs out:** `saveInApp` answers `{ submitted: true }` whenever the app's control
exists, even when `applied.length < changes.length`. A selector that misses the live DOM then
produces "saved" for an edit that was never written. After this phase a partial apply refuses to
press, and names the fields it could not write.

## 2. Reader registry

`readers/index.js` holds the ordered registry and `readPage(doc, ctx)`; each reader exports
`{ id, claims, read }`. Converted in spec order, one commit each: `note`, `list`, `sheet`,
`settings`, `report`, `task`, `week`, `record`, `tabs`, `bar`, `confirmation`.

Thresholds are copied, never re-invented. A threshold that has to change is a behaviour change and
is reported instead of shipped.

## 3. One dispatcher

`page.js` owns every routing decision, including the five cases `main.js` hand-rolls today: record
page, bare `admin.sd`, `SearchResults`, shell-less print window, note tiebreaker. The record-page
rule is load-bearing — `readForm` directly, never through the chain, because the class editor's
hidden Calendar tab carries seven `TimeBlock` tables.

## 4. Live DOM first, fetch as fallback

Only after the dispatcher. `chooseSource({ liveView, liveHasShell, liveIsEmpty })` is pure and
tested; `main.js` reads live first and fetches only when the live read is empty or a shell. Still
one same-origin GET at most, and none when live answers.

## 5. Views keyed by kind

`App.svelte` replaces the `{#if}` ladder and the inline title expression with a `kind → component`
map and one title/footer derivation. `npm run demo` renders every golden through it.

## 6. Close-out

- Both gates green; no test or golden edited.
- `npm run userscript`, `npm run demo`; the artifact carries the package version.
- Deltas recorded below.
- `contract.md` and the spec's unknowns updated with what actually changed.
- Merge to `main`, tag `rebuild-1.0`, push branch and tag.

## Deltas

| Step | userscript | dist | gz | tests |
|---|---|---|---|---|
| baseline | 180,756 | 177,414 | 49,440 | 144 |

## Not verified here

These need a signed-in session on the live paid app, so they are listed as unchecked rather than
claimed:

- a record save persisting (`tools/save-check.js`);
- `ChargesHome` routing to its live index rather than its fetched notice;
- `Unenroll` leaving the app untouched;
- the report, task and settings write transports, none of which has ever been measured against the
  real site.
