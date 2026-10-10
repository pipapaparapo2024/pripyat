import { attachSpineBoss } from './spine-boss.js';
import { applyPatch } from '../../../modules/patch.js';
import { flushPlayerSave } from '../../../modules/player-save.js';
import { makeParallelogramHit } from '../popups/popup-hit-shapes.js';

// 25.09.2026 (по прямому указанию, замена цветовой заливки на присланные PNG): полоска ХП
// босса — прогрессия (фон, всегда 248×28) + одна из трёх картинок сверху, обрезанная по ширине
// на pct. Пороги (>50% зелёный/фулл, 20-50% оранжевый/половина, <20% красный/конец) — не были
// продиктованы явным числом, взяты как разумное значение по умолчанию (легко подвинуть, если
// на глаз будет "рано"/"поздно" переключаться — обе константы вынесены отдельно).
const HP_HALF_THRESHOLD = 0.5;
const HP_END_THRESHOLD  = 0.2;
function _hpTexture(pct){
    if(pct > HP_HALF_THRESHOLD) return 'боевка хп фулл.png';
    if(pct > HP_END_THRESHOLD)  return 'боевка хп половина.png';
    return 'боевка хп конец.png';
}

// 25.09.2026 (по прямому указанию — "каждый раз при крите выбирается рандомная позиция из
// вариантов"): 4 варианта позиции/масштаба/поворота ОДНОГО И ТОГО ЖЕ файла эффекта крита,
// снятые редактором позиций (rot — градусы, как в редакторе; PIXI.rotation ждёт радианы,
// конвертация в _pickCritEffectVariant()).
const CRIT_EFFECT_VARIANTS = [
    {x: 396, y: 275, scale: 1.042, rot: -9},
    {x: 971, y: 237, scale: 1.176, rot: 61},
    {x: 513, y: 451, scale: 0.977, rot: 0},
    {x: 760, y: 422, scale: 1.157, rot: 51},
];

