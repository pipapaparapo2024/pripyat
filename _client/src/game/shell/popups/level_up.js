/** Level-up celebration popup + VK wall share. */

export function attachLevelUpPopup(proto){
	proto._openLevelUpPopup = function(level){
		if(this._levelupWin && this._levelupWin.parent) this._levelupWin.parent.removeChild(this._levelupWin);

		const win = new PIXI.Container();

		const overlay = new PIXI.Graphics();
		overlay.beginFill(0x000000, 0.6);
		overlay.drawRect(0, 0, 1280, 720);
		overlay.endFill();
		overlay.interactive = true;
		win.addChild(overlay);

		const content = new PIXI.Container();
		content.x = 0; content.y = 0;
		win.addChild(content);

		const panel = new PIXI.Sprite(PIXI.Texture.from('./images/layers/popups/levelup/popup_levelup_new.png'));
		content.addChild(panel);

		const lvlNumTxt = new PIXI.Text(String(level), {
			fontFamily: 'Southbank LT', fontSize: 80, fill: '#ffcc44',
			dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 3,
		});
		lvlNumTxt.anchor.set(0.5, 0.5);
		lvlNumTxt.x = 640 + 14 + 18; lvlNumTxt.y = 390 - 50 - 18;
		content.addChild(lvlNumTxt);

		const shareBtn = new PIXI.Sprite(PIXI.Texture.from('./images/layers/popups/levelup/btn_share.png'));
		shareBtn.anchor.set(0.5, 0);
		shareBtn.x = 685;
		shareBtn.y = 500;
		shareBtn.interactive = true; shareBtn.buttonMode = true;
		shareBtn.on('pointerover', ()=>{ _sa(shareBtn, 0.8); shareBtn.scale.set(1.08); });
		shareBtn.on('pointerout', ()=>{ _sa(shareBtn, 1); shareBtn.scale.set(1); });
		shareBtn.on('pointerdown', ()=>{
			if(!window.bridge || typeof bridge.send !== 'function'){
				notify.showResult({text:'Не удалось открыть шаринг: VK Bridge недоступен'}, 0);
				return;
			}
			// Модерация VK (30.09.2026, п.3): раньше здесь стоял window.location.href — внутри
			// Mini App это адрес iframe'а (реальный хостинг клиента, pripyat-game.ru, плюс
			// query-параметры сессии типа sign/vk_user_id), а не vk.com — именно эта ссылка на
			// сторонний домен улетала в шеринг. Каноническая ссылка на приложение — фиксированная.
			const shareLink = 'https://vk.com/app54574178_438953352';
			// Публикация на стену устарела. Открываем только актуальный системный шаринг VK
			// и исключительно по нажатию игрока.
			bridge.send('VKWebAppShare', { link: shareLink })
				.catch((shareError)=>{
					console.error('[level-up.share] VK share failed', shareError);
					notify.showResult({text:'Не удалось поделиться. Откройте игру через приложение ВКонтакте.'}, 0);
				});
		});
		content.addChild(shareBtn);

		const exitBtn = new PIXI.Sprite(PIXI.Texture.from('./images/layers/zone/btn_exit.png'));
		exitBtn.scale.set(0.5);
		if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
		exitBtn.x = 1062;
		exitBtn.y = 120;
		exitBtn.interactive = true; exitBtn.buttonMode = true;
		exitBtn.on('pointerover', ()=>{ _sa(exitBtn, 0.75); exitBtn.scale.set(0.54); });
		exitBtn.on('pointerout', ()=>{ _sa(exitBtn, 1); exitBtn.scale.set(0.5); });
		exitBtn.on('pointerdown', ()=>{ win.visible = false; });
		content.addChild(exitBtn);

		const _close = ()=>{ win.visible = false; };
		overlay.on('pointerdown', _close);
		setTimeout(_close, 8000);

		this._levelupWin = win;
		root.layer2_mc.addChild(win);
	};
}
