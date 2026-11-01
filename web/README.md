# web — the rebuilt client

Source for the userscript: pure readers, one model layer, Svelte views, and the themes.

Every reader is a function of a document and a URL, returning a plain model. That is what lets the
recorded golden models catch a change to the screens nobody opens. How the whole thing works, and why
each reader exists, is in [`docs/architecture.md`](docs/architecture.md). The Wii theme is
`src/wii.css`, scoped to `html[data-sd-theme="wii"] #sd-root`.

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
