/** Shared HUD helpers: hover, PNG popup shell, compass loader. */

window._sa = (spr, target, speed) => {
	speed = speed || 0.18;
	if(spr._saRaf){ cancelAnimationFrame(spr._saRaf); spr._saRaf = null; }
	const _saStep = () => {
		const d = target - spr.alpha;
		if(Math.abs(d) < 0.008){ spr.alpha = target; spr._saRaf = null; return; }
		spr.alpha += d * speed;
		spr._saRaf = requestAnimationFrame(_saStep);
	};
	spr._saRaf = requestAnimationFrame(_saStep);
};

// 21.09.2026 (по прямому указанию: "можно добавить бар, в промежутке которого текст ставится
// по центру, чтобы не выделять для каждого текста отдельный блок-подложку вручную?") — да,
// вот он. Раньше центрирование текста в подложке (джекпот/ник/очки и т.п.) делалось вручную в
// каждом месте — например CELL_BLOCKS + centerX() в svod-leaderboard.js, PTS_BG/NEW_BG в
// bosses_fight.js. Это ТОТ ЖЕ приём, вынесенный в один переиспользуемый хелпер: задаёшь
// прямоугольник {x,y,w,h} (координаты редактора позиций/PSD — верхний левый угол + размер), а
// текст сам садится по центру anchor(0.5,0.5), при любой длине строки без ручного пересчёта x.
// Пример: window._centerTextIn(jackpotTxt, {x:1041, y:618, w:76, h:39});
window._centerTextIn = (text, box) => {
	text.anchor.set(0.5, 0.5);
	text.x = box.x + box.w / 2;
	text.y = box.y + box.h / 2;
};

// Единый затемнитель для модальных окон. Попап остаётся единственным кликабельным слоем,
// а закрытие по фону включается только там, где это явно нужно.
window._makeModalDimmer = (onClose, alpha = 0.55) => {
	const dimmer = new PIXI.Graphics();
	dimmer.beginFill(0x000000, alpha);
	dimmer.drawRect(0, 0, 1280, 720);
	dimmer.endFill();
	dimmer.interactive = true;
	if(typeof onClose === 'function') dimmer.on('pointerdown', onClose);
	return dimmer;
};

window._ss = (spr, target, speed) => {
	speed = speed || 0.18;
	if(spr._ssRaf){ cancelAnimationFrame(spr._ssRaf); spr._ssRaf = null; }
	const _ssStep = () => {
		const cur = spr.scale.x; const d = target - cur;
		if(Math.abs(d) < 0.002){ spr.scale.set(target); spr._ssRaf = null; return; }
		spr.scale.set(cur + d * speed);
		spr._ssRaf = requestAnimationFrame(_ssStep);
	};
	spr._ssRaf = requestAnimationFrame(_ssStep);
};

// Все уже существующие pointerover/pointerout-обработчики исторически вызывали
// scale.set(...) напрямую. Перехватываем именно этот синхронный вызов на время обработчика
// и отправляем его в _ss: старые кнопки получают плавный hover без копирования одинаковой
// анимации в десятки экранов. Кнопка может отключить эффект флагом _disableHoverScale.
if(window.PIXI && PIXI.utils && PIXI.utils.EventEmitter && !PIXI.utils.EventEmitter.prototype._smoothHoverScalePatched){
	const emitter = PIXI.utils.EventEmitter.prototype;
	const originalOn = emitter.on;
	emitter.on = function(event, listener, ...args){
		if((event === 'pointerover' || event === 'pointerout') && typeof listener === 'function'){
			const target = this;
			const wrapped = (...eventArgs) => {
				if(target._disableHoverScale || !target.scale) return listener.apply(target, eventArgs);
				const nativeSet = target.scale.set;
				const smoothSet = (x, y) => {
					target.scale.set = nativeSet;
					if(x === y || y === undefined) window._ss(target, x);
					else nativeSet.call(target.scale, x, y);
					target.scale.set = smoothSet;
				};
				target.scale.set = smoothSet;
				try { return listener.apply(target, eventArgs); }
				finally { target.scale.set = nativeSet; }
			};
			return originalOn.call(this, event, wrapped, ...args);
		}
		return originalOn.call(this, event, listener, ...args);
	};
	emitter._smoothHoverScalePatched = true;
}

