/** Попап выбора локации с чекпоинтами. */
export function attachZonePopup(proto){

    const IMG = './images/';
    const LL  = './images/layers/popups/location/';

    // Фоны для каждой локации — 1280×720 полноэкранные композиты
    const LOC_BG_IMGS = [
        LL + 'локация кордон.png',
        LL + 'локация свалка.png',
        LL + 'локация темная долина.png',
        LL + 'локация агропром.png',
        LL + 'локация янтарь.png',
    ];

    proto._openLocationPopup = function(locIdx){
        const _iface = window.rootClass;

        if(this._locPopup){
            if(!this._locPopup.parent) root.layer2_mc.addChild(this._locPopup);
            this._locPopup.visible = true;
            try { this._updateLocPopup(locIdx); } catch(e){ console.warn('[zone-popup]', e); }
            if(window.iface) iface.restoreHud();
            if(_iface) _iface._compassHide();
            this._preloadLocArts(locIdx);
            return;
        }

        const win = new PIXI.Container();
        win.interactive = true;

        const _blocker = new PIXI.Graphics();
        _blocker.beginFill(0x000000, 0.001);
        _blocker.drawRect(0, 0, 1280, 720);
        _blocker.endFill();
        _blocker.interactive = true;
        win.addChild(_blocker);

        // Фон — 1280×720, полноэкранный
        this._locBg = new PIXI.Sprite();
        this._locBg.x = 0; this._locBg.y = 0;
        this._locBg.width = 1280; this._locBg.height = 720;
        win.addChild(this._locBg);

        const exitBtn = new PIXI.Sprite(PIXI.Texture.from(IMG + 'выход.png'));
        exitBtn.anchor.set(0.5, 0.5);
        exitBtn.scale.set(0.5);
        if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
        exitBtn.x = 1240; exitBtn.y = 107;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', ()=>{ _sa(exitBtn, 0.75); exitBtn.scale.set(0.54); });
        exitBtn.on('pointerout', ()=>{ _sa(exitBtn, 1); exitBtn.scale.set(0.5); });
        exitBtn.on('pointerdown', ()=>{
            win.visible = false;
            if(window.iface) iface.restoreHud();
            // 24.09.2026 (по прямому указанию — "после выхода из захвата локации рекордсмен по
            // уважению и его сумма не обновляются"): выход из попапа локации не пересобирает
            // экран выбора локаций (zone_screen.js) целиком — он просто прячется, оставаясь под
            // этим попапом. Без явного вызова здесь обновлённые сервером цифры уважения (могли
            // измениться, пока игрок был в локации) никогда бы не подтянулись заново.
            if(window.iface && typeof iface._refreshZoneRespectLeaders === 'function') iface._refreshZoneRespectLeaders();
            console.log('[zone-popup.close] локация закрыта, HUD обновлён, рекордсмены по уважению обновлены');
        });
        win.addChild(exitBtn);

        // Кнопка БИЗНЕС — правый верхний угол, пассив (серая) или актив (красная)
        const bizI = new PIXI.Sprite(PIXI.Texture.from(IMG + 'btn_biz_passiv.png'));
        const bizA = new PIXI.Sprite(PIXI.Texture.from(IMG + 'btn_biz_activ.png'));
        bizI.x = bizA.x = 880;
        bizI.y = bizA.y = 82;
        bizI.visible = true; bizA.visible = false;
        bizI.interactive = false;
        bizA.interactive = true; bizA.buttonMode = true;
        bizA.on('pointerdown', ()=>{ if(window.zone) zone._openBizPopup(); });
        this._locBizI = bizI; this._locBizA = bizA;
        win.addChild(bizI);
        win.addChild(bizA);

        this._locCpContainer = new PIXI.Container();
        win.addChild(this._locCpContainer);

        // Арт-картинка задания сталкера — PSD: x=210, y=523 → +8x, +12y
        this._locCpArt = new PIXI.Sprite(PIXI.Texture.EMPTY);
        this._locCpArt.x = 0; this._locCpArt.y = 0;
        // width/height НЕ ставим здесь — ставим после загрузки текстуры (иначе scale=160 на 1px текстуре)

        // Gradient mask for soft edge blur (белый цвет: PIXI SpriteMaskFilter умножает на masky.r)
        const _artMaskCanvas = document.createElement('canvas');
        _artMaskCanvas.width = 160; _artMaskCanvas.height = 107;
        const _artMaskCtx = _artMaskCanvas.getContext('2d');
        const _artGrd = _artMaskCtx.createRadialGradient(80, 53, 70, 80, 53, 90);
        _artGrd.addColorStop(0, 'rgba(255,255,255,1)');
        _artGrd.addColorStop(1, 'rgba(255,255,255,0)');
        _artMaskCtx.fillStyle = _artGrd;
        _artMaskCtx.fillRect(0, 0, 160, 107);
        const _artMaskSpr = new PIXI.Sprite(PIXI.Texture.from(_artMaskCanvas));
        _artMaskSpr.x = 0; _artMaskSpr.y = 0;

        const _artCont = new PIXI.Container();
        _artCont.x = 218; _artCont.y = 535;
        _artCont.addChild(this._locCpArt);
        _artCont.addChild(_artMaskSpr);
        _artMaskSpr.renderable = false;
        this._locCpArt.mask = _artMaskSpr;
        this._artCont = _artCont;
        win.addChild(_artCont);

        this._locCpTask = new PIXI.Text('', {
            fontFamily: 'Southbank LT',
            fontSize: 17,
            fill: '#e8dcc8',
            wordWrap: true,
            wordWrapWidth: 350,
            align: 'center',
        });
        this._locCpTask.anchor.set(0.5, 0.5);
        this._locCpTask.x = 580; this._locCpTask.y = 571;
        win.addChild(this._locCpTask);

        // Кнопка ВЫПОЛНИТЬ — одна картинка, показывается/скрывается
        // PSD: x=942, y=523, нативный размер 179×116
        this._locExecActiv = new PIXI.Sprite(PIXI.Texture.from(LL + 'кнопка выполнить можно.png'));
        this._locExecActiv.x = 942; this._locExecActiv.y = 523;
        win.addChild(this._locExecActiv);

        this._locEnergyCostTxt = new PIXI.Text('', {
            fontFamily: 'Southbank LT', fontSize: 30, fill: '#ffcc44',
            dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1
        });
        this._locEnergyCostTxt.anchor.set(0.5, 0.5);
        this._locEnergyCostTxt.x = 942 + 89;   // центр кнопки по x
        this._locEnergyCostTxt.y = 523 + 80;    // нижняя треть кнопки
        win.addChild(this._locEnergyCostTxt);

        // Иконка "Уважение" — PSD: x=807, y=567, w=26, h=39 → центр: 820, 587
        this._locNagradaUvagSpr = new PIXI.Sprite(PIXI.Texture.from(LL + 'награда уважение.png'));
        this._locNagradaUvagSpr.anchor.set(0.5, 0.5);
        this._locNagradaUvagSpr.x = 820;
        this._locNagradaUvagSpr.y = 587;
        win.addChild(this._locNagradaUvagSpr);

        this._locRespTooltip = new PIXI.Text('', {
            fontFamily:'Southbank LT', fontSize:17, fill:'#aaddff',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1,
            align:'center',
        });
        this._locRespTooltip.anchor.set(0.5, 1);
        this._locRespTooltip.x = 894; this._locRespTooltip.y = 545;
        this._locRespTooltip.visible = false;
        win.addChild(this._locRespTooltip);

        // Иконка "Корона" — PSD: x=873, y=568, w=42, h=37 → центр: 894, 587
        this._locNagradaKoronaSpr = new PIXI.Sprite(PIXI.Texture.from(LL + 'награда корона.png'));
        this._locNagradaKoronaSpr.anchor.set(0.5, 0.5);
        this._locNagradaKoronaSpr.x = 894;
        this._locNagradaKoronaSpr.y = 587;
        this._locNagradaKoronaSpr.interactive = true;
        this._locNagradaKoronaSpr.buttonMode  = true;
        win.addChild(this._locNagradaKoronaSpr);

        this._locNagradaKoronaSpr.on('pointerover', ()=>{
            const loc = this.locations[this._locPopupIdx];
            const aiIdx = loc ? loc.checkpoints.findIndex(cp => cp.filled < cp.cells) : -1;
            const cp    = loc ? loc.checkpoints[aiIdx < 0 ? loc.checkpoints.length - 1 : aiIdx] : null;
            const reward = cp ? (cp.reward.resp || 0) : 0;
            // 28.09.2026 (репорт "уважение показывает общее за все зоны, а должно на каждой
            // своё"): раньше читалось udata['respect'] — это ГЛОБАЛЬНЫЙ авторитет игрока по
            // всей игре. Индивидуальный счётчик на локацию сервер уже считает и присылает
            // отдельным полем (zone.php._recordRespectLeader/fillCheckpoint/collectIncome/
            // captureLocation пишут loc_respect_<locIdx>, whitelist в users.php) — тултип
            // просто читал не то поле.
            const total  = parseInt(udata['loc_respect_' + this._locPopupIdx] || 0);
            this._locRespTooltip.text = 'Уважение: ' + total + '\n+' + reward + ' за точку';
            this._locRespTooltip.visible = true;
        });
        this._locNagradaKoronaSpr.on('pointerout', ()=>{
            this._locRespTooltip.visible = false;
        });

        this._locCellsCont = new PIXI.Container();
        win.addChild(this._locCellsCont);

        this._locCellsTxt = new PIXI.Text('0/5', {
            fontFamily: 'Southbank LT', fontSize: 22, fill: '#ffffff',
            dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1
        });
        this._locCellsTxt.anchor.set(0, 0.5);
        win.addChild(this._locCellsTxt);

        this._locExecActiv.interactive = true;
        this._locExecActiv.buttonMode  = true;
		this._locExecActiv._disableHoverScale = true;
		this._locExecActiv.on('pointerover', ()=>{ _sa(this._locExecActiv, 0.85); });
		this._locExecActiv.on('pointerout', ()=>{ _sa(this._locExecActiv, 1); });
        this._locExecActiv.on('pointerdown', ()=>{
            const loc = this.locations[this._locPopupIdx];
            let ci = 0;
            for(let i = 0; i < loc.checkpoints.length; i++){
                if(loc.checkpoints[i].filled < loc.checkpoints[i].cells){ ci = i; break; }
                if(i === loc.checkpoints.length - 1) ci = i;
            }
            const allDone = loc.checkpoints.every(cp => cp.filled >= cp.cells);
            // 22.09.2026 (баг "не все точки пройдены" всё ещё воспроизводится, по прямому
            // указанию) — печатаем ПОЛНОЕ локальное состояние чекпоинтов В МОМЕНТ клика, ДО
            // решения allDone/_capture()/_attack(). Если баг повторится — этот лог покажет,
            // отличается ли локальное представление от того, что сервер реально сбросит на
            // captureLocation (см. также error_log в zone.php.captureLocation при fail(61)).
            console.log('[zone-popup ВЫПОЛНИТЬ] locIdx:', this._locPopupIdx, '| loc:', loc.name,
                '| checkpoints:', JSON.stringify(loc.checkpoints.map(cp => cp.filled + '/' + cp.cells)),
                '| allDone:', allDone);
            if(allDone){
                this._capture(this._locPopupIdx);
            } else {
                this._attack(this._locPopupIdx, ci);
            }
            this._updateLocPopup(this._locPopupIdx);
        });

        this._locPopup    = win;
        this._locPopupIdx = locIdx;
        root.layer2_mc.addChild(win);
        if(window.iface) iface.restoreHud();

        try { this._updateLocPopup(locIdx); } catch(e){ console.warn('[zone-popup]', e); }
        win.visible = true;
        if(_iface) _iface._compassHide();
        this._preloadLocArts(locIdx);
    };

    // Прогрев текстур артов чекпоинтов локации — чтобы картинка задания появлялась без задержки
    proto._preloadLocArts = function(locIdx){
        const CA = './images/layers/popups/location/cp_art/';
        const loc = this.locations[locIdx];
        if(!loc || !loc.checkpoints) return;
        for(const cp of loc.checkpoints){
            if(cp.art) PIXI.Texture.from(CA + cp.art);
        }
    };

    proto._updateLocPopup = function(locIdx){
        this._locPopupIdx = locIdx;
        const loc = this.locations[locIdx];

        if(this._locBg && LOC_BG_IMGS[locIdx]){
            this._locBg.texture = PIXI.Texture.from(LOC_BG_IMGS[locIdx]);
        }

        // БИЗНЕС кнопка: пассив (серая) если не тронута, актив (красная) если хоть 1 ячейка или зачищена
        const hasAnyCells = (loc.cleared || 0) > 0 || loc.checkpoints.some(cp => cp.filled > 0);
        if(this._locBizI){ this._locBizI.visible = !hasAnyCells; }
        if(this._locBizA){ this._locBizA.visible = hasAnyCells; }

        const cpCont = this._locCpContainer;
        while(cpCont.children.length) cpCont.removeChildAt(0);

        const cps = loc.checkpoints;
        const N   = cps.length;

        const alreadyCleared = (loc.cleared || 0) > 0;
        const states = [];
        {
            let foundActive = false;
            for(let i = 0; i < N; i++){
                const done = cps[i].filled >= cps[i].cells;
                if(done){
                    states.push('done');
                } else if(!foundActive){
                    states.push('active');
                    foundActive = true;
                } else {
                    states.push('inactive');
                }
            }
        }

        // Чекпоинты: 6 слотов по 112px, центр строки CX=670, вертикаль CY=430
        const SLOT_W = 112;
        const CX = 670;
        const CY = 430;
        const totalW = N * SLOT_W;
        let slotX = CX - totalW / 2;

        for(let i = 0; i < N; i++){
            const state = states[i];
            let tex, w, h;
            if(state === 'done'){
                tex = PIXI.Texture.from(LL + 'чекпоинт готово.png');   w = 146; h = 130;
            } else if(state === 'active'){
                tex = PIXI.Texture.from(LL + 'чекпоинт актив.png');    w = 146; h = 129;
            } else {
                tex = PIXI.Texture.from(LL + 'чекпоинт неготово.png'); w = 106; h = 89;
            }
            const spr = new PIXI.Sprite(tex);
            spr.width  = w;
            spr.height = h;
            spr.x = Math.round(slotX + (SLOT_W - w) / 2);
            spr.y = Math.round(CY - h / 2);
            cpCont.addChild(spr);
            slotX += SLOT_W;
        }

        let activeCpIdx = cps.findIndex(cp => cp.filled < cp.cells);
        if(activeCpIdx < 0) activeCpIdx = N - 1;
        const allDone = loc.checkpoints.every(cp => cp.filled >= cp.cells);

        this._locExecActiv.texture = PIXI.Texture.from(LL + 'кнопка выполнить можно.png');
        this._locExecActiv.interactive = true;
        this._locExecActiv.buttonMode = true;
        const energyCost = allDone ? 0 : cps[activeCpIdx].cell_cost;
        // Кнопка ВСЕГДА видима — нехватка энергии обрабатывается по клику (открывает покупку
        // энергии), а не скрытием кнопки. Раньше при hasEnergy=false кнопка пропадала целиком,
        // из-за чего казалось, что прогресс захвата локации "сломался".
        this._locExecActiv.visible = true;
        if(this._locEnergyCostTxt){
            this._locEnergyCostTxt.text = allDone ? '' : String(cps[activeCpIdx].cell_cost);
        }

        if(this._locCellsCont){
            const cellCont = this._locCellsCont;
            while(cellCont.children.length) cellCont.removeChildAt(0);

            const cp       = cps[activeCpIdx];
            const cpFilled = cp ? cp.filled : 0;
            const cpCells  = cp ? cp.cells  : 5;

            // Ячейки — PSD: 51×19, gap=6, центр группы по x=535, верх по y=610
            const CELL_W = 51, CELL_H = 19, CELL_GAP = 6;
            const totalCellW = cpCells * CELL_W + (cpCells - 1) * CELL_GAP;
            const CELLS_CENTER_X = 535;
            const CELLS_Y = 610;
            let cx = CELLS_CENTER_X - totalCellW / 2;

            for(let i = 0; i < cpCells; i++){
                const fname = (i < cpFilled) ? 'ячейка пройденная.png' : 'ячейка непройденная.png';
                const spr = new PIXI.Sprite(PIXI.Texture.from(LL + fname));
                spr.width = CELL_W; spr.height = CELL_H;
                spr.x = Math.round(cx); spr.y = CELLS_Y;
                cellCont.addChild(spr);
                cx += CELL_W + CELL_GAP;
            }

            if(this._locCellsTxt){
                this._locCellsTxt.text = cpFilled + '/' + cpCells;
                this._locCellsTxt.x = CELLS_CENTER_X + totalCellW / 2 + 36.5;
                this._locCellsTxt.y = CELLS_Y + CELL_H / 2 + 0.5;
            }
        }

        if(this._locCpArt && this._locCpTask){
            const cp = cps[activeCpIdx];
            if(cp && cp.art){
                const CA = './images/layers/popups/location/cp_art/';
                const artUrl = CA + cp.art;
                console.log('[zone-popup._updateLocPopup] cp_art загрузка:', artUrl, '| cp:', activeCpIdx, '| loc:', locIdx);
                const artTex = PIXI.Texture.from(artUrl);
                // 27.09.2026 (адаптив под мобильные, экономия памяти): нативный размер 30
                // файлов cp_art_*.png уменьшен 1402×1122 → 480×384. Рисуются они и раньше
                // ровно в 160×107 (строки ниже), то есть в память грузилось в ~77 раз больше
                // пикселей, чем показывалось на экране: 30 файлов = 180 МБ распакованного RGBA
                // и 71 МБ загрузки — самая тяжёлая группа во всём раннем прелоаде (game-boot.js).
                // Здесь править НЕЧЕГО: размер задан явными width/height, а не scale — картинка
                // на экране осталась той же. Оригиналы — _originals_before_downscale_27_09_2026/.
                const _applyArtSize = ()=>{
                    this._locCpArt.width  = 160;
                    this._locCpArt.height = 107;
                    console.log('[zone-popup] cp_art размер применён:', artUrl, this._locCpArt.width, 'x', this._locCpArt.height);
                };
                this._locCpArt.texture = artTex;
                if(artTex.baseTexture.valid){ _applyArtSize(); }
                else { artTex.baseTexture.once('loaded', _applyArtSize); artTex.baseTexture.once('error', ()=>{ console.error('[zone-popup] cp_art ОШИБКА загрузки:', artUrl); }); }
                if(this._artCont) this._artCont.visible = true;
            } else {
                if(this._artCont) this._artCont.visible = false;
            }
            this._locCpTask.text = (cp && cp.task) ? cp.task : '';
        }
    };
}
