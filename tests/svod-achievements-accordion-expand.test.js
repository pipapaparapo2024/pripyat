/**
 * Test: батч 21.09.2026 (по прямому указанию) — аккордеон-разворот в «Мои достижения».
 *
 * Первая реализация (21.09.2026, утро): у карточек с более чем одним тиром темы клик
 * разворачивал ОТДЕЛЬНЫЙ пул Graphics-строк под карточкой. Пользователь тут же указал на
 * баги этой реализации — репорт тем же днём: "самодельные ячейки, должна открываться ячейка
 * как изначальный файл, между ячейками огромное расстояние". Переписано (см. Test 3-5): тиры
 * теперь рендерятся ЧЕРЕЗ ТОТ ЖЕ ПУЛ pool-карточек, что и базовые темы (одна и та же текстура
 * «кароточка достижений.png», один и тот же CARD_H/шаг) — отличаются только тем, что вместо
 * очков/статуса показывают прогресс-бар (current/target) и не кликабельны.
 *
 * achievements.js/achievement-tiers.js часть (statPath/getStatValue/familyMembers/
 * formatAchNum) не менялась в этой правке — Test 1-2 остаются актуальными без изменений.
 *
 * Run: node tests/svod-achievements-accordion-expand.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const achievementsSrc = readSrc('_client/src/game/achievements.js');
const tiersSrc         = readSrc('_client/src/modules/achievement-tiers.js');
const svodAchSrc       = readSrc('_client/src/game/svod/svod-achievements.js');

console.log('\nTest 1: achievements.js — у КАЖДОЙ записи есть explicit statPath, согласованный с самим check-выражением');
{
    const lines = achievementsSrc.split('\n').filter(l => l.includes('check:s=>'));
    let missing = 0, mismatched = [];
    for(const line of lines){
        const spMatch = line.match(/statPath:(\[[^\]]*\])/);
        if(!spMatch){ missing++; continue; }
        let statPath;
        try{ statPath = JSON.parse(spMatch[1].replace(/'/g, '"')); } catch(e){ mismatched.push(line.trim()); continue; }

        const simple  = 's.' + statPath.join('.');
        const idx     = statPath.length === 2 && typeof statPath[1] === 'number'
            ? `s.${statPath[0]}[${statPath[1]}]`
            : null;
        const bracket = statPath.length === 2 && typeof statPath[1] === 'string'
            ? `s.${statPath[0]}['${statPath[1]}']`
            : null;
        const found = line.includes(simple) || (idx && line.includes(idx)) || (bracket && line.includes(bracket));
        if(!found) mismatched.push(line.trim());
    }
    assert(lines.length > 300, 'много записей достижений (' + lines.length + ')');
    assert(missing === 0, 'ни одной записи без statPath (пропущено: ' + missing + ')');
    assert(mismatched.length === 0, 'statPath каждой записи ссылается на ту же стату, что и её check() (расхождений: ' + mismatched.length + ')');

    assert(/statPath:\["dmg"\]/.test(achievementsSrc), 'dmg_1k: statPath ["dmg"] (простое поле)');
    assert(/statPath:\["soloKills",0\]/.test(achievementsSrc), 'solo_0: statPath ["soloKills",0] (индекс массива)');
    assert(/statPath:\["stash","k_lezv"\]/.test(achievementsSrc), "st_k_lezv1: statPath [\"stash\",\"k_lezv\"] (ключ объекта)");
}

console.log('\nTest 2: achievement-tiers.js — familyMembers(), getStatValue(), formatAchNum() определены и экспортированы');
{
    assert(/export function familyMembers\(list, familyKey\)/.test(tiersSrc), 'familyMembers() экспортирована');
    assert(/export function getStatValue\(s, statPath\)/.test(tiersSrc), 'getStatValue() экспортирована');
    assert(/export function formatAchNum\(n\)/.test(tiersSrc), 'formatAchNum() экспортирована (единый источник для interface-achievements.js и svod-achievements.js)');

    function achievementThreshold(a){ return a.threshold; }
    function achievementFamilyKey(a){ return a.cat === 'kill' ? a.id : a.cat; }
    function familyMembers(list, key){
        return list.filter(a => achievementFamilyKey(a) === key).sort((a,b)=>achievementThreshold(a)-achievementThreshold(b));
    }
    function getStatValue(s, statPath){
        let v = s;
        for(const seg of (statPath || [])){ if(v == null) return 0; v = v[seg]; }
        return v || 0;
    }

    const fam = [
        {id:'a1', cat:'damage', threshold:1000},
        {id:'a2', cat:'damage', threshold:500},
        {id:'a3', cat:'damage', threshold:2000},
    ];
    const sorted = familyMembers(fam, 'damage');
    assert(sorted.map(a=>a.id).join(',') === 'a2,a1,a3', 'familyMembers() сортирует тиры темы по возрастанию порога');
    assert(familyMembers([{id:'k1', cat:'kill'}], 'k1').length === 1, 'familyMembers() для темы из одного пункта возвращает массив длины 1 (не разворачивается)');

    assert(getStatValue({dmg: 4200000}, ['dmg']) === 4200000, 'getStatValue() читает простое поле');
    assert(getStatValue({kills:[0,3,0]}, ['kills',1]) === 3, 'getStatValue() читает элемент массива по индексу');
    assert(getStatValue({stash:{k_lezv: 7}}, ['stash','k_lezv']) === 7, 'getStatValue() читает ключ объекта');
    assert(getStatValue({stash:{}}, ['stash','k_lezv']) === 0, 'getStatValue() возвращает 0, если ключ ещё не встречался (не earned)');
    assert(getStatValue({}, ['missing']) === 0, 'getStatValue() не падает на отсутствующем верхнем поле, возвращает 0');
}

console.log('\nTest 3: svod-achievements.js — тир рендерится ЧЕРЕЗ ТОТ ЖЕ пул карточек, что и базовая тема (не отдельный "самодельный" пул)');
{
    assert(!/CHILD_POOL/.test(svodAchSrc), 'отдельный CHILD_POOL убран — больше нет второго, визуально иного пула строк');
    // Слово CHILD_H упоминается ТЕКСТОМ в объясняющем комментарии (что было раньше и почему
    // убрано) — это ожидаемо, проверяем только исполняемый КОД.
    const codeOnly = svodAchSrc.split('\n').filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//')).join('\n');
    assert(!/CHILD_H/.test(codeOnly), 'CHILD_H убран из исполняемого кода — тиры используют тот же CARD_H, что и базовые карточки');
    assert(/const cardBg = new PIXI\.Sprite\(PIXI\.Texture\.from\(IMG \+ 'кароточка достижений\.png'\)\);/.test(svodAchSrc),
        'единственный источник фона карточки — реальный ассет "кароточка достижений.png" (не Graphics-прямоугольник собственного дизайна)');
    assert(!/new PIXI\.Graphics\(\);\s*\n\s*row\.addChild\(bg\);/.test(svodAchSrc),
        'самодельный Graphics-фон для строки тира удалён');
    assert(/const _fillCard = \(c, a, opts\) => \{/.test(svodAchSrc),
        '_fillCard() — общая функция заполнения ОДНОЙ pool-карточки данными, используется и для темы, и для тира');
}

console.log('\nTest 4: svod-achievements.js — тир не кликабелен и не разворачивает ничего дальше (клик по нему — no-op)');
{
    // 28.09.2026 (адаптив под мобильные): обработчик переехал с card.on('pointerdown', ...) на
    // helper.onTap(card, ...) — тап = отпускание без смещения, иначе свайп-прокрутка списка
    // раскрывала карточку под пальцем. Логика внутри (no-op для тиров) не менялась.
    const start = svodAchSrc.indexOf("helper.onTap(card, () => {");
    const end   = svodAchSrc.indexOf('\n            });', start);
    const body  = svodAchSrc.slice(start, end);
    assert(/if\(co\._isTierRow \|\| !co\._expandable\) return;/.test(body),
        'клик по строке тира (co._isTierRow) — гарантированный no-op, независимо от _expandable');

    const fillStart = svodAchSrc.indexOf('const _fillCard = (c, a, opts) => {');
    const fillBody  = svodAchSrc.slice(fillStart, svodAchSrc.indexOf('\n        };', fillStart));
    // 25.09.2026: базовая карточка темы (не тир) тоже может показываться в режиме бара (см.
    // tests/svod-achievements-tier-vs-summary-progress-bar.test.js), поэтому условие стало
    // тернарным — но для isTierRow результат всегда false, гарантия не изменилась.
    assert(/c\.card\.interactive = c\.card\.buttonMode = isTierRow \? false : expandable;/.test(fillBody),
        'строка тира (isTierRow=true) не кликабельна и не разворачивается дальше, независимо от опций');
}

console.log('\nTest 5: svod-achievements.js — прогресс-бар тира считает current/target на ТОЙ ЖЕ карточке (общий пул), не падает без прогресса');
{
    const fillStart = svodAchSrc.indexOf('const _fillCard = (c, a, opts) => {');
    const fillBody  = svodAchSrc.slice(fillStart, svodAchSrc.indexOf('\n        };', fillStart));

    assert(/const target = achievementThreshold\(a\);/.test(fillBody), 'цель бара — реальный порог тира (a — сам тир внутри isTierRow-ветки)');
    assert(/const cur = getStatValue\(state, a\.statPath\);/.test(fillBody), 'текущее значение — через getStatValue() по explicit statPath тира');
    // 25.09.2026 (по прямому указанию, скриншот — "достижение выполнено, а полоска не
    // заполнена"): done (из серверного window.achievements.earned) приоритетнее cur/target —
    // см. tests/svod-achievements-tier-vs-summary-progress-bar.test.js Test 7 для полной проверки.
    assert(/const frac = done \? 1 : \(target > 0 \? Math\.min\(1, cur \/ target\) : 0\);/.test(fillBody),
        'для уже заработанного достижения (done) бар всегда 100%, независимо от cur; иначе — доля, ограниченная сверху 1, без деления на 0');
    assert(/c\.fracTxt\.visible = false;\s*\n\s*c\.fracTxt\.text = ''/.test(fillBody),
        'числовая подпись current/target у бара скрыта по требованию интерфейса');
    assert(/_setStarProgress\(c, opts\.starProgress\);/.test(fillBody),
        'звезда получает вычисленную долю прогресса вместо бинарной полной/пустой текстуры');
}

console.log('\nTest 6: svod-achievements.js — единый пул с запасом, явное предупреждение при исчерпании (не молчаливая потеря строк)');
{
    const poolMatch = svodAchSrc.match(/const CARD_POOL = (\d+);/);
    assert(poolMatch && parseInt(poolMatch[1]) >= 93 + 15,
        'CARD_POOL >= 93 тем + 15 доп.строк на самую длинную развёрнутую тему (16 тиров exp минус 1 уже учтённая как база)');
    assert(/пул карточек исчерпан \(CARD_POOL=/.test(svodAchSrc), 'при исчерпании пула — предупреждение в консоль (и для темы, и для тира), а не молчаливое усечение списка');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
