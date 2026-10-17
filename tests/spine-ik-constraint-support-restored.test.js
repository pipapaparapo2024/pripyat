/**
 * Test: 17.10.2026, по прямому указанию — "дописать поддержку спайновских констрейнов?".
 *
 * spine-boss.js раньше УДАЛЯЛ IK-таймлайны анимации перед парсингом (anim.ik), с комментарием
 * "runtime несовместим". Проверка показала, что это утверждение не подтверждается кодом самой
 * библиотеки: @esotericsoftware/spine-core (4.3.13) импортирует и использует IkConstraintTimeline
 * в SkeletonJson.js при чтении анимаций (case "ik" внутри readAnimation). Конкретного файла,
 * демонстрирующего поломку, предоставлено не было — пользователь явно принял риск снятия защиты
 * без репро ("Библиотека точно поддерживает IK — уберу защиту, риск беру на себя").
 *
 * Run: node tests/spine-ik-constraint-support-restored.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'spine-boss.js'), 'utf-8');

console.log('\nTest 1: spine-boss.js больше не удаляет anim.ik перед парсингом');
{
    assert(!/delete anim\.ik;/.test(src), 'delete anim.ik — убрано из кода');
    assert(!/содержит IK-таймлайны — удаляем/.test(src), 'предупреждение об удалении IK-таймлайнов убрано');
}

console.log('\nTest 2: readSkeletonData() по-прежнему в try/catch — ошибка парсинга (если случится) не уронит весь boss-fight экран');
{
    assert(/try\s*\{[\s\S]{0,250}skelData = skelJson\.readSkeletonData\(jsonData\);/.test(src),
        'readSkeletonData() вызывается внутри try — ошибка парсинга ловится, а не бросается наружу');
    assert(/ОШИБКА readSkeletonData/.test(src), 'ошибка парсинга по-прежнему логируется с полным сообщением/стеком');
}

console.log('\nTest 3: независимая проверка — @esotericsoftware/spine-core реально поддерживает IK-таймлайны анимации');
{
    try {
        const spineCorePkg = path.join(root, '_client', 'node_modules', '@esotericsoftware', 'spine-core');
        const skeletonJsonSrc = fs.readFileSync(path.join(spineCorePkg, 'dist', 'SkeletonJson.js'), 'utf-8');
        const animationSrc = fs.readFileSync(path.join(spineCorePkg, 'dist', 'Animation.js'), 'utf-8');
        assert(/IkConstraintTimeline/.test(animationSrc), 'Animation.js экспортирует класс IkConstraintTimeline');
        assert(/import \{[\s\S]*IkConstraintTimeline[\s\S]*\} from "\.\/Animation\.js"/.test(skeletonJsonSrc),
            'SkeletonJson.js импортирует IkConstraintTimeline из Animation.js');
        assert(/new IkConstraintTimeline\(/.test(skeletonJsonSrc),
            'SkeletonJson.js реально создаёт IkConstraintTimeline при чтении анимации (case "ik")');
    } catch(e) {
        failed++;
        console.error('  ❌ FAIL: не удалось проверить исходники spine-core —', e.message);
    }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
