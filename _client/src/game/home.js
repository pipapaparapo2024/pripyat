export default class Home{
	constructor(my_home){
		this.home = my_home;

		this.current_screen = null;

		this.initUnics();
		this.initButtons();
	}

	_bgFiles = ['кубрик.png','шлюз.png','канализация.png','двор_фон.png','мастерская.png','железка.png','станция.png','заправка.png'];

	// Индивидуальная подгонка каждого фона локации (сняты через универсальный редактор
	// позиций) — разные исходники по-разному скомпонованы по вертикали, единого y=0
	// на все не хватало. scale — множитель поверх базового 1280×604 (не тронут = 1).
	_bgAdjust = {
		'шлюз.png':        { y: 32, scale: 1.000 },
		'канализация.png': { y: 35, scale: 1.000 },
		'двор_фон.png':    { y: 54, scale: 1.000 },
		'мастерская.png':  { y: 74, scale: 1.000 },
		'железка.png':     { y: 56, scale: 1.002 },
		'заправка.png':    { y: 63, scale: 1.004 },
		'станция.png':     { y: 73, scale: 1.000 },
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
		// Фаланги правой руки — рисуются ПЕРЕД предметом в руке (cat:6), чтобы предмет
		// (мачете/бита/и т.д.) лёг поверх пальцев (как будто рука его держит), но САМИ
		// пальцы — раньше (т.е. ниже по z-index), чем предплечье/кисть (_rightHandSpr,
		// добавляется ещё позже, ниже). Координаты — сняты через редактор позиций
		// (старые с PSD-слоя "фаланга мезинца" не совпадали с реальной рукой на экране).
		if(!this._rightHandPhalanxSpr){
			this._rightHandPhalanxSpr = new PIXI.Sprite(PIXI.Texture.from('./images/фаланги правой руки.png'));
			this._rightHandPhalanxSpr.anchor.set(0, 0);
			this._rightHandPhalanxSpr.x = 634;
			this._rightHandPhalanxSpr.y = 441;
		}
		CLOTH_SLOTS.forEach(s => {
			if(s.cat === 6) root.layer0_mc.addChild(this._rightHandPhalanxSpr);
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

		// Кисти рук персонажа — позиции сняты через универсальный редактор позиций
		// напрямую на главном экране (уже не формула от смещения манекена — она давала
		// небольшое расхождение: правая на 7px правее, левая на 2px левее нужного).
		if(!this._rightHandSpr){
			this._rightHandSpr = new PIXI.Sprite(PIXI.Texture.from('./images/правая рука.png'));
			this._rightHandSpr.anchor.set(0, 0);
			this._rightHandSpr.x = 630;
			this._rightHandSpr.y = 369;
		}
		root.layer0_mc.addChild(this._rightHandSpr);

		if(!this._leftHandSpr){
			this._leftHandSpr = new PIXI.Sprite(PIXI.Texture.from('./images/левая рука.png'));
			this._leftHandSpr.anchor.set(0, 0);
			this._leftHandSpr.x = 534;
			this._leftHandSpr.y = 385;
		}
		root.layer0_mc.addChild(this._leftHandSpr);

		// 25.09.2026 (уточнение по прямому указанию, "все шмотки теперь кладутся поверх файла
		// правая рука, должно быть не так — поверх только часы Покер и цепь Тинейджер, все
		// остальные под этим файлом"): прошлое правило ("предмет в руке ВСЕГДА выше кистей")
		// оказалось верно только для 2 предметов, которые НАДЕТЫ НА руку (часы/цепь — лежат
		// поверх кожи). Все остальные cat:6 предметы — оружие/инструмент, зажатый В руке —
		// должны быть ПОД пальцами (иначе кисть "съедает" зажатый предмет). Финальный вызов
		// здесь убран — позиционирование слота cat:6 теперь решается внутри updateClothes()
		// (по id актуально надетого предмета), которая и так вызывается сразу ниже.
		this.updateClothes();
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
				spr.texture = PIXI.Texture.from('./images/shmot/' + eq.imgFile);
				spr.visible = true;
				spr.x = base.x + (eq.manDx || 0);
				spr.y = base.y + (eq.manDy || 0) + (eq.imgFile === 'штаны_1.png' ? -28 : 0);
				spr.scale.set(eq.manScale || 1);
			} else {
				spr.texture = PIXI.Texture.EMPTY;
				spr.visible = false;
				spr.scale.set(1);
			}
			// Обычные предметы в руке: фаланги/левое предплечье/левая кисть → предмет
			// → правая кисть. Исключения — часы Poker и цепь Teenager — носятся на
			// руке и должны быть выше самой правой кисти.
			if(parseInt(cat) === 6 && this._leftHandSpr && this._leftHandSpr.parent === root.layer0_mc){
				const weaponIdx = root.layer0_mc.getChildIndex(this._leftHandSpr) + 1;
				root.layer0_mc.addChildAt(spr, Math.min(weaponIdx, root.layer0_mc.children.length));
				if(eq && (eq.id === 62 || eq.id === 92)) root.layer0_mc.addChild(spr);
				else if(this._rightHandSpr) root.layer0_mc.addChildAt(this._rightHandSpr, root.layer0_mc.getChildIndex(spr) + 1);
			}
		});
	}

	// Открыть экран поверх комнаты (банк, зона, боссы и т.д.)
	openScreen(screen_mc){
		if(this.current_screen)root.layer1_mc.removeChild(this.current_screen);
		this.current_screen = screen_mc;
		root.layer1_mc.addChild(screen_mc);
	}

	closeScreen(){
		if(this.current_screen){
			root.layer1_mc.removeChild(this.current_screen);
			this.current_screen = null;
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
