const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const workspace = JSON.parse(fs.readFileSync(path.join(root, 'stalker.code-workspace'), 'utf8'));
for (const folder of workspace.folders) {
  assert(fs.statSync(path.resolve(root, folder.path)).isDirectory(), `Missing workspace folder: ${folder.path}`);
}
for (const relative of ['_client/src/index.js', '_client/development/images', '_client/development/libs',
  'server/core', 'assets/source/img', 'assets/source/content', 'docs/specifications', 'docs/history']) {
  assert(fs.existsSync(path.join(root, relative)), `Missing project path: ${relative}`);
}
assert(!fs.existsSync(path.join(root, 'img')), 'Old artwork root must be migrated');
assert(!fs.existsSync(path.join(root, 'content')), 'Old Animate root must be migrated');
assert(fs.readFileSync(path.join(root, '.gitignore'), 'utf8').includes('/archive/local/'));
assert(workspace.folders.some(f => f.path === '_client/development/images'), 'Images must be directly accessible');
const importer = fs.readFileSync(path.join(root, 'assets/source/img/import_to_animate.jsfl'), 'utf8');
assert(importer.includes('fl.scriptURI'), 'Animate importer must resolve its own asset directory');
assert(!importer.includes('pripat/img/'), 'Animate importer must not retain the old artwork path');
console.log('Структура проекта и все пути рабочей области корректны');
