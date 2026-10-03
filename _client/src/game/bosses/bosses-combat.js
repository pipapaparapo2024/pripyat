/** Боссы — боевая логика (атака, поражение, сохранение, таймер). */
import { applyPatch } from '../../modules/patch.js';

export function attachBossesCombat(proto){

    // 28.09.2026 (по прямому указанию — "КД для всех трёх бесплатных видов оружия должен быть
    // общим"): раньше this._freeWpnLastMs[weaponId] хранил НЕЗАВИСИМЫЙ таймстамп на каждое из
    // трёх бесплатных оружий (нож/цепь/бита) — можно было ударить всеми тремя подряд без
    // ожидания. Теперь сервер (bosses.php.attack()) на КАЖДЫЙ удар бесплатным оружием пишет
    // ОДИНАКОВЫЙ $now во все три ключа сразу (см. серверный комментарий у $FREE_WPN_IDS) — этот
    // хелпер берёт МАКСИМУМ среди '0'/'1'/'2', а не просто this._freeWpnLastMs[eqWpn.id], чтобы
    // корректно работать и для игроков, у которых в памяти ещё остались старые асимметричные
    // значения (до первого свежего patch с сервера они выровняются сами через merge-by-max в
    // _saveToUdata() ниже). Общая точка для проверки КД (_attack) и попапа перезарядки
    // (weapon_reload_popup.js) — обе смотрят на один и тот же "общий" таймер.
    proto._freeWpnSharedLastUse = function(){
        let last = 0;
        ['0','1','2'].forEach(k => { last = Math.max(last, parseInt(this._freeWpnLastMs[k]) || 0); });
        return last;
    };

    // 22.09.2026 (по прямому указанию — "перенеси весь бой на сервер: урон, крит, скиллы,
    // банда, расход оружия, кулдаун бесплатного оружия") — вся математика удара (база оружия +
    // тир + Зал оружия + флэт-скилл, крит-ролл, бонус банды, расход патронов/качество экономии
    // на добивающем ударе, кулдаун бесплатного оружия, HP) теперь считает и проверяет СЕРВЕР
    // (bosses.attack, server/core/controllers/bosses.php) — клиент только шлёт НАМЕРЕНИЕ (каким
    // оружием и с каким множителем патронов бьёт) и применяет готовый ответ. Все клиентские
    // предпроверки ниже (кулдаун/патроны/локация/лимит/ключи) остаются как мгновенная UX-
    // подсказка без похода на сервер — но именно СЕРВЕР теперь решает, состоится ли удар:
    // клиентские предпроверки лишь экономят лишний round-trip на заведомо неудачный клик.
    proto._attack = function(){
        const idx = this.selected;
        const d   = this.data[idx];
        if(this._hp(idx) <= 0) return;

        if(!this._isLocCleared(d.boss_loc)){
            const locNames=['Кордон','Свалка','Темная Долина','Агропром','Янтарь'];
            // 18.09.2026 (по прямому указанию): нажатие ПОНЯТНО на этом попапе теперь сразу
            // ведёт на нужную локацию в Зоне, а не просто закрывает окно — не нужно искать её
            // самому среди 5 карточек.
            notify.showResult({text:'Зачисти '+(locNames[d.boss_loc]||'локацию')+' для доступа!'}, 0, () => {
                if(window.iface && typeof iface._closeBossesFight === 'function') iface._closeBossesFight();
                if(window.iface) iface._openZoneScreen(d.boss_loc);
            });
            return;
        }

        const today = this._today();
        if(today !== this.dailyDate){ this.dailyDate=today; this.dailyKills=[0,0,0,0,0,0,0,0]; }
        // 29.09.2026 (репорт игрока — "напал на босса, бесплатный удар битой не нажимается,
        // пишет лимит; убил ~3 из 7, на 4-м боссе бита не бьёт, лимит"): раньше это условие было
        // БЕЗ "this._bossStartMs[...idx]===0" и срабатывало на КАЖДЫЙ клик АТАКОВАТЬ, включая
        // клики внутри уже ИДУЩЕГО, легитимно открытого боя. До 29.09.2026 dailyKills[idx]
        // инкрементировался только по ПОБЕДЕ — тогда счётчик не успевал достичь лимита посреди
        // ещё не завершённой попытки. Но тем же днём семантика изменилась (см.
        // bosses.php.startFight() и tests/boss-daily-attempt-spent-on-any-outcome.test.js):
        // попытка списывается СРАЗУ при СТАРТЕ боя, а не при добивании. Из-за этого в ПОСЛЕДНЕМ
        // разрешённом бою (например, 7-м из 7) dailyKills[idx] уже равен лимиту с самого начала
        // — и это же условие блокировало вообще ЛЮБУЮ атаку внутри уже честно открытого боя,
        // хотя сервер (bosses.php.attack()) дневной лимит на удар вообще не проверяет — гейтит
        // только startFight(). Фикс — та же охрана, что уже стоит у чека ключей строкой ниже:
        // дневной лимит теперь блокирует только ПОПЫТКУ ОТКРЫТЬ НОВЫЙ бой (bossStartMs===0),
        // а не удары внутри уже начатого — источник истины для "можно ли начать" остаётся
        // сервер (startFight() fail 62), эта проверка — лишь мгновенная UX-подсказка до него.
        if(this._bossStartMs[this._diffIdx][idx] === 0 && this.dailyKills[idx] >= this.DAILY_KILL_LIMIT){
            // 29.09.2026: было "убийств" — теперь лимит тратится за любой исход попытки, не
            // только за победу (см. bosses.php.startFight()), текст обновлён вслед за смыслом.
            notify.showResult({text:'Лимит '+this.DAILY_KILL_LIMIT+' попыток на сегодня исчерпан!'}, 0);
            return;
        }

        const keySlot = d.key_slot != null ? d.key_slot : idx;
        if(!this._hasKeyring() && d.keys_needed > 0 && this.keys[keySlot] < d.keys_needed && this._bossStartMs[this._diffIdx][idx] === 0){
            // 29.09.2026 (по прямому указанию — "этот попап возникает когда игрок атакует босса
            // и у него нет ключей, так работает только для тех боссов для которых можно купить
            // ключи — Счастливчик/Ястреб/Меченный"): для боссов с продажей ключей (d.buy_key>0)
            // вместо голого текста показываем попап покупки (иконка ключа + "Купить за N" +
            // кнопка) — тот же приём, что уже есть у "нет оружия" (_openNoWeaponPopup). Для
            // остальных боссов (buy_key===0 — ключи для них можно только выбить с других
            // боссов) поведение не меняется, текстовая ошибка остаётся как раньше.
            if(d.buy_key > 0) this._openBuyKeyPopup(idx);
            else if(window.iface) iface._openSidorovichError('Нужно '+d.keys_needed+' ключей!', 'У вас: '+this.keys[keySlot]);
            return;
        }
        if(this._bossStartMs[this._diffIdx][idx] === 0){
            notify.showResult({text:'Бой не начат!'}, 0);
            return;
        }

        const now = Date.now();
        // Визуальный дедлайн боя (FIGHT_DURATION_MS + замороженный бонус скилла) — та же
        // граница, что и у _updateFightTimer()/_tickBossFightTimer(). Подстраховка на случай,
        // если игрок кликнул АТАКОВАТЬ раньше, чем сработал тик таймера (_onFightTimeout сам
        // идемпотентен). Реальное серверное окно (MAX_FIGHT_WINDOW_MS, щедрее) всё равно
        // проверяется сервером в bosses.attack() — это не дублирование, а UX-подсказка раньше.
        const timeBonus = (this._fightTimeBonusMs && this._fightTimeBonusMs[this._diffIdx])
            ? (this._fightTimeBonusMs[this._diffIdx][idx] || 0) : 0;
        if((now - this._bossStartMs[this._diffIdx][idx]) >= (this.FIGHT_DURATION_MS || 32400000) + timeBonus){
            this._onFightTimeout(idx);
            return;
        }

        const eqWpn = window.weapons ? weapons.data.find(w=>w.equipped) : null;
        if(!eqWpn){
            if(window.iface) iface._openSidorovichError('Не выбрано оружие!', 'Экипируйте оружие в Оружейке');
            return;
        }
        const isFree = !eqWpn.donate;

        if(isFree){
            const lastUse = this._freeWpnSharedLastUse();
            if(lastUse > 0 && (now-lastUse) < this.FREE_WPN_CD_MS){
                // 26.09.2026 (по прямому указанию — попап перезарядки бесплатного оружия с
                // картинками нож/цепь/бита + кнопка «Ускорить за 20»): раньше здесь был только
                // текстовый notify.showResult с КД, теперь полноценный попап (см.
                // shell/overlays/weapon_reload_popup.js), который сам считает и обновляет
                // обратный отсчёт и предлагает сброс КД за монеты через сервер.
                if(typeof this._openWeaponReloadPopup === 'function') this._openWeaponReloadPopup(eqWpn.id);
                else notify.showResult({text:'Бесплатный удар на перезарядке!'}, 0);
                return;
            }
        } else if((parseInt(eqWpn.qty)||0) <= 0){
            if(window.iface && typeof iface._openNoWeaponPopup === 'function') iface._openNoWeaponPopup();
            else notify.showResult({text:'Оружия нет, его нужно купить!'}, 0);
            return;
        }

        const mult = isFree ? 1 : this.multiplier; // учитывает _multOverride (МАКС-режим)
        if(!isFree){
            const availQty = parseInt(eqWpn.qty) || 0;
            if(availQty < mult){
                // 26.09.2026 (по прямому указанию — "при нажатии на кнопку ПОНЯТНО перекидывай
                // в магазин оружия"): тот же переход, что уже использует _openNoWeaponPopup()
                // (кнопка КУПИТЬ, bosses_fight.js) — weapons.open(), просто теперь как onClose
                // попапа ошибки, а не отдельная кнопка.
                notify.showResult({text: eqWpn.name + ': нужно ×' + mult + ', есть ' + availQty + '.'}, 0, () => {
                    if(window.weapons) weapons.open();
                });
                return;
            }
        }

        // Не даём накопить параллельные запросы при быстрой серии кликов — сервер всё равно
        // обработает их строго по очереди, но клиенту незачем открывать больше одного разом.
        if(this._attackInFlight) return;
        this._attackInFlight = true;
        if(!this._fightStart) this._fightStart = now;

        console.log('[bosses-combat._attack] КЛИК удар | performance.now()=' + performance.now().toFixed(1) + 'ms Date.now()=' + Date.now());
        console.log('[bosses-combat._attack] → сервер | boss:', d.name, '| weapon:', eqWpn.name, '| mult:', mult);
        // 24.09.2026 (баг найден по прямому указанию — "не сохраняются ключи/лимиты боссов",
        // подтверждено логами сервера saveVerifyMismatch:true): bosses.attack() пишет bosses_data
        // НАПРЯМУЮ через Gameops::saveUser(), в обход обычного 500мс-автосейва — если ровно в
        // этом окне (клик → ответ сервера) сработает НЕЗАВИСИМЫЙ автосейв (debounce/periodic/
        // hidden), он отправит СТАРЫЙ снимок udata и, если его ответ придёт ПОСЛЕ прямой записи
        // сервера, тихо затрёт её. suspendPlayerSave()/resumePlayerSave() (player-save.js)
        // перекрывают именно это окно — см. большой комментарий там же.
        if(window.suspendPlayerSave) suspendPlayerSave('boss_attack');
        TS.php('bosses.attack', { boss_id: idx, diff_idx: this._diffIdx, weapon_id: eqWpn.id, mult: mult }, (res) => {
            this._attackInFlight = false;
            console.log('[bosses-combat._attack] ← ответ сервера: урон='+res.damage+' крит='+res.critical+' hp='+res.hp+'/'+res.maxHp);
            // 23.09.2026 (по прямому указанию, превентивно — тот же класс логирования, что у
            // блэкджека после репорта "выпала AA хотя pity ещё далеко"): сервер кладёт поле
            // debug в ответ — полная раскладка урона/крита/HP, печатаем раскрытым объектом.
            if(res && res.debug){
                console.log('[bosses-combat._attack] ПОЛНАЯ ТРАССИРОВКА СЕРВЕРА (debug):', res.debug);
                if(res.debug.saveVerifyMismatch) console.error('[bosses-combat._attack] !!! записанное и прочитанное обратно значение разошлись !!!', res.debug);
            }
            // 25.09.2026 (тот же фикс, что в _onDefeat/_onFightTimeout — см. подробный коммент
            // там): applyPatch() ПЕРЕД resumePlayerSave(), иначе отложенный автосейв может уйти
            // со СТАРЫМ udata и затереть то, что attack() только что записал напрямую на сервере
            // (freeWpnCdMs, qty оружия, skills_levels и т.д.) — на каждый удар, самый частый вызов.
            applyPatch(res.patch);
            if(window.resumePlayerSave) resumePlayerSave('boss_attack');
            if(window.weapons) weapons._loadFromUdata(); // подтягивает новый qty оружия из свежего patch
            this._loadFromUdata(); // подтягивает freeWpnCdMs и т.п. из свежего bosses_data
            this._setHp(idx, res.hp); // производный HP с сервера — ПОСЛЕ _loadFromUdata(), чтобы не затёрлось

            // Общий кулдаун — удар ЛЮБЫМ бесплатным оружием ставит на откат ВСЕ три (см.
            // _freeWpnSharedLastUse() выше), не только то, которым ударили.
            if(isFree) ['0','1','2'].forEach(k => { this._freeWpnLastMs[k] = now; });

            // 22.09.2026 (по прямому указанию — "читеры могут делать себе огромное кол-во очков
            // через консоль"): skillsDmgSpent переехал на сервер — bosses.attack() сам копит
            // его и возвращает свежим в patch.skills_levels, клиент больше не считает и не
            // шлёт его сам (раньше — skills.addFightDamage(res.damage)), только перечитывает.
            if(window.skills) skills._loadLevelsFromUdata();
            if(window.achievements) achievements.onDamage();

            // 22.09.2026 (баг найден по прямому указанию — "напал, ударил — у тебя при твоём
            // ударе сразу обновляется рейтинг урона", но по факту рейтинг и полоска скиллов
            // обновлялись только по кнопке ПЕРЕЗАГРУЗИТЬ): сервер честно считает и логирует
            // урон на КАЖДЫЙ удар (boss_damage_log, см. bosses.php.attack()), но здесь, в
            // колбэке ответа, экран боя не перерисовывался вообще — только HP босса в списке/
            // детейле (det.hp_bar/boss_list ниже). _attackWithWeapon() (bosses_fight.js) зовёт
            // эти же функции, но СИНХРОННО сразу после bosses._attack() — то есть ДО того, как
            // придёт этот самый асинхронный ответ сервера, на ещё старых данных. Реальное
            // обновление нужно именно здесь, после applyPatch/_loadLevelsFromUdata выше.
            if(window.iface){
                if(typeof iface._updateBossFightHpDisplay === 'function') iface._updateBossFightHpDisplay();
                if(typeof iface._updateBossFightStats === 'function') iface._updateBossFightStats();
                if(typeof iface._loadBossFightRating === 'function') iface._loadBossFightRating(idx);
            }

            const det = this.win.boss_detail;
            det.reward_txt.text = this._fmt(res.hp) + ' hp';
            det.level_txt.text = d.keys_needed > 0
                ? 'Ключей: '+this.keys[keySlot]+' / '+d.keys_needed
                : 'Ключи не нужны';
            det.hp_bar.setPercent(res.hp / this._maxHp(idx));
            if(this.win.boss_list['item_'+idx])
                this.win.boss_list['item_'+idx].hp_bar.setPercent(res.hp / this._maxHp(idx));

            // 22.09.2026 (баг "урон не отображается во время боя", по прямому указанию) —
            // сервер урон всегда считал и логировал корректно (boss_damage_log), просто нигде
            // не показывался на экране боя. Переиспользуем dvor._showFloatingText (тот же
            // всплывающий текст, что уже есть для облаков сигарет во дворе) над полоской HP
            // (bosses_fight.js: hpBar.x=12 y=142, w=250 → центр x≈136).
            if(window.dvor && typeof dvor._showFloatingText === 'function'){
                dvor._showFloatingText(136, 120, (res.critical ? '💥 ' : '') + '-' + this._fmt(res.damage));
            }

            // 25.09.2026 (по прямому указанию, референс со скриншота похожей игры — "при ударе
            // экран немного краснеет"): чисто визуальная вспышка, свой удар состоялся успешно.
            if(window.iface && typeof iface._flashBossHitScreen === 'function') iface._flashBossHitScreen();

            // 25.09.2026 (по прямому указанию — "эффект критического урона"): res.critical уже
            // посчитан сервером (bosses.php:781-820, critChance от скиллов) — тот же флаг, что
            // уже даёт "💥" в плавающем тексте уроном строкой выше, просто добавлен ещё и
            // визуальный эффект поверх экрана боя.
            if(res.critical && window.iface && typeof iface._showCriticalEffect === 'function') iface._showCriticalEffect();

            this._saveToUdata();
            if(res.hp <= 0) this._onDefeat(idx);
        }, (err) => {
            this._attackInFlight = false;
            if(window.resumePlayerSave) resumePlayerSave('boss_attack');
            console.error('[bosses-combat._attack] ← ошибка сервера:', JSON.stringify(err));
            const MSGS = {
                65: 'Бой не начат — откройте экран боя заново',
                66: 'Бой уже протух — начните заново',
                87: 'Недостаточно оружия/патронов на этот удар',
                88: 'Кулдаун бесплатного удара ещё не истёк',
                89: 'Оружие не куплено',
            };
            notify.showResult({text: (err && MSGS[err.code]) || 'Не удалось нанести удар'}, 0);
        });
    };

    // Автоматический выход из боя по истечении таймера — раньше по факту НИЧЕГО не
    // происходило само по себе: только тихий сброс HP при следующем клике АТАКОВАТЬ
    // (внутри _attack()), а если игрок просто смотрел на 00:00:00 и не жал ничего —
    // экран боя оставался открытым как ни в чём не бывало (репорт: "время истекло, но
    // по итогу ничего не произошло"). Вызывается из ОБОИХ мест, где тикает таймер боя
    // (_updateFightTimer здесь и _tickBossFightTimer в bosses_fight.js) — идемпотентен:
    // повторный вызов после первого видит _bossStartMs===0 и ничего не делает.
    // Скиллы — отдельный оверлей (root.layer2_mc), открывается напрямую через skills.open()
    // из кнопки внутри боя (bosses_fight.js._ensureExtraButtons), в обход общего
    // openModule()/_closeAllPanels() — у Skills нет публичного close(), только внутренний
    // win.visible=false по крестику (skills.js._buildWin). Если бой завершается (таймаут/
    // поражение/победа), пока игрок смотрит на скиллы, экран скиллов должен закрыться вместе
    // с боем — репорт 17.09.2026: "время закончилось, попап показался, но вкладка скиллы
    // осталась открытой поверх".
    proto._closeSkillsIfOpen = function(){
        if(window.skills && skills._win) skills._win.visible = false;
    };

    proto._onFightTimeout = function(idx){
        const d = this.data[idx];
        if(this._bossStartMs[this._diffIdx][idx] === 0) return; // уже обработано
        // 29.09.2026 (репорт игрока со скриншотами — "не удалось засчитать победу (возможно,
        // исчерпан дневной лимит)" СРАЗУ следом за попапом "ТЫ ПРОИГРАЛ" на бою, который по
        // факту был выигран): гонка между этим таймаутом и _onDefeat()/claimKill(). Если
        // добивающий удар довёл HP до 0 ПРЯМО НА ГРАНИЦЕ дедлайна боя (FIGHT_DURATION_MS),
        // _onDefeat() уже запустил claimKill() и ждёт ответ сервера — но this._bossStartMs
        // сбрасывается ТОЛЬКО внутри колбэка claimKill() (успех/ошибка), а не сразу. Пока
        // claimKill() летит туда-обратно, this._bossStartMs[idx] всё ещё ненулевой — 1-секундный
        // тик таймера (_tickBossFightTimer, bosses_fight.js) видел remain===0 и звал ЭТОТ метод
        // без какой-либо проверки на "claimKill уже в полёте". Итог: endFightSession() успевал
        // отработать и обнулить бой на сервере ДО того, как ответ claimKill() долетал обратно —
        // claimKill() находил bossStartMs<=0 на сервере и отказывал (fail 65/66, клиент ошибочно
        // подписывает это как "дневной лимит" — общий текст для любого отказа claimKill, см.
        // комментарий у MSGS в _onDefeat ниже), а бой уже был записан как ПОРАЖЕНИЕ, хотя игрок
        // реально добил босса первым. Фикс: ждём исхода claimKill() (тот же _claimKillPending,
        // что уже гасит гонку _attack()/_syncFriendsDamage() — см. комментарий в _onDefeat) —
        // после ЛЮБОГО исхода claimKill() bossStartMs уже обнулён им самим, и обычный чек выше
        // (bossStartMs===0) естественно погасит эту функцию на следующем тике без дублирования.
        const pendingKeyGuard = this._diffIdx + '_' + idx;
        if(this._claimKillPending && this._claimKillPending[pendingKeyGuard]){
            console.log('[bosses-combat._onFightTimeout] claimKill уже в полёте для boss=' + idx + ' diff=' + this._diffIdx + ' — таймаут отложен до его исхода (гонка с добивающим ударом на границе дедлайна)');
            return;
        }
        this._closeSkillsIfOpen();
        console.log('[bosses-combat._onFightTimeout] время боя истекло автоматически | boss:', d && d.name,
            '| idx:', idx, '| diffIdx:', this._diffIdx);
        // Запоминаем ДО сброса — попапу поражения (18.09.2026, новый дизайн) нужно показать,
        // сколько HP оставалось у босса на момент истечения времени.
        const diffIdxAtLoss = this._diffIdx;
        const hpLeftAtLoss  = this._hp(idx);
        const maxHpAtLoss   = this._maxHp(idx);
        this._setHp(idx, this._maxHp(idx));
        this._bossStartMs[this._diffIdx][idx] = 0;
        if(this.friendDmgApplied) this.friendDmgApplied[this._diffIdx][idx] = 0;
        if(Array.isArray(this._curCycleDmg)) this._curCycleDmg[idx] = 0;
        if(this._fightTimeBonusMs && this._fightTimeBonusMs[this._diffIdx]) this._fightTimeBonusMs[this._diffIdx][idx] = 0;
        this._fightStart = null;
        // Время вышло без победы — тоже «выход из боя без левелапа», обнуляем прогресс скиллов.
        // 22.09.2026: resetSession() ниже — только МГНОВЕННАЯ оптимистичная реакция UI (прогресс
        // скиллов теперь server-authoritative, см. skills_levels.dmgSpent) — реальный откат (если
        // левелапа не было) делает сервер в bosses.endFightSession(), ответ которого перечитывает
        // skills._loadLevelsFromUdata() и подтверждает/поправляет то, что клиент угадал локально.
        if(window.skills) skills.resetSession();

        // 24.09.2026 (баг "на попапе поражения висит чужой/давний урон", по прямому указанию +
        // скриншот): попап результата раньше показывался СРАЗУ (до ответа endFightSession) и
        // вообще не получал top — панель "УЧАСТНИКИ БОЯ" молча показывала то, что осталось от
        // ПРЕДЫДУЩЕГО открытия попапа (PIXI-строки переиспользуются). Теперь показ попапа
        // отложен до ответа сервера (тот же принцип, что уже у победного пути — там тоже ждут
        // res.top), а сам эндпоинт передаёт boss_id/diff_idx, чтобы сервер посчитал top ДО
        // сброса bossStartMs. suspendPlayerSave() вокруг всего окна — та же защита от гонки с
        // параллельным flushPlayerSave, что уже есть у bosses.attack/claimKill (см. player-save.js).
        const _finishTimeoutUi = (top) => {
            this._saveToUdata();
            // 19.09.2026 (репорт "не сохраняются данные боевки босса"): _saveToUdata() выше
            // только обновляет udata['bosses_data'] В ПАМЯТИ — реальная отправка на сервер шла
            // ТОЛЬКО через общий 500мс-дебаунс (player-save.js Proxy) без явного немедленного
            // пуша, в отличие от skills.resetSession()/_endSession(), который сразу зовёт
            // _flushSaveToUdata(). Если игрок закрывал приложение быстрее 500мс после тайм-аута
            // (что как раз вероятно сразу после попапа поражения), HP/таймер/урон боя терялись.
            // Явный немедленный флаш — тот же приём, что уже есть у skills.
            if(window.flushPlayerSave) flushPlayerSave('boss_fight_timeout');
            try{
                if(this.win && this.win.boss_list && this.win.boss_list['item_'+idx])
                    this.win.boss_list['item_'+idx].hp_bar.setPercent(1);
                if(this.selected === idx) this._showDetail(idx);
            } catch(e){ console.error('[bosses-combat._onFightTimeout] ошибка обновления UI списка боссов:', e.message); }

            // Тот же попап/текст, что и у ручного "ВЫЙТИ ИЗ БОЯ" (bosses_fight._forfeitBossFight) —
            // единообразно для игрока: оба пути — поражение, ключи потрачены.
            // ВАЖНО: сначала закрываем боёвку и открываем список боссов, и только ПОСЛЕ этого
            // показываем попап ошибки — оба добавляются в root.layer2_mc, и кто добавлен
            // ПОСЛЕДНИМ, тот и рисуется сверху. Раньше попап показывался ПЕРВЫМ, а следом
            // открывался экран выбора боссов поверх него — попап физически лежал под ним и
            // становился виден только после того, как игрок сам закрывал и боёвку, и список
            // боссов (репорт: "попап появился только когда вышел из вкладки боевки, а потом
            // и с выбора боссов").
            if(window.iface && typeof iface._closeBossesFight === 'function') iface._closeBossesFight();
            if(window.iface && typeof iface._openBossesPopup === 'function') iface._openBossesPopup();
            // 18.09.2026 (новый дизайн попапа результата боя, по PSD): вместо простого текстового
            // notify — тот же боссо-специфичный попап, что и при победе, но с баннером ПРОИГРАЛ
            // и остатком HP босса на момент истечения времени. Добавляется ПОСЛЕДНИМ (после
            // _closeBossesFight/_openBossesPopup выше) — см. комментарий про z-order.
            if(window.iface && typeof iface._showBossResultPopup === 'function'){
                iface._showBossResultPopup({
                    bossIdx: idx, diffIdx: diffIdxAtLoss, isWin: false,
                    hpLeft: hpLeftAtLoss, maxHp: maxHpAtLoss, top: top,
                });
            } else if(window.notify){
                notify.showResult({text:'Поражение! Бой окончен, ключи потрачены.'}, 0);
            }
        };

        if(window.TS){
            if(window.suspendPlayerSave) suspendPlayerSave('boss_end_fight_timeout');
            TS.php('bosses.endFightSession', {boss_id: idx, diff_idx: diffIdxAtLoss}, (res) => {
                // 25.09.2026 (баг найден по прямому указанию + логам сервера — "сброс КД
                // бесплатного оружия по концу боя всё ещё не работает"): resumePlayerSave() раньше
                // вызывался ДО applyPatch() — если во время полёта запроса что-то поставило
                // автосейв в очередь (pendingFlushOnResume=true), resumePlayerSave() немедленно
                // шлёт flushPlayerSave() СО СТАРЫМ udata (ещё без applyPatch), затирая обратно
                // только что очищенный сервером freeWpnCdMs. Фикс — applyPatch() ПЕРЕД
                // resumePlayerSave() (см. тот же фикс в _onDefeat() выше).
                applyPatch(res.patch);
                if(window.resumePlayerSave) resumePlayerSave('boss_end_fight_timeout');
                // 25.09.2026 (РЕВЕРТ по прямому указанию — "верни ту механику"): endFightSession()
                // только что сбросил freeWpnCdMs на сервере (см. bosses.php) и applyPatch() выше
                // уже применил это к udata['bosses_data']. Но _finishTimeoutUi() ниже зовёт
                // this._saveToUdata(), которая МЁРДЖИТ freeWpnCdMs с this._freeWpnLastMs (см.
                // защиту от 24.09.2026) — если не очистить in-memory снимок здесь, мёрдж (максимум
                // таймстампа) тут же воскресит только что сброшенный сервером кулдаун. Очищаем
                // ПОСЛЕ applyPatch, ДО _saveToUdata — тогда мёрджить нечего, сброс сохраняется.
                this._freeWpnLastMs = {};
                if(window.skills) skills._loadLevelsFromUdata();
                _finishTimeoutUi(Array.isArray(res.top) ? res.top : []);
            }, (err) => {
                if(window.resumePlayerSave) resumePlayerSave('boss_end_fight_timeout');
                console.error('[bosses-combat._onFightTimeout] ошибка endFightSession (некритично — прогресс скиллов синхронизируется при следующем действии):', JSON.stringify(err));
                _finishTimeoutUi([]);
            });
        } else {
            _finishTimeoutUi([]);
        }
    };

    // Аудит 17.09.2026 (перенос экономики на сервер, шаг 2 — Боссы, облегчённый вариант по
    // прямому указанию): урон за удар по-прежнему считает клиент (оружие/скиллы/криты/патроны
    // не переносились — это отдельный, значительно больший фронт). Но когда HP дошло до 0,
    // клиент больше НЕ начисляет награду сам — только просит сервер (bosses.claimKill,
    // boss_id/diff_idx), сервер сам проверяет дневной лимит убийств и сам считает
    // сигареты/опыт/ключи/очки рюкзака/прогресс хаты по server/json/bosses_config.json
    // (сверен построчно с этими же таблицами bosses.js при переносе).
    proto._onDefeat = function(idx){
        const diffIdx = this._diffIdx;
        // 25.09.2026 (баг найден по прямому указанию — "после убийства босса вылезает попап
        // 'не удалось засчитать победу', при этом за ним попап 'победа над боссом'"): _onDefeat
        // вызывается из ДВУХ независимых мест — _attack() (личный добивающий удар, hp<=0 в
        // ответе сервера) и _syncFriendsDamage() (периодический автоопрос производного HP, пока
        // открыт экран боя, см. bosses_fight.js._tickBossFightTimer). Если добивающий удар и
        // очередной тик автоопроса пересеклись по времени (оба видят hp<=0 почти одновременно),
        // ОБА запускали claimKill() — сервер честно принимает только первый запрос, второй
        // получает отказ (боя уже нет / лимит), отсюда и всплывали оба попапа разом. Guard —
        // простой флаг "запрос уже летит для этого boss+diff", сбрасывается в success/error
        // колбэках claimKill ниже, а не оставляем try/catch — состояние гонки нужно закрыть
        // синхронно ДО первого await, иначе второй вызов успеет проскочить проверку.
        this._claimKillPending = this._claimKillPending || {};
        const pendingKey = diffIdx + '_' + idx;
        if(this._claimKillPending[pendingKey]){
            console.log('[bosses-combat._onDefeat] claimKill уже в полёте для boss=' + idx + ' diff=' + diffIdx + ' — повторный вызов проигнорирован (гонка _attack()/_syncFriendsDamage())');
            return;
        }
        this._claimKillPending[pendingKey] = true;

        this._closeSkillsIfOpen();
        const d = this.data[idx];
        const isSolo = this._diffIdx === 3;
        const fightMs = this._fightStart ? Date.now()-this._fightStart : 99999999;
        this._fightStart = null;

        console.log('[bosses-combat._onDefeat] босс повержен, запрос награды → сервер | boss:', d && d.name,
            '| idx:', idx, '| diffIdx:', diffIdx, '| fightMs:', fightMs);

        // Победа — урон этой попытки засчитывается насовсем (левелап был или нет — решает
        // сервер в claimKill()._finalizeSkillSession(), см. bosses.php). resetSession() здесь —
        // только мгновенная оптимистичная реакция UI, реальное значение придёт с patch ниже.
        if(window.skills){ skills.endFight(); skills.resetSession(); }

        if(!window.TS){
            console.error('[bosses-combat._onDefeat] window.TS недоступен, награда не может быть запрошена');
            return;
        }

        // 23.09.2026 (баг найден по прямому указанию — "не сохраняются ключи на боссов, урон
        // сбрасывается после перезагрузки"): тот же класс гонки, что уже чинили для старта боя
        // (см. flushPlayerSave('boss_start_fight', ...) в bosses_fight.js._openBossesFight) —
        // claimKill() был ЕДИНСТВЕННЫМ местом, начисляющим ключи/сбрасывающим bossStartMs, без
        // этой же защиты. bosses_data — client-writable поле (users.php $allowed, без валидации,
        // см. аудит 23.09.2026) — если где-то уже стоял в очереди 500мс-дебаунс автосейва со
        // СТАРЫМ udata['bosses_data'] (снимок ДО победы: ключ ещё не начислен, bossStartMs ещё
        // активен), он мог долететь до сервера ПОСЛЕ claimKill() и молча затереть свежую запись
        // — игрок терял выданный ключ, а бой выглядел "всё ещё активным"/при перезагрузке.
        // Ждём флаша ПЕРЕД запросом claimKill — гарантированно никакой устаревший снимок не
        // перезапишет то, что claimKill() вот-вот запишет.
        //
        // 24.09.2026 (тот же баг, повторное подтверждение логами сервера saveVerifyMismatch:
        // true — флаш ПЕРЕД запросом защищал только от УЖЕ стоявшего в очереди сейва, но не от
        // НОВОГО автосейва, который мог запланироваться и сработать, ПОКА сам claimKill летит
        // туда-обратно): suspendPlayerSave() перекрывает всё окно запроса целиком, resumePlayerSave()
        // снимается в ОБОИХ колбэках (успех и ошибка) ниже.
        console.log('[bosses-combat._onDefeat] КЛИК/авто-запрос claimKill | performance.now()=' + performance.now().toFixed(1) + 'ms Date.now()=' + Date.now());
        flushPlayerSave('boss_claim_kill', () => {
        if(window.suspendPlayerSave) suspendPlayerSave('boss_claim_kill');
        TS.php('bosses.claimKill', {boss_id: idx, diff_idx: diffIdx}, (res) => {
            this._claimKillPending[pendingKey] = false;
            console.log('[bosses-combat._onDefeat] ← ответ сервера:', JSON.stringify(res));
            if(res && res.debug){
                console.log('[bosses-combat._onDefeat] ПОЛНАЯ ТРАССИРОВКА СЕРВЕРА (debug):', res.debug);
                if(res.debug.saveVerifyMismatch) console.error('[bosses-combat._onDefeat] !!! записанное и прочитанное обратно значение разошлись !!!', res.debug);
            }
            if(!res || !res.patch || !res.reward){
                console.error('[bosses-combat._onDefeat] некорректный ответ сервера (нет patch/reward), награда НЕ применена:', JSON.stringify(res));
                notify.showResult({text:'Не удалось получить награду — попробуйте открыть экран боссов заново'}, 0);
                if(window.resumePlayerSave) resumePlayerSave('boss_claim_kill');
                return;
            }

            // 25.09.2026 (баг найден по прямому указанию + логам сервера — "сброс КД бесплатного
            // оружия по концу боя всё ещё не работает"): сервер логи подтвердили, что claimKill()
            // САМ ПИШЕТ freeWpnCdMs:[] корректно (sessionVerifiedFromDbAfterSave подтверждает) —
            // но resumePlayerSave() раньше вызывался ЗДЕСЬ, ДО applyPatch(). Если во время полёта
            // запроса (suspendPlayerSave...await...) что-либо ещё поставило автосейв в очередь
            // (pendingFlushOnResume=true — например тик регенерации энергии), resumePlayerSave()
            // немедленно шлёт flushPlayerSave() СО СТАРЫМ udata (ещё без applyPatch ниже) —
            // users.save тут же перезаписывает обратно только что очищенный сервером freeWpnCdMs
            // (и потенциально любое другое поле bosses_data) устаревшим клиентским снимком. Тот
            // же класс гонки, что уже чинили для bossStartMs/keys — просто в другом месте кода.
            // Фикс: applyPatch() ПЕРЕД resumePlayerSave() — если отложенный флаш сработает сразу
            // по выходу из suspend, он отправит уже АКТУАЛЬНЫЙ (пропатченный) udata.
            applyPatch(res.patch);
            if(window.resumePlayerSave) resumePlayerSave('boss_claim_kill');
            if(window.skills) skills._loadLevelsFromUdata();
            iface.updateNick();

            const rew = res.reward;
            const keysGranted = Array.isArray(res.keysGranted) ? res.keysGranted : [];

            // Синхронизируем СОБСТВЕННОЕ in-memory состояние Bosses с тем, что сервер только
            // что сохранил в bosses_data — иначе до следующей полной перезагрузки страницы
            // (_loadFromUdata) client-side this.keys/this.killsTotal разошлись бы с уже
            // сохранённой на сервере правдой.
            keysGranted.forEach(nextIdx => { this.keys[nextIdx] = (this.keys[nextIdx]||0) + 1; });
            // 29.09.2026 (см. большой коммент в bosses.php.startFight() — "лимиты атак не
            // заканчиваются"): dailyKills (попытки) БОЛЬШЕ НЕ инкрементируется тут при победе —
            // сервер уже потратил попытку в startFight(), в момент старта, а не здесь, и клиент
            // уже синхронизировал this.dailyKills[idx] тогда же (bosses_fight.js._openBossesFight).
            // Повторный инкремент здесь задвоил бы счётчик на клиенте (сервер бы всё равно
            // прислал верное значение только при следующей полной перезагрузке).
            this.killsTotal[idx] = (this.killsTotal[idx] || 0) + 1;
            if(Array.isArray(this._curCycleDmg)) this._curCycleDmg[idx] = 0;
            if(this.friendDmgApplied) this.friendDmgApplied[diffIdx][idx] = 0;
            this._bossStartMs[diffIdx][idx] = 0;
            // Freeze both result views on the final server snapshot of this fight.
            if(iface._bossFightBossIdx === idx && iface._bossFightDiffIdx === diffIdx && typeof iface._showBossFightRating === 'function'){
                const rows = iface._bossFightRatingRows;
                iface._showBossFightRating(Array.isArray(res.top) ? res.top : [], () => iface._bossFightRatingRows === rows && this._bossStartMs[diffIdx][idx] === 0);
            }
            if(this._fightTimeBonusMs && this._fightTimeBonusMs[diffIdx]) this._fightTimeBonusMs[diffIdx][idx] = 0;
            this._setHp(idx, typeof res.maxHp === 'number' ? res.maxHp : this._maxHp(idx));

            if(window.achievements) achievements.onBossKill(idx, isSolo, fightMs);
            if(window.battlepass) battlepass.addXp(50 + idx * 25);

            const keysMsg = (diffIdx<2 && keysGranted.length) ? '  🔑 Ключ получен' : '';

            try{
                if(this.win && this.win.boss_list && this.win.boss_list['item_'+idx])
                    this.win.boss_list['item_'+idx].hp_bar.setPercent(1);
                if(this.selected === idx) this._showDetail(idx);
            } catch(e){}

            // Переходим к выбору боссов только после получения награды.
            let _redirected = false;
            const _doRedirect = ()=>{
                if(_redirected) return; _redirected = true;
                clearTimeout(this._defeatTimer);
                // 29.09.2026 (по прямому указанию, репорт — "убившим должен считаться тот, кто
                // ПОСЛЕДНИМ вышел с попапа победы, а не тот, у кого HP босса первым упало до
                // 0"): recordKill() раньше вызывался в НАЧАЛЕ _onDefeat() — сразу при hp<=0 в
                // ответе bosses.attack(), ДО того, как claimKill() вообще подтвердил победу, и
                // ДО того, как игрок хоть раз увидел этот попап. Перенесено сюда — единственную
                // общую точку выхода из попапа результата боя (boss_result.js зовёт opts.onClose
                // на ВСЕХ трёх путях закрытия: ЕЩЁ РАЗ, кнопка выхода, ЕЩЁ РАЗ-с-отказом по
                // лимиту/ключам — см. комментарии там же). "Последний вышел — тот и убивший"
                // теперь буквально означает "последний вызов recordKill долетел до сервера
                // последним" (bosses.php.recordKill — ON DUPLICATE KEY UPDATE, последняя запись
                // побеждает), а не "у кого раньше сервер посчитал HP=0". _redirected-гвард выше
                // уже гарантирует ровно один вызов на весь показ попапа, второй раз сюда не
                // попадём даже при повторном/двойном закрытии.
                //
                // 29.09.2026 (баг найден по прямому указанию — "моё фото не всегда сразу первое
                // в рамке УБИВШИЙ после победы"): recordKill() ниже — fire-and-forget, если
                // игрок тут же открывает список боссов, bosses.killers иногда успевает
                // спросить сервер РАНЬШЕ, чем этот запрос реально долетел и записался (см.
                // bosses_select.js — там читает _lastOwnKill и подставляет себя, пока серверная
                // запись не догонит по killed_at). uid не нужен — читатель сверяет ТОЛЬКО свой
                // собственный vk_user_id.
                this._lastOwnKill = this._lastOwnKill || {};
                this._lastOwnKill[idx] = Math.floor(Date.now() / 1000);
                if(window.TS) TS.php('bosses.recordKill', {boss_id: idx}, null, null);
                if(window.iface && iface._rewardWin && iface._rewardWin.parent){
                    iface._rewardWin.parent.removeChild(iface._rewardWin);
                    iface._rewardWin = null;
                }
                if(window.iface && typeof iface._closeBossesFight === 'function') iface._closeBossesFight();
                if(window.iface && typeof iface._openBossesPopup === 'function') iface._openBossesPopup();
            };

            // 22.09.2026 (по прямому указанию, финальная сверка полного присланного списка
            // сетов — "почти все шмотки достаются с боссов"): claimKill может вернуть
            // bossShmotItemId (персональная вещь ЭТОГО босса собрана целиком именно сейчас)
            // или bossShmotFragment ({id,have,need} — добавлен один фрагмент, вещь сета "ссср"
            // ещё не готова). Резолвим название по локальному каталогу game/shmot.js (id —
            // общий источник правды с сервером, см. bosses_config.json.boss_shmot_drop_pool).
            //
            // 23.09.2026 (по прямому указанию, репорт "попап ошибки для фрагмента шмотки не
            // нужен, попап победы уже показывает иконку"): раньше здесь показывался ОТДЕЛЬНЫЙ
            // toast через notify.showResult(text, 0) — этот флаг (0) рисует именно ЭКРАН ОШИБКИ
            // (фон "попап ошибка.png", кнопка "понятно") — баг, а не сознательный выбор (info-
            // режим, флаг 1, вообще ничего не рисует — прошлый дизайн отклонён, см. notifications.js).
            // Toast убран целиком — вместо него boss_result.js показывает подсказку по наведению
            // на иконку шмотки прямо в попапе победы (см. shmotWonName/shmotFragment.name ниже).
            let shmotWonName = null;
            if(window.shmot && Array.isArray(shmot.items)){
                if(res.bossShmotItemId != null){
                    const wonIt = shmot.items.find(x => x.id === res.bossShmotItemId);
                    if(wonIt){
                        // applyPatch() выше уже обновил udata['shmot'] (JSON-строку), но НЕ
                        // перечитывает window.shmot.items в память — тот же паттерн, что уже
                        // используется для res.shmotGranted в yashik.js.collectReward().
                        wonIt.owned = true;
                        shmotWonName = wonIt.name;
                    }
                } else if(res.bossShmotFragment && res.bossShmotFragment.id != null){
                    const fragIt = shmot.items.find(x => x.id === res.bossShmotFragment.id);
                    if(fragIt){
                        // Тултип магазина (shmot_shop.js._showShopTip) читает shmot.fragmentsProgress
                        // напрямую — обновляем тут же, не дожидаясь следующего _loadFromUdata().
                        if(!shmot.fragmentsProgress) shmot.fragmentsProgress = {};
                        shmot.fragmentsProgress[res.bossShmotFragment.id] = res.bossShmotFragment.have;
                        res.bossShmotFragment = { ...res.bossShmotFragment, name: fragIt.name };
                    }
                }
            }

            // 18.09.2026 (новый дизайн попапа результата боя, по PSD): вместо общего
            // iface._showRewardPopup() (карточки-иконки) теперь показывается боссо-специфичный
            // попап с портретом босса, баннером ПОБЕДИЛ, рейтингом урона и кнопками ЕЩЁ РАЗ/
            // РАССКАЗАТЬ — см. shell/popups/boss_result.js. Общий попап остаётся как раньше
            // для зоны/ящика/хабара/рюкзака.
            if(window.iface && typeof iface._showBossResultPopup === 'function'){
                iface._showBossResultPopup({
                    bossIdx: idx, diffIdx: diffIdx, isWin: true,
                    // 22.09.2026 (баг "на победном экране не видно, сколько HP было у босса"):
                    // раньше maxHp тут был захардкожен в 0 (попап на победе его не использовал),
                    // теперь boss_result.js рисует эту цифру белым текстом на красной полоске
                    // портрета — нужно реальное значение, не 0.
                    cig: rew.cig, exp: rew.exp, ryukzak: rew.ryukzak, hpLeft: 0, maxHp: this._maxHp(idx),
                    // 22.09.2026 (баг "попап победы пустой"): top теперь приходит прямо в ответе
                    // claimKill (посчитан ДО сброса bossStartMs на сервере) — попап больше не
                    // делает свой отдельный запрос bosses.rating после победы (см. boss_result.js).
                    top: Array.isArray(res.top) ? res.top : [],
                    // 29.09.2026 (репорт игрока Flex — "откуда взялась 1000 HP, участники
                    // показывают только 192 урона?"): урон Седого реально снижает HP босса, но
                    // намеренно исключён из top (см. _ratingTop() в bosses.php) — без этого поля
                    // попап никак не объяснял разницу. boss_result.js показывает его отдельной
                    // строкой, ТОЛЬКО когда > 0.
                    sedoyDamage: res.sedoyDamage || 0,
                    // 22.09.2026 (баг "нет дропа/иконки шмота с боссов") — claimKill теперь
                    // личный пул босса может выдать шмотку; applyPatch(res.patch)
                    // выше уже обновил udata['shmot'], здесь только передаём сумму для иконки.
                    shmotAmount: res.shmotAmount || 0,
                    // 22.09.2026 (повторный репорт тем же днём — "когда получается фрагмент
                    // одежды, он тоже должен отображаться на попапе ТЫ ПОБЕДИЛ"): раньше иконка
                    // шмотки показывалась ТОЛЬКО при shmotAmount>0 (собрана ПОЛНАЯ вещь) — сам
                    // фрагмент (прогресс сборки сета "ссср") ничем визуально не отмечался в этом
                    // попапе. 23.09.2026: добавлены shmotWonName/name внутри shmotFragment —
                    // boss_result.js показывает их по наведению на иконку шмотки (см. коммент там).
                    shmotWonName: shmotWonName,
                    // 26.09.2026 (по прямому указанию — "при наведении показывай картинку
                    // выбитой шмотки"): id нужен boss_result.js, чтобы найти реальную картинку
                    // в modules/boss-shmot-images.js (раньше передавалось только имя для текста).
                    shmotWonId: res.bossShmotItemId != null ? res.bossShmotItemId : null,
                    shmotFragment: res.bossShmotFragment || null,
                    onClose: _doRedirect,
                });
            } else {
                notify.showResult({text:'Босс '+d.name+' повержен! +'+rew.cig+' сигарет  +'+rew.exp+' опыта'+keysMsg}, 1, _doRedirect);
            }
            // Награда остаётся открытой до закрытия попапа (ЕЩЁ РАЗ / выход).
        }, (err) => {
            this._claimKillPending[pendingKey] = false;
            if(window.resumePlayerSave) resumePlayerSave('boss_claim_kill');
            // Сервер отказал (чаще всего — код 62, дневной лимит 7 убийств этого босса уже
            // исчерпан) — без обработки игрок застрял бы на экране с HP=0 и без выхода. Сбрасываем
            // HP и бой, как при таймауте (без награды — она и не полагается), и выводим игрока
            // из боя, чтобы экран не завис.
            // Код 67 — производный HP ещё > 0 (не должен срабатывать при честной игре — клиент
            // сюда попадает только когда САМ уже увидел hp≤0, но урон друга мог "откатиться" не
            // так, как ожидалось) — отдельное сообщение, не путаем с дневным лимитом.
            const isHpNotZero = err && err.code === 67;
            console.error('[bosses-combat._onDefeat] ← ошибка сервера claimKill (код ' + (err && err.code) + '):', JSON.stringify(err));
            this._setHp(idx, this._maxHp(idx));
            this._bossStartMs[diffIdx][idx] = 0;
            if(Array.isArray(this._curCycleDmg)) this._curCycleDmg[idx] = 0;
            if(this.friendDmgApplied) this.friendDmgApplied[diffIdx][idx] = 0;
            if(this._fightTimeBonusMs && this._fightTimeBonusMs[diffIdx]) this._fightTimeBonusMs[diffIdx][idx] = 0;
            if(window.skills) skills.resetSession();
            notify.showResult({text: isHpNotZero
                ? 'Бой ещё не завершён — попробуйте снова'
                : 'Не удалось засчитать победу (возможно, исчерпан дневной лимит убийств этого босса). Попробуйте другого босса или завтра.'}, 0);
            if(window.iface && typeof iface._closeBossesFight === 'function') iface._closeBossesFight();
            if(window.iface && typeof iface._openBossesPopup === 'function') iface._openBossesPopup();
        });
        }); // flushPlayerSave('boss_claim_kill', ...)
    };

    // 19.09.2026 → 22.09.2026: здесь раньше жил _resetRatingPeaks()/_ratingPeaks — client-side
    // "пик" урона друга, придуманный против исчезновения из рейтинга при завершении ЧУЖОГО боя.
    // Убран целиком — после переезда рейтинга на boss_damage_log (bosses.php.rating(), см.
    // большой комментарий над _derivedHp() там) урон друга в логе никогда не пропадает сам по
    // себе, пересчитывается заново на каждый запрос по МОЕМУ bossStartMs — кэш не нужен и
    // оказался вреден (показывал протухшие цифры от давно закрытых попыток против ТОГО ЖЕ
    // босса, см. репорт "у босса 1000 HP, у друга в рейтинге 14.4K, хотя бой только начался").

    // 22.09.2026 (по прямому указанию — переезд на boss_damage_log/производный HP, см. большой
    // комментарий в bosses.php над _derivedHp()): раньше здесь жила _seedFriendDmgBaseline() —
    // обходной манёвр против ретроактивного зачёта СТАРОГО урона друга в НОВУЮ попытку боя.
    // Больше не нужен: сервер сам считает урон друга только с момента МОЕГО bossStartMs (SQL
    // `time >= $sinceMs`) — старый урон друга, случившийся ДО начала моей текущей попытки,
    // физически не попадает в SUM(), обходной манёвр не требуется.
    //
    // Подтягивает актуальный производный HP (bosses.friendsDamage) и выставляет его напрямую —
    // используется кнопкой «ПЕРЕЗАГРУЗИТЬ», периодическим автоопросом (пока открыт экран боя,
    // см. bosses_fight.js._tickBossFightTimer) и при повторном открытии уже идущего боя
    // (bosses_fight._openBossesFight). Соло (diffIdx=3) тоже опрашивается — просто друзья туда
    // не подмешиваются (см. bosses.php._derivedHp()).
    proto._syncFriendsDamage = function(bossIdx, callback){
        const diffIdx = this._diffIdx;
        if(!window.TS || this._bossStartMs[diffIdx][bossIdx] === 0){
            if(callback) callback();
            return;
        }
        const startMsAtCall = this._bossStartMs[diffIdx][bossIdx];
        TS.php('bosses.friendsDamage', { boss_id: bossIdx, diff_idx: diffIdx }, (e)=>{
            if(this._diffIdx !== diffIdx || this._bossStartMs[diffIdx][bossIdx] !== startMsAtCall) return;
            const hp = Math.max(0, parseInt(e && e.hp) || 0);
            const prevHp = this._hp(bossIdx);
            console.log('[bosses._syncFriendsDamage] boss='+bossIdx+' diff='+diffIdx+' prevHp='+prevHp+' → hp='+hp);
            if(hp < prevHp){
                this._setHp(bossIdx, hp);
                notify.showResult({text:'Друзья помогли! -'+this._fmt(prevHp-hp)+' HP'}, 1);
                this._saveToUdata();
            } else if(hp !== prevHp){
                this._setHp(bossIdx, hp);
            }
            if(hp <= 0){ this._onDefeat(bossIdx); if(callback) callback(); return; }
            if(callback) callback();
        }, ()=>{ if(callback) callback(); });
    };

    // Резолвит id ВК-пользователей из глобального топа в {id: {name, photo}} — сервер (bosses.rating/
    // bosses.killers) отдаёт только id+число (урон/убийства), имя и фото есть только у VK API,
    // дублировать их в БД незачем. Свой id берём из уже закэшированного window.vk_user_info (не дёргаем
    // API лишний раз), для остальных — один батч-запрос users.get с несколькими user_ids сразу.
    proto._resolveVkUsers = function(ids, callback){
        const out = {};
        const myId = String(vk_params && vk_params['vk_user_id'] || '');
        const rest = [];
        // 22.09.2026 (баг найден по живому репорту — "иконки игроков не выводятся ВООБЩЕ, ни в
        // одном из 3 топов Сводки"): один "битый"/тестовый id (<=0, например у синтетической
        // строки-заглушки в топе) в user_ids батч-запроса users.get заставляет VK API вернуть
        // ошибку на ВЕСЬ запрос целиком (не просто пропустить невалидный id) — из-за этого фото
        // не приходили НИ ДЛЯ КОГО в батче, включая полностью настоящих игроков рядом с битой
        // строкой. Фильтруем невалидные id ДО отправки — реальные id резолвятся нормально
        // независимо от мусора среди них.
        ids.forEach(id => {
            const sid = String(id);
            if(!(parseInt(id, 10) > 0)){
                console.warn('[bosses._resolveVkUsers] пропускаю невалидный id (не резолвится через VK API):', id);
                return;
            }
            if(sid === myId){
                out[sid] = {
                    name:  (window.vk_user_info && vk_user_info['first_name'])
                        ? vk_user_info['first_name'] + (vk_user_info['last_name'] ? ' ' + vk_user_info['last_name'] : '')
                        : 'Ты',
                    photo: (window.vk_user_info && (vk_user_info['photo_50'] || vk_user_info['photo_100'] || vk_user_info['photo_200'])) || null,
                };
                // VKWebAppGetUserInfo НЕ отдаёт поле photo_50 (только photo_100/photo_200) —
                // out[sid].photo здесь почти всегда null. Раньше на этом всё и заканчивалось
                // (серый кружок-плейсхолдер вместо своего фото в "УБИВШИЙ"/рейтинге, даже когда
                // убийцей был сам игрок) — теперь, если фото не пришло, всё равно докидываем
                // свой id в batch-запрос users.get ниже (он поддерживает fields=photo_50 явно).
                if(!out[sid].photo && rest.indexOf(sid) === -1) rest.push(sid);
            } else if(rest.indexOf(sid) === -1){
                rest.push(sid);
            }
        });
        const _doBatchFetch = () => {
            if(!rest.length || !window.bridge || !window.VK_token){
                console.log('[bosses._resolveVkUsers] без доп. запроса, resolved:', Object.keys(out).length);
                callback(out); return;
            }
            console.log('[bosses._resolveVkUsers] запрашиваю users.get | ids:', rest.join(','),
                '| VK_token задан:', !!window.VK_token, '| VK_version:', window.VK_version);
            bridge.sendPromise('VKWebAppCallAPIMethod', {
                method: 'users.get', params: { user_ids: rest.join(','), fields: 'photo_50', access_token: VK_token, v: VK_version }
            }).then(data => {
                console.log('[bosses._resolveVkUsers] сырой ответ VKWebAppCallAPIMethod:', JSON.stringify(data));
                const items = (data && data['response']) || [];
                items.forEach(u => {
                    const sid = String(u.id);
                    // Для своего id имя уже проставлено выше (из vk_user_info/«Ты») — не затираем
                    // его, только докидываем фото, если оно ещё не пришло.
                    if(sid === myId && out[sid] && out[sid].name){
                        if(!out[sid].photo) out[sid].photo = u.photo_50 || null;
                    } else {
                        out[sid] = { name: (u.first_name||'') + (u.last_name ? ' '+u.last_name : ''), photo: u.photo_50 || null };
                    }
                });
                console.log('[bosses._resolveVkUsers] users.get вернул', items.length, 'из', rest.length, 'запрошенных');
                callback(out);
            }).catch(e => {
                console.error('[bosses._resolveVkUsers] ошибка users.get:', e && e.error_data ? JSON.stringify(e.error_data) : e);
                callback(out); // хотя бы свои данные, если они были
            });
        };

        // 03.10.2026 (репорт — "урон от друга засчитан, но его иконка в рейтинге урона не
        // прогружается"): VK_token НЕ персистится между перезагрузками страницы (живёт только в
        // памяти текущей вкладки) — его тихо восстанавливает preloader._scheduleFriendsScopePrompt()
        // ОДИН РАЗ при старте, но это best-effort: если игрок открывает бой/рейтинг раньше, чем
        // та попытка долетела, или сам bridge-запрос один раз сбоит без ретраев — VK_token так и
        // остаётся undefined до конца сессии, и _resolveVkUsers() молча отдаёт пустые фото ВСЕМ,
        // хотя согласие (friends_scope_granted='1') в БД уже есть. Теперь, если токена нет, но
        // согласие подтверждено в БД, лениво дозапрашиваем его прямо здесь (pre_control —
        // синглтон Preloader, см. index.js) — для уже разрешённого scope VK отдаёт токен без
        // системного диалога (тот же приём и то же допущение, что в preloader.js) — и только
        // потом продолжаем batch-запрос фото. Если pre_control уже сам сейчас запрашивает токен
        // (_friendsScopeRequestPending) — не дублируем, просто идём дальше текущим (возможно
        // пустым) состоянием; следующий вызов _resolveVkUsers (периодический опрос рейтинга и
        // т.п.) повторит попытку сам.
        if(rest.length && window.bridge && !window.VK_token &&
           window.udata && String(udata['friends_scope_granted'] || '0') === '1' &&
           window.pre_control && typeof pre_control._requestFriendsScope === 'function' &&
           !pre_control._friendsScopeRequestPending){
            console.log('[bosses._resolveVkUsers] VK_token отсутствует, но friends_scope_granted=1 — дозапрашиваю токен лениво');
            pre_control._requestFriendsScope(() => _doBatchFetch());
            return;
        }
        _doBatchFetch();
    };

    // 26.09.2026 (баг найден при добавлении попапа перезарядки — "читер мог вызвать
    // bosses.resetFreeWeaponCd() из консоли и сбросить КД бесплатно"): раньше эта функция сама
    // проверяла баланс и вычитала рубли ПРЯМО НА КЛИЕНТЕ (udata['coins'] -= cost) без единого
    // запроса на сервер — классическая дыра (см. тот же класс фикса, что уже сделан для
    // weapons.buy/upgrade и bosses.attack, Правило №9). Теперь это тонкая обёртка над серверным
    // _rushFreeWeaponCd() — оставлена как метод (не удалена), потому что старый UI-триггер
    // (_renderCdResetBtn, устаревший экран bosses.js.open(), см. коммент там же — реально нигде
    // не открывается) всё ещё может её вызвать, и других мест вызова быть не должно.
    proto.resetFreeWeaponCd = function(){
        const eqWpn = window.weapons ? weapons.data.find(w=>w.equipped) : null;
        if(!eqWpn){ notify.showResult({text:'Не выбрано оружие!'}, 0); return; }
        this._rushFreeWeaponCd(eqWpn.id);
    };

    // Единая точка серверного сброса кулдауна бесплатного оружия за монеты (20р/шт) — зовётся
    // и из старого resetFreeWeaponCd(), и из попапа перезарядки (weapon_reload_popup.js).
    // Сервер (bosses.rushFreeWeapon) сам проверяет кулдаун и баланс, здесь только round-trip.
    proto._rushFreeWeaponCd = function(weaponId, onSuccess, onError){
        if(this._rushCdInFlight) return;
        if(!window.TS){
            console.error('[bosses-combat._rushFreeWeaponCd] window.TS недоступен, запрос не отправлен');
            return;
        }
        this._rushCdInFlight = true;
        console.log('[bosses-combat._rushFreeWeaponCd] → сервер | weapon_id:', weaponId);
        TS.php('bosses.rushFreeWeapon', { weapon_id: weaponId }, (res) => {
            this._rushCdInFlight = false;
            console.log('[bosses-combat._rushFreeWeaponCd] ← ответ сервера:', JSON.stringify(res));
            if(!res || !res.patch){
                console.error('[bosses-combat._rushFreeWeaponCd] некорректный ответ сервера (нет patch), КД не сброшен');
                return;
            }
            applyPatch(res.patch);
            if(window.iface) iface.updateUp();
            this._loadFromUdata(); // подтягивает обнулённый freeWpnCdMs из свежего bosses_data
            // 21.09.2026 (аудит "достижения появляются с задержкой") — трата рублей на сброс КД
            // тоже проверялась только случайно, при следующем убийстве босса.
            if(window.achievements) achievements._checkAll();
            notify.showResult({text:'Кулдаун сброшен!'}, 1);
            if(onSuccess) onSuccess(res);
        }, (err) => {
            this._rushCdInFlight = false;
            console.error('[bosses-combat._rushFreeWeaponCd] ← ошибка сервера:', JSON.stringify(err));
            // Коды: 50 — недостаточно рублей, 53 — оружие уже не на кулдауне (гонка/устаревший попап).
            if(err && err.code === 50){
                if(window.iface) iface._openSidorovichError('Недостаточно рублей!', 'Нужно: 20 • У вас: ' + (parseInt(udata['coins']||0)));
            } else if(err && err.code === 53){
                notify.showResult({text:'Оружие уже не на перезарядке!'}, 0);
            } else {
                notify.showResult({text:'Не удалось сбросить кулдаун!'}, 0);
            }
            if(onError) onError(err);
        });
    };

    proto._saveToUdata = function(){
        // 24.09.2026: helper.safeParseJSON() — см. большой коммент у неё (universal_helper.js).
        // Раньше здесь был "try{JSON.parse(...)}catch{}", молча превращавшийся в ex={} каждый
        // раз, когда udata['bosses_data'] приходил уже ОБЪЕКТОМ (сразу после users.get) — и
        // тогда ...ex НЕ приносил в мёрдж ниже поля, которых нет в явном списке (bossDamage,
        // personalDamageTotal, instanceStartMs, joinedInstance, friendDmgByUid) — они тихо
        // ТЕРЯЛИСЬ при первом же _saveToUdata() в такой сессии. Не просто баг отображения.
        const ex = helper.safeParseJSON(udata['bosses_data'], {});
        // 24.09.2026 (баг найден по прямому указанию — "кулдаун бесплатного оружия сбрасывается
        // сразу, как только бой закончился любым способом"): раньше freeWpnCdMs просто
        // ПЕРЕЗАПИСЫВАЛСЯ клиентским this._freeWpnLastMs целиком, как и остальные поля выше.
        // Но _freeWpnLastMs — ЧИСТО in-memory JS-объект на инстансе Bosses, который НИГДЕ не
        // синхронизируется обратно из applyPatch(res.patch) в fight-end хендлерах
        // (_onFightTimeout/_forfeitBossFight/_onDefeat/_leaveBossesFight) — applyPatch() меняет
        // только строку udata['bosses_data'], а не this.keys/this._freeWpnLastMs и т.п. (см.
        // явный ручной ресинк this.keys/dailyKills/killsTotal в _onDefeat() чуть выше по файлу —
        // freeWpnCdMs в этот список мануального ресинка тогда не попал). Если сервер только что
        // прислал СВЕЖИЙ freeWpnCdMs (например, кулдаун реально тикает после удара с другого
        // устройства/вкладки) — эта функция, вызываемая сразу после applyPatch() в каждом
        // fight-end хендлере, тут же затирала его УСТАРЕВШИМ клиентским снимком, из-за чего
        // кулдаун "магически" пропадал. Фикс — мёрджим (берём максимум таймстампа на оружие),
        // а не заменяем целиком — та же защита, что уже стоит на сервере в bosses.php.attack()
        // (`$data['freeWpnCdMs'][$weaponId] = $now` пишется В decode-нутый объект, не поверх).
        const exFreeWpnCdMs = (ex.freeWpnCdMs && typeof ex.freeWpnCdMs === 'object') ? ex.freeWpnCdMs : {};
        const mergedFreeWpnCdMs = {...exFreeWpnCdMs};
        Object.keys(this._freeWpnLastMs).forEach(k => {
            mergedFreeWpnCdMs[k] = Math.max(parseInt(mergedFreeWpnCdMs[k]) || 0, parseInt(this._freeWpnLastMs[k]) || 0);
        });
        this._freeWpnLastMs = mergedFreeWpnCdMs; // держим in-memory копию тоже свежей после мёрджа
        udata['bosses_data'] = JSON.stringify({
            ...ex,
            hpByDiff:     this.hpByDiff,
            keys:         this.keys,
            killsTotal:   this.killsTotal,
            dailyKills:   this.dailyKills,
            dailyDate:    this.dailyDate,
            bossStartMs:  this._bossStartMs,
            freeWpnCdMs:  mergedFreeWpnCdMs,
            friendDmgApplied: this.friendDmgApplied,
            curCycleDmg:  this._curCycleDmg,
            fightTimeBonusMs: this._fightTimeBonusMs,
            // 18.09.2026 (найдено при разборе репорта "перезагрузка страницы обрывает бой с
            // боссом"): _diffIdx (выбранная сложность — обычный/опасный/суровый/соло) раньше
            // вообще не сохранялся. Сам бой (HP/таймер/урон) переживал перезагрузку нормально
            // (bossStartMs/hpByDiff и так уже были в этом объекте) — но после reload
            // this._diffIdx конструктором сбрасывался обратно на 0, и bosses_select.
            // _openBossesPopup() (автопереход в бой при открытии экрана боссов) проверял
            // активный бой ТОЛЬКО в bosses._bossStartMs[0], не видя бой, начатый в Опасном/
            // Суровом/Соло — экран боссов открывался пустым, будто бой пропал, хотя все данные
            // были целы. См. также fix ниже в bosses_select.js._openBossesPopup (сканирует
            // теперь все 4 diffIdx, а не только текущий, — двойная защита от той же проблемы).
            diffIdx:      this._diffIdx,
        });
    };

    proto._loadFromUdata = function(){
        if(!udata || !udata['bosses_data']) return;
        try{
            // 24.09.2026: helper.safeParseJSON() — см. коммент в _saveToUdata() выше и в самой
            // функции (universal_helper.js). Раньше голый JSON.parse() кидал исключение (и вся
            // загрузка молча срывалась целиком — keys/dailyKills/killsTotal/bossStartMs
            // оставались на дефолтах конструктора), если udata['bosses_data'] был уже объектом
            // (это ВСЕГДА так сразу после users.get на fresh-логине — см. Database::trueJSON()).
            const s = helper.safeParseJSON(udata['bosses_data'], {});
            if(s.hpByDiff && Array.isArray(s.hpByDiff)){
                for(let di=0;di<4;di++)
                    if(s.hpByDiff[di]) s.hpByDiff[di].forEach((v,i)=>{ if(i<8) this.hpByDiff[di][i]=v; });
            } else if(s.hp){
                // Миграция со старого формата (только одно HP)
                s.hp.forEach((v,i)=>{ if(i<8) this.hpByDiff[0][i]=v; });
            }
            if(s.keys)        s.keys.forEach((v,i)=>{ if(i<8) this.keys[i]=v; });
            // Ключи Охотника виртуальные: у каждого игрока всегда 999 и не расходуются.
            this.keys[0] = 999;
            if(s.killsTotal)  s.killsTotal.forEach((v,i)=>{ if(i<8) this.killsTotal[i]=parseInt(v)||0; });
            if(s.dailyDate)   this.dailyDate=s.dailyDate;
            if(s.dailyKills)  s.dailyKills.forEach((v,i)=>{ if(i<8) this.dailyKills[i]=v; });
            if(s.bossStartMs){
                if(Array.isArray(s.bossStartMs[0])){
                    for(let di=0;di<4;di++)
                        if(s.bossStartMs[di]) s.bossStartMs[di].forEach((v,i)=>{ if(i<8) this._bossStartMs[di][i]=v; });
                } else {
                    s.bossStartMs.forEach((v,i)=>{ if(i<8) this._bossStartMs[0][i]=v; });
                }
            }
            if(s.freeWpnCdMs) Object.assign(this._freeWpnLastMs, s.freeWpnCdMs);
            if(s.friendDmgApplied && Array.isArray(s.friendDmgApplied)){
                for(let di=0;di<4;di++)
                    if(s.friendDmgApplied[di]) s.friendDmgApplied[di].forEach((v,i)=>{ if(i<8) this.friendDmgApplied[di][i]=parseInt(v)||0; });
            }
            if(s.curCycleDmg && Array.isArray(s.curCycleDmg))
                s.curCycleDmg.forEach((v,i)=>{ if(i<8) this._curCycleDmg[i]=parseInt(v)||0; });
            if(s.fightTimeBonusMs && Array.isArray(s.fightTimeBonusMs)){
                for(let di=0;di<4;di++)
                    if(s.fightTimeBonusMs[di]) s.fightTimeBonusMs[di].forEach((v,i)=>{ if(i<8) this._fightTimeBonusMs[di][i]=parseInt(v)||0; });
            }
            if(Number.isInteger(s.diffIdx) && s.diffIdx >= 0 && s.diffIdx <= 3) this._diffIdx = s.diffIdx;
        } catch(e){}
    };

    proto._ensureExtraButtons = function(){
        this._buildDiffButtons();

        if(this._skillsBtn) return;
        const winW = this.win.width > 0 ? this.win.width : 1200;

        // Кнопка Скиллы
        const skillBtn = new PIXI.Container();
        const sbg = new PIXI.Graphics();
        sbg.beginFill(0x1a2a1a);sbg.lineStyle(1,0x4a8a4a);sbg.drawRoundedRect(0,0,110,28,5);sbg.endFill();
        const stxt = new PIXI.Text('⚡ СКИЛЛЫ',{fontFamily:'Arial',fontSize:13,fill:'#80e080',fontWeight:'bold'});
        stxt.x=8;stxt.y=6;
        skillBtn.addChild(sbg,stxt);
        skillBtn.x=winW-130; skillBtn.y=12;
        skillBtn.interactive=true;skillBtn.buttonMode=true;
        skillBtn.on('pointerdown',()=>{ if(window.skills) skills.open(); });
        this.win.addChild(skillBtn);
        this._skillsBtn=skillBtn;

        if(!this._timerTxt){
            const timerTxt = new PIXI.Text('', {
                fontFamily:'Southbank LT', fontSize:14, fill:'#ffcc44',
                dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
            });
            timerTxt.x = 10; timerTxt.y = 50;
            this.win.addChild(timerTxt);
            this._timerTxt = timerTxt;
            this._timerInterval = setInterval(()=>this._updateFightTimer(), 1000);
        }
    };

    // _bossStartMs — настоящий серверный timestamp старта попытки (bosses.php.startFight()).
    // Отсчёт от FIGHT_DURATION_MS + замороженный бонус скилла "Повелитель времени". Дойдя до
    // нуля — автоматический форфейт (_onFightTimeout), а не просто зависшая надпись 00:00:00.
    proto._updateFightTimer = function(){
        if(!this._timerTxt) return;
        const idx     = this.selected;
        const startMs = this._bossStartMs[this._diffIdx][idx] || 0;
        if(!startMs){ this._timerTxt.text = '09:00:00'; return; }
        const bonus = (this._fightTimeBonusMs && this._fightTimeBonusMs[this._diffIdx]) ? (this._fightTimeBonusMs[this._diffIdx][idx] || 0) : 0;
        const rem = Math.max(0, (this.FIGHT_DURATION_MS || 32400000) + bonus - (Date.now() - startMs));
        const s = Math.floor(rem / 1000);
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
        this._timerTxt.text = String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
        if(rem === 0){
            this._timerTxt.text = 'Время боя вышло!';
            this._onFightTimeout(idx);
        }
    };

    // 24.09.2026 (баг найден по прямому указанию — репорт "после перезагрузки и клика на
    // вкладку Боссы открывается выбор боссов вместо резюме активного боя"): ЗДЕСЬ раньше стояло
    // ВТОРОЕ определение `proto._onFightTimeout` — полный дубликат имени с версией выше (см.
    // строку ~201), но старой "легаси" реализацией без graphical-попапа (notify.showResult
    // вместо iface._showBossResultPopup), без top/рейтинга и БЕЗ suspend/resume-защиты от
    // гонки с параллельным flushPlayerSave. Поскольку `attachBossesCombat(proto)` выполняет ВСЕ
    // присваивания `proto.X = function(){...}` последовательно при загрузке модуля, ЭТО ВТОРОЕ
    // определение (ниже по файлу) МОЛЧА ЗАТИРАЛО первое — независимо от того, кто и когда
    // вызывает `this._onFightTimeout(idx)` (bosses_fight.js._tickBossFightTimer, _attack()'s
    // подстраховка, или этот же легаси-таймер _updateFightTimer() выше), всегда срабатывала
    // именно ЭТА старая версия. Итог: правка от того же 24.09.2026 батча (попап поражения
    // получает top/не гоняется с параллельным флашем) была МЁРТВЫМ КОДОМ для пути "истёк
    // таймер" с самого момента написания — реально срабатывал этот легаси-обработчик.
    //
    // Сам код, который единственно мог бы звать ЭТУ версию (_updateFightTimer() выше, доступима
    // только через Bosses.prototype.open()) — подтверждённо мёртв другим комментарием этого же
    // файла (см. bosses.js, 21.09.2026: "open() нигде в реальном UI не вызывается, актуальный
    // путь — bosses_select.js/bosses_fight.js"). Удалена сама дублирующая функция — единственная
    // причина, по которой рабочая версия выше вообще не могла сработать.
}
