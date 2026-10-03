const fs = require('fs'); const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '_client/src/game/shell/overlays/bosses_fight.js'), 'utf8');
const ok = (v, m) => { if(!v) throw new Error(m); console.log('✓ ' + m); };
ok(/const FRAME_X = 27, FRAME_Y = \[528, 589, 652\];/.test(src), 'three rating frames use the supplied positions');
ok(/const AV_X = 32, AV_Y = \[532, 593, 656\];/.test(src), 'avatars retain +5/+4 offset from each frame');
// 02.10.2026: AV_SCALE уточнён редактором позиций 0.472 → 0.324 (актуальное значение — см.
// bosses_fight.js и tests/onboarding-permission-and-roulette-assets.test.js); тест обновлён.
ok(/const AV_SCALE = 0\.324;/.test(src), 'avatars use scale 0.324');
ok(/frameSpr\.x = frameX; frameSpr\.y = frameY;/.test(src), 'frame coordinates are independent of avatar coordinates');
