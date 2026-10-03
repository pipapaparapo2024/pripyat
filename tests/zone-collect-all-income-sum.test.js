/** Regression guard: one collect request sums every ready location before one save. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const php = fs.readFileSync(path.join(root, 'server/core/controllers/zone.php'), 'utf8');
const js = fs.readFileSync(path.join(root, '_client/src/game/zone.js'), 'utf8');
const assert = (condition, message) => { if(!condition) throw new Error(message); console.log('✓ ' + message); };

const start = php.indexOf('function collectAllIncome(){');
const end = php.indexOf('\n\t}', start);
const body = php.slice(start, end);
assert(start >= 0, 'zone.collectAllIncome exists');
assert(/foreach\(\$catalog\['locations'\] as \$locIdx => \$locCfg\)/.test(body), 'iterates through every location');
assert(/\$totalCig \+= \$locCig; \$totalExp \+= \$locExp; \$totalResp \+= \$locResp;/.test(body), 'adds each location total to global totals');
assert(/\$this->ops->add\(\$user, 'cigarettes', \$totalCig\)/.test(body), 'credits the aggregate cigarettes total once');
assert(/\$this->ops->saveUser\(\$user\)/.test(body), 'saves the combined reward once');
assert(/'collectAllIncome'/.test(php.slice(0, php.indexOf('private function _catalog'))), 'endpoint is permitted');
const jsStart = js.indexOf('_collectIncome(onAllDone){');
const jsBody = js.slice(jsStart, js.indexOf('\n    // ── ЗАНАЧКИ', jsStart));
assert(/TS\.php\('zone\.collectAllIncome', \{\}/.test(jsBody), 'client uses the aggregate endpoint');
assert(!/collectLocIncome\(/.test(jsBody), 'client no longer sends one collect request per location');
