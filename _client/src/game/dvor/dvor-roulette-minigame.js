/**
 * Рулетка — джек-пот: выбор "забрать 500р" / мини-игра "9 стаканчиков" (Куш, Связка ключей).
 * 25.09.2026 (по прямому указанию, новые ассеты): Graphics-заглушки (панель/кнопки/кубки)
 * заменены на реальную графику "Сектор приз".
 */
import { applyPatch } from '../../modules/patch.js';

export function attachRouletteMinigame(proto){

    const CUP_LABELS = {
        auto: 'АВТОМАТ', gun: 'ПИСТОЛЕТ', machete: 'МАЧЕТЕ', cig: 'СИГАРЕТЫ',
        roulette_spichki: 'СПИЧКИ', exp: 'ОПЫТ', blue_points: 'ПОИНТЫ',
        coins: 'РУБЛИ', keyring: '🗝 СВЯЗКА',
    };

    // Сектор «Приз»: фиксированные 500 рублей или суперигра.
    // 25.09.2026 (по прямому указанию — новые ассеты "Сектор приз"): Graphics-заглушки
    // (панель+2 кнопки) заменены на реальную картинку попапа и 2 кнопки-спрайта. Позиции сняты
    // редактором позиций: попап (231,83), кнопка ЗАБРАТЬ (423,487), кнопка РИСКНУТЬ (714,488) —
    // все три top-left (anchor 0,0), масштаб не менялся (native).
    proto._openJackpotChoice = function(){
        // 04.10.2026 (аудит проекта — хардкод мимо реального ответа сервера): раньше это было
        // ЕДИНСТВЕННЫМ источником суммы в попапе награды — реально начисленные рубли шли через
        // applyPatch(res.patch) (сервер-авторитетно), но ТЕКСТ попапа брался из этой локальной
        // константы. Если сумму приза когда-нибудь поменяют только в roulette.php.claimPrize()
        // (там же захардкожено 500 — см. комментарий там), эта константа молча разойдётся с
        // реальным начислением. Теперь — фолбэк на случай, если ответ сервера не содержит
        // 'amount' (не ожидается при штатной работе) — реальное значение берётся из res.amount
        // ниже, см. pointerdown.
        const jackpotAmount = 500;
        const win = new PIXI.Container();
        win.interactive = true;

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.75);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        const panel = new PIXI.Sprite(PIXI.Texture.from('./images/попап стаканчики.png'));
        panel.x = 231; panel.y = 83;
        win.addChild(panel);

        const takeBtn = new PIXI.Sprite(PIXI.Texture.from('./images/стаканчики кнопка забрать.png'));
        takeBtn.x = 423; takeBtn.y = 487;
        takeBtn.interactive = true; takeBtn.buttonMode = true;
        takeBtn.on('pointerover', ()=>{ _sa(takeBtn, 0.85); takeBtn.scale.set(1.08); });
        takeBtn.on('pointerout',  ()=>{ _sa(takeBtn, 1); takeBtn.scale.set(1); });
        takeBtn.on('pointerdown', ()=>{
            TS.php('roulette.claimPrize', {}, (res)=>{
                if(res && res.patch) applyPatch(res.patch);
                if(win.parent) win.parent.removeChild(win);
                // 04.10.2026: сумма — из ответа сервера (res.amount, roulette.php.claimPrize()
                // уже возвращает её), а не из локальной константы выше — текст попапа теперь
                // не может разойтись с тем, что реально начислено через patch.
                const amount = (res && typeof res.amount !== 'undefined') ? res.amount : jackpotAmount;
                // 26.09.2026 (по прямому репорту — "попап награды не появляется при заборе
                // приза"): раньше подтверждение было только тихим обновлением this._roulResultTxt
                // (мелкий текст на основном экране рулетки, легко не заметить). Теперь — тот же
                // стандартный попап награды, что и везде в игре (iface._showRewardPopup).
                if(window.iface) iface._showRewardPopup([{type:'coins', amount}]);
                else if(this._roulResultTxt) this._roulResultTxt.text = 'Приз: +' + amount.toLocaleString('ru') + 'р';
            }, ()=>{ if(this._roulResultTxt) this._roulResultTxt.text = 'Не удалось забрать приз'; });
        });
        win.addChild(takeBtn);

        const riskBtn = new PIXI.Sprite(PIXI.Texture.from('./images/стаканчики кнопка рискнуть.png'));
        riskBtn.x = 714; riskBtn.y = 488;
        riskBtn.interactive = true; riskBtn.buttonMode = true;
        riskBtn.on('pointerover', ()=>{ _sa(riskBtn, 0.85); riskBtn.scale.set(1.08); });
        riskBtn.on('pointerout',  ()=>{ _sa(riskBtn, 1); riskBtn.scale.set(1); });
        riskBtn.on('pointerdown', ()=>{
            if(win.parent) win.parent.removeChild(win);
            this._openRouletteMinigame();
        });
        win.addChild(riskBtn);

        root.layer2_mc.addChild(win);
    };

    proto._openRouletteMinigame = function(){
        if(!window.TS) return;
        // 10.10.2026 (по прямому указанию — ТЗ "игроки не должны видеть под каким стаканчиком
        // куш/связка" + репорт "debug сливается в консоль браузера"): roulette.openMinigame()
        // больше не отдаёт поле debug (оно содержало ПОЛНУЮ раскладку 9 стаканчиков — см.
        // roulette.php) — console.log убран вместе с ним.
        TS.php('roulette.openMinigame', {}, (res)=>{
            this._buildRouletteMinigameWin();
        }, ()=>{
            if(this._roulResultTxt) this._roulResultTxt.text = 'Ошибка связи с сервером';
        });
    };

    proto._buildRouletteMinigameWin = function(){
        const win = new PIXI.Container();
        win.interactive = true;

        // Новый фон появляется только после выбора «РИСКНУТЬ» и успешного открытия
        // серверной мини-игры, а не на экране выбора гарантированных 500 рублей.
        // 26.09.2026 (по прямому указанию — "выводи в натуральном размере"): раньше растягивался
        // до 1280×720 (весь канвас), хотя нативный размер файла 1280×533 — картинка была
        // искажена по вертикали. Теперь без width/height (нативный размер), y=68 (снято
        // пользователем поверх исходной прикидки y=58 = "Top HUD: y=0-58" из CLAUDE.md) — снизу
        // под ним теперь видна нижняя HUD-панель (iface.down добавляется ниже).
        const superBg = new PIXI.Sprite(PIXI.Texture.from('./images/Задний фон суперигра/Задний фон суперигра.png'));
        superBg.y = 68;
        win.addChild(superBg);

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.28);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        const resultTxt = new PIXI.Text('', {
            fontFamily:'Southbank LT', fontSize:22, fill:'#ffffff', fontWeight:'bold',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:2,
        });
        resultTxt.anchor.set(0.5, 0);
        resultTxt.x = 640; resultTxt.y = 590;
        win.addChild(resultTxt);

        // 26.09.2026 (по прямому указанию, координаты сняты редактором позиций): раскладка —
        // ОДИН ряд из 9 стаканчиков на столе фона (не сетка 3×3), Y один и тот же для всех,
        // X растёт с фиксированным шагом. 1-й стаканчик: x=216 y=431. 2-й: x=309 (шаг 93px —
        // это ширина стаканчика впритык, отсюда и CW=93 ниже). Координаты — ЦЕНТР спрайта
        // (стаканчик — Sprite с anchor 0.5,0.5), не левый верхний угол контейнера.
        // 10.10.2026 (по прямому указанию, редактор позиций — "все эти файлы стаканчиков опусти
        // вниз на 50 пикселей"): CUP_Y 431→481 — сдвигает вниз весь стаканчик разом (хитбокс,
        // спрайт, шарик), не только текстуру в отрыве от зоны клика.
        const cups = [];
        const CW = 93, CH = 140;
        const START_X = 216, CUP_Y = 481, STEP_X = 93;
        // 10.10.2026 (по прямому указанию — "если шарика нет (не-Куш исход), шарик выкатывается
        // в левую сторону"; координаты даны пользователем повторно после потери контекста сессии):
        // ФИКСИРОВАННАЯ точка экрана, в которую укатывается шарик при любом не-Куш исходе — одна
        // и та же для всех 9 стаканчиков, не зависит от того, какой именно открыли. 'win' (куда
        // добавлен cup) сам не смещён (x=y=0), поэтому это абсолютные координаты канваса 1280×720.
        const BALL_ROLL_TARGET = { x: 130, y: 540 };

        let resolved = false;
        for(let i = 0; i < 9; i++){
            const x = START_X + i * STEP_X;
            const y = CUP_Y;

            const cup = new PIXI.Container();
            cup.x = x; cup.y = y;
            cup.interactive = true; cup.buttonMode = true;

            const hit = new PIXI.Graphics();
            hit.beginFill(0xffffff, 0.001);
            hit.drawRect(-CW / 2, -CH / 2, CW, CH);
            hit.endFill();
            cup.addChild(hit);

            // 10.10.2026 (по прямому указанию — "шарик должен находиться за стаканчиком"):
            // ballSpr добавлен в cup ДО closedSpr — PIXI addChild-порядок = z-порядок, значит
            // шарик рисуется ПОД стаканчиком (а не поверх, как было раньше). Показывается только
            // при res.kush в обработчике клика ниже — никакой новой игровой логики, награда за
            // Куш уже полностью реализована в roulette.php. Позиция — приблизительная, поправить
            // точно через редактор позиций, если ляжет не туда.
            const ballSpr = new PIXI.Sprite(PIXI.Texture.from('./images/шарик суперигра.png'));
            ballSpr.anchor.set(0.5, 0.5);
            ballSpr.x = 30; ballSpr.y = 12;
            ballSpr.visible = false;
            cup.addChild(ballSpr);

            // 10.10.2026 (по прямому указанию — "когда стаканчик открывается, не заменяй его на
            // другой файл, просто подними вверх и поверни на 90° по часовой"): раньше при раскрытии
            // closedSpr прятался и подменялся отдельным спрайтом "стаканчик открытый суперигра.png"
            // (openSpr) — это сбрасывало визуальный эффект gsap-анимации поворота/подъёма ниже,
            // т.к. новый спрайт появлялся мгновенно и без поворота. openSpr убран целиком —
            // closedSpr остаётся единственным файлом и на "открытом" состоянии (просто в своём
            // повёрнутом/поднятом виде после gsap.to()).
            const closedSpr = new PIXI.Sprite(PIXI.Texture.from('./images/стаканчик суперигра.png'));
            closedSpr.anchor.set(0.5, 0.5);
            const _fitClosed = () => {
                const tex = closedSpr.texture;
                if(tex.width <= 1) return;
                closedSpr.scale.set(Math.min(CW / tex.width, CH / tex.height));
            };
            if(closedSpr.texture.baseTexture.valid) _fitClosed();
            else closedSpr.texture.baseTexture.once('loaded', _fitClosed);
            cup.addChild(closedSpr);

            cup.on('pointerover', ()=>{ if(!resolved) closedSpr.alpha = 0.8; });
            cup.on('pointerout',  ()=>{ closedSpr.alpha = 1; });
            cup.on('pointerdown', ()=>{
                if(resolved) return;
                resolved = true;
                cups.forEach(c => { c.interactive = false; c.buttonMode = false; });

                console.log('[dvor-roulette-minigame] КЛИК стаканчик idx=' + i + ' | performance.now()=' + performance.now().toFixed(1) + 'ms Date.now()=' + Date.now());
                TS.php('roulette.pickCup', {idx:i}, (res)=>{
                    // 10.10.2026 (по прямому указанию — ТЗ "игроки не должны видеть под каким
                    // стаканчиком куш/связка" + репорт "debug сливается в консоль браузера"):
                    // roulette.pickCup() больше не отдаёт поле debug (оно содержало 'allCups' —
                    // полную раскладку всех 9 стаканчиков, см. roulette.php) — console.log убран.

                    // 25.09.2026 (по прямому указанию — "переворот стаканчика: поворот по часовой
                    // на 90° + подъём на 40px"): раньше раскрытие было мгновенной сменой картинки.
                    // Теперь ЗАКРЫТЫЙ спрайт анимированно "опрокидывается" (поворот+подъём), и
                    // только по завершении анимации происходит фактическое раскрытие (смена
                    // картинки, шарик при Куше, применение патча, попапы) — раньше это всё
                    // срабатывало мгновенно и попап немедленно перекрывал бы саму анимацию.
                    const CUP_FLIP_DURATION = 0.35;
                    const _finishReveal = () => {
                        // 10.10.2026: файл больше НЕ подменяется (openSpr убран) — closedSpr уже
                        // в повёрнутом/поднятом состоянии после gsap.to() ниже, просто оставляем
                        // его видимым как есть.
                        // 25.09.2026 (по прямому указанию — "шарик появляется под стаканчиком
                        // ТОЛЬКО когда там Куш"): чисто визуальный маркер, награда за Куш не
                        // меняется (уже начисляется ниже через applyPatch/_openJackpotPrize).
                        //
                        // 10.10.2026 (по прямому указанию — "если человек поднимает, и там нет
                        // шарика, шарик выкатывается в левую сторону; любой не-Куш исход, фикс.
                        // расстояние [в точку (130,540)]"): при Куше шарик просто показывается на
                        // месте (ЗА стаканчиком, см. z-порядок выше); при ЛЮБОМ другом исходе —
                        // появляется из-под стаканчика и укатывается (translate+spin) в ту же
                        // фиксированную точку экрана BALL_ROLL_TARGET, независимо от того, какой
                        // из 9 стаканчиков открыли (цель переведена в локальные координаты cup).
                        if(res.kush){
                            ballSpr.visible = true;
                        } else {
                            ballSpr.visible = true;
                            const rollX = BALL_ROLL_TARGET.x - x, rollY = BALL_ROLL_TARGET.y - y;
                            if(window.gsap){
                                gsap.to(ballSpr, {
                                    x: rollX, y: rollY, rotation: ballSpr.rotation + Math.PI * 4,
                                    duration: 0.5, ease: 'power1.out',
                                });
                            } else {
                                ballSpr.x = rollX; ballSpr.y = rollY;
                            }
                        }

                        if(res.patch) applyPatch(res.patch);
                        (res.clientRewards || []).forEach(cr => {
                            if(cr.type === 'battlepass_xp'){ if(window.battlepass) battlepass.addXp(cr.amt); }
                            else if(window.weapons && (cr.type === 'auto' || cr.type === 'gun' || cr.type === 'machete')){
                                weapons.grantAmmo(cr.type, cr.amt);
                            }
                        });

                        // 25.09.2026 (по прямому указанию — "если не угадал, выскакивает
                        // утешительный приз"): обычный исход (res.consolation, см. roulette.php.
                        // pickCup()) теперь получает отдельный полноэкранный попап вместо инлайн-
                        // текста на стаканчике. Куш/Связка/утешение-за-гонку-Связки (missed_keyring)
                        // — отдельные, более редкие исходы, оставлены как раньше (инлайн-текст на
                        // стаканчике + автозакрытие); "файлы для угадал" обещаны отдельным промптом
                        // позже — сюда пока не относится.
                        if(res.consolation){
                            this._openConsolationPrize(win, res.type, res.amt);
                            return;
                        }

                        // 25.09.2026 (по прямому указанию, новые ассеты — "если угадал, выскакивают
                        // другие файлы"): Куш — это и есть "угадал" (крупный денежный приз среди 9
                        // стаканчиков, см. roulette.php.pickCup()/KUSH_AMOUNT) — вместо инлайн-текста
                        // теперь отдельный попап "Сорванный джекпот". Связка ключей — другой,
                        // отдельный редкий исход (эксклюзивный предмет, не деньги), её инлайн-текст
                        // не трогаем — под неё отдельных файлов не присылали.
                        if(res.kush){
                            this._openJackpotPrize(win, res.amt);
                            return;
                        }

                        const lbl    = CUP_LABELS[res.type] || res.type;
                        const amtTxt = res.type === 'keyring' ? '' : ('\n+' + Number(res.amt).toLocaleString('ru'));
                        const rTxt = new PIXI.Text(lbl + amtTxt, {
                            fontFamily:'Southbank LT', fontSize:13, fill:'#ffffff', align:'center', fontWeight:'bold',
                            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1,
                        });
                        rTxt.anchor.set(0.5, 0); rTxt.x = 0; rTxt.y = closedSpr.height/2 + 4;
                        cup.addChild(rTxt);

                        resultTxt.text = res.type === 'keyring' ? '🗝 СВЯЗКА КЛЮЧЕЙ! Ты теперь владелец!'
                            : (res.missed_keyring ? 'Связку уже забрали, но вот утешительный приз' : 'Приз получен!');

                        setTimeout(()=>{ if(win.parent) win.parent.removeChild(win); }, 2200);
                    };

                    if(window.gsap){
                        gsap.to(closedSpr, {
                            rotation: Math.PI / 2, y: closedSpr.y - 40,
                            duration: CUP_FLIP_DURATION, ease: 'power2.out',
                            onComplete: _finishReveal,
                        });
                    } else {
                        _finishReveal();
                    }
                }, ()=>{
                    resultTxt.text = 'Ошибка связи с сервером';
                });
            });

            win.addChild(cup);
            cups.push(cup);
        }

        root.layer2_mc.addChild(win);
        // 26.09.2026 (по прямому указанию — "на экране джекпота верхний и нижний худ тоже
        // выводи"): раньше HUD на этом экране не добавлялся вовсе.
        if(window.iface){
            if(iface.up)   root.layer2_mc.addChild(iface.up);
            if(iface.down) root.layer2_mc.addChild(iface.down);
        }
    };

    // 25.09.2026 (по прямому указанию, новые ассеты — "Утешительный приз"): показывается вместо
    // инлайн-текста на стаканчике, когда обычный исход (не Куш, не Связка) — см. вызов в
    // pickCup() выше. Награда уже применена через applyPatch() ДО вызова этого метода —
    // кнопка ЗАБРАТЬ здесь только закрывает попап (и всю мини-игру целиком), повторного запроса
    // на сервер не делает.
    //
    // 26.09.2026 (по прямому указанию — откат правки 25.09.2026, "утешительный приз выглядит
    // иначе"): раньше здесь всегда показывалось "+50" — сервер тоже всегда выдавал фиксированные
    // 50 рублей независимо от того, что реально лежало под стаканчиком (см. roulette.php.
    // pickCup()). Теперь награда под каждым стаканчиком — одна из заранее разложенных сервером
    // (CUP_POOL: автомат/пистолет/мачете/сигареты/спички/опыт/синие поинты), и попап должен
    // показывать ИМЕННО её — тип (подпись из CUP_LABELS) + сумму, а не всегда деньги.
    //
    // Задний фон — ЕДИНСТВЕННЫЙ элемент, который плавно теряет непрозрачность (100%→0% за 7
    // секунд, запрошено явно); попап и кнопка остаются полностью непрозрачными всё время.
    proto._openConsolationPrize = function(cupsWin, type, amt){
        const FADE_DURATION_MS = 7000;

        const win = new PIXI.Container();
        win.interactive = true;

        const bg = new PIXI.Sprite(PIXI.Texture.from('./images/стаканчики задний фон утешительный приз.png'));
        bg.x = 6; bg.y = 84;
        win.addChild(bg);

        const panel = new PIXI.Sprite(PIXI.Texture.from('./images/стаканчики попап утешительный приз.png'));
        panel.x = 113; panel.y = 0;
        win.addChild(panel);

        // 26.09.2026 (по прямому указанию — "убери здесь надпись того, что выигрывает игрок,
        // но после нажатия забрать выводи попап награды с наградой"): инлайн-текст типа/суммы
        // награды на самом экране убран целиком — теперь награда показывается ТОЛЬКО через
        // стандартный попап награды (iface._showRewardPopup) после клика ЗАБРАТЬ, см. ниже.
        const takeBtn = new PIXI.Sprite(PIXI.Texture.from('./images/стаканчики кнопка утешительный приз.png'));
        takeBtn.x = 534; takeBtn.y = 459;
        takeBtn.interactive = true; takeBtn.buttonMode = true;
        takeBtn.on('pointerover', ()=>{ _sa(takeBtn, 0.85); takeBtn.scale.set(1.08); });
        takeBtn.on('pointerout',  ()=>{ _sa(takeBtn, 1); takeBtn.scale.set(1); });
        takeBtn.on('pointerdown', ()=>{
            console.log('[dvor-roulette-minigame._openConsolationPrize] ЗАБРАТЬ — закрываю попап/мини-игру, показываю попап награды');
            if(win.parent) win.parent.removeChild(win);
            if(cupsWin && cupsWin.parent) cupsWin.parent.removeChild(cupsWin);
            if(window.iface) iface._showRewardPopup([{type, amount: amt}]);
        });
        win.addChild(takeBtn);

        root.layer2_mc.addChild(win);

        console.log('[dvor-roulette-minigame._openConsolationPrize] попап открыт, задний фон начинает гаснуть за', FADE_DURATION_MS + 'мс');
        const startTs = (window.performance && performance.now) ? performance.now() : Date.now();
        const _fadeStep = () => {
            if(!bg.parent) return; // попап уже закрыт — анимация больше не нужна
            const now = (window.performance && performance.now) ? performance.now() : Date.now();
            const t = Math.min(1, (now - startTs) / FADE_DURATION_MS);
            bg.alpha = 1 - t;
            if(t < 1) requestAnimationFrame(_fadeStep);
        };
        requestAnimationFrame(_fadeStep);
    };

    // 25.09.2026 (по прямому указанию, новые ассеты — "Сорванный джекпот"): показывается вместо
    // инлайн-текста "🔥 КУШ!" на стаканчике, когда исход — Куш (res.kush, см. вызов в pickCup()
    // выше). Награда уже применена через applyPatch() ДО вызова этого метода — кнопка ЗАБРАТЬ
    // здесь только закрывает попап (и всю мини-игру целиком), повторного запроса не делает.
    // В отличие от "Утешительного приза" — фон здесь НЕ гаснет (не запрошено), кнопка ЗАБРАТЬ
    // переиспользует уже существующий файл "стаканчики кнопка забрать.png" (новый файл под эту
    // кнопку не присылали, только новые координаты).
    proto._openJackpotPrize = function(cupsWin, amount){
        const win = new PIXI.Container();
        win.interactive = true;

        const bg = new PIXI.Sprite(PIXI.Texture.from('./images/стаканчики задний фон джекпот приз.png'));
        bg.x = 0; bg.y = 34;
        win.addChild(bg);

        const panel = new PIXI.Sprite(PIXI.Texture.from('./images/стаканчики попап джекпот приз.png'));
        panel.x = 96; panel.y = 31;
        win.addChild(panel);

        // Сумма — оценочная позиция над монетами на попапе (не снята редактором позиций
        // отдельно от самого файла-попапа), если ляжет не туда — поправить одним числом.
        const amtTxt = new PIXI.Text('+' + Number(amount).toLocaleString('ru'), {
            fontFamily:'Southbank LT', fontSize:28, fill:'#ffee88', fontWeight:'bold',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:2,
        });
        amtTxt.anchor.set(0.5, 0.5);
        amtTxt.x = 96 + 570; amtTxt.y = 31 + 330;
        win.addChild(amtTxt);

        const takeBtn = new PIXI.Sprite(PIXI.Texture.from('./images/стаканчики кнопка забрать.png'));
        takeBtn.x = 540; takeBtn.y = 464;
        takeBtn.interactive = true; takeBtn.buttonMode = true;
        takeBtn.on('pointerover', ()=>{ _sa(takeBtn, 0.85); takeBtn.scale.set(1.08); });
        takeBtn.on('pointerout',  ()=>{ _sa(takeBtn, 1); takeBtn.scale.set(1); });
        takeBtn.on('pointerdown', ()=>{
            console.log('[dvor-roulette-minigame._openJackpotPrize] ЗАБРАТЬ — закрываю попап и мини-игру');
            if(win.parent) win.parent.removeChild(win);
            if(cupsWin && cupsWin.parent) cupsWin.parent.removeChild(cupsWin);
        });
        win.addChild(takeBtn);

        root.layer2_mc.addChild(win);
        console.log('[dvor-roulette-minigame._openJackpotPrize] попап "Сорванный джекпот" открыт, сумма:', amount);
    };
}
