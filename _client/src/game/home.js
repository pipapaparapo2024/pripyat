import attachFlaGallery from './shell/overlays/fla_gallery.js';

export default class Home{
	constructor(my_home){
		this.home = my_home;

		this.current_screen = null;

		this.initUnics();
		this.initButtons();
	}

	// 21.10.2026 (по прямому указанию — аудит имён файлов-ассетов): имена были однословными
	// без привязки к фиче в общей корневой images/ ("кубрик.png" и т.п.) — переименованы в
	// "хата фон X.png" (та же замена в player_profile.js/hata.js/game-boot.js, см.
	// ПЕРЕИМЕНОВАНИЕ_АССЕТОВ_21_10_2026.md).
	_bgFiles = ['хата фон кубрик.png','хата фон шлюз.png','хата фон канализация.png','двор_фон.png','хата фон мастерская.png','хата фон железка.png','хата фон станция.png','хата фон заправка.png'];

	// Индивидуальная подгонка каждого фона локации (сняты через универсальный редактор
	// позиций) — разные исходники по-разному скомпонованы по вертикали, единого y=0
	// на все не хватало. scale — множитель поверх базового 1280×604 (не тронут = 1).
	_bgAdjust = {
		'хата фон шлюз.png':        { y: 32, scale: 1.000 },
		'хата фон канализация.png': { y: 35, scale: 1.000 },
		'двор_фон.png':    { y: 54, scale: 1.000 },
		'хата фон мастерская.png':  { y: 74, scale: 1.000 },
		'хата фон железка.png':     { y: 56, scale: 1.002 },
		'хата фон заправка.png':    { y: 63, scale: 1.004 },
		'хата фон станция.png':     { y: 73, scale: 1.000 },
	};

	updateBg(){
		const idx  = Math.max(0, Math.min(this._bgFiles.length - 1, parseInt(udata['base_bg_active'] || '0') || 0));
		const file = this._bgFiles[idx];
		const tex  = PIXI.Texture.from('./images/' + file);
		const adj  = this._bgAdjust[file] || { y: 0, scale: 1 };
		const _fit = () => {
			this._hataBgSpr.width  = 1280 * adj.scale;
			this._hataBgSpr.height = 604 * adj.scale;
			this._hataBgSpr.y = adj.y;
		};
		if(!this._hataBgSpr){
			this._hataBgSpr = new PIXI.Sprite(tex);
			_fit();
			this.home.back_mc.addChild(this._hataBgSpr);
		} else {
			this._hataBgSpr.texture = tex;
			if(tex.width > 1) _fit(); else tex.once('update', _fit);
		}
	}

