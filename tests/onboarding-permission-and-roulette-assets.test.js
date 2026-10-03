/* Static regression checks for onboarding permission flow and supplied roulette assets. */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, '_client', 'src', ...rel.split('/')), 'utf8');
const asset = name => path.join(root, '_client', 'development', 'images', name);
let failed = 0;
const test = (name, condition) => {
    if(condition) console.log('✓ ' + name);
    else { failed++; console.error('✗ ' + name); }
};

const data = read('game/onboarding/onboarding-data.js');
const popup = read('game/onboarding/onboarding-popup.js');
const onboarding = read('game/onboarding.js');
const tour = read('game/onboarding/onboarding-tour.js');
const preloader = read('game/preloader.js');
const roulette = read('game/dvor/dvor-roulette-screen.js');
const shop = read('game/shell/overlays/shmot_shop.js');
const dice = read('game/dvor/dvor-dice-screen.js');
const boot = read('game/game-boot.js');
const zone = read('game/shell/overlays/zone_screen.js');
const iface = read('game/interface.js');
const dev = read('game/shell/overlays/dev_panel.js');
const users = fs.readFileSync(path.join(root, 'server/core/controllers/users.php'), 'utf8');
const leaderboard = read('game/svod/svod-leaderboard.js');
const dvor = read('game/dvor.js');
const bossFight = read('game/shell/overlays/bosses_fight.js');

test('В финале обучения есть обе кнопки, а «Слиться» везде имеет заданную посадку',
    popup.includes('const showContinue = true') && popup.includes('const MERGE_X = 391, MERGE_Y = 506') &&
    popup.includes('this._mergeBtn.passive.y = this._mergeBtn.active.y = this._mergeBtn.hit.y = MERGE_Y'));
test('Запрос friends начинается только после собственного окна и явного «Продолжить»',
    // 02.10.2026: событие переименовано pripyat:onboarding-done -> pripyat:friends-permission-request
    // (см. onboarding-popup.js._popupState === 'permission' — отдельный шаг после final), сама
    // VK-команда по-прежнему шлётся не из popup.js, а из preloader.js (единая точка входа
    // _requestFriendsScope(), см. tests/mobile-friends-scope-before-friends-get.test.js).
    preloader.includes("VKWebAppGetAuthToken") && preloader.includes("pripyat:friends-permission-request") &&
    preloader.includes("data-friends-yes") && !popup.includes("bridge.sendPromise('VKWebAppGetAuthToken'"));
test('У рейтинга друзей есть явный путь подключить список друзей',
    // 02.10.2026: VK_token живёт только в памяти вкладки и не отражает факт успешного
    // friends.get — гейт переведён на window._friendsScopeReady (выставляется в _loadFriends()/
    // _continueWithoutFriends() в preloader.js). _showFriendsScopePrompt() вызывается с
    // {reconnect:true} — отдельно от обычного force:true для нового запроса, т.к. тут это тихое
    // восстановление токена для игрока, который согласие уже дал (см. preloader.js, 02.10.2026).
    leaderboard.includes("tabCfg.secondScope === 'friends' && !window._friendsScopeReady") &&
    leaderboard.includes("pre_control._showFriendsScopePrompt({force:true, reconnect:true})") &&
    preloader.includes("pripyat:friends-connected"));
test('Добавлены все четыре новые реплики обучения и таймер бездействия 60 секунд',
    data.includes('подтверждение слиться.mp3') && data.includes('когда чел решился слиться.mp3') &&
    data.includes('разрешение.mp3') && data.includes('когда игрок завтыкал.mp3') && onboarding.includes('}, 60000)'));
test('Реплика бездействия ставится в очередь и не обрывает текущую озвучку',
    onboarding.includes('_queueIdleNarration()') && onboarding.includes('_flushQueuedIdleNarration()') &&
    onboarding.includes('this._pendingIdleNarration = true'));
test('Финальное «Слиться» подтверждается один раз и затем завершает обучение без цикла',
    // 04.10.2026 (репорт — "кнопка слиться не работает" + "обучение запускается по несколько
    // раз"): this._finish() раньше вызывался ТОЛЬКО внутри onComplete-колбэка _playNarration()
    // для permission/intro/currency веток — если озвучка не доигрывала (ошибка загрузки файла,
    // исключение в PIXI.sound.play), finish() не наступал НИКОГДА, и onboarding_step застревал
    // навсегда. Теперь finish() вызывается СРАЗУ по клику, озвучка — fire-and-forget рядом.
    popup.includes("if(!this._mergeArmed){") &&
    (popup.match(/this\._finish\(\);\s*\n\s*this\._playNarration\(ONBOARDING_EXTRA_SOUNDS\.mergeDone\);/g) || []).length === 3 &&
    !popup.includes('mergeDone, () => this._finish()'));
test('Обучение не продвигается при переходе bossSelect в бой',
    // 02.10.2026: вместо сравнения this._activeTourKey === 'bosses' используется выделенный флаг
    // iface._onboardingBossScreenTransition, выставляемый самим bosses_fight.js строго на время
    // технической замены «выбор боссов -> бой» (та же суть, другая реализация) — проверяем и
    // сам хук в tour.js, и то, что флаг действительно гасится после перехода в bosses_fight.js.
    tour.includes("if(id === 'bossSelect' && iface._onboardingBossScreenTransition) return result;") &&
    bossFight.includes('this._onboardingBossScreenTransition = true;') &&
    bossFight.includes('this._onboardingBossScreenTransition = false;'));
