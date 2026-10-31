const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const workspace = JSON.parse(fs.readFileSync(path.join(root, 'stalker.code-workspace'), 'utf8'));
for (const folder of workspace.folders) assert(fs.statSync(path.resolve(root, folder.path)).isDirectory(), folder.path);
assert(!fs.existsSync(path.join(root, 'assets/source')), 'Authoring source must be outside the working project');
assert(workspace.folders.some(f => f.path === 'assets'));
require('../tools/copy-runtime-assets.js')();
let count = 0;
function check(relative = '') {
  for (const entry of fs.readdirSync(path.join(root, 'assets/images', relative), { withFileTypes: true })) {
    const name = path.join(relative, entry.name);
    if (entry.isDirectory()) { check(name); continue; }
    const source = fs.readFileSync(path.join(root, 'assets/images', name));
    const output = fs.readFileSync(path.join(root, '_client/development/images', name));
    assert(source.equals(output), `Asset changed during build copy: ${name}`);
    count++;
  }
}
check();
assert(count > 0);
console.log(`Структура и копирование ${count} игровых ассетов проверены`);
