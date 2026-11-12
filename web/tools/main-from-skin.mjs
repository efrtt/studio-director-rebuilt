// Regenerate `main` from `fun-themes`: one command instead of a hand strip.
//
// The two lines are one tree. `fun-themes` carries the Wii skin; `main` is that tree
// with the skin taken out. Keeping that true by hand is how the two lines once
// drifted 8,427 lines apart - each shared change had to be re-typed on the other
// line, and every retype was a chance to lose a field. So the whole strip lives
// here as data: sync the tree, delete the skin's files, and apply the edits that
// unwire it. Every edit is anchored on the exact text it expects, so a skin change
// that moves an anchor fails loudly instead of half-stripping the build.
//
// Two things are per line rather than shared, and are set here instead of synced:
// the artefact's `userscriptBranch` (main must update itself from main, or a user
// who installed this line would be replaced by the skinned one), and the theme
// list. Everything else comes across untouched.
//
// Usage, from the fun-themes checkout - the tool finds the main worktree itself:
//   npm run sync:main                 sync, strip, build, test, goldens
//   npm run sync:main -- --check      report the difference, write nothing
//   npm run sync:main -- --no-build   strip only
//   npm run sync:main -- --force      the same, replacing uncommitted work
//   npm run sync:main -- --in <path>  use that checkout of main
//   npm run sync:main -- --from <ref> strip from another ref (default fun-themes)
//
// It leaves the work staged in main's checkout and never commits or pushes: read
// `git diff --cached` before you commit. Nothing is staged until after the build,
// so the index is the finished tree and not the synced copy of the skin's.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes('--' + name);
const opt = (name, fallback) => {
  const i = argv.indexOf('--' + name);
  const value = i >= 0 ? argv[i + 1] : null;
  return value && !value.startsWith('--') ? value : fallback;
};

const FROM = opt('from', 'fun-themes');
const CHECK = flag('check');
const BUILD = !flag('no-build');
const FORCE = flag('force');
const ARTEFACT = 'studio-director-rebuilt.user.js';

// The skin, exactly: these files exist only to carry it.
const SKIN_FILES = [
  'web/src/wii.css',
  'web/src/acnh.css',
  'web/src/osrs.css',
  'web/src/lib/spark.js',
  'web/src/components/ClickSpark.svelte',
  'web/src/acnh-fonts.css',
  'web/src/fonts/nunito-latin-var.woff2',
  'web/src/fonts/OFL-nunito.txt',
  'web/test/font.test.mjs',
  // Nothing on `main` has a theme whose type needs embedding, so the generator
  // travels with the theme rather than sitting on both lines unused.
  'web/tools/embed-font.mjs',
  'web/src/components/Menu.svelte',
  'web/src/components/Cursor.svelte',
  'web/src/cursors/PointerP1.svg',
  'web/src/cursors/PointerP1-highlight.svg',
  'web/src/cursors/HandClosedP1.svg',
  'web/src/lib/cursor.js',
  'web/test/cursor.test.mjs',
  'web/src/lib/mesh.js',
  'web/src/lib/clock.js',
  'web/test/clock.test.mjs'
];

