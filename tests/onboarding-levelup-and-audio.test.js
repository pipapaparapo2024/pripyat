const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const read = p => fs.readFileSync('_client/src/game/' + p, 'utf8');
const popup = read('shell/popups/level_up.js');
const handler = popup.match(/win\._raiseForTutorial = (\(\) => \{[\s\S]*?\n\s*\});/)[1];
let raised = 0;
const win = {visible: true, parent: {addChild(child){assert.equal(child, win); raised++;}}};
const shareBtn = {interactive: true};
vm.runInNewContext('(' + handler + ')()', {win, shareBtn});
assert.equal(raised, 1);
assert.equal(shareBtn.interactive, false);
win.visible = false;
vm.runInNewContext('(' + handler + ')()', {win, shareBtn});
assert.equal(raised, 1);
for(const file of ['guided-tour', 'onboarding-tour']){
    assert.match(read('onboarding/' + file + '.js'), /_levelupWin\?\._raiseForTutorial/);
}
assert.match(read('onboarding.js'), /if\(myGen !== this\._narrationGen\) instance\?\.stop\(\)/);
