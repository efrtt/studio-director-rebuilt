// Inlines the built bundle into the userscript header: one file, no assets.
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const root = path.resolve(here, '..');
const out = path.resolve(root, '..', 'studio-director-rebuilt.user.js');

const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const bundle = fs.readFileSync(path.join(root, 'dist/sd.js'), 'utf8');
const template = fs.readFileSync(path.join(here, 'userscript.template.js'), 'utf8');

const marker = '/*__SD_BUNDLE__*/';
if (!template.includes(marker)) throw new Error('bundle marker missing from template');
if (bundle.includes('</script')) throw new Error('bundle would close a script tag');

const script = template
  .split(marker).join(bundle.trim())
  .replace(/\/\/ @version[^\n]*/, '// @version      ' + version);

fs.writeFileSync(out, script);
console.log('wrote ' + path.basename(out) + ' (' + script.length + ' bytes)');
