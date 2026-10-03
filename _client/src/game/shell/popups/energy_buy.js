/** Energy buy HUD button + VK IAP energy packs popup. */
import energyPacks from '../../../data/energy_packs.json';

export function attachEnergyBuy(proto){
	proto._initEnergyBuyBtn = function(){
		const btn = new PIXI.Sprite(PIXI.Texture.from('./images/hud/butt_energy_buy.png'));
		btn.x = 450 + 240 + 30 - 50 - 12 - 5 + 2;
		btn.y = 28;
		btn.interactive = true;
		btn.buttonMode = true;
		btn.on('pointerover',  ()=>{ btn.tint = 0xFFDD88; });
		btn.on('pointerout',   ()=>{ btn.tint = 0xFFFFFF; });
		btn.on('pointerdown',  ()=>this._openEnergyPopup());
		this.up.addChild(btn);
		this._energyBuyBtn = btn;
	};

	proto._openEnergyPopup = function(){
		if(this._energyWin){
			this._energyWin.visible = true;
			// addChild на УЖЕ добавленном ребёнке поднимает его в топ layer2_mc — без этого
			// попап энергии оставался в старой позиции z-order (там, где был добавлен ПЕРВЫЙ
			// раз) и оказывался ПОД попапом прохождения локации, если тот открылся позже.
			root.layer2_mc.addChild(this._energyWin);
			console.log('[energy_buy._openEnergyPopup] попап уже существовал — поднят поверх layer2_mc');
			return;
		}

		const win = new PIXI.Container();

		const close = () => { win.visible = false; };
		// Все модальные окна должны использовать одинаковое затемнение; здесь фон не закрывает
		// покупку при случайном нажатии, а только блокирует игру позади попапа.
		win.addChild(window._makeModalDimmer(null, 0.55));

		const bgTex = PIXI.Texture.from('./images/layers/popups/Энергия/попап покупки энергии.png');
		const bgSpr = new PIXI.Sprite(bgTex);
		bgSpr.x = 226; bgSpr.y = 80;
		bgSpr.interactive = true;
		win.addChild(bgSpr);

		const options = energyPacks;
		const cards = [
			{file:'кнопка энергии 50.png',       x:348, y:263},
			{file:'кнопка энергии 110.png',      x:548, y:263},
			{file:'кнопка энергии 180.png',      x:748, y:263},
			{file:'кнопка энергии 400.png',      x:948, y:263},
			{file:'кнопка энергии 850.png',      x:348, y:463},
			{file:'кнопка энергии 1300.png.png', x:548, y:463},
			{file:'кнопка энергии 2000.png',     x:748, y:463},
			{file:'кнопка энергии 3500.png.png', x:948, y:463},
		];

		options.forEach((opt, i) => {
			const card = cards[i];
			const slot = new PIXI.Sprite(PIXI.Texture.from('./images/layers/popups/Энергия/' + card.file));
			slot.anchor.set(0.5, 0.5); slot.x = card.x; slot.y = card.y;
			slot.interactive = true; slot.buttonMode = true;
			slot.on('pointerover', ()=>{ _sa(slot, 0.9); slot.scale.set(1.03); });
			slot.on('pointerout',  ()=>{ _sa(slot, 1); slot.scale.set(1); });
			// Выдачу энергии (item100-107) уже обрабатывает ЕДИНЫЙ глобальный
			// bridge.subscribe в bank.js (Bank.successDonat) — он ловит ЛЮБую
			// покупку через bridge.send('VKWebAppShowOrderBox', ...), откуда бы она
			// ни была вызвана. Раньше здесь была ВТОРАЯ, дублирующая подписка,
			// которая пыталась отписаться через `const _unsub = bridge.subscribe(...)`,
			// но bridge.subscribe() в этом проекте не возвращает функцию отписки
			// (см. bank.js — там ни разу не используется возврат) — вызов
			// несуществующего _unsub() бросал исключение прямо внутри диспетчера
			// VK Bridge, из-за чего VK показывал свой собственный попап
			// "Произошла ошибка" поверх уже корректно выданной энергии.
			slot.on('pointerdown', ()=>{
				bridge.send('VKWebAppShowOrderBox', { type: 'item', item: 'item' + (100 + i) });
			});
			win.addChild(slot);
		});

		const closeHit = new PIXI.Graphics();
		closeHit.beginFill(0xffffff, 0.01);
		closeHit.drawRect(1010, 88, 75, 85);
		closeHit.endFill();
		closeHit.interactive = true; closeHit.buttonMode = true;
		closeHit.on('pointerover', ()=>{ _sa(closeHit, 0.7); closeHit.scale.set(1.08); });
		closeHit.on('pointerout', ()=>{ _sa(closeHit, 1.0); closeHit.scale.set(1); });
		closeHit.on('pointerdown', close);
		win.addChild(closeHit);
		const closeTxt = new PIXI.Text('×', {fontFamily:'Arial', fontSize:46, fill:'#d4c5a8', fontWeight:'bold'});
		closeTxt.anchor.set(0.5, 0.5); closeTxt.x = 1047; closeTxt.y = 124;
		closeTxt.interactive = true; closeTxt.buttonMode = true;
		closeTxt.on('pointerover', ()=>{ _sa(closeTxt, 0.75); _ss(closeTxt, 1.08); });
		closeTxt.on('pointerout', ()=>{ _sa(closeTxt, 1); _ss(closeTxt, 1); });
		closeTxt.on('pointerdown', close);
		win.addChild(closeTxt);

		this._energyWin = win;
		root.layer2_mc.addChild(win);
	};
}
