/**
 * Test: 30.09.2026, по прямому указанию — пошаговое обучение (онбординг).
 *
 * Флоу: интро-попап (текст 1) → смена позывного (попап ника ПОВЕРХ попапа обучения, не вместо
 * него) → тур по 8 вкладкам (двор/зона/база/хабар/боссы/сводка/шмотки/сидорович — рука-
 * указатель + затемнение + закадровая озвучка, переход по концу mp3 ИЛИ по выходу в главное
 * меню) → попап про валюту (текст 10) → финальный попап (текст 11, любая кнопка завершает).
 *
 * Временно доступно ТОЛЬКО двум VK id (разработчик + Николай Седенко) — у остальных игроков
 * не показывается и не вызывается вообще.
 *
 * Run: node tests/onboarding-tutorial-full-flow.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf-8');

const dataSrc    = read('_client/src/game/onboarding/onboarding-data.js');
const popupSrc   = read('_client/src/game/onboarding/onboarding-popup.js');
const tourSrc    = read('_client/src/game/onboarding/onboarding-tour.js');
const mainSrc    = read('_client/src/game/onboarding.js');
const nickSrc    = read('_client/src/game/shell/popups/nick.js');
const moduleCtrl = read('_client/src/modules/module_control.js');
const gameBoot    = read('_client/src/game/game-boot.js');
const devPanelSrc = read('_client/src/game/shell/overlays/dev_panel.js');
const usersPhp    = read('server/core/controllers/users.php');

console.log('\n1) Гейт — обучение открыто всем игрокам (снят по прямому указанию 30.09.2026, второй заход)');
{
    assert(!/ELIGIBLE_UIDS/.test(dataSrc), 'ELIGIBLE_UIDS убран из onboarding-data.js целиком — мёртвый код, не импортируется нигде');
    assert(/_isEligible\(\)\{\s*\n\s*return true;\s*\n\s*\}/.test(mainSrc),
        '_isEligible() теперь всегда true — метод оставлен как единая точка для будущего гейта, не удалён целиком');
    assert(!/import \{ ELIGIBLE_UIDS/.test(mainSrc), 'onboarding.js больше не импортирует ELIGIBLE_UIDS');
}

console.log('\n2) Сервер — onboarding_step в whitelist users.php');
{
    assert(/'onboarding_step',\s*\n\s*\];/.test(usersPhp),
        "'onboarding_step' добавлено в whitelist \$allowed (обычное поле, не server-only)");
}

console.log('\n3) Тексты попапа — 1-в-1 из присланной озвучки (интро/валюта/финал)');
{
    assert(/intro:\s*'Здорово были, уважаемый, я Седенко Николай Васильевич, можно просто Седой\. Ты новенький в Припяти\? Как тебя звать\?'/.test(dataSrc),
        'текст интро совпадает с озвучкой файла 1');
    assert(/currency:\s*'Давай по части валюты\./.test(dataSrc) && /Сигареты — это самая слабая валюта, её легко заработать\.'/.test(dataSrc),
        'текст про валюту совпадает с озвучкой файла 10 (начало и конец фразы)');
    assert(/final:\s*'Совсем утомился\. Зона не щадит никого\./.test(dataSrc) && /Самое главное я тебе показал\. Бывай\.'/.test(dataSrc),
        'финальный текст совпадает с озвучкой файла 11');
}

console.log('\n4) Тур — ровно 8 вкладок, в правильном порядке, с нужными звуковыми файлами');
{
    const order = [...dataSrc.matchAll(/key: '(\w+)', label: '([^']+)'/g)].map(m => m[1]);
    assert(JSON.stringify(order) === JSON.stringify(['dvor','zone','baza','habar','bosses','svod','shmot','sidorovich']),
        'порядок шагов тура: двор→зона→база→хабар→боссы→сводка→шмотки→сидорович (нашли: ' + order.join(',') + ')');

    const soundMap = {
        dvor: '2 описание двора.mp3', zone: '3 описание зоны.mp3', baza: '4 описание база.mp3',
        habar: '5 описание хабара.mp3', bosses: '6 описание боссов.mp3', svod: '7 описание сводка.mp3',
        shmot: '8 описание шмотки.mp3', sidorovich: '9 описание сидорович.mp3',
    };
    for(const [key, fname] of Object.entries(soundMap)){
        const re = new RegExp("key: '" + key + "'[\\s\\S]{0,150}sound: SOUND_BASE \\+ '" + fname.replace(/[.]/g, '\\.') + "'");
        assert(re.test(dataSrc), 'шаг "' + key + '" использует звук "' + fname + '"');
    }
    // 02.10.2026: добавлен шаг 'permission' между final и done (отдельный попап "разрешить
    // доступ к друзьям?" после финальной реплики Седого, см. onboarding-popup.js._onContinue
    // state === 'final'/'permission' ниже и TEXT_Y_BY_STATE/TEXT_W_BY_STATE в п.12).
    assert(/export const STEP_SEQUENCE = \['intro', \.\.\.TOUR_TABS\.map\(t => t\.key\), 'currency', 'final', 'permission', 'done'\];/.test(dataSrc),
        'полная последовательность шагов: intro → 8 вкладок тура → currency → final → permission → done');
}

console.log('\n5) Смена позывного — попап ника ПОВЕРХ попапа обучения, не вместо него');
{
    const onContinueBody = popupSrc.slice(popupSrc.indexOf("_onContinue = function"), popupSrc.indexOf('_onMerge = function'));
    assert(/if\(this\._popupState === 'intro'\)\{/.test(onContinueBody), '"Продолжить" на интро-попапе обрабатывается отдельной веткой');
    assert(!/this\._hidePopup\(\);[\s\S]{0,80}iface\._openNickPopup/.test(onContinueBody),
        'попап обучения НЕ скрывается перед открытием попапа ника (см. прямое указание — попап ника открывается ПОВЕРХ)');
    assert(/iface\._openNickPopup\(\(nick\) => \{/.test(onContinueBody),
        'открывает попап ника с колбэком onSaved');
    assert(/this\._hidePopup\(\);\s*\n\s*this\._setStep\('dvor'\);\s*\n\s*this\._startTourStep\('dvor'\);/.test(onContinueBody),
        'колбэк onSaved: прячет попап обучения, шаг → dvor, стартует тур с первой вкладки (Двор)');
}
{
    // 02.10.2026: добавлен второй необязательный колбэк onCancelled (вызывается из
    // _closeNickPopup(saved=false) — крест/клик мимо/«Отменить» — см. ниже), сигнатура
    // _openNickPopup расширилась, сам onSaved никуда не делся.
    assert(/proto\._openNickPopup = function\(onSaved, onCancelled\)\{/.test(nickSrc),
        'nick.js: _openNickPopup принимает необязательные колбэки onSaved и onCancelled');
    assert(/this\._nickPopupOnSaved = onSaved \|\| null;/.test(nickSrc),
        'колбэк onSaved сохраняется на this — переживает пересборку/показ попапа');
    assert(/this\._nickPopupOnCancelled = onCancelled \|\| null;/.test(nickSrc),
        'колбэк onCancelled тоже сохраняется на this');
    const potvBody = nickSrc.slice(nickSrc.indexOf("potvHit.on('pointerup'"), nickSrc.indexOf("otmnHit = makeParallelogramHit"));
    assert(/if\(val\)\{\s*\n\s*this\._saveNick\(val\);/.test(potvBody),
        'колбэк вызывается ТОЛЬКО при непустом введённом нике (реальное подтверждение)');
    assert(/if\(this\._nickPopupOnSaved\)\{ const cb = this\._nickPopupOnSaved; this\._nickPopupOnSaved = null; cb\(val\); \}/.test(potvBody),
        'колбэк вызывается один раз и сбрасывается — не переживёт следующий показ попапа без явной передачи');
    // "Отменить" (otmnHit) не должен вызывать колбэк вообще — только _closeNickPopup.
    const otmnBody = nickSrc.slice(nickSrc.indexOf("otmnHit.on('pointerup'"), nickSrc.indexOf('proto._showNickInput'));
    assert(!/_nickPopupOnSaved/.test(otmnBody), '"Отменить" не трогает _nickPopupOnSaved — попап обучения остаётся ждать как был');
}

console.log('\n6) Прогресс тура — выход в главное меню продвигает на следующий шаг');
{
    // 02.10.2026: _playNarration(tab.sound, () => this._advanceTour(tab.key)) -> без колбэка —
    // шаг тура теперь продвигается ТОЛЬКО выходом из экрана (popHud/hata.close), конец озвучки
    // сам по себе больше не продвигает. Подтверждено намеренным: в том же коммите (9f266d2 "Fix
    // moderation, boss keys, rewards and dev access") добавлен tests/onboarding-avatar-key-flow.test.js
    // с прямой проверкой "озвучка сама не переключает следующий шаг тура" — т.е. это не случайный
    // побочный эффект правки, а фиксированное новое поведение. ПОБОЧНЫЙ ХВОСТ (не функциональный
    // баг, отдельная мелкая задача): докблок в шапке ЭТОГО файла (строки 1-6) не обновлён и
    // по-прежнему описывает старое поведение "...когда озвучка доиграла ИЛИ игрок сам вышел — что
    // наступит раньше" — вводит в заблуждение, стоит поправить отдельно.
    assert(/tab\.open\(\);\s*\n(\s*if\(tab\.key === 'dvor'[\s\S]{0,160}\n\s*\}\s*\n)?\s*this\._playNarration\(tab\.sound\);/.test(tourSrc),
        'клик по подсвеченной вкладке: открывает экран, играет звук — без onComplete-колбэка (шаг продвигается только выходом из экрана)');
    assert(/if\(this\._activeTourKey !== fromKey\) return;/.test(tourSrc),
        '_advanceTour идемпотентен — повторный/устаревший вызов для уже пройденного шага игнорируется');
    assert(/this\._stopNarration\(\);/.test(tourSrc.slice(tourSrc.indexOf('_advanceTour = function'))),
        '_advanceTour останавливает озвучку (в т.ч. если игрок вышел раньше, чем она доиграла)');
    assert(/const next = TOUR_TABS\[idx \+ 1\];/.test(tourSrc) && /this\._setStep\('currency'\);\s*\n\s*this\._showPopup\('currency'\);/.test(tourSrc),
        'после последнего шага тура (Сидорович) — переход к попапу про валюту, не к несуществующему 9-му шагу');
}
{
    // 30.09.2026 (баг по живому тесту — "аудио не гаснет при выходе, зависание на Зоне,
    // порядок шагов будто перепутан"): _closeAllPanels() не в цепочке у большинства собственных
    // кнопок выхода экранов (напр. zone_screen.js вызывает iface.popHud('zone') напрямую) — а
    // вызывается ОН САМ при открытии ЛЮБОЙ вкладки, из-за чего старый безусловный патч продвигал
    // тур по клику на ЛЮБУЮ вкладку, а не только целевую. Хук переписан на iface.popHud(id) —
    // единственную точку, которую реально вызывают ВСЕ 8 экранов тура при закрытии — плюс
    // отдельный патч hata.close() (единственный экран без pushHud/popHud вообще).
    const hookBody = tourSrc.slice(tourSrc.indexOf('_hookScreenClose = function'));
    assert(/if\(!window\.iface \|\| iface\._onboardingCloseHooked\) return;/.test(hookBody),
        '_hookScreenClose ставится один раз (идемпотентно) — повторный вызов start()/restart() не наслаивает патчи');
    assert(/const originalPopHud = iface\.popHud\.bind\(iface\);/.test(hookBody),
        'патчит iface.popHud — единую точку, которую вызывают ВСЕ 8 экранов тура при закрытии (в т.ч. в обход _closeAllPanels)');
    assert(/HUD_ID_TO_TAB_KEY\[id\] === this\._activeTourKey/.test(hookBody),
        'продвигает тур ТОЛЬКО если id закрывшегося экрана совпадает с активным шагом (не любой чужой popHud типа yashik/ryukzak)');
    assert(/hata\.close = \(\) => \{/.test(hookBody) && /if\(this\._activeTourKey === 'baza'\)/.test(hookBody),
        'База (Хата) патчится отдельно — единственный экран тура без pushHud/popHud (legacy close())');
    assert(!/const original = iface\._closeAllPanels\.bind\(iface\);/.test(hookBody),
        'старый безусловный патч _closeAllPanels (продвигал тур по клику на ЛЮБУЮ вкладку) удалён');
}

console.log('\n7) Попап про валюту → финал: "Продолжить" меняет текст на месте, любая кнопка на финале завершает');
{
    const onContinueBody = popupSrc.slice(popupSrc.indexOf("_onContinue = function"), popupSrc.indexOf('_onMerge = function'));
    assert(/if\(this\._popupState === 'currency'\)\{\s*\n\s*this\._showPopup\('final'\);\s*\n\s*this\._setStep\('final'\);/.test(onContinueBody),
        '"Продолжить" на попапе валюты переключает ТОТ ЖЕ попап на финальный текст, шаг → final');
    // 02.10.2026: между final и done добавлен шаг 'permission' (см. п.1 выше, STEP_SEQUENCE) —
    // отдельный попап "разрешить доступ к друзьям?" после реплики Седого. «Продолжить» на final
    // теперь сначала переключает на permission, обучение заканчивается (_finish()) только после
    // «Продолжить» уже НА permission — та же суть ("любая кнопка этой фазы завершает"), просто
    // появился промежуточный шаг.
    assert(/if\(this\._popupState === 'final'\)\{\s*\n\s*this\._mergeArmed = false;\s*\n\s*this\._setStep\('permission'\);\s*\n\s*this\._showPopup\('permission'\);\s*\n\s*return;\s*\n\s*\}/.test(onContinueBody),
        '"Продолжить" на финальном попапе переключает на новый попап "permission" (запрос доступа к друзьям), не завершает обучение напрямую');
    assert(/if\(this\._popupState === 'permission'\)\{[\s\S]{0,400}this\._finish\(\);/.test(onContinueBody),
        '"Продолжить" на попапе "permission" завершает обучение (_finish() вызывается именно здесь)');
    const onMergeBody = popupSrc.slice(popupSrc.indexOf('_onMerge = function'), popupSrc.indexOf('_finish = function'));
    assert(/this\._finish\(\);/.test(onMergeBody), '"Слиться" в любом состоянии завершает обучение');
    const finishBody = popupSrc.slice(popupSrc.indexOf('_finish = function'));
    assert(/this\._setStep\('done'\);/.test(finishBody), '_finish() выставляет шаг done — обучение больше не покажется');
}

console.log('\n8) Запуск при старте игры и кнопка dev-панели для повторного теста');
{
    assert(/import Onboarding  from '\.\.\/game\/onboarding\.js';/.test(moduleCtrl), 'module_control.js импортирует Onboarding');
    assert(/window\.onboarding = new Onboarding\(\);\s*\n\s*onboarding\.start\(\);/.test(moduleCtrl),
        'module_control.js создаёт и запускает onboarding в той же "всё готово" точке, что achievements._checkAll()');

    assert(/_section\('ОБУЧЕНИЕ'\);/.test(devPanelSrc), 'dev-панель: есть секция "ОБУЧЕНИЕ"');
    assert(/if\(window\.onboarding\) onboarding\.restart\(\);/.test(devPanelSrc),
        'кнопка dev-панели вызывает onboarding.restart() — работает независимо от uid, для тестирования');
}

console.log('\n9) Прелоад — 6 новых картинок попапа/руки в общем списке _allGamePngs');
{
    for(const f of ['попап обучение.png','продолжить актив.png','продолжить пассив.png','слиться актив.png','слиться пассив.png','рука указатель.png']){
        assert(gameBoot.includes("'" + f + "'"), 'прелоад содержит "' + f + '"');
    }
}

console.log('\n10) Ассеты реально лежат на диске (PNG попапа/кнопок/руки + все 11 mp3)');
{
    const imgDir = path.join(root, '_client', 'development', 'images');
    for(const f of ['попап обучение.png','продолжить актив.png','продолжить пассив.png','слиться актив.png','слиться пассив.png','рука указатель.png']){
        assert(fs.existsSync(path.join(imgDir, f)), 'файл "' + f + '" существует в _client/development/images/');
    }
    const soundDir = path.join(root, '_client', 'development', 'sounds');
    const sounds = [
        '1 приветствие попап позывного.mp3','2 описание двора.mp3','3 описание зоны.mp3',
        '4 описание база.mp3','5 описание хабара.mp3','6 описание боссов.mp3','7 описание сводка.mp3',
        '8 описание шмотки.mp3','9 описание сидорович.mp3','10 описание валюты.mp3','11 конец обучения.mp3',
    ];
    for(const f of sounds){
        assert(fs.existsSync(path.join(soundDir, f)), 'звук "' + f + '" существует в _client/development/sounds/');
    }
}

console.log('\n11) Старт отложен до реального скрытия видео-прелоадера (не до готовности данных)');
{
    const startBody = mainSrc.slice(mainSrc.indexOf('start(){'), mainSrc.indexOf('restart(){'));
    assert(/if\(window\.onPreloaderHidden\) window\.onPreloaderHidden\(run\);\s*\n\s*else run\(\);/.test(startBody),
        'start() откладывает показ попапа/тура через window.onPreloaderHidden(run), а не показывает сразу');
    assert(/const step = this\._currentStep\(\);[\s\S]{0,150}if\(step === 'done'\) return;/.test(startBody),
        'eligibility/шаг читаются СРАЗУ (не отложены) — откладывается только сам показ');
}
{
    const indexSrc = read('_client/src/index.js');
    assert(/window\._preloaderHiddenFired = false;/.test(indexSrc), 'index.js заводит флаг _preloaderHiddenFired');
    assert(/window\.onPreloaderHidden = \(cb\) => \{\s*\n\s*if\(window\._preloaderHiddenFired\) cb\(\);\s*\n\s*else _preloaderHiddenListeners\.push\(cb\);/.test(indexSrc),
        'window.onPreloaderHidden(cb) — вызывает сразу, если прелоадер уже скрыт, иначе ставит в очередь');
    assert(/_preloaderHiddenListeners\.forEach\(cb => \{ try\{ cb\(\); \}/.test(indexSrc),
        '_onPreloaderHidden() (реальное скрытие видео) разбирает очередь колбэков');
}

console.log('\n12) Попап обучения — координаты текста (по состояниям) + затемнение экрана (живой тест 30.09.2026)');
{
    assert(/const TEXT_X = 625, TEXT_SCALE = 0\.907;/.test(popupSrc), 'x и scale общие для всех состояний');
    // 02.10.2026: добавлено 4-е состояние 'permission' (новый попап после final — запрос
    // доступа к друзьям, см. STEP_SEQUENCE в п.1 и _onContinue в п.7) — дописано в обе карты,
    // не заменяет прежние 3 состояния.
    assert(/const TEXT_Y_BY_STATE = \{ intro: 312, currency: 232, final: 312, permission: 255 \};/.test(popupSrc),
        'Y текста разный по состояниям: интро/финал 312, про валюту 232 (текст длиннее, начинается выше), permission 255');
    assert(/const TEXT_W_BY_STATE\s*= \{ intro: 375, currency: 372, final: 375, permission: 372 \};/.test(popupSrc),
        'wordWrapWidth разный по состояниям: интро/финал 375 (340/0.907), про валюту 372 (337/0.907), permission 372');
    assert(/text\.scale\.set\(TEXT_SCALE\);/.test(popupSrc), 'scale реально применяется к тексту');
    assert(/blocker\.beginFill\(0x000000, 0\.6\);/.test(popupSrc.slice(popupSrc.indexOf('_buildPopup'), popupSrc.indexOf('_showPopup'))),
        'blocker попапа теперь затемняет экран (было 0.001 — только перехват кликов, экран оставался прозрачным)');

    const showPopupBody = popupSrc.slice(popupSrc.indexOf('_showPopup = function'), popupSrc.indexOf('_hidePopup = function'));
    assert(/this\._onboardingText\.y = TEXT_Y_BY_STATE\[state\]/.test(showPopupBody),
        '_showPopup(state) переставляет text.y под нужное состояние при каждом показе');
    assert(/this\._onboardingText\.style\.wordWrapWidth = TEXT_W_BY_STATE\[state\]/.test(showPopupBody),
        '_showPopup(state) переставляет wordWrapWidth под нужное состояние при каждом показе');
}

console.log('\n13) Рука-указатель — target (кнопка) и hand (сам спрайт, x/y/scale/rot) разведены');
{
    assert(/target: \{ x: 1123, y: 175 \}/.test(dataSrc), 'target Двора — прежняя позиция HUD-кнопки (для пульса и кликабельной зоны)');
    assert(/hand: \{ x: 1092, y: 223, scale: 1\.000, rot: -63 \}/.test(dataSrc),
        'hand Двора — новая трансформация спрайта руки, снятая через живой тест (x/y/scale/rot независимы от target)');
    assert(/target: \{ x: 1123, y: 236 \}/.test(dataSrc), 'target Базы сохранён как раньше (вычислен из HUD-разметки)');
    assert(/target: \{ x: 986, y: 632 \}/.test(dataSrc),
        'target Зоны обновлён по скриншоту нижнего ряда ХУДа — старое (1101,508) не совпадало с реальной кнопкой (баг "зависло на Зоне")');

    const overlayBody = tourSrc.slice(tourSrc.indexOf('_buildTourOverlay = function'), tourSrc.indexOf('_destroyTourOverlay = function'));
    assert(/const target = tab\.target;/.test(overlayBody), 'пульс/хит-зона строятся по tab.target');
    assert(/const h = tab\.hand \|\| \{ x: target\.x, y: target\.y \+ 10, scale: 1, rot: 0 \};/.test(overlayBody),
        'если tab.hand не задан — старый дефолт (над target, без поворота) как фолбэк для ещё не откорректированных шагов');
    assert(/hand\.rotation = \(h\.rot \|\| 0\) \* Math\.PI \/ 180;/.test(overlayBody) && /hand\.scale\.set\(h\.scale != null \? h\.scale : 1\);/.test(overlayBody),
        'спрайт руки реально применяет rotation/scale из tab.hand');
}

console.log('\n14) ХУД жёстко заблокирован во время шага тура (не только z-order/blocker)');
{
    const overlayBody = tourSrc.slice(tourSrc.indexOf('_buildTourOverlay = function'), tourSrc.indexOf('_destroyTourOverlay = function'));
    assert(/iface\.up\.interactiveChildren = false;/.test(overlayBody) && /iface\.down\.interactiveChildren = false;/.test(overlayBody),
        'верхний и нижний ХУД теряют интерактивность целиком, пока идёт шаг тура (баг: другие вкладки кликались параллельно с целевой)');
    assert(/iface\._pngRightPanel\.interactiveChildren = false;/.test(overlayBody),
        'правая PNG-панель (двор/база/хабар/сводка) тоже блокируется');
    assert(/const _keepOnTop = \(\) => \{ if\(win\.parent\) win\.parent\.addChild\(win\); \};\s*\n\s*PIXI\.Ticker\.shared\.add\(_keepOnTop\);/.test(overlayBody),
        'оверлей туда каждый кадр возвращается в конец списка детей — рука/затемнение гарантированно выше ХУДа по z-index');

    const destroyBody = tourSrc.slice(tourSrc.indexOf('_destroyTourOverlay = function'), tourSrc.indexOf('_advanceTour = function'));
    assert(/iface\.up\.interactiveChildren = true;/.test(destroyBody) && /iface\.down\.interactiveChildren = true;/.test(destroyBody),
        'ХУД возвращает интерактивность при разрушении оверлея (клик по целевой кнопке, выход, следующий шаг)');
}

console.log('\n15) Хабар — баг найден по живому тесту ("открываю Хабар, а поверх мгновенно всплывает рука/пульс следующего шага")');
{
    // Корень: habar.close() вызывается БЕЗ проверки открытости из interface-panels.js
    // _closeAllPanels() (в отличие от dvor/weapons/hata на этих же строках) — а он сам
    // вызывается ПЕРВОЙ строкой openModule(), в т.ч. при открытии САМОГО Хабара. habar.close()
    // безусловно зовёт iface.popHud('habar') — с новым хуком (п.13 выше по списку изменений
    // сессии) это продвигало тур ДО того, как игрок вообще увидел экран Хабара.
    const panelsSrc = read('_client/src/game/interface/interface-panels.js');
    const closeAllBody = panelsSrc.slice(panelsSrc.indexOf('_closeAllPanels = function'), panelsSrc.indexOf('_initCloseBtn = function'));
    assert(/if\(window\.habar && typeof habar\.close === 'function' && habar\._pixiWin && habar\._pixiWin\.parent\) habar\.close\(\);/.test(closeAllBody),
        'habar.close() в _closeAllPanels() теперь вызывается ТОЛЬКО если Хабар реально открыт — тот же guard-паттерн, что уже у dvor/weapons/hata на этих же строках');

    // dev_panel.js._resetAccount() — НЕ трогали, там безусловный вызов намеренный (комментарий
    // "Закрываем его без условия на parent: после сброса он мог остаться видимым").
    assert(/if\(window\.habar && typeof habar\.close === 'function'\) habar\.close\(\);/.test(devPanelSrc),
        'dev_panel.js._resetAccount() сохранил намеренно безусловный вызов — это другой, оправданный случай, не трогали');
}

console.log('\n16) Фон страницы — реальный баг найден (JS перезаписывал CSS body.background на чистый чёрный)');
{
    const indexSrc = read('_client/src/index.js');
    assert(!/document\.body\.style\.background = '#000';/.test(indexSrc),
        'убрана строка, которая ВСЕГДА перезаписывала body.background (инлайн-стиль побеждает CSS-правило из index.html с url(side-background.png)) — 3 дня жалоб "фон не отображается" были НЕ про кэш');
    assert(/document\.body\.style\.margin = '0';/.test(indexSrc) && /document\.body\.style\.overflow = 'hidden';/.test(indexSrc),
        'остальные инлайн-стили body (margin/overflow) не убирали — они не конфликтуют с CSS-правилом фона');
}

console.log('\n17) Маркер target перетаскиваемый через универсальный редактор позиций (по прямому указанию)');
{
    const overlayBody = tourSrc.slice(tourSrc.indexOf('_buildTourOverlay = function'), tourSrc.indexOf('_destroyTourOverlay = function'));
    assert(/marker\._uDraggable = true;/.test(overlayBody),
        'маркер помечен _uDraggable — universal_pos_editor.js подхватывает его наравне со Sprite/Text');
    assert(/marker\._uOnTransform = \(\) => \{\s*\n\s*target\.x = Math\.round\(marker\.x\);\s*\n\s*target\.y = Math\.round\(marker\.y\);/.test(overlayBody),
        'перемещение маркера редактором напрямую переписывает tab.target.x/y — тот же объект, что использует pulseTick');
    assert(/hit\.clear\(\);\s*\n\s*hit\.beginFill\(0xffffff, 0\.001\);\s*\n\s*hit\.drawCircle\(target\.x, target\.y, HIT_SIZE\);/.test(overlayBody),
        'кликабельная зона перерисовывается каждый кадр по target — следует за маркером без пересборки шага');
}

console.log('\n18) Координаты руки заданы для всех 8 шагов тура (второй живой тест 30.09.2026)');
{
    const HAND_BY_KEY = {
        dvor:       { x: 1092, y: 223, rot: -63 },
        zone:       { x: 1029, y: 668, rot: -146 },
        baza:       { x: 1090, y: 282, rot: -60 },
        habar:      { x: 1083, y: 336, rot: -50 },
        bosses:     { x: 405,  y: 673, rot: -140 },
        svod:       { x: 1085, y: 399, rot: -53 },
        shmot:      { x: 881,  y: 672, rot: -140 },
        sidorovich: { x: 226,  y: 671, rot: -143 },
    };
    for(const [key, h] of Object.entries(HAND_BY_KEY)){
        const re = new RegExp("key: '" + key + "'[\\s\\S]{0,900}hand: \\{ x: " + h.x + ", y: " + h.y + ", scale: 1\\.000, rot: " + h.rot + " \\}");
        assert(re.test(dataSrc), 'шаг "' + key + '" — hand задан (x:' + h.x + ', y:' + h.y + ', rot:' + h.rot + '°)');
    }
}

console.log('\n19) Подсветка ресурсов (тушёнка/рубли/сигареты) во время попапа "про валюту" (по прямому указанию, пересмотрено тем же днём)');
{
    assert(/const RESOURCE_KEYS = \['val_stew', 'val_coins', 'val_cigarettes'\];/.test(popupSrc),
        'подсвечиваются все 3 ресурса верхнего ХУДа');

    const buildBody = popupSrc.slice(popupSrc.indexOf('_buildCurrencyHighlights = function'), popupSrc.indexOf('_destroyCurrencyHighlights = function'));
    assert(!/drawEllipse|lineStyle/.test(buildBody),
        'жёлтое овальное кольцо убрано по прямому указанию ("не нужна обводка")');
    assert(!/shakeX|shakeY/.test(buildBody),
        'дрожание x/y убрано по прямому указанию, второй заход ("убери дрожание, пусть просто мигают") — остаётся только мигание');
    assert(/\.map\(obj => \(\{ obj, alpha: obj\.alpha \}\)\);/.test(buildBody),
        'исходный alpha запоминается перед анимацией — иначе нечем восстановить после');
    assert(/const blink = 0\.55 \+ 0\.45 \* Math\.sin\(t \* 3\);/.test(buildBody), 'мигание — колебание alpha по синусоиде');
    assert(/original\.forEach\(\(\{ obj \}\) => \{ obj\.alpha = blink; \}\);/.test(buildBody),
        'эффект применяется НАПРЯМУЮ к val_stew\/val_coins\/val_cigarettes — не рисует ничего поверх (никакого отдельного Graphics/Container)');

    const destroyBody = popupSrc.slice(popupSrc.indexOf('_destroyCurrencyHighlights = function'), popupSrc.indexOf('_onContinue = function'));
    assert(/obj\.alpha = alpha;/.test(destroyBody),
        'при разрушении alpha возвращается на исходный — ресурсы не остаются потускневшими навсегда');

    const showPopupBody = popupSrc.slice(popupSrc.indexOf('_showPopup = function'), popupSrc.indexOf('_hidePopup = function'));
    assert(/if\(state === 'currency'\) this\._buildCurrencyHighlights\(\);\s*\n\s*else this\._destroyCurrencyHighlights\(\);/.test(showPopupBody),
        'подсветка строится только для state==="currency", для intro/final гасится');

    const hideBody = popupSrc.slice(popupSrc.indexOf('_hidePopup = function'), popupSrc.indexOf('_buildCurrencyHighlights = function'));
    assert(/this\._destroyCurrencyHighlights\(\);/.test(hideBody), '_hidePopup() тоже гасит подсветку — не переживает закрытие попапа целиком');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
