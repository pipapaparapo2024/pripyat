/**
 * Test: 28.09.2026, по прямому указанию — "ограничение в нике 15 символов, если у человека
 * имя+фамилия из ВК длиннее 15 символов — имя пишем как обычно (полностью), а вместо фамилии
 * первую букву фамилии и точку". Пример из задачи: "Александр Александрович" → "Александр А."
 *
 * Место: preloader.js, единственная точка, где начальный ник берётся из VK (first_name +
 * last_name) — только при первом входе, пока игрок сам не поменял ник через попап (см.
 * !savedNick guard рядом). 15 — тот же лимит, что уже стоит в popups/nick.js (inp.maxLength=15)
 * для ручного ввода ника — используем один и тот же порог для согласованности.
 *
 * Run: node tests/vk-nick-long-surname-abbreviation.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const preloaderSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'preloader.js'), 'utf-8');
const nickPopupSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'popups', 'nick.js'), 'utf-8');

console.log('\nTest 1: preloader.js — сокращение фамилии применяется только когда "Имя Фамилия" длиннее 15');
{
    const idx = preloaderSrc.indexOf("bridge.sendPromise(\"VKWebAppGetUserInfo\")");
    const body = preloaderSrc.slice(idx, idx + 1200);
    assert(/if\(vkNick\.length > 15 && info\.first_name && info\.last_name\)\{/.test(body),
        'условие срабатывает только если объединённая строка длиннее 15 символов');
    assert(/vkNick = info\.first_name\.trim\(\) \+ ' ' \+ info\.last_name\.trim\(\)\.charAt\(0\) \+ '\.';/.test(body),
        'имя пишется полностью, фамилия сокращается до первой буквы с точкой');
    assert(/let vkNick = \[info\.first_name, info\.last_name\]/.test(preloaderSrc),
        'vkNick объявлен через let (не const) — переприсваивается при сокращении');
}

console.log('\nTest 2: 15 — тот же лимит, что и в ручном вводе ника (popups/nick.js), не магическое отдельное число');
{
    assert(/inp\.maxLength = 15;/.test(nickPopupSrc), 'ручной ввод ника лимитирован теми же 15 символами');
}

console.log('\nTest 3: реальное выполнение формулы сокращения на примере из задачи и граничных случаях');
{
    function formatVkNick(first_name, last_name){
        let vkNick = [first_name, last_name].filter(Boolean).join(' ').trim();
        if(vkNick.length > 15 && first_name && last_name){
            vkNick = first_name.trim() + ' ' + last_name.trim().charAt(0) + '.';
        }
        return vkNick;
    }

    assert(formatVkNick('Александр', 'Александрович') === 'Александр А.',
        'пример из задачи: "Александр Александрович" (24 симв.) → "Александр А."');
    assert(formatVkNick('Иван', 'Иванов') === 'Иван Иванов',
        'короткое ФИО (12 симв., <=15) остаётся полным, без сокращения');
    assert(formatVkNick('Мария', 'Петрова') === 'Мария Петрова',
        'ровно на грани (13 симв.) — без сокращения');
    assert(formatVkNick('Владислав', null) === 'Владислав',
        'нет фамилии вовсе — имя как есть, сокращать нечего');
    assert(formatVkNick('Владислав', '') === 'Владислав',
        'пустая фамилия — тот же случай, что и null');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
