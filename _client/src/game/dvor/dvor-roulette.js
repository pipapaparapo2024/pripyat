/** Рулетка — новый экран (оркестратор), server-authoritative. Старая FLA-панель
 *  (client-side RNG) удалена 26.09.2026 как мёртвый эксплойт — см. комментарий ниже. */
import { attachRouletteScreen }   from './dvor-roulette-screen.js';
import { attachRouletteBuy    }   from './dvor-roulette-buy.js';
import { attachRouletteMinigame } from './dvor-roulette-minigame.js';
import { applyPatch } from '../../modules/patch.js';

export function attachRoulette(proto){

    // 26.09.2026 (аудит "мёртвый vs живой код перед миграцией экономики двора", по прямому
    // указанию): здесь была старая FLA рулетка — proto._playRoulette()/_resolveRoulette().
    // Считала RNG слота и джекпот-pity ПРЯМО В БРАУЗЕРЕ (Math.random()), списывала
    // udata['blue_points'] на клиенте без проверки сервера и начисляла награду через
    // dvor._give() — тот же небезопасный паттерн, что уже убрали для покера/карт (см.
    // dvor-cards.js, tests/security-audit-weapons-shmot-bp-tasks-nick.test.js). Проверено:
    // 1) UI-недостижима — единственная привязка была rp.butt_red/rp.butt_spin на
    //    this.win.roulette_panel (dvor.js._bindGamePanels(), тоже убрана этим же коммитом),
    //    а this.win (mc.dvor_win) открывается через home.openScreen(this.win) только в ветке
    //    Dvor._openGame(), которая для 'roulette' ВСЕГДА возвращает раньше через
    //    _openRouletteScreen() (см. самое начало _openGame) — код открытия this.win физически
    //    недостижим ни для одной из 4 игр двора (тот же вывод, что уже задокументирован для
    //    poker_panel в dvor-poker.js).
    // 2) Не вызывается программно — в отличие от dvor-dice.js._playDice() (используется
    //    авто-ботом, bot.js, поэтому та функция не удалена, а мигрирована на сервер), grep по
    //    всему _client/src не нашёл ни одного вызова _playRoulette() ни из bot.js, ни откуда-
    //    либо ещё, кроме самой этой недостижимой привязки.
    // 3) Полностью дублирует уже готовый server-authoritative путь — proto._spinRoulette()
    //    ниже (roulette.spin на сервере считает RNG/pity/джекпот и списывает поинт, ответ
    //    применяется через applyPatch(res.patch)) — этот путь реально используется новым
    //    экраном рулетки (_openRouletteScreen()) и является единственным способом крутить
    //    рулетку у игрока.
    // Вывод: мёртвый, но вызываемый из консоли (dvor._playRoulette()) эксплойт — читер мог
    // получить любую награду слота (вплоть до джекпота) без реального синего поинта и без
    // обращения к серверу. Удалена целиком, как и dvor-cards.js в своё время.

    // ── Новый экран рулетки — оркестратор ────────────────────────────────────

    proto._openRouletteScreen = function(){
        if(!this._roulWin) this._buildRouletteScreen();
        root.layer2_mc.addChild(this._roulWin);
        // 24.09.2026 (по прямому указанию — "игры должны открываться поверх Двора, а не
        // Главного, фон Двора при этом затемнён"): раньше _dvorWrap прятался целиком
        // (visible=false) — экран игры визуально подменял собой ВСЮ сцену, и позади него
        // оказывался не Двор, а что бы ни было на layer1_mc под ним. Теперь лобби Двора
        // остаётся ВИДИМЫМ (просто затемнённым и некликабельным) позади экрана игры — тот же
        // приём, что и раньше (interactiveChildren=false), плюс alpha вместо полного скрытия.
        // См. подробный разбор бага "фон двоится" (22.09.2026) в dvor-dice.js._openDiceScreen()
        // — затемнение попутно решает и его: тусклая нестыковка на стыке краёв куда менее
        // заметна, чем яркая.
        if(this._dvorWrap){ this._dvorWrap.alpha = 0; this._dvorWrap.interactiveChildren = false; }
        this._updateRouletteUI();
        if(window.iface) iface.restoreHud();

        // Живая сумма джек-пота — раньше нигде не запрашивалась (roulette.status на сервере
        // существовал, но клиент его не вызывал вообще), поэтому при открытии экрана всегда
        // показывалась захардкоженная стартовая сумма, пока не раскрутишь колесо хоть раз.
        if(window.TS){
            TS.php('roulette.status', {}, (res)=>{
                this._roulJackpotPool = (res && res.jackpot_pool != null) ? parseInt(res.jackpot_pool) : 3000;
                console.log('[dvor-roulette._openRouletteScreen] jackpot_pool с сервера:', this._roulJackpotPool);
                this._updateRouletteUI();
                this._updateRoulettePityTxt(res);
            }, (e)=>{ console.error('[dvor-roulette._openRouletteScreen] ошибка roulette.status:', e); });
        }
    };

    // 25.09.2026 (по прямому указанию — "показывай сбоку количество игр до комбинации"):
    // res — любой ответ сервера с spin_counter/spin_threshold (roulette.status() и
    // roulette.spin() оба возвращают эти поля в одном формате, spin() — уже актуальные после
    // возможного сброса при реальном джекпоте, см. roulette.php).
    proto._updateRoulettePityTxt = function(res){
        if(!this._roulPityTxt || !res) return;
        const counter = parseInt(res.spin_counter, 10) || 0;
        const threshold = parseInt(res.spin_threshold, 10) || 0;
        this._roulPityTxt.text = 'До джекпота: ' + counter + '/' + threshold;
    };

    proto._closeRouletteScreen = function(){
        if(this._roulBuyWin && this._roulBuyWin.parent) this._roulBuyWin.parent.removeChild(this._roulBuyWin);
        if(this._roulWin && this._roulWin.parent) this._roulWin.parent.removeChild(this._roulWin);
        if(this._dvorWrap){ this._dvorWrap.alpha = 1; this._dvorWrap.interactiveChildren = true; }
    };

    proto._updateRouletteUI = function(){
        // Джек-пот — реальная сумма (jackpot_pool на сервере), растущая на 10р (цену
        // поинта) за каждый спин по ТЗ ("В рулетке копится джекпот из трат на поинты").
        // Раньше здесь была захардкожена стартовая сумма 3000 и НИКОГДА не менялась —
        // это скрывало не только "сколько спинов осталось до джек-пота" (что и правда не
        // должно быть видно игроку), но и саму накопленную сумму (что видно быть должно —
        // это и есть весь смысл растущего джек-пота). Число обновляется через
        // roulette.status (при открытии экрана) и roulette.spin (после каждого спина).
        if(this._roulJackTxt) this._roulJackTxt.text = (this._roulJackpotPool || 3000).toLocaleString('ru-RU');

        try {
            const w = helper.safeParseJSON(udata['roulette_winner'], null);
            if(w && w.name){
                if(this._roulWinnerNameTxt) this._roulWinnerNameTxt.text = w.name;
                if(this._roulWinnerAmtTxt)  this._roulWinnerAmtTxt.text  = String(w.amount) + 'р';
                // 23.09.2026 (по прямому указанию — "вставляй изображение игрока, который выбил
                // джекпот"): резолвим настоящее фото по VK id (тот же приём, что уже резолвит
                // топ-3 боя с боссом, см. bosses-combat.js._resolveVkUsers). Кэш по id — не
                // дёргаем VK API повторно на каждый _updateRouletteUI() (вызывается часто:
                // открытие экрана, после каждого спина), только когда победитель реально сменился.
                // 03.10.2026 (по прямому указанию — "заглушка-иконка сталкера нигде не нужна"):
                // до резолва / если id нет (старые записи roulette_winner без id) спрайт остаётся
                // пустым и невидимым (см. dvor-roulette-screen.js) — показываем, только когда
                // реально нашли фото.
                if(w.id && this._roulWinnerPhotoId !== w.id && window.bosses && this._roulWinnerPhotoSpr){
                    this._roulWinnerPhotoId = w.id;
                    bosses._resolveVkUsers([w.id], (users) => {
                        const u = users[String(w.id)];
                        if(u && u.photo && this._roulWinnerPhotoSpr){
                            this._roulWinnerPhotoSpr.texture = PIXI.Texture.from(u.photo);
                            this._roulWinnerPhotoSpr.visible = true;
                        }
                    });
                }
            }
        } catch(e){}

        const pts = parseInt(udata['blue_points'] || 0);
        if(this._roulPtsTxt) this._roulPtsTxt.text = String(pts);

        const sp = parseInt(udata['roulette_spichki'] || 0);
        if(this._roulSpichTxt) this._roulSpichTxt.text = sp.toLocaleString('ru-RU') + ' СПИЧЕК';

        const lvl = this._getLevelInfo('roulette');
        if(this._roulLvlBarFill){
            this._roulLvlBarFill.clear();
            this._roulLvlBarFill.pivot.set(989, 125);
            this._roulLvlBarFill.position.set(989, 125);
            this._roulLvlBarFill.rotation = (2 / 7) * Math.PI / 180; // угол уменьшен в 7 раз по просьбе (было 2°)
            const ratio = lvl.next > 0 ? Math.min(1, lvl.cur / lvl.next) : 0;
            const TRACK_H = 407; const TRACK_BOTTOM = 532; const TRACK_X = 977; const TRACK_W = 23;
            if(ratio > 0){
                // Цвет тут не важен (маска использует только форму/альфу) — реальный "цвет
                // заливки" задаёт tint у levelTrackLit в dvor-roulette-screen.js.
                this._roulLvlBarFill.beginFill(0xffffff, 1);
                const fh = Math.round(TRACK_H * ratio);
                this._roulLvlBarFill.drawRoundedRect(TRACK_X + 2, TRACK_BOTTOM - TRACK_H, TRACK_W - 2 - 1, fh, Math.min(9, fh / 2));
                this._roulLvlBarFill.endFill();
            }
            if(this._roulLvlLitSpr) this._roulLvlLitSpr.visible = ratio > 0;
        }
        if(this._roulLvlTxt) this._roulLvlTxt.text = String(lvl.level || 0);
        if(this._roulNextLvlTxt) this._roulNextLvlTxt.text = String((lvl.level || 0) + 1);
    };

    // 23.09.2026 (по прямому указанию, аудит "что ещё не на сервере" — та же дыра, что уже
    // закрыта для сумки покера/кейса рулетки): стоимость спина и выбор/начисление обычной
    // (не джекпот/не связка) награды раньше считались целиком на клиенте — читер мог вызвать
    // dvor._give('coins', 999999999) напрямую или просто пропустить списание синего поинта.
    // Теперь сервер (roulette.spin) сам проверяет/списывает поинт, сам выбирает slotIdx и сам
    // начисляет валюту обычных 13 слотов — клиент только анимирует колесо до присланного
    // slotIdx и отображает то, что уже пришло в ответе (_resolveRouletteNewScreen ниже).
    proto._spinRoulette = function(){
        if(this._roulSpinning) return;
        // Клиентский пре-чек — только для мгновенной обратной связи без похода на сервер,
        // не авторитетный (реальная проверка — на сервере, код ошибки 50).
        const pts = parseInt(udata['blue_points'] || 0);
        if(pts <= 0){
            if(window.iface) iface._openSidorovichError(
                'Недостаточно синих поинтов!',
                'Для прокрутки рулетки нужен 1 синий поинт. У вас: 0'
            );
            return;
        }

        this._roulSpinning = true;
        if(this._roulResultTxt) this._roulResultTxt.text = '';

        if(!window.TS){ this._roulSpinning = false; return; }
        // 23.09.2026 (по прямому указанию, превентивно — тот же класс логирования, что у
        // блэкджека): сервер (roulette.php) кладёт поле debug в каждый ответ spin/openCase/
        // claimKeyring/openMinigame/pickCup — печатаем раскрытым объектом в консоль.
        console.log('[dvor-roulette._spinRoulette] КЛИК крутить | performance.now()=' + performance.now().toFixed(1) + 'ms Date.now()=' + Date.now());
        // 28.09.2026 (репорт — "опыт/уровень в азартных играх не сохраняется"): предыдущий раунд
        // заканчивается вызовом this._addExp('roulette',1) (dvor.js), который пишет
        // udata['dvor_games_data'] локально и сам зовёт flushPlayerSave(), НЕ дожидаясь
        // завершения. Быстрый повторный спин (особенно авто-режим) мог стартовать roulette.spin()
        // раньше, чем тот flush долетел — сервер читает ПОЛНУЮ строку через Gameops::loadUser()
        // (ещё СО СТАРЫМ dvor_games_data) и в конце пишет её обратно, затирая свежий опыт, если
        // это происходит ПОСЛЕ него. flushPlayerSave() здесь гарантирует, что предыдущий раунд
        // сохранён, ПРЕЖДЕ чем стартует следующий; suspend/resume — что сам spin() (списывает
        // blue_points напрямую) не затрётся встречным автосейвом во время своего окна.
        flushPlayerSave('roulette_spin_flush_prev_exp', () => {
        if(window.suspendPlayerSave) suspendPlayerSave('roulette_spin');
        TS.php('roulette.spin', {}, (res) => {
            // 10.10.2026 (по прямому указанию — ТЗ "игроки не должны видеть счётчик/момент
            // джекпота" + репорт "debug сливается в консоль браузера"): roulette.spin() больше
            // не отдаёт поле debug (убрано на сервере, см. roulette.php) — console.log тоже убран.
            if(!res || !res.patch){
                this._roulSpinning = false;
                if(window.resumePlayerSave) resumePlayerSave('roulette_spin');
                if(window.iface) iface._openSidorovichError('Не удалось прокрутить рулетку', 'Попробуйте ещё раз');
                return;
            }
            this._roulJackpotPool = res.jackpot_pool != null ? parseInt(res.jackpot_pool) : (this._roulJackpotPool || 3000);
            const idx = res.slotIdx;
            this._animRouletteWheel(idx, () => {
                // Приз уже подтверждён сервером, но интерфейс получает его только в момент,
                // когда колесо физически остановилось на выигрышной ячейке.
                applyPatch(res.patch);
                if(window.resumePlayerSave) resumePlayerSave('roulette_spin');
                this._updateRoulettePityTxt(res);
                this._resolveRouletteNewScreen(idx, !!res.jackpot, res.reward, res.clientRewards || []);
            });
        }, (err) => {
            this._roulSpinning = false;
            if(window.resumePlayerSave) resumePlayerSave('roulette_spin');
            if(err && err.code === 50){
                if(window.iface) iface._openSidorovichError('Недостаточно синих поинтов!', 'Для прокрутки рулетки нужен 1 синий поинт.');
            } else {
                if(window.iface) iface._openSidorovichError('Не удалось прокрутить рулетку', 'Попробуйте ещё раз');
            }
        });
        }); // flushPlayerSave('roulette_spin_flush_prev_exp', ...) — см. коммент выше
    };

    // Подключаем sub-модули
    attachRouletteScreen(proto);
    attachRouletteBuy(proto);
    attachRouletteMinigame(proto);
}
