import { applyPatch } from '../../../modules/patch.js';

// 23.10.2026 (по прямому указанию — новая фича "Разнарядка", месячный календарь ежедневных
// заданий, полная спецификация координат/шрифтов/цветов продиктована голосом + референс-
// скриншот "ДЕЛА СТАЛКЕРА"): новый экран, сервер — server/core/controllers/raznaryadka.php
// (getState/claim/payDay), прогресс пишет RaznaryadkaProgress::report() из других контроллеров
// (bosses/zone/dvor/zaruba/dice/blackjack/poker/roulette).
//
// 23.10.2026: пользователь прислал настоящий файл (ofont.ru_Bebas Neue.ttf, внутреннее имя
// шрифта — "Bebas Neue Book", т.е. ровно "BebasNeueBook", как и был изначально запрошен) —
// заменяет временный "AA Bebas Neue", который использовался как заменитель до этого момента.
// Подключён в fonts/fonts.css + активирован hidden span в index.html.
const FONT = 'Bebas Neue Book';
const GOLD = '#d8bb9e'; // цвет из присланной палитры (H:31 S:27 B:85 / R:216 G:187 B:158)

const MONTH_GENITIVE = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

// Склонение "задание/задания/заданий" — классическое русское согласование с числительным.
function ruTasksWord(n){
    const n10 = n % 10, n100 = n % 100;
    if(n10 === 1 && n100 !== 11) return 'задание';
    if(n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return 'задания';
    return 'заданий';
}

// Координаты продиктованы пользователем 23.10.2026 — x:375,y:227 для дня 1, шаг 41px по X,
// 42px по Y, 7 колонок (та же сетка, что на референс-скриншоте "ДЕЛА СТАЛКЕРА").
const DAY_GRID = { x0: 375, y0: 227, stepX: 41, stepY: 42, cols: 7 };
function dayTilePos(day){
    const idx = day - 1;
    return { x: DAY_GRID.x0 + (idx % DAY_GRID.cols) * DAY_GRID.stepX, y: DAY_GRID.y0 + Math.floor(idx / DAY_GRID.cols) * DAY_GRID.stepY };
}

// Строки наград — координаты иконки/счётчика и общая x=859 для фон/кнопок, разные y по рядам
// (продиктовано пользователем 23.10.2026).
// 24.10.2026 (по прямому указанию — "подними вверх на 3 пикселя рубли/пистолет/автомат"):
// iconY уменьшен на 3 у этих трёх (патроны и сундук не трогались).
const REWARD_ROWS = [
    { rowY: 212, iconX: 751, iconY: 214, icon: 'разнарядка награда рубли.png' },
    { rowY: 273, iconX: 749, iconY: 279, icon: 'разнарядка награда пистолет.png' },
    { rowY: 332, iconX: 746, iconY: 326, icon: 'разнарядка награда автомат.png' },
    { rowY: 390, iconX: 759, iconY: 388, icon: 'разнарядка награда патроны.png' },
    { rowY: 450, iconX: 733, iconY: 456, icon: 'разнарядка награда сундук.png' },
];
const REWARD_ROW_BTN_X = 859;
// 23.10.2026 (по прямому указанию — "расположи их всех на одном уровне по координатам X,
// центрировано по вертикали относительно файла строка награды фон, чёрным цветом, с «×» перед
// числом, кроме последней награды (сундук)"): общий X — правый край самой широкой иконки
// (пистолет: x:749 + width:58 = 807) + 12px зазора, как у остальных подписей на этом экране.
const REWARD_AMT_X = 819;

export default class Raznaryadka {
    constructor(){
        this._win = null;
        this._dayTileSprs = {};
        this._dayCrossSprs = {};
        this._dayCheckSprs = {};
        this._rewardRowEls = [];
        this._state = null;
        this._timerInterval = null;
    }

    open(){
        if(this._win && this._win.parent){ this.close(); return; }
        try { this._build(); } catch(e){ console.error('[raznaryadka.open] _build() FAILED:', e); return; }
        root.layer2_mc.addChild(this._win);
        // Стандартный паттерн нового PIXI-экрана (см. AGENTS.md) — HUD поверх ПОСЛЕ addChild(win).
        if(window.iface){
            if(iface.up)   root.layer2_mc.addChild(iface.up);
            if(iface.down) root.layer2_mc.addChild(iface.down);
        }
        this._fetchState();
    }

    close(){
        this._stopTimer();
        if(this._win && this._win.parent) this._win.parent.removeChild(this._win);
    }

    _fetchState(){
        console.log('[raznaryadka._fetchState] → сервер: raznaryadka.getState');
        TS.php('raznaryadka.getState', {}, (e) => {
            console.log('[raznaryadka._fetchState] ← ответ сервера:', JSON.stringify(e));
            if(!e || !e.patch){
                console.error('[raznaryadka._fetchState] некорректный ответ сервера (нет patch):', JSON.stringify(e));
                if(window.notify) notify.showResult({text: 'Не удалось загрузить разнарядку'}, 0);
                return;
            }
            applyPatch(e.patch);
            this._state = e;
            this._render();
            this._startTimer();
        }, (err) => {
            console.error('[raznaryadka._fetchState] ← ошибка сервера:', JSON.stringify(err));
            if(window.notify) notify.showResult({text: 'Раздел временно недоступен'}, 0);
        });
    }

    _build(){
        const IMG = './images/';
        const win = new PIXI.Container();
        win.interactive = true;

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.001);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        // 23.10.2026 (продиктовано — "задний фон с координатами Y 57 пикселей, X сам можешь
        // подобрать"): файл 1280px шириной — ровно canvas, X=0 (полная ширина).
        const bg = new PIXI.Sprite(PIXI.Texture.from(IMG + 'разнарядка фон.png'));
        bg.x = 0; bg.y = 57;
        win.addChild(bg);

        // 23.10.2026 (продиктовано — "pop-up открывается с координатами X243, Y59").
        const popup = new PIXI.Sprite(PIXI.Texture.from(IMG + 'разнарядка попап рамка.png'));
        popup.x = 243; popup.y = 59;
        win.addChild(popup);

        // 24.10.2026 (по прямому указанию — уточнение позиции/шрифта/размера): Bebas Neue Pro
        // Bold 30pt, x:580 y:185 (заменяет прежнюю прикидку x:383,y:207 общим шрифтом экрана).
        // 24.10.2026 (повторное уточнение тем же днём — "сдвинь влево на 120, подними вверх на
        // 11, уменьши font size на 27"): было x:580,y:185,fontSize:30.
        const doneHeaderTxt = new PIXI.Text('', {
            fontFamily: 'Bebas Neue Pro Bold', fontSize: 27, fill: GOLD,
            dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
        });
        doneHeaderTxt.x = 460; doneHeaderTxt.y = 174;
        win.addChild(doneHeaderTxt);
        this._doneHeaderTxt = doneHeaderTxt;

        // "ДЕЛО НА <день> <месяц>" — центрировано по горизонтали на мазке.
        const dateMazok = new PIXI.Sprite(PIXI.Texture.from(IMG + 'разнарядка мазок красный.png'));
        dateMazok.x = 368; dateMazok.y = 461;
        win.addChild(dateMazok);
        const dateTxt = new PIXI.Text('', {
            fontFamily: FONT, fontSize: 24, fill: GOLD,
            dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
        });
        dateTxt.anchor.set(0.5, 0.5);
        dateTxt.x = dateMazok.x + dateMazok.width / 2;
        dateTxt.y = dateMazok.y + dateMazok.height / 2;
        win.addChild(dateTxt);
        this._dateTxt = dateTxt;

        // Текст самого задания — на серой плашке.
        const taskPlate = new PIXI.Sprite(PIXI.Texture.from(IMG + 'разнарядка плашка серая.png'));
        taskPlate.x = 339; taskPlate.y = 497;
        win.addChild(taskPlate);
        const taskTxt = new PIXI.Text('', {
            fontFamily: FONT, fontSize: 24, fill: GOLD,
            dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
            wordWrap: true, wordWrapWidth: taskPlate.texture.width - 16,
        });
        taskTxt.anchor.set(0.5, 0.5);
        taskTxt.x = taskPlate.x + taskPlate.texture.width / 2;
        taskTxt.y = taskPlate.y + taskPlate.texture.height / 2;
        win.addChild(taskTxt);
        this._taskTxt = taskTxt;

        // Таймер до сброса (00:00 МСК) — тёмная плашка, Southbank LT 36pt чёрный + обводка.
        const timerPlate = new PIXI.Sprite(PIXI.Texture.from(IMG + 'разнарядка плашка тёмная.png'));
        timerPlate.x = 782; timerPlate.y = 510;
        win.addChild(timerPlate);
        const timerTxt = new PIXI.Text('24:00:00', {
            fontFamily: 'Southbank LT', fontSize: 36, fill: '#000000',
            stroke: GOLD, strokeThickness: 2,
        });
        timerTxt.anchor.set(0.5, 0.5);
        timerTxt.x = timerPlate.x + timerPlate.texture.width / 2;
        timerTxt.y = timerPlate.y + timerPlate.texture.height / 2;
        win.addChild(timerTxt);
        this._timerTxt = timerTxt;

        // Дни месяца (до 31 файла, лишние скрыты по длине месяца).
        for(let d = 1; d <= 31; d++){
            const pos = dayTilePos(d);
            const spr = new PIXI.Sprite(PIXI.Texture.from(IMG + 'разнарядка день ' + d + '.png'));
            spr.x = pos.x; spr.y = pos.y;
            spr.interactive = true; spr.buttonMode = true;
            if(window.isMobile) helper.touchPad(spr);
            spr.on('pointerdown', () => this._onDayClick(d));
            win.addChild(spr);
            this._dayTileSprs[d] = spr;

            // ⚠️ Позиция креста НЕ продиктована явно — центрирован поверх своей бирки дня
            // (41×44 бирка, 45×49 крест — разница симметрично поделена).
            const cross = new PIXI.Sprite(PIXI.Texture.from(IMG + 'разнарядка крест провал.png'));
            cross.x = pos.x - 2; cross.y = pos.y - 3;
            cross.visible = false;
            win.addChild(cross);
            this._dayCrossSprs[d] = cross;

            // 24.10.2026 (по прямому указанию, пересмотр решения от 23.10.2026 — тогда крест
            // поставили на ВЫПОЛНЕННЫЙ день, теперь явно указано наоборот): крест — провален
            // (ещё не выкуплен), галочка — выполнен (честно или выкуплен тушёнкой). Плейсхолдер
            // "разнарядка галочка выполнено.png" (24×19, заменить позже на финальный арт).
            // 24.10.2026 (повторное уточнение тем же днём — "сделай scale 1.2"): якорь по центру
            // (0.5,0.5), позиция — геометрический центр бирки дня (41×44: x+20.5, y+22) — так
            // увеличение масштаба растёт симметрично вокруг центра, а не съезжает от угла.
            const check = new PIXI.Sprite(PIXI.Texture.from(IMG + 'разнарядка галочка выполнено.png'));
            check.anchor.set(0.5, 0.5);
            check.x = pos.x + 20.5; check.y = pos.y + 22;
            check.scale.set(1.2);
            check.visible = false;
            win.addChild(check);
            this._dayCheckSprs[d] = check;
        }

        // 5 строк наград — иконка+счётчик (статичные при открытии) + 3-состояние справа
        // (строка-фон+текст "ВЫПОЛНИ N ЗАДАНИЙ" / кнопка "ЗАБРАТЬ" / кнопка "СОБРАНО").
        const isLastReward = (i) => i === REWARD_ROWS.length - 1;
        REWARD_ROWS.forEach((row, i) => {
            const icon = new PIXI.Sprite(PIXI.Texture.from(IMG + row.icon));
            icon.x = row.iconX; icon.y = row.iconY;
            win.addChild(icon);

            const rowBg = new PIXI.Sprite(PIXI.Texture.from(IMG + 'разнарядка строка награды фон.png'));
            rowBg.x = REWARD_ROW_BTN_X; rowBg.y = row.rowY;
            win.addChild(rowBg);

            // 23.10.2026 (по прямому указанию): для ВСЕХ наград, кроме последней (сундук),
            // счётчик — с "×" перед числом, общий X (REWARD_AMT_X), по центру ПО ВЕРТИКАЛИ
            // относительно строки "разнарядка строка награды фон". Последняя (сундук) — старое
            // поведение: рядом с иконкой, без "×".
            // 24.10.2026 (баг найден по прямому указанию — "справа от иконок награды должно
            // писаться количество, сейчас там почему-то ничего не пишется"): текст реально
            // рендерился (не пустая строка), но заливка была чёрной (#000000) — тогда решили,
            // что фон в этой точке тёмно-коричневый (RGB~20-50), и перекрасили в GOLD.
            // 24.10.2026 (повторная проверка тем же днём, по прямому указанию — продиктованы
            // точные типографские параметры из Photoshop: Bebas Neue Pro Middle, Regular, 24pt,
            // чёрный): замер пикселя С УЧЁТОМ композита "разнарядка попап рамка.png" ПОВЕРХ
            // "разнарядка фон.png" (именно так рендерится экран — рамка перекрывает фон в зоне
            // наград) показал реальный цвет ~RGB(222-228,158-173,108-126) — светлый бежевый, не
            // тёмно-коричневый. Прошлый замер, похоже, проверял только фон БЕЗ рамки поверх —
            // чёрный текст здесь прекрасно виден, GOLD был не нужен. Возвращена чёрная заливка.
            const last = isLastReward(i);
            const amtTxt = new PIXI.Text('', {
                fontFamily: 'Bebas Neue Pro Middle', fontSize: 24, fill: '#000000',
            });
            amtTxt.anchor.set(0, 0.5);
            if(last){
                // "справа от него через 12 пикселей" — от правого края иконки (сундук).
                const setAmtPos = () => { amtTxt.x = icon.x + icon.width + 12; amtTxt.y = icon.y + icon.height / 2; };
                if(icon.texture.width > 1) setAmtPos(); else icon.texture.once('update', setAmtPos);
            } else {
                amtTxt.x = REWARD_AMT_X;
                amtTxt.y = rowBg.y + rowBg.texture.height / 2;
            }
            win.addChild(amtTxt);
            // 24.10.2026 (по прямому указанию — "font size 20 пикселей, и количество заданий
            // тоже 20 пикселей"): было 16 у обеих строк.
            const rowTxt1 = new PIXI.Text('ВЫПОЛНИ', { fontFamily: FONT, fontSize: 20, fill: GOLD, dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1 });
            const rowTxt2 = new PIXI.Text('', { fontFamily: FONT, fontSize: 20, fill: GOLD, dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1 });
            [rowTxt1, rowTxt2].forEach(t => t.anchor.set(0.5, 0.5));
            // 24.10.2026 (по прямому указанию — "слово ВЫПОЛНИ опусти вниз на 2 пикселя"):
            // было -11 (нижняя строка "N заданий" уже стоит на +11, не трогалась).
            const centerRowX = rowBg.x + rowBg.texture.width / 2;
            rowTxt1.x = centerRowX; rowTxt1.y = rowBg.y + rowBg.texture.height / 2 - 9;
            rowTxt2.x = centerRowX; rowTxt2.y = rowBg.y + rowBg.texture.height / 2 + 11;
            win.addChild(rowTxt1, rowTxt2);

            const claimBtn = new PIXI.Sprite(PIXI.Texture.from(IMG + 'разнарядка кнопка забрать.png'));
            claimBtn.x = REWARD_ROW_BTN_X; claimBtn.y = row.rowY;
            claimBtn.visible = false;
            claimBtn.interactive = true; claimBtn.buttonMode = true;
            if(window.isMobile) helper.touchPad(claimBtn);
            claimBtn.on('pointerdown', () => this._onClaimClick(i));
            win.addChild(claimBtn);

            const claimedBtn = new PIXI.Sprite(PIXI.Texture.from(IMG + 'разнарядка кнопка собрано.png'));
            claimedBtn.x = REWARD_ROW_BTN_X; claimedBtn.y = row.rowY;
            claimedBtn.visible = false;
            win.addChild(claimedBtn);

            this._rewardRowEls.push({ amtTxt, rowBg, rowTxt1, rowTxt2, claimBtn, claimedBtn });
        });

        // Стандартная кнопка выхода (см. AGENTS.md — "Паттерн нового PIXI-экрана").
        const exitBtn = new PIXI.Sprite(PIXI.Texture.from(IMG + 'выход.png'));
        exitBtn.scale.set(0.5);
        if(window.isMobile) helper.touchPad(exitBtn);
        exitBtn.x = 1240; exitBtn.y = 83;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', () => { exitBtn.alpha = 0.75; });
        exitBtn.on('pointerout',  () => { exitBtn.alpha = 1; });
        exitBtn.on('pointerdown', () => this.close());
        win.addChild(exitBtn);

        this._win = win;
    }

    _onDayClick(day){
        const st = this._state;
        if(!st || !st.pay_costs || !(day in st.pay_costs)) return; // не проваленный день — нечего откатывать
        const cost = st.pay_costs[day];
        this._showBuyoutPopup(day, cost);
    }

    // 24.10.2026 (по прямому указанию — "попробуем пока что потестировать универсальные
    // поп-апы", новые ассеты "попап универсальный фон/кнопка актив/кнопка неактив"): пилотное
    // применение для подтверждения выкупа пропущенного дня тушёнкой — заменяет общий
    // iface._showConfirmPopup(), который использовался здесь раньше. Фон обрезан от прозрачных
    // отступов; у кнопок проверено через PIL — отступов тоже нет (bbox = полный canvas у обоих
    // файлов), но актив/неактив физически разного размера, см. комментарий у mkUniversalBtn ниже.
    _showBuyoutPopup(day, cost){
        if(this._buyoutWin && this._buyoutWin.parent) this._buyoutWin.parent.removeChild(this._buyoutWin);
        const IMG = './images/';
        const win = new PIXI.Container();
        win.interactive = true;

        // 24.10.2026 (по прямому указанию — "задний фон должен затемняться"): было alpha:0.001
        // (невидимый, только блокировал клики) — теперь реально затемняет экран позади попапа.
        const overlay = new PIXI.Graphics();
        overlay.beginFill(0x000000, 0.6);
        overlay.drawRect(0, 0, 1280, 720);
        overlay.endFill();
        overlay.interactive = true;
        win.addChild(overlay);

        const bg = new PIXI.Sprite(PIXI.Texture.from(IMG + 'попап универсальный фон.png'));
        bg.x = 373; bg.y = 222;
        bg.interactive = true;
        win.addChild(bg);

        // 24.10.2026 (по прямому указанию, референс-скриншот): заголовок "Подтвердить действие?"
        // — продиктован шрифт "Bebas Neue Regular" 36pt, но в проекте НЕТ зарегистрированного
        // файла с таким именем семейства (см. fonts/fonts.css — есть только AA Bebas Neue/
        // Bebas Neue Pro Middle/Bebas Neue Pro Bold/Bebas Neue Book) — несуществующее имя тихо
        // откатилось бы на браузерный шрифт по умолчанию. Используем уже подключённый на этом
        // экране FONT ('Bebas Neue Book'), цвет a59472 (образец из палитры цветов).
        // 24.10.2026 (повторное уточнение тем же днём — "сдвинь вправо на 40px, шрифт Regular
        // чуть пожирнее, обводка как на изображении 1"): x 620→660. "Чуть пожирнее" — синтетический
        // bold (fontWeight) поверх ТОГО ЖЕ файла, не замена на другое начертание (тот же приём,
        // что CARD_VALUE_STYLE в player_profile.js). Обводка — Photoshop "Выполнить обводку"
        // (размер 1px, снаружи, чёрный, 35% непрозрачности) — ближайший эквивалент в PIXI.Text
        // (TextStyle.stroke не поддерживает отдельную прозрачность обводки).
        const titleTxt = new PIXI.Text('Подтвердить действие?', {
            fontFamily: FONT, fontSize: 36, fill: '#a59472', fontWeight: 'bold',
            stroke: '#000000', strokeThickness: 1,
            dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
        });
        titleTxt.anchor.set(0.5, 0.5);
        titleTxt.x = 660; titleTxt.y = 270;
        win.addChild(titleTxt);

        // Подзаголовок "Откатить день N за X тушёнки" — Bebas Neue Book 24pt.
        // 24.10.2026 (по прямому указанию — "сдвинь вправо на 40px"): x 620→660.
        const msgTxt = new PIXI.Text('Откатить день ' + day + ' за ' + cost + ' тушёнки', {
            fontFamily: FONT, fontSize: 24, fill: '#d2d2d2',
            dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
            wordWrap: true, wordWrapWidth: 480, align: 'center',
        });
        msgTxt.anchor.set(0.5, 0.5);
        msgTxt.x = 660; msgTxt.y = 312;
        win.addChild(msgTxt);

        // 24.10.2026 (по прямому указанию — "подними на 20 пикселей кнопки отмены и покупки"):
        // было y:352/386.
        // 24.10.2026 (повторное уточнение тем же днём — "изначально оба файла неактив, при
        // наведении лёгкая прозрачность (как уже было), при нажатии вместо неактив появляется
        // актив"): раньше confirmBtn/cancelBtn были ДВУМЯ РАЗНЫМИ статичными файлами (актив
        // навсегда у подтвердить, неактив навсегда у отмена) — теперь обе кнопки это один и тот
        // же 2-текстурный компонент (неактив по умолчанию → актив на 120мс перед действием),
        // тот же приём "вспышки", что был у iface._showConfirmPopup() (shell/popups/confirm.js),
        // который этот попап заменил. Проверено через PIL (getbbox()) — у обоих файлов НЕТ
        // прозрачных отступов для обрезки (bbox = полный canvas у каждого), но сами файлы РАЗНОГО
        // физического размера: актив 226×65, неактив 226×41 (актив на 24px выше) — поэтому обе
        // кнопки якорятся по ЦЕНТРУ (anchor 0.5,0.5), не по левому верхнему углу: так подмена
        // текстуры не сдвигает кнопку, она просто "растёт" симметрично вокруг центра. Общий
        // BTN_CENTER_Y=364.5 — старая калибровка confirmBtn под актив-файл (332+65/2) и cancelBtn
        // под неактив-файл С УЧЁТОМ "подними неактив на 22px" (366-22+41/2) дают РОВНО одно и то
        // же число — т.е. кнопки раньше отличались по центру на эти же 22px, инструкция их
        // выравнивает в одну линию.
        const BTN_INACTIVE = IMG + 'попап универсальный кнопка неактив.png';
        const BTN_ACTIVE = IMG + 'попап универсальный кнопка актив.png';
        const BTN_CENTER_Y = 364.5;
        const mkUniversalBtn = (label, centerX, onAction) => {
            const btn = new PIXI.Sprite(PIXI.Texture.from(BTN_INACTIVE));
            btn.anchor.set(0.5, 0.5);
            btn.x = centerX; btn.y = BTN_CENTER_Y;
            btn.interactive = true; btn.buttonMode = true;
            if(window.isMobile) helper.touchPad(btn);
            win.addChild(btn);

            const txt = new PIXI.Text(label, { fontFamily: FONT, fontSize: 27, fill: '#a59472', dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1 });
            txt.anchor.set(0.5, 0.5);
            txt.x = centerX; txt.y = BTN_CENTER_Y;
            win.addChild(txt);

            btn.on('pointerover', () => { if(!btn._pressed) btn.alpha = 0.8; });
            btn.on('pointerout',  () => { if(!btn._pressed) btn.alpha = 1; });
            btn.on('pointerdown', () => {
                if(btn._pressed) return;
                btn._pressed = true;
                btn.texture = PIXI.Texture.from(BTN_ACTIVE);
                btn.alpha = 1;
                setTimeout(onAction, 120);
            });
            return btn;
        };

        // 24.10.2026 (по прямому указанию, образец цвета — изображение 1): 27pt (было 18pt/GOLD)
        // — шрифт FONT, см. докблок у titleTxt про отсутствие файла "Bebas Neue" без суффикса.
        // 24.10.2026 (повторное уточнение тем же днём — "подтвердить/отмена цветом как
        // подтвердить действие", он же "стиль наложения цвета" с изображения 2): d2d2d2→a59472,
        // тот же цвет, что у titleTxt.
        mkUniversalBtn('ПОДТВЕРДИТЬ', 430 + 226 / 2, () => {
            if(win.parent) win.parent.removeChild(win);
            this._buyoutWin = null;
            this._payDay(day);
        });

        mkUniversalBtn('ОТМЕНА', 665 + 226 / 2, () => {
            if(win.parent) win.parent.removeChild(win);
            this._buyoutWin = null;
        });

        this._buyoutWin = win;
        root.layer2_mc.addChild(win);
    }

    _payDay(day){
        console.log('[raznaryadka._payDay] → сервер: raznaryadka.payDay | day:', day);
        TS.php('raznaryadka.payDay', {day}, (e) => {
            console.log('[raznaryadka._payDay] ← ответ сервера:', JSON.stringify(e));
            if(!e || !e.patch){
                console.error('[raznaryadka._payDay] некорректный ответ сервера (нет patch):', JSON.stringify(e));
                if(window.notify) notify.showResult({text: 'Не удалось откатить день'}, 0);
                return;
            }
            applyPatch(e.patch);
            if(window.iface) iface.updateUp();
            this._fetchState();
        }, (err) => {
            console.error('[raznaryadka._payDay] ← ошибка сервера:', JSON.stringify(err));
            if(window.notify) notify.showResult({text: 'Не удалось откатить день (недостаточно тушёнки?)'}, 0);
        });
    }

    _onClaimClick(rowIdx){
        const st = this._state;
        if(!st || !st.reward_tiers || !st.reward_tiers[rowIdx]) return;
        const need = st.reward_tiers[rowIdx].need;
        console.log('[raznaryadka._onClaimClick] → сервер: raznaryadka.claim | need:', need);
        TS.php('raznaryadka.claim', {need}, (e) => {
            console.log('[raznaryadka._onClaimClick] ← ответ сервера:', JSON.stringify(e));
            if(!e || !e.patch){
                console.error('[raznaryadka._onClaimClick] некорректный ответ сервера (нет patch):', JSON.stringify(e));
                if(window.notify) notify.showResult({text: 'Не удалось получить награду'}, 0);
                return;
            }
            applyPatch(e.patch);
            if(window.iface) iface.updateUp();
            // 23.10.2026 (по прямому указанию — "поп-ап награды не выскакивает, не нужно его
            // делать"): без всплывающего попапа — просто обновляем состояние экрана.
            this._fetchState();
        }, (err) => {
            console.error('[raznaryadka._onClaimClick] ← ошибка сервера:', JSON.stringify(err));
            if(window.notify) notify.showResult({text: 'Не удалось получить награду'}, 0);
        });
    }

    _render(){
        const st = this._state;
        if(!st) return;

        this._doneHeaderTxt.text = 'ВЫПОЛНЕНО ЗАДАНИЙ ' + st.done_count + '/' + st.days_in_month;

        // 24.10.2026 (по прямому указанию, пересмотр решения от 23.10.2026 — тогда "Скоро"
        // положили в текст задания на серой плашке, теперь явно указано наоборот): до
        // launch_month в шапке "ДЕЛО НА <N> <месяц>" пишем "СКОРО", а серая плашка задания —
        // пустая (раньше было "Скоро" именно там). После launch_month (st.pre_launch=false)
        // всё работает как обычно — ДЕЛО НА <N> <месяц> + реальный текст задания.
        const [year, monthNum] = String(st.month).split('-').map(Number);
        if(st.pre_launch){
            this._dateTxt.text = 'СКОРО';
            // 24.10.2026 (по прямому указанию, изображение 3 — "надписи Скоро увеличить жирность
            // на один уровень"): только для "СКОРО" — обычный "ДЕЛО НА <N> <месяц>" (ветка else
            // ниже) жирность не трогает, этот же объект переиспользуется для обоих текстов.
            this._dateTxt.style.fontWeight = 'bold';
            this._taskTxt.text = '';
        } else {
            this._dateTxt.style.fontWeight = 'normal';
            this._dateTxt.text = 'ДЕЛО НА ' + st.day_today + ' ' + (MONTH_GENITIVE[monthNum - 1] || '');
            if(st.today){
                this._taskTxt.text = st.today.label + (st.today.need > 1 ? ' (' + st.today.prog + '/' + st.today.need + ')' : '');
            } else {
                this._taskTxt.text = 'Нет задания на сегодня';
            }
        }

        for(let d = 1; d <= 31; d++){
            const spr = this._dayTileSprs[d];
            const cross = this._dayCrossSprs[d];
            const check = this._dayCheckSprs[d];
            const within = d <= st.days_in_month;
            spr.visible = within;
            if(!within){ cross.visible = false; check.visible = false; continue; }
            const dayInfo = st.days[d];
            const status = dayInfo ? dayInfo.status : 'pending';
            spr.alpha = status === 'pending' ? 1 : (status === 'done' ? 1 : 0.6);
            // 24.10.2026 (по прямому указанию, повторный пересмотр — "крестик это задание,
            // которое игрок не сделал... если решится купить, крестик пропадает и ставится
            // галочка"): крест — ПРОВАЛЕН (клик открывает попап выкупа тушёнкой), галочка —
            // ВЫПОЛНЕН (честно или выкуплен). Было наоборот (крест на done) по уточнению от
            // 23.10.2026 — теперь явно отменено новым уточнением.
            cross.visible = status === 'failed';
            check.visible = status === 'done';
            // 24.10.2026 (по прямому указанию — "выполненные задания должны быть не
            // кликабельными"): раньше клик по выполненному дню молча ничего не делал
            // (_onDayClick проверяет pay_costs), но курсор всё ещё показывал "кликабельно"
            // (buttonMode) — визуально вводило в заблуждение. Только проваленные дни (status
            // 'failed', единственные реально в pay_costs — см. getState()) остаются интерактивны.
            spr.interactive = status === 'failed';
            spr.buttonMode = status === 'failed';
        }

        st.reward_tiers.forEach((tier, i) => {
            const el = this._rewardRowEls[i];
            const last = i === st.reward_tiers.length - 1;
            // 24.10.2026 (баг найден по прямому указанию — "справа от сундука почему-то 130,
            // должно быть ×1"): tier.amt для последней награды (сундук) — это ВНУТРЕННЕЕ число
            // монет (130), которое grantTier() начисляет вместе с сундуком, не количество самих
            // сундуков. Игрок получает РОВНО ОДИН сундук за прохождение всех дней месяца —
            // показываем ×1, как у остальных строк, а не сумму монет внутри него.
            el.amtTxt.text = last ? '×1' : ('×' + tier.amt);
            el.rowTxt2.text = tier.need + ' ' + ruTasksWord(tier.need);

            const showLocked = !tier.eligible && !tier.claimed;
            const showClaim  = tier.eligible && !tier.claimed;
            const showClaimed = tier.claimed;
            el.rowBg.visible = showLocked;
            el.rowTxt1.visible = showLocked;
            el.rowTxt2.visible = showLocked;
            el.claimBtn.visible = showClaim;
            el.claimedBtn.visible = showClaimed;
        });
    }

    _startTimer(){
        this._stopTimer();
        if(!this._state) return;
        // 23.10.2026 (по прямому указанию, уточнение): до launch_month таймер не тикает —
        // вместо обратного отсчёта статично показывается дата старта фичи (01.11.2026).
        if(this._state.pre_launch){
            this._timerTxt.text = '01.11.2026';
            return;
        }
        if(typeof this._state.reset_in_ms !== 'number') return;
        // Серверное reset_in_ms — точка отсчёта на момент getState(); дальше тикаем локально
        // по Date.now(), как zadaniya.js._startTimer() (тот же паттерн обратного отсчёта).
        const fetchedAt = Date.now();
        const resetInMsAtFetch = this._state.reset_in_ms;
        const tick = () => {
            const remain = Math.max(0, resetInMsAtFetch - (Date.now() - fetchedAt));
            const h = Math.floor(remain / 3600000);
            const m = Math.floor((remain % 3600000) / 60000);
            const s = Math.floor((remain % 60000) / 1000);
            const pad = n => String(n).padStart(2, '0');
            this._timerTxt.text = pad(h) + ':' + pad(m) + ':' + pad(s);
            if(remain <= 0){ this._stopTimer(); this._fetchState(); } // полночь МСК — перезагружаем состояние (новый день)
        };
        tick();
        this._timerInterval = setInterval(tick, 1000);
    }

    _stopTimer(){
        if(this._timerInterval){ clearInterval(this._timerInterval); this._timerInterval = null; }
    }
}
