// Regenerate `main` from `wii-skin`: one command instead of a hand strip.
//
// The two lines are one tree. `wii-skin` carries the Wii skin; `main` is that tree
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
// Usage, from the wii-skin checkout - the tool finds the main worktree itself:
//   npm run sync:main                 sync, strip, build, test, goldens
//   npm run sync:main -- --check      report the difference, write nothing
//   npm run sync:main -- --no-build   strip only
//   npm run sync:main -- --force      the same, replacing uncommitted work
//   npm run sync:main -- --in <path>  use that checkout of main
//   npm run sync:main -- --from <ref> strip from another ref (default wii-skin)
//
// It leaves the work staged in main's checkout and never commits or pushes: read
// `git diff --cached` before you commit.
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

const FROM = opt('from', 'wii-skin');
const CHECK = flag('check');
const BUILD = !flag('no-build');
const FORCE = flag('force');
const ARTEFACT = 'studio-director-rebuilt.user.js';

// The skin, exactly: these files exist only to carry it.
const SKIN_FILES = [
  'web/src/wii.css',
  'web/src/components/Menu.svelte',
  'web/src/components/Cursor.svelte',
  'web/src/cursors/PointerP1.svg',
  'web/src/cursors/PointerP1-highlight.svg',
  'web/src/cursors/HandClosedP1.svg',
  'web/src/lib/cursor.js',
  'web/test/cursor.test.mjs',
  'web/src/lib/mesh.js',
  'web/src/lib/clock.js',
  'web/test/clock.test.mjs',
  'web/docs/shots/wii-menu-live.png'
];

// Everything else the skin touches, as the edit that takes it back out.
const TRANSFORMS = [
  {
    file: 'web/package.json',
    find: '"userscriptBranch": "wii-skin",',
    replace: '"userscriptBranch": "main",'
  },
  {
    file: 'web/package.json',
    find: 'node test/cursor.test.mjs && ',
    replace: ''
  },
  {
    file: 'web/src/lib/styles.js',
    find: "// The Wii skin is a theme, not a second stylesheet: it is appended so a mount\n"
      + "// injects one <style> and the userscript stays one file with nothing to fetch.\n"
      + "import WII from '../wii.css?inline';",
    replace: "// The Wii skin lives only on `wii-skin`: it is a theme of its own, carried there by\n"
      + "// its own stylesheet. A build of `main` never offers it, so there is nothing on this\n"
      + "// line for a second sheet to do."
  },
  {
    file: 'web/src/lib/styles.js',
    find: 'el.textContent = `${FONTS}\\n${CSS}\\n${WII}`;',
    replace: 'el.textContent = `${FONTS}\\n${CSS}`;'
  },
  {
    file: 'web/src/lib/theme.js',
    find: "// On the wii-skin branch the Wii theme comes first and is what a fresh install\n"
      + "// gets; the other three are untouched and one press of the button away.\n"
      + "export const THEMES = ['wii', 'dark', 'light', 'auto'];\n"
      + '\n'
      + "export const THEME_LABEL = { wii: 'Wii', dark: 'Dark', light: 'Light', auto: 'Auto' };",
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
    file: 'web/src/login.css',
    find: '/* ---- Wii: the skin, with its gloss and its light ---- */\n'
      + 'body.LoginBody,\n'
      + 'html[data-sd-theme="wii"] body.LoginBody {',
    replace: '/* ---- The base sign-in, with its gloss and its light ---- */\n'
      + 'body.LoginBody {'
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
    find: "test('one button cycles all four, and wraps', () => {\n"
      + "  let theme = 'wii';\n"
      + '  const seen = [];\n'
      + '  for (let i = 0; i < 4; i += 1) {\n'
      + '    theme = nextTheme(theme);\n'
      + '    seen.push(theme);\n'
      + '  }\n'
      + "  assert.deepEqual(seen, ['dark', 'light', 'auto', 'wii']);\n"
      + "  assert.deepEqual(THEMES, ['wii', 'dark', 'light', 'auto']);\n"
      + "  assert.equal(THEME_LABEL.auto, 'Auto');\n"
      + "  assert.equal(THEME_LABEL.wii, 'Wii');\n"
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
    find: "const SHEETS = { 'styles.css': src('styles.css'), 'wii.css': src('wii.css') };",
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
      + '  // the base rules above; both copies are checked on the `wii-skin` branch.\n'
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
      + '\n'
      + '![The channel menu](web/docs/shots/wii-menu-live.png)\n'
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
  const hits = ['--wii-blue', 'sd-menu-cross', 'sd-channel-name', "data-sd-theme=wii"]
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

git(main, 'add', '-A');

const version = JSON.parse(fs.readFileSync(path.join(main, 'web/package.json'), 'utf8')).version;
const theirs = JSON.parse(gitRaw(main, 'show', FROM + ':web/package.json')).version;
if (version !== theirs) throw new Error('the two lines disagree on version: main ' + version + ', ' + FROM + ' ' + theirs);

const changed = git(main, 'status', '--short').split('\n').filter(Boolean);
console.log('stripped the skin from ' + changed.length + ' staged paths at v' + version);

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

console.log('\nReview `git diff --cached` in ' + main + ', then commit and push that line.');
