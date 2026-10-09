import { attachBossesCombat } from './bosses/bosses-combat.js';
import { attachWeaponReloadPopup } from './shell/overlays/weapon_reload_popup.js';
import { attachBuyKeyPopup } from './shell/overlays/buy_key_popup.js';
import { applyPatch } from '../modules/patch.js';

export default class Bosses{
    constructor(mc){
        this.mc = mc;
        this.win = mc.bosses_win;
        this.selected = 0;
        this._attackBound = false;
        this._fightStart  = null;
        this._skillsBtn   = null;
        this._diffBtns    = null;

        // Возвращено на боевые 9 часов (17.09.2026) — таймер завязан на Date.now(), поэтому
        // время идёт реально (в том числе пока приложение закрыто), не только пока открыт
        // экран боя; проверено, что при истечении/выходе награда не начисляется и ключи не
        // возвращаются (см. bosses-combat.js._onFightTimeout/_onDefeat, bosses_fight.js.
        // _forfeitBossFight) — см. регресс-тесты.
        this.FIGHT_DURATION_MS = 9 * 60 * 60 * 1000;
        this.FREE_WPN_CD_MS    = 6 * 60 * 60 * 1000;
        this.MULT_OPTIONS      = [1, 10, 50, 100, 500, 1000];
        this._multIdx          = 0;
        this._multOverride     = null; // null = использовать MULT_OPTIONS[_multIdx]; число = МАКС-режим
        this._diffIdx          = 0; // 0=обычный 1=опасный 2=суровый 3=соло
        this._cdResetBtn       = null;
        this._multBtn          = null;
        this._timerTxt         = null;
        this._timerInterval    = null;

        // HP боссов по каждому режиму [обычный, опасный, суровый, соло]
        this.BOSS_HP = [
            [1000,         3000,        10000,        1000      ],  // 0 Охотник
            [10000,        30000,        60000,        10000     ],  // 1 Счастливчик
            [50000,        150000,       300000,       50000     ],  // 2 Ястреб
            [100000,       300000,       600000,       100000    ],  // 3 Меченный
            [500000,       1500000,      3000000,      500000    ],  // 4 Крыс
            [2000000,      6000000,      12000000,     2000000   ],  // 5 Баркут
            [3000000,      9000000,      18000000,     3000000   ],  // 6 Борода
            [30000000,     90000000,     180000000,    30000000  ],  // 7 Жгут
        ];

        this.DIFF_MULT = [
            { exp: 1.0, cig: 1.00, label: 'Обычный',  color: 0x4488cc },
            { exp: 1.5, cig: 1.15, label: 'Опасный',  color: 0xcc8844 },
            { exp: 2.0, cig: 1.30, label: 'Суровый',  color: 0xcc4444 },
            { exp: 3.0, cig: 1.15, label: 'Соло',     color: 0x9944cc },
        ];

        this.hpByDiff = [
            [...this.BOSS_HP.map(r=>r[0])], // обычный
            [...this.BOSS_HP.map(r=>r[1])], // опасный
            [...this.BOSS_HP.map(r=>r[2])], // суровый
            [...this.BOSS_HP.map(r=>r[3])], // соло
        ];

        this.data = [
            { id:0,name:'Охотник',     keys_needed:0, reward:{cig:100,   exp:25  }, gives_keys:[1],   boss_loc:0, buy_key:0  },
            { id:1,name:'Счастливчик', keys_needed:3, reward:{cig:200,   exp:30  }, gives_keys:[2],   boss_loc:1, buy_key:3  },
            { id:2,name:'Ястреб',      keys_needed:3, reward:{cig:300,   exp:50  }, gives_keys:[3],   boss_loc:2, buy_key:6  },
            { id:3,name:'Меченный',    keys_needed:3, reward:{cig:500,   exp:100 }, gives_keys:[4],   boss_loc:3, buy_key:18 },
			{ id:4,name:'Крыс',        keys_needed:3, reward:{cig:5000,  exp:200 }, gives_keys:[5],   boss_loc:4, buy_key:0  },
            { id:5,name:'Баркут',      keys_needed:1, key_slot:5, reward:{cig:10000, exp:500 }, gives_keys:[7], boss_loc:-1,buy_key:0 },
            { id:6,name:'Борода',      keys_needed:2, key_slot:5, reward:{cig:15000, exp:750 }, gives_keys:[],  boss_loc:-1,buy_key:0 },
            { id:7,name:'Жгут',        keys_needed:3, reward:{cig:20000, exp:1500}, gives_keys:[],    boss_loc:-1,buy_key:0  },
        ];

        // Охотник всегда показывает 999 ключей. Его keys_needed=0, поэтому они никогда
        // не проверяются и не списываются; значение также принудительно восстанавливается
        // после загрузки старого сохранения в bosses-combat.js.
        this.keys         = [999,0,0,0,0,0,0,0];
        this.killsTotal   = [0,0,0,0,0,0,0,0];
        this.DAILY_KILL_LIMIT = 7;
        this.dailyKills   = [0,0,0,0,0,0,0,0];
        this.dailyDate    = '';

        // Реальное серверное время старта попытки (bosses.php.startFight()) — 0, если бой не активен.
        this._bossStartMs = [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]];
        this._freeWpnLastMs = {};

