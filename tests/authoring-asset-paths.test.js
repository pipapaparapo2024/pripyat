const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
let scripts = 0;
for (const name of fs.readdirSync(path.join(root, 'dev_tools'))) {
  if (!/\.(jsx|jsfl)$/.test(name)) continue;
  const source = fs.readFileSync(path.join(root, 'dev_tools', name), 'utf8');
  new vm.Script(source, { filename: name });
  assert(!source.includes('C:/Users/HONOR/'), `Machine-specific authoring path: ${name}`);
  if (source.includes('projectRoot')) {
    assert(!/projectRoot\s*\+\s*"(?:img|content)\//.test(source), `Old artwork root: ${name}`);
    const firstLine = source.split('\n')[0];
    const context = name.endsWith('.jsfl')
      ? { fl: { scriptURI: 'file:///D:/Laptop/game/dev_tools/' + name } }
      : { $: { fileName: 'D:/Laptop/game/dev_tools/' + name }, File: function () { this.parent = { parent: { fsName: 'D:\\Laptop\\game' } }; } };
    vm.runInNewContext(firstLine, context);
    assert.equal(context.projectRoot, name.endsWith('.jsfl') ? 'file:///D:/Laptop/game/' : 'D:/Laptop/game/');
  }
  scripts++;
}
const importer = path.join(root, 'assets/source/img/import_to_animate.jsfl');
const source = fs.readFileSync(importer, 'utf8');
new vm.Script(source);
const references = [...source.matchAll(/assetRoot \+ "([^"]+)"/g)];
assert(references.length > 1000, 'Layer import references were lost');
for (const [, uri] of references) {
  assert(fs.existsSync(path.resolve(path.dirname(importer), decodeURI(uri))), `Missing layer: ${uri}`);
}
console.log(`Проверены ${scripts} скриптов Adobe и ${references.length} путей слоёв; перенос на другой диск учтён`);
