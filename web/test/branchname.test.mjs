/*
 * The branch was renamed, and the old name must not come back.
 *
 * The skin's working branch is `fun-themes`. It used to be named after the one
 * theme it happened to start with, and the rename had to reach every place a
 * branch name is written down: the artefact's update and download URLs, the CI
 * branch list and its fetch refspec, the strip tool's default ref, the
 * README's install prose. A stale one of those is the kind of thing that ships
 * silently — an installed copy updating from a branch that no longer exists, or
 * a gate comparing against a ref nobody pushes.
 *
 * So this reads the tracked tree as text and fails on any spelling of the old
 * name. The theme is still the Wii skin: the two-word name is its product name
 * and legitimately appears in `wii.css`, in the `'wii'` theme id and in the
 * prose describing it, so only the joined spellings are matched — hyphen,
 * underscore, or run together in either casing. The name is never written out
 * literally here, even in these comments, because the scan covers this file too.
 *
 * `git ls-files` is the list, because "tracked" is exactly the question: the
 * local style guide and working notes are excluded from the repository and are
 * none of this suite's business.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..');

// Built from two pieces so the pattern itself is not an occurrence.
const RETIRED = new RegExp('\\b' + ['wii', 'skin'].join('[-_]?') + 's?\\b', 'i');
const old = (sep) => ['wii', 'skin'].join(sep);

// What a walk skips when git is not there to ask: version control, installed
// packages, build output, and the generated or gitignored working areas.
const SKIP = new Set(['.git', '.main-port', '.freebuff', 'node_modules', 'dist', 'demo', 'parity']);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs));
    else if (entry.isFile()) out.push(abs);
  }
  return out;
}

function tracked() {
  try {
    return execFileSync('git', ['ls-files', '-z'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .split('\0')
      .filter(Boolean);
  } catch {
    // No git (a downloaded tree): fall back to the working tree. The count
    // assertion below fails loudly if that ever comes back nearly empty, so a
    // broken walk cannot pass itself off as a clean tree.
    return walk(ROOT).map((abs) => path.relative(ROOT, abs).split(path.sep).join('/'));
  }
}

const FILES = tracked();

/** Every line of one tracked file that names the retired branch. */
function hitsIn(rel) {
  let text;
  try {
    text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  } catch {
    return [];
  }
  const found = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (RETIRED.test(line)) found.push(`${rel}:${index + 1}: ${line.trim()}`);
  });
  return found;
}

test('no file in the tree names the retired branch', () => {
  const hits = FILES.flatMap(hitsIn);
  assert.deepEqual(
    hits,
    [],
    'the old branch name is back: point it at fun-themes, or say "Wii skin" where the theme itself is meant'
  );
});

test('the guard would notice the old name', () => {
  // The check is a pattern, so it has to be shown to fire on what it guards.
  for (const sample of [
    `see the ${old('-')} branch`,
    `refs/heads/${old('_')}`,
    `origin/${old('-').toUpperCase()}`,
    `${old('')} update url`,
    `${old('-')}s` // a plural is still the name
  ]) {
    assert.equal(RETIRED.test(sample), true, sample);
  }
  // And it stays quiet about the theme, whose name it must not police.
  for (const sample of [
    'The Wii skin frames a table as a sheet',
    'html[data-sd-theme="wii"] #sd-root',
    'src/wii.css',
    `a ${old(' ')} install`,
    `a longer ${old('')}ned word`
  ]) {
    assert.equal(RETIRED.test(sample), false, sample);
  }
});

test('the scan reads the tracked tree, not an empty list', () => {
  assert.ok(FILES.length > 100, `only ${FILES.length} files were listed`);
  // The places a branch name has bitten before: the metadata block, the gate
  // that compares the two lines, and the strip tool that sets main's URLs.
  for (const must of [
    'web/package.json',
    'studio-director-rebuilt.user.js',
    '.github/workflows/ci.yml',
    'web/tools/main-from-skin.mjs'
  ]) {
    assert.ok(FILES.includes(must), `${must} is part of the scan`);
  }
});
