/** Zone map overlay — location selection screen. */
import { formatRewardAmount } from '../popups/reward.js';

export function attachZoneScreen(proto){
	// 25.09.2026 (баг найден по живому логу консоли — "ReferenceError: RESPECT_PHOTO_W is not
	// defined" в _refreshZoneRespectLeaders): эти константы раньше были объявлены ВНУТРИ
	// _openZoneScreen — рамка уважения строилась там (респект-обвязка карточек локаций), но
	// САМ рендер фото/числа рекордсмена (_renderRespectLeaders, вызывается асинхронным
	// колбэком zone.leaders) живёт в СОСЕДНЕЙ функции _refreshZoneRespectLeaders — у неё нет
	// доступа к const, объявленным в теле другой функции. Раньше это никогда не падало
	// заметно для пользователя, потому что явной ошибки в интерфейсе не было — просто фото/
	// число рекордсмена никогда не появлялись (throw внутри forEach молча прерывал рендер
	// оставшихся элементов). Вынесены на уровень attachZoneScreen(proto) — общий для обеих
	// функций scope, тот же приём, что уже применён для WPN_KEYS в weapons.js/bosses_fight.js.
	const RESPECT_FRAME_REL_X = 728, RESPECT_FRAME_REL_Y = 18;
	const RESPECT_FRAME_W = 150, RESPECT_FRAME_H = 167;
	const RESPECT_PHOTO_W = 112, RESPECT_PHOTO_H = 112;
	const RESPECT_PHOTO_REL_X = 78, RESPECT_PHOTO_REL_Y = 86;
	const RESPECT_PHOTO_ROTATION_DEG = -2;
	const RESPECT_AMOUNT_REL_Y = 138;
	// 02.10.2026 (ВАЖНО — НЕ менять без прямого указания пользователя): -3° и отступ +5px
	// (см. amountTxt.x ниже) — ПОДТВЕРЖДЁННЫЙ пользователем напрямую выбор, НЕ баг. В сессии
	// до этого была попытка "починить" оба значения на -2°/без отступа, опираясь на более
	// старый комментарий про "тот же угол, что и фото" — пользователь явно отменил эту правку
	// ("это я так сказал это сделать... 5 пикселей вправо... это правильно было"). Старый
	// комментарий ниже сам устарел — не доверять ему больше, чем прямому указанию пользователя.
	const RESPECT_AMOUNT_ROTATION_DEG = -3;

	// targetLocIdx (необязательный, 0-4) — сразу открыть страницу с этой локацией, а не
	// первую страницу по умолчанию. Нужен для перехода "ЗАЧИСТИ Тёмная Долина!" → сразу
	// на страницу с Тёмной Долиной (см. bosses-combat.js/bosses_select.js: попап ошибки
	// доступа к боссу теперь ведёт прямо к нужной локации по нажатию ПОНЯТНО).
	proto._openZoneScreen = function(targetLocIdx){
		this._compassShow();
		this._closeAllPanels();
		this._startZoneAmbient();

		if(window.zone && typeof zone._preloadLocationAssets === 'function'){
			zone._preloadLocationAssets();
		}

		if(this._zoneWin){
			clearInterval(this._zoneTimerInterval);
			this._zoneTimerInterval = null;
			if(this._zoneWin.parent) this._zoneWin.parent.removeChild(this._zoneWin);
			this._zoneWin = null;
			this._zoneArrowUp = null; this._zoneArrowDown = null;
			this._zoneBgSpr = null; this._zoneLocGroups = null;
			this._zoneLocWrap = null; this._zoneBtnCollect = null;
			this._zoneRespectPhotos = null;
		}

		const win = new PIXI.Container();
		const Z = './images/';

		// Непрозрачный blocker — перекрывает сцену пока грузится фон
		const blocker = new PIXI.Graphics();
		blocker.beginFill(0x000000, 1);
		blocker.drawRect(0, 0, 1280, 720);
		blocker.endFill();
		blocker.interactive = true;
		win.addChild(blocker);

		// Единый фон для всех локаций (18.09.2026, по прямому указанию).
		const ZONE_BG = Z + 'задний фон выбор локаций.png';
		const bgSpr = new PIXI.Sprite(PIXI.Texture.from(ZONE_BG));
		bgSpr.width = 1280; bgSpr.height = 720;
		win.addChild(bgSpr);
		this._zoneBgSpr = bgSpr;

		// Вкладки сверху (статичные)
		const tabZone = new PIXI.Sprite(PIXI.Texture.from(Z + 'кнопка зоны актив.png'));
		tabZone.anchor.set(0.5, 0.5);
		tabZone.x = 330; tabZone.y = 100;
		win.addChild(tabZone);

		const tab1 = new PIXI.Sprite(PIXI.Texture.from(Z + 'скоро зона.png'));
		tab1.anchor.set(0.5, 0.5);
		tab1.x = 552; tab1.y = 100;
		win.addChild(tab1);

		const tab2 = new PIXI.Sprite(PIXI.Texture.from(Z + 'скоро зона.png'));
		tab2.anchor.set(0.5, 0.5);
		tab2.x = 773; tab2.y = 100;
		win.addChild(tab2);

		// 21.09.2026 (по прямому указанию — "можно сделать обычное перелистывание, как
		// стрелки на попапе награды: нажимаю, появляется новая ячейка плавно"): раньше
		// стрелки листали ЦЕЛЫЕ СТРАНИЦЫ по 2 локации разом, мгновенным переключением. Заменено
		// на карусель — контейнер со всеми карточками сразу + Graphics-маска окна + gsap.to по
		// одной оси, тот же приём, что reward.js — только по вертикали.
		//
		// 21.09.2026 (правка того же дня, по прямому указанию — "должно быть по 2 карточки
		// локации, при нажатии вниз локация сдвигается вниз, система как в попапе с наградой"):
		// первая версия карусели показывала ОДНУ локацию за раз — неверная трактовка. Задумано
		// ОКНО из ДВУХ одновременно видимых карточек (как раньше top/bottom), но со СДВИГОМ НА
		// ОДНУ локацию за клик (не постраничным свапом сразу по 2, как было раньше) — см.
		// PER_LOC_STEP/VIEW_H ниже.
		//
		// Слот теперь всегда один и тот же (раньше было 2 разных — верхний/нижний на
		// странице), поэтому bx/by/cardW/cardH общие для всех 5 локаций.
		const SLOT_CX = 659, SLOT_CY = 267, SLOT_CARD_W = 902, SLOT_CARD_H = 196;
		const CAP_BTN_X = 347, CAP_BTN_Y = 329;
		const CARD_OFFSET_X = 14, CARD_OFFSET_Y = -7, CARD_SCALE = 0.706;
		// 22.09.2026 (баг найден по живому репорту — "карточка локации снизу обрезается
		// невидимым блоком", воспроизводилось на Агропроме): CARD_SCALE=0.706 был подобран под
		// исходники кордон/свалка/долина/янтарь (native height 311-317px), но у Агропром.png
		// native height 338px — при ОДНОМ фиксированном scale на всех карточка Агропрома
		// рендерится примерно на 15-19px выше остальных и её нижняя строка ("НАГРАДА: ...")
		// выходит за нижнюю границу маски карусели (maskGfx, окно показа VIEW_Y..VIEW_Y+VIEW_H),
		// хотя у остальных 4 карточек всё умещается. Фикс — масштаб считается ОТ РЕАЛЬНОЙ
		// высоты каждой текстуры к единой целевой видимой высоте (CARD_TARGET_H, снята с самой
		// короткой из исходников — 311px при CARD_SCALE — она заведомо помещается), а не
		// применяется как один и тот же множитель ко всем текстурам подряд.
		const CARD_TARGET_H = Math.round(311 * CARD_SCALE);
		// 22.09.2026 (баг найден по прямому указанию, скриншот редактора позиций — "сделай все
		// карточки локаций одним размером как на 1 картинке"): _applyCardScale ниже раньше
		// нормализовала ТОЛЬКО высоту (scale = CARD_TARGET_H / texture.height) — у всех 5
		// исходников (кордон/свалка/долина/Агропром/янтарь) разная ширина при таком же
		// масштабе, т.к. природное соотношение сторон разное (4.0 у Агропрома против ~4.25-4.35
		// у остальных) — итоговая ширина карточки плавала от ~880 до ~956px, хотя высота везде
		// была ровно 220. CARD_TARGET_W снят через редактор позиций именно с карточки "кордон"
		// (эталон с картинки пользователя: w=936,h=220,scale=0.696) — теперь ширина ТОЖЕ
		// фиксирована на это значение для всех карточек, а не только высота.
		const CARD_TARGET_W = 936;

		// 21.09.2026: Агропром раньше показывался в НИЖНЕМ слоте страницы и получил
		// индивидуальный xOverride/yOverride/scaleOverride, снятые через редактор именно под
		// ту геометрию. Теперь единственный слот — БЫВШИЙ ВЕРХНИЙ, поэтому старый override
		// (тюнингованный под другой слот) снят — карточка временно рендерится по общей
		// формуле, как остальные 4. Если визуально «поедет» — перепроверить через редактор
		// позиций (это ожидаемо, геометрия слота реально изменилась, не потерян старый фикс).
		const LOCATIONS = [
			{ file: Z + 'кордон.png',   locIdx: 0 },
			{ file: Z + 'свалка.png',   locIdx: 1 },
			{ file: Z + 'долина.png',   locIdx: 2 },
			{ file: Z + 'Агропром.png', locIdx: 3 },
			{ file: Z + 'янтарь.png',   locIdx: 4 },
		];
		const TOTAL_LOCS = LOCATIONS.length;

		// PER_LOC_STEP — шаг между соседними локациями внутри карусели, равен разнице центров
		// старых top/bottom слотов (504-267=237). Две позиции занимают 474px, однако сама
		// нижняя карточка имеет высоту 220px и выступает за её центр ещё на 110px. Раньше
		// маска заканчивалась ровно на Y=594 и отрезала нижние 13px карточки (включая рамку).
		// Запас в 26px заканчивается до стрелок и показывает карточку целиком.
		const PER_LOC_STEP = 237;
		const VIEW_BOTTOM_PADDING = 26;
		const VIEW_Y = 120, VIEW_H = PER_LOC_STEP * 2 + VIEW_BOTTOM_PADDING;
		const SLOT_H = PER_LOC_STEP;
		// Последний индекс, до которого можно докрутить карусель — TOTAL_LOCS-2, чтобы
		// последняя видимая пара ВСЕГДА была полной (напр. Агропром+Янтарь), а не одинокой
		// последней карточкой с пустым местом под ней (старый баг postраничного режима).
		const MAX_LOC_INDEX = Math.max(0, TOTAL_LOCS - 2);

		const locWrap = new PIXI.Container();
		win.addChild(locWrap);

		const maskGfx = new PIXI.Graphics();
		maskGfx.beginFill(0xffffff);
		maskGfx.drawRect(0, VIEW_Y, 1280, VIEW_H);
		maskGfx.endFill();
		win.addChild(maskGfx);
		locWrap.mask = maskGfx;

		const respectFrameSprites = [];
		const locGroups = [];
		LOCATIONS.forEach((loc, i) => {
			// Каждая локация — отдельная группа, сдвинутая на i*SLOT_H внутри locWrap.
			// Показ конкретной локации = locWrap.y = -index*SLOT_H (см. _zoneGoToIndex) —
			// её группа возвращается на "нормальную" (изначально спроектированную) позицию.
			const group = new PIXI.Container();
			group.y = i * SLOT_H;
			locWrap.addChild(group);

			const tex = PIXI.Texture.from(loc.file);
			const spr = new PIXI.Sprite(tex);
			spr.anchor.set(0.5, 0.5);
			spr.x = SLOT_CX + CARD_OFFSET_X;
			spr.y = SLOT_CY + CARD_OFFSET_Y;
			// Масштаб — фиксированные ширина И высота (CARD_TARGET_W/H, см. коммент выше), не
			// пропорциональный scale от одной лишь высоты: у исходников разное соотношение
			// сторон, из-за чего при единственном общем множителе ширина карточек плавала
			// (кордон/свалка/долина/янтарь ~4.25-4.35, Агропром 4.0). width/height растягивают
			// НЕЗАВИСИМО — все карточки теперь строго 936×220, как показал пользователь.
			const _applyCardScale = () => { spr.width = CARD_TARGET_W; spr.height = CARD_TARGET_H; };
			if(tex.baseTexture.valid) _applyCardScale();
			else tex.baseTexture.once('loaded', _applyCardScale);
			group.addChild(spr);

			// Кнопка ЗАХВАТИТЬ — интерактивна только у ТЕКУЩЕЙ (см. _zoneGoToIndex), чтобы
			// соседние (уже уехавшие за пределы маски) карточки не ловили клики.
			const capBtn = new PIXI.Sprite(PIXI.Texture.from(Z + 'кнопка захватить.png'));
			capBtn.anchor.set(0.5, 0.5);
			capBtn.x = CAP_BTN_X; capBtn.y = CAP_BTN_Y;
			capBtn.interactive = false; capBtn.buttonMode = false;
			capBtn.on('pointerover', () => { capBtn.texture = PIXI.Texture.from(Z + 'кнопка захватить hover.png'); _ss(capBtn, 1.04); });
			capBtn.on('pointerout',  () => { capBtn.texture = PIXI.Texture.from(Z + 'кнопка захватить.png'); _ss(capBtn, 1); });
			capBtn.on('pointerdown', () => {
				console.log('[zone_screen] capture click, locIdx:', loc.locIdx);
				if(window.zone) zone._openLocationPopup(loc.locIdx);
				else modules.checkFlags(['zone'], () => { if(window.zone) zone._openLocationPopup(loc.locIdx); });
			});
			group.addChild(capBtn);

			// Рамка «уважения» — от угла ЕДИНОГО слота (одна и та же геометрия у всех 5).
			const cardX = SLOT_CX - SLOT_CARD_W / 2;
			const cardTopY = SLOT_CY - SLOT_CARD_H / 2;
			const frameTex = PIXI.Texture.from(Z + 'рамка уважение.png');
			const respectFrame = new PIXI.Sprite(frameTex);
			respectFrame.x = cardX + RESPECT_FRAME_REL_X;
			respectFrame.y = cardTopY + RESPECT_FRAME_REL_Y;
			const frameScale = Math.min(RESPECT_FRAME_W / frameTex.width, RESPECT_FRAME_H / frameTex.height);
			respectFrame.scale.set(frameScale);
			group.addChild(respectFrame);
			respectFrameSprites[loc.locIdx] = respectFrame;

			locGroups.push({ group, spr, capBtn, respectFrame, locIdx: loc.locIdx, index: i });
		});

		// Фото рекордсмена по уважению — тот же паттерн, что «фото УБИВШЕГО» у боссов
		// (bosses_select.js). Фото теперь добавляется В ГРУППУ своей локации (не в win
		// напрямую), поэтому едет вместе с карточкой при сдвиге карусели.
		//
		// 24.09.2026 (по прямому указанию — "после выхода из захвата локации рекордсмен и
		// количество уважения не обновляются"): раньше этот запрос+рендер жили только ЗДЕСЬ,
		// одноразово при первой сборке _zoneWin. Кнопка выхода из локации (zone-popup.js) не
		// пересобирает весь _zoneWin — просто прячет попап поверх уже существующего экрана
		// выбора локаций, поэтому обновлённые сервером цифры уважения никогда не подтягивались
		// заново. Логика вынесена в this._refreshZoneRespectLeaders (определена ниже, ПОСЛЕ
		// _openZoneScreen) — тот же код, но вызываемый повторно; locGroups/respectFrameSprites
		// сохранены на this, чтобы вызвать без пересборки карточек.
		this._zoneRespectPhotos = [];
		this._zoneLocGroupsRef = locGroups;
		this._zoneRespectFrameSpritesRef = respectFrameSprites;
		this._refreshZoneRespectLeaders();

		// Стрелки навигации (вертикальные) — теперь листают по ОДНОЙ локации за клик.
		const arrowUp = new PIXI.Sprite(PIXI.Texture.from(Z + 'Стрелка вверх.png'));
		arrowUp.anchor.set(0.5, 0.5);
		arrowUp.x = 635; arrowUp.y = 629;
		arrowUp.interactive = false;
		win.addChild(arrowUp);

		const arrowDown = new PIXI.Sprite(PIXI.Texture.from(Z + 'активная стрелка вниз.png'));
		arrowDown.anchor.set(0.5, 0.5);
		arrowDown.x = 706; arrowDown.y = 628;
		arrowDown.interactive = true; arrowDown.buttonMode = true;
		win.addChild(arrowDown);

		this._zoneArrowUp    = arrowUp;
		this._zoneArrowDown  = arrowDown;
		this._zoneLocIndex   = 0;
		this._zoneTotalLocs  = TOTAL_LOCS;
		this._zoneMaxLocIndex = MAX_LOC_INDEX;
		this._zoneLocGroups  = locGroups;
		this._zoneLocWrap    = locWrap;
		this._zoneSlotH      = SLOT_H;

		arrowUp.on('pointerdown', () => {
			if(this._zoneLocIndex > 0){ this._zoneLocIndex--; this._zoneGoToIndex(); }
		});
		arrowDown.on('pointerdown', () => {
			if(this._zoneLocIndex < this._zoneMaxLocIndex){ this._zoneLocIndex++; this._zoneGoToIndex(); }
		});

		// Кнопка «Собрать прибыль».
		// 29.09.2026 (репорт — "собрал полный бизнес на двух локациях, 50+100 сигарет, получил
		// только 70"): раньше здесь был цикл, стреляющий zone.collectLocIncome() для ВСЕХ
		// локаций сразу, без ожидания ответа сервера — параллельные запросы гонялись за одной
		// и той же строкой игрока в БД и теряли часть начисления (см. подробный разбор в
		// zone.js._collectIncome()). Теперь один вызов zone._collectIncome() сам последовательно
		// обходит подходящие локации, дожидаясь ответа перед следующей.
		const btnCollect = new PIXI.Sprite(PIXI.Texture.from(Z + 'Когда показывается время.png'));
		btnCollect.anchor.set(0.5, 0.5);
		btnCollect.x = 665; btnCollect.y = 692;
		btnCollect.visible = true;
		btnCollect.interactive = false; btnCollect.buttonMode = false;
		btnCollect.on('pointerover', ()=>{ _sa(btnCollect, 0.8); });
		btnCollect.on('pointerout',  ()=>{ _sa(btnCollect, 1); });
		btnCollect.on('pointerdown', ()=>{
			if(!window.zone) return;
			zone._collectIncome(() => this._zoneUpdateCollect());
		});
		win.addChild(btnCollect);
		this._zoneBtnCollect = btnCollect;

		// Таймер до сбора
		const timerLbl = new PIXI.Text('', {
			fontFamily: 'Southbank LT', fontSize: 18, fill: '#ffffff',
			dropShadow: true, dropShadowDistance: 1, dropShadowColor: '#000000'
		});
		timerLbl.anchor.set(0.5, 0.5);
		// 04.10.2026 (по прямому указанию, редактор позиций — x:665 y:692 scale:1.209 w:258 h:24).
		timerLbl.x = 665; timerLbl.y = 692;
		timerLbl.scale.set(1.209);
		timerLbl.visible = false;
		win.addChild(timerLbl);
		this._zoneTimerLbl = timerLbl;

		// Кнопка Выход (стандартная позиция)
		const exitBtn = new PIXI.Sprite(PIXI.Texture.from('./images/выход.png'));
		exitBtn.scale.set(0.5);
		if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
		exitBtn.x = 1240; exitBtn.y = 86;
		exitBtn.interactive = true; exitBtn.buttonMode = true;
		exitBtn.on('pointerover', ()=>{ _sa(exitBtn, 0.75); exitBtn.scale.set(0.54); });
		exitBtn.on('pointerout',  ()=>{ _sa(exitBtn, 1); exitBtn.scale.set(0.5); });
		exitBtn.on('pointerdown', ()=>{
			clearInterval(this._zoneTimerInterval);
			this._zoneTimerInterval = null;
			win.visible = false;
			this.popHud('zone');
			this._stopZoneAmbient();
		});
		win.addChild(exitBtn);

		this._zoneWin = win;
		root.layer1_mc.addChild(win);
		// Экран Зоны сам заявляет "низ ХУДа скрыт, пока я открыт" (24.09.2026, декларативный
		// ХУД — см. Interface.pushHud/popHud/restoreHud в interface.js). Это делает ХУД
		// корректным для ЛЮБОГО другого места, которое вызовет iface.restoreHud(), пока Зона
		// открыта — стек, а не разовый флаг.
		this.pushHud('zone', { down: false });
		// 22.09.2026 (баг найден по живому репорту — "снизу что-то перекрывает карточку,
		// совпадает по размеру с нижним ХУДом, но объекта на этом месте нет"): restoreHud()
		// (interface.js) при играх Двора СОЗНАТЕЛЬНО не прячет this.down, а держит его видимым
		// И ПЕРЕНОСИТ в root.layer2_mc (см. комментарий там — раньше скрытие ХУДа в Двор
		// ломало навигацию, решение отменили). Если до Зоны был открыт Двор, this.down так и
		// остаётся ребёнком layer2_mc — слоя ВЫШЕ, чем окно Зоны (layer1_mc). Простого
		// visible=false здесь недостаточно: если этот флаг где-то по пути откатится обратно на
		// true, ХУД окажется НАД Зоной, а не под ней, и будет визуально резать карточки снизу.
		// Явно возвращаем this.down в layer1_mc здесь же (ПОСЛЕ pushHud, чтобы это конкретное
		// размещение слоя выигрывало) — тогда даже случайный откат visible не перекроет контент.
		if(this.down){ this.down.visible = false; root.layer1_mc.addChild(this.down); }
		if(this.up) root.layer1_mc.addChild(this.up);

		if(typeof targetLocIdx === 'number' && targetLocIdx >= 0 && targetLocIdx <= 4){
			// Зажимаем в допустимый диапазон [0, MAX_LOC_INDEX] — например Янтарь (locIdx=4,
			// последняя локация) при переходе "ЗАЧИСТИ Янтарь!" покажется НИЖНЕЙ карточкой
			// пары (Агропром+Янтарь), а не попыткой открыть несуществующий индекс 4 отдельно.
			this._zoneLocIndex = Math.min(targetLocIdx, MAX_LOC_INDEX);
		}
		this._zoneGoToIndex(true); // мгновенно — начальное открытие, анимировать нечего
		this._zoneUpdateCollect();

		if(!window.zone){
			modules.checkFlags(['zone'], () => {
				if(this._zoneBtnCollect) this._zoneUpdateCollect();
			});
		}

		this._zoneTimerInterval = setInterval(() => { if(win.visible) this._zoneUpdateCollect(); }, 1000);

		// Скрываем компас когда загрузится фон (18.09.2026 — единый фон для всех локаций)
		this._compassWaitTex(ZONE_BG);
	};

	// 24.09.2026 (по прямому указанию, см. большой комментарий в _openZoneScreen выше) —
	// запрашивает и рендерит рекордсменов по уважению для всех 5 локаций; вызывается и при
	// первой сборке экрана, и повторно (zone-popup.js, кнопка выхода из захвата локации), без
	// пересборки самих карточек — только фото+число поверх уже существующих рамок.
	proto._refreshZoneRespectLeaders = function(){
		const locGroups = this._zoneLocGroupsRef, respectFrameSprites = this._zoneRespectFrameSpritesRef;
		if(!locGroups || !respectFrameSprites) return;

		// Убираем фото/числа с прошлого рендера — иначе повторный вызов копит спрайты друг
		// поверх друга (одна и та же локация могла сменить рекордсмена, старое фото должно уйти).
		(this._zoneRespectPhotos || []).forEach(p => { if(p.spr && p.spr.parent) p.spr.parent.removeChild(p.spr); });
		this._zoneRespectPhotos = [];

		if(window.TS){
			TS.php('zone.leaders', {}, (res)=>{
				const leaders = (res && Array.isArray(res.leaders)) ? res.leaders : [];
				console.log('[zone_screen] zone.leaders вернул записей:', leaders.length);
				const withAmount = leaders.filter(l => l.amount > 0);
				if(!withAmount.length) return;

				const _renderRespectLeaders = (users) => {
					withAmount.forEach(l => {
						const u = users[String(l.id)];
						console.log('[zone_screen] respect leader loc='+l.loc+' id='+l.id+' amount='+l.amount+' resolved:', u ? (u.name+', photo='+(u.photo||'НЕТ')) : 'НЕ РЕЗОЛВЛЕН');
						const frameSpr = respectFrameSprites[l.loc];
						const g = locGroups.find(x => x.locIdx === l.loc);
						if(!frameSpr || !g) return;

						let photoSpr;
						if(u && u.photo){
							photoSpr = new PIXI.Sprite(PIXI.Texture.from(u.photo));
						} else {
							photoSpr = new PIXI.Graphics();
							photoSpr.beginFill(0x3a3a3a, 1); photoSpr.lineStyle(2, 0x8a8a8a);
							photoSpr.drawRect(0, 0, RESPECT_PHOTO_W, RESPECT_PHOTO_H); photoSpr.endFill();
						}
						if(photoSpr instanceof PIXI.Sprite) photoSpr.anchor.set(0.5, 0.5);
						else photoSpr.pivot.set(RESPECT_PHOTO_W/2, RESPECT_PHOTO_H/2);
						photoSpr.width = RESPECT_PHOTO_W; photoSpr.height = RESPECT_PHOTO_H;
						photoSpr.x = frameSpr.x + RESPECT_PHOTO_REL_X;
						photoSpr.y = frameSpr.y + RESPECT_PHOTO_REL_Y;
						photoSpr.rotation = RESPECT_PHOTO_ROTATION_DEG * Math.PI / 180;
						photoSpr._uDraggable = true;
						// 18.09.2026 (по прямому указанию): клик по фото рекордсмена уважения
						// открывает его публичный профиль.
						photoSpr.interactive = true; photoSpr.buttonMode = true;
						photoSpr.on('pointerdown', ()=>{ if(window.iface) iface._openPlayerProfile(l.id, u && u.name); });

						// 24.09.2026 (баг найден по прямому указанию — "количество уважения должно
						// быть по Z-индексу выше рамки"): addChildAt(..., frameIdx) вставляло ОБА
						// элемента ПЕРЕД рамкой в списке детей группы — в PIXI это значит НИЖЕ по
						// z-порядку (рамка рисуется поверх них). В группе после frameSpr больше
						// ничего не добавляется, поэтому простой addChild (в конец списка) кладёт
						// фото/число НАД рамкой, ничего не пряча за её декоративными краями.
						g.group.addChild(photoSpr);

						// 25.09.2026 (по прямому указанию — "снизу фото персонажа, выше рамка,
						// выше рамки надпись уважения"): предыдущий фикс (комментарий выше) заодно
						// поднял и ФОТО над рамкой — это оказалось лишним, рамка должна лежать
						// НАД фото (обрамлять его), только текст остаётся выше всех. addChild()
						// на уже добавленный дочерний элемент переносит его в конец списка (=
						// наверх z-порядка в PIXI) — тот же приём, что уже применялся выше для
						// фото; здесь просто возвращаем рамку на самый верх ПЕРЕД добавлением
						// текста, чтобы итоговый порядок снизу вверх был photoSpr → frameSpr →
						// amountTxt.
						g.group.addChild(frameSpr);

						// 22.09.2026 (по прямому указанию — "подпиши снизу сколько у него
						// уважения в этой зоне"): число рядом с фото рекордсмена — раньше
						// показывалось только фото без подписи суммы. l.amount — тот же
						// накопленный итог, что зона.php.leaders()/recordRespect() хранят.
						// 24.09.2026 (по прямому указанию, редактор позиций — см. RESPECT_AMOUNT_*
						// выше): Y и поворот уточнены (было frameSpr.y+RESPECT_FRAME_H / -3°,
						// стало frameSpr.y+RESPECT_AMOUNT_REL_Y / -5°). Центрирование по X (anchor
						// 0.5 + x = центр рамки) не менялось.
						// 04.10.2026 (по прямому указанию — "сделай кол-во уважения меньше
						// толщину шрифта"): 'normal' уже было минимальным стандартным весом
						// (снижали 03.10.2026) — пробуем числовой вес '300' (легче normal/400),
						// если у шрифта нет такой градации, canvas тихо откатится на обычный.
						const amountTxt = new PIXI.Text(String(l.amount), {
							fontFamily:'Southbank LT', fontSize:16, fill:'#000000', fontWeight:'300',
							dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1,
						});
						amountTxt.anchor.set(0.5, 0);
						amountTxt.x = frameSpr.x + RESPECT_FRAME_W / 2 + 5;
						amountTxt.y = frameSpr.y + RESPECT_AMOUNT_REL_Y;
						// 03.10.2026 (по прямому указанию): новый размер 1.394 (было 1.125);
						// fontWeight уже 'normal' выше — уменьшать жирность дальше не требуется.
						amountTxt.scale.set(1.394);
						amountTxt.rotation = RESPECT_AMOUNT_ROTATION_DEG * Math.PI / 180;
						amountTxt._uDraggable = true;
						g.group.addChild(amountTxt);
						this._zoneRespectPhotos.push({ spr: amountTxt, locIdx: l.loc });

						this._zoneRespectPhotos.push({ spr: photoSpr, locIdx: l.loc });
					});
				};

				const _withResolver = () => bosses._resolveVkUsers(withAmount.map(l=>l.id), _renderRespectLeaders);
				if(window.bosses && typeof bosses._resolveVkUsers === 'function') _withResolver();
				else modules.checkFlags(['bosses'], _withResolver);
			}, (e)=>{ console.error('[zone_screen] ошибка запроса zone.leaders:', e); });
		}
	};

	// 21.09.2026 (по прямому указанию — карусель по одной локации вместо постраничного
	// переключения по 2): сдвигает locWrap на -index*SLOT_H, тем самым текущая локация
	// возвращается на изначально спроектированную позицию слота, а остальные уезжают за
	// пределы маски. instant=true — без твина (используется при первом открытии экрана,
	// когда анимировать въезд ещё не из чего).
	proto._zoneGoToIndex = function(instant){
		if(!this._zoneLocWrap || !this._zoneLocGroups) return;
		const idx = this._zoneLocIndex;
		const targetY = -idx * this._zoneSlotH;

		// Кликабельна ПАРА карточек, реально видимых в окне (idx и idx+1) — маска PIXI
		// скрывает содержимое чисто визуально, хит-тест по ней НЕ фильтруется, поэтому без
		// этой проверки уехавшие за маску карточки всё равно ловили бы клики.
		this._zoneLocGroups.forEach(g => {
			const active = g.index === idx || g.index === idx + 1;
			g.capBtn.interactive = active; g.capBtn.buttonMode = active;
		});

		if(!instant && window.gsap){
			gsap.to(this._zoneLocWrap, { y: targetY, duration: 0.35, ease: 'power2.out' });
		} else {
			this._zoneLocWrap.y = targetY;
		}

		const Z = './images/';
		const up   = this._zoneArrowUp;
		const down = this._zoneArrowDown;
		if(up){
			const canUp = idx > 0;
			up.texture = PIXI.Texture.from(canUp ? Z + 'активная стрелка вверх.png' : Z + 'Стрелка вверх.png');
			up.interactive = canUp; up.buttonMode = canUp;
		}
		if(down){
			const canDown = idx < this._zoneMaxLocIndex;
			down.texture = PIXI.Texture.from(canDown ? Z + 'активная стрелка вниз.png' : Z + 'стрелка вниз.png');
			down.interactive = canDown; down.buttonMode = canDown;
		}
	};

	proto._zoneUpdateCollect = function(){
		if(!window.zone || !this._zoneBtnCollect) return;

		// 21.09.2026 (баг найден, по прямому указанию: "ReferenceError: Z is not defined" при
		// выходе в Зону после боя, а до этого — репорт "прокачал бизнес, а кнопка «Собрать
		// прибыль» не появилась") — Z объявлена локально здесь же (эта функция не делит
		// область видимости с _zoneGoToIndex/_openZoneScreen).
		const Z = './images/';

		let canCollect  = false;
		let hasBiz      = false;
		let minCooldown = Infinity;

		for(let i = 0; i < 5; i++){
			const loc = zone.locations[i];
			if(!loc) continue;
			if(!zone._locHasBizIncome(loc)) continue;
			hasBiz = true;
			const cd = zone.getCollectCooldown(i);
			if(cd === 0){
				canCollect = true;
			} else if(cd > 0 && cd < minCooldown){
				minCooldown = cd;
			}
		}

		// 19.09.2026: спрайт теперь ВСЕГДА видим — меняется только текстура (доступно/
		// недоступно) и интерактивность (кликабелен только когда реально есть что собрать).
		this._zoneBtnCollect.visible = true;
		this._zoneBtnCollect.texture = PIXI.Texture.from(
			Z + (canCollect ? 'собрать прибыль.png' : 'Когда показывается время.png')
		);
		this._zoneBtnCollect.interactive = canCollect;
		this._zoneBtnCollect.buttonMode  = canCollect;

		if(this._zoneTimerLbl){
			if(canCollect){
				this._zoneTimerLbl.visible = false;
			} else if(hasBiz && minCooldown < Infinity){
				const hh = String(Math.floor(minCooldown / 3600)).padStart(2, '0');
				const mm = String(Math.floor((minCooldown % 3600) / 60)).padStart(2, '0');
				const ss = String(minCooldown % 60).padStart(2, '0');
				this._zoneTimerLbl.text = 'ДО СБОРА ПРИБЫЛИ: ' + hh + ':' + mm + ':' + ss;
				this._zoneTimerLbl.style.fill = '#ffffff';
				this._zoneTimerLbl.visible = true;
			} else {
				this._zoneTimerLbl.visible = false;
			}
		}
	};
}
