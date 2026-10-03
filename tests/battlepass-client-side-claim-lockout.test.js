/**
 * Battle Pass is server-locked (bp.php:BETA_LOCKED).  Direct console calls must
 * not optimistically change udata before the rejected server response arrives.
 * Run: node tests/battlepass-client-side-claim-lockout.test.js
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const client = fs.readFileSync(path.join(root, '_client/src/game/battlepass.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server/core/controllers/bp.php'), 'utf8');

function methodBody(startSignature, endSignature) {
    const start = client.indexOf(startSignature);
    const end = client.indexOf(endSignature, start);
    assert.notStrictEqual(start, -1, `${startSignature} exists`);
    assert.notStrictEqual(end, -1, `${endSignature} exists after ${startSignature}`);
    return client.slice(start, end);
}

assert.match(server, /private \$BETA_LOCKED = true;/, 'Battle Pass remains server-locked');
assert.match(server, /function claim\(\)\{\s*if\(\$this->BETA_LOCKED\) return \$this->ops->fail\(56\);/,
    'bp.claim rejects before doing work');

const claimLevel = methodBody('_claimLevel(lv){', '\n\t_claimAll(){');
const claimAll = methodBody('_claimAll(){', '\n\t// Вызывается извне');
const guard = "notify.showResult({text:'Боевой пропуск пока недоступен'}, 0);\n\t\treturn;";

for (const [name, body] of [['_claimLevel', claimLevel], ['_claimAll', claimAll]]) {
    const guardIndex = body.indexOf(guard);
    assert.notStrictEqual(guardIndex, -1, `${name} has an unconditional lockout guard`);
    const beforeGuard = body.slice(body.indexOf('{') + 1, guardIndex)
        .split('\n').map(line => line.trim())
        .filter(line => line && !line.startsWith('//'));
    assert.deepStrictEqual(beforeGuard, [], `${name} executes no code before its guard`);
}

for (const write of [
    "this.claimed[lv] = true;",
    "udata['energy'] = String(",
    "udata[rk] = parseInt(",
    'this._saveToUdata();',
    "TS.php('bp.claim'",
]) {
    assert(claimLevel.indexOf(write) > claimLevel.indexOf(guard), `${write} is unreachable after the guard`);
}

console.log('✅ Battle Pass claim lockout checks passed');