	init(){
		while(this.home.back_mc.children.length)this.home.back_mc.removeChildAt(0);

		// 28.09.2026 (по прямому указанию, скриншот редактора позиций — "убери из игры файл
		// home_elements_atlas_1.png, он до сих пор выводится на экран"): раньше сюда добавлялся
		// helper.duplicate(this.bgs) — заново созданный Home_backgrounds/home_bg0 из старой
		// FLA-библиотеки home_elements. helper.duplicate() делает `new obj.constructor()`, то
		// есть теряет setTransform(-2000) оригинала (тот стоял за кадром намеренно) — свежий
		// экземпляр рождался с x=0,y=0 и его внутренний спрайт (home_bg0, атлас
		// home_elements_atlas_1.png) оказывался в кадре внутри back_mc. Актуальный фон комнаты
		// целиком рисует updateBg() ниже (PNG из _bgFiles) — этот легаси-спрайт был лишним,
		// не использовался ни для чего и просто торчал поверх/из-под текущего фона.
		this.updateBg();

		root.layer0_mc.addChild(this.home);

		// Персонаж — в layer0_mc поверх FLA, не внутрь FLA (FLA перекрывает addChild)
		// 24.09.2026 (по прямому указанию — новый файл "персонаж который сидит.png", "убери то,
		// что на сервере, поставь этот файл"): заменяет ТОЛЬКО этот, главно-экранный спрайт —
		// pers.png остаётся как есть в base.js/hata.js/player_profile.js/shmot_shop.js (там
		// свои манекены с собственной подгонкой под 273×389, отдельно не просили менять).
		// Явные width/height=273×389 — те же, что были у нативного размера pers.png (совпадающая
		// пропорция у нового файла, 1224×1737 ≈ то же соотношение сторон) — сохраняет прежний
		// видимый размер персонажа на позиции (506,204), не двигая шмотки, подогнанные под неё.
		if(!this._persSpr){
			const persTex = PIXI.Texture.from('./images/персонаж который сидит.png');
			// 17.10.2026 (репорт пользователя — "персонаж пиксельный при отдалении/мелком
			// показе"): файл 1224×1737, рисуется принудительными 273×389 (×0.223) — без мипмапов
			// GPU сэмплирует полноразмерную текстуру при таком сильном уменьшении, алиасинг
			// заметен на лице/надписях. Файл НЕ степень двойки, поэтому обычный дефолт
			// MIPMAP_MODES.POW2 мипмапы для него не генерирует. ON форсирует попытку — PixiJS
			// внутри сам проверяет webGLVersion===2 || isPowerOfTwo перед реальным
			// gl.generateMipmap(), так что на WebGL1-клиентах (где NPOT-мипмапы в принципе не
			// поддерживаются спецификацией) это no-op без ошибок и без регресса — выигрыш только
			// на WebGL2 (подавляющее большинство текущих VK-вебвью/браузеров).
			persTex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
			persTex.baseTexture.update();
			this._persSpr = new PIXI.Sprite(persTex);
			this._persSpr.anchor.set(0, 0);
			this._persSpr.x = 506;
			this._persSpr.y = 204;
			this._persSpr.width = 273;
			this._persSpr.height = 389;
		}
		root.layer0_mc.addChild(this._persSpr);

		// Надетые шмотки — те же спрайты/пропорции, что на манекене в «Шмотках»
		// (см. shmot_shop.js MAN_SLOTS), пересчитанные под тот же сдвиг персонажа
		// (730,208) → (506,204), т.е. (-224,-4). Рисуются ПОСЛЕ персонажа и ДО кистей
		// рук — кисти должны быть поверх одежды, как и на экране магазина шмоток.
		const HOME_DX = -224, HOME_DY = -4;
		// Порядок в массиве = порядок addChild = z-index (см. shmot_shop.js MAN_SLOTS — тот же
		// порядок: Обувь — самый нижний слой ног, Штаны поверх Обуви, Торс поверх Штанов).
		// ВАЖНО: нельзя рассчитывать на Object.values(this._clothSlots) для порядка отрисовки —
		// у объекта с числовыми ключами (cat) JS всегда отдаёт их по возрастанию, независимо от
		// порядка вставки, так что z-order там всегда 0,1,2,3,4,6 и переставить его не давал бы
		// эффекта. addChild делаем сразу по CLOTH_SLOTS-массиву — так же, как в shmot_shop.js.
		// 24.09.2026 (по прямому указанию — "хочу чтобы шмотка на голову была выше по
		// Z-индексу чем шмотка на тело"): Голова (cat:0) была ПЕРВОЙ в массиве — ниже всех по
		// z-порядку (см. коммент ниже про порядок addChild = z-index), теперь стоит сразу
		// ПОСЛЕ Торса — координаты слотов не тронуты, только порядок отрисовки.
		const CLOTH_SLOTS = [
			{ cat: 3, x: 864 + HOME_DX, y: 591 + HOME_DY, centerX: true },  // Обувь — самый нижний слой ног
			{ cat: 2, x: 893 + HOME_DX, y: 358 + HOME_DY, centerX: true },  // Штаны — выше Обуви
			{ cat: 1, x: 804 + HOME_DX, y: 258 + HOME_DY },                 // Торс — выше Штанов
			{ cat: 0, x: 871 + HOME_DX, y: 195 + HOME_DY, centerX: true },  // Голова — выше Торса
			{ cat: 4, x: 882 + HOME_DX, y: 414 + HOME_DY },                 // Аксессуар
			{ cat: 6, x: 856 + HOME_DX, y: 418 + HOME_DY },                 // Рука
		];
		if(!this._clothSlots){
			this._clothSlots = {};
			this._clothSlotBases = {};
			CLOTH_SLOTS.forEach(s => {
				const spr = new PIXI.Sprite(PIXI.Texture.EMPTY);
				spr.anchor.set(s.centerX ? 0.5 : 0, s.cat === 3 ? 1 : 0);
				spr.x = s.x; spr.y = s.y;
				this._clothSlots[s.cat] = spr;
				this._clothSlotBases[s.cat] = { x: s.x, y: s.y };
			});
		}
		// 21.10.2026 (по прямому указанию — "разделить файл руки на предплечье и кисть"):
		// раньше тут была "фаланги правой руки.png" (мелкий оверлей костяшек поверх зажатого
		// предмета). Теперь на этом месте — ПОЛНАЯ кисть, которая переключается между
		// "кисть расслабленная.png" (пусто/часы Poker/цепь Teenager) и "кисть хват.png"
		// (что-то зажато в кулаке), либо скрывается целиком, если у самого предмета УЖЕ
		// нарисована своя кисть (handBuiltIn в каталоге shmot.js — Сайга/Пистолет/Кружка
		// новых сетов). Текстура/видимость выставляются в updateClothes() ниже — здесь
		// только создание и базовая позиция. Рисуется ПЕРЕД предметом в руке (cat:6), чтобы
		// предмет (мачете/бита/и т.д.) лёг поверх кисти, но ПОСЛЕ предплечья — анатомически
		// кисть на конце предплечья.
		// 22.10.2026 (по прямому указанию, редактор позиций): прежний общий размер 98×97 для
		// ОБЕИХ текстур кисти (первая прикидка) заменён на СВОЙ x/y/scale под каждую — у
		// "расслабленная.png" (160×277) и "хват.png" (217×199) разное положение "запястья"
		// внутри файла (anchor всегда 0,0 — левый верх), общий box их не мог совместить
		// одинаково хорошо для обеих. Актуальные значения — в updateClothes() ниже, здесь
		// только начальная (дефолтная) текстура/позиция.
		if(!this._rightHandSpr){
			this._rightHandSpr = new PIXI.Sprite(PIXI.Texture.from('./images/кисть расслабленная.png'));
			this._rightHandSpr.texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
			this._rightHandSpr.texture.baseTexture.update();
			this._rightHandSpr.anchor.set(0, 0);
			// 22.10.2026 (по прямому указанию, повторная калибровка редактором позиций): 647,424 → 642,427.
			this._rightHandSpr.x = 642;
			this._rightHandSpr.y = 427;
			this._rightHandSpr.scale.set(0.200);
		}
		// 23.10.2026 (по прямому указанию — "почему-то ты не выводишь файл фаланги кистей, когда
		// игрок берёт что-то в руку... он должен находиться под оружием и под кистью"): см. тот
		// же докблок у this._manPhalanxSpr в shmot_shop.js — "фаланги правой руки.png" вернулся
		// отдельным слоем, видимым только когда в руке реально что-то зажато. ⚠️ x/y/scale —
		// приблизительная прикидка (поза "кисть хват.png"), точных исторических чисел не
		// сохранилось — требует уточнения через редактор позиций.
		if(!this._phalanxSpr){
			this._phalanxSpr = new PIXI.Sprite(PIXI.Texture.from('./images/фаланги правой руки.png'));
			this._phalanxSpr.texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
			this._phalanxSpr.texture.baseTexture.update();
			this._phalanxSpr.anchor.set(0, 0);
			this._phalanxSpr.x = 634;
			this._phalanxSpr.y = 421;
			this._phalanxSpr.scale.set(0.189);
			this._phalanxSpr.visible = false;
		}
		CLOTH_SLOTS.forEach(s => {
			if(s.cat === 6){ root.layer0_mc.addChild(this._rightHandSpr); root.layer0_mc.addChild(this._phalanxSpr); }
			root.layer0_mc.addChild(this._clothSlots[s.cat]);
		});
		this.updateClothes();

		// 24.09.2026 (по прямому указанию, новый файл "левое предплечье.png" — "поставь рядом
		// с персонажем, z-index больше чем у шмоток на тело (торс)"): добавлен ПОСЛЕ всего
		// CLOTH_SLOTS.forEach выше (значит, ВЫШЕ по z-порядку Торса/Головы/Аксессуара/предмета
		// в руке), но ДО кистей рук ниже — анатомически предплечье между корпусом и кистью.
        // ⚠️ Координаты (x/y) — ПРИБЛИЗИТЕЛЬНАЯ прикидка рядом с левой рукой (534,385), точных
        // чисел пользователь не присылал — требует подтверждения/уточнения через редактор
        // позиций (как и остальные позиционные правки в этом проекте).
		if(!this._leftForearmSpr){
			this._leftForearmSpr = new PIXI.Sprite(PIXI.Texture.from('./images/левое предплечье.png'));
			this._leftForearmSpr.texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
			this._leftForearmSpr.texture.baseTexture.update();
			this._leftForearmSpr.anchor.set(0, 0);
			// 24.09.2026 (уточнено пользователем через редактор позиций — x:515 y:327
			// scale:0.197): персонаж (this._persSpr) здесь в (506,204), значит смещение
			// предплечья от персонажа +9x/+123y — то же смещение и тот же scale применены
			// во всех остальных местах, где отображается персонаж (см. hata.js/
			// player_profile.js/shmot_shop.js/base.js).
			this._leftForearmSpr.x = 514;
			this._leftForearmSpr.y = 324;
			this._leftForearmSpr.scale.set(0.197);
		}
		root.layer0_mc.addChild(this._leftForearmSpr);

		// 21.10.2026 (по прямому указанию — "предплечье будет везде одинаковое, кисти будут
		// разные"): "правая рука.png" (единый файл кисть+часть предплечья, переключался между
		// "правая рука.png"/"правая рука пустая.png") заменён на ОТДЕЛЬНЫЙ статичный файл
		// предплечья — больше никогда не переключается (симметрично "левое предплечье.png"
		// выше, которое тоже всегда одно и то же). Позиция — там же, где раньше стояла
		// "правая рука.png" (630,369), кисть теперь отдельно (см. this._rightHandSpr выше).
		if(!this._rightForearmSpr){
			this._rightForearmSpr = new PIXI.Sprite(PIXI.Texture.from('./images/предплечье правое.png'));
			this._rightForearmSpr.texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
			this._rightForearmSpr.texture.baseTexture.update();
			this._rightForearmSpr.anchor.set(0, 0);
			// 22.10.2026 (по прямому указанию, повторная калибровка редактором позиций):
			// 649,377,0.197 → 642,375,0.218.
			this._rightForearmSpr.x = 642;
			this._rightForearmSpr.y = 375;
			this._rightForearmSpr.scale.set(0.218);
		}
		root.layer0_mc.addChild(this._rightForearmSpr);
		// 24.10.2026 (по прямому указанию — "кисть находится под предплечьем, так быть не
		// должно"): явная гарантия сразу здесь, не полагаемся только на пересортировку в
		// updateClothes() ниже (она завязана на leftHandSpr и могла не успеть выполниться).
		root.layer0_mc.addChild(this._rightHandSpr);
		root.layer0_mc.addChild(this._phalanxSpr);

		if(!this._leftHandSpr){
			this._leftHandSpr = new PIXI.Sprite(PIXI.Texture.from('./images/левая рука.png'));
			this._leftHandSpr.texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
			this._leftHandSpr.texture.baseTexture.update();
			this._leftHandSpr.anchor.set(0, 0);
			this._leftHandSpr.x = 534;
			this._leftHandSpr.y = 385;
		}
		root.layer0_mc.addChild(this._leftHandSpr);

		// 21.10.2026 (по прямому указанию — "мини-анимация с морганием персонажа"): "глаза
		// закрыты.png" появляется раз в 15 сек и держится 0.3 сек поверх лица. persSpr здесь
		// создаётся один раз за сеанс (см. if(!this._persSpr) выше) — интервал заводим по
		// тому же принципу (один раз), иначе повторные init() плодили бы параллельные таймеры.
		if(!this._eyesClosedSpr){
			this._eyesClosedSpr = new PIXI.Sprite(PIXI.Texture.from('./images/глаза закрыты.png'));
			this._eyesClosedSpr.anchor.set(0, 0);
			// 21.10.2026 (уточнено пользователем через редактор позиций на экране магазина
			// шмоток — x:853 y:234 scale:0.219 при персонаже там в 730,208, т.е. смещение
			// +123x/+26y): персонаж здесь в (506,204), та же разница → 629,230.
			this._eyesClosedSpr.x = 629;
			this._eyesClosedSpr.y = 232;
			this._eyesClosedSpr.scale.set(0.219);
			this._eyesClosedSpr.visible = false;
			// 26.10.2026 (по прямому указанию — "для шмотки маска исполнитель моргания не
			// должно быть"): id116 "Маска (Исполнитель)", cat:0 (голова) — лицо под маской,
			// моргание глаз поверх неё визуально бессмысленно/лишнее. Проверяется на каждом
			// тике интервала (не один раз при старте) — шмотку можно снять/надеть в любой
			// момент сессии, статическая проверка при создании спрайта не отследила бы смену.
			setInterval(() => {
				const headEq = window.shmot && (shmot.items || []).find(it => it.cat === 0 && it.equipped);
				if(headEq && headEq.id === 116) return; // "Маска (Исполнитель)" — не моргать
				this._eyesClosedSpr.visible = true;
				setTimeout(() => { this._eyesClosedSpr.visible = false; }, 300);
			}, 15000);
		}
		root.layer0_mc.addChild(this._eyesClosedSpr);

		// 25.09.2026 (уточнение по прямому указанию, "все шмотки теперь кладутся поверх файла
		// правая рука, должно быть не так — поверх только часы Покер и цепь Тинейджер, все
		// остальные под этим файлом"): прошлое правило ("предмет в руке ВСЕГДА выше кистей")
		// оказалось верно только для 2 предметов, которые НАДЕТЫ НА руку (часы/цепь — лежат
		// поверх кожи). Все остальные cat:6 предметы — оружие/инструмент, зажатый В руке —
		// должны быть ПОД пальцами (иначе кисть "съедает" зажатый предмет). Финальный вызов
		// здесь убран — позиционирование слота cat:6 теперь решается внутри updateClothes()
		// (по id актуально надетого предмета), которая и так вызывается сразу ниже.
		this.updateClothes();

		// 26.10.2026 (по прямому указанию — "эта кнопка не нужна"): дев-кнопка "FLA" (галерея
		// скомпилированных FLA-файлов, see shell/overlays/fla_gallery.js) окончательно убрана с
		// главного экрана — третий раз за неделю меняли видимость (добавлена 22.10, скрыта
		// 24.10, возвращена 25.10), на этот раз удалена из init() целиком, не просто скрыта.
		// Сам модуль fla_gallery.js/_openFlaGallery() не удалён — мёртвый код, если понадобится
		// вернуть снова, при нём уже есть флаг this._flaGalleryBtn, который просто больше нигде
		// не создаётся.

		// 26.10.2026 (по прямому указанию — "убери иконку 2048 с главного экрана"): кнопка
		// "2048 иконка игры.png" (добавлена тем же днём чуть раньше, x14/y140) убрана отсюда
		// целиком — открытие игры "2048" переехало во вкладку «Двор» (см. dvor.js, кнопка
		// "нажать на игру.png"/"ящик.png"). game2048.open() вызывается оттуда.
	}