test('Подтверждённое «Слиться» скрывает попап сразу и доигрывает реплику фоном',
    popup.includes('this._finish();\n            this._playNarration(ONBOARDING_EXTRA_SOUNDS.mergeDone)'));
test('Окно позывного открывается без фонового попапа обучения и отмена его возвращает',
    popup.includes('this._popupWin.visible = false') && popup.includes('this._popupWin.visible = true') &&
    read('game/shell/popups/nick.js').includes('function(onSaved, onCancelled)'));
test('VK-подтверждение вызывается только через единый pripyat:friends-permission-request путь',
    // 02.10.2026: прежний инвариант не изменился по смыслу (popup.js не зовёт VK Bridge
    // напрямую, есть ровно одна точка диспатча) — изменилось только имя события
    // (pripyat:onboarding-done -> pripyat:friends-permission-request, см. тест выше).
    !popup.includes("bridge.sendPromise('VKWebAppGetAuthToken'") &&
    (popup.match(/dispatchEvent\(new Event\('pripyat:friends-permission-request'\)\)/g) || []).length === 1 &&
    popup.includes("this._finish();\n            if(needsFriendsPermission) window.dispatchEvent(new Event('pripyat:friends-permission-request'));"));
test('Новый фон зариков и все изображения рулетки есть в сборочных ассетах',
    ['задний фон зарики новыйй.png', 'рулетка новая страница.png', 'рулетка описание.png',
     'рулетка описание клик.png', 'опыт и уровни описание.png', 'опыт и уровни описание клик.png']
        .every(name => fs.existsSync(asset(name))));
test('Рулетка использует новый лист, карточки описаний и общий затемнитель',
    roulette.includes("'рулетка новая страница.png'") && roulette.includes('bg.x = 327; bg.y = 77') &&
    roulette.includes('window._makeModalDimmer(close, 0.55)') && roulette.includes("'рулетка описание.png', 32, 99") &&
    roulette.includes("'опыт и уровни описание.png', 967, 153"));
test('Карточки описаний рулетки находятся под листом рулетки',
    roulette.indexOf("addDescriptionButton('рулетка описание.png'") < roulette.indexOf('win.addChild(bg);'));
test('На первом шаге обучения Двора все игровые облака пульсируют и увеличиваются',
    dvor.includes('_setTutorialCloudHighlight(enabled)') && dvor.includes('s.scale.set(1.03 + pulse * 0.07)') &&
    tour.includes("tab.key === 'dvor'") && tour.includes("dvor._setTutorialCloudHighlight(true)"));
test('Отладочные надписи колеса и связки ключей не выводятся игроку',
    !roulette.includes("dbgTxt.text = 'колесо | url:") && !shop.includes("dbgTxt.text = 'связка ключей | url:"));
test('Зарики используют новый фон, который ранне предзагружается',
    dice.includes("'задний фон зарики новыйй.png'") && boot.includes("'задний фон зарики новыйй.png'"));
test('Счётчик перебросов зариков стоит в заданной точке',
    dice.includes('availTxt.x = 807; availTxt.y = 144;'));
test('Аватары рейтинга урона имеют заданный масштаб, а ник окрашен как урон',
    bossFight.includes('const AV_SCALE = 0.324') && bossFight.includes("fill:'#8a7157'"));
// 03.10.2026 (по прямому указанию — "файл рулетка иконка сталкера.png удали с сервера, выводить
// его нигде не нужно"): заглушка-иконка (добавлена 23.09.2026 как placeholder) убрана целиком —
// winnerPhotoSpr теперь стартует пустым (Texture.EMPTY) и невидимым, показывается только когда
// реально резолвится настоящее фото победителя по VK id (см. dvor-roulette.js). Координаты
// центровки текстов подняты по прямому указанию 03.10.2026: jackTxt y:216→203 (-13px),
// winnerNameTxt y:288→278 (-10px), winnerAmtTxt y:332→320 (-12px).
test('Рулетка больше не показывает заглушку-иконку сталкера, панель поинтов/спичек на месте',
    roulette.includes('const winnerPhotoSpr = new PIXI.Sprite(PIXI.Texture.EMPTY);') &&
    roulette.includes('winnerPhotoSpr.visible = false;') &&
    !roulette.includes("рулетка иконка сталкера.png") &&
    roulette.includes('y:203') && roulette.includes('y:278') && roulette.includes('y:320') &&
    roulette.includes('ptsTxt.x = 822; ptsTxt.y = 386') && roulette.includes('spichTxt.x = 775; spichTxt.y = 444'));
// 02.10.2026: -3° и отступ +5px — подтверждённый пользователем напрямую выбор (см. комментарий
// у RESPECT_AMOUNT_ROTATION_DEG в zone_screen.js), не трогать без прямого указания.
test('Рамка уважения: число сдвинуто вправо на 5px и повёрнуто на -3°',
    zone.includes('RESPECT_AMOUNT_ROTATION_DEG = -3') && zone.includes('frameSpr.x + RESPECT_FRAME_W / 2 + 5;'));
test('Dev/редактор защищены одинаковым текущим allow-list на клиенте и сервере',
    iface.includes("['1113977365', '382448269']") && dev.includes("['1113977365', '382448269']") &&
    users.includes("['1113977365', '382448269']"));

if(failed){ process.exitCode = 1; }
