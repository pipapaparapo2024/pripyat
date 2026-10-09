/** Regression guard for the Dev-panel casino controls and key-purchase popup layout. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if(!condition) throw new Error(message); console.log('✓ ' + message); };

const devPanel = read('_client/src/game/shell/overlays/dev_panel.js');
const iface = read('_client/src/game/interface.js');
const popup = read('_client/src/game/shell/overlays/buy_key_popup.js');
const uiKit = read('_client/src/game/shell/ui_kit.js');
const levelUp = read('_client/src/game/shell/popups/level_up.js');
const zonePopup = read('_client/src/game/zone/zone-popup.js');

assert(!/this\._buildCasinoForceSections\(/.test(devPanel), 'Dev-panel no longer renders forced gambling-combination controls');
assert(!/attachDevPanelCasinoForce/.test(iface), 'casino-force extension is not attached to the interface');
assert(/keyIcon\.x = 662; keyIcon\.y = 350;/.test(popup), 'key icon position is x=662, y=350');
assert(/const KEY_ICON_SCALE = 0\.184;/.test(popup), 'key icon scale is 0.184');
assert(/buyLabelTxt\.x = 559; buyLabelTxt\.y = 415;/.test(popup), '"Купить за" position is x=559, y=415');
// 08.10.2026 (text pixelation fix): fontSize:20×scale(0.908) replaced with final fontSize:18, no scale.
assert(/fontSize: 18,/.test(popup), '"Купить за" fontSize is 18 (20×0.908), not via scale');
assert(!/buyLabelTxt\.scale\.set\(/.test(popup), '"Купить за" no longer uses scale.set');
assert(/buyBtn\.on\('pointerover', \(\) => \{ _sa\(buyBtn, 0\.85\); _ss\(buyBtn, 1\.08\); \}\)/.test(popup), 'buy button uses smooth hover scaling');
assert(/exitBtn\.on\('pointerover', \(\) => \{ _sa\(exitBtn, 0\.75\); _ss\(exitBtn, 1\.08\); \}\)/.test(popup), 'close button uses smooth hover scaling');
assert(/emitter\.on = function\(event, listener, \.\.\.args\)/.test(uiKit) && /window\._ss\(target, x\)/.test(uiKit), 'legacy hover scale setters are globally animated through _ss');
assert(/shareBtn\.x = 685;/.test(levelUp) && /shareBtn\.y = 500;/.test(levelUp), 'share button is positioned at x=685, y=500');
assert(/_locExecActiv\._disableHoverScale = true;/.test(zonePopup), '"Выполнить" button opts out of hover scaling');
assert(!/_locExecActiv\.scale\.set\(1\.08\)/.test(zonePopup), '"Выполнить" button has no hover scale setter');
