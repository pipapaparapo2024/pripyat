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

// 06.11.2026: requested shifts are added to the previous per-card offsets.
const ENERGY_PRICE_FINE_TUNE = {
    0: { dx: 4, dy: 1 },
    1: { dx: 5, dy: 0 },
    3: { dx: 4, dy: 0 },
    4: { dx: 3, dy: 0 },
    5: { dx: 4, dy: 0 },
    6: { dx: 5, dy: 0 },
    7: { dx: 9, dy: 1 },
};

export function attachEnergyBuy(proto){
	// 18.10.2026 (по прямому указанию — "butt_energy_buy.png вообще убери"): отдельная
	// кнопка-плюс в HUD убрана целиком — попап энергии теперь открывается кликом по самому
	// тексту количества энергии (energy_txt, см. interface.js.initNickLabel()).

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

        // Canvas text must be created after the actual font has loaded.
        if(!this._energyFontReady && typeof document !== 'undefined' && document.fonts?.load){
            if(!this._energyFontLoading){
                this._energyFontLoading = document.fonts.load('18px "Southbank LT"', '0123456789 Энергия').then(()=>{
                    this._energyFontReady = true;
                    this._energyFontLoading = null;
                    this._openEnergyPopup();
                }).catch(()=>{
                    this._energyFontLoading = null;
                    console.warn('[energy_buy] Не удалось загрузить шрифт магазина');
                });
            }
            return;
        }
        const energyTextStyle = {
            fontFamily:'Southbank LT', fontSize:18,
            fill:['#ffffff', '#c8c8c8'],
            stroke:'#3a3a3a', strokeThickness:2,
            dropShadow:true, dropShadowColor:'#000000', dropShadowAlpha:0.72,
            dropShadowDistance:2, dropShadowBlur:2, dropShadowAngle:1.187,
            padding:8
        };
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
            // The original image is the only purchase button, over its full bounds.
            slot.interactive = true; slot.buttonMode = true;
            const syncHitArea = ()=>{
                const w = slot.texture.orig.width, h = slot.texture.orig.height;
                // Texture.from may return a 1x1 placeholder before the image arrives.
                // Never freeze that placeholder as the permanent purchase hit area.
                if(w<=1 || h<=1){slot.hitArea=null;return;}
                slot.hitArea = new PIXI.Rectangle(-w/2,-h/2,w,h);
                if(window.isMobile) helper.touchPad(slot, 128);
            };
            slot.name = 'energy-purchase-' + (100+i);
            syncHitArea();
            const hitTexture = slot.texture;
            hitTexture.on('update',syncHitArea);
            slot.once('destroyed',()=>hitTexture.off('update',syncHitArea));
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
			const price = window.__siteRuntime ? window.siteRubCatalog.energy[i] : window.__telegramRuntime ? window.telegramStarsCatalog.energy.stars[i] : (isOk() ? opt.price_ok : opt.votes);
			// 09.10.2026 (правка тем же днём): fontSize 18→16 (-2px), цвет #ffdd44 (золотой) →
			// #ffffff (белый) — по прямому указанию, для ОБЕИХ площадок одинаково.
			// 18.10.2026 (по прямому указанию — "сделай текст голосов такой же, как на картинке
			// 2": Southbank LT, 18.34pt ≈ 18px, белый): fontSize возвращён на 18.
			const priceTxt = new PIXI.Text(price + ' ' + helper.numberEnd(price, 'votes'), energyTextStyle);
			priceTxt.anchor.set(0.5, 0.5);
			const fine = ENERGY_PRICE_FINE_TUNE[i] || { dx: 0, dy: 0 };
			priceTxt.x = card.x + ENERGY_PRICE_OFFSET_X + fine.dx;
			priceTxt.y = card.y + ENERGY_PRICE_OFFSET_Y + fine.dy;
			win.addChild(priceTxt);
            priceTxt.interactive = false;
            slot.on('pointerover',()=>{ _sa(slot,0.9); slot.scale.set(1.03); });
            slot.on('pointerout',()=>{ _sa(slot,1); slot.scale.set(1); });
            slot.on('pointerdown',e=>{
                console.log('[energy_buy.initButtons] PIXI pointerdown по карточке энергии',100+i);
                e?.stopPropagation?.();
                if(this._energyPurchasePending)return;
                const failed = ()=>{
                    this._energyPurchasePending = false;
                    close();
                    this._openSidorovichError?.('Покупка энергии','Не удалось открыть оплату. Попробуйте ещё раз.');
                };
                try{
                    if(window.bank) window.bank.set_donut = 100+i;
                    this._energyPurchasePending = true;
                    const request = startPurchase('item' + (100 + i), opt.price_ok, opt.energy + ' энергии');
                    Promise.resolve(request).then(()=>{this._energyPurchasePending=false;},failed);
                }catch(_){failed();}
            });


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
