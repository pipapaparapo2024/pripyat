// 26.10.2026 (по прямому указанию) — попап правил 2048. Фон "2048 правила игры.png" уже
// содержит весь текст правил, запечённый в саму картинку (персонаж "Седой" + список правил) —
// здесь только позиционирование фона и кнопки выхода, никакого динамического текста.
export function attachGame2048RulesPopup(proto){

    proto._openGame2048RulesPopup = function(){
        if(!this._rulesWin) this._buildGame2048RulesPopup();
        root.layer2_mc.addChild(this._rulesWin);
    };

    proto._closeGame2048RulesPopup = function(){
        if(this._rulesWin && this._rulesWin.parent) this._rulesWin.parent.removeChild(this._rulesWin);
    };

    proto._buildGame2048RulesPopup = function(){
        const IMG = './images/';
        const win = new PIXI.Container();
        win.interactive = true;

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.001);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        const bg = new PIXI.Sprite(PIXI.Texture.from(IMG + '2048 правила игры.png'));
        bg.x = 245; bg.y = 77;
        win.addChild(bg);

        // Продиктовано явно: "Выйти" ВНУТРИ этого попапа, x944,y102 — не путать со стандартной
        // кнопкой выхода главного экрана игры (см. game2048.js, x1240,y83 — та другая, общая
        // для всех экранов проекта).
        const exitBtn = new PIXI.Sprite(PIXI.Texture.from(IMG + '2048 выйти.png'));
        if(window.isMobile) helper.touchPad(exitBtn);
        exitBtn.x = 944; exitBtn.y = 102;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', () => { exitBtn.scale.set(1.08); });
        exitBtn.on('pointerout',  () => { exitBtn.scale.set(1); });
        exitBtn.on('pointerdown', () => this._closeGame2048RulesPopup());
        win.addChild(exitBtn);

        this._rulesWin = win;
    };
}
