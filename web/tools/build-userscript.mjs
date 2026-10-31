// Inlines the built bundle into the userscript header: one file, no assets.
//
// The version is never typed twice. It comes from package.json, is written into
// the header, and the written file is then checked for it: the template used to
// carry its own literal (0.2.0 against a package 0.13.0), and a version nobody
// verifies is a version that ships stale.
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const root = path.resolve(here, '..');
const out = path.resolve(root, '..', 'studio-director-rebuilt.user.js');

// The one place the artifact's home is named.
const REPO = 'https://github.com/efrtt/studio-director-rebuilt';
const RAW = REPO.replace('https://github.com/', 'https://raw.githubusercontent.com/') + '/main';
const ARTIFACT = 'studio-director-rebuilt.user.js';

const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const bundle = fs.readFileSync(path.join(root, 'dist/sd.js'), 'utf8');
const template = fs.readFileSync(path.join(here, 'userscript.template.js'), 'utf8');

const marker = '/*__SD_BUNDLE__*/';
if (!template.includes(marker)) throw new Error('bundle marker missing from template');
if (bundle.includes('</script')) throw new Error('bundle would close a script tag');

const script = template
  .split(marker).join(bundle.trim())
  .split('__SD_VERSION__').join(version)
  .split('__SD_UPDATE_URL__').join(RAW + '/' + ARTIFACT)
  .split('__SD_DOWNLOAD_URL__').join(RAW + '/' + ARTIFACT);

// Assert what was written, not what was intended: a placeholder left behind is
// the same failure as a stale literal.
const expect = [
  '// @version      ' + version,
  '// @updateURL    ' + RAW + '/' + ARTIFACT,
  '// @downloadURL  ' + RAW + '/' + ARTIFACT
];
for (const line of expect) {
  if (!script.includes(line)) throw new Error('header missing: ' + line);
}
if (/__SD_[A-Z_]+__/.test(script)) throw new Error('unfilled header placeholder');

fs.writeFileSync(out, script);
console.log('wrote ' + path.basename(out) + ' v' + version + ' (' + script.length + ' bytes)');
