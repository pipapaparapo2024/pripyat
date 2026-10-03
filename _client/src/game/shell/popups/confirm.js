/** Confirm dialog (ПОДТВЕРДИТЬ / ОТМЕНА). */
import { makeParallelogramHit } from './popup-hit-shapes.js';

export function attachConfirmPopup(proto){
	proto._showConfirmPopup = function(text, onYes, onNo){
		if(this._confirmWin && this._confirmWin.parent) this._confirmWin.parent.removeChild(this._confirmWin);

		const CONF = './images/layers/popups/confirm/';
		const win = new PIXI.Container();
		win.interactive = true;

		const overlay = new PIXI.Graphics();
		overlay.beginFill(0x000000, 0.001);
		overlay.drawRect(0, 0, 1280, 720);
		overlay.endFill();
		overlay.interactive = true;
		win.addChild(overlay);

		const bg = new PIXI.Sprite(PIXI.Texture.from(CONF + 'popup_confirm.png'));
		bg.interactive = true;
		win.addChild(bg);

		// 24.09.2026 (по прямому указанию, реверс правки 22.09.2026): popup_confirm.png уже
		// содержит собственный вшитый текст ("ПОДТВЕРДИТЬ ДЕЙСТВИЕ? ЭТО ДЕЙСТВИЕ БУДЕТ
		// НЕВОЗМОЖНО ОТМЕНИТЬ") — это универсальный попап подтверждения одного и того же вида
		// для любого действия, свой текст поверх него больше не пишем ни для одного вызова
		// (dvor-poker-bag.js/dvor-roulette-buy.js/dev_panel.js/yashik.js — везде теперь просто
		// используется общая формулировка с картинки). Параметр text остаётся в сигнатуре
		// (вызовы его по-прежнему передают) — просто больше не рендерится.

		// btn_potv_active.png — полноканвасный 1280×720, кнопка уже на нужной позиции внутри
		const potvActive = new PIXI.Sprite(PIXI.Texture.from(CONF + 'btn_potv_active.png'));
		potvActive.x = 0; potvActive.y = 0; potvActive.visible = false;
		win.addChild(potvActive);

		// btn_otm_active.png — кроп 236×105 (позиция замерена через редактор позиций)
		const otmActive = new PIXI.Sprite(PIXI.Texture.from(CONF + 'btn_otm_active.png'));
		otmActive.x = 656; otmActive.y = 352; otmActive.visible = false;
		win.addChild(otmActive);

		const potv = makeParallelogramHit(win, 443, 387, 221, 40, 18);
		potv.on('pointerdown', (e)=>{
			e.stopPropagation();
			potvActive.visible = true;
			setTimeout(()=>{
				if(win.parent) win.parent.removeChild(win);
				if(typeof onYes === 'function') onYes();
			}, 120);
		});

		const otm = makeParallelogramHit(win, 668, 387, 221, 40, 18);
		otm.on('pointerdown', (e)=>{
			e.stopPropagation();
			otmActive.visible = true;
			setTimeout(()=>{
				if(win.parent) win.parent.removeChild(win);
				if(typeof onNo === 'function') onNo();
			}, 120);
		});
		this._confirmWin = win;
		root.layer2_mc.addChild(win);
	};
}
