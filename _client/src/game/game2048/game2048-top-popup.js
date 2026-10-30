// 26.10.2026 (по прямому указанию) — попап вечного ТОПа 2048 (ТЗ п.7). Справа — большая
// карточка места №1 (аватар/ник/партии/накопленные за всё время награды), слева —
// прокручиваемый список с места №2.
//
// ⚠️ Пользователь ЯВНО разрешил расставить координаты визуально ("ты сейчас будешь текст
// расставлять визуально, потом я тебя буду поправлять") — в отличие от остального экрана 2048,
// где все x/y продиктованы точно. Все числа ниже — прикидка под компоновку, видимую на фоне
// "2048 топ попап.png", требует прохода через редактор позиций после первого визуального показа
// пользователю.
//
// Упрощение: список слева показывает ранги 2..10 СТАТИЧЕСКИ (9 строк), без свайп-прокрутки —
// точный прямоугольник прокручиваемой области (нужен для маски/клиппинга) ещё не откалиброван.
// Полноценный свайп-скролл — по рецепту из AGENTS.md ("Рецепт свайпа"), добавить отдельным
// шагом, когда область подтверждена.
import { applyPatch } from '../../modules/patch.js';
import { formatAchNum } from '../../modules/achievement-tiers.js';

// 28.10.2026 (по прямому указанию — "расстояние между всеми текстами уменьши на 9 пикселей,
// для всего"): 46 → 37. Повторное указание тем же днём ("увеличь... на 1px"): 37 → 38. Третье
// указание тем же днём ("уменьши... на 1px"): 38 → 37. Четвёртое указание тем же днём
// ("уменьши ещё на 0.5px"): 37 → 36.5.
const ROW_H = 46 - 9 + 1 - 1 - 0.5;
// 27.10.2026 (баг найден по прямому указанию — "вижу x100 x50, но не понимаю к чему это
// относится"): артворк "2048 топ попап.png" рисует РОВНО 5 иконок в ОДНОМ ряду (монета/пистолет/
// автомат/сухари/XP — см. зум-кроп нижней части карточки топ-1, иконки с шагом 65px, центр
// первой иконки x≈487,y≈425 В ЛОКАЛЬНЫХ координатах файла) — "фрагмент" (6-й тип) в этом арте
// иконки не имеет вообще. Старый код рисовал 6 значений в ДВА ряда (i%3,floor(i/3)) по
// координатам 760/420/58 — ни X, ни тем более Y (420 против реальных ~505 в игровых
// координатах) не совпадали с нарисованными иконками: цифры попадали в пустое место над
// заголовком "ЗАРАБОТАНО ЗА ВСЕ ВРЕМЯ", рядом со строкой "Всего сыграно партий" — отсюда и
// репорт "не понимаю к чему относится". Теперь — один ряд из 5 (без fragment), координаты сняты
// по самому файлу: bg.x=270 (см. _buildGame2048TopPopup ниже) + локальный центр первой иконки.
const ICON_MAP = {
    coins: 'монеты', gun: 'ствол', auto: 'автомат', cig: 'сухари', exp: 'опыт',
};
// 27.10.2026 (по прямому указанию, координаты редактора позиций — заменяют визуальную
// прикидку, см. докблок файла): не единый шаг, индивидуальные X на каждую иконку (замеры
// редактора не идеально равномерны — 52-59px между соседними).
const LIFETIME_ROW_Y0 = 525;
const LIFETIME_X_MAP = { coins: 762, gun: 814, auto: 867, cig: 918, exp: 977 };

// 28.10.2026 (баг найден по прямому указанию — "никнейм топ-1 криво стоит / будто пустой"):
// fill был чёрным на тёмной плашке фона — текст физически рендерился, просто был невидим
// (та же причина, что уже чинилась для countTxt в svod-zanachki.js 27.10.2026). Временно был
// перекрашен в белый.
//
// 28.10.2026 (повторное указание тем же днём — "нужно было сделать шрифт чёрный"): возвращён
// чёрный БЕЗУСЛОВНО, по прямому подтверждению пользователя (явно предупреждён, что это тот же
// риск невидимости на тёмной плашке, что и был до фикса выше, — решение осознанное).
// emptyTopTxt ("Пока нет лидера") по-прежнему явно переопределяет fill на белый поверх этого
// стиля (см. ниже) — её это решение не затрагивает.
//
// 28.10.2026 (второй баг, найден при проверке "не гонка ли шрифта"): fontFamily был буквально
// 'Bebas Neue Pro' — а такого @font-face в fonts.css НЕТ и никогда не было, зарегистрированы
// только 'Bebas Neue Pro Middle' и 'Bebas Neue Pro Bold' (см. game2048.js: FONT_STAT, тот же
// баг с момента создания фичи 26.10.2026). Это не гонка загрузки — текст был ОБРЕЧЕН всегда
// рисоваться системным fallback-шрифтом, с любым document.fonts.ready-ожиданием ниже: браузер
// никогда не просит именно 'Bebas Neue Pro', значит document.fonts.check для неё никогда не
// станет true, и ожидание ниже зависло бы бесконечным циклом пересборки. Переведено на реально
// зарегистрированный 'Bebas Neue Pro Middle' (тот же файл, что уже используется в верхнем HUD,
// interface.js/interface-top-currency.js) — он и был, судя по всему, тем шрифтом, который
// визуально диктовался 26.10.2026.
const STYLE_NICK = { fontFamily: 'Bebas Neue Pro Middle', fontSize: 18, fontWeight: '400', fill: '#000000' };
const STYLE_GAMES_BIG = { fontFamily: 'Bebas Neue Pro Middle', fontSize: 16, fontWeight: '400', fill: '#f4b960',
    dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1 };
