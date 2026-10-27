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

const ROW_H = 46;
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

const STYLE_NICK = { fontFamily: 'Bebas Neue Pro', fontSize: 18, fontWeight: '400', fill: '#000000' };
const STYLE_GAMES_BIG = { fontFamily: 'Bebas Neue Pro', fontSize: 30, fontWeight: '400', fill: '#f4b960',
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
        exitBtn.on('pointerover', () => { exitBtn.alpha = 0.75; });
        exitBtn.on('pointerout',  () => { exitBtn.alpha = 1; });
        exitBtn.on('pointerdown', () => this._closeGame2048TopPopup());
        win.addChild(exitBtn);

        // ── Карточка ТОП-1 (справа) ──
        const top1Avatar = new PIXI.Sprite(PIXI.Texture.from(IMG + '2048 аватар заглушка.png'));
        top1Avatar.x = 900; top1Avatar.y = 110;
        win.addChild(top1Avatar);

        // 27.10.2026 (по прямому указанию, координаты редактора позиций): x:777,y:363,
        // scale:1.076 — для никнейма топ-1.
        const top1Nick = new PIXI.Text('', STYLE_NICK);
        top1Nick.anchor.set(0.5, 0.5);
        top1Nick.x = 777; top1Nick.y = 363;
        top1Nick.scale.set(1.076);
        win.addChild(top1Nick);

        // x:729,y:411,scale:1.682 — для количества сыгранных партий топ-1.
        const top1Games = new PIXI.Text('', STYLE_GAMES_BIG);
        top1Games.anchor.set(0.5, 0.5);
        top1Games.x = 729; top1Games.y = 411;
        top1Games.scale.set(1.682);
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
        const ROW2_Y = 236, PLACE_Y_DELTA = 225 - 236;
        const rows = [];
        for(let i = 0; i < 9; i++){
            const rowY = ROW2_Y + i * ROW_H;
            const placeTxt = new PIXI.Text('', STYLE_ROW_PLACE);
            placeTxt.anchor.set(0.5, 0.5);
            placeTxt.x = 336; placeTxt.y = rowY + PLACE_Y_DELTA;
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
        this._top1Nick = top1Nick;
        this._top1Games = top1Games;
        this._top1LifetimeTxts = lifetimeTxts;
        this._topEmptyTxt = emptyTopTxt;
        this._topRows = rows;
    };

    proto._renderGame2048Top = function(e){
        const top1 = e.top1;
        const hasLeader = !!top1;
        this._topEmptyTxt.visible = !hasLeader;
        this._top1Nick.visible = hasLeader;
        this._top1Games.visible = hasLeader;
        if(hasLeader){
            this._top1Nick.text = top1.nick || ('id' + top1.id);
            this._top1Games.text = String(top1.gamesCompleted);
            const lt = top1.lifetime || {};
            const keyMap = { coins: 'coins', gun: 'guns', auto: 'autos', cig: 'cig', exp: 'exp' };
            Object.keys(this._top1LifetimeTxts).forEach((type) => {
                this._top1LifetimeTxts[type].text = 'X' + (intval(lt[keyMap[type]]) || 0);
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
    };
}

function intval(v){ return parseInt(v, 10) || 0; }
