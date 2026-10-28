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
		// 18.10.2026 (по прямому указанию — новый фон "с сухарями" вместо старого с пачками
		// сигарет, модерация VK): файл скопирован под новым именем (исходник был
		// "сидорович с сухарями.png", переименован для единообразия с остальным проектом).
		const _sidTex = PIXI.Texture.from(BASE + 'сидорович фон экран.png');
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
		const panel = new PIXI.Sprite(PIXI.Texture.from(BASE + 'сидорович фон экран.png'));
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
		exitBtn.on('pointerover', ()=>{ exitBtn.scale.set(0.54); });
		exitBtn.on('pointerout', ()=>{ exitBtn.scale.set(0.5); });
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

		// Кнопки "Купить", "Открыть", "Вскрыть" убраны — взаимодействие через хит-зоны
		// Логика "купить ресурсы" осталась на хит-зоне банки (boxHit ниже)

		// 18.10.2026 (по прямому указанию, батч замены сигарет на сухари — новые файлы
		// консервы/банка/сумка/посылка): банка теперь рисуется в ДВУХ состояниях (раньше была
		// только hover-подсветка поверх запечённого в фон рисунка) — idle-спрайт "банка.png"
		// добавляется РАНЬШЕ сумки (значит рендерится под ней, "банка изначально находится за
		// рюкзаком"), а hover-спрайт "банка актив.png" добавляется ПОСЛЕ сумки (значит при
		// наведении ложится ПОВЕРХ неё) — порядок добавления в PIXI и есть z-order, отдельного
		// свойства для этого не нужно.
		// 18.10.2026 (по прямому указанию — "убери прозрачные отступы у всех файлов Сидоровича"):
		// "v2" — обрезанные по альфа-каналу версии. У банки реальный контент начинался от (0,0)
		// исходного файла (только обрезаны правый/нижний края) — координата не компенсируется.
		const bankaIdle = new PIXI.Sprite(PIXI.Texture.from(BASE + 'сидорович банка v2.png'));
		bankaIdle.x = 264;
		bankaIdle.y = PANEL_Y_SID + 334;
		win.addChild(bankaIdle);

		// Консервы — тоже получили отдельный idle-спрайт (раньше рисунок был запечён в общий
		// фон, теперь свой файл, т.к. фон сменился на "сидорович фон экран.png").
		// 18.10.2026 (по прямому указанию — "консервы и сухарики вверх на 32px"): было +251.
		// 18.10.2026: "v2" — обрезано по альфа (верх файла был на 18px прозрачным) — y
		// компенсирован на +18, чтобы видимая картинка осталась на прежнем месте на экране.
		const konservaIdle = new PIXI.Sprite(PIXI.Texture.from(BASE + 'сидорович консервы неактив v2.png'));
		konservaIdle.x = 24;
		konservaIdle.y = PANEL_Y_SID + 251 - 32 + 18;
		win.addChild(konservaIdle);

		const konservaActiv = new PIXI.Sprite(PIXI.Texture.from(BASE + 'сидорович консервы актив v2.png'));
		konservaActiv.x = 24;
		konservaActiv.y = PANEL_Y_SID + 251 - 32 + 18;
		konservaActiv.visible = false;
		konservaActiv.interactive = false;
		win.addChild(konservaActiv);

		// 17.10.2026 (по прямому указанию — замена сигарет на сухари, модерация VK): полка на
		// фоне раньше рисовала старые пачки сигарет — перекрыта статичным слоем "сидорович
		// сухари.png" (банки сухарей), поверх которого по hover показывается подсветка.
		// 18.10.2026 (повторное указание, координаты нормализованы): hover-спрайт теперь на
		// ТЕХ ЖЕ координатах, что и idle (раньше были на 6px/3px смещены вручную на глаз).
		// 18.10.2026 (по прямому указанию — "консервы и сухарики вверх на 32px"): было +55.
		// 18.10.2026 (повторное указание тем же днём — "сухари и сухари актив ещё вверх на
		// 6px"): применено поверх уже выставленного -32.
		// 18.10.2026: "v2" — обрезано по альфа (верх файла был на 43px прозрачным) — y
		// компенсирован на +43, видимая картинка остаётся на прежнем месте.
		const sigShelf = new PIXI.Sprite(PIXI.Texture.from(BASE + 'сидорович сухари v2.png'));
		sigShelf.x = 21;
		sigShelf.y = PANEL_Y_SID + 55 - 32 - 6 + 43;
		win.addChild(sigShelf);

		const sigActiv = new PIXI.Sprite(PIXI.Texture.from(BASE + 'сидорович сухари актив v2.png'));
		sigActiv.x = 21;
		sigActiv.y = PANEL_Y_SID + 55 - 32 - 6 + 43;
		sigActiv.visible = false;
		sigActiv.interactive = false;
		win.addChild(sigActiv);

		// Посылка (18.10.2026, новый элемент — по прямому указанию): только hover-подсветка,
		// клик-действие не задано пользователем — пока декоративный/заготовка под будущую фичу.
		// 18.10.2026: "v2" — обрезано по альфа (левый край файла был на 5px прозрачным) — x
		// компенсирован на +5, видимая картинка остаётся на прежнем месте.
		const posylkaIdle = new PIXI.Sprite(PIXI.Texture.from(BASE + 'сидорович посылка v2.png'));
		posylkaIdle.x = 919 + 5;
		posylkaIdle.y = PANEL_Y_SID + 397;
		win.addChild(posylkaIdle);

		const posylkaActiv = new PIXI.Sprite(PIXI.Texture.from(BASE + 'сидорович посылка актив v2.png'));
		posylkaActiv.x = 919 + 5;
		posylkaActiv.y = PANEL_Y_SID + 397;
		posylkaActiv.visible = false;
		posylkaActiv.interactive = false;
		win.addChild(posylkaActiv);

		// 18.10.2026 (по прямому указанию — "yashik_activ.png убери из игры"): hover-оверлей
		// ящика убран целиком, не заменён.