const STYLE_ROW_NAME = { fontFamily: 'Arial Narrow', fontWeight: 'bold', fontSize: 16, fill: '#ffffff' };
const STYLE_ROW_GAMES = { fontFamily: 'Arial Narrow', fontWeight: 'bold', fontSize: 14, fill: '#ffffff' };
// Обводка 3px/39% (изображение 7 из диктовки 26.10.2026) — PIXI не умеет alpha отдельно на
// обводке, strokeThickness без alpha — визуально близкое приближение.
const STYLE_ROW_PLACE = { fontFamily: 'Arial Narrow', fontWeight: 'bold', fontSize: 24, fill: '#dbbda2',
    stroke: '#000000', strokeThickness: 3 };
const STYLE_LIFETIME = { fontFamily: 'Arial Narrow', fontWeight: 'bold', fontSize: 14, fill: '#e3d0bb',
    stroke: '#000000', strokeThickness: 2 };

export function attachGame2048TopPopup(proto){

    proto._openGame2048TopPopup = function(){
        // 28.10.2026 (баг найден по прямому указанию — "никнейм и кол-во партий топ-1 не в
        // хитбоксах, хотя координаты верные"): тот же класс гонки, что уже чинился 20.10.2026 в
        // interface-currency-purchase.js — PIXI печёт canvas текста СРАЗУ по запросу, не дожидаясь
        // реальной загрузки @font-face "Bebas Neue Pro Middle" (подключается только DOM-трюком в
        // index.html, нигде не ждётся document.fonts.ready). Если попап строится раньше, чем
        // шрифт готов (вероятно — дев-панель открывает его почти сразу после загрузки игры),
        // canvas молча подставляет системный fallback с другими пропорциями глифов — отсюда и
        // "текст не на том месте". Усугубляет это then, что _topWin кешируется НАВСЕГДА
        // (if(!this._topWin) ниже) — одна неудачная первая сборка портит экран на весь сеанс,
        // даже когда шрифт потом догружается. Ждём document.fonts.ready ПЕРЕД первой сборкой —
        // безопасный no-op там, где Font Loading API недоступен (попап просто строится сразу).
        // ⚠️ Строка проверки ОБЯЗАНА совпадать с РЕАЛЬНО зарегистрированным в fonts.css именем
        // (см. STYLE_NICK выше) — проверка несуществующего имени шрифта никогда не станет true,
        // и document.fonts.ready.then(retry) ниже зациклился бы бесконечно, так и не построив
        // попап (ровно это и было здесь до второго фикса в этот же день).
        if(!this._topWin && typeof document !== 'undefined' && document.fonts && typeof document.fonts.check === 'function'
            && !document.fonts.check("18px 'Bebas Neue Pro Middle'")){
            console.log('[game2048._openGame2048TopPopup] шрифт Bebas Neue Pro Middle ещё не готов — жду document.fonts.ready перед первой сборкой попапа');
            document.fonts.ready.then(() => {
                console.log('[game2048._openGame2048TopPopup] шрифт готов, строю попап');
                this._openGame2048TopPopup();
            });
            return;
        }
        if(!this._topWin) this._buildGame2048TopPopup();
        root.layer2_mc.addChild(this._topWin);
        this._fetchGame2048Top();
    };

    proto._closeGame2048TopPopup = function(){
        if(this._topWin && this._topWin.parent) this._topWin.parent.removeChild(this._topWin);
    };

    proto._fetchGame2048Top = function(){
        console.log('[game2048._fetchGame2048Top] → сервер: game2048.top');
        TS.php('game2048.top', {}, (e) => {
            console.log('[game2048._fetchGame2048Top] ← ответ сервера:', JSON.stringify(e));
            if(!e) return;
            this._renderGame2048Top(e);
        }, (err) => console.error('[game2048._fetchGame2048Top] ← ошибка сервера:', JSON.stringify(err)));
    };

    proto._buildGame2048TopPopup = function(){
        const IMG = './images/';
        const win = new PIXI.Container();
        win.interactive = true;

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.001);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        const darkBg = new PIXI.Graphics();
        darkBg.beginFill(0x000000, 0.6);
        darkBg.drawRect(0, 0, 1280, 720);
        darkBg.endFill();
        win.addChild(darkBg);

        const bg = new PIXI.Sprite(PIXI.Texture.from(IMG + '2048 топ попап.png'));
        bg.x = 270; bg.y = 80;
        win.addChild(bg);

        const exitBtn = new PIXI.Sprite(PIXI.Texture.from(IMG + 'выход.png'));
        exitBtn.scale.set(0.5);
        if(window.isMobile) helper.touchPad(exitBtn);
        exitBtn.x = 1240; exitBtn.y = 83;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', () => { exitBtn.scale.set(0.54); });
        exitBtn.on('pointerout',  () => { exitBtn.scale.set(0.5); });
        exitBtn.on('pointerdown', () => this._closeGame2048TopPopup());
        win.addChild(exitBtn);

        // ── Карточка ТОП-1 (справа) ──
        const top1Avatar = new PIXI.Sprite(PIXI.Texture.from(IMG + '2048 аватар заглушка.png'));
        top1Avatar.x = 900; top1Avatar.y = 110;
        top1Avatar.visible = false;

        // 28.10.2026 (по прямому указанию, повторный снимок хитбокса редактора позиций):
        // x:770,y:362, scale:1.106 — для никнейма топ-1 (было 775,363,1.105).
        const top1Nick = new PIXI.Text('', STYLE_NICK);
        top1Nick.anchor.set(0.5, 0.5);
        top1Nick.x = 860; top1Nick.y = 374;
        top1Nick.scale.set(1.106);
        win.addChild(top1Nick);

        // 28.10.2026 (по прямому указанию, повторный снимок хитбокса редактора позиций):
        // x:727,y:411, scale:1.699 — для количества сыгранных партий топ-1 (было 731,413,1.676).
        const top1Games = new PIXI.Text('', STYLE_GAMES_BIG);
        top1Games.anchor.set(0.5, 0.5);
        top1Games.x = 857; top1Games.y = 426;
        top1Games.scale.set(1.699);
        win.addChild(top1Games);

        const lifetimeTxts = {};
        Object.keys(ICON_MAP).forEach((type) => {
            // 27.10.2026 (по прямому указанию — "вместо x маленького X большое").
            const t = new PIXI.Text('X0', STYLE_LIFETIME);
            t.anchor.set(0.5, 0.5);
            t.x = LIFETIME_X_MAP[type];
            t.y = LIFETIME_ROW_Y0;
            win.addChild(t);
            lifetimeTxts[type] = t;
        });

        const emptyTopTxt = new PIXI.Text('Пока нет лидера', Object.assign({}, STYLE_NICK, { fill: '#ffffff' }));
        emptyTopTxt.anchor.set(0.5, 0.5);
        emptyTopTxt.x = 1000; emptyTopTxt.y = 220;
        emptyTopTxt.visible = false;
        win.addChild(emptyTopTxt);

        // ── Список слева, с места №2, 9 строк статически ──
        // 27.10.2026 (по прямому указанию, координаты редактора позиций — для места №2,
        // остальные места — та же колонка X, тот же шаг ROW_H вниз, "остальное расположи
        // визуально"): placeTxt x:336,y:225; avatar x:387,y:236,scale:1.050; nickname
        // x:433,y:236; партии x:635,y:236. Y у placeTxt/avatar/nameTxt/gamesTxt заметно не
        // совпадают (225 vs 236) — это сохранено как индивидуальный delta на весь список, не
        // усреднено до единого Y.
        // 28.10.2026 (по прямому указанию — "опусти все места игроков вниз на 9px"): -11 → -2.
        const ROW2_Y = 236, PLACE_Y_DELTA = 225 - 236 + 9;
        const rows = [];
        for(let i = 0; i < 9; i++){
            const rowY = ROW2_Y + i * ROW_H;
            const placeTxt = new PIXI.Text('', STYLE_ROW_PLACE);
            placeTxt.anchor.set(0.5, 0.5);
            // 28.10.2026 (по прямому указанию — "места 2,3,4...10 сдвинь вправо на 20px"): 336→356.
            placeTxt.x = 336 + 20; placeTxt.y = rowY + PLACE_Y_DELTA;
            win.addChild(placeTxt);

            const avatar = new PIXI.Sprite(PIXI.Texture.from(IMG + '2048 аватар заглушка.png'));
            avatar.anchor && avatar.anchor.set ? avatar.anchor.set(0, 0.5) : null;
            avatar.scale.set(1.050);
            avatar.x = 387; avatar.y = rowY;
            win.addChild(avatar);

            const nameTxt = new PIXI.Text('', STYLE_ROW_NAME);
            nameTxt.anchor.set(0, 0.5);
            nameTxt.x = 433; nameTxt.y = rowY;
            win.addChild(nameTxt);

            const gamesTxt = new PIXI.Text('', STYLE_ROW_GAMES);
            gamesTxt.anchor.set(1, 0.5);
            gamesTxt.x = 635; gamesTxt.y = rowY;
            win.addChild(gamesTxt);

            [placeTxt, avatar, nameTxt, gamesTxt].forEach((o) => { o.visible = false; });
            rows.push({ placeTxt, avatar, nameTxt, gamesTxt });
        }

        this._topWin = win;
        this._top1Avatar = top1Avatar;
        this._top1Nick = top1Nick;
        this._top1Games = top1Games;
        this._top1LifetimeTxts = lifetimeTxts;
        this._topEmptyTxt = emptyTopTxt;
        this._topRows = rows;
    };

    proto._renderGame2048Top = function(e){
        const avatarGeneration = this._topAvatarGeneration = (this._topAvatarGeneration || 0) + 1;
        const top1 = e.top1;
        const hasLeader = !!top1;
        this._topEmptyTxt.visible = !hasLeader;
        this._top1Nick.visible = hasLeader;
        this._top1Games.visible = hasLeader;
        if(this._top1Avatar) this._top1Avatar.visible = false;
        if(hasLeader){
            this._top1Nick.text = top1.nick || ('id' + top1.id);
            this._top1Games.text = String(top1.gamesCompleted);
            const lt = top1.lifetime || {};
            const keyMap = { coins: 'coins', gun: 'guns', auto: 'autos', cig: 'cig', exp: 'exp' };
            // 28.10.2026 (по прямому указанию — "если цифра перевалит за 1000 вместо X1000
            // писалось бы X1K, за 1 000 000 — X1КК"): переиспользуем formatAchNum — тот же
            // к/кк-формат, что уже используется для достижений (interface-achievements.js) и
            // попапа результата боя (boss_result.js), единый источник, не задублировано.
            Object.keys(this._top1LifetimeTxts).forEach((type) => {
                this._top1LifetimeTxts[type].text = 'X' + formatAchNum(intval(lt[keyMap[type]]) || 0);
            });
        }

        const rest = e.rest || [];
        this._topRows.forEach((row, i) => {
            const r = rest[i];
            const visible = !!r;
            row.placeTxt.visible = visible; row.avatar.visible = visible;
            row.nameTxt.visible = visible; row.gamesTxt.visible = visible;
            if(!visible) return;
            row.placeTxt.text = String(i + 2); // список начинается строго с места №2
            row.nameTxt.text = r.nick || ('id' + r.id);
            row.gamesTxt.text = r.gamesCompleted + ' партий';
        });
        const entries = rest.slice(0, this._topRows.length);
        const fallback = PIXI.Texture.from('./images/2048 аватар заглушка.png');
        const targets = [];
        rest.slice(0, this._topRows.length).forEach((entry, i) => targets.push({id: entry.id, sprite: this._topRows[i].avatar}));
        targets.forEach(({sprite}) => {
            if(!sprite._topAvatarSize) sprite._topAvatarSize = {width: sprite.width, height: sprite.height};
            sprite.texture = fallback;
            sprite.width = sprite._topAvatarSize.width; sprite.height = sprite._topAvatarSize.height;
        });
        if(entries.length && window.bosses && typeof bosses._resolveVkUsers === 'function'){
            bosses._resolveVkUsers(entries.map(entry => entry.id), (users) => {
                if(avatarGeneration !== this._topAvatarGeneration) return;
                targets.forEach(({id, sprite}) => {
                    if(sprite.destroyed) return;
                    const photo = users && users[String(id)] && users[String(id)].photo;
                    if(!photo) return;
                    const width = sprite.width, height = sprite.height;
                    const texture = PIXI.Texture.from(photo);
                    sprite.texture = texture;
                    const fit = () => {
                        if(!sprite.destroyed && sprite.texture === texture){ sprite.width = width; sprite.height = height; }
                    };
                    fit();
                    if(texture.baseTexture && !texture.baseTexture.valid) texture.baseTexture.once('loaded', fit);
                });
            });
        }
    };
}

function intval(v){ return parseInt(v, 10) || 0; }
