# web — the rebuilt client

Source for the userscript: pure readers, one model layer, Svelte views, and the themes.

Every reader is a function of a document and a URL, returning a plain model. That is what lets the
recorded golden models catch a change to the screens nobody opens. How the whole thing works, and why
each reader exists, is in [`docs/architecture.md`](docs/architecture.md).

## Commands

| Command | What it does |
|---|---|
| `npm ci` | Install (Node 20 or newer). |
| `npm test` | Every reader, router and writer. |
| `npm run golden` | The recorded models, model for model. |
| `npm run demo` | Build self-contained demo pages from the fixtures. |
| `npm run userscript` | Build `../studio-director-rebuilt.user.js`; commit it with the source. |
| `npm run serve` | Serve the demo pages on port 4800. |
| `npm run map` | Regenerate `docs/crawl-map.md` from `data/pages.json`. |
| `npm run parity -- snapshot main` | Snapshot this build and another ref into `web/parity/` for a live parity check. |
| `npm run parity:fixtures` | Freeze the live dumps in `web/parity/` into the checked-in `test/parity/` set. |

## Checking reader parity between builds

The goldens compare a model against its last snapshot. The live admin page is the harder case, so a
reader change is checked against another build on the same signed-in page:

```bash
cd web
npm run parity -- snapshot main        # builds this tree, extracts main's artefact, writes web/parity/
node tools/serve.mjs . 4801            # from the repo root
```

In a signed-in app tab, inject `http://127.0.0.1:4801/web/tools/parity-probe.js`, then for each build
(reload the tab between builds — the overlay is not torn down):

```js
await sdParity.run('http://127.0.0.1:4801/web/parity/current.user.js', 'current');
```

The probe reads what was rendered — view kind, tabs, rows, labels, control types and a digest of the
values — and POSTs it to the dev server, which writes `web/parity/<label>.json`. Compare the two:

```bash
node tools/parity.mjs compare web/parity/current.json web/parity/main.json
```

Versions and themes are reported, not compared: the builds differ on purpose. Exit status is 1 when the
readers disagree, so the check can gate a change. `web/parity/` is gitignored.

A live pass is worth freezing, and `npm run parity:fixtures` does that: it copies each agreeing pair into
`test/parity/`, one file per page shape, carrying both readings, the page URL and the reader whose output it
is. `npm test` runs `test/parity.test.mjs` over that set, so the pairs keep being compared on every run
instead of being argued once and forgotten. The tool refuses to freeze a pair the two builds disagree on, or
one carrying money-like text (the probe hashes values; a figure is a probe bug). A shape the reference build
cannot read at all — payment, which `main` has no reader for — is frozen with its reason and is never counted
as an agreeing pair.

## Layout

```text
src/            main.js, readers, model, views (Svelte), styles
  readers/      the ladder: which reader claims which page shape
  model/        the shared table/field/root readers
  lib/          one module per concern (form, save, tabs, bar, sheet, …)
  components/   the views themselves
test/           fixtures (captured pages), golden/ (their frozen models), suites
tools/          build, golden, capture, crawl, diagnose and demo scripts
data/           pages.json — the crawl the map is generated from
docs/           architecture, contract, adding a page, crawl map, design notes
```

## Docs

- [`docs/architecture.md`](docs/architecture.md) — the long write-up, reader by reader.
- [`docs/contract.md`](docs/contract.md) — invariants, and the goldens that pin them.
- [`docs/adding-a-page.md`](docs/adding-a-page.md) — how to cover a screen the rebuild misses.
- [`docs/crawl-map.md`](docs/crawl-map.md) — every screen the crawl found and who owns it.
- [`docs/rebuild-spec.md`](docs/rebuild-spec.md) — the design the rebuild follows.
- [`docs/rebuild-plan.md`](docs/rebuild-plan.md) — the increment log behind it.