// Everything else the skin touches, as the edit that takes it back out.
const TRANSFORMS = [
  {
    file: 'web/package.json',
    find: '"userscriptBranch": "fun-themes",',
    replace: '"userscriptBranch": "main",'
  },
  {
    file: 'web/package.json',
    find: 'node test/cursor.test.mjs && ',
    replace: ''
  },
  {
    file: 'web/package.json',
    find: 'node test/font.test.mjs && ',
    replace: ''
  },
  {
    file: 'web/src/lib/styles.js',
    find: "// The Wii skin is a theme, not a second stylesheet: it is appended so a mount\n"
      + "// injects one <style> and the userscript stays one file with nothing to fetch.\n"
      + "import WII from '../wii.css?inline';\n"
      + '// The Island theme does the same, and brings its own type: `acnh-fonts.css` holds\n'
      + '// the Nunito faces as data: URIs, so only a build that offers the theme carries\n'
      + '// them - `main` has neither the theme nor the 52 KiB of font.\n'
      + "import ACNH_FONTS from '../acnh-fonts.css?inline';\n"
      + "import ACNH from '../acnh.css?inline';\n"
      + '// Old School is stone and a 1px bevel, and needs no type of its own: the game\'s\n'
      + '// bitmap font is Jagex\'s, so the theme keeps the shell\'s family.\n'
      + "import OSRS from '../osrs.css?inline';",
    replace: "// The Wii skin lives only on `fun-themes`: it is a theme of its own, carried there by\n"
      + "// its own stylesheet. A build of `main` never offers it, so there is nothing on this\n"
      + "// line for a second sheet to do."
  },
  {
    file: 'web/src/lib/styles.js',
    find: 'el.textContent = `${FONTS}\\n${CSS}\\n${WII}\\n${ACNH_FONTS}\\n${ACNH}\\n${OSRS}`;',
    replace: 'el.textContent = `${FONTS}\\n${CSS}`;'
  },
  {
    file: 'web/src/lib/theme.js',
    find: "// On the fun-themes branch the Wii theme comes first and is what a fresh install\n"
      + "// gets; the other three are untouched and one press of the button away. `acnh`\n"
      + '// and `osrs` close the cycle: each is a look of its own, not an `auto` answer.\n'
      + "export const THEMES = ['wii', 'dark', 'light', 'auto', 'acnh', 'osrs'];\n"
      + '\n'
      + "export const THEME_LABEL = { wii: 'Wii', dark: 'Dark', light: 'Light', auto: 'Auto', acnh: 'Island', osrs: 'OSRS' };",
    replace: "// Dark first: it is the look the build has always had, so a fresh install is\n"
      + "// unchanged until somebody cycles the button.\n"
      + "export const THEMES = ['dark', 'light', 'auto'];\n"
      + '\n'
      + "export const THEME_LABEL = { dark: 'Dark', light: 'Light', auto: 'Auto' };"
  },
  {
    file: 'web/src/lib/theme.js',
    find: "    return THEMES.includes(value) ? value : 'wii';\n  } catch (e) {\n    return 'wii';",
    replace: "    return THEMES.includes(value) ? value : 'dark';\n  } catch (e) {\n    return 'dark';"
  },
  {
    file: 'web/src/lib/theme.js',
    find: 'export function themeName(theme, osPrefersDark = prefersDark()) {\n'
      + "  // `wii` is its own value, not a light theme: the stylesheet needs to tell the\n"
      + '  // two apart, because the skin has rules the light theme must not inherit.\n'
      + "  if (theme === 'wii') return 'wii';\n"
      + '  // `acnh` is its own value for the same reason: a cream field set in Nunito is\n'
      + '  // neither the dark nor the light palette, so the OS must not decide it.\n'
      + "  if (theme === 'acnh') return 'acnh';\n"
      + '  // `osrs` likewise: stone, gold and a near-black bevel are not a dark-mode\n'
      + '  // answer, they are the interface of a game.\n'
      + "  if (theme === 'osrs') return 'osrs';\n"
      + "  if (theme === 'light') return 'light';",
    replace: 'export function themeName(theme, osPrefersDark = prefersDark()) {\n'
      + "  if (theme === 'light') return 'light';"
  },
  {
    file: 'web/src/App.svelte',
    find: "import Menu from './components/Menu.svelte';\n  import { runMesh } from './lib/mesh.js';\n",
    replace: ''
  },
  {
    file: 'web/src/App.svelte',
    find: "  let theme = readTheme();\n"
      + "  // The Wii's navigation is a screen, not a sidebar: Home opens it. The rail is\n"
      + '  // hidden by the skin, so this button is the way in while that theme is on.\n'
      + '  let menuOpen = false;\n'
      + '  function cycleTheme() {\n'
      + '    theme = nextTheme(theme);\n'
      + '    writeTheme(theme);\n'
      + '  }\n'
      + '  // The resolved name, because the channel menu is a Wii-only affordance and the\n'
      + '  // shell has to know which look is actually on.\n'
      + "  let resolvedTheme = 'dark';\n"
      + '  $: resolvedTheme = applyTheme(theme);\n'
      + '  // Leaving the menu open across a theme change would be a screen with no way\n'
      + '  // back to it in the next theme.\n'
      + "  $: if (resolvedTheme !== 'wii' && menuOpen) menuOpen = false;\n"
      + '  $: applyTheme(theme);',
    replace: '  let theme = readTheme();\n'
      + '  function cycleTheme() {\n'
      + '    theme = nextTheme(theme);\n'
      + '    writeTheme(theme);\n'
      + '  }\n'
      + '  $: applyTheme(theme);'
  },
  {
    file: 'web/src/App.svelte',
    find: "  // The header band's field starts when the node exists, so switching into the Wii\n"
      + "  // theme later still gets one. It runs a quarter faster than a channel's: the bar\n"
      + "  // is the app's own colour and never stops moving.\n"
      + '  function meshField(node) {\n'
      + "    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;\n"
      + '    runMesh(node, 9, 0.75);\n'
      + '  }\n'
      + '\n',
    replace: ''
  },
  {
    file: 'web/src/App.svelte',
    find: "    {#if resolvedTheme === 'wii'}\n"
      + '      <span class="sd-top-field" aria-hidden="true">\n'
      + '        <span class="sd-mesh" use:meshField>\n'
      + '          {#each [0, 1, 2, 3, 4, 5] as k (k)}<i></i>{/each}\n'
      + '        </span>\n'
      + '      </span>\n'
      + '      <button\n'
      + '        class="sd-home"\n'
      + '        type="button"\n'
      + '        aria-label="Open the channel menu"\n'
      + '        title="Channel menu"\n'
      + '        on:click={() => (menuOpen = true)}\n'
      + '      >\n'
      + '        <span class="sd-home-dot" aria-hidden="true"></span>\n'
      + '        <span class="sd-home-text">Home</span>\n'
      + '      </button>\n'
      + '    {/if}\n',
    replace: ''
  },
  {
    file: 'web/src/App.svelte',
    find: '\n{#if menuOpen}\n'
      + "  <Menu nav={model.nav} icons={icons} current={model.url} onClose={() => (menuOpen = false)} />\n"
      + '{/if}\n',
    replace: ''
  },
  {
    file: 'web/src/App.svelte',
    find: "\n{#if resolvedTheme === 'wii'}\n  <Cursor />\n{/if}\n",
    replace: ''
  },
  {
    file: 'web/src/App.svelte',
    find: "  import Cursor from './components/Cursor.svelte';\n",
    replace: ''
  },
  {
    file: 'web/src/App.svelte',
    find: "  // The Old School theme draws the game's click crosshair under the pointer. It\n"
      + '  // observes only: the app\'s own click handlers are untouched.\n'
      + "  import ClickSpark from './components/ClickSpark.svelte';\n",
    replace: ''
  },
  {
    file: 'web/src/App.svelte',
    find: "\n{#if resolvedTheme === 'osrs'}\n  <ClickSpark />\n{/if}\n",
    replace: ''
  },
  {
    // The Old School sign-in palette is one contiguous region, so it is dropped
    // between its own banner and the dark block's banner.
    file: 'web/src/login.css',
    dropBetween: ['/* ---- Old School: stone, gold and a bevel ----',
      "/* ---- Dark: the guide's hairline controls on the app's dark field ---- */"]
  },
  {
    file: 'web/src/login.css',
    find: '/* ---- Wii: the skin, with its gloss and its light ---- */\n'
      + 'body.LoginBody,\n'
      + 'html[data-sd-theme="wii"] body.LoginBody {',
    replace: '/* ---- The base sign-in, with its gloss and its light ---- */\n'
      + 'body.LoginBody {'
  },
  {
    // The Island palette is one contiguous region, so it is dropped between its
    // own banner and the base rules rather than restated as an exact 70-line
    // anchor: a marker that moves still fails loudly, a copy that drifts does not.
    file: 'web/src/login.css',
    // The end marker carries the base rule's first declaration: `body.LoginBody {`
    // alone also occurs inside the region, as part of the theme's own selectors.
    dropBetween: ['/* ---- Island: the paper card on a mint field, set in Nunito ----',
      'body.LoginBody {\n  background: var(--lg-field);']
  },
  {
    file: 'web/test/theme.test.mjs',
    find: "test('a fresh install gets the Wii skin on this branch', () => {\n"
      + "  assert.equal(readTheme(fakeStore()), 'wii');\n"
      + '  // A stored value from some future or broken version is not trusted.\n'
      + '  const bad = fakeStore();\n'
      + "  bad.setItem('sd.theme', 'solarized');\n"
      + "  assert.equal(readTheme(bad), 'wii');\n"
      + '  // No storage at all (private mode) is still a usable answer.\n'
      + "  assert.equal(readTheme(null), 'wii');\n"
      + '  // A real choice from before the skin existed is still honoured.\n'
      + '  const dark = fakeStore();\n'
      + "  dark.setItem('sd.theme', 'dark');\n"
      + "  assert.equal(readTheme(dark), 'dark');\n"
      + '  // Including the newest theme: a stored `acnh` is a theme, so it is read back.\n'
      + '  const island = fakeStore();\n'
      + "  island.setItem('sd.theme', 'acnh');\n"
      + "  assert.equal(readTheme(island), 'acnh');\n"
      + '});',
    replace: "test('a fresh install gets the dark theme', () => {\n"
      + "  assert.equal(readTheme(fakeStore()), 'dark');\n"
      + '  // A stored value from some future or broken version is not trusted.\n'
      + '  const bad = fakeStore();\n'
      + "  bad.setItem('sd.theme', 'solarized');\n"
      + "  assert.equal(readTheme(bad), 'dark');\n"
      + '  // No storage at all (private mode) is still a usable answer.\n'
      + "  assert.equal(readTheme(null), 'dark');\n"
      + '  // A real choice is honoured.\n'
      + '  const light = fakeStore();\n'
      + "  light.setItem('sd.theme', 'light');\n"
      + "  assert.equal(readTheme(light), 'light');\n"
      + '});'
  },
  {
    file: 'web/test/theme.test.mjs',
    find: "test('one button cycles all six, and wraps', () => {\n"
      + "  let theme = 'wii';\n"
      + '  const seen = [];\n'
      + '  for (let i = 0; i < 6; i += 1) {\n'
      + '    theme = nextTheme(theme);\n'
      + '    seen.push(theme);\n'
      + '  }\n'
      + "  assert.deepEqual(seen, ['dark', 'light', 'auto', 'acnh', 'osrs', 'wii']);\n"
      + "  assert.deepEqual(THEMES, ['wii', 'dark', 'light', 'auto', 'acnh', 'osrs']);\n"
      + "  assert.equal(THEME_LABEL.auto, 'Auto');\n"
      + "  assert.equal(THEME_LABEL.wii, 'Wii');\n"
      + "  assert.equal(THEME_LABEL.acnh, 'Island');\n"
      + "  assert.equal(THEME_LABEL.osrs, 'OSRS');\n"
      + '});',
    replace: "test('one button cycles all three, and wraps', () => {\n"
      + "  let theme = 'dark';\n"
      + '  const seen = [];\n'
      + '  for (let i = 0; i < 3; i += 1) {\n'
      + '    theme = nextTheme(theme);\n'
      + '    seen.push(theme);\n'
      + '  }\n'
      + "  assert.deepEqual(seen, ['light', 'auto', 'dark']);\n"
      + "  assert.deepEqual(THEMES, ['dark', 'light', 'auto']);\n"
      + "  assert.equal(THEME_LABEL.auto, 'Auto');\n"
      + "  assert.equal(THEME_LABEL.dark, 'Dark');\n"
      + '});'
  },
  {
    file: 'web/test/theme.test.mjs',
    find: "  assert.equal(themeName('light', true), 'light');\n"
      + '  // The skin is never resolved through the OS: it is the skin.\n'
      + "  assert.equal(themeName('wii', true), 'wii');\n"
      + "  assert.equal(themeName('wii', false), 'wii');\n"
      + '  // Neither is the Island theme: a cream sheet is not a dark-mode answer.\n'
      + "  assert.equal(themeName('acnh', true), 'acnh');\n"
      + "  assert.equal(themeName('acnh', false), 'acnh');\n"
      + '  // Nor Old School: stone and gold do not follow the OS either.\n'
      + "  assert.equal(themeName('osrs', true), 'osrs');\n"
      + "  assert.equal(themeName('osrs', false), 'osrs');\n"
      + '});',
    replace: "  assert.equal(themeName('light', true), 'light');\n"
      + '});'
  },
  {
    file: 'web/test/actionicon.test.mjs',
    find: "  assert.equal(/\\btbody tr:hover/.test(css), false, 'styles.css has no row hover');\n"
      + "  const wii = fs.readFileSync(path.join(here, '..', 'src', 'wii.css'), 'utf8');\n"
      + "  assert.equal(/\\btbody tr:hover/.test(wii), false, 'wii.css has no row hover either');\n"
      + '});',
    replace: "  assert.equal(/\\btbody tr:hover/.test(css), false, 'styles.css has no row hover');\n"
      + '});'
  },
  {
    file: 'web/test/cardframe.test.mjs',
    find: "const SHEETS = { 'styles.css': src('styles.css'), 'wii.css': src('wii.css'), 'acnh.css': src('acnh.css') };",
    replace: "const SHEETS = { 'styles.css': src('styles.css') };"
  },
  {
    file: 'web/test/cardframe.test.mjs',
    find: '  // Under the skin the generic `.sd-tablewrap` rule is id-scoped, so it outranks\n'
      + '  // the base rules above. The skin therefore has to flatten each pair itself.\n'
      + "  const wii = rules(SHEETS['wii.css']);\n"
      + "  const skin = (selector) => wii.find((r) => r.selector.split(',').map((s) => s.trim()).includes(selector));\n"
      + '  for (const selector of [\n'
      + '    \'html[data-sd-theme="wii"] #sd-root .sd-perf > .sd-tablewrap\',\n'
      + '    \'html[data-sd-theme="wii"] #sd-root .sd-recordcard > .sd-tablewrap\'\n'
      + '  ]) {\n'
      + '    const rule = skin(selector);\n'
      + "    assert.ok(rule, selector + ' exists');\n"
      + "    for (const prop of ['border', 'border-radius', 'box-shadow', 'background']) {\n"
      + '      assert.equal(drawsNothing(value(rule, prop)), true, `${selector} flattens ${prop}`);\n'
      + '    }\n'
      + '  }\n',
    replace: '  // The skin wraps the same rule in its own id-scoped selector, which outranks\n'
      + '  // the base rules above; both copies are checked on the `fun-themes` branch.\n'
  },
  {
    // The Island theme checks the same two pairs in its own sheet, so the block
    // leaves with the theme rather than naming a file `main` does not have.
    file: 'web/test/cardframe.test.mjs',
    dropBetween: ["\n  // The Island theme's wrapper rule carries an id too", '});']
  },
  {
    file: 'README.md',
    find: '# Studio Director, rebuilt — Wii skin',
    replace: '# Studio Director, rebuilt'
  },
  {
    file: 'README.md',
    find: '**This branch is the Wii design.** The rail becomes a channel menu, and a Wii-inspired theme is the\n'
      + 'default for a fresh install — big rounded panels, one bright accent, text sized to be read from across\n'
      + 'a room. The functional rebuild underneath is the same as `main`; the light and dark themes are still\n'
      + 'there if you prefer them.\n'
      + '\n',
    replace: ''
  },
  {
    file: 'README.md',
    find: '> vendor. It is also not affiliated with Nintendo; the theme is an homage, not a port.',
    replace: '> vendor.'
  },
  {
    file: 'README.md',
    find: "- **Wii-style channel menu.** The app's rail is replaced by a grid of channels you can click through,\n"
      + '  with the page you are on highlighted.\n'
      + '- **Four themes.** Wii (default on this branch), light, dark, or follow the system.',
    replace: '- **Three themes.** Dark (the default), light, or follow the system.'
  },
  {
    file: 'README.md',
    find: 'The Wii theme is a stylesheet, not a second app: every rule is scoped to\n'
      + '`html[data-sd-theme="wii"] #sd-root`, so choosing another theme cannot inherit it.\n'
      + '\n',
    replace: ''
  },
  {
    file: 'README.md',
    find: "3. Open The Studio Director and sign in as usual. The Wii theme is applied first; the header's theme\n"
      + '   control cycles through the others.',
    replace: "3. Open The Studio Director and sign in as usual. The header's theme control cycles dark, light and auto."
  },
  {
    file: 'README.md',
    find: '  src/            readers, model, views (Svelte), themes, styles\n'
      + '    wii.css       the Wii theme, scoped to html[data-sd-theme="wii"] #sd-root\n',
    replace: '  src/            readers, model, views (Svelte), themes, styles\n'
  },
  {
    file: 'README.md',
    find: "- **The Wii theme is best effort over a stylesheet the app controls.** It covers the app's common\n"
      + '  surfaces; a rarely used screen may keep an odd patch of the app\'s own colour.\n',
    replace: ''
  },
  {
    file: 'web/README.md',
    find: 'each reader exists, is in [`docs/architecture.md`](docs/architecture.md). The Wii theme is\n'
      + '`src/wii.css`, scoped to `html[data-sd-theme="wii"] #sd-root`.',
    replace: 'each reader exists, is in [`docs/architecture.md`](docs/architecture.md).'
  },
  {
    file: 'web/src/main.js',
    find: "import FONTS from './fonts.css?inline';\n"
      + '// The Island theme sets the sign-in page in Nunito too, and this stylesheet is the\n'
      + '// only one that page receives: the face travels with it or not at all.\n'
      + "import ACNH_FONTS from './acnh-fonts.css?inline';\n"
      + "import LOGIN from './login.css?inline';",
    replace: "import FONTS from './fonts.css?inline';\n"
      + "import LOGIN from './login.css?inline';"
  },
  {
    file: 'web/src/main.js',
    find: 'export const loginCss = `${FONTS}\\n${ACNH_FONTS}\\n${LOGIN}`;',
    replace: 'export const loginCss = `${FONTS}\\n${LOGIN}`;'
  }
];

