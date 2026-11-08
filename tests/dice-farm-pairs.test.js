const {execFileSync} = require('node:child_process');
const path = require('node:path');
const {findPhpBin} = require('./_php_bin.js');
for (const fixture of ['dice-farm-pairs.php', 'dice-farm-pairs-flow.php']) {
    process.stdout.write(execFileSync(findPhpBin(), [path.join(__dirname, '_php_fixtures', fixture)],
        {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}));
}
