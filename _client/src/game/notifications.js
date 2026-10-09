export default class Notifications{
	constructor(result_window){
		this.result = result_window;

		this.random_name = ['Ошибка', 'Результат'];

		this.initUnics();
		this.initButtons();
	}

	// Старый попап «РЕЗУЛЬТАТ/УСПЕХ» (FLA this.result) убран по прямому указанию.
	// НО показывать успех/инфо ("Локация куплена!") тем же красным "ОШИБКА"-попапом с
	// треугольником-восклицанием — тоже неверно (репорт: покупка локации выглядит как
	// сбой). Поэтому снова два разных стиля, оба без FLA: random_num=0 — ошибка
	// (_showErrorSprite, "попап ошибка.png"), random_num=1 — нейтральное инфо/успех
	// (_showInfoSprite, "окно сообщения.png", без "ОШИБКА"/треугольника).
	showResult(data, random_num = 0, onClose = null){
		this._onCloseCallback = onClose || null;
		if(random_num === 0) this._showErrorSprite(data['text'] || data, onClose);
		else this._showInfoSprite(data['text'] || data, onClose);
	}

	_showErrorSprite(text, onClose){
		if(this._errWin && this._errWin.parent) this._errWin.parent.removeChild(this._errWin);
		this._errWin = null;

		const BASE = './images/';
		const win = new PIXI.Container();
		win.interactive = true;

		const bgBlock = new PIXI.Graphics();
		bgBlock.beginFill(0x000000, 0.6);
		bgBlock.drawRect(0, 0, 1280, 720);
		bgBlock.endFill();
		bgBlock.interactive = true;
		win.addChild(bgBlock);

		const popup = new PIXI.Container();
		popup.x = 283; popup.y = 91;
		win.addChild(popup);

		const bg = new PIXI.Sprite(PIXI.Texture.from(BASE + 'попап ошибка.png'));
		bg.scale.set(0.5);
		bg.y = -20;
		bg.interactive = true;
		popup.addChild(bg);

		const bodyTxt = new PIXI.Text(text, {
			fontFamily: 'Southbank LT', fontSize: 24, fill: '#e8c088',
			align: 'center', wordWrap: true, wordWrapWidth: 542,
			dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1
		});
		bodyTxt.anchor.set(0.5, 0.5);
		bodyTxt.x = 357; bodyTxt.y = 335;
		popup.addChild(bodyTxt);

		const okBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'попап ошибка кнопка понятно.png'));
		okBtn.anchor.set(0.5, 0.5);
		okBtn.scale.set(0.55);
		okBtn.x = 357; okBtn.y = 442;
		okBtn.interactive = true; okBtn.buttonMode = true;
		okBtn.on('pointerover', ()=>{ okBtn.alpha = 0.8; });
		okBtn.on('pointerout',  ()=>{ okBtn.alpha = 1; });
		okBtn.on('pointerdown', ()=>{
			if(win.parent) win.parent.removeChild(win);
			this._errWin = null;
			if(this._onCloseCallback){ const cb = this._onCloseCallback; this._onCloseCallback = null; cb(); }
		});
		popup.addChild(okBtn);

		this._errWin = win;
		root.layer2_mc.addChild(win);
		if(window.iface) iface.restoreHud();
	}

	// Успех/инфо (не ошибка!) — по прямому указанию: никакого попапа вообще не показываем
	// (пробовали компактную "окно сообщения.png" — визуально выглядела как большой пустой
	// бежевый блок, отклонено). onClose всё равно вызывается — на нём завязана дальнейшая
	// логика некоторых экранов (см. showResult(..., 1, onClose)).
	_showInfoSprite(text, onClose){
		this._onCloseCallback = null;
		if(onClose) onClose();
	}

	hide(){
		if(this._errWin && this._errWin.parent){
			this._errWin.parent.removeChild(this._errWin);
			this._errWin = null;
		} else {
			helper.fadeAnimation(this.result.shadow_mc, 'fadeOut', 200, ()=>{
				if(this.result.parent) this.result.parent.removeChild(this.result);
			});
		}
		if(this._onCloseCallback){ const cb = this._onCloseCallback; this._onCloseCallback = null; cb(); }
	}

	initButtons(){
		this.result.shadow_mc.interactive = true;
		this.result.shadow_mc.on('pointerdown', ()=>this.hide());
	}

	initUnics(){}
}