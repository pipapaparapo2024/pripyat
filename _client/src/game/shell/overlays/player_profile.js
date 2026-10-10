/** Профиль ЧУЖОГО игрока — открывается кликом по фото/нику в любой рамке (боссы: "УБИВШИЙ"/
 * рейтинг урона, Зона: рамка уважения, топы Сводки). Визуально — тот же персонаж, что на
 * главном экране (Home.init()), но с надетыми шмотками ЦЕЛЕВОГО игрока вместо своих —
 * read-only, без кнопок покупки/экипировки.
 *
 * 18.09.2026 (по прямому указанию): данные тянутся ТОЛЬКО через серверный эндпоинт
 * users.getProfile (id → nick/exp/respect/shmot/bosses_killed/total_damage, безопасный
 * публичный срез — coins/stew/inventory туда сознательно не входят) — так фича сразу
 * server-authoritative, её не придётся потом переносить на PHP отдельным шагом.
 * Визуальные координаты персонажа/шмоток — статика из home.js/shmot.js (CLOTH_SLOTS,
 * manDx/manDy/manScale), одинаковая для всех игроков, тянуть с сервера её не нужно.
 */
import { applyPatch } from '../../../modules/patch.js';
import { flushPlayerSave } from '../../../modules/player-save.js';

export function attachPlayerProfile(proto){

    proto._openPlayerProfile = function(targetId, fallbackNick){
        const id = parseInt(targetId) || 0;
        if(id <= 0){
            console.error('[interface._openPlayerProfile] некорректный id:', targetId);
            return;
        }
        if(!window.TS){
            console.error('[interface._openPlayerProfile] window.TS недоступен');
            return;
        }
        if(this._profileReqInFlight) return;
        this._profileReqInFlight = true;

        // 22.09.2026 (баг найден по прямому указанию — "зашёл в свой же профиль, а на
        // персонаже надета шмотка, которая реально не надета") — та же гонка, что уже была
        // исправлена для yashik.js (см. player-save.js._SAVE_DELAY_MS=500 комментарий там):
        // shmot.js._onWear() пишет udata['shmot'] сразу, но это лишь СТАВИТ изменение в
        // 500мс-дебаунс (queuePlayerSave), а не шлёт на сервер немедленно. Если игрок снял/
        // надел вещь и в пределах этого окна открыл СВОЙ ЖЕ профиль, users.getProfile читает
        // ещё СТАРУЮ строку shmot из БД — расхождение с тем, что реально видно дома. Флашим
        // сохранение СИНХРОННО перед запросом (для чужого профиля это no-op/быстро — просто
        // гарантирует, что наши собственные несохранённые изменения не потеряются впустую).
        flushPlayerSave('open_player_profile', () => {
            console.log('[interface._openPlayerProfile] → сервер: users.getProfile | id:', id);
            TS.php('users.getProfile', {id: id}, (res) => {
                this._profileReqInFlight = false;
                console.log('[interface._openPlayerProfile] ← ответ сервера:', JSON.stringify(res));
                if(!res || typeof res.exp === 'undefined'){
                    console.error('[interface._openPlayerProfile] некорректный ответ сервера, профиль не открыт:', JSON.stringify(res));
                    if(window.notify) notify.showResult({text:'Не удалось загрузить профиль игрока'}, 0);
                    return;
                }
                this._buildPlayerProfileScreen(res, fallbackNick);
            }, (err) => {
                this._profileReqInFlight = false;
                console.error('[interface._openPlayerProfile] ← ошибка сервера:', JSON.stringify(err));
                if(window.notify) notify.showResult({text:'Не удалось загрузить профиль игрока'}, 0);
            });
        });
    };

    proto._buildPlayerProfileScreen = function(profile, fallbackNick){
        if(this._profileWin && this._profileWin.parent) this._profileWin.parent.removeChild(this._profileWin);

        const win = new PIXI.Container();
        win.interactive = true;

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.001);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        // 10.10.2026 (по прямому указанию — "показывает всех в дефолт базах, должно
        // отображаться в какой он сидит"): раньше тут всегда был дефолтный "кубрик.png",
        // чужой выбор фона игнорировался. Теперь читаем profile.base_bg_active (сервер отдаёт
        // его в users.getProfile, см. users.php) — тот же каталог файлов/подгонки, что
        // Home._bgFiles/_bgAdjust (home.js), продублирован здесь намеренно (разные классы).
        const PROFILE_BG_FILES = ['кубрик.png','шлюз.png','канализация.png','двор_фон.png','мастерская.png','железка.png','станция.png','заправка.png'];
        const PROFILE_BG_ADJUST = {
            'шлюз.png':        { y: 32, scale: 1.000 },
            'канализация.png': { y: 35, scale: 1.000 },
            'двор_фон.png':    { y: 54, scale: 1.000 },
            'мастерская.png':  { y: 74, scale: 1.000 },
            'железка.png':     { y: 56, scale: 1.002 },
            'заправка.png':    { y: 63, scale: 1.004 },
            'станция.png':     { y: 73, scale: 1.000 },
        };
        const bgIdx = Math.max(0, Math.min(PROFILE_BG_FILES.length - 1, parseInt(profile.base_bg_active || 0) || 0));
        const bgFile = PROFILE_BG_FILES[bgIdx];
        const bgAdj = PROFILE_BG_ADJUST[bgFile] || { y: 0, scale: 1 };
        const bg = new PIXI.Sprite(PIXI.Texture.from('./images/' + bgFile));
        bg.width = 1280 * bgAdj.scale; bg.height = 604 * bgAdj.scale; bg.y = bgAdj.y;
        win.addChild(bg);

        // Персонаж — те же координаты, что Home.init() (506,204).
        // 24.09.2026 (по прямому указанию — "в пропущенных местах тоже замени на новый файл"):
        // та же замена, что и в home.js — pers.png -> "персонаж который сидит.png".
        const persSpr = new PIXI.Sprite(PIXI.Texture.from('./images/персонаж который сидит.png'));
        persSpr.anchor.set(0, 0);
        persSpr.x = 506; persSpr.y = 204;
        persSpr.width = 273; persSpr.height = 389;
        win.addChild(persSpr);

        // Шмотки — те же слоты/сдвиги, что Home.init() CLOTH_SLOTS (HOME_DX=-224, HOME_DY=-4),
        // но флаги owned/equipped берём из ЧУЖОГО profile.shmot, а не window.shmot.items —
        // визуальные метаданные (imgFile/manDx/manDy/manScale/cat) статичны и одинаковы у всех
        // игроков, поэтому продолжаем читать их из локального каталога window.shmot.items.
        // 24.09.2026 (по прямому указанию — "голова выше торса по Z-индексу"): та же
        // перестановка, что и в home.js CLOTH_SLOTS.
        const HOME_DX = -224, HOME_DY = -4;
        const CLOTH_SLOTS = [
            { cat: 3, x: 864 + HOME_DX, y: 591 + HOME_DY, centerX: true },  // Обувь
            { cat: 2, x: 893 + HOME_DX, y: 358 + HOME_DY, centerX: true },  // Штаны
            { cat: 1, x: 804 + HOME_DX, y: 258 + HOME_DY },                 // Торс
            { cat: 0, x: 871 + HOME_DX, y: 195 + HOME_DY, centerX: true },  // Голова — выше Торса
            { cat: 4, x: 882 + HOME_DX, y: 414 + HOME_DY },                 // Аксессуар
            { cat: 6, x: 856 + HOME_DX, y: 418 + HOME_DY },                 // Рука
        ];

        const theirShmot = Array.isArray(profile.shmot) ? profile.shmot : [];
        const catalog = (window.shmot && Array.isArray(shmot.items)) ? shmot.items : [];

        // 19.09.2026 (баг найден: "шмотки другого игрока не отображаются") — theirShmot
        // индексируется по item.id (см. фикс shmot.js._saveToUdata/_loadFromUdata того же
        // дня — сервер тоже пишет owned/equipped по id-как-индексу массива), а НЕ по порядку
        // в this.items: начиная с id 24 порядковая позиция в catalog расходится с id (татуировки
        // id 20-23 физически лежат в this.items ПОСЛЕ id 24-34). catalog[i] здесь брал предмет
        // с ПОРЯДКОВЫМ номером i, а не с id===i — для чужого игрока, у которого надет любой
        // предмет с id>=20, подставлялся СОВСЕМ ДРУГОЙ предмет (или undefined → ничего не рисовалось).
        let handItemSpr = null, handItemDef = null;
        CLOTH_SLOTS.forEach(s => {
            const equippedIdx = theirShmot.findIndex((slot, i) => {
                if(!slot || !slot.equipped) return false;
                const def = catalog.find(it => it.id === i);
                return def && def.cat === s.cat;
            });
            const spr = new PIXI.Sprite(PIXI.Texture.EMPTY);
            spr.anchor.set(s.centerX ? 0.5 : 0, s.cat === 3 ? 1 : 0);
            spr.x = s.x; spr.y = s.y;
            let def = null;
            if(equippedIdx !== -1){
                def = catalog.find(it => it.id === equippedIdx);
                if(def && def.imgFile){
                    spr.texture = PIXI.Texture.from('./images/shmot/' + def.imgFile);
                    spr.x = s.x + (def.manDx || 0);
                    spr.y = s.y + (def.manDy || 0) + (def.imgFile === 'штаны_1.png' ? -28 : 0);
                    spr.scale.set(def.manScale || 1);
                }
            }
            win.addChild(spr);
            if(s.cat === 6 && def){ handItemSpr = spr; handItemDef = def; }
        });

        // Левое предплечье (24.09.2026, уточнено пользователем через редактор позиций на
        // home.js — x:515 y:327 scale:0.197 при persSpr там в 506,204) — ПОСЛЕ цикла
        // CLOTH_SLOTS выше (значит, выше по z-индексу Торса/Головы), persSpr здесь тоже
        // в 506,204, поэтому те же абсолютные координаты.
        const leftForearmSpr = new PIXI.Sprite(PIXI.Texture.from('./images/левое предплечье.png'));
        leftForearmSpr.anchor.set(0, 0);
        leftForearmSpr.x = 514; leftForearmSpr.y = 324;
        leftForearmSpr.scale.set(0.197);
        win.addChild(leftForearmSpr);

        // Кисти рук + фаланги — те же спрайты/координаты, что home.js рисует для СВОЕГО
        // персонажа (та же поза, тот же offset (506,204)) — баг найден 19.09.2026: профиль
        // ЧУЖОГО игрока их не рисовал вообще, руки "пропадали" при переходе на другой профиль.
        const phalanxSpr = new PIXI.Sprite(PIXI.Texture.from('./images/фаланги правой руки.png'));
        phalanxSpr.x = 634; phalanxSpr.y = 441;
        win.addChild(phalanxSpr);

        const rightHandSpr = new PIXI.Sprite(PIXI.Texture.from('./images/правая рука.png'));
        rightHandSpr.x = 630; rightHandSpr.y = 369;
        win.addChild(rightHandSpr);

        const leftHandSpr = new PIXI.Sprite(PIXI.Texture.from('./images/левая рука.png'));
        leftHandSpr.x = 534; leftHandSpr.y = 385;
        win.addChild(leftHandSpr);

        // Обычный предмет: левая кисть → предмет → правая кисть; часы Poker и
        // цепь Teenager носятся поверх правой кисти.
        if(handItemSpr){
            const weaponIdx = win.getChildIndex(leftHandSpr) + 1;
            win.addChildAt(handItemSpr, Math.min(weaponIdx, win.children.length));
            if(handItemDef && (handItemDef.id === 62 || handItemDef.id === 92)) win.addChild(handItemSpr);
            else win.addChildAt(rightHandSpr, win.getChildIndex(handItemSpr) + 1);
        }

        // Заголовок — ник + уровень (та же формула, что Interface.updateNick()/svod-leaderboard.js,
        // экономику по ней не считаем, только отображение — уровень нигде не персистится здесь).
        const level = Math.max(0, Math.floor((-1 + Math.sqrt(1 + (profile.exp || 0) / 5)) / 2));
        const nick = String(profile.nick || '').trim() || String(fallbackNick || '').trim() || ('Игрок ' + profile.id);
        profile.displayNick = nick;

        const nameTxt = new PIXI.Text(nick, {
            fontFamily: 'Southbank LT', fontSize: 26, fill: '#ffcc44', fontWeight: 'bold',
            dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1
        });
        nameTxt.x = 40; nameTxt.y = 30;
        // 22.09.2026 (по прямому указанию — "все тексты при переходе на игрока поверни
        // против часовой стрелки на +1°") — тот же приём "слегка небрежно положенного
        // полароида", что уже применён к самой визитке (см. CARD_ROTATION_DEG ниже).
        nameTxt.rotation = TEXT_ROTATION_DEG * Math.PI / 180;
        win.addChild(nameTxt);
        profile._setDisplayNick = (resolvedNick) => {
            if(String(profile.nick || '').trim() || !String(resolvedNick || '').trim()) return;
            profile.displayNick = String(resolvedNick).trim();
            nameTxt.text = profile.displayNick;
        };

        // 21.09.2026 (по прямому указанию — "убери надпись сзади, где написано уровень
        // авторитета боссов") — этот текст дублировал то, что визитка (_buildVisitCard ниже)
        // и так уже показывает своими собственными полями (УРОВЕНЬ/ДОСТИЖЕНИЯ), но рисовался
        // ПОД визиткой на непарной подложке — почти нечитаем и не нужен отдельно. Убран целиком.

        this._buildVisitCard(win, profile, level);
        this._buildHabarBadge(win, profile);
        // 22.09.2026 (баг найден по прямому указанию — "зашёл в свой же профиль, кнопки
        // Зарубиться/Позвать в качалку/Просьба заначек показываются") — эти три действия не
        // имеют смысла на самом себе (сервер и так отклонит зарубу/качалку кодом 90, см.
        // zaruba.php), кнопки просто visually лишние и вводят в заблуждение. Сравниваем с
        // udata['id'] — то же поле, что использует server-side проверка "сам на себя"
        // (registry['uid'], см. zaruba.php) и client-side game/top.js (isMe).
        const isOwnProfile = parseInt(udata['id']) === parseInt(profile.id);
        if(!isOwnProfile) this._buildFriendActionButtons(win, profile);

        // Крестик выхода — стандартная позиция.
        const exitBtn = new PIXI.Sprite(PIXI.Texture.from('./images/выход.png'));
        exitBtn.scale.set(0.5);
        if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
        exitBtn.x = 1240; exitBtn.y = 83;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', ()=>{ _sa(exitBtn, 0.75); exitBtn.scale.set(0.54); });
        exitBtn.on('pointerout',  ()=>{ _sa(exitBtn, 1); exitBtn.scale.set(0.5); });
        exitBtn.on('pointerdown', ()=>this._closePlayerProfile());
        win.addChild(exitBtn);

        this._profileWin = win;
        root.layer2_mc.addChild(win);
        // 25.09.2026 (баг найден по прямому указанию + скриншот — "нижний ХУД не виден при
        // переходе к профилю игрока, например через топ урона в бою с боссом"): раньше здесь
        // был iface.restoreHud() — эта функция просто ПЕРЕПРИМЕНЯЕТ верхушку уже существующего
        // _hudStack, а не заявляет собственное требование. Профиль игрока никогда не участвовал
        // в декларативном ХУД-стеке (pushHud/popHud, см. interface.js) — если открыт поверх
        // экрана, который сам скрывает нижний ХУД (например bosses_fight.js: pushHud('bossFight',
        // {down:false})), restoreHud() честно применял ЕГО требование, унаследованное от экрана
        // под попапом. Профиль — отдельный полноэкранный оверлей, ему всегда нужны оба ХУДа
        // (см. _closePlayerProfile — попап при закрытии). pushHud идемпотентен по id, поэтому
        // повторная постройка экрана (тот же id) не плодит дублей в стеке.
        if(window.iface) iface.pushHud('playerProfile', {});
    };

    // Визитка игрока (19.09.2026, по прямому указанию) — карточка "визитка у игрока.png"
    // (нативный размер 421×570, вставлена БЕЗ растяжения) на позиции, снятой пользователем
    // через редактор позиций. Координаты полей внутри карточки — не давались пользователем
    // напрямую, вычислены анализом пикселей самого файла (разделительные линии строк/колонок),
    // пользователь может донастроить их позже через редактор позиций при необходимости.
    // 21.09.2026 (по прямому указанию): весь блок (картинка + все поля) поднят на 30px
    // (CARD_Y 77→47) и повёрнут против часовой стрелки на 2° (тот же приём "случайно
    // положенного полароида", что и RESPECT_PHOTO_ROTATION_DEG в zone_screen.js) — оба
    // применяются на общем контейнере card, все дочерние элементы двигаются/поворачиваются
    // вместе с ним автоматически. Весь текст на визитке — белый (было золото/серый).
    const CARD_X = 6, CARD_Y = 77 - 30;
    const CARD_ROTATION_DEG = -2;
    // 22.09.2026 (по прямому указанию — "все тексты при переходе на игрока поверни против
    // часовой стрелки на +1°") — доп. индивидуальный поворот КАЖДОГО текстового объекта поверх
    // родительского поворота card (CARD_ROTATION_DEG), тот же "полароидный" приём, применённый
    // на уровень глубже. "Против часовой" в системе координат этого проекта — отрицательный
    // градус (см. CARD_ROTATION_DEG=-2 и комментарий там же).
    const TEXT_ROTATION_DEG = -1;
    const CARD_VALUE_STYLE = {
        fontFamily: 'Southbank LT', fontSize: 22, fill: '#ffffff', fontWeight: 'bold',
        dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1
    };

    proto._buildVisitCard = function(win, profile, level){
        const card = new PIXI.Container();
        card.x = CARD_X; card.y = CARD_Y;
        card.rotation = CARD_ROTATION_DEG * Math.PI / 180;

        const bg = new PIXI.Sprite(PIXI.Texture.from('./images/визитка у игрока.png'));
        card.addChild(bg);

        // Аватарка (квадратик слева, 19.09.2026 по прямому указанию) — фото ЦЕЛЕВОГО игрока
        // через тот же bosses._resolveVkUsers(), что уже используют топы/рейтинги для аватарок
        // (VK не отдаёт photo_50 для чужих id напрямую, только батчем через users.get).
        // 22.09.2026: позиция/размер уточнены через редактор позиций (было 38,98,86).
        const AVATAR_X = 51, AVATAR_Y = 113, AVATAR_SIZE = 69;
        const avatarMask = new PIXI.Graphics();
        avatarMask.beginFill(0xffffff); avatarMask.drawRect(0, 0, AVATAR_SIZE, AVATAR_SIZE); avatarMask.endFill();
        avatarMask.x = AVATAR_X; avatarMask.y = AVATAR_Y;
        const avatarSpr = new PIXI.Sprite(PIXI.Texture.EMPTY);
        avatarSpr.x = AVATAR_X; avatarSpr.y = AVATAR_Y;
        avatarSpr.width = AVATAR_SIZE; avatarSpr.height = AVATAR_SIZE;
        avatarSpr.mask = avatarMask;
        avatarSpr.interactive = true; avatarSpr.buttonMode = true;
        avatarSpr.on('pointerdown', () => {
            window.open('https://vk.com/id' + encodeURIComponent(String(profile.id)), '_blank', 'noopener,noreferrer');
        });
        card.addChild(avatarSpr);
        card.addChild(avatarMask);
        let nickTxt = null;
        if(window.bosses && typeof bosses._resolveVkUsers === 'function'){
            bosses._resolveVkUsers([profile.id], (users) => {
                const u = users[String(profile.id)];
                if(u && u.photo) avatarSpr.texture = PIXI.Texture.from(u.photo);
                if(u && u.name && !String(profile.nick || '').trim()){
                    if(typeof profile._setDisplayNick === 'function') profile._setDisplayNick(u.name);
                    if(nickTxt) nickTxt.text = profile.displayNick || u.name;
                }
            });
        }

        // Никнейм + ID — справа от аватарки, в пустом месте карточки (не занято печатным
        // текстом PNG), по прямому указанию 19.09.2026.
        nickTxt = new PIXI.Text(profile.displayNick || ('Игрок ' + profile.id), {
            fontFamily: 'Southbank LT', fontSize: 22, fill: '#ffffff', fontWeight: 'bold',
            wordWrap: true, wordWrapWidth: 250,
            dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1
        });
        nickTxt.x = 145; nickTxt.y = 110;
        nickTxt.rotation = TEXT_ROTATION_DEG * Math.PI / 180;
        card.addChild(nickTxt);

        // 22.09.2026 (по прямому указанию — "текст id игрока подними вверх на 12px"): 155→143.
        const idTxt = new PIXI.Text('ID ' + profile.id, {
            fontFamily: 'Southbank LT', fontSize: 16, fill: '#ffffff',
            dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1
        });
        idTxt.x = 145; idTxt.y = 143;
        idTxt.rotation = TEXT_ROTATION_DEG * Math.PI / 180;
        card.addChild(idTxt);

        // УРОВЕНЬ / ДОСТИЖЕНИЯ — под подписями, напечатанными прямо в PNG.
        // 22.09.2026 (по прямому указанию): "число уровня" вверх на 6px (228→222), "кол-во
        // достижений" вверх на 12px (228→216).
        const levelTxt = new PIXI.Text(String(level), CARD_VALUE_STYLE);
        levelTxt.anchor.set(0.5, 0);
        levelTxt.x = 90; levelTxt.y = 222;
        levelTxt.rotation = TEXT_ROTATION_DEG * Math.PI / 180;
        card.addChild(levelTxt);

        const achTxt = new PIXI.Text(String(profile.achievement_stars || 0), CARD_VALUE_STYLE);
        achTxt.anchor.set(0.5, 0);
        achTxt.x = 232; achTxt.y = 216;
        achTxt.rotation = TEXT_ROTATION_DEG * Math.PI / 180;
        card.addChild(achTxt);

        // СИЛА — накопленный опыт качалки (profile.strength = str_xp_total), НЕ уровень 1-50
        // (см. пояснение в users.php.getProfile) — растёт без ограничения, дефолт 0.
        // 24.09.2026 (по прямому указанию, редактор позиций — "Выбрано: Текст '0' x:117 y:301
        // scale:1.000 rot:-3°"): позиция и поворот уточнены (было 144.5/342.5, -2°).
        const strTxt = new PIXI.Text(String(profile.strength || 0), CARD_VALUE_STYLE);
        strTxt.anchor.set(0.5, 0.5);
        strTxt.x = 117; strTxt.y = 301;
        strTxt.rotation = -3 * Math.PI / 180;
        card.addChild(strTxt);
        // 22.09.2026: ссылка для мгновенного обновления после успешного "качнуть" (см.
        // _startGymPump) — без неё пришлось бы заново открывать профиль, чтобы увидеть +1.
        this._profileStrTxt = strTxt;

        // БАНДА / СКИЛЛОВ / РЕЙТИНГ / В ЗОНЕ С — 22.09.2026 (повторный снимок редактора позиций
        // тем же днём, по прямому указанию — было общее ROW_DX/ROW_DY=26/-2 от базовых 160/332,
        // 362, 392, 422 — теперь у каждой строки своя, отдельно снятая координата).

        // БАНДА — статический каталог названий групп берём из window.gangs.gangs (одинаковый
        // у всех игроков), прочерк если gang_id пуст (игрок не состоит ни в одной группировке).
        let gangName = '-';
        const gangId = parseInt(profile.gang_id);
        if(!isNaN(gangId) && profile.gang_id !== '' && window.gangs && Array.isArray(gangs.gangs)){
            const g = gangs.gangs.find(x => x.id === gangId);
            if(g) gangName = g.name;
        }
        const gangTxt = new PIXI.Text(gangName, CARD_VALUE_STYLE);
        gangTxt.anchor.set(0, 0.5);
        gangTxt.x = 186; gangTxt.y = 334;
        gangTxt.rotation = TEXT_ROTATION_DEG * Math.PI / 180;
        card.addChild(gangTxt);

        // СКИЛЛОВ — сумма уровней всех скиллов / максимум (skills_config.total_points).
        const skillsStr = profile.skills_max ? (profile.skills_total || 0) + '/' + profile.skills_max : '-';
        const skillsTxt = new PIXI.Text(skillsStr, CARD_VALUE_STYLE);
        skillsTxt.anchor.set(0, 0.5);
        skillsTxt.x = 209; skillsTxt.y = 364;
        skillsTxt.rotation = TEXT_ROTATION_DEG * Math.PI / 180;
        card.addChild(skillsTxt);

        // РЕЙТИНГ — 29.09.2026: было место в топе по УРОНУ, теперь место по УРОВНЮ/ОПЫТУ (см.
        // users.php.getProfile() — rating_place теперь считается по exp, не по total_damage).
        const ratingStr = profile.rating_place ? ('#' + profile.rating_place) : '-';
        const ratingTxt = new PIXI.Text(ratingStr, CARD_VALUE_STYLE);
        ratingTxt.anchor.set(0, 0.5);
        ratingTxt.x = 222; ratingTxt.y = 392;
        ratingTxt.rotation = TEXT_ROTATION_DEG * Math.PI / 180;
        card.addChild(ratingTxt);

        // В ЗОНЕ С — точная дата регистрации (create_time, dd.mm.yyyy).
        let sinceStr = '-';
        if(profile.create_time){
            const d = new Date(profile.create_time * 1000);
            const pad = n => String(n).padStart(2, '0');
            sinceStr = pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear();
        }
        const sinceTxt = new PIXI.Text(sinceStr, CARD_VALUE_STYLE);
        sinceTxt.anchor.set(0, 0.5);
        sinceTxt.x = 194; sinceTxt.y = 421;
        sinceTxt.rotation = TEXT_ROTATION_DEG * Math.PI / 180;
        card.addChild(sinceTxt);

        win.addChild(card);
    };

    // Значок хабара (19.09.2026, по прямому указанию) — habar_bought хранит 1-4 (0 = хабар не
    // куплен, см. habar.js._buyAndOpen: udata['habar_bought']=String(idx+1)), индекс совпадает
    // с порядком контейнеров habar.js.this.containers (0 Обычный..3 Элитный). Показываем ровно
    // ОДИН значок — тот, что соответствует купленному игроком тиру (второй тир не существует
    // одновременно, см. habar.js). Названия — те же строки, что и в habar.js (id0-3 name).
    const HABAR_BADGE_FILES = ['обычный хабар.png', 'пацанский хабар.png', 'авторитетный хабар.png', 'элитный хабар.png'];
    const HABAR_TIER_NAMES  = ['Обычный', 'Пацанский', 'Авторитетный', 'Элитный'];

    proto._buildHabarBadge = function(win, profile){
        const idx = intval(profile.habar_bought) - 1;
        if(idx < 0 || idx >= HABAR_BADGE_FILES.length) return;
        // 22.09.2026 (по прямому указанию, позиция снята через редактор позиций — было 181,323):
        // значок сдвинут на 197,313 и слегка повёрнут (-1°, тот же приём, что у остальных
        // текстов визитки).
        const badge = new PIXI.Sprite(PIXI.Texture.from('./images/' + HABAR_BADGE_FILES[idx]));
        badge.x = 197; badge.y = 313;
        badge.rotation = TEXT_ROTATION_DEG * Math.PI / 180;
        win.addChild(badge);

        // 22.09.2026 (баг/неясность найдена по прямому указанию — "справа от значка должно
        // быть название хабара, а не голое число"): раньше рядом со значком не было НИКАКОГО
        // текста — визуально он просто оказывался близко к полю "СИЛА" (strTxt, см.
        // _buildVisitCard), из-за чего казалось, что то самое число "0" относится к хабару.
        // Это разные поля: "СИЛА" — отдельная живая метрика качалки (_profileStrTxt), трогать
        // её нельзя. Добавлена ОТДЕЛЬНАЯ подпись с названием текущего тира хабара.
        // 22.09.2026 (по прямому указанию, редактор позиций): было badge.x+36/badge.y+16
        // (233,329) с общим TEXT_ROTATION_DEG(-1°) — теперь абсолютная координата (252,329) и
        // свой поворот -2°.
        const nameTxt = new PIXI.Text(HABAR_TIER_NAMES[idx], {
            fontFamily: 'Southbank LT', fontSize: 16, fill: '#ffffff', fontWeight: 'bold',
            dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1
        });
        nameTxt.anchor.set(0, 0.5);
        nameTxt.x = 252; nameTxt.y = 329;
        nameTxt.rotation = -2 * Math.PI / 180;
        win.addChild(nameTxt);
    };

    // Кнопки действий у друга (19.09.2026, по прямому указанию) — "зарубиться" полностью
    // реализована (см. _startZaruba ниже). 22.09.2026 (по прямому указанию): "позвать в
    // качалку" тоже реализована — единственный способ прокачать "Силу" другого игрока (+1),
    // см. _startGymPump ниже и zaruba.php.pump(). "Просьба заначек" — по-прежнему только
    // позиционирование, функциональность не запрашивалась (ПРАВИЛО №9).
    proto._buildFriendActionButtons = function(win, profile){
        const bg = new PIXI.Sprite(PIXI.Texture.from('./images/фон для кнопок у друга.png'));
        bg.x = 997; bg.y = 45;
        win.addChild(bg);

        const buttons = [
            { file: 'кнопка у друга позвать в качалку.png', x: 1039, y: 176, action: 'gym_invite' },
            { file: 'кнопка у друга зарубиться .png',       x: 1040, y: 357, action: 'fight_challenge' },
        ];
        buttons.forEach(b => {
            const btn = new PIXI.Sprite(PIXI.Texture.from('./images/' + b.file));
            btn.x = b.x; btn.y = b.y;
            btn.interactive = true; btn.buttonMode = true;
            btn.on('pointerover', ()=>{ _sa(btn, 0.8); btn.scale.set(1.08); });
            btn.on('pointerout',  ()=>{ _sa(btn, 1); btn.scale.set(1); });
            btn.on('pointerdown', ()=>{
                if(b.action === 'fight_challenge'){ this._startZaruba(win, profile); return; }
                if(b.action === 'gym_invite'){ this._startGymPump(profile); return; }
            });
            win.addChild(btn);
        });
    };

    // ── «КАЧНУТЬ» (22.09.2026, по прямому указанию) — +1 к "Силе" (str_xp_total) ЦЕЛИ, сервер
    // сам проверяет кулдаун 24ч на пару (визитёр, цель) — см. zaruba.php.pump().
    // 28.09.2026 (по прямому указанию — РЕВЕРС правки от 25.09.2026): своя сила визитёра
    // больше не растёт от качания чужой — только у target'а.
    // 04.10.2026: res.patch теперь содержит gym_pump_cooldowns (свой кулдаун) И
    // gym_invites_sent (счётчик для достижений категории 'gym', см. zaruba.php.pump()).
    proto._startGymPump = function(profile){
        if(this._gymPumpReqInFlight) return;
        this._gymPumpReqInFlight = true;
        console.log('[player_profile._startGymPump] → сервер: zaruba.pump | target_id:', profile.id);
        TS.php('zaruba.pump', {target_id: profile.id}, (res) => {
            this._gymPumpReqInFlight = false;
            console.log('[player_profile._startGymPump] ← ответ сервера:', JSON.stringify(res));
            if(!res || typeof res.target_strength === 'undefined'){
                console.error('[player_profile._startGymPump] некорректный ответ сервера:', JSON.stringify(res));
                if(window.notify) notify.showResult({text:'Не удалось прокачать игрока'}, 0);
                return;
            }
            if(res.patch) applyPatch(res.patch);
            if(this._profileStrTxt) this._profileStrTxt.text = String(res.target_strength);
            // 04.10.2026 (по прямому указанию — достижения категории 'gym' подключены к
            // "позвать в качалку"): patch уже содержит свежий gym_invites_sent (см.
            // zaruba.php.pump()) — сразу проверяем пороги.
            if(window.achievements) achievements._checkAll();
            this._showGymPumpBanner();
        }, (err) => {
            this._gymPumpReqInFlight = false;
            console.error('[player_profile._startGymPump] ← ошибка сервера:', JSON.stringify(err));
            // Код 92 — кулдаун 24ч на эту пару (переиспользован от старого кулдауна Зарубы,
            // теперь свободен, см. zaruba.php), 91 — цель не найдена, 90 — сам на себя.
            if(err && err.code === 92){ if(window.notify) notify.showResult({text:'Этого игрока можно качать раз в 24 часа'}, 0); }
            else if(window.notify) notify.showResult({text:'Не удалось прокачать игрока'}, 0);
        });
    };

    // Баннер "ТЫ КАЧНУЛ СИЛУ / УВАЖЕНИЕ СТАЛКЕР!" (22.09.2026, по прямому указанию) — картинка
    // добавлена пользователем (C:\Users\HONOR\Desktop\vk_game\качнул силу.png, 1280×524),
    // позиция снята через редактор позиций: X=0, Y=71. Тот же таймлайн проявления/удержания/
    // затухания, что уже используется для попапа достижений (achievement.js) — не закрывается
    // тапом, гаснет сам.
    proto._showGymPumpBanner = function(){
        if(this._gymPumpBannerWin && this._gymPumpBannerWin.parent){
            this._gymPumpBannerWin.parent.removeChild(this._gymPumpBannerWin);
        }
        const banner = new PIXI.Sprite(PIXI.Texture.from('./images/качнул силу.png'));
        banner.x = 0; banner.y = 71;
        banner.alpha = 0;
        root.layer2_mc.addChild(banner);
        this._gymPumpBannerWin = banner;

        const _remove = () => {
            if(banner.parent) banner.parent.removeChild(banner);
            if(this._gymPumpBannerWin === banner) this._gymPumpBannerWin = null;
        };
        if(window.gsap){
            gsap.killTweensOf(banner);
            gsap.timeline()
                .to(banner, {alpha:1, duration:0.15})
                .to(banner, {alpha:1, duration:1.5})
                .to(banner, {alpha:0, duration:0.25, onComplete:_remove});
        } else {
            banner.alpha = 1;
            setTimeout(_remove, 1900);
        }
    };

    // ── ЗАРУБА (19.09.2026, по прямому указанию) — PvP-дуэль с игроком, чей профиль открыт.
    // Победитель определяется сервером сравнением накопленной "Силы" (str_xp_total, см.
    // users.php.getProfile) — сервер же и списывает кулдаун/начисляет награду
    // (server/core/controllers/zaruba.php), клиент только отправляет target_id и рисует итог.
    proto._startZaruba = function(win, profile){
        if(this._zarubaReqInFlight) return;
        this._zarubaReqInFlight = true;
        console.log('[player_profile._startZaruba] → сервер: zaruba.fight | target_id:', profile.id);
        TS.php('zaruba.fight', {target_id: profile.id}, (res) => {
            this._zarubaReqInFlight = false;
            console.log('[player_profile._startZaruba] ← ответ сервера:', JSON.stringify(res));
            if(!res || typeof res.won === 'undefined'){
                console.error('[player_profile._startZaruba] некорректный ответ сервера:', JSON.stringify(res));
                if(window.notify) notify.showResult({text:'Не удалось начать зарубу'}, 0);
                return;
            }
            applyPatch(res.patch);
            if(window.iface) iface.updateUp();
            // 04.10.2026 (по прямому указанию — достижения категории 'pvp' подключены к
            // Зарубе): patch уже содержит свежий pvp_wins при победе (см. zaruba.php.fight()) —
            // сразу проверяем пороги, не дожидаясь другого несвязанного триггера.
            if(window.achievements) achievements._checkAll();
            if(!String(res.target_nick || '').trim()) res.target_nick = profile.displayNick || profile.nick || ('Игрок ' + profile.id);
            this._buildZarubaResultScreen(win, res);
        }, (err) => {
            this._zarubaReqInFlight = false;
            console.error('[player_profile._startZaruba] ← ошибка сервера:', JSON.stringify(err));
            // 25.09.2026 (по прямому указанию — "на одного игрока можно нападать без
            // ограничений по количеству раз"): дневной лимит (код 93) убран на сервере
            // целиком — zaruba.fight() больше никогда не вернёт этот код, отдельная ветка под
            // него не нужна. Остаются 91 (цель не найдена) и 90 (сам на себя) — общее сообщение.
            if(window.notify) notify.showResult({text:'Не удалось начать зарубу'}, 0);
        });
    };

    // 25.09.2026 (по прямому указанию, редактор позиций — "силу проигравшего и победителя
    // подними вверх на 18 пикселей"): silaLabelY/valueY у обеих карточек сдвинуты на -18
    // (было 240/280 у победителя, 238/278 у проигравшего).
    const ZARUBA_CARD_LAYOUT = {
        won:  { file: 'заруба победитель.png',  boxCenterX: 323, nickY: 100, deltaY: 150, silaLabelY: 222, valueY: 262 },
        lost: { file: 'заруба проигравший.png', boxCenterX: 319, nickY: 97,  deltaY: 147, silaLabelY: 220, valueY: 260 },
    };

    proto._buildZarubaResultScreen = function(parentWin, res){
        if(this._zarubaWin && this._zarubaWin.parent) this._zarubaWin.parent.removeChild(this._zarubaWin);

        const zwin = new PIXI.Container();
        zwin.interactive = true;

        const bg = new PIXI.Sprite(PIXI.Texture.from('./images/заруба задний фон.png'));
        bg.x = -8; bg.y = 72;
        zwin.addChild(bg);

        const myNick = String(udata['nick'] || '').trim()
            || [window.vk_user_info && vk_user_info.first_name, window.vk_user_info && vk_user_info.last_name].filter(Boolean).join(' ')
            || udata['nickname'] || 'Ты';

        // Левая карточка — всегда ты (атакующий), правая — игрок, к которому пришёл в гости.
        this._buildZarubaCard(zwin, 107, 132, res.won,  myNick,             res.my_strength);
        this._buildZarubaCard(zwin, 780, 133, !res.won, res.target_nick,    res.target_strength);

        // 25.09.2026 (по прямому указанию — "убери файл панель награды, он не нужен, и также
        // не выдавай награду за победу"): zaruba.php.fight() больше не начисляет ничего и не
        // возвращает reward — панель "заруба панель награды.png" и цифры сигарет/опыта под
        // ней убраны целиком, экран результата теперь показывает только исход (карточки
        // победителя/проигравшего), без блока награды.
        const closeBtn = new PIXI.Sprite(PIXI.Texture.from('./images/заруба кнопка закрыть.png'));
        closeBtn.x = 483; closeBtn.y = 521;
        closeBtn.interactive = true; closeBtn.buttonMode = true;
        closeBtn.on('pointerover', ()=>{ _sa(closeBtn, 0.8); closeBtn.scale.set(1.08); });
        closeBtn.on('pointerout',  ()=>{ _sa(closeBtn, 1); closeBtn.scale.set(1); });
        closeBtn.on('pointerdown', ()=>{
            if(this._zarubaWin && this._zarubaWin.parent) this._zarubaWin.parent.removeChild(this._zarubaWin);
            this._zarubaWin = null;
        });
        zwin.addChild(closeBtn);

        this._zarubaWin = zwin;
        parentWin.addChild(zwin);
        if(window.iface){
            if(iface.up)   parentWin.addChild(iface.up);
            if(iface.down) parentWin.addChild(iface.down);
        }
    };

    // Одна карточка результата (победитель/проигравший) — общий рендер для левого (ты) и
    // правого (соперник) слота, различаются только позицией и тем, какой шаблон применён.
    proto._buildZarubaCard = function(zwin, x, y, isWinner, nick, strength){
        const cardCfg = isWinner ? ZARUBA_CARD_LAYOUT.won : ZARUBA_CARD_LAYOUT.lost;
        const card = new PIXI.Container();
        card.x = x; card.y = y;

        const spr = new PIXI.Sprite(PIXI.Texture.from('./images/' + cardCfg.file));
        card.addChild(spr);

        const nickTxt = new PIXI.Text(nick, {
            fontFamily: 'Southbank LT', fontSize: 20, fill: '#f3f0ee', fontWeight: 'bold',
            align: 'center', wordWrap: true, wordWrapWidth: 140,
            dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1
        });
        nickTxt.anchor.set(0.5, 0);
        nickTxt.x = cardCfg.boxCenterX; nickTxt.y = cardCfg.nickY;
        card.addChild(nickTxt);

        // 22.09.2026 (по прямому указанию): "Сила" больше не меняется от побед/поражений в
        // Зарубе (растёт только от клика "качнуть" другого игрока, см. users.gymPump) — надпись
        // "+1 К СИЛЕ"/"-1 СИЛЫ" убрана целиком, чтобы не вводить в заблуждение задвоенным
        // (и теперь неверным) сообщением об изменении силы.

        const silaLabel = new PIXI.Text('СИЛА', {
            fontFamily: 'Southbank LT', fontSize: 18, fill: '#a89a88',
            dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1
        });
        silaLabel.anchor.set(0.5, 0);
        silaLabel.x = cardCfg.boxCenterX; silaLabel.y = cardCfg.silaLabelY;
        card.addChild(silaLabel);

        const silaValue = new PIXI.Text(String(strength || 0), {
            fontFamily: 'Southbank LT', fontSize: 40, fontWeight: 'bold',
            fill: isWinner ? '#4ecb4e' : '#cb4e4e',
            dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 2
        });
        silaValue.anchor.set(0.5, 0);
        silaValue.x = cardCfg.boxCenterX; silaValue.y = cardCfg.valueY;
        card.addChild(silaValue);

        zwin.addChild(card);
    };

    function intval(v){ const n = parseInt(v); return isNaN(n) ? 0 : n; }

    proto._closePlayerProfile = function(){
        if(this._profileWin && this._profileWin.parent) this._profileWin.parent.removeChild(this._profileWin);
        this._profileWin = null;
        if(window.iface) iface.popHud('playerProfile');
    };
}
