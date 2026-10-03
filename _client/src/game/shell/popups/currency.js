/** Small currency tooltip under HUD currency blocks. */

export function attachCurrencyPopup(proto){
	proto._openCurrencyPopup = function(popupX, popupY, label, amount){
		if(this._currencyWin && this._currencyWin.parent){
			this._currencyWin.parent.removeChild(this._currencyWin);
			this._currencyWin = null;
		}
		const fmt = v => Number(v || 0).toLocaleString('ru');
		const tip = new PIXI.Container();
		const t1 = new PIXI.Text(label, {
			fontFamily: 'Southbank LT', fontSize: 20, fill: '#ffcc44'
		});
		const t2 = new PIXI.Text(fmt(amount) + ' шт.', {
			fontFamily: 'Southbank LT', fontSize: 16, fill: '#aaaaaa'
		});
		const PAD = 16;
		const W = Math.max(t1.width, t2.width) + PAD * 2;
		const H = 50;
		const bg = new PIXI.Graphics();
		bg.beginFill(0x1a1a1a, 0.92);
		bg.lineStyle(1, 0xcc7200, 1);
		bg.drawRoundedRect(0, 0, W, H, 6);
		bg.endFill();
		tip.addChild(bg);
		t1.anchor.set(0.5, 0); t1.x = W / 2; t1.y = 6;
		t2.anchor.set(0.5, 0); t2.x = W / 2; t2.y = 28;
		tip.addChild(t1, t2);
		// Не помещаем tooltip под верхний HUD: его нижняя граница находится примерно на 70px.
		tip.x = Math.max(4, Math.min(Math.round(popupX), 1280 - W - 4));
		tip.y = Math.max(78, Math.round(popupY));
		this._currencyWin = tip;
		root.layer2_mc.addChild(tip);
	};
}