function git(dir, ...args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).replace(/\n$/, '');
}

function gitRaw(dir, ...args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function targetDir() {
  const explicit = opt('in', null);
  if (explicit) return path.resolve(explicit);
  if (git(ROOT, 'rev-parse', '--abbrev-ref', 'HEAD') === 'main') return ROOT;
  let dir = null;
  for (const line of git(ROOT, 'worktree', 'list', '--porcelain').split('\n')) {
    if (line.startsWith('worktree ')) dir = line.slice('worktree '.length);
    else if (line === 'branch refs/heads/main' && dir) return dir;
  }
  throw new Error('no checkout of `main` found: add one (`git worktree add .main-port main`) or pass --in <path>');
}

// Applies one file's edits, each exactly once, and says which anchor went stale.
function strip(file, text) {
  let out = text;
  for (const step of TRANSFORMS.filter((t) => t.file === file)) {
    if (step.dropBetween) {
      const [from, to] = step.dropBetween;
      const start = out.indexOf(from);
      const end = start < 0 ? -1 : out.indexOf(to, start + from.length);
      if (start < 0 || end < 0) {
        throw new Error(file + ': region not found, so the theme moved:\n  ' + from);
      }
      out = out.slice(0, start) + out.slice(end);
      continue;
    }
    const at = out.indexOf(step.find);
    if (at < 0) {
      throw new Error(file + ': anchor not found, so the skin moved:\n  ' + step.find.split('\n')[0]);
    }
    if (out.indexOf(step.find, at + 1) >= 0) {
      throw new Error(file + ': anchor appears twice, so the edit would be ambiguous:\n  ' + step.find.split('\n')[0]);
    }
    out = out.slice(0, at) + step.replace + out.slice(at + step.find.length);
  }
  return out;
}

function skinIn(artefact) {
  const hits = ['--wii-blue', 'sd-menu-cross', 'sd-channel-name', 'data-sd-theme=wii',
    'acnh', 'Nunito', 'osrs', 'sd-spark']
    .filter((needle) => artefact.includes(needle));
  if (hits.length) throw new Error('the build still carries the skin: ' + hits.join(', '));
  if (!artefact.includes('/main/' + ARTEFACT)) {
    throw new Error('the artefact does not point its update at main');
  }
}

const main = targetDir();
const files = [...new Set(TRANSFORMS.map((t) => t.file))];

if (CHECK) {
  const diffs = [];
  const theirs = git(main, 'ls-tree', '-r', '--name-only', FROM).split('\n').filter(Boolean);
  const ours = git(main, 'ls-files').split('\n').filter(Boolean);
  const inFrom = new Set(theirs);
  const inMain = new Set(ours);

  // Every file, not only the ones the strip edits: a shared reader change that never
  // reached this line is drift too, and it is the kind that used to go unnoticed.
  for (const file of theirs) {
    // Each line commits its own build, so the artefact is the one file that is meant
    // to differ; it is checked below for the skin and for where it updates from.
    if (file === ARTEFACT) continue;
    if (SKIN_FILES.includes(file)) {
      if (fs.existsSync(path.join(main, file))) diffs.push(file + ': the skin file is still here');
      continue;
    }
    if (!inMain.has(file)) {
      diffs.push(file + ': missing from this checkout');
      continue;
    }
    const source = execFileSync('git', ['show', FROM + ':' + file], { cwd: main, maxBuffer: 64 * 1024 * 1024 });
    const have = fs.readFileSync(path.join(main, file));
    if (TRANSFORMS.some((t) => t.file === file)) {
      if (have.toString('utf8') !== strip(file, source.toString('utf8'))) {
        diffs.push(file + ': differs from ' + FROM + ' minus the skin');
      }
    } else if (!have.equals(source)) {
      diffs.push(file + ': differs from ' + FROM);
    }
  }
  for (const file of ours) {
    if (!inFrom.has(file)) diffs.push(file + ': not on ' + FROM);
  }
  // A file named for the skin that arrived after this list was written is not in
  // SKIN_FILES, so the loop above would accept it. The name is the one thing every
  // one of them shares.
  for (const file of ours) {
    if (/wii/i.test(file)) diffs.push(file + ': a path named for the skin is tracked here');
  }
  const artefactPath = path.join(main, ARTEFACT);
  if (fs.existsSync(artefactPath)) {
    try {
      skinIn(fs.readFileSync(artefactPath, 'utf8'));
    } catch (e) {
      diffs.push(ARTEFACT + ': ' + e.message);
    }
  }

  if (diffs.length) {
    console.error('main is not ' + FROM + ' minus the skin:');
    for (const line of diffs) console.error('  ' + line);
    console.error('\nRun `npm run sync:main` to regenerate it.');
    process.exit(1);
  }
  console.log('main matches ' + FROM + ' minus the skin (' + theirs.length + ' files compared, '
    + SKIN_FILES.length + ' removed, ' + files.length + ' unwired)');
  process.exit(0);
}

const dirty = git(main, 'status', '--porcelain');
if (dirty && !FORCE) {
  throw new Error('the main checkout has changes, and syncing replaces the tree: commit them first, or pass --force:\n' + dirty);
}

console.log('syncing ' + main + ' from ' + FROM);
git(main, 'checkout', FROM, '--', '.');
git(main, 'rm', '-q', '-f', ...SKIN_FILES);

for (const file of files) {
  const before = fs.readFileSync(path.join(main, file), 'utf8');
  const after = strip(file, before);
  fs.writeFileSync(path.join(main, file), after);
}

const version = JSON.parse(fs.readFileSync(path.join(main, 'web/package.json'), 'utf8')).version;
const theirs = JSON.parse(gitRaw(main, 'show', FROM + ':web/package.json')).version;
if (version !== theirs) throw new Error('the two lines disagree on version: main ' + version + ', ' + FROM + ' ' + theirs);

if (BUILD) {
  const web = path.join(main, 'web');
  const run = (script) => execFileSync('npm', ['run', script], { cwd: web, stdio: 'inherit', shell: true });
  for (const script of ['userscript', 'test', 'golden']) {
    console.log('\n$ npm run ' + script);
    run(script);
  }
  const artefact = fs.readFileSync(path.join(main, ARTEFACT), 'utf8');
  skinIn(artefact);
  console.log('\n' + ARTEFACT + ' v' + version + ', ' + artefact.length + ' bytes, no skin');
}

// Stage once, here, after everything has been generated. The checkout above put
// the *skin's* artefact in this tree, and the build only then rewrote it; staging
// before that point left the index holding the skinned build, so a commit taken
// from it shipped an artefact with `fun-themes` update URLs and the whole skin in
// it. Adding afterwards means the index is the final tree, whatever BUILD did.
git(main, 'add', '-A');

// What is staged has to be what is on disk. This is the check that would have
// caught that artefact, and it is cheap enough to run every time.
for (const file of git(main, 'diff', '--cached', '--name-only').split('\n').filter(Boolean)) {
  const staged = execFileSync('git', ['show', ':' + file], { cwd: main, maxBuffer: 64 * 1024 * 1024 });
  if (!staged.equals(fs.readFileSync(path.join(main, file)))) {
    throw new Error('the staged copy of ' + file + ' is not the one on disk: stage again before committing');
  }
}

const changed = git(main, 'status', '--short').split('\n').filter(Boolean);
console.log('stripped the skin from ' + changed.length + ' staged paths at v' + version);

console.log('\nReview `git diff --cached` in ' + main + ', then commit and push that line.');
