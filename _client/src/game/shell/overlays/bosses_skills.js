/** Skills / Talents upgrade screen (opened from boss fight). */

// Sequential unlock: skill N unlocks after skill (N-1) has level >= 1
// Display positions [x_center, y_center] for skills 1-20 (screen coords)
const SKILL_POS = [
    [401,177],[533,179],[688,178],[852,178],[992,178], // 1-5  (row1, left→right)
    [998,287],[855,287],[693,287],[535,288],[395,288], // 6-10 (row2, right→left in chain)
    [286,388],[456,391],[632,392],[782,391],[933,391], // 11-15(row3, left→right)
    [1023,489],[882,490],[715,490],[556,491],[405,491], // 16-20(row4, right→left in chain)
];

const SKILL_NAMES = [
    'РАЗМАШИСТЫЙ','КИЛЛЕР','АВТОМАТА ОЧЕРЕДЬ','ХЛАДНОКРОВНЫЙ','МЕТКИЙ ГЛАЗ',
    'ОТМОРОЖЕННЫЙ','ВЫНОСЛИВОСТЬ','НАМОТАЛ ПОКРЕПЧЕ','ДОБАВИЛ ГВОЗДИ','АДРЕНАЛИН',
    'ПОВЕЛИТЕЛЬ ВРЕМЕНИ','УЛИЧНЫЙ БОЕЦ','ВЗРЫВНОЙ','БЕЙСБОЛИСТ','РЭМБО',
    'ТАНЕЦ ЛЕЗВИЙ','СТРЕЛЬБА НАВСКИДКУ','ПРИРОЖДЕННЫЙ ОХОТНИК','ЗНАНИЕ СТРЕЛЬБЫ','СМЕРТЕЛЬНЫЙ ВЫСТРЕЛ',
];

// Позиции текста «уровень/макс» под каждой иконкой — сняты пользователем 17.09.2026 через
// редактор позиций для 19 из 20 скиллов (не хватает №1 «Размашистый» — для него оставлена
// формула по умолчанию cx/cy+30, как было раньше). Раньше все 20 считались ОДНОЙ формулой
// (cx, cy+30) — по факту не совпадало по X (разная ширина "0/5" vs "0/100" при центрированном
// анкоре двигала на глаз по-разному) и по Y (реальный сдвиг от 21 до 30px в зависимости от
// ряда, не константные +30). Индекс — 0-based, совпадает с SKILL_POS/SKILL_NAMES.
const SKILL_LVLTXT_POS = [
    null,        // 0  Размашистый — не снято, формула по умолчанию (cx, cy+30)
    [538,208],   // 1  Киллер
    [695,208],   // 2  Автомата очередь
    [860,208],   // 3  Хладнокровный
    [1002,208],  // 4  Меткий глаз
    [1005,315],  // 5  Отмороженный
    [848,315],   // 6  Выносливость
    [696,315],   // 7  Намотал покрепче
    [537,315],   // 8  Добавил гвозди
    [396,315],   // 9  Адреналин
    [287,413],   // 10 Повелитель времени
    [457,415],   // 11 Уличный боец
    [638,415],   // 12 Взрывной
    [789,415],   // 13 Бейсболист
    [936,413],   // 14 Рэмбо
    [1024,513],  // 15 Танец лезвий
    [891,513],   // 16 Стрельба навскидку
    [717,513],   // 17 Прирожденный охотник
    [562,513],   // 18 Знание стрельбы
    [406,512],   // 19 Смертельный выстрел
];

const SKILL_DESCS = [
    '+1 урон мачете/ур (макс +10)',
    '+1 урон ствола/ур (макс +20)',
    '+1 урон автомата/ур (макс +10)',
    '+1% крит мачете/ур (макс +10%)',
    '+1% крит ствола/ур (макс +10%)',
    '+1% крит автомата/ур (макс +10%)',
    '+1% крит ножа/ур (макс +10%)',
    '+1% крит цепи/ур (макс +10%)',
    '+1% крит биты/ур (макс +10%)',
    '+1 энергии/ур (макс +50)',
    '+2 мин боя с боссом/ур (макс +60 мин)',
    '+1 урон ножом/ур (макс +5)',
    '+1 урон цепью/ур (макс +8)',
    '+1 урон битой/ур (макс +7)',
    '+2 урон автомата/ур (макс +20)',
    '+1 урон мачете/ур (макс +58)',
    '+1 урон ствола/ур (макс +70)',
    '+1% крит ствола/ур (макс +10%)',
    '+1% крит автомата/ур (макс +10%)',
    '+1 урон автомата/ур (макс +100)',
];

