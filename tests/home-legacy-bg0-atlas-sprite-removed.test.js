/**
 * Test: 28.09.2026, по прямому указанию (скриншот редактора позиций — "Выбрано:
 * home_elements_atlas_1.png", "убери из игры файл home_elements_atlas_1.png — он до сих
 * пор выводится на экран") — предыдущий фикс (home-elements-dead-asset-removed.test.js,
 * 24.09.2026) удалил ЛОКАЛЬНЫЕ файлы FLA-библиотеки, но не заметил, что home.js всё ещё
 * АКТИВНО создавал видимый спрайт из этого атласа: init() делал
 * `this.bgs = helper.duplicate(this.bgs); this.home.back_mc.addChild(this.bgs);` —
 * helper.duplicate() = `new obj.constructor()`, теряет setTransform(-2000) оригинала
 * (Home_backgrounds/home_bg0 создавались НАМЕРЕННО за кадром), поэтому свежий экземпляр
 * рождался в (0,0) и его внутренний спрайт (текстура из home_elements_atlas_1.png)
 * оказывался в кадре внутри back_mc. Актуальный фон комнаты полностью рисует updateBg()
 * (PNG из _bgFiles) — легаси-спрайт был лишним. Удалены: duplicate+addChild в home.js,
 * неиспользуемый параметр backgrounds/this.bgs, передача home_bgs в module_control.js.
 * home_full/back_mc (структурный контейнер FLA-библиотеки) — НЕ трогали, он по-прежнему
 * нужен updateBg() как родитель для _hataBgSpr.
 *
 * Run: node tests/home-legacy-bg0-atlas-sprite-removed.test.js
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let passed = 0;
function assert(ok, message){ if(!ok) throw new Error(message); console.log('  ✅ ' + message); passed++; }

const homeJs = fs.readFileSync(path.join(root, '_client/src/game/home.js'), 'utf8');
const moduleControlJs = fs.readFileSync(path.join(root, '_client/src/modules/module_control.js'), 'utf8');
// 28.09.2026 (найдено полным прогоном): проверки ниже ищут голые подстроки кода, а
// объясняющий комментарий чуть выше в самом home.js (описывающий, ЧТО именно убрано и почему)
// неизбежно упоминает те же имена — без исключения строк-комментариев тест матчился сам на себя.
const homeJsCode = homeJs.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

console.log('\nhome.js — легаси home_bg0 (атлас home_elements_atlas_1.png) больше не добавляется в сцену');
assert(!/helper\.duplicate\(this\.bgs\)/.test(homeJsCode), 'helper.duplicate(this.bgs) удалён из init()');
assert(!/this\.home\.back_mc\.addChild\(this\.bgs\)/.test(homeJsCode), 'addChild(this.bgs) в back_mc удалён');
assert(!/this\.bgs\s*=\s*backgrounds/.test(homeJsCode), 'конструктор больше не сохраняет неиспользуемый backgrounds в this.bgs');

console.log('\nРегресс-гвард — updateBg() (актуальный фон) остался нетронутым');
assert(/updateBg\(\)\s*{/.test(homeJs), 'метод updateBg() присутствует');
assert(/this\.home\.back_mc\.addChild\(this\._hataBgSpr\)/.test(homeJs), 'updateBg() по-прежнему добавляет актуальный фон в back_mc');
assert(/root\.layer0_mc\.addChild\(this\.home\)/.test(homeJs), 'home_full (структурный контейнер FLA) по-прежнему добавляется в layer0_mc — нужен для back_mc');

console.log('\nmodule_control.js — home_bgs больше не передаётся в конструктор Home');
assert(!/this\.names\['home'\]\.home_bgs/.test(moduleControlJs), 'ссылка на .home_bgs удалена из constructHome()');
assert(/new Home\(this\.names\['home'\]\.home_full\)/.test(moduleControlJs), 'Home создаётся только с home_full (один аргумент)');

console.log(`\n${'─'.repeat(50)}`);
console.log(`✅ All ${passed} tests passed`);
