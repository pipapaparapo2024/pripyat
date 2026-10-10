/** Energy buy HUD button + VK IAP energy packs popup. */
import energyPacks from '../../../data/energy_packs.json';
import { isOk } from '../../../modules/platform.js';
import { startPurchase } from '../../../modules/iap.js';

// 09.10.2026 (по прямому указанию — "теперь тебе сверху в окошке придётся самому вписывать
// ценники"): новые унифицированные карточки энергии (присланы отдельно, заменяют старые) больше
// НЕ содержат цену, нарисованную художником — старые ассеты рисовались ТОЛЬКО под VK ("N голосов"
// было частью картинки), что и так уже было найдено модерацией ОК как нарушение ("цена не в
// валюте площадки", см. комментарий в genSlots() bank.js). Новые карточки вместо этого содержат
// пустую табличку-рамку сверху (под "+N энергии" снизу) — именно под неё и кладётся текст цены,
// теперь для ОБЕИХ площадок (раньше текстом рисовалась цена ТОЛЬКО для ОК поверх VK-картинки,
// см. историю ниже). Координата подобрана по реальным пикселям присланных файлов (185×~195,
// табличка — верхние ~y:3-37, центр ~y:20) — ЕСЛИ карточка визуально не совпадёт с art, сверить
// через редактор позиций и поправить ENERGY_PRICE_OFFSET_Y/ENERGY_PRICE_OFFSET_X.
// 09.10.2026 (правка тем же днём, по прямому указанию редактора позиций — "шрифт на подписи
// опусти вниз на 2px и вправо на 3px"): offset Y сдвинут с -78 на -76 (+2 вниз), добавлен
// offset X (+3 вправо) — для ОБЕИХ площадок одинаково (один и тот же PIXI.Text).
const ENERGY_PRICE_OFFSET_Y = -76;
const ENERGY_PRICE_OFFSET_X = 3;

// 09.10.2026 (точечная подстройка тем же днём, по прямому указанию — "для 60 голосов подними
// вверх на 2px, для 85 — на 1px, для 120 — на 1px и вправо на 4px"): индексы совпадают с
// позицией пакета в energyPacks.json/cards — 5=votes:60(1300 энергии), 6=votes:85(2000),
// 7=votes:120(3500). Остальные 5 карточек используют только общий offset выше, без правок.
const ENERGY_PRICE_FINE_TUNE = {
	5: { dx: 0, dy: -2 },
	6: { dx: 0, dy: -1 },
	7: { dx: 4, dy: -1 },
};

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

		// 05.10.2026 (по прямому указанию, после ДВУХ живых тестов за день — см. докблок
		// iap.js): прежний "Вариант А" (прятать покупки на ОК целиком) заменён реальной покупкой
		// через FAPI.UI.showPayment() с явной ценой — карточки снова показываются на ОК, клик
		// идёт через тот же startPurchase() (modules/iap.js), платформо-зависимый.
		options.forEach((opt, i) => {
			const card = cards[i];
			const slot = new PIXI.Sprite(PIXI.Texture.from('./images/layers/popups/Энергия/' + card.file));
			slot.anchor.set(0.5, 0.5); slot.x = card.x; slot.y = card.y;
			slot.interactive = true; slot.buttonMode = true;
			if(window.isMobile) helper.touchPad(slot, 128);
			console.log('[energy_buy.initButtons] карточка покупки готова | item:', 100 + i,
				'| interactive:', slot.interactive, '| x,y:', slot.x, slot.y,
				'| width,height:', Math.round(slot.width), Math.round(slot.height),
				'| hitArea:', slot.hitArea ? JSON.stringify(slot.hitArea) : 'обычный bounds');
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
			slot.on('pointerdown', (e)=>{
				console.log('[energy_buy.initButtons] PIXI pointerdown по карточке энергии | item:', 100 + i,
					'| priceOk:', opt.price_ok, '| PIXI global:', e && e.data ? Math.round(e.data.global.x) + ',' + Math.round(e.data.global.y) : 'нет');
				startPurchase('item' + (100 + i), opt.price_ok, opt.energy + ' энергии');
			});
			win.addChild(slot);

			// 09.10.2026 (см. комментарий у ENERGY_PRICE_OFFSET_Y выше — новые унифицированные
			// карточки без цены на art): цена показывается ТЕПЕРЬ для ЛЮБОЙ площадки (раньше —
			// только для ОК, поверх VK-картинки с уже нарисованной ценой голосов; новая картинка
			// одна на все площадки и вообще не содержит цены). Платформо-зависимое число и
			// склонение — тот же приём, что bank.js._displayPrice()/genSlots(): ОК показывает
			// price_ok напрямую, VK — votes (helper.numberEnd само возьмёт нужные склонения
			// "голос/голоса/голосов" или "ОК/ОКа/ОКов" через modules/platform.js.currencyNames()).
			// Фона под текст НЕ рисуем — на новой картинке уже есть готовая табличка-рамка,
			// второй тёмный прямоугольник поверх нее смотрелся бы задвоенно.
			const price = isOk() ? opt.price_ok : opt.votes;
			// 09.10.2026 (правка тем же днём): fontSize 18→16 (-2px), цвет #ffdd44 (золотой) →
			// #ffffff (белый) — по прямому указанию, для ОБЕИХ площадок одинаково.
			const priceTxt = new PIXI.Text(price + ' ' + helper.numberEnd(price, 'votes'), {
				fontFamily:'Southbank LT', fontSize:16, fill:'#ffffff',
				dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1
			});
			priceTxt.anchor.set(0.5, 0.5);
			const fine = ENERGY_PRICE_FINE_TUNE[i] || { dx: 0, dy: 0 };
			priceTxt.x = card.x + ENERGY_PRICE_OFFSET_X + fine.dx;
			priceTxt.y = card.y + ENERGY_PRICE_OFFSET_Y + fine.dy;
			win.addChild(priceTxt);
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