        // Урон, уже засчитанный от друзей (по режимам, кроме соло) — не даёт применить один и тот же урон дважды
        this.friendDmgApplied = [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]];

        // Урон текущего цикла боя с боссом (обнуляется при каждом сбросе HP босса).
        // Он нужен только для помощи друзей; пожизненный рейтинг хранится отдельно в
        // bosses_data.bossDamage и никогда не сбрасывается после победы.
        this._curCycleDmg = [0,0,0,0,0,0,0,0];

        // 20.09.2026 (баг найден, по прямому указанию: "прокачал Повелителя времени —
        // время боя полностью обновилось") — бонус времени скилла ЗАМОРАЖИВАЕТСЯ на
        // серверном bossStartMs в момент реального старта попытки (bosses_fight._openBossesFight)
        // и больше НЕ читается заново вживую (skills.getTimeBonus()) из "СКИЛЛЫ" внутри уже
        // идущего боя — иначе игрок качает скилл на уроне ЭТОГО ЖЕ боя и тут же продлевает
        // ЕГО дедлайн, кольцо обратной связи "бью → качаю → время продлилось → бью ещё".
        // См. разбор кейса ниже, в bosses_fight._openBossesFight.
        this._fightTimeBonusMs = [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]];

        // 21.09.2026 (баг найден, по прямому указанию — репорт "нажал перезагрузить страницу,
        // с боя просто вылетело, ничего не осталось") — _loadFromUdata() (bosses-combat.js)
        // восстанавливает hpByDiff/bossStartMs/keys/killsTotal/curCycleDmg/friendDmgApplied/
        // fightTimeBonusMs/diffIdx из udata['bosses_data'] уже ДАВНО существует, но её
        // ЕДИНСТВЕННЫЙ вызов был внутри bosses.open() (устаревший FLA-поток) — а сам open()
        // нигде в реальном UI не вызывается (актуальный путь — bosses_select.js/bosses_fight.js,
        // они читают this._bossStartMs и т.п. НАПРЯМУЮ). Итог: после ЛЮБОЙ перезагрузки
        // страницы (не через кнопку "Выйти из боя", а хардовым F5/закрытием вкладки) состояние
        // боя в памяти клиента откатывалось к дефолтам конструктора, хотя сервер всё это время
        // хранил живой bossStartMs/HP. Фикс — по тому же паттерну, что skills.js
        // (_loadLevelsFromUdata в конце конструктора): восстанавливаем сразу при создании
        // window.bosses (создаётся в module_control.js ПОСЛЕ готовности udata, см. комментарий
        // там же "Skills и Achievements... создаются сразу после udata готова").
        this._loadFromUdata();

        this.win.butt_close.on('pointerdown', ()=>this.close());
        this._initList();
        this._showDetail(0);
    }

    // ── ГЕТТЕРЫ ───────────────────────────────────────────────────────────────

    // 28.09.2026 (по прямому указанию — "лимит на боссов должен сбрасываться в 12 по МСК"),
    // 29.09.2026 (уточнение того же указания — "12" изначально означало полночь, не полдень):
    // раньше здесь были ЛОКАЛЬНЫЕ часы устройства игрока (getFullYear/getMonth/getDate) —
    // разные игроки в разных часовых поясах видели "новый день" в РАЗНОЕ время по UTC, и это
    // могло не совпадать с реальным серверным разворотом дня (Gameops::mskDailyDate(),
    // единственный источник правды). Теперь то же самое вычисление, что на сервере: МСК = UTC+3
    // фиксированно (без DST), сдвигаем эпоху на +3 часа (компенсация пояса) и берём UTC-дату —
    // разворачивается ровно в 21:00 UTC = 00:00 МСК, одинаково для ВСЕХ игроков независимо от
    // часового пояса устройства. Это только клиентская UX-подсказка (счётчик "попыток сегодня"
    // /предпроверка перед round-trip) — реальное решение всегда принимает сервер.
    _today(){
        const d = new Date(Date.now() + 3 * 60 * 60 * 1000);
        return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');
    }

    get multiplier(){ return this._multOverride != null ? this._multOverride : this.MULT_OPTIONS[this._multIdx]; }
    get diff(){ return this._diffIdx; }

    _hp(bossIdx){ return this.hpByDiff[this._diffIdx][bossIdx]; }
    _maxHp(bossIdx){ return this.BOSS_HP[bossIdx][this._diffIdx]; }
    _setHp(bossIdx, val){ this.hpByDiff[this._diffIdx][bossIdx] = val; }

    _calcReward(bossIdx){
        const d = this.data[bossIdx];
        const m = this.DIFF_MULT[this._diffIdx];
        const gangExp = window.gangs ? (1 + Gangs.getBonus('exp_bonus')/100) : 1;
        const gangCig = window.gangs ? (1 + Gangs.getBonus('coins_bonus')/100) : 1;
        return {
            exp: Math.floor(d.reward.exp * m.exp * gangExp),
            cig: Math.floor(d.reward.cig * m.cig * gangCig),
        };
    }

    _isLocCleared(locIdx){
        if(locIdx < 0) return true;
        if(window.zone) return zone.getCleared(locIdx) >= 1;
        try{
            const saved = helper.safeParseJSON(udata['zone'], {});
            return ((saved[locIdx] && saved[locIdx].cleared) || 0) >= 1;
        } catch(e){ return false; }
    }

    // 29.09.2026 (баг найден по прямому указанию — "есть Связка ключей, но при нападении на
    // босса всё равно требует ключи"): владелец постоянного предмета "Связка ключей"
    // (keyring_owner, см. server/core/controllers/bosses.php.startFight() — сервер УЖЕ
    // пропускает проверку и списание ключей для него, фикс 25.09.2026) не может реально этим
    // воспользоваться — ВСЕ клиентские предчеки ключей (bosses_prefight.js.napBtn,
    // bosses_fight.js._openBossesFight — тот, что физически не даёт уйти запросу
    // bosses.startFight на сервер, bosses-combat.js._attack, boss_result.js "ЕЩЁ РАЗ") нигде не
    // читали udata['keyring_owner'] и блокировали клик локально, до похода на сервер. Единая
    // проверка тем же способом, что shmot.js уже использует для отображения предмета как
    // owned.
    _hasKeyring(){
        return !!(udata && parseInt(udata['keyring_owner']) > 0);
    }


    // ── UI ────────────────────────────────────────────────────────────────────

    _initList(){
        const list = this.win.boss_list;
        for(let i=0;i<this.data.length;i++){
            const item = list['item_'+i];
            const d    = this.data[i];
            if(!item) continue;
            item.name_txt.text  = d.name;
            item.level_txt.text = d.keys_needed > 0 ? '🔑 '+d.keys_needed : 'Открыт';
            const maxHp = this._maxHp(i);
            item.hp_bar.setPercent(this._hp(i) / maxHp);
            const idx = i;
            item.on('pointerdown', ()=>this._showDetail(idx));
        }
    }

    _showDetail(idx){
        this.selected = idx;
        const d   = this.data[idx];
        const det = this.win.boss_detail;
        const loc = this._isLocCleared(d.boss_loc);
        const today = this._today();
        const kills = today === this.dailyDate ? this.dailyKills[idx] : 0;
        const m     = this.DIFF_MULT[this._diffIdx];
        const maxHp = this._maxHp(idx);
        const curHp = this._hp(idx);

        det.name_txt.text   = d.name + '  [' + m.label + ']';
        det.hp_txt.text     = 'HP: ' + this._fmt(curHp) + ' / ' + this._fmt(maxHp);
        det.hp_bar.setPercent(curHp / maxHp);
        det.reward_txt.text = this._fmt(maxHp) + ' hp';
        if(!this._rewardTxtMoved){ this._rewardTxtMoved=true; det.reward_txt.x=172; det.reward_txt.y=172; }

        if(!loc){
            // Имена — как в zone.js (this.locations[].name), НЕ старые имена из ТЗ ("Рубеж" и т.д.)
            // Раньше здесь стоял устаревший список — игрок видел "Зачисти Рубеж", хотя такой
            // локации в самой Зоне уже нет (переименовано в Кордон/Свалка/...), из-за чего
            // казалось, что прогресс зачистки локации не сохраняется / механика не работает.
            const locNames = ['Кордон','Свалка','Темная Долина','Агропром','Янтарь'];
            det.level_txt.text = 'Зачисти ' + (locNames[d.boss_loc] || '') + ' для доступа';
        } else {
            const keySlot = d.key_slot != null ? d.key_slot : idx;
            det.level_txt.text = d.keys_needed > 0
                ? 'Ключей: ' + this.keys[keySlot] + ' / ' + d.keys_needed
                : 'Ключи не нужны';
        }

        const descParts = [];
        if(d.keys_needed > 0) descParts.push('Нужно '+d.keys_needed+' ключей');
        if(d.buy_key > 0) descParts.push('Купить ключ: '+d.buy_key+'р');
        // 29.09.2026: было "Убийств сегодня" — переименовано в "Попыток сегодня", т.к. с этой
        // даты счётчик (dailyKills) тратится за ЛЮБОЙ исход попытки (победа/поражение/таймаут/
        // выход), не только за победу — см. bosses.php.startFight().
        if(loc) descParts.push('Попыток сегодня: '+kills+'/'+this.DAILY_KILL_LIMIT);
        det.desc_txt.text = descParts.join('  |  ');

        const list = this.win.boss_list;
        for(let i=0;i<this.data.length;i++) if(list['item_'+i]) list['item_'+i].alpha = i===idx ? 1 : 0.55;

        if(!this._attackBound){
            this._attackBound = true;
            det.butt_attack.on('pointerdown', ()=>this._attack());
        }
        if(d.buy_key > 0) this._renderBuyKey(idx, loc); else if(det.butt_buy_key) det.butt_buy_key.visible = false;
        this._renderMultBtn(det);
        this._renderCdResetBtn(det, idx);
    }

    _fmt(n){
        // 25.09.2026 (по прямому указанию — "нанёс 100к урона, а ХП босса не изменилось"):
        // раньше числа ≥10кк (Жгут, 30кк) округлялись до целого через toFixed(0) — 100к урона
        // (29.9кк реальных) отображались как те же "30кк", урон визуально пропадал. Ветка
        // n>=1e7 убрана целиком — единая формула toFixed(1) с 1 млн работает для ЛЮБОГО кк
        // (включая 10кк+), .replace('.0','') по-прежнему прячет ".0" у круглых чисел (30кк,
        // не 30.0кк).
        // 09.10.2026 (по прямому репорту — "друзья нанесли урон, а полоска ХП в бою всё ещё
        // 100к/100к"): тот же класс бага, что чинили 25.09, но для диапазона 10к-1кк — toFixed(0)
        // округлял ЛЮБОй урон меньше 500 HP (на боссах 100к+) до того же самого "к"-значения,
        // урон друга визуально пропадал полностью, хотя реально засчитался (зелёная полоска
        // сдвигалась на пиксель). Тот же toFixed(1), что уже работает для 1кк+, применён и сюда.
        if(n >= 1e6)  return (n/1e6).toFixed(1).replace('.0','')+'кк';
        if(n >= 1e4)  return (n/1e3).toFixed(1).replace('.0','')+'к';
        return n.toLocaleString('ru');
    }

    _renderBuyKey(idx, locCleared){
        const det  = this.win.boss_detail;
        if(!det.butt_buy_key) return;
        det.butt_buy_key.removeAllListeners('pointerdown');
        if(locCleared){
            det.butt_buy_key.visible = true;
            if(det.buy_key_txt) det.buy_key_txt.text = 'Купить ключ: '+this.data[idx].buy_key+'р';
            // 29.09.2026 (по прямому указанию — попап покупки ключей с ассетами/ценами): раньше
            // клик сразу покупал 1 ключ (_buyKey(idx) напрямую) — теперь, как и остальные пути
            // покупки, сначала открывает попап (иконка нужного ключа + "Купить за N" + кнопка),
            // а сама покупка уже происходит по клику ВНУТРИ него (buy_key_popup.js).
            det.butt_buy_key.on('pointerdown', ()=>this._openBuyKeyPopup(idx));
        } else {
            det.butt_buy_key.visible = false;
        }
    }

    _renderMultBtn(det){
        if(!this._multBtn){
            const bg  = new PIXI.Graphics();
            bg.beginFill(0x1a1a2e); bg.lineStyle(1,0x8888cc); bg.drawRoundedRect(0,0,90,26,4); bg.endFill();
            const txt = new PIXI.Text('×1',{fontFamily:'Arial',fontSize:14,fill:'#aabbff',fontWeight:'bold'});
            txt.x=6; txt.y=5;
            const btn = new PIXI.Container();
            btn.addChild(bg,txt); btn.interactive=true; btn.buttonMode=true;
            btn.on('pointerdown',()=>this.cycleMultiplier());
            if(det.butt_attack){ btn.x=det.butt_attack.x+det.butt_attack.width+8; btn.y=det.butt_attack.y; }
            else { btn.x=20; btn.y=200; }
            det.addChild(btn);
            this._multBtn={btn,txt};
        }
        const m=this.multiplier;
        this._multBtn.txt.text='×'+(m>=1000?'1K':m);
    }

    _renderCdResetBtn(det, idx){
        const eqWpn = window.weapons ? weapons.data.find(w=>w.equipped) : null;
        const isFree = eqWpn && !eqWpn.donate;
        // 28.09.2026: КД общий на все три бесплатных оружия — читаем через тот же
        // _freeWpnSharedLastUse() (bosses-combat.js), что и реальный боевой путь/попап
        // перезарядки, а не отдельный составной ключ 'diffIdx_weaponId', которого реальный
        // удар никогда не писал (эта кнопка живёт на неиспользуемом в актуальном UI экране,
        // см. комментарий в конструкторе — но исправлено для консистентности).
        const lastUse = this._freeWpnSharedLastUse ? this._freeWpnSharedLastUse() : 0;
        const onCd    = isFree && lastUse > 0 && Date.now() - lastUse < this.FREE_WPN_CD_MS;
        if(!this._cdResetBtn){
            const bg=new PIXI.Graphics();
            bg.beginFill(0x2e1a1a);bg.lineStyle(1,0xcc6666);bg.drawRoundedRect(0,0,120,26,4);bg.endFill();
            const txt=new PIXI.Text('Откат КД 20р',{fontFamily:'Arial',fontSize:12,fill:'#ffaaaa'});
            txt.x=6;txt.y=6;
            const btn=new PIXI.Container();btn.addChild(bg,txt);
            btn.interactive=true;btn.buttonMode=true;
            btn.on('pointerdown',()=>this.resetFreeWeaponCd());
            if(det.butt_attack){btn.x=det.butt_attack.x;btn.y=det.butt_attack.y+det.butt_attack.height+6;}
            else{btn.x=20;btn.y=230;}
            det.addChild(btn);this._cdResetBtn=btn;
        }
        this._cdResetBtn.visible=onCd;
    }

    // ── СЛОЖНОСТЬ ─────────────────────────────────────────────────────────────

    _buildDiffButtons(){
        if(this._diffBtns) return;
        this._diffBtns = [];
        const labels = ['Обычный','Опасный','Суровый','Соло'];
        const colors  = [0x4488cc, 0xcc8844, 0xcc4444, 0x9944cc];
        for(let i=0;i<4;i++){
            const bg=new PIXI.Graphics();
            bg.beginFill(0x111122);bg.lineStyle(1,colors[i]);bg.drawRoundedRect(0,0,80,24,4);bg.endFill();
            const txt=new PIXI.Text(labels[i],{fontFamily:'Arial',fontSize:11,fill:'#ffffff'});
            txt.x=4;txt.y=5;
            const btn=new PIXI.Container();btn.addChild(bg,txt);
            btn.x=8+i*88; btn.y=0;
            btn.interactive=true;btn.buttonMode=true;
            const di=i;
            btn.on('pointerdown',()=>this._setDifficulty(di));
            this.win.boss_detail.addChild(btn);
            this._diffBtns.push({btn,bg,txt,colors,idx:i});
        }
        this._updateDiffButtons();
    }

    _updateDiffButtons(){
        if(!this._diffBtns) return;
        for(const b of this._diffBtns){
            b.bg.clear();
            const active = b.idx===this._diffIdx;
            const col    = b.colors[b.idx];
            b.bg.beginFill(active ? col : 0x111122, active ? 0.6 : 1);
            b.bg.lineStyle(active ? 2 : 1, col);
            b.bg.drawRoundedRect(0,0,80,24,4);b.bg.endFill();
            b.txt.style.fill = active ? '#ffffff' : '#888888';
        }
    }

    _setDifficulty(di){
        this._diffIdx = di;
        this._updateDiffButtons();
        this._initList();
        this._showDetail(this.selected);
    }

    // ── БАЗОВЫЕ ДЕЙСТВИЯ ──────────────────────────────────────────────────────

    _buyKey(idx){
        // 26.09.2026 (по прямому указанию): покупка ключей за рубли перенесена на сервер
        // (bosses.php.buyKey(), Gameops-based — деньги списываются через Gameops::deduct(),
        // ключи пишутся в тот же формат bosses_data.keys[], что startFight()/claimKill()).
        // 29.09.2026 (по прямому указанию — попап покупки ключей с ассетами/ценами Счастливчик
        // 3р/Ястреб 6р/Меченный 18р): фича утверждена, разблокирована и на клиенте (снят ранний
        // return-заглушка "Покупка ключей пока недоступна"), и на сервере (BUY_KEY_LOCKED=false
        // в bosses.php). Вызывается из попапа "Купить ключ" (buy_key_popup.js._openBuyKeyPopup)
        // и из инлайн-кнопки в детейле босса (_renderBuyKey ниже) — оба пути теперь ведут в один
        // и тот же попап, а не покупают мгновенно по одному клику.
        const cost = this.data[idx].buy_key;
        if(!cost){ notify.showResult({text:'Ключ для этого босса не продаётся'}, 0); return; }
        TS.php('bosses.buyKey', {boss_id: idx}, (res)=>{
            if(!res || !res.patch){ notify.showResult({text:'Не удалось купить ключ'}, 0); return; }
            applyPatch(res.patch);
            this._loadFromUdata(); // подтягивает актуальный keys[] из свежего bosses_data (тот же приём, что _attack()/claimKill())
            if(window.achievements) achievements._checkAll(); // трата рублей на ключ (spend_coins достижения)
            if(typeof this._closeBuyKeyPopup === 'function') this._closeBuyKeyPopup();
            this._showDetail(idx);
            notify.showResult({text:'Ключ куплен! Ключей: '+this.keys[idx]}, 1);
        }, ()=>{ notify.showResult({text:'Не удалось купить ключ'}, 0); });
    }

    cycleMultiplier(){
        this._multIdx = (this._multIdx + 1) % this.MULT_OPTIONS.length;
        this._showDetail(this.selected);
    }

    // ── OPEN / CLOSE ──────────────────────────────────────────────────────────

    open(){
        this._loadFromUdata();
        this._multBtn=null; this._cdResetBtn=null; this._attackBound=false; this._diffBtns=null; this._timerTxt=null;
        if(this._timerInterval){ clearInterval(this._timerInterval); this._timerInterval=null; }
        this.win.setTransform(40,19);
        this._initList();
        this._showDetail(this.selected);
        home.openScreen(this.win);

        if(window.iface){
            if(iface.up   && iface.up.parent)   iface.up.parent.addChild(iface.up);
            if(iface.down && iface.down.parent) iface.down.parent.addChild(iface.down);
        }
        this._ensureExtraButtons();
    }

    close(){
        if(this._timerInterval){ clearInterval(this._timerInterval); this._timerInterval=null; }
        home.closeScreen();
    }
}

attachBossesCombat(Bosses.prototype);
attachWeaponReloadPopup(Bosses.prototype);
attachBuyKeyPopup(Bosses.prototype);
