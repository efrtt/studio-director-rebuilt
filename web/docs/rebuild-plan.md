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

## 4. Live DOM first — done

`main.js` now reads the live document first and only fetches when `chooseSource` says the live page
cannot answer: no shell, or a content root with nothing in it (`liveIsBare`, which is the
JS-drawn-before-its-script case). A reader that claims the live page skips the GET entirely, so the
common screen now costs zero requests and the model describes the same tree the edits are written
into.

`fetch` and `app` both fall through to the fetched path on purpose. The fetched HTML can carry a
view the live tree has not drawn yet, and `decideMount` already owns what to mount; only `live` is
allowed to skip the GET. The budget is unchanged: one same-origin GET per view at most.

**Checked live**, v0.15.1, in a signed-in session with the built userscript put into the app's own
pages:

| Page | Mounted | Source |
|---|---|---|
| `CalendarPage` | week, `158 classes` | live |
| `ChargesHome` | index, 28 tiles from 18 links | live |
| `Unenroll` | note | live |
| `EditFamily(fident)` | form, `19 fields` | live |

All four came from the live document, so the common screen costs no GET at all.

The same session found a bug in the probe flag itself: `sdprobe` was missing from `NAV_PARAMS`, so a
page visited with `?sdprobe=1` looked like `?fident=...` and was routed as a record page. With the
probe armed, the calendar and `ChargesHome` both mounted from a fetched copy and reported `fetched`,
which is what the first pass measured before the fix. A record page also recorded no source at all,
because `mountRecord` never called `recordView`; both are fixed in 0.15.1.

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
| live-first | 173,202 | 169,624 | 48,919 | 14 / 159 |
| record live-first | 173,379 | 169,722 | 49,289 | 14 / 160 |
| probe routing fix | 173,429 | 169,772 | 48,984 | 14 / 160 |

The bundle is **7,327 bytes smaller** than the reference build and 456 bytes smaller gzipped, after
gaining five model modules, two test suites, the live-first decision and the routing fix the live
check found, the old `{#if}` chain and the duplicated readers being most of what went.

No test and no golden was edited. The new coverage lives in two new suites (`model.test.mjs`,
`readers.test.mjs`), added to the `test` script; the twelve original suites pass unchanged.

## The edit-family golden, rebuilt from the live page

`test/golden/edit-family.json` used to model `EditFamily` with 22 fields, three of them phone-type
selects (`name:phone1_label` ...) holding `Home`/`Work` options. A live dump of the same page said 19
fields, and said why:

```
INPUT|phone1_label|hidden
Home Phone=>input[phone1]
```

The phone type is `input[type=hidden]`, not a select. Hidden controls are dropped by `readForm`
because they cannot be edited, so 19 is the honest count and nothing was lost: there is no phone type
to edit on that page. The fixture has been rebuilt from that dump, row by row, so the golden now
pins the page the app serves: 19 fields, 19 rows, real labels (`Guardian Name(s)`, `Address 1`, `ZIP`,
three `Home Phone` rows). Values stay anonymized and option lists are trimmed, since the reader only
distinguishes an empty select from a non-empty one.

Where the invented selects came from is worth knowing: `studio-director-pages.json`, the crawl that
first described this page, records `phone1_label` as a select with 10 options, which is not the markup
the browser ends up with. A crawl summary is a shape, not a page; the fixture has to come from the DOM.

## Measured on the live app

Each row below was measured in a signed-in session by writing one value into the page's own control
and pressing the page's own control:

| Screen | Pressed | What the app sent |
|---|---|---|
| `EditFamily` | Save | `POST(form, scripted submit)` to `admin.sd`, 430 bytes |
| `StudentContactList` | Run Report | same, 240 bytes |
| `EmailClasses` | Select by Filter | same, 169 bytes |
| `ManagePhoneNumbersFormat` | Save | same, 54 bytes |

Every body carried the value written into the control, the record value was still there after a
reload, and the setting was put back and read back as its original value. So the contract that
`save.js`, `report.js`, `task.js` and `settings.js` all rely on holds on every kind of screen they
serve: the app serialises the live form at submit time, and keeps no copy of the record to post in
its place. `tools/save-check.js` measures a screen the same way.