	// Отрисовывает надетые шмотки на персонаже главного меню — зеркалит
	// _updateManSprites() из shmot_shop.js один в один (те же manDx/manDy/manScale),
	// только со сдвигом (-224,-4) под другую позицию персонажа на этом экране.
	updateClothes(){
		if(!this._clothSlots || !window.shmot) return;
		Object.keys(this._clothSlots).forEach(cat => {
			const spr = this._clothSlots[cat];
			const base = this._clothSlotBases[cat];
			const eq = (shmot.items || []).find(it => it.cat === parseInt(cat) && it.equipped);
			if(eq && eq.imgFile){
				// 27.10.2026 (по прямому указанию — перевод предметов на персонаже с manScale на
				// явные manWidth/manHeight, см. докблок в shmot_shop.js._updateManSprites). Резкость
				// по-прежнему даёт manImgFile (заранее уменьшенный PNG) — явный размер её не меняет
				// (см. историю отката 26.10.2026 в AGENTS.md), просто другая форма записи того же
				// видимого размера.
				spr.texture = PIXI.Texture.from('./images/shmot/' + (eq.manImgFile || eq.imgFile));
				spr.texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
				spr.texture.baseTexture.update();
				spr.visible = true;
				spr.x = base.x + (eq.manDx || 0);
				spr.y = base.y + (eq.manDy || 0) + (eq.imgFile === 'штаны_1.png' ? -28 : 0);
				spr.width  = eq.manWidth  || spr.texture.width;
				spr.height = eq.manHeight || spr.texture.height;
			} else {
				spr.texture = PIXI.Texture.EMPTY;
				spr.visible = false;
				spr.scale.set(1);
			}
			// Обычные предметы в руке: фаланги/левое предплечье/левая кисть → предмет
			// → правая кисть. Исключения — часы Poker и цепь Teenager — носятся на
			// руке и должны быть выше самой правой кисти.
			if(parseInt(cat) === 6 && this._leftHandSpr && this._leftHandSpr.parent === root.layer0_mc){
				// 21.10.2026 (по прямому указанию — "предплечье всегда одно, кисть меняется"):
				// предплечье (this._rightForearmSpr) больше НЕ трогается здесь — статичный файл,
				// никогда не переключается. "кисть расслабленная.png" — ничего не зажато (или
				// часы Poker/цепь Teenager — id 62/92, они носятся НА руке, не в кулаке), "кисть
				// хват.png" — что-то зажато. Исключение — у части предметов (handBuiltIn в
				// каталоге shmot.js — Сайга/Пистолет/Кружка новых сетов) кисть уже нарисована
				// ВНУТРИ файла самого предмета — для них кисть-спрайт скрывается целиком,
				// остаётся только предплечье.
				const _handWeaponHeld = eq && eq.id !== 62 && eq.id !== 92;
				if(this._rightHandSpr){
					if(_handWeaponHeld && eq.handBuiltIn){
						this._rightHandSpr.visible = false;
					} else {
						this._rightHandSpr.visible = true;
						// 22.10.2026 (по прямому указанию, редактор позиций): свой x/y/scale под
						// каждую текстуру кисти (не общий box 98×97) — см. коммент у создания спрайта.
						this._rightHandSpr.texture = PIXI.Texture.from(
							_handWeaponHeld ? './images/кисть хват.png' : './images/кисть расслабленная.png'
						);
						this._rightHandSpr.texture.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
						this._rightHandSpr.texture.baseTexture.update();
						this._rightHandSpr.x = _handWeaponHeld ? 634 : 642;
						this._rightHandSpr.y = _handWeaponHeld ? 421 : 427;
						this._rightHandSpr.scale.set(_handWeaponHeld ? 0.189 : 0.200);
					}
				}
				// 23.10.2026 (по прямому указанию — "фаланги должны быть под оружием и под
				// кистью"): видна только когда что-то реально зажато (не у handBuiltIn-предметов).
				if(this._phalanxSpr) this._phalanxSpr.visible = !!(_handWeaponHeld && !eq.handBuiltIn);
				let topIdx = root.layer0_mc.getChildIndex(this._leftHandSpr) + 1;
				if(this._phalanxSpr && this._phalanxSpr.visible){
					root.layer0_mc.addChildAt(this._phalanxSpr, Math.min(topIdx, root.layer0_mc.children.length));
					topIdx = root.layer0_mc.getChildIndex(this._phalanxSpr) + 1;
				}
				root.layer0_mc.addChildAt(spr, Math.min(topIdx, root.layer0_mc.children.length));
				if(eq && (eq.id === 62 || eq.id === 92)) root.layer0_mc.addChild(spr);
				else if(this._rightHandSpr) root.layer0_mc.addChildAt(this._rightHandSpr, root.layer0_mc.getChildIndex(spr) + 1);
			}
		});
		// 22.10.2026 (по прямому указанию — "три новых куртки должны быть выше по Z-индексу,
		// чем левая рука/предплечья/кисть и часы/цепь"): обычно торс (cat:1) рисуется НИЖЕ
		// рук (addChild'ится раньше них в init()) — для ЭТИХ трёх конкретных предметов
		// (id102/107/112 — куртки сетов Бродяга/Ветеран/Следопыт, длинный рукав) торс
		// поднимается на самый верх ПОСЛЕ того, как кисть/предплечья/часы-цепь уже
		// расставлены выше в forEach'е выше — иначе рукав визуально обрезался бы рукой.
		// 25.10.2026 (по прямому указанию — "шмотки на торс по Z-индексу меньше, чем левое/
		// правое предплечье, сделай так, чтобы одежда была поверх"): худи сета "Исполнитель"
		// (id118/119) — тот же класс длиннорукавной одежды, добавлены в тот же список.
		const _torsoEq = (shmot.items || []).find(it => it.cat === 1 && it.equipped);
		if(_torsoEq && [102, 107, 112, 118, 119].includes(_torsoEq.id) && this._clothSlots[1]){
			root.layer0_mc.addChild(this._clothSlots[1]);
			// 22.10.2026 (по прямому указанию — "шмотки на голову должны быть выше по
			// Z-индексу, чем шмотки на торс"): поднятие торса выше поднимало его и выше головы —
			// переподнимаем голову следом, чтобы правило "голова выше торса" не нарушалось.
			if(this._clothSlots[0]) root.layer0_mc.addChild(this._clothSlots[0]);
			// 23.10.2026 (по прямому указанию, скрин — "бита прячется под куртку"): подъём
			// куртки хоронил уже переставленные выше в forEach оружие/кисть/фаланги (cat:6) —
			// переподнимаем их поверх куртки, НО только для предмета, реально зажатого в
			// кулаке. 23.10.2026 (повторный скрин — "Сайга/Пистолет/Кружка должны быть МЕНЬШЕ
			// по Z-индексу, чем куртка; часы на руке тоже под курткой"): handBuiltIn-предметы
			// (своя кисть нарисована внутри файла) и часы/цепь (id62/92) исключены из
			// переподъёма целиком — остаются под курткой, как было до появления переподъёма.
			// 26.10.2026 (по прямому указанию — "бита исполнителя должна быть поверх шмоток на
			// торс"): id117 — исключение из исключения, см. тот же коммент в shmot_shop.js
			// (держится поднятой в кулаке, а не у бедра, как Сайга/Пистолет/Кружка).
			const _handEq = (shmot.items || []).find(it => it.cat === 6 && it.equipped);
			const _handWeaponHeld2 = _handEq && _handEq.id !== 62 && _handEq.id !== 92 && (!_handEq.handBuiltIn || _handEq.id === 117);
			if(_handWeaponHeld2){
				if(this._phalanxSpr && this._phalanxSpr.parent === root.layer0_mc) root.layer0_mc.addChild(this._phalanxSpr);
				if(this._clothSlots[6]) root.layer0_mc.addChild(this._clothSlots[6]);
				if(this._rightHandSpr && this._rightHandSpr.parent === root.layer0_mc) root.layer0_mc.addChild(this._rightHandSpr);
			}
		}
	}

