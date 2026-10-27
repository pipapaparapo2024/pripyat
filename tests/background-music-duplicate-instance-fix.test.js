/**
 * Test: 26.10.2026 — третий репорт того же симптома ("зашёл в игру, сменил вкладку, вернулся —
 * музыка двоится"), после фиксов 06.10.2026 (watchdog-gen) и 17.10.2026 (_stopStrayTracks для
 * ДРУГИХ alias). Эта правка закрывает другой путь к тому же симптому: ДВА экземпляра ОДНОГО И
 * ТОГО ЖЕ активного alias (не разных треков). Regex — тот же уровень, что остальные позиционные/
 * структурные проверки этого модуля.
 *
 * Run: node tests/background-music-duplicate-instance-fix.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function check(cond, msg){ if(cond){ console.log('  ✅', msg); passed++; } else { console.error('  ❌ FAIL:', msg); failed++; } }

const src = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'modules', 'background-music.js'), 'utf-8');

console.log('\n_startPlayback() — идемпотентный play (stop перед play для ТОГО ЖЕ alias)');
check(/PIXI\.sound\.stop\(alias\)[\s\S]{0,80}_instance = PIXI\.sound\.play\(alias/.test(src),
    'explicit PIXI.sound.stop(alias) стоит НЕПОСРЕДСТВЕННО перед PIXI.sound.play(alias, ...)');

console.log('\n_stopStrayTracks() — дедуп ДУБЛИКАТОВ активного alias (не только чужих)');
check(/activeSound\.instances\.length > 1/.test(src), 'проверяет activeSound.instances.length > 1');
check(/activeSound\.instances\.slice\(1\)\.forEach/.test(src), 'глушит все экземпляры КРОМЕ первого (slice(1)), не рестартует трек целиком');

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
