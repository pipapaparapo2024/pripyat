const {execFileSync} = require('node:child_process');
const path = require('node:path');
const {findPhpBin} = require('./_php_bin.js');
process.stdout.write(execFileSync(findPhpBin(), [path.join(__dirname, '_php_fixtures/bag-fragments.php')], {encoding:'utf8'}));

const {readFileSync} = require('node:fs');
const assert = require('node:assert/strict');
const tooltip = readFileSync(path.join(__dirname, '../_client/src/game/shell/shmot-tooltip.js'), 'utf8');
(async () => {
    const {formatShmotFragments} = await import('data:text/javascript;base64,' + Buffer.from(tooltip).toString('base64'));
    assert.equal(formatShmotFragments({id: 106, fragments: 40}, {106: 7}), 'Фрагменты: 7/40 · не собрано');
    assert.equal(formatShmotFragments({id: 101, fragments: 40, owned: true}, {}), 'Фрагменты: 40/40 · собрано');
    assert.equal(formatShmotFragments({id: 41, fragments: 20}, {}), 'Фрагменты: 0/20 · не собрано');
    assert.equal(formatShmotFragments({id: 64, fragments: null}, {}), '');
    console.log('PASS: fragment progress and assembled state in the tooltip');
})().catch(error => { console.error(error); process.exitCode = 1; });