function _skillImg(i, active){ // i: 0-based
    if(i === 0) return './images/1.png';
    if(i === 1) return active ? './images/2.png' : './images/2 неактив.png';
    if(i === 11) return active ? './images/12 копия 2.png' : './images/12 неактив.png';
    const n = i + 1;
    return active ? './images/' + n + ' актив.png' : './images/' + n + ' неактив.png';
}

export function attachBossesSkills(proto){

    proto._getSkillsData = function(){
        return helper.safeParseJSON(udata['skills_data'], []);
    };

    proto._saveSkillsData = function(levels){
        udata['skills_data'] = JSON.stringify(levels);
        TS.php('users.save', {udata_json: JSON.stringify(udata)}, null, null);
    };

    proto._openBossesSkillsScreen = function(){
        this._closeBossesSkillsScreen();
        this._buildBossesSkillsScreen();
        root.layer2_mc.addChild(this._skillsWin);
        this.pushHud('bossSkills', { down: false });
        if(this.up) root.layer2_mc.addChild(this.up);
    };

    proto._buildBossesSkillsScreen = function(){
        const B = './images/';
        const win = new PIXI.Container();
        win.interactive = true;

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.001);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        // Фон
        const bg = new PIXI.Sprite(PIXI.Texture.from(B + 'боевка прокачка талантов.png'));
        bg.width = 1280; bg.height = 720;
        win.addChild(bg);

        // Выход
        const exitBtn = new PIXI.Sprite(PIXI.Texture.from('./images/layers/popups/bosses/exit.png'));
        exitBtn.scale.set(0.5); exitBtn.x = 1171; exitBtn.y = 98;
        if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', ()=>{ _sa(exitBtn, 0.75); exitBtn.scale.set(0.54); });
        exitBtn.on('pointerout', ()=>{ _sa(exitBtn, 1); exitBtn.scale.set(0.5); });
        exitBtn.on('pointerdown', ()=>this._closeBossesSkillsScreen());
        win.addChild(exitBtn);

        // ── ДОСТУПНО ОЧКОВ ────────────────────────────────────────
        // 03.10.2026 (редактор позиций, по прямому указанию): было y:139, без scale.
        const avlLbl = new PIXI.Text('ДОСТУПНО', {
            fontFamily:'Southbank LT', fontSize:19, fill:'#aaaaaa',
        });
        avlLbl.x = 240; avlLbl.y = 135; win.addChild(avlLbl);

        // 03.10.2026 (редактор позиций): было x:264,y:156, без scale.
        const avlTxt = new PIXI.Text('0', {
            fontFamily:'Southbank LT', fontSize:62, fill:'#ff9400',
            fontWeight:'bold', dropShadow:true, dropShadowColor:'#000', dropShadowDistance:2,
        });
        avlTxt.x = 254; avlTxt.y = 158; win.addChild(avlTxt);
        this._skillsAvlTxt = avlTxt;

        // 03.10.2026 (редактор позиций): было y:196, без scale.
        const hintTxt1 = new PIXI.Text('для закрытия всех навыков: ~20кк урона', {
            fontFamily:'Southbank LT', fontSize:13, fill:'#888888',
            wordWrap:true, wordWrapWidth:153,
        });
        hintTxt1.x = 221; hintTxt1.y = 221; win.addChild(hintTxt1);

        // 03.10.2026 (редактор позиций): было y:230, без scale.
        const hintTxt2 = new PIXI.Text('До след. очка: ...', {
            fontFamily:'Southbank LT', fontSize:13, fill:'#888888',
            wordWrap:true, wordWrapWidth:130,
        });
        hintTxt2.x = 221; hintTxt2.y = 259; win.addChild(hintTxt2);
        this._skillsHintTxt2 = hintTxt2;

        // ── ИКОНКИ СКИЛЛОВ (20 штук) ──────────────────────────────
        this._skillsSprs    = [];  // {actSpr, pasSpr, lvlTxt, idx}
        this._skillSelected = -1;

        for(let i = 0; i < 20; i++){
            const [cx, cy] = SKILL_POS[i];

            // Пассив (серый) — виден когда скилл не куплен или не доступен
            const pasSpr = new PIXI.Sprite(PIXI.Texture.from(_skillImg(i, false)));
            pasSpr.anchor.set(0.5); pasSpr.x = cx; pasSpr.y = cy;
            win.addChild(pasSpr);

            // Актив (цветной) — виден когда куплен хотя бы 1 уровень
            const actSpr = new PIXI.Sprite(PIXI.Texture.from(_skillImg(i, true)));
            actSpr.anchor.set(0.5); actSpr.x = cx; actSpr.y = cy;
            actSpr.visible = false;
            win.addChild(actSpr);

            // Уровень (число под иконкой)
            const lvlTxt = new PIXI.Text('0', {
                fontFamily:'Southbank LT', fontSize:14, fill:'#ffffff',
                fontWeight:'bold', dropShadow:true, dropShadowColor:'#000', dropShadowDistance:1,
            });
            lvlTxt.anchor.set(0.5);
            const lvlPos = SKILL_LVLTXT_POS[i];
            lvlTxt.x = lvlPos ? lvlPos[0] : cx;
            lvlTxt.y = lvlPos ? lvlPos[1] : cy + 30;
            win.addChild(lvlTxt);

            // Хит-зона для клика
            const hit = new PIXI.Graphics();
            hit.beginFill(0xffffff, 0.001);
            hit.drawRect(-60, -60, 120, 110);
            hit.endFill();
            hit.x = cx; hit.y = cy;
            hit.interactive = true; hit.buttonMode = true;
            const ii = i;
            // 22.09.2026 (по прямому указанию — "прокачку скиллов можно делать и при нажатии
            // на сам скилл, но только на тот, что сейчас прокачивается, то есть если на 2
            // скилле прокачать 20 я не могу"): клик по иконке ВСЕГДА выделяет её (тултип/рамка,
            // как раньше), а прокачивает — ТОЛЬКО если это тот же самый скилл, который вернёт
            // _getCurrentUpgradeSkillIdx() (тот же строго последовательный порядок разблокировки,
            // что уже использует кнопка "ПРОКАЧАТЬ" — нельзя перепрыгнуть вперёд по цепочке).
            hit.on('pointerdown', ()=>{
                this._selectSkill(ii);
                if(ii === this._getCurrentUpgradeSkillIdx()) this._upgradeSelectedSkill();
            });
            hit.on('pointerover', ()=>{
                pasSpr.scale.set(1.08); actSpr.scale.set(1.08);
                if(this._skillsTip && this._skillsTipTxt){
                    const lvl = window.skills ? skills.levels[ii] : 0;
                    const maxL = window.skills ? skills.list[ii].maxLvl : 10;
                    this._skillsTipTxt.text = SKILL_NAMES[ii] + '\n' + SKILL_DESCS[ii] + '\nУр. ' + lvl + ' / ' + maxL;
                    const tipX = Math.min(1280 - 230, Math.max(0, cx - 110));
                    const tipY = Math.max(0, cy - 100);
                    this._skillsTip.x = tipX; this._skillsTip.y = tipY;
                    this._skillsTip.visible = true;
                }
            });
            hit.on('pointerout',  ()=>{
                pasSpr.scale.set(1); actSpr.scale.set(1);
                if(this._skillsTip) this._skillsTip.visible = false;
            });
            win.addChild(hit);

            this._skillsSprs.push({ actSpr, pasSpr, lvlTxt });
        }

        // Тултип при наведении
        const tipBg = new PIXI.Graphics();
        tipBg.beginFill(0x0d0d05, 0.93); tipBg.lineStyle(1, 0x7a5510, 1);
        tipBg.drawRoundedRect(0, 0, 220, 64, 6); tipBg.endFill();
        const tipTxt = new PIXI.Text('', {
            fontFamily: 'Southbank LT', fontSize: 13, fill: '#e8d070',
            wordWrap: true, wordWrapWidth: 204,
            dropShadow: true, dropShadowColor: '#000', dropShadowDistance: 1,
        });
        tipTxt.x = 8; tipTxt.y = 6;
        tipBg.addChild(tipTxt);
        tipBg.visible = false;
        win.addChild(tipBg);
        this._skillsTip    = tipBg;
        this._skillsTipTxt = tipTxt;

        // Подсветка выбранного скилла
        const selGlow = new PIXI.Graphics();
        selGlow.lineStyle(3, 0xff9400, 1);
        selGlow.drawRect(-62, -62, 124, 112);
        selGlow.visible = false;
        win.addChild(selGlow);
        this._skillsSelGlow = selGlow;

        // ── КНОПКА ПРОКАЧАТЬ ──────────────────────────────────────
        const upgrBtn = new PIXI.Sprite(PIXI.Texture.from(B + 'боевка таланты кнопка прокачать.png'));
        upgrBtn.anchor.set(0.5, 0.5); upgrBtn.x = 1008; upgrBtn.y = 628;
        upgrBtn.interactive = true; upgrBtn.buttonMode = true;
        upgrBtn.on('pointerover', ()=>{ _sa(upgrBtn, 0.8); upgrBtn.scale.set(1.08); });
        upgrBtn.on('pointerout', ()=>{ _sa(upgrBtn, 1); upgrBtn.scale.set(1); });
        upgrBtn.on('pointerdown', ()=>this._upgradeSelectedSkill());
        win.addChild(upgrBtn);

        this._skillsWin = win;
        this._updateBossesSkillsScreen();
    };

    // ── ОБНОВЛЕНИЕ UI ─────────────────────────────────────────────

    proto._updateBossesSkillsScreen = function(){
        const levels = window.skills ? skills.levels : new Array(20).fill(0);
        const pts    = window.skills ? skills.availablePoints : 0;

        if(this._skillsAvlTxt) this._skillsAvlTxt.text = String(pts);

        if(this._skillsHintTxt2 && window.skills){
            const needed = skills.dmgToNextPoint;
            this._skillsHintTxt2.text = needed > 0
                ? 'До след. очка:\n' + needed + ' урона'
                : 'Все очки\nполучены!';
        }

        if(!this._skillsSprs) return;

        for(let i = 0; i < 20; i++){
            const maxL  = window.skills ? skills.list[i].maxLvl : 10;
            const lvl   = parseInt(levels[i] || 0);
            const {actSpr, pasSpr, lvlTxt} = this._skillsSprs[i];

            actSpr.visible = lvl > 0;
            pasSpr.visible = lvl === 0;
            pasSpr.alpha   = 1;
            lvlTxt.text    = lvl + '/' + maxL;
            lvlTxt.style.fill = lvl >= maxL ? '#ff9400' : (lvl > 0 ? '#ffffff' : '#666666');
        }
    };

    proto._updateSkillStats = function(levels){
        if(!levels) levels = this._getSkillsData();
        // Базовый урон оружий + бонусы от скиллов (упрощенная модель)
        const base = {мачете:40, ствол:50, автомат:200, нож:5, цепь:12, бита:20};
        let bonus  = {мачете:0, ствол:0, автомат:0, нож:0, цепь:0, бита:0};
        // упрощенно: каждый купленный скилл дает +2 к авто
        for(let i = 0; i < 20; i++) bonus.автомат += parseInt(levels[i]||0) * 2;
        bonus.мачете += parseInt(levels[5]||0) * 3;
        bonus.ствол  += parseInt(levels[9]||0) * 4;
        bonus.нож    += parseInt(levels[0]||0) * 1;
        bonus.цепь   += parseInt(levels[7]||0) * 2;
        bonus.бита   += parseInt(levels[7]||0) * 2;

        if(this._sMacheteTxt)  this._sMacheteTxt.text  = '+' + (base.мачете  + bonus.мачете);
        if(this._sStvol_txt)   this._sStvol_txt.text    = '+' + (base.ствол   + bonus.ствол);
        if(this._sAutoTxt)     this._sAutoTxt.text      = '+' + (base.автомат + bonus.автомат);
        if(this._sNozh_txt)    this._sNozh_txt.text     = '+' + (base.нож     + bonus.нож);
        if(this._sCep_txt)     this._sCep_txt.text      = '+' + (base.цепь    + bonus.цепь);
        if(this._sBitaTxt)     this._sBitaTxt.text      = '+' + (base.бита    + bonus.бита);
        if(this._sEnergyTxt)   this._sEnergyTxt.text    = '+50';
        if(this._sBossTimeTxt) this._sBossTimeTxt.text  = '+60 мин';
    };

    // ── ВЫБОР СКИЛЛА ──────────────────────────────────────────────

    proto._selectSkill = function(idx){
        this._skillSelected = idx;
    };

    // ── ПРОКАЧКА ──────────────────────────────────────────────────
    // Автоматически находит следующий навык по порядку и прокачивает его.
    // 18.09.2026 (по прямому указанию): бесплатная прокачка первого уровня скилла 0 убрана
    // целиком — ВСЕ уровни ВСЕХ скиллов теперь стоят полную цену очками, льготы больше нет.

    // 22.09.2026 (вынесено из _upgradeSelectedSkill без изменения логики — по прямому указанию,
    // нужен тот же самый индекс и для клика по иконке скилла, не только для кнопки "ПРОКАЧАТЬ"):
    // первый навык по строгому порядку 0→19, который можно прокачать прямо сейчас — предыдущий
    // уже куплен (или это скилл 0), сам ещё не на максимуме, и есть доступное очко.
    proto._getCurrentUpgradeSkillIdx = function(){
        if(!window.skills) return -1;
        for(let i = 0; i < 20; i++){
            const lvl = skills.levels[i];
            if(lvl >= skills.list[i].maxLvl) continue;          // уже максимум — пропускаем
            if(i > 0 && skills.levels[i-1] < 1) continue;       // предыдущий ещё не куплен
            if(skills.availablePoints < 1) continue;            // нет доступных очков
            return i;
        }
        return -1;
    };

    proto._upgradeSelectedSkill = function(){
        if(!window.skills){ notify.showResult({text:'Система скиллов не загружена!'}, 0); return; }

        const idx = this._getCurrentUpgradeSkillIdx();
        if(idx === -1){
            return;
        }

        // 18.09.2026: skills.upgrade() асинхронный (запрос к серверу) — раньше здесь стояла
        // синхронная проверка "if(skills.upgrade(idx))", которая после переноса скиллов на
        // сервер была всегда false (upgrade() больше не возвращает true/false, а ничего не
        // возвращает сразу), поэтому _updateBossesSkillsScreen() после успешной прокачки
        // через ЭТУ кнопку никогда не вызывался — экран визуально "не обновлялся" до
        // следующего открытия. Теперь ждём реального результата через onDone-колбэк.
        skills.upgrade(idx, (ok) => { if(ok) this._updateBossesSkillsScreen(); });
    };

    // ── ЗАКРЫТИЕ ──────────────────────────────────────────────────

    proto._closeBossesSkillsScreen = function(){
        if(this._skillsWin && this._skillsWin.parent)
            this._skillsWin.parent.removeChild(this._skillsWin);
        this._skillsWin     = null;
        this._skillsSprs    = null;
        this._skillSelected = -1;
        this._skillsTip     = null;
        this._skillsTipTxt  = null;
        this.popHud('bossSkills');
        // Экран боя может быть открыт под скиллами (кнопка СКИЛЫ прямо на нём) — очки
        // могли измениться (прокачка), обновляем ОЧКИ/НОВЫЕ сразу, не дожидаясь другого триггера.
        if(typeof this._updateBossFightStats === 'function') this._updateBossFightStats();
    };
}
