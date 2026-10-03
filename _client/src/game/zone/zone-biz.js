/** Попап бизнеса на локации + предзагрузка ассетов. */
export function attachZoneBiz(proto){

    proto._preloadLocationAssets = function(){
        const LL  = './images/layers/popups/location/';
        const BIZ = './images/layers/biz/';
        const files = [
            'loc_kordon','loc_svalka','loc_dolina','loc_agroprom','loc_yantar'
        ].map(n => LL + n + '.png').concat([
            LL+'cp_activ.png', LL+'cp_done.png', LL+'cp_inactive.png',
            LL+'кнопка выполнить можно.png', LL+'кнопка выполнить нельзя.png',
            LL+'btn_biz_activ.png',  LL+'btn_biz_passiv.png',
            LL+'exit.png', LL+'biz_popup.png',
            BIZ+'biz_bg.png',
            BIZ+'biz_btn_activ.png',
            BIZ+'biz_btn_passiv.png',
            BIZ+'biz_prog_passiv.png',
            BIZ+'biz_prog_weapon.png',
            BIZ+'biz_prog_loot.png',
            BIZ+'biz_prog_toll.png',
            LL+'nagrada_uvag.png', LL+'nagrada_korona.png',
            LL+'cell_empty.png',   LL+'cell_filled.png',
            LL+'loc_sign_kordon.png', LL+'loc_sign_svalka.png', LL+'loc_sign_dolina.png',
            LL+'loc_sign_agroprom.png', LL+'loc_sign_yantar.png',
        ]);
        files.forEach(url => PIXI.Texture.from(url));
    };

    proto._openBizPopup = function(){
        if(this._bizPopup && this._bizPopup.parent){
            this._bizPopup.parent.removeChild(this._bizPopup);
        }
        this._bizPopup = null;

        const locIdx = this._locPopupIdx;
        const loc    = this.locations[locIdx];
        const bizArr = loc.businesses;
        const LL     = './images/layers/popups/location/';
        const BIZ    = './images/layers/biz/';

        const LOC_SIGN_FILES = [
            'loc_sign_kordon.png', 'loc_sign_svalka.png', 'loc_sign_dolina.png',
            'loc_sign_agroprom.png', 'loc_sign_yantar.png'
        ];
        const signFile = LL + (LOC_SIGN_FILES[locIdx] || LOC_SIGN_FILES[0]);

        const win = new PIXI.Container();
        win.interactive = true;

        const bg = new PIXI.Sprite(PIXI.Texture.from(BIZ + 'biz_bg.png'));
        bg.interactive = true;
        win.addChild(bg);

        const sign = new PIXI.Sprite(PIXI.Texture.from(signFile));
        sign.anchor.set(0.5, 0.5);
        sign.scale.set(0.75);
        sign.x = 664; sign.y = 106;
        win.addChild(sign);

        const exitBtn = new PIXI.Sprite(PIXI.Texture.from('./images/выход.png'));
        exitBtn.anchor.set(0.5, 0.5);
        exitBtn.scale.set(0.5);
        if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
        exitBtn.x = 1230; exitBtn.y = 100;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', ()=>{ _sa(exitBtn, 0.75); exitBtn.scale.set(0.54); });
        exitBtn.on('pointerout', ()=>{ _sa(exitBtn, 1); exitBtn.scale.set(0.5); });
        exitBtn.on('pointerdown',  ()=>{
            win.visible = false;
        });
        win.addChild(exitBtn);

        const hasCapture = (loc.cleared || 0) > 0 || loc.checkpoints.some(cp => cp.filled > 0);

        const cardCount = bizArr.length;
        let cardCX;
        if(cardCount === 1)      cardCX = [640];
        else if(cardCount === 2) cardCX = [340, 940];
        else                     cardCX = [240, 640, 1040];

        const incomeMap = {
            income_exp:  { label:'ОПЫТ',     color:'#5599ff', progFile: BIZ+'biz_prog_weapon.png' },
            income_resp: { label:'УВАЖЕНИЕ', color:'#44cc66', progFile: BIZ+'biz_prog_loot.png'   },
            income_cig:  { label:'СИГАРЕТЫ', color:'#ff8822', progFile: BIZ+'biz_prog_toll.png'   },
        };

        const BTN_OFFSETS  = [150, 26, -96];
        const CUBE_OFFSETS = [{x:150,y:14}, {x:30,y:14}, {x:-90,y:14}];

        bizArr.forEach((biz, bi) => {
            const cx      = cardCX[bi];
            const btnX    = cx + (BTN_OFFSETS[bi]  || 0);
            const cubeOff = CUBE_OFFSETS[bi] || {x:0, y:0};
            const incKey  = biz.income_exp ? 'income_exp' : biz.income_resp ? 'income_resp' : 'income_cig';
            const imap    = incomeMap[incKey];
            const lv      = biz.level;
            const maxLv   = biz.max_level;

            const incomeVal   = biz[incKey] ? biz[incKey][lv] : 0;
            const incomeColor = { income_exp:'#5599ff', income_resp:'#44cc66', income_cig:'#ff8822' }[incKey];
            const incomeXShift = [232, 88, -24][bi] || 0;
            const incomeYShift = [0, 22, 20][bi] || 0;
            const incomeTxt = new PIXI.Text('+' + incomeVal, {
                fontFamily:'Southbank LT', fontSize:22, fill: lv > 0 ? incomeColor : '#666666',
            });
            incomeTxt.anchor.set(0.5, 0.5);
            incomeTxt.x = cx + incomeXShift;
            incomeTxt.y = 504 + (CUBE_OFFSETS[bi] ? CUBE_OFFSETS[bi].y : 0) - 12 + incomeYShift;
            win.addChild(incomeTxt);

            const CUBE_W = 19, CUBE_GAP = 3;
            const totalW = maxLv * CUBE_W + (maxLv - 1) * CUBE_GAP;
            let cubeX = cx - totalW / 2 + cubeOff.x;
            for(let i = 0; i < maxLv; i++){
                const cube = new PIXI.Sprite(PIXI.Texture.from(i < lv ? imap.progFile : BIZ + 'biz_prog_passiv.png'));
                cube.x = cubeX; cube.y = 524 + cubeOff.y;
                win.addChild(cube);
                cubeX += CUBE_W + CUBE_GAP;
            }

            const canUp = lv < maxLv && hasCapture;
            const btn = new PIXI.Sprite(PIXI.Texture.from(canUp ? BIZ+'biz_btn_activ.png' : BIZ+'biz_btn_passiv.png'));
            btn.anchor.set(0.5, 0); btn.x = btnX; btn.y = 566;
            if(canUp){
                btn.interactive = true; btn.buttonMode = true;
                let _bizTip = null;
                btn.on('pointerover', ()=>{
                    btn.alpha = 0.85;
                    if(_bizTip && _bizTip.parent) return;
                    const tip = new PIXI.Container();
                    const tipBg = new PIXI.Graphics();
                    tipBg.beginFill(0x1a1a1a, 0.92);
                    tipBg.lineStyle(1, 0xcc7200, 1);
                    tipBg.drawRoundedRect(0, 0, 200, 44, 6);
                    tipBg.endFill();
                    tip.addChild(tipBg);
                    const t1 = new PIXI.Text('УЛУЧШЕНИЕ', {fontFamily:'Southbank LT', fontSize:16, fill:'#aaaaaa'});
                    t1.anchor.set(0.5, 0); t1.x = 100; t1.y = 4;
                    tip.addChild(t1);
                    const t2 = new PIXI.Text(biz.costs[lv] + ' СИГАРЕТ', {fontFamily:'Southbank LT', fontSize:22, fill:'#ff8822'});
                    t2.anchor.set(0.5, 0); t2.x = 100; t2.y = 22;
                    tip.addChild(t2);
                    tip.x = btnX - 100; tip.y = 554;
                    win.addChild(tip);
                    _bizTip = tip;
                });
                btn.on('pointerout', ()=>{
                    btn.alpha = 1;
                    if(_bizTip && _bizTip.parent) _bizTip.parent.removeChild(_bizTip);
                    _bizTip = null;
                });
                btn.on('pointerdown', ()=>{
                    if(_bizTip && _bizTip.parent) _bizTip.parent.removeChild(_bizTip);
                    _bizTip = null;
                    // Баг найден 18.09.2026: безусловный _openBizPopup() СРАЗУ после
                    // _upgradeBusiness() пересобирал попап и добавлял его В КОНЕЦ layer2_mc
                    // (== поверх всего), включая только что показанный попап ошибки
                    // ("Недостаточно сигарет") — тот визуально оказывался ПОД свежепересобранным
                    // попапом бизнеса. zone._upgradeBusiness() уже сама вызывает _openBizPopup()
                    // из СВОЕГО success-колбэка (см. zone.js) — второй вызов здесь был лишним.
                    this._upgradeBusiness(locIdx, bi);
                });
            }
            win.addChild(btn);
        });

        this._bizPopup = win;
        // Не скрываем locPopup — он служит фоном (zone select находится в layer1_mc)
        root.layer2_mc.addChild(win);
    };
}
