const fs = require('node:fs');
const path = require('node:path');
function copyRuntimeAssets() {
  const root = path.resolve(__dirname, '..');
  const publicRoot = path.join(root, '_client/development');
  fs.mkdirSync(publicRoot, {recursive:true});
  if (!fs.realpathSync(publicRoot).startsWith(root + path.sep)) throw new Error('Output outside project');
  for (const group of ['images', 'sounds', 'fonts', 'spine', 'libs']) {
    const source = path.join(root, 'assets', group), destination = path.join(publicRoot, group);
    if (!fs.existsSync(source)) continue;
    // Only generated assets are cleaned; preserve the webpack bundle.
    if (fs.existsSync(destination)) {
      if (!fs.realpathSync(destination).startsWith(root + path.sep)) throw new Error('Output outside project');
      for (const name of fs.readdirSync(destination)) {
        if (group === 'libs' && name === 'index.js') continue;
        fs.rmSync(path.join(destination, name), { recursive:true, force:true });
      }
    }
    fs.cpSync(source, destination, {recursive:true});
  }
  const icons = path.join(root, 'assets/server-images');
  if (fs.existsSync(icons)) fs.cpSync(icons, path.join(root, 'server/images'), {recursive:true});
}
module.exports = copyRuntimeAssets;
if (require.main === module) copyRuntimeAssets();