/** Boss battle screen overlay. */
export function attachBossesFight(proto){
    attachSpineBoss(proto);

    // Начало боя (bossStartMs===0 у этой пары дифф/босс) больше не пишется локально — сервер
    // сам проверяет зачистку локации/ключи, сам их списывает и сам фиксирует bossStartMs
    // (bosses.php.startFight, 17.09.2026 — ответ на вопрос "таймер боя тоже на клиенте?").
    // Продолжение (уже идущий бой) по-прежнему открывается мгновенно — сервер туда не дёргаем.
    proto._openBossesFight = function(bossIdx, diffIdx){
        if(window.bosses){
            const di = diffIdx === undefined ? bosses._diffIdx : diffIdx;
            const data = bosses.data[bossIdx];
            if(!bosses._isLocCleared(data.boss_loc)){
                this._openSidorovichError('Сначала зачисти локацию для доступа к боссу!');
                return;
            }
            bosses._diffIdx = di;
            if(!bosses._bossStartMs[di][bossIdx]){
                const need = bosses.data[bossIdx].keys_needed || 0;
                const keySlot = data.key_slot != null ? data.key_slot : bossIdx;
                if(!bosses._hasKeyring() && (bosses.keys[keySlot] || 0) < need){
                    // 29.09.2026 (по прямому указанию, тот же приём, что в bosses-combat.js._attack() —
                    // см. комментарий там): боссы с продажей ключей (buy_key>0 — Счастливчик/
                    // Ястреб/Меченный) открывают попап покупки вместо голого текста.
                    if(data.buy_key > 0) bosses._openBuyKeyPopup(bossIdx);
                    else this._openSidorovichError('Нужно '+need+' ключей!');
                    return;
                }
                console.log('[bosses_fight._openBossesFight] новый бой — запрашиваю старт у сервера | bossIdx:', bossIdx, 'diffIdx:', di);
                // 22.09.2026 (баг найден по прямому указанию — "иногда при обновлении страницы
                // бой пропадает"): flushPlayerSave() СИНХРОННО перед стартом боя — если где-то
                // в игре уже стоит в очереди 500мс-дебаунс автосейва (player-save.js) со СТАРЫМ
                // udata['bosses_data'] (снимок от действия ДО захода на экран боссов), он может
                // долететь до сервера ПОСЛЕ того, как bosses.startFight() уже записал свежий
                // bossStartMs напрямую (Gameops::saveUser, в обход whitelist users.save) —
                // тот же класс гонки, что уже чинили для yashik.js (flushPlayerSave('yashik_open',
                // ...)). Ждём завершения флаша ПЕРЕД стартом боя — гарантированно никакой
                // устаревший снимок bosses_data не перезапишет свежую запись сервера следом.
                // 24.09.2026 (баг найден по прямому указанию — "не сохраняются ключи/лимиты
                // боссов", подтверждено логами сервера saveVerifyMismatch:true): флаш ПЕРЕД
                // запросом (выше) защищает только от УЖЕ стоявшего в очереди сейва — но НЕ от
                // НОВОГО автосейва, который может запланироваться и сработать, ПОКА startFight
                // летит туда-обратно. suspendPlayerSave()/resumePlayerSave() (player-save.js)
                // перекрывают всё окно запроса — resumePlayerSave() снят в обоих колбэках ниже.
                flushPlayerSave('boss_start_fight', () => {
                if(window.suspendPlayerSave) suspendPlayerSave('boss_start_fight');
                TS.php('bosses.startFight', {boss_id: bossIdx, diff_idx: di}, (res) => {
                    console.log('[bosses_fight._openBossesFight] сервер подтвердил старт боя | bossStartMs:', res.bossStartMs, 'keysLeft:', res.keysLeft);
                    // 25.09.2026 (тот же фикс, что в bosses-combat.js._attack/_onDefeat — см.
                    // подробный коммент там): applyPatch() ПЕРЕД resumePlayerSave(), иначе
                    // отложенный автосейв может уйти со СТАРЫМ udata и затереть только что
                    // списанные ключи/bossStartMs, которые startFight() записал напрямую.
                    applyPatch(res.patch);
                    if(window.resumePlayerSave) resumePlayerSave('boss_start_fight');
                    // Ключи читаем ОБРАТНО из серверного patch.bosses_data, а не вычитаем
                    // need локально — в идемпотентной ветке (бой уже был начат сервером ранее)
                    // повторного списания не происходит, и локальное вычитание задвоило бы его.
                    try{
                        const patched = JSON.parse((res.patch && res.patch.bosses_data) || '{}');
                        if(patched.keys && patched.keys[bossIdx] !== undefined) bosses.keys[bossIdx] = patched.keys[bossIdx];
                        // 29.09.2026 (см. большой коммент в bosses.php.startFight() про перенос
                        // списания попытки сюда, "лимиты атак не заканчиваются"): сервер уже
                        // потратил попытку (dailyKills) ПРЯМО ЗДЕСЬ, при старте — синхронизируем
                        // локальный снимок тем же способом, что и keys выше, иначе UI (счётчик
                        // "ЛИМИТ: X/7" и клиентский предчек в bosses-combat._attack) остаются
                        // на старом значении вплоть до победы (которая больше не инкрементирует
                        // dailyKills — см. bosses-combat.js._onDefeat) или ручной перезагрузки.
                        if(patched.dailyDate && patched.dailyDate !== bosses.dailyDate){
                            bosses.dailyDate = patched.dailyDate;
                            bosses.dailyKills = [0,0,0,0,0,0,0,0];
                        }
                        if(patched.dailyKills && patched.dailyKills[bossIdx] !== undefined) bosses.dailyKills[bossIdx] = patched.dailyKills[bossIdx];
                        // 25.09.2026 (тот же живой репорт про залипающий КД бесплатного оружия —
                        // см. большой коммент в bosses.php.startFight() про авто-форфейт другой
                        // пары): сервер мог только что обнулить freeWpnCdMs (брошенный бой
                        // авто-форфейтнут, или протухла ЭТА ЖЕ пара) — но bosses._freeWpnLastMs
                        // (чисто in-memory снимок, см. free-weapon-cooldown-not-wiped-on-fight-
                        // end.test.js Test 1) мог всё ещё хранить СТАРЫЙ таймстамп брошенного
                        // боя для ДРУГОГО оружия, чем то, которым бьют СЕЙЧАС. Следующий же
                        // _saveToUdata() (после первого удара в новом бою) смёрджил бы max(0,
                        // старый) и воскресил бы только что обнулённый сервером кулдаун. ПОЛНАЯ
                        // замена (не Object.assign-мёрдж) держит клиентский снимок в точности
                        // равным серверной истине после каждого startFight().
                        bosses._freeWpnLastMs = (patched.freeWpnCdMs && typeof patched.freeWpnCdMs === 'object') ? patched.freeWpnCdMs : {};
                    } catch(e){ console.error('[bosses_fight._openBossesFight] не удалось разобрать patch.bosses_data:', e.message); }
                    bosses._bossStartMs[di][bossIdx] = res.bossStartMs; // реальный серверный timestamp
                    // _fightStart — личный таймер ДЛЯ СТАТИСТИКИ (fightMs в achievements.onBossKill).
                    bosses._fightStart = Date.now();
                    // 22.09.2026: HP теперь производное значение с сервера (см. bosses.php.
                    // _derivedHp) — startFight() возвращает его сразу. Для позднего участника
                    // это уже уменьшенное друзьями HP общей попытки.
                    if(typeof res.hp === 'number') bosses._setHp(bossIdx, res.hp);
                    // Фиксируем стартовые очки скиллов ЗДЕСЬ же, в момент реального старта новой
                    // попытки боя — раньше это делалось только внутри bosses._attack() по условию
                    // "_bossStartMs === 0", но эта строка выше УЖЕ проставляет _bossStartMs ДО
                    // первой атаки, поэтому то условие никогда не срабатывало по основному пути
                    // экрана боя (bosses_select → prefight → bosses_fight). skills.beginSession()
                    // из-за этого фактически никогда не вызывался, _sessionStartPoints навсегда
                    // застревал на 0 — и как только игрок хоть раз получал очко скилла (earnedPoints
                    // > 0), проверка "leveled" в skills._endSession() всегда была true (0 < earned),
                    // из-за чего остаток урона до следующего очка НИКОГДА не обнулялся между боями
                    // (репорт: "победил босса, зашёл в новый бой — а там снова те же 415 опыта").
                    if(window.skills) skills.beginSession();

                    // 20.09.2026 (баг найден, по прямому указанию) — ровно по той же причине,
                    // что и с skills.beginSession() в комментарии выше: _bossStartMs УЖЕ проставлен
                    // строкой выше ДО первой атаки, поэтому "if(isNewAttempt){...}" внутри
                    // bosses-combat.js._attack() практически НИКОГДА не срабатывает по основному
                    // пути экрана боя — включая _seedFriendDmgBaseline() (баг "фантомный урон
                    // друга", чинили 19.09.2026) и авто-форфейт брошенных боёв (баг "вишу в топе
                    // у друга, пока их босс не умрёт", чинили сегодня). Оба фактически были
                    // МЁРТВЫМ кодом всё это время. Переносим сюда, в реальную точку старта.
                    if(!bosses._fightTimeBonusMs) bosses._fightTimeBonusMs = [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]];
                    for(let _di=0; _di<4; _di++){
                        for(let _bi=0; _bi<8; _bi++){
                            if(_di === di && _bi === bossIdx) continue;
                            if(bosses._bossStartMs[_di][_bi] > 0){
                                console.log('[bosses_fight._openBossesFight] авто-форфейт брошенного боя при старте нового | diffIdx:', _di, '| bossIdx:', _bi);
                                bosses._bossStartMs[_di][_bi] = 0;
                                if(Array.isArray(bosses._curCycleDmg)) bosses._curCycleDmg[_bi] = 0;
                                if(bosses.friendDmgApplied && bosses.friendDmgApplied[_di]) bosses.friendDmgApplied[_di][_bi] = 0;
                                bosses._fightTimeBonusMs[_di][_bi] = 0;
                            }
                        }
                    }
                    // Бонус времени от "Повелителя времени" ЗАМОРАЖИВАЕТСЯ здесь, на реальном
                    // старте попытки, и больше не перечитывается вживую до конца этого боя —
                    // иначе прокачка скилла ПРЯМО В БОЮ (кнопка "СКИЛЛЫ" открывается из самого
                    // экрана боя) урона ЭТОГО ЖЕ боя мгновенно продлевала бы дедлайн ЭТОГО ЖЕ
                    // боя (репорт: "время полностью обновляется, если постоянно жать кнопку").
                    bosses._fightTimeBonusMs[di][bossIdx] = window.skills ? skills.getTimeBonus() * 60000 : 0;
                    // Сервер сам считает урон друзей с общего начала активной попытки той же
                    // пары босс/сложность; отдельный клиентский baseline больше не нужен.
                    bosses._saveToUdata();

                    this._reallyOpenBossesFight(bossIdx);
                    // Если друг добил босса до/во время нашего входа, не оставляем экран с 0 HP:
                    // серверная claimKill() повторно проверит производное HP и выдаст награду.
                    if(typeof res.hp === 'number' && res.hp <= 0) bosses._onDefeat(bossIdx);
                }, (err) => {
                    if(window.resumePlayerSave) resumePlayerSave('boss_start_fight');
                    console.error('[bosses_fight._openBossesFight] сервер отказал в старте боя | err:', err);
                    // 27.09.2026 (баг найден по прямому указанию — "победу засчитало, после
                    // попытки снова напасть нижний ХУД пропадает, в бой не заходит"): этот колбэк
                    // срабатывает, например, когда дневной лимит убийств босса уже исчерпан
                    // (код 62) — как раз ожидаемо СРАЗУ после победы, которая этот лимит и
                    // исчерпала. Раньше здесь только показывался попап ошибки — но экран выбора
                    // боссов (bosses_select.js) к этому моменту УЖЕ скрыт (bosses_prefight.js
                    // ставит win.visible=false перед вызовом _openBossesFight, см. napBtn), а
                    // HUD-стек (iface._hudStack) всё ещё хранит старую запись 'bossSelect' —
                    // popHud('bossSelect') снимается только внутри _reallyOpenBossesFight() (см.
                    // ниже), которая при отказе сервера так и не вызывается. Итог: попап ошибки
                    // закрывался, а под ним оставался СКРЫТЫЙ экран боссов и HUD с down:false
                    // навсегда — ровно "нижний ХУД пропадает, в бой не заходит". Пересобираем
                    // экран выбора боссов СРАЗУ (свежий _bossWin, видимый, актуальный HUD-стек),
                    // попап ошибки просто рисуется поверх него, как и раньше.
                    if(window.iface && typeof iface._openBossesPopup === 'function') iface._openBossesPopup();
                    // 24.09.2026: код 62 (дневной лимит попыток уже исчерпан) — отдельное точное
                    // сообщение, та же формулировка, что и обычный предчек в bosses_select.js.
                    // 29.09.2026: "убийств" → "попыток" — лимит теперь тратится за любой исход.
                    if(err && err.code === 62){
                        const limit = (window.bosses && bosses.DAILY_KILL_LIMIT) || 7;
                        notify.showResult({text: 'Лимит ' + limit + ' попыток на сегодня исчерпан!'}, 0);
                    } else {
                        this._openSidorovichError('Не удалось начать бой', 'Проверьте ключи и зачистку локации');
                    }
                });
                }); // flushPlayerSave('boss_start_fight', ...) — см. коммент выше
                return; // экран откроется в колбэке успеха — не дублируем ниже
            }
            // Бой уже был активен (клиент помнил bossStartMs локально) — _fightStart (личный
            // таймер для статистики fightMs) берём от РЕАЛЬНОГО момента старта этой попытки, не
            // от момента открытия экрана.
            bosses._fightStart = bosses._bossStartMs[di][bossIdx];
            bosses._saveToUdata();
            // HP — производное значение с сервера, а не хранимый счётчик (см. bosses.php.
            // _derivedHp), поэтому при каждом повторном открытии уже идущего боя подтягиваем
            // актуальный HP (учитывает и собственный урон, накопленный за время отсутствия на
            // этом экране, и помощь друзей) — тем же вызовом, что кнопка ПЕРЕЗАГРУЗИТЬ.
            if(typeof bosses._syncFriendsDamage === 'function'){
                bosses._syncFriendsDamage(bossIdx, () => this._reallyOpenBossesFight(bossIdx));
                return;
            }
        }
        this._reallyOpenBossesFight(bossIdx);
    };

    // Вынесено из _openBossesFight: собственно построение/показ экрана боя — вызывается сразу
    // (бой уже идёт) либо из колбэка успеха bosses.startFight (новый бой).
    proto._reallyOpenBossesFight = function(bossIdx){
        this._compassHide();
        // Закрываем попап выбора боссов если он открыт — окно закрывается напрямую, минуя
        // свой обычный exitBtn-обработчик, поэтому снимаем и его декларацию ХУДа здесь же
        // (иначе после закрытия боя в стеке остался бы висеть "bossSelect", и низ ХУДа
        // ошибочно оставался бы скрытым даже вне боя).
        if(this._bossWin && this._bossWin.parent) this._bossWin.parent.removeChild(this._bossWin);
        this._bossWin = null;
        // Для обучения это внутренняя смена одного экрана «Боссы» на другой, а не выход
        // игрока в главное меню. Хук onboarding-tour.js увидит флаг только на этом popHud.
        this._onboardingBossScreenTransition = true;
        this.popHud('bossSelect');
        this._onboardingBossScreenTransition = false;
        this._closeBossesFight(); // всегда пересобираем (разные боссы = разный фон)
        this._buildBossesFight();
        this._updateBossesFight(bossIdx);
        this._bossFightWin.y = -720;
        root.layer2_mc.addChild(this._bossFightWin);
        this.pushHud('bossFight', { down: false });
        if(this.up) root.layer2_mc.addChild(this.up);
        this._startBossFightTimer();
        gsap.to(this._bossFightWin, {
            y: 0, duration: 0.55, ease: 'power2.out',
            onComplete: () => { this._spineBossShow(bossIdx); }
        });
    };

    proto._buildBossesFight = function(){
        const B = './images/';
        const win = new PIXI.Container();
        win.interactive = true;

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.001);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        // Фон (меняется per-boss через _updateBossesFight)
        const bg = new PIXI.Sprite(PIXI.Texture.EMPTY);
        bg.width = 1280; bg.height = 720;
        win.addChild(bg);
        this._bossFightBg = bg;

        // 08.10.2026: Spine-анимация босса — ровно здесь, сразу после фона и ДО любого другого
        // UI ниже (имя/ХП/таймер/рейтинг/оружие/тултипы) — порядок addChild определяет Z-порядок
        // в PIXI, поэтому место вызова и есть требование "поверх фона, но под всем остальным"
        // (см. spine-boss.js — раньше была отдельная DOM-оверлей-канва с тем же требованием,
        // решённым хрупкой проверкой "кто сверху", теперь обычный PIXI-спрайт в нужном месте).
        this._spineBossMount(win);

        // ── ЛЕВАЯ ПАНЕЛЬ: имя босса, HP, таймер ─────────────────────────────
        // 25.09.2026 (по прямому указанию, редактор позиций): x/y/scale сняты точно, цвет
        // #F0F0F0 (десятое присланное изображение), шрифт чуть тоньше (bold → normal).
        const bossNameTxt = new PIXI.Text('', {
            fontFamily:'Southbank LT', fontSize:34, fill:'#f0f0f0', fontWeight:'normal',
            dropShadow:true, dropShadowColor:'#000', dropShadowDistance:2,
        });
        bossNameTxt.anchor.set(0.5, 0);
        bossNameTxt.x = 137.5; bossNameTxt.y = 95;
        win.addChild(bossNameTxt);
        this._bossFightNameTxt = bossNameTxt;

        // 25.09.2026 (по прямому указанию, файлы присланы отдельно): "прогрессия хп" — базовый
        // слой, лежит ПОД полоской ХП всегда (даже когда ХП=0, чтобы рамка не выглядела пустой
        // дырой); поверх неё — сама полоска (фулл/половина/конец, выбор см. _hpTexture выше),
        // ширина обрезается по проценту оставшегося ХП — та же техника, что раньше была с
        // Graphics.drawRect(), только текстура вместо сплошной заливки.
        const hpBarBg = new PIXI.Sprite(PIXI.Texture.from(B + 'боевка хп прогрессия.png'));
        hpBarBg.x = 12; hpBarBg.y = 142;
        hpBarBg._uDraggable = true;
        win.addChild(hpBarBg);

        const hpBar = new PIXI.Sprite(PIXI.Texture.from(B + 'боевка хп фулл.png'));
        hpBar.x = 12; hpBar.y = 142; hpBar.height = 28;
        hpBar._uDraggable = true;
        win.addChild(hpBar);
        this._bossFightHpBar = hpBar;

        const hpTxt = new PIXI.Text('', {
            fontFamily:'Southbank LT', fontSize:21, fill:'#ffffff',
        });
        // 03.10.2026 (редактор позиций): было y:156, scale:1.314.
        hpTxt.anchor.set(0.5, 0.5); hpTxt.x = 136; hpTxt.y = 157;
        win.addChild(hpTxt);
        this._bossFightHpTxt = hpTxt;

        // 09.10.2026 (по прямому указанию — "друзья нанесли урон, полоска ХП в бою всё ещё
        // 100к/100к, нужно видеть точное число при наведении"): округлённый "к"-текст выше
        // (даже с точностью до десятых) всё равно не показывает ТОЧНОЕ оставшееся ХП — тултип
        // по наведению на полоску/прогрессию ХП. Тот же паттерн тултипа, что keyTooltip в
        // ryukzak.js (Container: Graphics-фон + Text, visible toggle по pointerover/pointerout).
        // Наведение повешено на hpBarBg (прогрессия, см. выше) — она ВСЕГДА полной ширины 248px,
        // в отличие от hpBar, которая сжимается по % ХП и не покроет всю зону при низком ХП.
        const hpTooltip = new PIXI.Container();
        hpTooltip.visible = false;
        const hpTooltipBg = new PIXI.Graphics();
        const hpTooltipTxt = new PIXI.Text('', { fontFamily:'Southbank LT', fontSize:16, fill:'#ffffff' });
        hpTooltipTxt.anchor.set(0.5, 0.5);
        hpTooltip.addChild(hpTooltipBg);
        hpTooltip.addChild(hpTooltipTxt);
        win.addChild(hpTooltip);
        this._bossFightHpTooltip = hpTooltip;
        this._bossFightHpTooltipTxt = hpTooltipTxt;
        this._bossFightHpTooltipBg = hpTooltipBg;

        hpBarBg.interactive = true;
        hpBarBg.on('pointerover', () => this._showBossFightHpTooltip());
        hpBarBg.on('pointerout',  () => { hpTooltip.visible = false; });

        // 08.10.2026 (по прямому указанию дизайнера — "шрифт просто расплющил, пошёл
        // пикселями, а не сделал так, чтоб шрифт поменял размер"): PIXI.Text рендерится в
        // растровую текстуру под fontSize, дальнейший scale.set() растягивает уже готовый
        // bitmap (было fontSize:24 + scale:1.624 — визуально ~39px, но блочно). Теперь
        // итоговый размер задан прямо в fontSize (24×1.624≈39) — текст рендерится сразу в
        // нужном разрешении, scale не нужен. dropShadowDistance отмасштабирован тем же
        // коэффициентом (1×1.624), чтобы тень осталась визуально той же, не "похудела".
        const timerTxt = new PIXI.Text('09:00:00', {
            fontFamily:'Southbank LT', fontSize:39, fill:'#f0f0f0', fontWeight:'normal',
            dropShadow:true, dropShadowColor:'#000', dropShadowDistance:1.624,
        });
        timerTxt.x = 80; timerTxt.y = 203;
        win.addChild(timerTxt);
        this._bossFightTimerTxt = timerTxt;

        // Кнопка выход
        const exitBtn = new PIXI.Sprite(PIXI.Texture.from('./images/layers/popups/bosses/exit.png'));
        exitBtn.scale.set(0.5);
        if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
        exitBtn.x = 1203; exitBtn.y = 98;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', ()=>{ _sa(exitBtn, 0.75); exitBtn.scale.set(0.54); });
        exitBtn.on('pointerout', ()=>{ _sa(exitBtn, 1); exitBtn.scale.set(0.5); });
        exitBtn.on('pointerdown', ()=>this._leaveBossesFight());
        win.addChild(exitBtn);

        // ── РЕЙТИНГ УРОНА (нижний левый, встроен в арт фона) ────────

        this._bossFightRatingRows = [];
        // Координаты по замеру редактором позиций (14.09.2026, уточнено 26.09.2026 —
        // x:29,y:532 для строки 0, остальные две сдвинуты на ту же дельту +1) — единая
        // раскладка для всех 3 строк рейтинга (раньше строка 0 была отдельным особым случаем
        // ROW0_OVERRIDE).
        // 29.09.2026 (редактор позиций, второй снимок в тот же день — x:37 y:541 scale:0.472
        // w:34 h:34 для строки 0, было x:33 y:536 scale:0.500) — дельта (+4/+5 к строке 0) той же
        // формулой перенесена на остальные две строки. w/h — замер редактора при этом scale, не
        // отдельная жёсткая ширина/высота (см. коммент ниже про AV_SCALE — спрайт по-прежнему
        // масштабируется целиком, без искажения пропорций чужого фото).
		const FRAME_X = 27, FRAME_Y = [528, 589, 652];
		const AV_X = 32, AV_Y = [532, 593, 656];
        // 26.09.2026 (по прямому указанию, редактор позиций — "характеристики для иконок,
        // которые должны отображаться в рейтинге урона"): аватар теперь масштабируется как
        // обычный спрайт (scale от натурального размера текстуры), а не растягивается в
        // фиксированный 42×42 квадрат — так пропорции чужого VK-фото не искажаются.
        const AV_SCALE = 0.324;
        // 03.10.2026 (редактор позиций, по прямому указанию): LBL_X было 257, VAL_X было 281,
        // VAL_Y было [560,620,680] — та же дельта строки 0 (единственной измеренной) перенесена
        // на строки 1-2, как и раньше в этом файле (см. комментарий выше про FRAME_X/AV_X).
        // Масштаб имени/подписи/значения добавлен тем же днём отдельными NAME_SCALE/LBL_SCALE/
        // VAL_SCALE — 08.10.2026 (фикс пикселизации текста) эти три константы убраны, те же
        // коэффициенты свёрнуты прямо в fontSize ниже (nameTxt:18, dmgLbl:15, dmgTxt:16).
        const NAME_X = 92,  NAME_Y = [535, 597, 659];
        const LBL_X = 256, LBL_Y  = [535, 597, 659]; // на одной линии с NAME (было ниже, rowY+22)
        const VAL_X = 282, VAL_Y  = [558, 618, 678];
        for(let r = 0; r < 3; r++){
            const avX = AV_X, avY = AV_Y[r];
            const frameX = FRAME_X, frameY = FRAME_Y[r];

            // 26.09.2026 (по прямому указанию, скриншот — "убери серые прямоугольники, я вообще
            // не понимаю зачем они нужны"): непрозрачный тёмно-серый Graphics-фон под аватаром
            // убран целиком — decorative frameSpr ("боевка рамка фотки для рейтинга.png") ниже
            // уже даёт нужное обрамление, а сплошной серый квадрат под ним был виден отдельно
            // (особенно пока avSpr пуст — PIXI.Texture.EMPTY до первого фетча рейтинга).

            // 18.09.2026 (по прямому указанию): клик по строке рейтинга открывает профиль
            // этого игрока — row.id проставляется/обновляется в _fetchBossFightRating() ниже
            // при каждом обновлении рейтинга (сама строка/хит-зона создаётся один раз здесь).
            const rowHit = new PIXI.Graphics();
            rowHit.beginFill(0x000000, 0.001);
            rowHit.drawRect(0, 0, 260, 42);
            rowHit.endFill();
            rowHit.x = avX; rowHit.y = avY;
            rowHit.interactive = true; rowHit.buttonMode = true;
            win.addChild(rowHit);

            const avSpr = new PIXI.Sprite(PIXI.Texture.EMPTY);
            avSpr.scale.set(AV_SCALE); avSpr.x = avX; avSpr.y = avY;
            win.addChild(avSpr);

            const frameSpr = new PIXI.Sprite(PIXI.Texture.from(B + 'боевка рамка фотки для рейтинга.png'));
            frameSpr.width = 42; frameSpr.height = 42; frameSpr.x = frameX; frameSpr.y = frameY;
            win.addChild(frameSpr);

            // 22.09.2026 (тот же баг, что в svod-leaderboard.js — длинный ник без wordWrap
            // налезает на соседнюю колонку, "Нанесенный урон:" начинается сразу в LBL_X=257,
            // доступная ширина ~160px до неё): защита от переполнения строки имени.
            // 26.09.2026 (по прямому указанию): шрифт — ближайший загруженный в проекте аналог
            // Bebas Neue, 'AA Bebas Neue' (см. fonts.css). Пустая строка вместо плейсхолдера —
            // см. коммент у _showBossFightRating() ниже (там же убраны "---"/"× —" для этой же
            // причины: "тёмная плашка тройного тире не нужна, пока в рейтинге ещё никого нет").
            // 02.10.2026 (ВАЖНО — НЕ менять без прямого указания пользователя): цвет '#8a7157'
            // (коричневый) — это ПОДТВЕРЖДЁННЫЙ пользователем напрямую финальный выбор, НЕ баг.
            // В сессии до этого была попытка "починить" его на белый, опираясь на более старый
            // комментарий/SESSION_HANDOFF-заметку про rgb(255,255,255) — пользователь явно
            // отменил эту правку словами "цвет ника в рейтинге должен быть коричневым, а не
            // белым". Старые комментарии/доки, описывающие белый цвет, сами устарели — не
            // доверять им больше, чем прямому указанию пользователя.
            const nameTxt = new PIXI.Text('', {
                fontFamily:'AA Bebas Neue', fontSize:18, fill:'#8a7157',
                wordWrap:true, wordWrapWidth: (LBL_X - NAME_X - 8) * 1.280,
            });
            nameTxt.x = NAME_X; nameTxt.y = NAME_Y[r];
            win.addChild(nameTxt);

            const dmgLbl = new PIXI.Text('Нанесенный урон:', {
                fontFamily:'Southbank LT', fontSize:15, fill:'#8a7157',
            });
            dmgLbl.x = LBL_X; dmgLbl.y = LBL_Y[r];
            win.addChild(dmgLbl);

            const dmgTxt = new PIXI.Text('× 0', {
                fontFamily:'Southbank LT', fontSize:16, fill:'#8a7157',
            });
            dmgTxt.x = VAL_X; dmgTxt.y = VAL_Y[r];
            win.addChild(dmgTxt);

            const rowObj = { avSpr, nameTxt, dmgTxt, id: null, nick: null };
            rowHit.on('pointerdown', ()=>{ if(rowObj.id && window.iface) iface._openPlayerProfile(rowObj.id, rowObj.nick); });
            this._bossFightRatingRows.push(rowObj);
        }

        // ── РЯД ОРУЖИЙ (нижний центр) ─────────────────────────────
        // 08.10.2026 (по прямому указанию, новый файл + координаты): декоративная панель "слотов"
        // под рядом кнопок оружия — добавлена ПОСЛЕ _spineBossMount(win) выше, значит в Z-порядке
        // она (как и сами кнопки ниже) лежит ПОВЕРХ Spine-анимации, как и требовалось.
        // Координаты уточнены тем же днём (второй снимок редактора позиций): x:369,y:610,
        // scale:1.012 (натуральный размер файла 675×109 × 1.012 ≈ 683×109 — ровно то, что
        // замерил редактор).
        //
        // 08.10.2026 (по прямому указанию — "в картинке визуально 8 ячеек, а оружий только 6,
        // обрежь лишние ~90px"; уточнено тем же днём — "не 6, а 7 ячеек"): картинка нарисована
        // на 8 слотов, видимых ячеек должно остаться 7 (1 лишняя обрезается). Сверка по X: панель
        // x:369..369+683=1052, последняя кнопка (автомат) x:792 + ширина ≈792+84≈876 — запас
        // ≈176px (≈2 ячейки) висит СПРАВА от последней кнопки; обрезается ровно 1 ячейка
        // (оставляем небольшой запас/рамку после автомата, не ровно по его краю). Обрезаем через
        // PIXI.Texture.frame (реальный crop пикселей, не squish-масштабирование — иначе оставшиеся
        // ячейки визуально сплющились бы).
        //
        // 08.10.2026 (тем же днём, повторное уточнение — "ещё справа обрезал бы, типа пикселей 6"):
        // после обрезки до 7/8 ячеек справа остаётся лишний тонкий край — срезаем ещё EXTRA_TRIM_PX
        // нативных пикселей текстуры сверх 7/8-доли (масштаб 1.012 близок к 1:1, разницей между
        // "нативный" и "экранный" пиксель на этой величине можно пренебречь).
        //
        // 09.10.2026 (по прямому указанию — "справа обрежь ещё пикселей 6, и сделай справа
        // небольшой border-radius"): EXTRA_TRIM_PX увеличен на ещё 6px (было 8, стало 14) — тот
        // же приём, что и раньше. Маска раньше была равномерным drawRoundedRect() — скругляла ВСЕ
        // 4 угла одним радиусом 4px. Левый край текстуры — родной край исходного файла (не
        // обрезался), скруглять его не просили; правый — искусственный обрез (crop), именно его
        // просили заметно скруглить. Маска переписана на ручной путь (moveTo/lineTo/arcTo) —
        // левые углы остаются прямыми, правые скруглены радиусом RIGHT_RADIUS.
        const wpnSlotsBg = new PIXI.Sprite(PIXI.Texture.EMPTY);
        wpnSlotsBg.x = 369; wpnSlotsBg.y = 610; wpnSlotsBg.scale.set(1.012);
        win.addChild(wpnSlotsBg);
        {
            const TOTAL_CELLS = 8, VISIBLE_CELLS = 7, EXTRA_TRIM_PX = 14, RIGHT_RADIUS = 10;
            const fullTex = PIXI.Texture.from(B + 'боевка слоты под оружие v2.png');
            const _applyCrop = () => {
                const bt = fullTex.baseTexture;
                const cropW = Math.round(bt.width * VISIBLE_CELLS / TOTAL_CELLS) - EXTRA_TRIM_PX;
                wpnSlotsBg.texture = new PIXI.Texture(bt, new PIXI.Rectangle(0, 0, cropW, bt.height));
                const h = bt.height;
                const slotsMask = new PIXI.Graphics();
                slotsMask.beginFill(0xffffff);
                slotsMask.moveTo(0, 0);
                slotsMask.lineTo(cropW - RIGHT_RADIUS, 0);
                slotsMask.arcTo(cropW, 0, cropW, RIGHT_RADIUS, RIGHT_RADIUS);
                slotsMask.lineTo(cropW, h - RIGHT_RADIUS);
                slotsMask.arcTo(cropW, h, cropW - RIGHT_RADIUS, h, RIGHT_RADIUS);
                slotsMask.lineTo(0, h);
                slotsMask.closePath();
                slotsMask.endFill();
                slotsMask.x = wpnSlotsBg.x;
                slotsMask.y = wpnSlotsBg.y;
                slotsMask.scale.copyFrom(wpnSlotsBg.scale);
                win.addChild(slotsMask);
                wpnSlotsBg.mask = slotsMask;
            };
            if(fullTex.baseTexture.valid) _applyCrop();
            else fullTex.baseTexture.once('loaded', _applyCrop);
        }

        const WPN_BTNS = [
            { file:'боевка кнопка нож.png',    id:0 },
            { file:'боевка кнопка цепь.png',   id:1 },
            { file:'боевка кнопка бита.png',   id:2 },
            { file:'боевка кнопка мачете.png', id:3 },
            { file:'боевка кнопка ствол.png',  id:4 },
            { file:'боевка кнопка калаш.png',  id:5 },
        ];
        const WPN_X  = [379, 464, 547, 627, 708, 792];
        const WPN_CX = [421, 506, 587, 667, 750, 832]; // центры кнопок (WPN_X[i] + img_width/2)
        this._bossFightWpnSprs = [];

        const _wpnTipBg  = new PIXI.Graphics();
        const _wpnTipTxt = new PIXI.Text('', {
            fontFamily:'Southbank LT', fontSize:18, fill:'#ffcc44',
            dropShadow:true, dropShadowColor:'#000', dropShadowDistance:1
        });
        _wpnTipTxt.anchor.set(0.5, 1);
        _wpnTipBg.visible  = false;
        _wpnTipTxt.visible = false;

        const _showWpnTip = (spr, wid) => {
            const MULT_OPTS = window.bosses ? bosses.MULT_OPTIONS : [1,10,50,100,500,1000];
            let mult = 1;
            if(wid >= 3 && this._bossFightWpnMultIdx){
                const mi  = this._bossFightWpnMultIdx[wid] || 0;
                mult = MULT_OPTS[mi] || 1;
            }
            // 25.09.2026 (по прямому указанию — "шмотки не дают бонуса, оружейка должна
            // показывать модифицированный урон"): расчёт (база + тир + скилл + шмот%/флэт)
            // вынесен в единую weapons.computeModifiedDamage() — та же формула, что теперь и в
            // оружейке (weapons.js._renderStatus), сверена построчно с сервером
            // (bosses.php:attack()), чтобы подсказка не расходилась ни с одним из них.
            const perHit = window.weapons ? weapons.computeModifiedDamage(wid) : 0;
            const totalDmg = perHit * mult;
            const dmgStr   = window.helper ? helper.formatKK(totalDmg) : String(totalDmg);
            _wpnTipTxt.text = dmgStr + ' урона';
            _wpnTipTxt.x    = WPN_CX[wid];
            _wpnTipTxt.y    = spr.y - 8;
            _wpnTipBg.clear();
            _wpnTipBg.beginFill(0x000000, 0.75);
            const pad = 6;
            _wpnTipBg.drawRoundedRect(
                _wpnTipTxt.x - _wpnTipTxt.width/2 - pad,
                _wpnTipTxt.y - _wpnTipTxt.height - pad,
                _wpnTipTxt.width + pad*2,
                _wpnTipTxt.height + pad*2, 4
            );
            _wpnTipBg.endFill();
            _wpnTipBg.visible  = true;
            _wpnTipTxt.visible = true;
            console.log('[bosses_fight._showWpnTip] wid='+wid+' perHit='+perHit+' mult='+mult+' total='+totalDmg);
        };
        const _hideWpnTip = () => { _wpnTipBg.visible = false; _wpnTipTxt.visible = false; };

        for(let i = 0; i < WPN_BTNS.length; i++){
            const cfg = WPN_BTNS[i];
            const spr = new PIXI.Sprite(PIXI.Texture.from(B + cfg.file));
            spr.x = WPN_X[i]; spr.y = 620;
            spr.interactive = true; spr.buttonMode = true;
            const wid = cfg.id;
            spr.on('pointerdown', ()=>this._attackWithWeapon(wid));
            spr.on('pointerover', ()=>{ if(spr.alpha > 0.4) spr.alpha = 0.8; _showWpnTip(spr, wid); });
            spr.on('pointerout',  ()=>{ this._refreshWeaponBtns(); _hideWpnTip(); });
            win.addChild(spr);
            this._bossFightWpnSprs.push({ spr, id:cfg.id });
        }
        win.addChild(_wpnTipBg);
        win.addChild(_wpnTipTxt);

        // ── МНОЖИТЕЛЬ: индивидуальный для каждого донатного оружия ─────────
        // _bossFightWpnMultIdx[weaponId] — индекс в MULT_OPTIONS для каждого оружия (0-5)
        this._bossFightWpnMultIdx = [0, 0, 0, 0, 0, 0];
        this._bossFightMultLabels = [];
        // Координаты множителей закреплены так же, как вручную выставленный ×1 автомата
        // (x=833, y=714 на канвасе). Отдельная строка с числом доступных ударов не нужна:
        // игрок выбирает именно расход патронов на ОДИН удар.
        const MULT_LABEL_POS = {
            3: {x:668, y:714}, // мачете
            4: {x:751, y:714}, // ствол
            5: {x:833, y:714}, // автомат
        };

        // 08.10.2026 (по прямому указанию — "показывай количество оружия, которым игрок может
        // атаковать, в зависимости от коэффициента"): сколько ударов ЕЩЁ доступно донатным
        // оружием при ВЫБРАННОМ множителе — floor(qty / mult). Пример из указания: qty=100,
        // mult=×1 (по умолчанию) → 100 ударов; тот же qty=100, mult=×2 → 50 ударов (патроны
        // тратятся по mult штук за удар, см. _showWpnTip/computeModifiedDamage выше — тот же
        // mult, что умножает урон за удар). Координаты — X те же, что у метки множителя, Y на
        // 80px выше (измерено по мачете: 714-80=634, та же дельта для ствола/автомата).
        this._bossFightAmmoCountLabels = [];

        for(let i = 0; i < WPN_BTNS.length; i++){
            const wid = WPN_BTNS[i].id;

            if(wid >= 3){ // только донатные: мачете(3), ствол(4), автомат(5)
                const multLbl = new PIXI.Text('×1', {
                    fontFamily:'Southbank LT', fontSize:12, fill:'#ffcc44',
                    dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
                });
                const pos = MULT_LABEL_POS[wid];
                multLbl.anchor.set(0.5,1); multLbl.x=pos.x; multLbl.y=pos.y;
                multLbl.interactive=true; multLbl.buttonMode=true;
                const _wid = wid;
                multLbl.on('pointerdown', ()=>{
                    const opts = window.bosses ? bosses.MULT_OPTIONS : [1,10,50,100,500,1000];
                    const totalOpts = opts.length; // МАКС убран
                    this._bossFightWpnMultIdx[_wid] = (this._bossFightWpnMultIdx[_wid] + 1) % totalOpts;
                    this._refreshWeaponBtns();
                });
                win.addChild(multLbl);
                this._bossFightMultLabels[i] = multLbl;

                const ammoLbl = new PIXI.Text('0', {
                    fontFamily:'Southbank LT', fontSize:14, fill:'#ffffff',
                    dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
                });
                ammoLbl.anchor.set(0.5,1); ammoLbl.x = pos.x; ammoLbl.y = pos.y - 80;
                win.addChild(ammoLbl);
                this._bossFightAmmoCountLabels[i] = ammoLbl;

            } else {
                this._bossFightMultLabels[i] = null;
                this._bossFightAmmoCountLabels[i] = null;
            }
        }

        // Кнопка "Седой" (портрет Сидоровича) — виден только если хабар куплен.
        // Наведение показывает остаток урона Седого (n/m), клик тратит весь остаток на текущего босса.
        const sidBtn = new PIXI.Sprite(PIXI.Texture.from(B + 'боевка кнопка сидорович.png'));
        sidBtn.x = 871; sidBtn.y = 620;
        sidBtn.interactive = true; sidBtn.buttonMode = true;
        sidBtn.on('pointerover', ()=>{
            _sa(sidBtn, 0.8);
            const total = parseInt(udata['sedoy_dmg_total'] || 0);
            const left  = parseInt(udata['sedoy_dmg_left']  || 0);
            if(left <= 0) return; // весь урон потрачен — подсказка не показывается
            const fmt = window.helper && helper.formatKK ? helper.formatKK : (n)=>String(n);
            _wpnTipTxt.text = fmt(left) + '/' + fmt(total);
            _wpnTipTxt.x = sidBtn.x + sidBtn.width / 2;
            _wpnTipTxt.y = sidBtn.y - 8;
            _wpnTipBg.clear();
            _wpnTipBg.beginFill(0x000000, 0.75);
            const pad = 6;
            _wpnTipBg.drawRoundedRect(
                _wpnTipTxt.x - _wpnTipTxt.width/2 - pad,
                _wpnTipTxt.y - _wpnTipTxt.height - pad,
                _wpnTipTxt.width + pad*2,
                _wpnTipTxt.height + pad*2, 4
            );
            _wpnTipBg.endFill();
            _wpnTipBg.visible  = true;
            _wpnTipTxt.visible = true;
        });
        sidBtn.on('pointerout', ()=>{ _sa(sidBtn, 1); _hideWpnTip(); });
        sidBtn.on('pointerdown', ()=>this._useSedoyDamage());
        win.addChild(sidBtn);
        this._bossFightSidBtn = sidBtn;

        // Кнопка "не куплен хабар"
        const habarBtn = new PIXI.Sprite(PIXI.Texture.from(B + 'боевка кнопка когда не куплен хабар.png'));
        habarBtn.x = 871; habarBtn.y = 620;
        habarBtn.interactive = true; habarBtn.buttonMode = true;
        habarBtn.on('pointerdown', ()=>{ if(window.habar) habar.open(); });
        win.addChild(habarBtn);
        this._bossFightHabarBtn = habarBtn;

        // ── ПРАВЫЙ БЛОК ───────────────────────────────────────────
        // 25.09.2026 (по прямому указанию, новый файл): "боевка таланты.png" заменён на
        // "скиллы.png" — позиция та же (1044,530), масштаб нативный (1.000, файл уже нужного
        // размера 140×42, отдельный scale.set() не нужен).
        const talentBtn = new PIXI.Sprite(PIXI.Texture.from(B + 'скиллы.png'));
        talentBtn.x = 1044; talentBtn.y = 530;
        talentBtn.interactive = true; talentBtn.buttonMode = true;
        talentBtn.on('pointerover', ()=>{ _sa(talentBtn, 0.8); talentBtn.scale.set(1.08); });
        talentBtn.on('pointerout', ()=>{ _sa(talentBtn, 1); talentBtn.scale.set(1); });
        talentBtn.on('pointerdown', ()=>{ if(window.iface) iface._openBossesSkillsScreen(); });
        win.addChild(talentBtn);

        const crownSpr = new PIXI.Sprite(PIXI.Texture.from(B + 'боевка корона эмблема.png'));
        crownSpr.x = 1213; crownSpr.y = 531;
        win.addChild(crownSpr);

        // Прогресс-бар навыков — 25.09.2026 (по прямому указанию, файлы присланы отдельно):
        // тот же приём, что и полоска ХП выше (фон + обрезаемая по ширине полоска), но здесь
        // цвет один и не меняется по порогам — "полоса пустая"/"полоса заполнения".
        const progBg = new PIXI.Sprite(PIXI.Texture.from(B + 'боевка скилл полоса пустая.png'));
        progBg.x = 972; progBg.y = 583;
        progBg._uDraggable = true;
        win.addChild(progBg);

        const progBar = new PIXI.Sprite(PIXI.Texture.from(B + 'боевка скилл полоса заполнения.png'));
        progBar.x = 972; progBar.y = 583; progBar.height = 24;
        progBar._uDraggable = true;
        win.addChild(progBar);
        this._bossFightProgBar = progBar;

        const progTxt = new PIXI.Text('0/0', {
            fontFamily:'Southbank LT', fontSize:19, fill:'#ffffff',
        });
        // 03.10.2026 (редактор позиций): добавлен scale 1.186.
        progTxt.anchor.set(0.5, 0.5); progTxt.x = 1115; progTxt.y = 595;
        win.addChild(progTxt);
        this._bossFightProgTxt = progTxt;

        // ОЧКИ / НОВЫЕ — 20.09.2026 (по прямому указанию, файлы присланы отдельно, та же схема,
        // что подложки ячеек топа в svod-leaderboard.js): подложки под текст, координаты — точный
        // снимок пользователя через редактор позиций/PSD (X:1041,Y:618 и X:1199,Y:618),
        // размеры — реальный PNG (76×39 и 40×40, прочитаны из IHDR). Текст центрируется
        // anchor(0.5,0.5) относительно ЦЕНТРА подложки — тот же приём, что centerX() в
        // svod-leaderboard.js, только без отдельного хелпера (здесь только 2 таких блока).
        const PTS_BG = { x: 1041, y: 618, w: 76, h: 39 };
        const NEW_BG = { x: 1199, y: 618, w: 40, h: 40 };

        const ptsBg = new PIXI.Sprite(PIXI.Texture.from(B + 'табличка под очки.png'));
        ptsBg.x = PTS_BG.x; ptsBg.y = PTS_BG.y; win.addChild(ptsBg);

        // 03.10.2026 (по прямому указанию — "кол-во новых очков и прокачанных опусти вниз на
        // 1px, сдвинь вправо на 1px, уменьши жирность"): fontWeight bold → normal.
        const ptsTxt = new PIXI.Text('—', {
            fontFamily:'Southbank LT', fontSize:27, fill:'#ffffff', fontWeight:'normal',
        });
        ptsTxt.anchor.set(0.5, 0.5);
        // 04.10.2026 (редактор позиций — "кол-во прокачанных очков"): x:1080 y:639 scale:1.521.
        ptsTxt.x = 1080; ptsTxt.y = 639;
        win.addChild(ptsTxt);
        this._bossFightPtsTxt = ptsTxt;

        const newBg = new PIXI.Sprite(PIXI.Texture.from(B + 'круг под новые очки.png'));
        newBg.x = NEW_BG.x; newBg.y = NEW_BG.y; win.addChild(newBg);

        // 03.10.2026 (см. коммент у ptsTxt выше — тот же батч правок): fontWeight bold → normal.
        const newTxt = new PIXI.Text('—', {
            fontFamily:'Southbank LT', fontSize:27, fill:'#ffffff', fontWeight:'normal',
        });
        newTxt.anchor.set(0.5, 0.5);
        // 04.10.2026 (редактор позиций — "кол-во новых очков"): x:1220 y:639 scale:1.521.
        newTxt.x = 1220; newTxt.y = 639;
        win.addChild(newTxt);

        this._bossFightNewTxt = newTxt;

        // Кнопка Прокачать
        const upgradeBtn = new PIXI.Sprite(PIXI.Texture.from(B + 'боевка кнопка прокачать.png'));
        upgradeBtn.x = 992; upgradeBtn.y = 662;
        upgradeBtn.interactive = true; upgradeBtn.buttonMode = true;
        upgradeBtn.on('pointerover', ()=>{ _sa(upgradeBtn, 0.8); upgradeBtn.scale.set(1.08); });
        upgradeBtn.on('pointerout', ()=>{ _sa(upgradeBtn, 1); upgradeBtn.scale.set(1); });
        upgradeBtn.on('pointerdown', ()=>{ if(window.iface) iface._openBossesSkillsScreen(); });
        win.addChild(upgradeBtn);

        // Кнопки выйти из боя и перезагрузить (левая панель, под таймером)
        const exitFightBtn = new PIXI.Sprite(PIXI.Texture.from(B + 'выйти из боя.png'));
        exitFightBtn.x = 143; exitFightBtn.y = 252;
        exitFightBtn.interactive = true; exitFightBtn.buttonMode = true;
        exitFightBtn.on('pointerover', ()=>{ _sa(exitFightBtn, 0.8); exitFightBtn.scale.set(1.08); });
        exitFightBtn.on('pointerout',  ()=>{ _sa(exitFightBtn, 1); exitFightBtn.scale.set(1); });
        exitFightBtn.on('pointerdown', ()=>this._forfeitBossFight());
        win.addChild(exitFightBtn);

        const reloadFightBtn = new PIXI.Sprite(PIXI.Texture.from(B + 'перезагрузка боя.png'));
        reloadFightBtn.x = 5; reloadFightBtn.y = 251;
        reloadFightBtn.interactive = true; reloadFightBtn.buttonMode = true;
        reloadFightBtn.on('pointerover', ()=>{ _sa(reloadFightBtn, 0.8); reloadFightBtn.scale.set(1.08); });
        reloadFightBtn.on('pointerout',  ()=>{ _sa(reloadFightBtn, 1); reloadFightBtn.scale.set(1); });
        reloadFightBtn.on('pointerdown', ()=>{
            const bossIdx = this._bossFightBossIdx;
            const refresh = () => {
                if(!this._bossFightWin || !this._bossFightWin.parent || this._bossFightBossIdx !== bossIdx) return;
                this._updateBossFightHpDisplay();
                this._updateBossFightStats();
                this._loadBossFightRating(bossIdx);
            };
            if(window.bosses && typeof bosses._syncFriendsDamage === 'function'){
                bosses._syncFriendsDamage(bossIdx, refresh);
            } else {
                refresh();
            }
        });
        win.addChild(reloadFightBtn);

        // 25.09.2026 (по прямому указанию, референс с похожей игры — "при ударе экран
        // немного краснеет"): полноэкранный красный оверлей, ПОСЛЕДНИЙ ребёнок win — рендерится
        // поверх всего экрана боя (боевка/HP-бар/оружие и т.д.), но НЕ перехватывает клики
        // (interactive не включён, pointer-события проходят сквозь него к кнопкам под ним).
        // Чисто визуальный эффект, ничего не пишет на сервер/БД — экономику не трогает.
        // 26.09.2026 (по прямому указанию, скриншот — "должно краснеть не всё, а только
        // внутренний экран, панели рейтинга и скиллов встроены в фон и не должны краснеть"):
        // вместо одного drawRect на весь канвас — заливка только той части экрана, которая
        // ДОЛЖНА краснеть. Координаты исключаемых блоков — из замера пользователя в Photoshop
        // панелью "Перспектива" (та же система координат, что canvas игры 1280×720 —
        // подтверждено совпадением 1-в-1 с reloadFightBtn(5,251)/exitFightBtn(143,252) ниже).
        // 26.09.2026 (повторный баг, тот же скриншот — "появилась диагональная линия"):
        // первая версия резала эти блоки через PIXI.Graphics.beginHole()/endHole() — но
        // несколько "дыр" (панель рейтинга, ряд оружия, панель скиллов) доходят вплотную до
        // края канваса (x=0/x=1280/y=720), а earcut-триангуляция, которую Graphics использует
        // под капотом, ломается именно на дырах, касающихся внешней границы фигуры — вместо
        // чистого выреза получается лишний диагональный треугольник (это и было той красной
        // полосой). Фикс — без единой дыры: экран разбит вручную на 5 отдельных закрашенных
        // прямоугольников-полос (сверху вниз), которые в сумме покрывают ровно всё, КРОМЕ этих
        // 4 UI-блоков (шапка босса+кнопки, панель рейтинга, ряд оружия, панель скиллов).
        const HIT_FLASH_RECTS = [
            { x: 0,   y: 0,   w: 1280, h: 73  }, // самый верх (всё равно скрыт под iface.up)
            { x: 274, y: 73,  w: 1006, h: 219 }, // полоса справа от шапки босса/кнопок
            { x: 0,   y: 292, w: 1280, h: 180 }, // между кнопками и нижними панелями, во всю ширину
            { x: 379, y: 472, w: 901,  h: 47  }, // между верхом панели рейтинга и верхом панели скиллов
            { x: 379, y: 519, w: 574,  h: 91  }, // между панелью рейтинга и панелью скиллов, до ряда оружия
        ];
        const hitFlash = new PIXI.Graphics();
        hitFlash.beginFill(0xcc0000, 1);
        HIT_FLASH_RECTS.forEach(r => hitFlash.drawRect(r.x, r.y, r.w, r.h));
        hitFlash.endFill();
        hitFlash.alpha = 0;
        win.addChild(hitFlash);
        this._bossHitFlashOverlay = hitFlash;

        // 25.09.2026 (по прямому указанию — "эффект критического урона"): скрыт по умолчанию —
        // показывается по реальному критическому удару (res.critical уже считался сервером, см.
        // bosses.php:781-820 и bosses-combat.js._attack()) и принудительно через dev-панель
        // (тестовый бой с Охотником) для позиционирования через universal_pos_editor.js.
        // Позиция/масштаб/поворот выбираются случайно из CRIT_EFFECT_VARIANTS на каждый показ
        // (см. _pickCritEffectVariant()) — начальные x/y/scale/rotation здесь не важны.
        const critEffect = new PIXI.Sprite(PIXI.Texture.from('./images/эффект критический урон.png'));
        critEffect.anchor.set(0.5, 0.5);
        critEffect.visible = false;
        win.addChild(critEffect);
        this._bossCritEffectSpr = critEffect;

        this._bossFightWin = win;
    };

    // Красная вспышка на удар — по прямому указанию, референс со скриншота похожей игры:
    // непрозрачность 60-70% сразу, затем быстро (за FLASH_DURATION_MS) уходит в 0. Вызывается
    // из bosses-combat.js._attack() сразу после успешного ответа сервера (свой удар состоялся).
    proto._flashBossHitScreen = function(){
        const overlay = this._bossHitFlashOverlay;
        if(!overlay) return;
        const FLASH_START_ALPHA = 0.65;
        const FLASH_DURATION_MS = 300;
        overlay.alpha = FLASH_START_ALPHA;
        const startTs = (window.performance && performance.now) ? performance.now() : Date.now();
        const _fadeStep = () => {
            // Экран боя мог закрыться, пока анимация ещё идёт (быстрый выход после удара) —
            // overlay.parent проверяем, чтобы не гонять rAF вхолостую на удалённом объекте.
            if(!overlay.parent) return;
            const now = (window.performance && performance.now) ? performance.now() : Date.now();
            const t = Math.min(1, (now - startTs) / FLASH_DURATION_MS);
            overlay.alpha = FLASH_START_ALPHA * (1 - t);
            if(t < 1) requestAnimationFrame(_fadeStep);
        };
        requestAnimationFrame(_fadeStep);
    };

    // 25.09.2026 (по прямому указанию — "каждый раз выбирается рандомная позиция из вариантов"):
    // ставит спрайт критического эффекта в случайный вариант позиции/масштаба/поворота из
    // CRIT_EFFECT_VARIANTS. Общая для _showCriticalEffect() и _devShowCriticalEffectPersistent(),
    // чтобы dev-режим позиционирования показывал ТОТ ЖЕ разброс вариантов, что и реальный бой.
    proto._pickCritEffectVariant = function(){
        const spr = this._bossCritEffectSpr;
        if(!spr) return;
        const v = CRIT_EFFECT_VARIANTS[Math.floor(Math.random() * CRIT_EFFECT_VARIANTS.length)];
        spr.x = v.x; spr.y = v.y;
        spr.scale.set(v.scale);
        spr.rotation = v.rot * Math.PI / 180;
    };

    // 25.09.2026 (по прямому указанию — "эффект критического урона"): показывает
    // critEffect (в случайном варианте позиции/размера/поворота) на ~0.85с и прячет обратно.
    // Вызывается из bosses-combat.js._attack() при res.critical===true (реальный крит,
    // посчитанный сервером) и из dev-панели (принудительно, для позиционирования через редактор).
    proto._showCriticalEffect = function(){
        const spr = this._bossCritEffectSpr;
        if(!spr) return;
        clearTimeout(this._bossCritEffectHideTimer);
        if(window.gsap) gsap.killTweensOf(spr);
        this._pickCritEffectVariant();
        spr.visible = true;
        spr.alpha = 1;
        if(window.gsap){
            gsap.to(spr, {alpha: 0, duration: 0.35, delay: 0.5, onComplete: () => { spr.visible = false; }});
        } else {
            this._bossCritEffectHideTimer = setTimeout(() => { spr.visible = false; }, 850);
        }
    };

    // 25.09.2026 (dev-панель — "показать эффект, чтобы двигать его в редакторе позиций"):
    // тот же спрайт, но БЕЗ автоскрытия — обычный _showCriticalEffect() прячет его через
    // ~0.85с, этого не хватит, чтобы спокойно найти и подвигать элемент в
    // universal_pos_editor.js. Только для dev-панели, в реальном бою не вызывается.
    proto._devShowCriticalEffectPersistent = function(){
        const spr = this._bossCritEffectSpr;
        if(!spr) return;
        clearTimeout(this._bossCritEffectHideTimer);
        if(window.gsap) gsap.killTweensOf(spr);
        this._pickCritEffectVariant();
        spr.visible = true;
        spr.alpha = 1;
    };

    // ── ОБНОВЛЕНИЕ ДАННЫХ ──────────────────────────────────────────

    proto._updateBossesFight = function(bossIdx){
        this._bossFightBossIdx = bossIdx;
        this._bossFightDiffIdx = window.bosses ? bosses._diffIdx : 0;
        if(this._bossFightModeSprs)
            this._bossFightModeSprs.forEach((s, i)=>{ s.alpha = i === this._bossFightDiffIdx ? 1 : (i === 3 ? 0.6 : 0.45); });

        const BOSS_BGS = [
            'боевка с боссом охотник v2.png',
            'боевка с боссом счастливчик v2.png',
            'боевка с боссом ястреб v2.png',    'боевка с боссом меченный v2.png',
            'боевка с боссом крыс.png',      'боевка с боссом баркут.png',
            'боевка с боссом борода.png',    'боевка с боссом жгут.png',
        ];
        if(this._bossFightBg)
            this._bossFightBg.texture = PIXI.Texture.from('./images/' + (BOSS_BGS[bossIdx] || BOSS_BGS[0]));


        if(this._bossFightNameTxt && window.bosses)
            this._bossFightNameTxt.text = bosses.data[bossIdx].name.toUpperCase();

        this._updateBossFightHpDisplay();
        this._refreshWeaponBtns();
        this._updateBossFightStats();

        // habar_bought = куплен ли контейнер хабара (habar.js._buyAndOpen). habar_counts — не то поле,
        // это счётчик заначек, к покупке хабара отношения не имеет (был перепутан).
        const habarPurchased = parseInt(udata && udata['habar_bought'] || 0) > 0;
        if(this._bossFightHabarBtn) this._bossFightHabarBtn.visible = !habarPurchased;
        if(this._bossFightSidBtn)   this._bossFightSidBtn.visible   = habarPurchased;

        this._loadBossFightRating(bossIdx);
    };

    // Пересчитывает видимость кнопок "купить хабар" / "Седой" без полного ребилда экрана боя.
    // Нужно вызывать после покупки хабара в оверлее habar.js, т.к. тот открывается ПОВЕРХ
    // экрана боя и при закрытии не триггерит _updateBossesFight сам по себе — иконка
    // "не куплен хабар" оставалась висеть даже после покупки.
    proto._refreshBossFightHabarBtn = function(){
        if(!this._bossFightWin || !this._bossFightWin.parent) return;
        const habarPurchased = parseInt(udata && udata['habar_bought'] || 0) > 0;
        if(this._bossFightHabarBtn) this._bossFightHabarBtn.visible = !habarPurchased;
        if(this._bossFightSidBtn)   this._bossFightSidBtn.visible   = habarPurchased;
    };

    // Клик по иконке "Седой" — тратит весь оставшийся урон Седого на текущего босса разом.
    // 26.09.2026 (баг найден по прямому указанию — "боевка вылетает с ошибкой, когда босс убит
    // уроном седого"): раньше HP уменьшался ТОЛЬКО локально (bosses._setHp() прямо здесь), а
    // bosses._onDefeat(idx) звался сразу же — но сервер держит СОБСТВЕННЫЙ независимый HP
    // (boss_fight_session, см. большой комментарий в bosses.php над useSedoy()/_syncFightSession()),
    // который про удар седого ничего не знал: claimKill() честно видел HP>0 и отвечал fail(67)
    // ("Бой ещё не завершён"), из-за чего боёвка вылетала с ошибкой вместо победного попапа.
    // Теперь удар седого — реальный серверный запрос (bosses.useSedoy, пишется в тот же
    // boss_damage_log, что и обычная атака) — HP на клиенте и сервере остаются согласованы, и
    // _onDefeat() дальше отрабатывает как после обычного добивающего удара.
    proto._useSedoyDamage = function(){
        if(!window.bosses || !window.TS) return;
        // 30.09.2026 (по прямому указанию — "урон Седого нельзя использовать в Соло"):
        // Соло (diffIdx=3) — режим "один на один", помощь Седого ломает саму суть режима.
        // Блок ТОЛЬКО здесь (в диспетчере клика), сервер тоже проверяет то же самое в
        // bosses.php.useSedoy() (fail(90)) — клиентский модифицированный запрос не обойдёт.
        if(bosses._diffIdx === 3){
            notify.showResult({text:'Братух, мы же договорились — один на один. Справляйся как-нибудь сам!'}, 0);
            return;
        }
        const idx = this._bossFightBossIdx;
        const left = parseInt(udata['sedoy_dmg_left'] || 0);
        if(left <= 0){
            notify.showResult({text:'Седой достаточно помог на сегодня, проси завтра'}, 0);
            return;
        }
        const curHp = bosses._hp(idx);
        if(curHp <= 0) return;
        if(this._sedoyInFlight) return; // не даём накопить параллельные запросы при быстрых кликах
        this._sedoyInFlight = true;

        if(window.suspendPlayerSave) suspendPlayerSave('boss_use_sedoy');
        TS.php('bosses.useSedoy', {boss_id: idx, diff_idx: bosses._diffIdx}, (res) => {
            this._sedoyInFlight = false;
            console.log('[bosses_fight._useSedoyDamage] ← ответ сервера | bossIdx=', idx, 'dealt=', res.dealt, 'hp=', res.hp, 'maxHp=', res.maxHp);
            applyPatch(res.patch);
            if(window.resumePlayerSave) resumePlayerSave('boss_use_sedoy');
            bosses._setHp(idx, res.hp);
            bosses._saveToUdata();
            if(window.iface) iface.updateUp();

            notify.showResult({text:'Седой ударил на ' + (window.helper ? helper.formatKK(res.dealt) : res.dealt) + ' урона!'}, 1);

            // 27.09.2026 (по прямому указанию, репорт игроков — "урон от друзей и рейтинг урона
            // не обновляется при нанесении урона... такой же функционал как и у кнопки
            // перезагрузить"): удар седого — такой же реальный удар, что и обычная атака
            // (bosses.useSedoy пишет в тот же boss_damage_log, см. коммент в шапке функции), но
            // здесь после ответа сервера обновлялся ТОЛЬКО HP-бар — ни панель «РЕЙТИНГ УРОНА»
            // (_loadBossFightRating), ни панель очков скиллов (_updateBossFightStats) не
            // перерисовывались, в отличие от _attack() (bosses-combat.js, тот же набор вызовов
            // после КАЖДОГО обычного удара — см. коммент там от 22.09.2026) и кнопки
            // ПЕРЕЗАГРУЗИТЬ (reloadFightBtn выше). Тот же набор вызовов — здесь же.
            this._updateBossFightHpDisplay();
            this._updateBossFightStats();
            this._loadBossFightRating(idx);
            if(res.hp <= 0) bosses._onDefeat(idx);
        }, (err) => {
            this._sedoyInFlight = false;
            if(window.resumePlayerSave) resumePlayerSave('boss_use_sedoy');
            console.error('[bosses_fight._useSedoyDamage] ← ошибка сервера:', JSON.stringify(err));
            const MSGS = {
                65: 'Бой не начат — откройте экран боя заново',
                66: 'Бой уже протух — начните заново',
                68: 'Седой достаточно помог на сегодня, проси завтра',
                90: 'Братух, мы же договорились — один на один. Справляйся как-нибудь сам!',
            };
            notify.showResult({text: (err && MSGS[err.code]) || 'Не удалось применить урон Седого'}, 0);
        });
    };

    // 09.10.2026 — см. комментарий у создания hpTooltip выше. Текущие cur/max считаются ЗАНОВО
    // по тем же полям, что и _updateBossFightHpDisplay() (bosses.hpByDiff/BOSS_HP) — не кэш,
    // поэтому тултип не может показать устаревшее число, даже если ХП изменилось, пока он уже
    // был открыт (pointerover срабатывает заново при каждом новом наведении).
    proto._showBossFightHpTooltip = function(){
        if(!window.bosses || !this._bossFightHpTooltip) return;
        const idx = this._bossFightBossIdx; const di = this._bossFightDiffIdx;
        const cur = Math.max(0, Math.round(bosses.hpByDiff[di][idx]));
        const max = Math.round(bosses.BOSS_HP[idx][di]);
        const txt = this._bossFightHpTooltipTxt;
        txt.text = cur.toLocaleString('ru') + ' / ' + max.toLocaleString('ru');
        const padX = 12, padY = 8;
        const bg = this._bossFightHpTooltipBg;
        bg.clear();
        bg.beginFill(0x111111, 0.92); bg.lineStyle(1, 0x5a4a2a);
        bg.drawRoundedRect(-txt.width/2 - padX, -txt.height/2 - padY, txt.width + padX*2, txt.height + padY*2, 4);
        bg.endFill();
        this._bossFightHpTooltip.x = 136; this._bossFightHpTooltip.y = 110;
        this._bossFightHpTooltip.visible = true;
    };

    proto._updateBossFightHpDisplay = function(){
        if(!window.bosses) return;
        const idx = this._bossFightBossIdx; const di = this._bossFightDiffIdx;
        const cur = bosses.hpByDiff[di][idx]; const max = bosses.BOSS_HP[idx][di];
        if(this._bossFightHpTxt) this._bossFightHpTxt.text = bosses._fmt(cur) + ' / ' + bosses._fmt(max);
        if(this._bossFightHpBar){
            const pct = max > 0 ? Math.max(0, cur / max) : 0;
            if(pct > 0){
                this._bossFightHpBar.visible = true;
                this._bossFightHpBar.texture = PIXI.Texture.from('./images/' + _hpTexture(pct));
                this._bossFightHpBar.width = Math.max(2, Math.floor(248 * pct));
                this._bossFightHpBar.height = 28;
            } else {
                this._bossFightHpBar.visible = false;
            }
        }
    };

    proto._refreshWeaponBtns = function(){
        if(!this._bossFightWpnSprs) return;
        const MULT_OPTS  = window.bosses ? bosses.MULT_OPTIONS : [1,10,50,100,500,1000];
        const WPN_KEYS   = {3:'мачете', 4:'ствол', 5:'автомат'};

        for(let i = 0; i < this._bossFightWpnSprs.length; i++){
            const {spr, id} = this._bossFightWpnSprs[i];
            const wp = window.weapons ? weapons.data[id] : null;

            // Все оружия всегда кликабельны — не купленные показывают попап
            spr.alpha = 1;
            spr.interactive = true;
            spr.buttonMode  = true;

            const multLbl = this._bossFightMultLabels ? this._bossFightMultLabels[i] : null;
            const ammoLbl = this._bossFightAmmoCountLabels ? this._bossFightAmmoCountLabels[i] : null;
            if(id >= 3){ // донатное оружие — показываем множитель расхода и доступное число ударов
                const mi    = (this._bossFightWpnMultIdx && this._bossFightWpnMultIdx[id]) || 0;
                const mult  = MULT_OPTS[mi] || 1;
                const mTxt  = mult >= 1000 ? '×1K' : '×' + mult;
                if(multLbl){ multLbl.text = mTxt; multLbl.interactive = true; }

                // 08.10.2026: доступные удары при текущем множителе = floor(патроны / mult) —
                // mult патронов списывается за ОДИН удар (см. bosses.php.attack()/
                // computeModifiedDamage выше — тот же mult определяет и урон, и расход).
                if(ammoLbl){
                    const qty = wp ? (parseInt(wp.qty) || 0) : 0;
                    ammoLbl.text = String(Math.floor(qty / mult));
                }
            } else { // бесплатное оружие — никаких меток
                if(multLbl) multLbl.text = '';
                if(ammoLbl) ammoLbl.text = '';
            }
        }
    };

    proto._updateBossFightStats = function(){
        // ОЧКИ — уже вложенные (потраченные) очки скиллов, НОВЫЕ — доступные, но ещё не вложенные.
        // 20.09.2026: раньше НОВЫЕ текст сдвигался вручную по числу цифр (отдельной таблицей) —
        // подложки не было, это была лишь приблизительная имитация центрирования. Теперь оба
        // текста центрируются anchor(0.5,0.5) относительно СВОИХ подложек (см. их создание выше)
        // и не требуют пересчёта X при смене количества цифр — ручной сдвиг убран как лишний.
        if(this._bossFightPtsTxt)
            this._bossFightPtsTxt.text = window.skills ? String(skills.spentPoints || 0) : '—';
        if(this._bossFightNewTxt)
            this._bossFightNewTxt.text = window.skills ? String(skills.availablePoints || 0) : '—';
        if(window.skills && this._bossFightProgBar && this._bossFightProgTxt){
            // Когда все 460 очков получены (~20кк урона) — шкала должна выглядеть ПОЛНОЙ,
            // а не "0/1" (skills._xp/_xpNext специально обнуляются в этом случае в skills.js).
            const maxed = skills.earnedPoints >= 460;
            const cur = skills._xp || 0; const next = skills._xpNext || 100;
            this._bossFightProgTxt.text = maxed ? 'МАКС' : (cur + '/' + next);
            const pct = maxed ? 1 : (next > 0 ? Math.min(1, cur / next) : 0);
            if(pct > 0){
                this._bossFightProgBar.visible = true;
                this._bossFightProgBar.width = Math.max(2, Math.floor(287 * pct));
                this._bossFightProgBar.height = 24;
            } else {
                this._bossFightProgBar.visible = false;
            }
        }
    };

    // ── АТАКА ─────────────────────────────────────────────────────

    proto._attackWithWeapon = function(weapIdx){
        if(!window.bosses){ notify.showResult({text:'Модуль боссов не загружен!'}, 0); return; }
        if(!window.weapons){ notify.showResult({text:'Модуль оружия не загружен!'}, 0); return; }
        const wp = weapons.data[weapIdx];
        if(!wp){ notify.showResult({text:'Оружие не найдено!'}, 0); return; }

        // Мачете, ствол и автомат покупаются в оружейке. Если предмет не куплен или его
        // количество закончилось, для всех трёх показываем один и тот же попап покупки.
        if(weapIdx > 2 && (!wp.owned || (parseInt(wp.qty)||0) <= 0)){
            this._openNoWeaponPopup();
            return;
        }

        const prevIdx = weapons.data.findIndex(w=>w.equipped);
        weapons.data.forEach(w=>w.equipped=false);
        weapons.data[weapIdx].equipped = true;

        bosses._diffIdx = this._bossFightDiffIdx;
        bosses.selected = this._bossFightBossIdx;

        // Устанавливаем множитель конкретного оружия (только для донатных)
        const prevMultIdx   = bosses._multIdx;
        const prevOverride  = bosses._multOverride;
        if(weapIdx >= 3 && this._bossFightWpnMultIdx){
            const mi = this._bossFightWpnMultIdx[weapIdx] || 0;
            bosses._multIdx = mi;
            bosses._multOverride = null;
            console.log('[bosses_fight._attackWithWeapon] wpn='+weapIdx+' mi='+mi);
        }
        bosses._attack();
        bosses._multIdx     = prevMultIdx;
        bosses._multOverride = prevOverride;

        weapons.data.forEach(w=>w.equipped=false);
        if(prevIdx >= 0) weapons.data[prevIdx].equipped = true;

        this._updateBossFightHpDisplay();
        this._updateBossFightStats();
        this._refreshWeaponBtns();
    };

    proto._openNoWeaponPopup = function(){
        if(this._noWpnWin && this._noWpnWin.parent) this._noWpnWin.parent.removeChild(this._noWpnWin);
        const BASE = './images/';
        const win = new PIXI.Container();
        win.interactive = true;

        const bg = new PIXI.Sprite(PIXI.Texture.from(BASE + 'не хватает оружия.png'));
        win.addChild(bg);

        // 25.09.2026 (по прямому указанию, скриншот — "нет варианта Актив, вернулась старая
        // ошибка"): 'купить актив.png' на сервере был битым файлом (полноэкранный холст с
        // кнопкой где-то внутри), заменён на верную вплотную обрезанную кнопку (236×105, см.
        // подробный коммент в yashik.js._buildBuyPatronWin).
        // 26.09.2026 (по прямому указанию, повторный снимок редактором позиций — x/y/scale/w/h
        // сняты отдельно от хитбокса ниже, они больше не завязаны на одни и те же числа).
        const купитьActiv = new PIXI.Sprite(PIXI.Texture.from(BASE + 'купить актив.png'));
        купитьActiv.anchor.set(0.5, 0.5);
        купитьActiv.x = 548; купитьActiv.y = 406;
        купитьActiv.scale.set(1.000);
        купитьActiv.visible = false;
        win.addChild(купитьActiv);

        const отменаActiv = new PIXI.Sprite(PIXI.Texture.from(BASE + 'отмена актив.png'));
        отменаActiv.x = 655; отменаActiv.y = 352; // снято редактором позиций 17.09.2026
        отменаActiv.visible = false;
        win.addChild(отменаActiv);

        const _flash = (spr, cb) => { spr.visible=true; setTimeout(()=>{ spr.visible=false; if(cb)cb(); }, 180); };

        // КУПИТЬ → открыть оружейку
        // 24.09.2026 (по прямому указанию, повторно — этот попап пропустили при переводе всех
        // поп-апов confirm/cancel на параллелограммные хит-зоны, см. popup-hit-shapes.js уже
        // применённый в confirm.js/sound.js/nick.js): координаты/размеры те же, что были у
        // прямоугольника (сняты пользователем ранее под этот конкретный PNG), только форма —
        // тот же slant=18, что и везде в игре.
        // 26.09.2026: хитбокс сдвинут отдельно от самой кнопки-картинки (см. купитьActiv выше) —
        // снят редактором позиций как отдельный элемент (было 423,389,197,43).
        const hitBuy = makeParallelogramHit(win, 442, 388, 219, 36, 18);
        hitBuy.on('pointerdown', ()=>{ _flash(купитьActiv, ()=>{ win.visible=false; if(window.weapons) weapons.open(); }); });

        // ОТМЕНА — точная хит-зона из редактора позиций: x:666, y:388, 219×36.
        const hitCancel = makeParallelogramHit(win, 666, 388, 219, 36, 18);
        hitCancel.on('pointerdown', ()=>{ _flash(отменаActiv, ()=>{ win.visible=false; if(window.iface && iface.down && root.layer1_mc) root.layer1_mc.addChild(iface.down); }); });

        this._noWpnWin = win;
        root.layer2_mc.addChild(win);
        if(window.iface && iface.up) root.layer2_mc.addChild(iface.up);
        console.log('[bosses_fight._openNoWeaponPopup] попап "не хватает оружия" открыт');
        console.log('[bosses_fight._openNoWeaponPopup] layer2 children:', root.layer2_mc.children.length,
            root.layer2_mc.children.map((c,i)=>`[${i}]${c.constructor.name}v=${c.visible}`).join(' '));
        if(window.weapons){
            console.log('[bosses_fight._openNoWeaponPopup] weapons._win:', weapons._win ? 'ЕСТЬ(visible='+weapons._win.visible+',parent='+(weapons._win.parent?'YES':'null')+')' : 'null');
            console.log('[bosses_fight._openNoWeaponPopup] weapons._confirmWin:', weapons._confirmWin ? 'ЕСТЬ(visible='+weapons._confirmWin.visible+')' : 'null');
            console.log('[bosses_fight._openNoWeaponPopup] weapons._errorWin:', weapons._errorWin ? 'ЕСТЬ(visible='+weapons._errorWin.visible+')' : 'null');
        }
    };

    // ── РЕЙТИНГ (с сервера) ────────────────────────────────────────

    // 22.09.2026: раньше здесь ПЕРЕД запросом рейтинга шёл флаш users.save — bosses.rating()
    // читал МОЙ bossDamage из уже сохранённой строки в БД, которая могла отставать от того,
    // что накоплено в памяти прямо сейчас. Теперь rating() читает boss_damage_log напрямую
    // (пишет его сам сервер синхронно внутри bosses.attack, см. bosses.php) — данные уже
    // гарантированно свежие, отдельный флаш перед запросом не нужен.
    //
    // 24.09.2026 (баг "рейтинг дёргается/мигает троеточием при каждом ударе/перезагрузке/
    // авто-опросе друзей", по прямому указанию + скриншот): раньше эта функция СИНХРОННО
    // сбрасывала все строки на плейсхолдер ('...'/'× —'/пустое фото) ПРЯМО ПЕРЕД запросом —
    // каждый _fetchBossFightRating() (после удара, по кнопке ПЕРЕЗАГРУЗИТЬ, раз в
    // POLL_EVERY_TICKS сек фоновым опросом) вызывался ОТСЮДА, значит панель гарантированно
    // мигала пустотой на время каждого сетевого round-trip, даже когда реальные данные не
    // менялись вообще. Сброс убран — старые значения остаются на экране, пока не придёт ответ
    // сервера, тогда _fetchBossFightRating() сам заменит их на актуальные (или на "---" для
    // ДЕЙСТВИТЕЛЬНО пустых строк — это уже не мигание, а честный результат). Для самого первого
    // открытия боя строки и так показывают статичный плейсхолдер ('—'/'× 0'), заданный при
    // их создании (см. proto._buildBossesFight ниже) — отдельный ранний сброс не нужен.
    proto._loadBossFightRating = function(bossIdx){
        if(!this._bossFightRatingRows) return;
        if(!window.TS || !window.bosses) return;
        this._fetchBossFightRating(bossIdx);
    };

    // 19.09.2026 (баг найден, по прямому указанию: "выхожу из боя и пропадаю из рейтинга у
    // друга") — раньше bosses.rating() отдавал ЖИВОЙ curCycleDmg друзей, который обнулялся
    // вместе с ОКОНЧАНИЕМ ЧУЖОГО боя, из-за чего друг мгновенно пропадал из этой панели, даже
    // если его урон уже был засчитан. Фикс тогда — client-side "пик" (bosses._ratingPeaks),
    // который держал максимум и никогда не давал цифре упасть.
    //
    // 22.09.2026 (баг найден, по прямому указанию — скриншот "у босса 1000 HP, у друга в
    // рейтинге 14.4K, но HP полное и бой только что начался"): после переезда на boss_damage_log
    // (см. большой комментарий в bosses.php над _derivedHp()) урон друга в логе НИКОГДА не
    // исчезает сам по себе — bosses.rating() всегда пересчитывает его заново по МОЕМУ текущему
    // bossStartMs, поэтому "пик" стал не нужен. Хуже — он стал АКТИВНО ВРЕДЕН: peaks[diffIdx]
    // [bossIdx] копится в памяти клиента и НИКОГДА не чистится при старте НОВОЙ попытки против
    // ТОГО ЖЕ босса (сброс есть только при завершении МОЕЙ ЖЕ попытки или при старте боя с
    // ДРУГИМ боссом) — старое значение от предыдущей (уже закрытой много часов назад) попытки
    // против этого же босса показывалось поверх свежего, честного (обычно нулевого) ответа
    // сервера. Убрано целиком — рейтинг теперь всегда отражает res.top как есть.
    proto._fetchBossFightRating = function(bossIdx){
        const diffIdx = this._bossFightDiffIdx;
        const startMs = bosses._bossStartMs[diffIdx][bossIdx];
        if(!startMs) return;
        const rows = this._bossFightRatingRows;
        const isCurrent = () => this._bossFightRatingRows === rows && bosses._bossStartMs[diffIdx][bossIdx] === startMs;
        TS.php('bosses.rating', {boss_id:bossIdx, diff_idx:diffIdx}, (res)=>{
            if(!isCurrent()) return;
            const top = (res && Array.isArray(res.top)) ? res.top : [];
            console.log('[bosses_fight._fetchBossFightRating] boss='+bossIdx+' diff='+diffIdx+' записей от сервера:', JSON.stringify(top));

            this._showBossFightRating(top, isCurrent);
        }, (e)=>{ console.error('[bosses_fight._loadBossFightRating] ошибка запроса bosses.rating для boss='+bossIdx+':', e); });
    };

    // 04.10.2026 (баг найден по прямому указанию — "урон засчитывается, но игроки не выводятся
    // в рейтинге урона: ни никнейм, ни иконка, ни количество урона"): ник/урон раньше
    // проставлялись ТОЛЬКО внутри колбэка bosses._resolveVkUsers() — если этот колбэк не
    // вызывался (VK Bridge/VKWebAppGetAuthToken зависает без resolve/reject, см. ленивый
    // дозапрос токена в _resolveVkUsers() — bosses-combat.js) ВСЯ строка оставалась пустой,
    // хотя сервер (bosses.rating/claimKill) уже честно прислал top с готовыми id/nick/damage —
    // проверено логами: server error_log стабильно отдаёт непустой top с никами участников,
    // при этом панель оставалась пустой. Тот же разрыв, что уже был решён в boss_result.js
    // (ник/урон там выставляются СРАЗУ из top, _resolveVkUsers только докидывает фото) —
    // теперь тот же паттерн и здесь: ник/урон/id выставляются синхронно из top, фото обновляется
    // отдельно, когда (и если) придёт ответ _resolveVkUsers.
    proto._showBossFightRating = function(top, isCurrent = () => true){
        if(!this._bossFightRatingRows) return;
        this._bossFightRatingRows.forEach((row, i) => {
            const entry = top[i];
            if(!entry){
                // 26.09.2026 (по прямому указанию — "не пиши три черточки для имени и белую
                // линию для урона, если данных ещё нет — пусть будет пусто"): раньше '---'/
                // '× —' показывались как плейсхолдеры для пустых строк рейтинга.
                row.nameTxt.text = ''; row.dmgTxt.text = ''; row.id = null; row.nick = null;
                if(row.avSpr) row.avSpr.texture = PIXI.Texture.EMPTY;
                return;
            }
            // Игровой ник (entry.nick) и урон — прямо с сервера, не ждут VK-резолва. Если
            // entry.nick пуст (редкий случай) — оставляем пустым здесь, а не сразу 'Сталкер':
            // ниже, в колбэке _resolveVkUsers, есть шанс подставить настоящее имя VK ПЕРЕД
            // тем, как упасть на общий fallback (тот же приоритет nick → VK-имя → 'Сталкер',
            // что и раньше, см. nickname-everywhere-cancel-btn-panama-rating-log.test.js).
            row.nameTxt.text = entry.nick || '';
            row.dmgTxt.text  = '× ' + (window.helper ? helper.formatKK(entry.damage||0) : entry.damage||0);
            row.id = entry.id; row.nick = entry.nick || null;
        });
        if(!top.length) return;

        // Фото — отдельный, необязательный шаг поверх уже показанных ника/урона. Если
        // _resolveVkUsers зависнет/ошибётся — строки всё равно останутся с корректными данными,
        // просто без аватарки (вместо полностью пустой строки, как было раньше).
        bosses._resolveVkUsers(top.map(e=>e.id), (users) => {
            if(!isCurrent()) return;
            console.log('[bosses_fight._fetchBossFightRating] _resolveVkUsers вернул:', JSON.stringify(users));
            this._bossFightRatingRows.forEach((row, i) => {
                const entry = top[i];
                if(!entry) return;
                const u = users[String(entry.id)];
                console.log('[bosses_fight._fetchBossFightRating] строка', i, '| id:', entry.id, '| найден в users:', !!u,
                    '| nick:', entry.nick, '| name:', u && u.name, '| photo:', u && u.photo);
                // entry.nick (выставлен синхронно выше) в приоритете — VK-имя/'Сталкер'
                // только если ник так и не пришёл с сервера.
                if(!row.nameTxt.text) row.nameTxt.text = (u && u.name) || 'Сталкер';
                // 24.09.2026: раньше текстура НЕ сбрасывалась в ветке "без фото" — если этот
                // индекс строки на предыдущем фетче принадлежал другому игроку С фото, чужая
                // фотография оставалась висеть поверх нового (безфотового) имени.
                if(row.avSpr) row.avSpr.texture = (u && u.photo) ? PIXI.Texture.from(u.photo) : PIXI.Texture.EMPTY;
            });
        });
    };

    // ── ТАЙМЕР ────────────────────────────────────────────────────

    // Личный дедлайн боя (FIGHT_DURATION_MS + замороженный бонус скилла "Повелитель времени") —
    // чисто визуальный обратный отсчёт от bosses._bossStartMs (реальный серверный timestamp),
    // дойдя до 00:00:00 ничего не форсирует (реальное окно — MAX_FIGHT_WINDOW_MS на сервере, см.
    // bosses.php.attack()/claimKill()). Тот же 1-секундный интервал (см. _startBossFightTimer)
    // ещё и периодически (раз в POLL_EVERY_TICKS секунд) подтягивает свежий производный HP
    // (друзья могли помочь, пока экран открыт) и обновляет панель «РЕЙТИНГ УРОНА».
    const POLL_EVERY_TICKS = 5;
    proto._tickBossFightTimer = function(){
        if(!this._bossFightWin || !this._bossFightWin.parent){
            clearInterval(this._bossFightTimerInterval); return;
        }
        if(!window.bosses) return;
        const idx = this._bossFightBossIdx; const di = this._bossFightDiffIdx;
        if(this._bossFightTimerTxt){
            const startMs = bosses._bossStartMs[di][idx] || 0;
            if(!startMs){
                this._bossFightTimerTxt.text = '09:00:00';
            } else {
                const bonus = (bosses._fightTimeBonusMs && bosses._fightTimeBonusMs[di]) ? (bosses._fightTimeBonusMs[di][idx] || 0) : 0;
                const remain = Math.max(0, (bosses.FIGHT_DURATION_MS || 32400000) + bonus - (Date.now() - startMs));
                const s = Math.floor(remain / 1000);
                const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
                this._bossFightTimerTxt.text = String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
                if(remain === 0) bosses._onFightTimeout(idx);
            }
        }

        if(!bosses._bossStartMs[di][idx]) return;
        this._bossFightPollTick = (this._bossFightPollTick || 0) + 1;
        if(this._bossFightPollTick >= POLL_EVERY_TICKS){
            this._bossFightPollTick = 0;
            if(typeof bosses._syncFriendsDamage === 'function') bosses._syncFriendsDamage(idx, ()=>{
                if(this._bossFightWin && this._bossFightWin.parent && this._bossFightBossIdx === idx){
                    this._updateBossFightHpDisplay();
                    this._updateBossFightStats();
                    this._loadBossFightRating(idx);
                }
            });
        }
    };

    proto._startBossFightTimer = function(){
        if(this._bossFightTimerInterval) clearInterval(this._bossFightTimerInterval);
        this._bossFightPollTick = 0;
        this._tickBossFightTimer(); // сразу показываем правильный статус без задержки
        this._bossFightTimerInterval = setInterval(()=>this._tickBossFightTimer(), 1000);
    };

    // ── ЗАКРЫТИЕ ──────────────────────────────────────────────────

    // Кнопка «ВЫЙТИ ИЗ БОЯ» — полный отказ от боя (поражение): HP и таймер сбрасываются,
    // потраченные на этого босса ключи НЕ возвращаются. В отличие от крестика (просто
    // закрывает экран, бой продолжается в фоне и его можно будет продолжить позже).
    proto._forfeitBossFight = function(){
        const idx = this._bossFightBossIdx;
        let diffIdx = this._bossFightDiffIdx;
        let hpLeft  = 0, maxHp = 0;
        // 24.09.2026 (баг "на попапе поражения висит чужой/давний урон", по прямому указанию):
        // suspendPlayerSave() включается ЗДЕСЬ, ДО раннего flushPlayerSave('boss_forfeit')
        // ниже — иначе именно ОН и был бы гонкой: если этот флаш (обычный users.save с уже
        // локально обнулённым bossStartMs) долетает до БД раньше, чем bosses.endFightSession()
        // (см. ниже) успевает посчитать top по ЕЩЁ целому bossStartMs, топ участников боя
        // получается пустым/устаревшим. Снимается в обоих колбэках endFightSession() ниже —
        // тот же приём, что уже есть у bosses.attack/claimKill (см. player-save.js).
        if(window.suspendPlayerSave) suspendPlayerSave('boss_end_fight_forfeit');
        if(window.bosses && typeof bosses._closeSkillsIfOpen === 'function') bosses._closeSkillsIfOpen();
        if(window.bosses && typeof bosses._setHp === 'function' && idx !== undefined){
            diffIdx = bosses._diffIdx;
            // Запоминаем ДО сброса — попапу поражения (18.09.2026, новый дизайн) нужно
            // показать, сколько HP оставалось у босса на момент выхода из боя.
            hpLeft = bosses._hp(idx);
            maxHp  = bosses._maxHp(idx);
            bosses._setHp(idx, bosses._maxHp(idx));
            if(bosses._bossStartMs && bosses._bossStartMs[diffIdx]) bosses._bossStartMs[diffIdx][idx] = 0;
            if(bosses.friendDmgApplied && bosses.friendDmgApplied[diffIdx]) bosses.friendDmgApplied[diffIdx][idx] = 0;
            if(Array.isArray(bosses._curCycleDmg)) bosses._curCycleDmg[idx] = 0;
            if(bosses._fightTimeBonusMs && bosses._fightTimeBonusMs[diffIdx]) bosses._fightTimeBonusMs[diffIdx][idx] = 0;
            bosses._fightStart = null;
            bosses._saveToUdata();
            // 19.09.2026 (репорт "не сохраняются данные боевки босса") — тот же немедленный
            // флаш, что и у skills.forfeitSession() чуть ниже, вместо общего 500мс-дебаунса
            // (player-save.js), который мог не успеть сработать, если игрок сразу закрывал
            // приложение после форфейта. 24.09.2026: теперь безопасно ставится в очередь
            // (saveSuspended>0 — см. suspendPlayerSave() выше) и реально уйдёт только после
            // resumePlayerSave() в колбэках endFightSession() ниже.
            if(window.flushPlayerSave) flushPlayerSave('boss_forfeit');
            console.log('[bosses_fight._forfeitBossFight] поражение: HP и таймер сброшены, ключи не возвращены. bossIdx=', idx, 'diffIdx=', diffIdx);
        }
        // Форфейт — поражение: урон скиллов именно ЭТОЙ попытки откатывается (не должно
        // быть, например, 600/1185 после проигранного боя — см. skills.forfeitSession()).
        // 22.09.2026: forfeitSession() ниже — мгновенная оптимистичная реакция UI, реальный
        // (server-authoritative) откат делает bosses.endFightSession(), см. тот же приём в
        // bosses-combat.js._onFightTimeout.
        if(window.skills) skills.forfeitSession();

        // 24.09.2026 (баг "на попапе поражения висит чужой/давний урон", по прямому указанию +
        // скриншот): попап раньше показывался СРАЗУ, не дожидаясь ответа endFightSession, и
        // вообще не получал top — панель "УЧАСТНИКИ БОЯ" молча показывала то, что осталось от
        // ПРЕДЫДУЩЕГО открытия попапа. Теперь показ отложен до ответа сервера (тот же принцип,
        // что уже у победного пути), boss_id/diff_idx передаются, чтобы сервер посчитал top ДО
        // сброса bossStartMs, а suspendPlayerSave() вокруг всего окна не даёт параллельному
        // flushPlayerSave() обогнать этот запрос (тот же класс гонки, что уже чинили для
        // bosses.attack/claimKill — см. player-save.js).
        const _finishForfeitUi = (top) => {
            this._closeBossesFight();
            // 18.09.2026 (новый дизайн попапа результата боя, по PSD): показывается ПОСЛЕ
            // _closeBossesFight() — тот же z-order приём, что и в bosses-combat._onFightTimeout.
            if(window.iface && typeof iface._showBossResultPopup === 'function'){
                iface._showBossResultPopup({
                    bossIdx: idx, diffIdx: diffIdx, isWin: false, hpLeft: hpLeft, maxHp: maxHp, top: top,
                });
            } else {
                notify.showResult({text:'Поражение! Бой окончен, ключи потрачены.'}, 0);
            }
        };

        if(window.TS){
            TS.php('bosses.endFightSession', {boss_id: idx, diff_idx: diffIdx}, (res) => {
                // 25.09.2026 (тот же фикс, что в bosses-combat.js._onDefeat/_onFightTimeout —
                // см. подробный коммент там): applyPatch() ПЕРЕД resumePlayerSave(), иначе
                // отложенный автосейв (pendingFlushOnResume) может уйти со СТАРЫМ udata и
                // затереть только что сброшенный сервером freeWpnCdMs.
                applyPatch(res.patch);
                if(window.resumePlayerSave) resumePlayerSave('boss_end_fight_forfeit');
                if(window.skills) skills._loadLevelsFromUdata();
                _finishForfeitUi(Array.isArray(res.top) ? res.top : []);
            }, (err) => {
                if(window.resumePlayerSave) resumePlayerSave('boss_end_fight_forfeit');
                console.error('[bosses_fight._forfeitBossFight] ошибка endFightSession (некритично):', JSON.stringify(err));
                _finishForfeitUi([]);
            });
        } else {
            // Нет TS — endFightSession() физически не улетит, снимаем приостановку сразу же,
            // иначе saveSuspended навсегда останется > 0 и автосейв замрёт.
            if(window.resumePlayerSave) resumePlayerSave('boss_end_fight_forfeit');
            _finishForfeitUi([]);
        }
    };

    // 23.09.2026 (баг "опыт скиллов переносится в следующий бой с боссом"): крестик был сделан
    // ещё одним триггером endFightSession()/skills.resetSession(), наравне с форфейтом/таймаутом.
    //
    // 24.09.2026 (РЕВЕРТ этого решения, баг найден по прямому указанию + повтор репорта —
    // "нанёс 200 урона, скрыл бой крестиком, зашёл заново к тому же боссу — опыт 0 вместо 200"):
    // крестик закрывает только ЭКРАН — бой (bossStartMs на сервере) остаётся активным, тот же
    // самый бой можно продолжить, зайдя к этому же боссу повторно (см. _openBossesFight — если
    // bossStartMs уже проставлен, сервер не дёргается, skills.beginSession() НЕ вызывается
    // повторно, никакого сброса быть не должно). А resetSession()/endFightSession() здесь как
    // раз и обнуляли skillsDmgSpent (клиент — сразу, сервер — через _finalizeSkillSession())
    // ПОСРЕДИ ещё не оконченного боя — то, что и виднелось как "опыт слетел". Прогресс скиллов
    // должен сбрасываться ТОЛЬКО при истинном окончании боя — победа (claimKill), поражение
    // (форфейт, _forfeitBossFight выше) или таймаут (bosses-combat.js._onFightTimeout) — эти три
    // пути endFightSession()/resetSession() не трогали и не трогают.
    proto._leaveBossesFight = function(){
        // Выход закрывает только экран; состояние боя, ключи и прогресс скиллов уже сохранены и
        // остаются как есть — бой не завершён, просто скрыт.
        if(window.bosses && typeof bosses._saveToUdata === 'function'){
            bosses._saveToUdata();
            console.log('[bosses_fight._leaveBossesFight] бой сохранён перед выходом (сессия НЕ завершается):',
                'bossIdx=', this._bossFightBossIdx,
                'startMs=', bosses._bossStartMs && bosses._bossStartMs[bosses._diffIdx]
                    ? bosses._bossStartMs[bosses._diffIdx][this._bossFightBossIdx] : 0,
                'skillsDmgSpent=', window.skills ? skills.skillsDmgSpent : null);
        }
        if(window.skills) skills._flushSaveToUdata();
        this._closeBossesFight();
    };

    proto._closeBossesFight = function(){
        if(this._bossFightTimerInterval){
            clearInterval(this._bossFightTimerInterval);
            this._bossFightTimerInterval = null;
        }
        if(this._bossFightWin && this._bossFightWin.parent)
            this._bossFightWin.parent.removeChild(this._bossFightWin);
        this._bossFightWin = null;
        this._spineBossHide();
        this.popHud('bossFight');
        // 26.09.2026: попап перезарядки бесплатного оружия держит собственный setInterval
        // (обратный отсчёт) на инстансе window.bosses, который переживает закрытие экрана боя
        // (bosses — не пересоздаётся) — если не остановить его здесь явно, интервал продолжит
        // тикать вхолостую после выхода из боя (безвредно, но не нужно).
        if(window.bosses && typeof bosses._closeWeaponReloadPopup === 'function') bosses._closeWeaponReloadPopup();
    };
}