	initButtons(){

	}

	initUnics(){

	}

	// Открыть экран поверх комнаты (боссы, зона, магазин и т.д.)
	openScreen(screen_mc){
		if(this.current_screen === screen_mc) return;
		this.closeScreen();
		// 18.10.2026 (баг найден по живому репорту — "серый прямоугольник на главном экране,
		// редактор позиций его не видит"): Зона — единственный экран, который не регистрирует
		// себя как this.current_screen (кладёт себя в root.layer1_mc напрямую, см. комментарий
		// в zone_screen.js._openZoneScreen) — closeScreen() выше о ней ничего не знает и не
		// прячет. Без этого вызова открытие ЛЮБОГО другого экрана поверх открытой Зоны
		// оставляло её висеть под новым экраном, а после его закрытия — "всплывала" обратно.
		if(window.iface && typeof iface._closeZoneScreen === 'function') iface._closeZoneScreen();
		this.current_screen = screen_mc;
		screen_mc.alpha = 0;
		root.layer1_mc.addChild(screen_mc);
		helper.fadeAnimation(screen_mc, 'fadeIn', 200);
	}

	closeScreen(){
		if(!this.current_screen) return;
		let s = this.current_screen;
		this.current_screen = null;
		helper.fadeAnimation(s, 'fadeOut', 200, ()=>{
			if(root.layer1_mc.children.indexOf(s) !== -1)
				root.layer1_mc.removeChild(s);
		});
	}
}

attachFlaGallery(Home.prototype);
