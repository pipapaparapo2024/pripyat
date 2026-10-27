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

// 27.10.2026 (по прямому указанию — "пройдись по всей игре, в файлах где есть hover эффект
// увеличения, сделай так чтобы он был центрирован по центру файла, scale равномерный по всем
// сторонам"): раньше scale.set() двигал только scale, x/y оставались на месте — для спрайтов с
// anchor(0,0) (подавляющее большинство кнопок проекта, т.к. это дефолт PIXI.Sprite) это визуально
// растягивало кнопку вправо-вниз от точки клика вместо равномерного роста от центра файла.
// Компенсация ниже сдвигает x/y на каждом кадре анимации ровно настолько, чтобы ГЕОМЕТРИЧЕСКИЙ
// ЦЕНТР текстуры (точка 0.5/0.5, НЕЗАВИСИМО от anchor) оставался на месте — общая формула учитывает
// anchor.x/anchor.y, поэтому спрайты, УЖЕ центрированные через anchor(0.5,0.5) (их в проекте тоже
// немало — например dvor.js._dvorCloudSprites), получают нулевую компенсацию и продолжают расти
// как раньше, без двойного фикса. Это единственное место правки — _ss() уже вызывается ИЗ КАЖДОГО
// существующего `scale.set(x)` внутри pointerover/pointerout по всему проекту благодаря патчу
// EventEmitter.prototype.on ниже, поэтому фикс здесь автоматически центрирует ВСЕ такие места
// разом, не требуя правки каждого экрана по отдельности.
window._ss = (spr, target, speed) => {
	speed = speed || 0.18;
	if(spr._ssRaf){ cancelAnimationFrame(spr._ssRaf); spr._ssRaf = null; }
	const baseScale = spr.scale.x || 1;
	const unscaledW = spr.width / baseScale, unscaledH = spr.height / baseScale;
	const ax = (spr.anchor && typeof spr.anchor.x === 'number') ? spr.anchor.x : 0;
	const ay = (spr.anchor && typeof spr.anchor.y === 'number') ? spr.anchor.y : 0;
	const _applyCentered = (from, to) => {
		spr.x += (0.5 - ax) * unscaledW * (from - to);
		spr.y += (0.5 - ay) * unscaledH * (from - to);
		spr.scale.set(to);
	};
	const _ssStep = () => {
		const cur = spr.scale.x; const d = target - cur;
		if(Math.abs(d) < 0.002){ _applyCentered(cur, target); spr._ssRaf = null; return; }
		_applyCentered(cur, cur + d * speed);
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

	// 18.10.2026 (по прямому указанию — "унифицируй hover у всех кнопок: плавное увеличение
	// относительно ЦЕНТРА кнопки, плавный возврат при отведении курсора, сейчас некоторые
	// кнопки увеличиваются от верха/низа"): до этого scale-hover собирался вручную в 30+ местах
	// проекта, почти всегда без анимации (голый scale.set()) и вокруг anchor(0,0) — кнопка
	// визуально "росла" вниз-вправо, а не из центра. RAF-степпер в духе уже существующего
	// window._sa() выше (не gsap — тот же лёгкий паттерн, без лишней зависимости в общем
	// хелпере): база (исходные scale/x/y/размер) снимается ОДИН раз при первом вызове на
	// объекте, дальше на каждый pointerover/pointerout считается компенсация x/y по формуле
	// "рост от центра" — работает одинаково для anchor(0,0), anchor(0.5,0.5) и PIXI.Container
	// без собственной текстуры, НЕ трогая сам anchor/pivot объекта (значит не ломает остальной
	// код, который уже расположил кнопку по своим x/y).
	window._scHover = (btn, factor, speed) => {
		speed = speed || 0.22;
		if(btn._scRaf){ cancelAnimationFrame(btn._scRaf); btn._scRaf = null; }
		const baseSX = btn._hoverBaseScaleX, baseSY = btn._hoverBaseScaleY;
		const targetSX = baseSX * factor, targetSY = baseSY * factor;
		const targetX = btn._hoverBaseX - btn._hoverBaseW * (factor - 1) / 2;
		const targetY = btn._hoverBaseY - btn._hoverBaseH * (factor - 1) / 2;
		const _step = () => {
			const dsx = targetSX - btn.scale.x, dsy = targetSY - btn.scale.y;
			const dx = targetX - btn.x, dy = targetY - btn.y;
			if(Math.abs(dsx) < 0.001 && Math.abs(dsy) < 0.001 && Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05){
				btn.scale.set(targetSX, targetSY); btn.x = targetX; btn.y = targetY;
				btn._scRaf = null; return;
			}
			btn.scale.x += dsx * speed; btn.scale.y += dsy * speed;
			btn.x += dx * speed; btn.y += dy * speed;
			btn._scRaf = requestAnimationFrame(_step);
		};
		btn._scRaf = requestAnimationFrame(_step);
	};

	// factor — во сколько раз увеличивается кнопка под курсором (по умолчанию 1.08 — заметно,
	// но не аляписто для мелких HUD-кнопок).
	proto._addHoverScale = function(btn, factor){
		if(!btn) return;
		setButton(btn);
		factor = factor || 1.08;
		if(btn._hoverBaseScaleX === undefined){
			// Снимается один раз — повторный вызов на уже увеличенном (курсор ещё не ушёл)
			// объекте не перезатирает базу текущим раздутым состоянием.
			btn._hoverBaseScaleX = btn.scale.x; btn._hoverBaseScaleY = btn.scale.y;
			btn._hoverBaseX = btn.x; btn._hoverBaseY = btn.y;
			btn._hoverBaseW = btn.width; btn._hoverBaseH = btn.height;
		}
		btn.on('pointerover', ()=>{ window._scHover(btn, factor); });
		btn.on('pointerout',  ()=>{ window._scHover(btn, 1); });
	};

	// 20.10.2026 (по прямому указанию, сверено по видео-референсу — "кнопки верхнего худа
	// (магазин/настройки/плюс/вниз) и плашки валют при наведении не должны расти, должны
	// немного подсвечиваться"): кадровый анализ видео показал, что у наведённой кнопки
	// светлеет сам фон (без увеличения и без прозрачности) — реализовано через
	// ColorMatrixFilter.brightness(), тот же pixi-filters, что уже используется в проекте для
	// обесцвечивания шмоток (bosses_prefight.js/shmot_shop.js), новая зависимость не нужна.
	// amount — множитель яркости под курсором (по умолчанию 1.35).
	proto._addHoverBright = function(btn, amount){
		if(!btn) return;
		setButton(btn);
		amount = amount === undefined ? 1.35 : amount;
		const filter = new PIXI.filters.ColorMatrixFilter();
		filter.brightness(amount, false);
		btn.on('pointerover', ()=>{ btn.filters = [filter]; });
		btn.on('pointerout',  ()=>{ btn.filters = null; });
	};

	// 20.10.2026 (по прямому указанию — "при наведении на плашку или на иконку нижней
	// [раскрытой] валюты они должны подсвечиваться ОДНОВРЕМЕННО, не по отдельности"): иконка
	// сидит поверх плашки — PIXI хит-тестит только САМЫЙ ВЕРХНИЙ объект под курсором, поэтому
	// у двух независимых _addHoverBright() каждый спрайт подсвечивался только сам по себе,
	// когда курсор именно над ним (над иконкой — только иконка, над остальной частью плашки —
	// только плашка). Здесь один общий фильтр вешается на pointerover/pointerout КАЖДОГО
	// объекта группы, но включает/выключает его СРАЗУ у ВСЕХ — какой бы из них ни был
	// хит-тестирован, подсвечивается вся группа целиком.
	proto._addHoverBrightGroup = function(objs, amount){
		if(!objs || !objs.length) return;
		amount = amount === undefined ? 1.35 : amount;
		const filter = new PIXI.filters.ColorMatrixFilter();
		filter.brightness(amount, false);
		objs.forEach(obj => {
			if(!obj) return;
			setButton(obj);
			obj.on('pointerover', ()=>{ objs.forEach(o => { if(o) o.filters = [filter]; }); });
			obj.on('pointerout',  ()=>{ objs.forEach(o => { if(o) o.filters = null; }); });
		});
	};

	// 18.10.2026 (по прямому указанию — "кнопки нижнего худа при наведении зеленеют, такого
	// быть не должно, оставь только увеличение, и сделай увеличение в полтора раза меньше"):
	// цветовой tint на hover убран целиком (раньше подсвечивал кнопку оттенком 0xFFDD88,
	// визуально читался как позеленение поверх тёмных иконок) — остаётся только масштаб,
	// с амплитудой роста (0.08 у стандартного 1.08×), уменьшенной в 1.5 раза.
	proto._addHoverGlow = function(btn){
		if(!btn) return;
		setButton(btn);
		this._addHoverScale(btn, 1 + 0.08 / 1.5);
	};

	// 18.10.2026 (по прямому указанию — "кнопки нижнего худа вообще не должны увеличиваться
	// при наведении, только небольшая прозрачность"): отдельный от _addHoverGlow эффект — без
	// масштаба/смещения вообще, только alpha, чтобы игрок видел, на какую вкладку навёлся.
	proto._addHoverAlpha = function(btn, targetAlpha){
		if(!btn) return;
		setButton(btn);
		targetAlpha = targetAlpha === undefined ? 0.75 : targetAlpha;
		const baseAlpha = btn.alpha;
		btn.on('pointerover', ()=>{ btn.alpha = targetAlpha; });
		btn.on('pointerout',  ()=>{ btn.alpha = baseAlpha; });
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
	// 17.10.2026 (по прямому указанию, новые исходники "компас.png"/"стрелка компаса.png" —
	// репорт "стрелка крутится вокруг компаса, а не вокруг своего центра" на прежней паре
	// файлов): предыдущая схема держала пин диска и пин стрелки на РАЗНЫХ вручную подобранных
	// координатах (640,360 для диска — геометрический центр обрезанного файла, и 637,376 для
	// стрелки — "на глаз" подогнанное под печатный пин на циферблате) — любая неточность одной
	// из двух оценок сразу давала видимый эксцентриситет вращения. Новая схема СТРУКТУРНО
	// исключает рассинхрон: оба новых файла обрезаны СИММЕТРИЧНО вокруг собственного латунного
	// пина (найден программно — яркостный анализ альфа-канала, не на глаз), то есть пин у ОБОИХ
	// спрайтов теперь лежит ТОЧНО в геометрическом центре своего файла (проверено постфактум —
	// отклонение < 2px из ~400-780px канвы). Значит достаточно поставить anchor(0.5,0.5) и
	// ОДНУ общую пару x/y для обоих спрайтов — больше никакой отдельной калибровки needle.x/y.
	// "компас v2 обрезан.png" (780×780) и "стрелка компаса v2 обрезана.png" (280×280) —
	// содержимое (сам рисунок, не прозрачная рамка) побайтово того же пиксельного размера, что
	// и у старых файлов (499×617 и 42×257 соответственно) — тот же исходный кадр, просто иначе
	// обрезан, поэтому scale 0.22 даёт тот же физический размер на экране, менять не пришлось.
	// Старые файлы ('компас обрезан.png'/'стрелка компаса обрезана.png') оставлены на диске
	// неиспользуемыми (откат при необходимости).
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
		const disk = new PIXI.Sprite(PIXI.Texture.from('./images/компас v2 обрезан.png'));
		disk.anchor.set(0.5, 0.5);
		disk.x = 640; disk.y = 360;
		disk.scale.set(0.22);
		win.addChild(disk);

		// anchor(0.5,0.5) + ТЕ ЖЕ x/y, что у disk — пин обоих спрайтов лежит в их собственном
		// геометрическом центре (см. большой коммент выше), поэтому общая точка на экране для
		// обоих — это и есть пин, без отдельной needle.x/needle.y калибровки.
		const needle = new PIXI.Sprite(PIXI.Texture.from('./images/стрелка компаса v2 обрезана.png'));
		needle.anchor.set(0.5, 0.5);
		needle.x = disk.x; needle.y = disk.y;
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
