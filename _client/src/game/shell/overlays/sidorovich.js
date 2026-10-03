/** Sidorovich trader popup. */

export function attachSidorovich(proto){
	proto._openSidorovichPopup = function(){
		// Пересобираем, чтобы слой рюкзака поверх банок всегда был актуален
		if(this._sidWin && this._sidWin.parent){
			this._sidWin.parent.removeChild(this._sidWin);
		}
		this._sidWin = null;

		const BASE = './images/layers/popups/sidorovich/';

		// Ждем загрузки основного фона перед показом
		const _sidTex = PIXI.Texture.from(BASE + 'popup_sidorovich.png');
		if(!_sidTex.baseTexture.valid){
			this._compassShow();
			const _sidCb = ()=>{ this._compassHide(); this._openSidorovichPopup(); };
			_sidTex.baseTexture.once('loaded', _sidCb);
			_sidTex.baseTexture.once('error',  _sidCb);
			return;
		}
		const win = new PIXI.Container();

		// Зона между HUD: верхний HUD y=0..58, нижний визуально чуть ниже 596 —
		// маску опускаем, чтобы закрыть черную щель у нижнего HUD
		const TOP_HUD = 58;
		const BOT_HUD = 604;
		const MID_H   = BOT_HUD - TOP_HUD;

		// Overlay покрывает пространство между HUD
		const overlay = new PIXI.Graphics();
		overlay.beginFill(0x000000, 0.55);
		overlay.drawRect(0, TOP_HUD, 1280, MID_H);
		overlay.endFill();
		overlay.interactive = true;
		overlay.on('pointerdown', ()=>{ win.visible = false; });
		win.addChild(overlay);

		// Панель 1280×601: поднята на 26+12px; hover/хиты идут через PANEL_Y_SID / t()
		const PANEL_H = 601;
		const PANEL_Y_SID = BOT_HUD - PANEL_H + 70 + 8 - 26 - 12;
		const panel = new PIXI.Sprite(PIXI.Texture.from(BASE + 'popup_sidorovich.png'));
		panel.x = 0;
		panel.y = PANEL_Y_SID;
		panel.width  = 1280;
		panel.height = PANEL_H;
		panel.interactive = true;
		win.addChild(panel);

		// Маска: mid-зона до опущенного BOT_HUD
		const maskGfx = new PIXI.Graphics();
		maskGfx.beginFill(0xffffff);
		maskGfx.drawRect(0, TOP_HUD, 1280, MID_H);
		maskGfx.endFill();
		win.addChild(maskGfx);
		win.mask = maskGfx;

		// Кнопка Выход — опущена на 40px
		const exitBtn = new PIXI.Sprite(PIXI.Texture.from('./images/layers/zone/btn_exit.png'));
		exitBtn.scale.set(0.5);
		if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
		exitBtn.x = 1240;
		exitBtn.y = TOP_HUD + 32;
		exitBtn.interactive = true;
		exitBtn.buttonMode = true;
		exitBtn.on('pointerover', ()=>{ _sa(exitBtn, 0.75); exitBtn.scale.set(0.54); });
		exitBtn.on('pointerout', ()=>{ _sa(exitBtn, 1); exitBtn.scale.set(0.5); });
		// 25.09.2026 (баг найден по прямому указанию — "открыл ящик у Сидоровича, вернулся к
		// Сидоровичу, закрыл крестиком — оба ХУДа пропали"): раньше выход вручную перекидывал
		// this.up/this.down в root.layer1_mc — единственное место во всём проекте, которое
		// уводило ХУД ИЗ root.layer2_mc (см. коммент в interface.js.restoreHud() — "нижний ХУД
		// всегда клался в layer2_mc"). Если поверх Сидоровича успевал остаться открытым ЛЮБОЙ
		// другой оверлей в layer2_mc (например Ящик — экран которого сам не закрывался при
		// повторном открытии Сидоровича через нижнюю панель, см. _closeAllPanels в
		// interface-panels.js), тот оверлей визуально перекрывал ХУД снизу в layer1_mc — ХУД
		// оставался technically visible=true, но невидим на экране. Сидорович был ЕДИНСТВЕННЫМ
		// экраном, не участвовавшим в декларативном ХУД-стеке (pushHud/popHud) — теперь тоже
		// участвует: popHud() сам восстанавливает требование экрана ПОД ним (например боёвки с
		// боссом, если Сидорович был открыт поверх неё — см. bosses_fight.js pushHud('bossFight',
		// {down:false})), специальный ручной _inFight-код больше не нужен.
		exitBtn.on('pointerdown', ()=>{
			win.visible = false;
			this.popHud('sidorovich');
		});
		win.addChild(exitBtn);

		// Координаты кнопок: y_orig из изображения 1280×601, прямое смещение
		const t = (y) => Math.round(PANEL_Y_SID + y);

		// Кнопки "Купить", "Открыть", "Вскрыть" убраны — взаимодействие через хит-зоны
		// Логика "купить ресурсы" осталась на хит-зоне банки (boxHit ниже)

		// Hover-эффекты (под сумкой — добавляются первыми)
		const bankaActiv = new PIXI.Sprite(PIXI.Texture.from(BASE + 'banka_activ.png'));
		bankaActiv.x = 264;
		bankaActiv.y = PANEL_Y_SID + 295;
		bankaActiv.visible = false;
		bankaActiv.interactive = false;
		win.addChild(bankaActiv);

		const konservaActiv = new PIXI.Sprite(PIXI.Texture.from(BASE + 'konserva_activ.png'));
		konservaActiv.x = 24;
		konservaActiv.y = PANEL_Y_SID + 216;
		konservaActiv.visible = false;
		konservaActiv.interactive = false;
		win.addChild(konservaActiv);

		const sigActiv = new PIXI.Sprite(PIXI.Texture.from(BASE + 'sig_activ.png'));
		sigActiv.x = 27;
		sigActiv.y = PANEL_Y_SID + 52 + 2;
		sigActiv.visible = false;
		sigActiv.interactive = false;
		win.addChild(sigActiv);

		// Hover для ящика (chest)
		const yashikActiv = new PIXI.Sprite(PIXI.Texture.from('./images/yashik_activ.png'));
		yashikActiv.x = 888;
		yashikActiv.y = 406;
		yashikActiv.visible = false;
		yashikActiv.interactive = false;
		win.addChild(yashikActiv);

		// Рюкзак: поверх всех hover-эффектов (добавляется последней из спрайтов)
		const sumkaFront = new PIXI.Sprite(PIXI.Texture.from(BASE + 'sumka_front.png'));
		sumkaFront.x = 0;
		sumkaFront.y = PANEL_Y_SID + 66 - 3;
		sumkaFront.visible = true;
		sumkaFront.interactive = false;
		win.addChild(sumkaFront);

		const sumkaActiv = new PIXI.Sprite(PIXI.Texture.from(BASE + 'sumka_activ.png'));
		sumkaActiv.x = 0;
		sumkaActiv.y = PANEL_Y_SID + 66 - 3 - 22 + 14;
		sumkaActiv.visible = false;
		sumkaActiv.interactive = false;
		win.addChild(sumkaActiv);

		// Хит-зона консерв — полная полка как раньше
		const konservaHit = new PIXI.Graphics();
		konservaHit.beginFill(0xffffff, 0.001);
		konservaHit.drawRect(24, t(212), 620, 72);
		konservaHit.endFill();
		konservaHit.interactive = true;
		konservaHit.buttonMode = true;
		konservaHit.on('pointerover', ()=>{ konservaActiv.visible = true; });
		konservaHit.on('pointerout',  ()=>{ konservaActiv.visible = false; });
		konservaHit.on('pointerdown', ()=>{ if(window.bank && typeof bank.init==='function'){ bank.init('stew'); root.layer2_mc.addChild(bank.atm); if(window.iface) iface.restoreHud(); } });
		win.addChild(konservaHit);

		// Хит-зона банки монет → купить монеты
		const boxHit = new PIXI.Graphics();
		boxHit.beginFill(0xffffff, 0.001);
		boxHit.drawRect(270, t(305), 160, 180);
		boxHit.endFill();
		boxHit.interactive = true;
		boxHit.buttonMode = true;
		boxHit.on('pointerover', ()=>{ bankaActiv.visible = true; });
		boxHit.on('pointerout',  ()=>{ bankaActiv.visible = false; });
		boxHit.on('pointerdown', ()=>{ if(window.bank && typeof bank.init==='function'){ bank.init('coins'); root.layer2_mc.addChild(bank.atm); if(window.iface) iface.restoreHud(); } });
		win.addChild(boxHit);

		// Хит-зона сигарет → купить сигареты (только верхняя полка)
		const sigHit = new PIXI.Graphics();
		sigHit.beginFill(0xffffff, 0.001);
		sigHit.drawRect(27, t(52) + 2, 620, 78);
		sigHit.endFill();
		sigHit.interactive = true;
		sigHit.buttonMode = true;
		sigHit.on('pointerover', ()=>{ sigActiv.visible = true; });
		sigHit.on('pointerout',  ()=>{ sigActiv.visible = false; });
		sigHit.on('pointerdown', ()=>{ if(window.bank && typeof bank.init==='function'){ bank.init('cigarettes'); root.layer2_mc.addChild(bank.atm); if(window.iface) iface.restoreHud(); } });
		win.addChild(sigHit);

		// Хит-зона рюкзака — поверх консерв, чтобы клик/hover работали
		const bagHit = new PIXI.Graphics();
		bagHit.beginFill(0xffffff, 0.001);
		bagHit.drawRect(0, t(135), 250, 430);
		bagHit.endFill();
		bagHit.interactive = true;
		bagHit.buttonMode = true;
		bagHit.on('pointerover', ()=>{ sumkaActiv.visible = true; });
		bagHit.on('pointerout',  ()=>{ sumkaActiv.visible = false; });
		bagHit.on('pointerdown', ()=>{ this._openRyukzakReward(); });
		win.addChild(bagHit);

		// Хит-зона ящика → вскрыть лут
		const chestHit = new PIXI.Graphics();
		chestHit.beginFill(0xffffff, 0.001);
		chestHit.drawRect(900, t(330), 370, 240);
		chestHit.endFill();
		chestHit.interactive = true;
		chestHit.buttonMode  = true;
		chestHit.on('pointerover', ()=>{ yashikActiv.visible = true; });
		chestHit.on('pointerout',  ()=>{ yashikActiv.visible = false; });
		chestHit.on('pointerdown', ()=>{ this._openYashikScreen(); });
		win.addChild(chestHit);

		this._sidWin = win;
		// layer2 — поверх боковых панелей; HUD поднимаем поверх
		root.layer2_mc.addChild(win);
		// 25.09.2026 (декларативный ХУД, см. коммент у exitBtn ниже) — раньше здесь вручную
		// показывались this.up/this.down; теперь Сидорович заявляет требование через общий
		// стек, как и все остальные экраны (interface.js.pushHud/popHud).
		this.pushHud('sidorovich', {});
	};
}
