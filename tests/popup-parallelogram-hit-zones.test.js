const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let failed = 0;
function assert(value, message){
    if(value) console.log('  OK', message);
    else { console.error('  FAIL', message); failed++; }
}
const helper = read('_client/src/game/shell/popups/popup-hit-shapes.js');
const sound = read('_client/src/game/shell/popups/sound.js');
const confirm = read('_client/src/game/shell/popups/confirm.js');
const editor = read('_client/src/game/shell/overlays/universal_pos_editor.js');

assert(/drawPolygon\(points\)/.test(helper), 'hit zone uses its real four-sided polygon');
assert(/g\._uHitShape = 'parallelogram'/.test(helper), 'shape is marked for the position editor');
assert(/makeParallelogramHit\(win, 443, 387, 221, 40, 18\)/.test(sound), 'sound confirm zone uses the measured position');
assert(/makeParallelogramHit\(win, 668, 387, 221, 40, 18\)/.test(sound), 'sound cancel zone uses the measured position');
assert((confirm.match(/makeParallelogramHit\(/g) || []).length === 2, 'generic confirm popup uses two slanted zones');
assert(/obj\._uHitShape === 'parallelogram'/.test(editor) && /drawPolygon\(outline\)/.test(editor),
    'position editor outlines the polygon itself');
if(failed) process.exit(1);