// Рюкзак/сумка: поверх банки (см. bankaIdle выше) — новые файлы, новые координаты.
		// 27.10.2026 (по прямому указанию, редактор позиций — "x:0,y:305,w:339,h:374" для обоих
		// файлов v2): абсолютные x/y заменили прежнюю формулу от PANEL_Y_SID; w/h выставлены
		// явно на спрайт (новая конвенция — см. AGENTS.md "Конвенция позиционных правок").
		const sumkaFront = new PIXI.Sprite(PIXI.Texture.from(BASE + 'сидорович сумка v2.png'));
		sumkaFront.x = 0; sumkaFront.y = 305;
		sumkaFront.width = 339; sumkaFront.height = 374;
		sumkaFront.visible = true;
		win.addChild(sumkaFront);

		const sumkaActiv = new PIXI.Sprite(PIXI.Texture.from(BASE + 'сидорович сумка актив v2.png'));
		sumkaActiv.x = 0; sumkaActiv.y = 305;
		sumkaActiv.width = 339; sumkaActiv.height = 374;
		sumkaActiv.visible = false;
		sumkaActiv.interactive = false;
		win.addChild(sumkaActiv);

		// Банка актив (hover) добавляется ПОСЛЕ сумки — ровно по требованию "при наведении
		// накладывается поверх рюкзака" (см. комментарий у bankaIdle выше).
		const bankaActiv = new PIXI.Sprite(PIXI.Texture.from(BASE + 'сидорович банка актив v2.png'));
		bankaActiv.x = 264;
		bankaActiv.y = PANEL_Y_SID + 334;
		bankaActiv.visible = false;
		bankaActiv.interactive = false;
		win.addChild(bankaActiv);

		// 18.10.2026 (по прямому указанию — "не нужно делать отдельный хитбокс, наведение
		// должно работать прямо на файле"): раньше каждая пара idle/actив обслуживалась
		// ОТДЕЛЬНОЙ Graphics-зоной с координатами, снятыми вручную "на глаз" и накопившей за
		// день несколько правок поверх друг друга — отсюда и расхождения с реальной картинкой
		// (сухари: хитбокс стоял на 42px выше настоящего спрайта — наведение чуть выше рисунка
		// срабатывало, по самому рисунку снизу — нет; рюкзак: его зона 250×430 перекрывала
		// консервы целиком и перехватывала hover первой, т.к. добавлена в дерево позже).
		// Теперь interactive вешается НАПРЯМУЮ на сам idle-спрайт — его собственные границы
		// (текстура v2, уже обрезанная по альфа-каналу) и есть зона наведения, отдельно
		// считать и синхронизировать x/y/w/h с правками позиции больше не нужно.
		konservaIdle.interactive = true; konservaIdle.buttonMode = true;
		konservaIdle.on('pointerover', ()=>{ konservaActiv.visible = true; });
		konservaIdle.on('pointerout',  ()=>{ konservaActiv.visible = false; });
		konservaIdle.on('pointerdown', ()=>{ if(typeof this._openCurrencyPurchasePopup === 'function') this._openCurrencyPurchasePopup('stew'); });

		bankaIdle.interactive = true; bankaIdle.buttonMode = true;
		bankaIdle.on('pointerover', ()=>{ bankaActiv.visible = true; });
		bankaIdle.on('pointerout',  ()=>{ bankaActiv.visible = false; });
		bankaIdle.on('pointerdown', ()=>{ if(typeof this._openCurrencyPurchasePopup === 'function') this._openCurrencyPurchasePopup('coins'); });

		// 19.10.2026 (по прямому указанию — "хитбокс ящика нужно убрать, сделай как для
		// рюкзака/рублей/тушёнки/сухарей: наведение на сам файл, клик открывает страницу
		// ящика"): "посылка" визуально И ЕСТЬ деревянный ящик с защёлкой (см. скриншот —
		// chestHit ниже был отдельным, более старым хитбоксом ДО появления этого спрайта,
		// держал наведение/клик рассинхронизированными с самой картинкой). Переведена на тот
		// же паттерн, что banka/konserva/sumka выше — interactive напрямую на idle-спрайте,
		// pointerdown открывает ящик.
		posylkaIdle.interactive = true; posylkaIdle.buttonMode = true;
		posylkaIdle.on('pointerover', ()=>{ posylkaActiv.visible = true; });
		posylkaIdle.on('pointerout',  ()=>{ posylkaActiv.visible = false; });
		posylkaIdle.on('pointerdown', ()=>{ this._openYashikScreen(); });

		sigShelf.interactive = true; sigShelf.buttonMode = true;
		sigShelf.on('pointerover', ()=>{ sigActiv.visible = true; });
		sigShelf.on('pointerout',  ()=>{ sigActiv.visible = false; });
		sigShelf.on('pointerdown', ()=>{ if(typeof this._openCurrencyPurchasePopup === 'function') this._openCurrencyPurchasePopup('cigarettes'); });

		sumkaFront.interactive = true; sumkaFront.buttonMode = true;
		sumkaFront.on('pointerover', ()=>{ sumkaActiv.visible = true; });
		sumkaFront.on('pointerout',  ()=>{ sumkaActiv.visible = false; });
		sumkaFront.on('pointerdown', ()=>{ this._openRyukzakReward(); });

		// 19.10.2026 (по прямому указанию — "этот хитбокс нужно убрать"): отдельная Graphics-
		// зона chestHit (900,330,370,67) удалена целиком — она была унаследована от ДО того,
		// как появился сам спрайт сундука (posylkaIdle выше), её координаты не совпадали с
		// реальной картинкой и перехватывали часть наведения/клика. Открытие ящика теперь
		// полностью на posylkaIdle.on('pointerdown', ...) выше — та же логика, что у
		// banka/konserva/sumka (interactive прямо на спрайте, без отдельного хитбокса).

		this._sidWin = win;
		// layer2 — поверх боковых панелей; HUD поднимаем поверх
		root.layer2_mc.addChild(win);
		// 25.09.2026 (декларативный ХУД, см. коммент у exitBtn ниже) — раньше здесь вручную
		// показывались this.up/this.down; теперь Сидорович заявляет требование через общий
		// стек, как и все остальные экраны (interface.js.pushHud/popHud).
		this.pushHud('sidorovich', {});
	};
}
