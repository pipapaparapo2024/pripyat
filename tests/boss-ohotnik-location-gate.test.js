/**
 * Test: руководитель сообщил "на Охотника напасть нельзя, требует каждый раз проходить,
 * прогресс то ли не сохраняется, то ли неправильно настроена механика".
 *
 * Проверка по ТЗ (стр.5: "Доступ к боссам открывает за прохождение локации 1раз.", стр.22
 * "Награда с боссов: Охотник: +25 опыта, 1 ключ на Счастливчика, +100 сигарет. Для нападения
 * ключей не нужно.") подтвердила: требование зачистить локацию перед боем с Охотником —
 * ЭТО ПО ТЗ, не баг. Реальный найденный баг — bosses.js._showDetail() показывал название
 * локации из СТАРОГО списка ТЗ ("Рубеж"), которого нет в реальном списке локаций Зоны
 * (zone.js: "Кордон","Свалка",...) — игрок видел "Зачисти Рубеж для доступа", не находил
 * такую локацию нигде и решал, что зачистка не засчиталась / механика сломана.
 *
 * Run: node tests/boss-ohotnik-location-gate.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const bossesSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'bosses.js'), 'utf-8'
);
const combatSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8'
);
const zoneSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'zone.js'), 'utf-8'
);

console.log('\nTest 1: данные Охотника соответствуют ТЗ (стр.22) — reward, ключи, boss_loc');
{
    const m = bossesSrc.match(/\{ id:0,name:'Охотник',.*\},/);
    assert(!!m, 'запись Охотника (id:0) найдена в bosses.data');
    if(m){
        const rec = m[0];
        assert(/keys_needed:0/.test(rec), 'ключи не нужны для нападения (ТЗ: "Для нападения ключей не нужно")');
        assert(/reward:\{cig:100,\s*exp:25\s*\}/.test(rec), 'награда 100 сигарет / 25 опыта (ТЗ стр.22)');
        assert(/gives_keys:\[1\]/.test(rec), 'даёт 1 ключ на Счастливчика (boss idx 1)');
        assert(/boss_loc:0/.test(rec), 'привязан к локации 0 (Кордон) — доступ открывается ОДИН раз после зачистки (ТЗ стр.5)');
    }
}

console.log('\nTest 2: имена локаций в bosses.js._showDetail СОВПАДАЮТ с реальным списком zone.js (не старые имена ТЗ)');
{
    // Реальные имена, под которыми локации существуют для игрока (zone.js this.locations[].name)
    const zoneNames = [...zoneSrc.matchAll(/id:\d+, name:'([^']+)'/g)].map(m => m[1]);
    assert(JSON.stringify(zoneNames) === JSON.stringify(['Кордон','Свалка','Темная Долина','Агропром','Янтарь']),
        'zone.js локации по факту: Кордон/Свалка/Темная Долина/Агропром/Янтарь (не Рубеж/Отстойник/... из старого ТЗ)');

    const detailMatch = bossesSrc.match(/if\(!loc\)\{([\s\S]*?)\n        \} else/);
    assert(!!detailMatch, 'ветка "локация не зачищена" в _showDetail найдена');
    if(detailMatch){
        assert(/const locNames = \['Кордон','Свалка','Темная Долина','Агропром','Янтарь'\];/.test(detailMatch[1]),
            '_showDetail использует РЕАЛЬНЫЕ имена локаций (раньше был устаревший список Рубеж/Отстойник/...)');
        assert(!/locNames = \[[^\]]*Рубеж/.test(detailMatch[1]),
            'устаревшее имя "Рубеж" (несуществующая локация) убрано из самого массива (упоминание в комментарии-истории — не в счёт)');
    }

    const attackMatch = combatSrc.match(/if\(!this\._isLocCleared\(d\.boss_loc\)\)\{([\s\S]*?)\n            return;/);
    assert(!!attackMatch, 'блокировка атаки без зачистки локации в _attack найдена');
    if(attackMatch){
        assert(/const locNames=\['Кордон','Свалка','Темная Долина','Агропром','Янтарь'\];/.test(attackMatch[1]),
            '_attack тоже использует те же реальные имена (с исправленной капитализацией "Темная Долина")');
    }
}

console.log('\nTest 3: зачистка локации персистентна (cleared сохраняется/загружается корректно)');
{
    assert(/cleared:\s*this\.locations\[li\]\.cleared \|\| 0,/.test(zoneSrc), '_saveToUdata пишет cleared в udata[\'zone\']');
    assert(/if\(saved\[li\]\.cleared !== undefined\)\{\s*\n\s*loc\.cleared = saved\[li\]\.cleared;/.test(zoneSrc),
        '_loadFromUdata восстанавливает cleared из сохранённых данных');
    assert(/getCleared\(locIdx\)\{\s*\n\s*return this\.locations\[locIdx\] \? \(this\.locations\[locIdx\]\.cleared \|\| 0\) : 0;/.test(zoneSrc),
        'getCleared(locIdx) — публичный геттер, которым bosses._isLocCleared проверяет доступ к боссу');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