export function attachUiKit(proto){
	proto._makePopup = function(pngPath, cacheKey){
		if(this[cacheKey]){
			this[cacheKey].visible = true;
			if(this[cacheKey+'Btn']) this[cacheKey+'Btn'].visible = true;
			return;
		}

		const closeBtn = new PIXI.Container();
		closeBtn.interactive = true; closeBtn.buttonMode = true;
		const cbg = new PIXI.Graphics();
		cbg.beginFill(0x1a0e06,0.9); cbg.lineStyle(2,0x8b5c2a); cbg.drawCircle(12,12,12); cbg.endFill();
		const ctx = new PIXI.Text('×',{fontFamily:'Arial',fontSize:18,fill:'#e8c97a'}); ctx.x=5; ctx.y=1;
		closeBtn.addChild(cbg, ctx);
		closeBtn.on('pointerdown', ()=>{ this[cacheKey].visible = false; closeBtn.visible = false; });
		this[cacheKey+'Btn'] = closeBtn;

		const tex = PIXI.Texture.from(pngPath);
		const img = new PIXI.Sprite(tex);
		img.interactive = true;
		this[cacheKey] = img;

		const _place = () => {
			img.x = Math.round((1280 - img.width) / 2);
			img.y = Math.round((596 - 55 - img.height) / 2 + 55);
			closeBtn.x = img.x + img.width - 14;
			closeBtn.y = img.y - 14;
		};

		if(tex.width > 1){
			_place();
		} else {
			tex.on('update', _place);
		}

		root.layer2_mc.addChild(img, closeBtn);
	};

	proto._addHoverGlow = function(btn){
		if(!btn) return;
		setButton(btn);
		if(!btn._totalFrames || btn._totalFrames < 2){
			btn.on('pointerover',  ()=>{ btn.tint = 0xFFDD88; });
			btn.on('pointerout',   ()=>{ btn.tint = 0xFFFFFF; });
		}
	};

	proto._addHoverSide = function(btn){
		if(!btn) return;
		setButton(btn);
		btn.alpha = 0.7;
		btn.on('pointerover', ()=>{ _sa(btn, 1.0); btn.scale.set(1.08); });
		btn.on('pointerout', ()=>{ _sa(btn, 0.7); btn.scale.set(1); });
	};

	// 25.09.2026 (по прямому указанию — "при перелистывании страницы чёрный экран, должен
	// затемняться и показывать загрузку компаса"): переключены с #_clo (полностью непрозрачный,
	// зарезервирован ТОЛЬКО для первоначальной загрузки — см. большой коммент в index.html) на
	// лёгкое полупрозрачное затемнение + крутящийся компас — используется по всей игре при
	// переключении УЖЕ ЗАГРУЖЕННЫХ экранов (zone/weapons/yashik/bosses_fight/sidorovich/
	// ryukzak и т.д.), не при первом запуске приложения.
	//
	// 25.09.2026, ЧЕТВЁРТОЕ исправление того же дня (по прямому указанию — "обрежь компас и
	// стрелку от прозрачных полей, размести стрелку по центру диска, сделай крутящимся вокруг
	// своей середины, и чтобы через dev-панель это можно было двигать редактором"): раньше
	// вращение делал DOM-оверлей #_screenLoader (два <img> с CSS transform-origin в процентах —
	// хрупко, точный % пришлось трижды пересчитывать живыми репортами "криво крутится").
	// Теперь диск и стрелка — обычные PIXI.Sprite в root.layer2_mc, поэтому universal_pos_editor.js
	// подхватывает их АВТОМАТИЧЕСКИ (он ищет PIXI.Sprite/PIXI.Text под курсором, см. _uCollectAt) —
	// никакой отдельной регистрации не нужно, "ЗАГРУЗКА КОМПАС" в dev-панели (_testCompass) уже
	// достаточно, дальше двигать/масштабировать можно как любой другой элемент проекта.
	// Оба файла обрезаны заново из исходных нетронутых 1672×941 кадров (getbbox() по альфа-
	// каналу + 3px запас): "компас обрезан.png" — просто тримминг пустых полей (505×623, диск не
	// вращается, pivot не нужен). "стрелка компаса обрезана.png" — СИММЕТРИЧНЫЙ кроп вокруг
	// латунного пина (789,177 в исходнике) — пин теперь ТОЧНО в центре файла (48×272,
	// центр=24,136), поэтому needleSpr.anchor.set(0.5,0.5) вращает её ровно вокруг пина без
	// какой-либо процентной арифметики.
	proto._compassBuild = function(){
		if(this._compassWin) return;
		const win = new PIXI.Container();

		const dark = new PIXI.Graphics();
		dark.beginFill(0x000000, 0.55);
		dark.drawRect(0, 0, 1280, 720);
		dark.endFill();
		win.addChild(dark);

		// Дефолтные x/y/scale — стартовая прикидка (канвас 1280×720, компас примерно по центру);
		// оба спрайта независимо двигаются/масштабируются через dev-панель → редактор позиций
		// (см. большой коммент выше), финальные числа сюда впишутся по факту живой правки.
		const disk = new PIXI.Sprite(PIXI.Texture.from('./images/компас обрезан.png'));
		disk.anchor.set(0.5, 0.5);
		disk.x = 640; disk.y = 360;
		disk.scale.set(0.22);
		win.addChild(disk);

		// anchor(0.5,0.5) — пин (пивот вращения) находится ТОЧНО в центре обрезанного файла
		// (см. большой коммент выше про симметричный кроп), поэтому rotation крутит стрелку
		// вокруг пина, а не случайной точки.
		const needle = new PIXI.Sprite(PIXI.Texture.from('./images/стрелка компаса обрезана.png'));
		needle.anchor.set(0.5, 0.5);
		// 28.09.2026 (по прямому указанию, значения сняты живьём через редактор позиций —
		// "x:637, y:376, scale:0.220"): координаты СОВПАДАЮТ (с точностью до 1px) с
		// ДОРЕФОРМЕННЫМ смещением (637,375), которое комментарий 26.09.2026 ниже называл
		// причиной "стрелка крутится вокруг компаса, а не вокруг своей точки", и заменял на
		// needle.x=disk.x/needle.y=disk.y (640,360) — расчёт исходил из допущения, что
		// печатный пин на ЦИФЕРБЛАТЕ диска находится ровно в геометрическом центре обрезанного
		// файла диска. По прямому визуальному замеру в игре это допущение, похоже, не
		// подтвердилось — глазом стрелка совмещается с пином именно в точке (637,376), не
		// (640,360). Оставлено расчётное центрирование диска (640,360) нетронутым — смещён
		// только needle.
		needle.x = 637; needle.y = 376;
		needle.scale.set(0.22);
		win.addChild(needle);

		this._compassWin = win;
		this._compassDisk = disk;
		this._compassNeedle = needle;
	};

	proto._compassShow = function(){
		this._compassBuild();
		if(!this._compassWin.parent) root.layer2_mc.addChild(this._compassWin);
		this._compassWin.visible = true;
		if(this._compassTickerFn) return; // уже крутится
		// 360°/1.6с — та же скорость, что была у старой CSS-анимации _screenLoaderSpin. Заодно
		// каждый кадр перекладывает _compassWin в конец своего layer2-родителя (тот же приём,
		// что у dev_panel.js._devWinTickerFn) — иначе, если компас показан ПОКА открыта
		// dev-панель (_testCompass), её СОБСТВЕННЫЙ самоподнимающийся тикер перекрыл бы компас
		// на следующем же кадре.
		this._compassTickerFn = () => {
			this._compassNeedle.rotation += (Math.PI * 2 / 1600) * PIXI.Ticker.shared.deltaMS;
			if(this._compassWin.parent) this._compassWin.parent.addChild(this._compassWin);
		};
		PIXI.Ticker.shared.add(this._compassTickerFn);
	};

	proto._compassHide = function(){
		if(!this._compassWin) return;
		this._compassWin.visible = false;
		if(this._compassTickerFn){
			PIXI.Ticker.shared.remove(this._compassTickerFn);
			this._compassTickerFn = null;
		}
	};

	proto._compassWaitTex = function(url){
		this._compassShow();
		const tex = PIXI.Texture.from(url);
		if(tex.baseTexture.valid){ this._compassHide(); return; }
		const cb = ()=>this._compassHide();
		tex.baseTexture.once('loaded', cb);
		tex.baseTexture.once('error',  cb);
	};
}
