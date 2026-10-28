import { applyPatch } from '../modules/patch.js';
import { attachShmotShop } from './shell/overlays/shmot_shop.js';
import { attachShmotPosEditor } from './shell/overlays/shmot_pos_editor.js';

export default class Shmot{
	constructor(mc){
		this.mc  = mc;
		this.win = mc.shmot_win;
		this.currentCat = 0;

		// Категории: 0=Голова 1=Тело 2=Штаны 3=Обувь 4=Аксессуар 5=Татуировки 6=Рука
		// Каждый предмет: {id, cat, name, icon, bonus, bonusKey, bonusVal, price:{type,amount}, owned, equipped}
		this.items = [
			// ── Батч 23.09.2026 (по прямому указанию, "убери все шмотки, которые покупаются за
			// монеты или за тушёнку, короче — все, которые не выбиваются с боссов") — базовый
			// магазин (ids 0-40, покупка за coins/stew/cig) убран ЦЕЛИКОМ. Причина репорта:
			// несколько базовых предметов визуально дублировали дроп-вещи под другим названием и
			// с другой ценой (пример от пользователя: "Панамка белая" ≈ "Панама (Баркут)",
			// "Кепка-оригами" ≈ "Газета (Крыс)", "Панама СССР" ≈ "Панама (Охотник)", "Кепка
			// тактическая" ≈ "Кепка (Меченный)") — а не только байт-в-байт совпадающие файлы,
			// которые уже точечно чинили чуть раньше тем же днём (id52/55/58/64/80, см. историю
			// удалений в комментариях ниже). Простое правило вместо разбора каждого случая
			// отдельно: остаются только предметы с price:null (честный дроп с боссов/казино/
			// тайника). _buy()/shmot.php.buy()/server/json/shmot_items.json НЕ удалены — мёртвый
			// код/данные на случай, если покупные предметы вернутся с новым, не дублирующим артом.
			// ── Дропы с боссов/казино/тайника (Шмот.docx, 18-19.09.2026) ──────────────
			//
			// 19.09.2026 (первый батч — 32 предмета, чьи файлы точно опознаны пользователем
			// по скриншотам докса, см. переписку). ВАЖНО, три сознательных ограничения этого
			// батча, пока не согласовано иначе:
			//
			// 1) price:null — эти вещи НЕ продаются за монеты/тушёнку/сигареты, как обычный
			//    шмот выше. Реального механизма их выдачи (дроп с конкретного босса/казино/
			//    тайника, с учётом "20 частей" у части предметов — гача-сборка по фрагментам)
			//    ЕЩЁ НЕТ — это отдельная, не начатая задача (нужен дроп-рейт, привязка к
			//    конкретному bosses.php.claimKill()/dvor-играм, серверная валидация). До тех
			//    пор owned всегда false, предмет виден в списке (название/бонус/иконка), но
			//    получить его пока неоткуда — это НЕ баг, это незаконченная фича.
			// 2) bk: 'auto_flat'/'gun_flat'/'machete_flat' — НИГДЕ в коде ещё не читаются.
			//    Бонус ("+150 к автомату" и т.п.) показывается как текст, но НЕ прибавляется
			//    к реальному урону в bosses-combat.js._attack() — начисление слишком крупное
			//    (у некоторых вещей бонус сравним с базовым уроном самого оружия), чтобы
			//    включать его без отдельного решения о балансе. См. напоминание пользователю.
			// 3) fragments — для вещей с пометкой "20 частей" в доке (только id41-44, набор
			//    "ссср" обычного режима) хранит целевое число фрагментов; сама механика сборки
			//    по кусочкам ещё не реализована (fragments здесь — только данные на будущее).
			//
			// source/set — для будущего тултипа "откуда падает" и группировки по сетам.
			{id:41, cat:0, name:'Панама (Охотник)',            icon:'🧢', imgFile:'шмот панама ссср охотник.png', cellDx:-3, cellDy:-30, cellScale:0.277,              manDx:1, manDy:12, manWidth:62, manHeight:41, manImgFile:'уменьшено шмот панама ссср охотник.png', bonus:'+40 к автомату',   bk:'auto_flat',     bv:40,  source:'Охотник (обычный режим)',       set:'ссср',        fragments:20,  price:null, owned:false, equipped:false},
			{id:42, cat:1, name:'Футболка (Счастливчик)',      icon:'👕', imgFile:'шмот футболка ссср счастливчик.png', cellDx:-6, cellDy:-32, cellScale:0.122,        manDx:-42, manDy:3, manWidth:183, manHeight:149, manImgFile:'уменьшено шмот футболка ссср счастливчик.png', bonus:'+10 к пистолету',  bk:'gun_flat',      bv:10,  source:'Счастливчик (обычный режим)',   set:'ссср',        fragments:20,  price:null, owned:false, equipped:false},
			{id:43, cat:2, name:'Шорты (Ястреб)',              icon:'🩳', imgFile:'шмот шорты ссср ястреб.png', cellDx:-3, cellDy:-29, cellScale:0.126,                manDx:-22, manDy:20, manWidth:215, manHeight:95, manImgFile:'уменьшено шмот шорты ссср ястреб.png', bonus:'+40 к автомату',   bk:'auto_flat',     bv:40,  source:'Ястреб (обычный режим)',        set:'ссср',        fragments:20,  price:null, owned:false, equipped:false},
			{id:44, cat:3, name:'Кроссовки (Соло Охотник)',    icon:'👟', imgFile:'шмот кроссовки ссср соло охотник.png', cellDx:-4, cellDy:-20, cellScale:0.110,      manDx:3, manDy:7, manWidth:243, manHeight:79, manImgFile:'уменьшено шмот кроссовки ссср соло охотник.png', bonus:'+40 к автомату',   bk:'auto_flat',     bv:40,  source:'Охотник (соло)',                set:'ссср',        fragments:null,price:null, owned:false, equipped:false},
			{id:45, cat:6, name:'Серп (Соло Счастливчик)',     icon:'☪',  imgFile:'шмот серп соло счастливчик.png', cellDx:-5, cellDy:-31, cellScale:0.236,            manDx:-90, manDy:-73, manWidth:159, manHeight:141, manImgFile:'уменьшено шмот серп соло счастливчик.png', bonus:'+10 к мачете',     bk:'machete_flat',  bv:10,  source:'Счастливчик (соло)',            set:'ссср',        fragments:null,price:null, owned:false, equipped:false},
			{id:46, cat:6, name:'Молоток (Соло Ястреб)',       icon:'🔨', imgFile:'шмот молот соло ястреб.png', cellDx:-5, cellDy:-31, cellScale:0.236,                manDx:-67, manDy:-44, manWidth:111, manHeight:91, manImgFile:'уменьшено шмот молот соло ястреб.png', bonus:'+80 к автомату',   bk:'auto_flat',     bv:80,  source:'Ястреб (соло)',                 set:'ссср',        fragments:null,price:null, owned:false, equipped:false},
			// 27.10.2026 (по прямому указанию, живые координаты на манекене магазина для 7
			// предметов из разных сетов — не одного, см. комментарий у id112/113/103 рядом):
			// manDx/manDy пересчитаны вычитанием базы MAN_SLOTS своей категории (cat0 {x:871,
			// y:195}, cat1 {x:804,y:258}, cat2 {x:893,y:358} — shmot_shop.js) из присланных x/y.
			// Кепка (id47): x:874,y:207 → manDx -4→3 (manDy без изменений).
			// Респиратор картёжник (id89): x:868,y:231 → manDx -2→-3 (manDy без изменений).
			// Респиратор спортик2.0 (id90): x:867,y:230 → manDx -3→-4, manDy 36→35.
			{id:47, cat:0, name:'Кепка (Меченный)',            icon:'🧢', imgFile:'шмот кепка вольный.png', cellDx:0, cellDy:-22, cellScale:0.344,                    manDx:3, manDy:12, manWidth:51, manHeight:52, manImgFile:'уменьшено шмот кепка вольный.png', bonus:'+80 к автомату',   bk:'auto_flat',     bv:80,  source:'Меченный (обычный режим)',      set:'вольный',     fragments:null,price:null, owned:false, equipped:false},
			{id:48, cat:1, name:'Футболка (Меченный)',         icon:'👕', imgFile:'шмот футболка вольный меченный.png', cellDx:-2, cellDy:-30, cellScale:0.126,        manDx:-39, manDy:1, manWidth:187, manHeight:144, manImgFile:'уменьшено шмот футболка вольный меченный.png', bonus:'+80 к автомату',   bk:'auto_flat',     bv:80,  source:'Меченный (обычный режим)',      set:'вольный',     fragments:null,price:null, owned:false, equipped:false},
			{id:49, cat:3, name:'Кроссовки (Соло Меченный)',   icon:'👟', imgFile:'шмот кроссовки вольный.png', cellDx:-4, cellDy:-20, cellScale:0.110,                manDx:2, manDy:7, manWidth:235, manHeight:86, manImgFile:'уменьшено шмот кроссовки вольный.png', bonus:'+80 к автомату',   bk:'auto_flat',     bv:80,  source:'Меченный (соло)',               set:'вольный',     fragments:null,price:null, owned:false, equipped:false},
			{id:50, cat:0, name:'Газета (Крыс)',               icon:'📰', imgFile:'шмот газета мастер крыс.png', cellDx:0, cellDy:-28, cellScale:0.222,               manDx:0, manDy:-1, manWidth:90, manHeight:59, manImgFile:'уменьшено шмот газета мастер крыс.png', bonus:'+30 к пистолету',  bk:'gun_flat',      bv:30,  source:'Крыс (обычный режим)',          set:'мастер',      fragments:null,price:null, owned:false, equipped:false},
			{id:51, cat:1, name:'Майка (Крыс)',                icon:'🎽', imgFile:'шмот майка мастер крыс.png', cellDx:0, cellDy:-35, cellScale:0.150,                manDx:7, manDy:-5, manWidth:116, manHeight:146, manImgFile:'уменьшено шмот майка мастер крыс.png', bonus:'+10 к энергии',    bk:'max_e',         bv:10,  source:'Крыс (обычный режим)',          set:'мастер',      fragments:null,price:null, owned:false, equipped:false},
			{id:52, cat:2, name:'Трико (Крыс)',                 icon:'👖', imgFile:'шмот трико мастер крыс.png', cellDx:-4, cellDy:-35, cellScale:0.396,                manDx:-27, manDy:-17, manWidth:285, manHeight:204, manImgFile:'шмот трико мастер крыс.png', bonus:'+120 к автомату',  bk:'auto_flat',     bv:120, source:'Крыс (обычный режим)',          set:'мастер',      fragments:null,price:null, owned:false, equipped:false},
			{id:53, cat:3, name:'Тапочки (Соло Крыс)',         icon:'🩴', imgFile:'шмот тапочки мастер крыс.png', cellDx:-4, cellDy:-20, cellScale:0.110,              manDx:3, manDy:9, manWidth:246, manHeight:81, manImgFile:'уменьшено шмот тапочки мастер крыс.png', bonus:'+180 к автомату',  bk:'auto_flat',     bv:180, source:'Крыс (соло)',                   set:'мастер',      fragments:null,price:null, owned:false, equipped:false},
			{id:54, cat:0, name:'Панама (Баркут)',             icon:'🧢', imgFile:'шмот панама спортик баркут.png', cellDx:-3, cellDy:-27, cellScale:0.267,            manDx:0, manDy:14, manWidth:64, manHeight:48, manImgFile:'уменьшено шмот панама спортик баркут.png', bonus:'+120 к автомату',  bk:'auto_flat',     bv:120, source:'Баркут (обычный режим)',        set:'спортик',     fragments:null,price:null, owned:false, equipped:false},
			{id:55, cat:1, name:'Майка (Баркут)',               icon:'🎽', imgFile:'шмот майка спортик баркут.png', cellDx:0, cellDy:-32, cellScale:0.661,             manDx:1, manDy:4, manWidth:118, manHeight:138, manImgFile:'шмот майка спортик баркут.png', bonus:'+30 к пистолету',  bk:'gun_flat',      bv:30,  source:'Баркут (обычный режим)',        set:'спортик',     fragments:null,price:null, owned:false, equipped:false},
			{id:56, cat:3, name:'Кроссовки (Баркут)',          icon:'👟', imgFile:'шмот кроссовки спортик.png', cellDx:-4, cellDy:-20, cellScale:0.110,                manDx:2, manDy:7, manWidth:235, manHeight:101, manImgFile:'уменьшено шмот кроссовки спортик.png', bonus:'+120 к автомату',  bk:'auto_flat',     bv:120, source:'Баркут (обычный режим)',        set:'спортик',     fragments:null,price:null, owned:false, equipped:false},
			{id:57, cat:6, name:'Сумочка (Соло Баркут)',       icon:'👜', imgFile:'шмот сумочка спортик соло баркут.png', cellDx:-5, cellDy:-35, cellScale:0.203,      manDx:-31, manDy:21, manWidth:71, manHeight:105, manImgFile:'уменьшено шмот сумочка спортик соло баркут.png', bonus:'+50 к пистолету',  bk:'gun_flat',      bv:50,  source:'Баркут (соло)',                 set:'спортик',     fragments:null,price:null, owned:false, equipped:false},
			{id:58, cat:6, name:'Кукла (Соло Борода)',          icon:'🪆', imgFile:'шмот кукла зумер соло борода.png', cellDx:-5, cellDy:-36, cellScale:0.79,          manDx:-10, manDy:30, manWidth:50, manHeight:107, manImgFile:'уменьшено шмот кукла зумер соло борода.png', bonus:'+150 к автомату',  bk:'auto_flat',     bv:150, source:'Борода (соло)',                 set:'зумер',       fragments:null,price:null, owned:false, equipped:false},
			{id:59, cat:6, name:'Мачете (Жгут)',               icon:'🔪', imgFile:'шмот мачете выживший жгут.png', cellDx:-5, cellDy:-31, cellScale:0.224,             manDx:-88, manDy:-54, manWidth:151, manHeight:119, manImgFile:'уменьшено шмот мачете выживший жгут.png', bonus:'+150 к автомату',  bk:'auto_flat',     bv:150, source:'Жгут (обычный режим)',          set:'выживший',    fragments:null,price:null, owned:false, equipped:false},
			{id:60, cat:1, name:'Футболка (Жгут)',             icon:'👕', imgFile:'шмот футболка выживший жгут.png', cellDx:-4, cellDy:-31, cellScale:0.127,           manDx:-42, manDy:2, manWidth:189, manHeight:141, manImgFile:'уменьшено шмот футболка выживший жгут.png', bonus:'+100 к пистолету', bk:'gun_flat',      bv:100, source:'Жгут (обычный режим)',          set:'выживший',    fragments:null,price:null, owned:false, equipped:false},
			{id:61, cat:6, name:'Бита (Соло Жгут)',            icon:'🏏', imgFile:'шмот бита выживший соло жгут.png', cellDx:-5, cellDy:-32, cellScale:0.653,          manDx:-80, manDy:-87, manWidth:123, manHeight:141, manImgFile:'уменьшено шмот бита выживший соло жгут.png', bonus:'+200 к автомату',  bk:'auto_flat',     bv:200, source:'Жгут (соло)',                   set:'выживший',    fragments:null,price:null, owned:false, equipped:false},
			// 27.10.2026 (по прямому указанию, редактор позиций на манекене): x:897,y:408,
			// scale:0.880 — база cat:6 (856,418), см. докблок у id117 ниже про базы MAN_SLOTS.
			{id:62, cat:6, name:'Часы (Покер)',                icon:'⌚', imgFile:'шмот часы игроман покер.png', cellDx:-5, cellDy:-31, cellScale:0.607,               manDx:41, manDy:-10, manWidth:22, manHeight:22, manImgFile:'уменьшено шмот часы игроман покер.png', bonus:'+50 к пистолету',  bk:'gun_flat',      bv:50,  source:'Покер',                         set:'Игроман',     fragments:null,price:null, owned:false, equipped:false},
			{id:63, cat:3, name:'Кроссовки (Покер)',            icon:'👟', imgFile:'шмот кроссовки игроман покер.png', cellDx:-4, cellDy:-20, cellScale:0.110,          manDx:3, manDy:7, manWidth:239, manHeight:83, manImgFile:'уменьшено шмот кроссовки игроман покер.png', bonus:'+50 к пистолету', bk:'gun_flat', bv:50, source:'Покер', set:'Игроман', fragments:null,price:null, owned:false, equipped:false},
			{id:64, cat:0, name:'Бандана (Зарики)',            icon:'🧣', imgFile:'шмот бандана игроман2.0 зарики.png', cellDx:-2, cellDy:-29, cellScale:1.000,        manDx:7, manDy:14, manWidth:57, manHeight:58, manImgFile:'шмот бандана игроман2.0 зарики.png', bonus:'+50 к автомату',   bk:'auto_flat',     bv:50,  source:'Зарики',                        set:'Игроман 2.0', fragments:null,price:null, owned:false, equipped:false},
			{id:65, cat:2, name:'Шорты (Зарики)',              icon:'🩳', imgFile:'шмот шорты игроман2.0.png', cellDx:0, cellDy:-2, cellScale:0.124,                 manDx:-20, manDy:21, manWidth:214, manHeight:164, manImgFile:'уменьшено шмот шорты игроман2.0.png', bonus:'+30 к пистолету',  bk:'gun_flat',      bv:30,  source:'Зарики',                        set:'Игроман 2.0', fragments:null,price:null, owned:false, equipped:false},
			{id:66, cat:3, name:'Кроссовки (Зарики)',          icon:'👟', imgFile:'шмот кроссовки игроман2.0.png', cellDx:-4, cellDy:-20, cellScale:0.110,             manDx:2, manDy:7, manWidth:237, manHeight:90, manImgFile:'уменьшено шмот кроссовки игроман2.0.png', bonus:'+20 к мачете',     bk:'machete_flat',  bv:20,  source:'Зарики',                        set:'Игроман 2.0', fragments:null,price:null, owned:false, equipped:false},
			{id:67, cat:6, name:'Колонка (Блэкджек)',          icon:'🔊', imgFile:'шмот колонка картежник блэкджек.png', cellDx:-5, cellDy:-31, cellScale:0.22,       manDx:-57, manDy:10, manWidth:114, manHeight:92, manImgFile:'уменьшено шмот колонка картежник блэкджек.png', bonus:'+200 к автомату',  bk:'auto_flat',     bv:200, source:'Блэкджек',                      set:'Картежник',   fragments:null,price:null, owned:false, equipped:false},
			{id:68, cat:2, name:'Шорты (Блэкджек)',            icon:'🩳', imgFile:'шмот шорты картежник блэкджек.png', cellDx:1, cellDy:-60, cellScale:0.091,         manDx:-25, manDy:-147, manWidth:295, manHeight:261, manImgFile:'уменьшено шмот шорты картежник блэкджек.png', bonus:'+150 к автомату',  bk:'auto_flat',     bv:150, source:'Блэкджек',                      set:'Картежник',   fragments:null,price:null, owned:false, equipped:false},
			{id:69, cat:3, name:'Ботинки (Тайник)',            icon:'👢', imgFile:'шмот ботинки сталкер тайник.png', cellDx:-4, cellDy:-20, cellScale:0.110,           manDx:4, manDy:7, manWidth:246, manHeight:95, manImgFile:'уменьшено шмот ботинки сталкер тайник.png',  bonus:'+50 к автомату',   bk:'auto_flat',     bv:50,  source:'Потерянный тайник',             set:'сталкер',     fragments:null,price:null, owned:false, equipped:false},
			{id:70, cat:1, name:'Футболка (Спортик 2.0)',      icon:'👕', imgFile:'шмот футболка спортик2.0.png', cellDx:-5, cellDy:-25, cellScale:0.120,              manDx:-63, manDy:1, manWidth:229, manHeight:140, manImgFile:'уменьшено шмот футболка спортик2.0.png', bonus:'+70 к автомату',   bk:'auto_flat',     bv:70,  source:'Потерянный тайник',             set:'спортик 2.0', fragments:null,price:null, owned:false, equipped:false},
			{id:71, cat:3, name:'Кроссовки (Спортик 2.0)',     icon:'👟', imgFile:'шмот кроссовки спортик2.0.png', cellDx:-4, cellDy:-20, cellScale:0.110,             manDx:4, manDy:7, manWidth:251, manHeight:99, manImgFile:'уменьшено шмот кроссовки спортик2.0.png',  bonus:'+10 к мачете',     bk:'machete_flat',  bv:10,  source:'Потерянный тайник',             set:'спортик 2.0', fragments:null,price:null, owned:false, equipped:false},
			{id:72, cat:3, name:'Кроссовки (Тинейджер)',       icon:'👟', imgFile:'шмот кроссовки тинейджер.png', cellDx:-4, cellDy:-20, cellScale:0.110,              manDx:2, manDy:9, manWidth:250, manHeight:98, manImgFile:'уменьшено шмот кроссовки тинейджер.png', bonus:'+50 к энергии',    bk:'max_e',         bv:50,  source:'Потерянный тайник',             set:'тинейджер',   fragments:null,price:null, owned:false, equipped:false},

			// ── Второй батч дропов (19.09.2026, по прямому указанию — полная спецификация всех
			// сетов прислана скриншотами) — дополняет сеты, у которых раньше не хватало вещей
			// (вольный/спортик — недостающие штаны; зумер/Игроман/Игроман 2.0/сталкер/
			// спортик 2.0/тинейджер — почти все вещи). Три вещи ("Респиратор" у Картежника и
			// Спортик 2.0, "Электрошокер" у Спортик 2.0, "Цепь" у Тинейджера) в этот батч НЕ
			// вошли — по ним пока нет присланных картинок, добавить отдельно, когда появятся.
			{id:73, cat:2, name:'Шорты (Меченный)',            icon:'🩳', imgFile:'шмот шорты вольный меченный.png', cellDx:-4, cellDy:-40, cellScale:0.125,           manDx:-25, manDy:-27, manWidth:237, manHeight:134, manImgFile:'уменьшено шмот шорты вольный меченный.png', bonus:'+20 к пистолету',  bk:'gun_flat',      bv:20,  source:'Меченный (обычный режим)',      set:'вольный',     fragments:null,price:null, owned:false, equipped:false},
			{id:74, cat:2, name:'Шорты (Баркут)',              icon:'🩳', imgFile:'шмот шорты спортик баркут.png', cellDx:-4, cellDy:-30, cellScale:0.131,             manDx:-28, manDy:4, manWidth:217, manHeight:107, manImgFile:'уменьшено шмот шорты спортик баркут.png', bonus:'+20 к мачете',     bk:'machete_flat',  bv:20,  source:'Баркут (обычный режим)',        set:'спортик',     fragments:null,price:null, owned:false, equipped:false},
			{id:77, cat:3, name:'Кроссовки (Борода)',          icon:'👟', imgFile:'шмот кроссовки зумер борода.png', cellDx:-4, cellDy:-20, cellScale:0.110,           manDx:2, manDy:10, manWidth:247, manHeight:97, manImgFile:'уменьшено шмот кроссовки зумер борода.png', bonus:'+30 к мачете',     bk:'machete_flat',  bv:30,  source:'Борода (обычный режим)',        set:'зумер',       fragments:null,price:null, owned:false, equipped:false},
			{id:75, cat:1, name:'Футболка (Борода)',            icon:'👕', imgFile:'шмот футболка зумер борода.png', cellDx:-5, cellDy:-32, cellScale:0.125,            manDx:-54, manDy:5, manWidth:203, manHeight:140, manImgFile:'уменьшено шмот футболка зумер борода.png', bonus:'+120 к автомату',  bk:'auto_flat',     bv:120, source:'Борода (обычный режим)',        set:'зумер',       fragments:null,price:null, owned:false, equipped:false},
			{id:76, cat:2, name:'Шорты (Борода)',              icon:'🩳', imgFile:'шмот шорты зумер борода.png', cellDx:-4, cellDy:-30, cellScale:0.131,               manDx:-24, manDy:9, manWidth:233, manHeight:107, manImgFile:'уменьшено шмот шорты зумер борода.png', bonus:'+120 к автомату',  bk:'auto_flat',     bv:120, source:'Борода (обычный режим)',        set:'зумер',       fragments:null,price:null, owned:false, equipped:false},
			{id:78, cat:0, name:'Панама (Покер)',              icon:'🧢', imgFile:'шмот панама игроман покер.png', cellDx:-9, cellDy:-30, cellScale:0.212,             manDx:-6, manDy:9, manWidth:86, manHeight:55, manImgFile:'уменьшено шмот панама игроман покер.png', bonus:'+100 к автомату',  bk:'auto_flat',     bv:100, source:'Покер',                         set:'Игроман',     fragments:null,price:null, owned:false, equipped:false},
			{id:79, cat:2, name:'Шорты (Покер)',               icon:'🩳', imgFile:'шмот шорты игроман покер.png', cellDx:3, cellDy:-43, cellScale:0.122,              manDx:-15, manDy:-105, manWidth:267, manHeight:286, manImgFile:'уменьшено шмот шорты игроман покер.png', bonus:'+100 к автомату',  bk:'auto_flat',     bv:100, source:'Покер',                         set:'Игроман',     fragments:null,price:null, owned:false, equipped:false},
			// 27.10.2026 (баг найден по прямому указанию — "дубинка на персонаже микроскопическая"):
			// manDx/manDy вообще не были заданы (0,0 по умолчанию), manScale:1.000 — "уменьшено"
			// файл всего 44×40px (оригинал 133×121, ужат заранее ~в 3 раза для гардероба), при
			// scale:1.000 рендерился буквально 44×40px. Редактор позиций на манекене: x:784,y:349,
			// w:127,h:115 → manDx:-72,manDy:-69 (база cat:6 856,418), manScale≈127/44≈2.886
			// (115/40≈2.875, среднее 2.880).
			{id:80, cat:6, name:'Дубинка (Зарики)',            icon:'🪄', imgFile:'шмот дубинка игроман2.0 зарики.png', cellDx:-5, cellDy:-33, cellScale:0.702,        manDx:-72, manDy:-69, manWidth:133, manHeight:121, manImgFile:'уменьшено шмот дубинка игроман2.0 зарики.png', bonus:'+50 к автомату',   bk:'auto_flat',     bv:50,  source:'Зарики',                        set:'Игроман 2.0', fragments:null,price:null, owned:false, equipped:false},
			{id:81, cat:0, name:'Повязка (Тайник)',            icon:'🩹', imgFile:'шмот повязка сталкер тайник.png', cellDx:0, cellDy:-30, cellScale:0.353,           manDx:3, manDy:22, manWidth:48, manHeight:20, manImgFile:'уменьшено шмот повязка сталкер тайник.png', bonus:'+20 к энергии',    bk:'max_e',         bv:20,  source:'Потерянный тайник',             set:'сталкер',     fragments:null,price:null, owned:false, equipped:false},
			{id:82, cat:1, name:'Жилетка (Тайник)',            icon:'🦺', imgFile:'шмот жилетка сталкер тайник.png', cellDx:-4, cellDy:-34, cellScale:0.134,           manDx:-8, manDy:-1, manWidth:122, manHeight:140, manImgFile:'уменьшено шмот жилетка сталкер тайник.png', bonus:'+25 к пистолету',  bk:'gun_flat',      bv:25,  source:'Потерянный тайник',             set:'сталкер',     fragments:null,price:null, owned:false, equipped:false},
			{id:83, cat:2, name:'Шорты (Тайник)',              icon:'🩳', imgFile:'шмот шорты сталкер тайник.png', cellDx:-5, cellDy:-29, cellScale:0.114,             manDx:-29, manDy:10, manWidth:259, manHeight:110, manImgFile:'уменьшено шмот шорты сталкер тайник.png', bonus:'+15 к мачете',     bk:'machete_flat',  bv:15,  source:'Потерянный тайник',             set:'сталкер',     fragments:null,price:null, owned:false, equipped:false},
			// 22.09.2026 (по прямому указанию, финальная сверка сетов): предмет назывался
			// "Булава" — правильное имя "Труба" (тот же файл картинки, только название).
			{id:84, cat:6, name:'Труба (Тайник)',              icon:'🔨', imgFile:'шмот булава сталкер тайник.png', cellDx:-7, cellDy:-24, cellScale:0.213,            manDx:-98, manDy:-62, manWidth:165, manHeight:157, manImgFile:'уменьшено шмот булава сталкер тайник.png', bonus:'+70 к автомату',   bk:'auto_flat',     bv:70,  source:'Потерянный тайник',             set:'сталкер',     fragments:null,price:null, owned:false, equipped:false},
			{id:85, cat:2, name:'Шорты (Спортик 2.0)',         icon:'🩳', imgFile:'шмот шорты спортик2.0.png', cellDx:-4, cellDy:-30, cellScale:0.126,                 manDx:-27, manDy:18, manWidth:227, manHeight:112, manImgFile:'уменьшено шмот шорты спортик2.0.png', bonus:'+20 к пистолету',  bk:'gun_flat',      bv:20,  source:'Потерянный тайник',             set:'спортик 2.0', fragments:null,price:null, owned:false, equipped:false},
			{id:86, cat:0, name:'Панама (Тинейджер)',          icon:'🧢', imgFile:'шмот панама тинейджер.png', cellDx:-12, cellDy:-30, cellScale:0.260,                 manDx:-6, manDy:15, manWidth:137, manHeight:57, manImgFile:'уменьшено шмот панама тинейджер.png', bonus:'+100 к автомату',  bk:'auto_flat',     bv:100, source:'Потерянный тайник',             set:'тинейджер',   fragments:null,price:null, owned:false, equipped:false},
			{id:87, cat:1, name:'Футболка (Тинейджер)',        icon:'👕', imgFile:'шмот футболка тинейджер.png', cellDx:-12, cellDy:-34, cellScale:0.116,               manDx:-91, manDy:-6, manWidth:249, manHeight:163, manImgFile:'уменьшено шмот футболка тинейджер.png', bonus:'+150 к автомату',  bk:'auto_flat',     bv:150, source:'Потерянный тайник',             set:'тинейджер',   fragments:null,price:null, owned:false, equipped:false},
			{id:88, cat:2, name:'Шорты (Тинейджер)',           icon:'🩳', imgFile:'шмот шорты тинейджер.png', cellDx:-4, cellDy:-30, cellScale:0.094,                  manDx:-26, manDy:19, manWidth:288, manHeight:118, manImgFile:'уменьшено шмот шорты тинейджер.png',  bonus:'+150 к автомату',  bk:'auto_flat',     bv:150, source:'Потерянный тайник',             set:'тинейджер',   fragments:null,price:null, owned:false, equipped:false},

			// ── Батч 20.09.2026 — коррекция сета Картежник + предметы, для которых раньше
			// не было арта (респиратор Спортик2.0, электрошокер Спортик2.0, цепь Тинейджера) —
			// бонусы по ТЗ (см. комментарий у "деликатно НЕ добавлены" выше).
			// "Респиратор с медальоном (Блэкджек)" — изначально было 2 отдельных файла
			// (медальон + респиратор), пользователь свёл их в одну картинку — один предмет.
			{id:89, cat:0, name:'Респиратор с медальоном (Блэкджек)', icon:'😷', imgFile:'шмот респиратор картежник блэкджек.png', cellDx:0, cellDy:-33, cellScale:0.228, manDx:-3, manDy:36, manWidth:62, manHeight:92, manImgFile:'уменьшено шмот респиратор картежник блэкджек.png', bonus:'+100 к автомату',  bk:'auto_flat',     bv:100, source:'Блэкджек',                      set:'Картежник',   fragments:null,price:null, owned:false, equipped:false},
			{id:90, cat:0, name:'Респиратор (Спортик 2.0)',    icon:'😷', imgFile:'шмот респиратор спортик2.0.png', cellDx:-3, cellDy:-30, cellScale:0.278,            manDx:-4, manDy:35, manWidth:63, manHeight:53, manImgFile:'уменьшено шмот респиратор спортик2.0.png', bonus:'+50 к автомату',   bk:'auto_flat',     bv:50,  source:'Потерянный тайник',             set:'спортик 2.0', fragments:null,price:null, owned:false, equipped:false},
			{id:91, cat:6, name:'Электрошокер (Спортик 2.0)',  icon:'⚡', imgFile:'шмот шокер спортик2.0.png', cellDx:-4, cellDy:-32, cellScale:0.211,                 manDx:-96, manDy:-96, manWidth:171, manHeight:178, manImgFile:'уменьшено шмот шокер спортик2.0.png', bonus:'+90 к автомату',   bk:'auto_flat',     bv:90,  source:'Потерянный тайник',             set:'спортик 2.0', fragments:null,price:null, owned:false, equipped:false},
			// 27.10.2026 (по прямому указанию, редактор позиций на манекене): x:893,y:406,
			// scale:0.842 — база cat:6 (856,418).
			{id:92, cat:6, name:'Цепь (Тинейджер)',            icon:'⛓️', imgFile:'шмот цепь тинейджер.png', cellDx:-5, cellDy:-24, cellScale:0.411,                   manDx:37, manDy:-12, manWidth:32, manHeight:53, manImgFile:'уменьшено шмот цепь тинейджер.png', bonus:'+100 к автомату',  bk:'auto_flat',     bv:100, source:'Потерянный тайник',             set:'тинейджер',   fragments:null,price:null, owned:false, equipped:false},
			// 22.09.2026 (по прямому указанию, финальная сверка): "Кроссовки (Блэкджек)" id93
			// убраны — в полном присланном списке у сета "Картежник" ровно 3 предмета (Колонка/
			// Респиратор с медальоном/Шорты), 4-я вещь была добавлена раньше без подтверждения
			// по ТЗ и не входит в канон. Картинка на диске осталась нетронутой, просто не используется.

			// Батч 21.09.2026 — пересборка каталога шмоток из C:\Users\HONOR\Desktop\vk_game\шмотки\_organized
			// (по прямому указанию, "я доверяю"). Новый сет "новопришедший" — файлы уже были на
			// проде (images/shmot/шмот обувь новопришедший.png, шмот футболка новопришедший.png),
			// просто не имели записи в каталоге.
			//
			// 22.09.2026 (по прямому указанию, финальная сверка всех сетов): "новопришедший" —
			// это "Дефолтный шмот" (заголовок в присланном списке отдельно ото всех остальных
			// "Сет с X" разделов) — бонусы уточнены (было +60/+60 гадательно, правильно +20/+4).
			// Плюс третий предмет сета — "Шорты +5 к пистолету" — картинки для него пока нет
			// НИ в развёрнутых images/shmot/, НИ в исходной папке _organized (проверено), не
			// добавлен, ждём арт. ВАЖНО: раз это "дефолтный" шмот (в отличие от всех остальных
			// сетов, которые явно "выпадают" с конкретного босса/казино) — возможно, имеется в
			// виду, что он должен выдаваться новым игрокам АВТОМАТИЧЕСКИ (owned/equipped=true
			// с самого начала), а не через тот же нереализованный "дроп" механизм, что у
			// остальных id41+. Сейчас он ведёт себя как ЛЮБОЙ другой предмет этого блока —
			// price:null, owned:false, без реального пути получения. Не стал молча менять на
			// автовыдачу (это отдельная, более крупная правка — новым И существующим аккаунтам),
			// см. итоговый отчёт в чате.
			{id:94, cat:3, name:'Кроссовки (Новопришедший)',   icon:'👟', imgFile:'шмот обувь новопришедший.png', cellDx:-4, cellDy:-20, cellScale:0.110,              manDx:3, manDy:7, manWidth:239, manHeight:86, manImgFile:'уменьшено шмот обувь новопришедший.png',  bonus:'+20 к автомату',   bk:'auto_flat',     bv:20,  source:'Магазин (сухари)',            set:'новопришедший',fragments:null,price:{type:'cig',a:150}, owned:false, equipped:false},
			{id:95, cat:1, name:'Футболка (Новопришедший)',    icon:'👕', imgFile:'шмот футболка новопришедший.png', cellDx:-5, cellDy:-32, cellScale:0.143,           manDx:-47, manDy:1, manWidth:194, manHeight:140, manImgFile:'уменьшено шмот футболка новопришедший.png', bonus:'+4 к мачете',      bk:'machete_flat',  bv:4,   source:'Магазин (сухари)',            set:'новопришедший',fragments:null,price:{type:'cig',a:200}, owned:false, equipped:false},
			{id:96, cat:0, name:'Панама (Борода)',             icon:'🧢', imgFile:'шмот панама зумер борода.png', cellDx:-5, cellDy:-30, cellScale:0.263,              manDx:1, manDy:14, manWidth:67, manHeight:52, manImgFile:'уменьшено шмот панама зумер борода.png', bonus:'+40 к пистолету',  bk:'gun_flat',      bv:40,  source:'Борода (обычный режим)',        set:'зумер',       fragments:null,price:null, owned:false, equipped:false},
			{id:97, cat:2, name:'Шорты (Новопришедший)',       icon:'🩳', imgFile:'шмот шорты новопришедший.png', cellDx:2, cellDy:-30, cellScale:0.128,              manDx:-17, manDy:-2, manWidth:253, manHeight:125, manImgFile:'уменьшено шмот шорты новопришедший.png', bonus:'+5 к пистолету',   bk:'gun_flat',      bv:5,   source:'Магазин (сухари)',            set:'новопришедший',fragments:null,price:{type:'cig',a:100}, owned:false, equipped:false},
			{id:98, cat:1, name:'Футболка (Покер)',            icon:'👕', imgFile:'шмот футболка игроман покер.png', cellDx:-12, cellDy:-30, cellScale:0.143,           manDx:-67, manDy:0, manWidth:214, manHeight:148, manImgFile:'уменьшено шмот футболка игроман покер.png', bonus:'+100 к пистолету', bk:'gun_flat',      bv:100, source:'Покер',                         set:'Игроман',     fragments:null,price:null, owned:false, equipped:false},
			{id:99, cat:1, name:'Футболка (Зарики)',           icon:'👕', imgFile:'шмот футболка игроман2.0.png', cellDx:-5, cellDy:-37, cellScale:0.138,              manDx:-72, manDy:-18, manWidth:246, manHeight:163, manImgFile:'уменьшено шмот футболка игроман2.0.png', bonus:'+40 к автомату',   bk:'auto_flat',     bv:40,  source:'Зарики',                        set:'Игроман 2.0', fragments:null,price:null, owned:false, equipped:false},

			// Координаты в ячейке: 73×751 при масштабе .239; на манекене: 848×448
			// при масштабе .138 в экране «Шмотки».
			// manDx/manDy — смещения от общего слота руки (856×418), поэтому во всех
			// остальных экранах предмет сохраняет ту же посадку относительно персонажа.
			// 30.09.2026 (третий заход в тот же день): ?cb=2/?cb=3 не помогли — диагностика прямо
			// на экране показала, что загруженная текстура (1254×1254) не совпадала НИ С ОДНИМ
			// файлом в проекте, хотя сервер честно отдавал верный файл с no-cache. Кэш живёт
			// между сервером и игрой, вне нашего контроля (похоже на прокси/CDN самого ВК для
			// мини-приложений) и, судя по всему, игнорирует смену query-параметра. Единственный
			// надёжный способ — сменить сам ПУТЬ файла: переименовано в "связка ключей v2.png".
			// Ячейка: 72×750, масштаб .239; персонаж: 843×448, масштаб .170.
			{id:100, cat:6, name:'Связка ключей', icon:'🗝', imgFile:'связка ключей v2.png', cellDx:-10, cellDy:-26, cellScale:0.239, manDx:-13, manDy:30, manWidth:48, manHeight:71, manImgFile:'уменьшено связка ключей v2.png', bonus:'Атака любого босса без использования ключей', bk:null, bv:null, source:'Рулетка (мини-игра)', set:null, fragments:null, price:null, owned:false, equipped:false},

			// ── Батч 21.10.2026 (по прямому указанию) — 3 новых сета по 5 предметов (id101-115),
			// manDx/manDy — КОПИЯ эталонного предмета, названного пользователем (та же логика,
			// что уже используется для других сетов): голова — id86 "Панама (Тинейджер)", торс —
			// id48 "Футболка (Меченный)", штаны — id52 "Трико (Крыс)", обувь — id69 "Ботинки
			// (Тайник)", рука — id91 "Электрошокер (Спортик 2.0)". ⚠️ manScale НЕ скопирован
			// 1-в-1 — это ошибка (manScale зависит от нативного разрешения конкретного файла, а
			// не является стилевой константой): у новых файлов разрешение другое, чем у
			// эталонов, поэтому manScale пересчитан так, чтобы РЕЗУЛЬТИРУЮЩИЙ видимый размер на
			// персонаже совпадал с эталоном (native_height_эталона × manScale_эталона =
			// целевая_высота; manScale_нового = целевая_высота / native_height_нового), с учётом
			// общего правила "огромный файл (≥1000px) — manScale ≤0.23" (см.
			// shmot-huge-images-scaled-down-and-head-positions.test.js) и правила "торс = 140px"
			// (см. shmot-torso-height-140-poker-open-button-weapon-modified-damage.test.js) —
			// для cat:1 целевая высота взята строго 140px, не фактическая высота эталона id48
			// (143.86px, сам является исторически неточным исключением). manDx/manDy при этом
			// НЕ пересчитаны под новые пропорции — первая прикидка, как и для всех новых
			// ассетов этого батча (требует подтверждения через редактор позиций).
			// 22.10.2026 (по прямому указанию, редактор позиций на манекене магазина):
			// id105/id110/id115 (Сайга/Пистолет/Кружка, cat:6) — manDx/manDy/manScale и
			// cellScale подтверждены/пересняты через живой редактор позиций, больше не
			// прикидка. manDx/manDy у остальных 12 новых предметов (id101-104,106-109,
			// 111-114) по-прежнему первая прикидка — ждут той же сверки.
			// fragments:40 — та же "данные на будущее" семантика, что у id41-44
			// (механика сборки по кусочкам ещё не реализована, см. докблок в начале файла).
			// handBuiltIn:true — у Сайги/Пистолета/Кружки кисть персонажа УЖЕ нарисована внутри
			// файла предмета (проверено визуально) — на экранах персонажа (home.js/shmot_shop.js/
			// player_profile.js/hata.js) для таких предметов кисть-спрайт скрывается целиком,
			// остаётся только предплечье (см. ПЕРЕИМЕНОВАНИЕ_АССЕТОВ_21_10_2026.md про замену
			// системы руки на предплечье+кисть).
			//
			// Сет "Бродяга" — рюкзак Сидоровича.
			{id:101, cat:0, name:'Ушанка (Бродяга)',  icon:'🧢', imgFile:'шмот ушанка бродяга.png', cellDx:-12, cellDy:-30, cellScale:0.260, manDx:-5, manDy:7, manWidth:134, manHeight:108, manImgFile:'уменьшено шмот ушанка бродяга.png', bonus:'+60 к автомату',  bk:'auto_flat',    bv:60, source:'Рюкзак Сидоровича', set:'бродяга', fragments:40, price:null, owned:false, equipped:false},
			{id:102, cat:1, name:'Куртка (Бродяга)',  icon:'🧥', imgFile:'шмот куртка бродяга.png', cellDx:-2, cellDy:-33, cellScale:0.114, manDx:-70, manDy:-27, manWidth:232, manHeight:212, manImgFile:'уменьшено шмот куртка бродяга.png', bonus:'+60 к автомату',  bk:'auto_flat',    bv:60, source:'Рюкзак Сидоровича', set:'бродяга', fragments:40, price:null, owned:false, equipped:false},
			{id:103, cat:2, name:'Штаны (Бродяга)',   icon:'👖', imgFile:'шмот штаны бродяга.png', cellDx:-6, cellDy:-50, cellWidth:128, cellHeight:86, manDx:-28, manDy:21, manWidth:306, manHeight:139, manImgFile:'уменьшено шмот штаны бродяга.png', bonus:'+12 к мачете', bk:'machete_flat', bv:12, source:'Рюкзак Сидоровича', set:'бродяга', fragments:40, price:null, owned:false, equipped:false},
			{id:104, cat:3, name:'Обувь (Бродяга)',   icon:'👢', imgFile:'шмот обувь бродяга.png', cellDx:-4, cellDy:-20, cellScale:0.110, manDx:4, manDy:14, manWidth:246, manHeight:95, manImgFile:'уменьшено шмот обувь бродяга.png', bonus:'+16 к мачете', bk:'machete_flat', bv:16, source:'Рюкзак Сидоровича', set:'бродяга', fragments:40, price:null, owned:false, equipped:false},
			{id:105, cat:6, name:'Сайга (Бродяга)',   icon:'🔫', imgFile:'шмот сайга бродяга.png', cellDx:-4, cellDy:-32, cellScale:0.140, manDx:-108, manDy:3, manWidth:162, manHeight:178, manImgFile:'уменьшено шмот сайга бродяга.png', bonus:'+20 к пистолету', bk:'gun_flat', bv:20, source:'Рюкзак Сидоровича', set:'бродяга', fragments:40, price:null, owned:false, equipped:false, handBuiltIn:true},

			// Сет "Ветеран" — сумка за спички покер.
			{id:106, cat:0, name:'Шапка (Ветеран)',   icon:'🧢', imgFile:'шмот шапка ветеран.png', cellDx:-12, cellDy:-30, cellScale:0.260, manDx:1, manDy:11, manWidth:69, manHeight:42, manImgFile:'уменьшено шмот шапка ветеран.png', bonus:'+60 к автомату',  bk:'auto_flat',    bv:60, source:'Сумка (спички покер)', set:'ветеран', fragments:40, price:null, owned:false, equipped:false},
			{id:107, cat:1, name:'Куртка (Ветеран)',  icon:'🧥', imgFile:'шмот куртка ветеран.png', cellDx:-2, cellDy:-33, cellScale:0.114, manDx:-70, manDy:-27, manWidth:232, manHeight:212, manImgFile:'уменьшено шмот куртка ветеран.png', bonus:'+16 к мачете', bk:'machete_flat', bv:16, source:'Сумка (спички покер)', set:'ветеран', fragments:40, price:null, owned:false, equipped:false},
			{id:108, cat:2, name:'Штаны (Ветеран)',   icon:'👖', imgFile:'шмот штаны ветеран.png', cellDx:-4, cellDy:-36, cellScale:0.097, manDx:-27, manDy:-17, manWidth:300, manHeight:202, manImgFile:'уменьшено шмот штаны ветеран.png', bonus:'+80 к автомату', bk:'auto_flat', bv:80, source:'Сумка (спички покер)', set:'ветеран', fragments:40, price:null, owned:false, equipped:false},
			{id:109, cat:3, name:'Обувь (Ветеран)',   icon:'👢', imgFile:'шмот обувь ветеран.png', cellDx:-4, cellDy:-20, cellScale:0.110, manDx:4, manDy:14, manWidth:246, manHeight:95, manImgFile:'уменьшено шмот обувь ветеран.png', bonus:'+30 к энергии', bk:'max_e', bv:30, source:'Сумка (спички покер)', set:'ветеран', fragments:40, price:null, owned:false, equipped:false},
			{id:110, cat:6, name:'Пистолет (Ветеран)',icon:'🔫', imgFile:'шмот пистолет ветеран.png', cellDx:-4, cellDy:-32, cellScale:0.270, manDx:-37, manDy:4, manWidth:87, manHeight:65, manImgFile:'уменьшено шмот пистолет ветеран.png', bonus:'+20 к пистолету', bk:'gun_flat', bv:20, source:'Сумка (спички покер)', set:'ветеран', fragments:40, price:null, owned:false, equipped:false, handBuiltIn:true},

			// Сет "Следопыт" — сумка с рулетки. ⚠️ Кружка в присланном описании — единственный
			// предмет БЕЗ указанного "40 частей" (все остальные 14 предметов — явно 40) —
			// предположительно опечатка/пропуск в сообщении, применено fragments:40 по аналогии
			// с остальными 4 предметами того же сета. Если это неверно — поправить одной цифрой.
			// 22.10.2026 (по прямому указанию — эксперимент "одну шмотку не делать ей scale, а
			// поставить значения ширины и высоты"): id111 единственный предмет в каталоге с
			// manWidth/manHeight вместо manScale — явный пиксельный размер вместо множителя.
			// См. поддержку этого поля в home.js/hata.js/player_profile.js/shmot_shop.js
			// (if(eq.manWidth && eq.manHeight) ветка рядом с spr.scale.set(eq.manScale||1)).
			{id:111, cat:0, name:'Панама (Следопыт)', icon:'🧢', imgFile:'шмот панама следопыт.png', cellDx:-12, cellDy:-30, cellScale:0.260, manDx:-5, manDy:15, manWidth:80, manHeight:66, manImgFile:'уменьшено шмот панама следопыт.png', bonus:'+20 к автомату', bk:'auto_flat', bv:20, source:'Сумка (рулетка)', set:'следопыт', fragments:40, price:null, owned:false, equipped:false},
			{id:112, cat:1, name:'Куртка (Следопыт)', icon:'🧥', imgFile:'шмот куртка следопыт.png', cellDx:-2, cellDy:-33, cellScale:0.114, manDx:-74, manDy:-23, manWidth:233, manHeight:209, manImgFile:'уменьшено шмот куртка следопыт.png', bonus:'+20 к автомату', bk:'auto_flat', bv:20, source:'Сумка (рулетка)', set:'следопыт', fragments:40, price:null, owned:false, equipped:false},
			{id:113, cat:2, name:'Штаны (Следопыт)',  icon:'👖', imgFile:'шмот штаны следопыт.png', cellDx:-6, cellDy:-50, cellWidth:129, cellHeight:86, manDx:-29, manDy:21, manWidth:306, manHeight:137, manImgFile:'уменьшено шмот штаны следопыт.png', bonus:'+30 к энергии', bk:'max_e', bv:30, source:'Сумка (рулетка)', set:'следопыт', fragments:40, price:null, owned:false, equipped:false},
			{id:114, cat:3, name:'Обувь (Следопыт)',  icon:'👢', imgFile:'шмот обувь следопыт.png', cellDx:-4, cellDy:-20, cellScale:0.110, manDx:4, manDy:7, manWidth:257, manHeight:94, manImgFile:'уменьшено шмот обувь следопыт.png', bonus:'+10 к пистолету', bk:'gun_flat', bv:10, source:'Сумка (рулетка)', set:'следопыт', fragments:40, price:null, owned:false, equipped:false},
			{id:115, cat:6, name:'Кружка (Следопыт)', icon:'☕', imgFile:'шмот кружка следопыт.png', cellDx:-4, cellDy:-32, cellScale:0.211, manDx:-36, manDy:0, manWidth:82, manHeight:88, manImgFile:'уменьшено шмот кружка следопыт.png', bonus:'+20 к автомату', bk:'auto_flat', bv:20, source:'Сумка (рулетка)', set:'следопыт', fragments:40, price:null, owned:false, equipped:false, handBuiltIn:true},

			// 25.10.2026 (по прямому указанию) — сет "Исполнитель", приз за полное выполнение
			// Разнарядки за месяц (reward_tiers need:-1 в raznaryadka_config.json, shmot_source:
			// 'raznaryadka' — см. RaznaryadkaProgress::grantTier()). Один случайный предмет из
			// этих 4 за каждый полный месяц, уже выпавшие не повторяются (см.
			// Gameops::grantShmotFromSource() — та же логика пула, что у остальных source-сетов).
			// 26.10.2026 (по прямому указанию, редактор позиций на манекене магазина — x/y/scale
			// сняты вживую, переведены в manDx/manDy вычитанием базы слота MAN_SLOTS из
			// shmot_shop.js: cat:1 база {x:804,y:258}, cat:6 база {x:856,y:418}; cellDx/cellDy —
			// вычитанием формулы cx+77/cy+98 при col/row этого предмета в сетке гардероба,
			// см. GRID в shmot_shop.js): id117 (Бита) и id119 (Худи коричневая) откалиброваны
			// по присланным значениям (сверено — naturalW/H файла × scale совпадает с
			// присланными w/h с точностью до округления). id118 (Худи белая) сначала (тем же
			// днём, до прихода реальных координат) скопирован 1-в-1 с id119, затем переписан
			// своими живыми координатами манекена (та же сверка naturalW/H×scale сошлась) —
			// cellDx/cellDy гардероба отдельно не присылали, оставлены скопированными с id119
			// (тот же силуэт вещи, другой только цвет). id116 (Маска) координат пока не
			// прислано — остаётся на прежней прикидке, требует калибровки.
			// 26.10.2026 (по прямому указанию) — id117 (Бита) получила новый файл-арт
			// (772×634, раньше был 509×513 — другие пропорции). Сначала (до прихода реальных
			// координат) manScale был временно пересчитан коэффициентом ширины (≈0.140), затем
			// в тот же день переписан живыми координатами с редактора позиций манекена
			// (x:745,y:358,scale:0.210 → manDx:-111,manDy:-60,manScale:0.210 — сверено,
			// naturalW/H нового файла × 0.210 совпадает с присланными w:162,h:133).
			// 26.10.2026 (по прямому указанию — "маска должна выпадать не из ежедневных заданий,
			// а из игры 2048"): source переключён с раздачи "Разнарядка"/ежедневные задания
			// (пул id117-119 ниже) на крафт за 90 фрагментов в игре "2048" (см.
			// server/core/controllers/game2048.php.craft(), server/json/shmot_items.json id116
			// source:"game2048" — единственный предмет с этим source, поэтому
			// grantShmotFromSource('game2048') выдаёт детерминированно именно его).
			// 26.10.2026 (повторное уточнение тем же днём — "маска не из сета Исполнитель, а из
			// сета Комбинатор, +40 к автоматам"): set/name/bonus/bv переписаны под новый сет —
			// маска теперь единственный известный предмет сета "комбинатор" (остальные предметы
			// сета не присланы). imgFile НЕ переименован (историческое имя файла с "исполнитель"
			// в названии) — переименование самого файла не запрашивалось, визуально не влияет.
			{id:116, cat:0, name:'Маска (Комбинатор)',          icon:'💀', imgFile:'шмот маска исполнитель разнарядка.png', cellDx:-3, cellDy:-30, cellScale:0.260, manDx:0, manDy:12, manWidth:63, manHeight:78, manImgFile:'уменьшено шмот маска исполнитель разнарядка.png', bonus:'+8 к мачете',  bk:'machete_flat',     bv:8, source:'Игра «2048» (крафт 90 фрагментов)', set:'комбинатор', fragments:null, price:null, owned:false, equipped:false},
			// Бита уже нарисована С зажатой в ней кистью (видно на самом арте) — handBuiltIn:true
			// отключает наложение отдельного файла кисти/фаланг поверх (та же логика, что у
			// Сайги/Пистолета/Кружки сетов Бродяга/Ветеран/Следопыт, см. их записи выше).
			// 27.10.2026 (по прямому указанию — репозиция иконки в гардеробе, НЕ на персонаже):
			// "поверни по часовой стрелке на 10°, scale 0.185, сдвинь на 10px вниз и 4px влево"
			// — относительно прежних cellDx:-5,cellDy:-32,cellScale:0.230. cellRot — новое поле
			// (градусы по часовой стрелке), раньше у иконок гардероба вращения не было вообще,
			// см. поддержку в shmot_shop.js.
			// 27.10.2026 (баг найден по прямому указанию — "Бита должна давать +40 к автомату, а
			// даёт 250"): bv/bonus исправлены на 40 — и клиентский каталог (ниже), и серверный
			// server/json/shmot_items.json (реальный источник истины для боевого урона) были
			// СОГЛАСОВАННЫ на неверном значении 250 — это не рассинхрон клиент/сервер, а просто
			// неверное число, введённое изначально. Заодно переименован сет "Исполнитель" →
			// "Исполнительный" (по прямому указанию) — имена файлов (imgFile/manImgFile) НЕ
			// трогаются (историческое имя, переименование не запрашивалось, см. коммент у id116).
			// 27.10.2026 (по прямому указанию, редактор позиций в гардеробе — "x:220,y:930,
			// scale:0.169,rot:10°,w:130,h:107"): 17-й cat:6 предмет в каталоге (idx=16, 0-based)
			// → col=1,row=5 → cx=157,cy=860 (GRID в shmot_shop.js) → cellDx=220-157-77=-14,
			// cellDy=930-860-98=-28. cellScale → cellWidth/cellHeight (явный w/h из редактора,
			// та же конвенция, что у id103/113). cellRot:10° без изменений.
			{id:117, cat:6, name:'Бита (Исполнительный)',        icon:'🏏', imgFile:'шмот бита исполнитель разнарядка.png', cellDx:-14, cellDy:-28, cellWidth:130, cellHeight:107, cellRot:10, manDx:-111, manDy:-60, manWidth:162, manHeight:133, manImgFile:'уменьшено шмот бита исполнитель разнарядка.png', bonus:'+40 к автомату',  bk:'auto_flat',     bv:40, source:'Ежедневные задания (приз за полный месяц)', set:'исполнительный', fragments:null, price:null, owned:false, equipped:false, handBuiltIn:true},
			// 27.10.2026 (та же сверка значений сета, по прямому указанию — полный авторитетный
			// список: "Худи Коричневая +40 к автомату, Худи Белая +10 к пистолету"): Худи
			// коричневая вдобавок меняла ТИП оружия (была machete_flat/мачете, должна быть
			// auto_flat/автомат) — не только значение.
			// 27.10.2026 (повторное указание тем же днём — живые координаты на манекене магазина
			// x:737,y:242,scale:1.004, cat:1 база {x:804,y:258} → manDx/manDy не изменились
			// (-67,-16 совпали с уже скопированными от id119), поменялся только manScale.
			// ОТДЕЛЬНО — иконка гардероба x:71,y:928,scale:0.114 (scale не изменился): по формуле
			// cx+77/cy+98 (см. докблок выше) это даёт cellDx=-6 (тоже без изменений) и cellDy=-30
			// (было -20, скопировано с id119 "на глаз" — теперь пересчитано индивидуально).
			{id:118, cat:1, name:'Худи белая (Исполнительный)',  icon:'🧥', imgFile:'шмот худи белая исполнитель разнарядка.png', cellDx:-6, cellDy:-30, cellScale:0.114, manDx:-67, manDy:-16, manWidth:225, manHeight:193, manImgFile:'уменьшено шмот худи белая исполнитель разнарядка.png', bonus:'+10 к пистолету', bk:'gun_flat',      bv:10, source:'Ежедневные задания (приз за полный месяц)', set:'исполнительный', fragments:null, price:null, owned:false, equipped:false},
			{id:119, cat:1, name:'Худи коричневая (Исполнительный)',icon:'🧥', imgFile:'шмот худи коричневая исполнитель разнарядка.png', cellDx:-6, cellDy:-20, cellScale:0.114, manDx:-91, manDy:-13, manWidth:254, manHeight:235, manImgFile:'уменьшено шмот худи коричневая исполнитель разнарядка.png', bonus:'+40 к автомату',   bk:'auto_flat',  bv:40, source:'Ежедневные задания (приз за полный месяц)', set:'исполнительный', fragments:null, price:null, owned:false, equipped:false},

			// Батч 22.09.2026 (по прямому указанию, финальная сверка полного присланного списка
			// сетов) — 4 предмета (id96-99), которых не было НИ в каталоге, НИ в виде картинки
			// нигде на диске, были добавлены как данные-заглушки с imgFile:''. По итогам батча
			// 23.09.2026 (см. ниже) подтверждено — реальных файлов под них в _organized так и
			// не появилось, убраны вместе с остальными "висящими" записями.

			// ── Батч 23.09.2026 (по прямому указанию, "шмотки повторяются, на сервере остались
			// старые") — полная сверка каталога против C:\Users\HONOR\Desktop\vk_game\шмотки\
			// _organized байт-в-байт (md5 каждого файла organized/{сет}/*.png против того, что
			// реально задеплоено в images/shmot/). Найдено: несколько записей ссылались на
			// файл, который на деле — чужая картинка ДРУГОГО сета (мисклейбл при заливке), из-за
			// чего в магазине одна и та же картинка визуально дублировалась под двумя разными
			// названиями. Убраны записи, для которых честного совпадения с organized не нашлось
			// вообще (сету "Игроман" в organized принадлежит РОВНО 1 файл — часы, id62; у
			// "зумер" — 2 файла — кукла id58 и кроссовки id77; у "новопришедший" — 2 файла —
			// обувь id94 и футболка id95):
			//   id63 "Кроссовки (Покер)"    — imgFile был байт-в-байт файлом Картежника (обувь
			//                                 картежник блекджек.png), не Игромана — своего
			//                                 файла у Игромана для обуви нет.
			//   id75 "Футболка (Борода)"    — файл не найден вообще нигде в organized/зумер.
			//   id76 "Шорты (Борода)"       — файл не найден вообще нигде в organized/зумер.
			//   id78 "Панама (Покер)"       — imgFile был байт-в-байт файлом вольного (кепка
			//                                 вольный меченный.png, тот же, что уже честно
			//                                 использует id47) — дубль чужой картинки.
			//   id79 "Шорты (Покер)"        — imgFile был байт-в-байт файлом ссср (шорты ссср
			//                                 ястреб.png, тот же, что уже честно использует
			//                                 id43) — дубль чужой картинки.
			//   id96-99 (заглушки без картинки, см. коммент батча 22.09.2026 выше) — реального
			//                                 файла для них в organized так и не появилось.
			// Единственный organized-файл без честного владельца в каталоге — Картежник/обувь
			// картежник блекджек.png — это тот же файл, что уже был сознательно исключён как
			// "не канон" 22.09.2026 (см. коммент у id93 выше, канон Картежника — 3 предмета),
			// оставлен неиспользуемым намеренно, не добавлялся обратно.
		];

		// ВАЖНО: без этого вызова owned/equipped всегда сбрасывались к хардкод-дефолтам
		// при каждой перезагрузке страницы — купленные/надетые шмотки не переживали сессию.
		this._loadFromUdata();

		this._bindTabs();
		this.win.butt_close.on('pointerdown', ()=>this.close());
	}

	_bindTabs(){
		const tabs = this.win.cat_tabs;
		for(let i = 0; i < 6; i++){
			const idx = i;
			tabs['tab_'+i].on('pointerdown', ()=>this._selectCat(idx));
		}
	}

	_selectCat(idx){
		this.currentCat = idx;
		const tabs = this.win.cat_tabs;
		for(let i = 0; i < 6; i++) tabs['tab_'+i].setActive(i === idx);
		this._renderGrid(idx);
	}

	_renderGrid(cat){
		// 19.09.2026 (найдено при разборе репорта "шмотки не выводятся, не покупаются"):
		// this.win (mc.shmot_win) — старый FLA-экран, который РЕАЛЬНО НИКОГДА не открывается —
		// open() всегда вызывает _openShmotShop() (shmot_shop.js, собранный с нуля PIXI-экран,
		// именно он показан игроку как «МАГАЗИН ОДЕЖДЫ»). this.win либо undefined, либо не
		// содержит item_grid — раньше это было не важно, т.к. _renderGrid() никогда не
		// вызывался (attachShmotShop затирал _buy/_saveToUdata теми же именами, что ниже, и
		// весь честный server-authoritative путь покупки оставался мёртвым кодом). Теперь,
		// когда shmot_shop.js делегирует сюда, эта защита обязательна, а второй вызов ниже —
		// то, что реально обновляет видимый игроку экран.
		if(this.win && this.win.item_grid) this._renderGridFla(cat);
		if(this._shopWin && typeof this._shopRefresh === 'function') this._shopRefresh(true);
	}

	_renderGridFla(cat){
		const grid = this.win.item_grid;
		const catItems = this.items.filter(it=>it.cat === cat);

		for(let i = 0; i < 18; i++){
			const card = grid['item_'+i];
			const item = catItems[i];
			if(item){
				card.visible = true;
				card.icon_txt.text  = item.icon;
				card.name_txt.text  = item.name;
				card.bonus_txt.text = item.bonus;

				// 19.09.2026 (диагностика репорта "бонус на карточке не виден вообще, только
				// имя") — bonus_txt.text выставляется тем же способом, что и name_txt.text
				// (строкой выше), но name_txt на экране появляется, а bonus_txt — нет. Раз это
				// явно НЕ ошибка в присвоении текста, логируем реальное состояние объекта
				// bonus_txt (позиция/видимость/альфа/родитель) один раз при первой отрисовке
				// категории, чтобы понять, куда именно "делась" подпись — это должно быть
				// видно в консоли браузера (F12) сразу после открытия магазина шмоток.
				if(i === 0 && !this._bonusTxtDebugLogged){
					this._bonusTxtDebugLogged = true;
					console.log('[shmot._renderGrid] ДИАГНОСТИКА bonus_txt (карточка 0):',
						'text=', JSON.stringify(card.bonus_txt.text),
						'| visible=', card.bonus_txt.visible,
						'| alpha=', card.bonus_txt.alpha,
						'| x=', card.bonus_txt.x, 'y=', card.bonus_txt.y,
						'| scale=', card.bonus_txt.scale ? (card.bonus_txt.scale.x+'/'+card.bonus_txt.scale.y) : '?',
						'| parent===card?', card.bonus_txt.parent === card,
						'| card.visible=', card.visible, 'card.alpha=', card.alpha);
				}

				// 19.09.2026: у дроп-предметов (см. блок id41+ выше) price===null — они не
				// продаются, вместо цены показываем источник дропа.
				if(item.price){
					const ptype = {coins:'💰',stew:'🥫',cig:'🚬'}[item.price.type]||'💰';
					card.price_txt.text = item.owned ? '' : ptype + ' ' + item.price.a;
				} else {
					card.price_txt.text = item.owned ? '' : ('🎁 ' + (item.source || 'дроп'));
				}

				card.setState(item.equipped, !item.owned);
				card.butt_wear.removeAllListeners('pointerdown');
				const idx = item.id;
				card.butt_wear.on('pointerdown', ()=>this._onWear(idx));
			} else {
				card.visible = false;
			}
		}
	}

	// 25.09.2026 (по прямому указанию, живой репорт — "шмотки не сохраняются" + "урон без
	// шмоток"): раньше equipped переключался ЛОКАЛЬНО (item.equipped=...) и уходил на сервер
	// только генерик-автосейвом (udata['shmot'] в client-writable whitelist) — та же гонка,
	// что уже чинили для skills/weapons: debounce-автосейв мог не долететь до сервера к
	// моменту bosses.attack(), сервер считал урон по СТАРОМУ надетому предмету, хотя клиент
	// уже визуально показывал новый. Теперь честный запрос→ответ (тот же паттерн, что _buy()
	// выше и weapons.js._buy()) — сервер сам решает owned/toggle/"один предмет на категорию"
	// (shmot.php.equip()), локально ничего не меняем до подтверждения.
	_onWear(itemId){
		const item = this.items.find(it=>it.id === itemId);
		if(!item) return;

		if(!item.owned){
			if(itemId === 100){
				notify.showResult({text:'Связка еще не получена. Можно выбить в рулетки'}, 0);
				return;
			}
			// 19.09.2026: дроп-предметы (price===null) не продаются за валюту — механизм их
			// выдачи (боссы/казино/тайник) ещё не реализован, см. комментарий у их описания
			// в this.items. Явно сообщаем игроку источник, а не тихо шлём в _buy() (которая
			// упала бы на item.price.a === undefined).
			if(!item.price){
				notify.showResult({text: item.name + ' не продаётся — выпадает: ' + (item.source || '?')}, 0);
				return;
			}
			this._buy(item);
			return;
		}

		if(this._shmotEquipInFlight){
			console.log('[shmot._onWear] запрос уже выполняется, повторный клик проигнорирован');
			return;
		}
		if(!window.TS){
			console.error('[shmot._onWear] window.TS недоступен, запрос не отправлен');
			return;
		}
		this._shmotEquipInFlight = true;
		console.log('[shmot._onWear] → сервер | item_id:', itemId, '| сейчас надет:', !!item.equipped);

		// 28.09.2026 (см. память агента incident_checkall_flush_wipes_server_credits): shmot.equip()
		// пишет udata['shmot'] напрямую на сервере — окно запроса нужно перекрыть suspend/resume,
		// иначе независимый автосейв может затереть свежую запись устаревшим локальным снимком.
		if(window.suspendPlayerSave) suspendPlayerSave('shmot_equip');
		TS.php('shmot.equip', {item_id: itemId}, (res) => {
			this._shmotEquipInFlight = false;
			console.log('[shmot._onWear] ← ответ сервера:', JSON.stringify(res));
			if(!res || !res.patch){
				console.error('[shmot._onWear] некорректный ответ сервера (нет patch), надевание не применено:', JSON.stringify(res));
				if(window.resumePlayerSave) resumePlayerSave('shmot_equip');
				return;
			}
			applyPatch(res.patch);
			if(window.resumePlayerSave) resumePlayerSave('shmot_equip');
			this._loadFromUdata(); // перечитывает this.items из свежего udata['shmot'] (серверная истина)
			this._renderGrid(this.currentCat);
			this._renderMannequin();
			// 19.09.2026: персонаж на главном экране должен быть одет так же, как на манекене.
			if(window.home) home.updateClothes();
		}, (err) => {
			this._shmotEquipInFlight = false;
			console.error('[shmot._onWear] ← ошибка сервера | item_id:', itemId, '| код:', err && err.code, '| полностью:', JSON.stringify(err));
			if(window.resumePlayerSave) resumePlayerSave('shmot_equip');
			// 52 — сервер считает предмет не выбитым/не купленным (например, устаревший
			// локальный снимок owned=true) — перечитываем актуальное состояние, не молчим.
			this._loadFromUdata();
			this._renderGrid(this.currentCat);
		});
	}

	// 28.09.2026 (по прямому указанию — перенос источников max_energy на сервер): метод
	// _applyMaxEnergyBonus() убран целиком. Раньше он пересчитывал TIMERS.ENERGY_MAX по НАДЕТЫМ
	// предметам и перезаписывал udata['max_energy'] на клиенте — client-writable поле, плюс
	// перезапись стирала серверные начисления от Василича/Хапуги/банды/скиллов при каждой смене
	// экипировки. Теперь бонус — за факт ВЛАДЕНИЯ (owned), считает и пишет сервер один раз в
	// момент получения вещи (см. gameops.php.applyShmotOwnBonus()), клиент просто получает
	// обновлённый max_energy через обычный applyPatch(res.patch) из любого эндпоинта выдачи.

	// 18.09.2026 (аудит после находки: 17 предметов id24-40 отсутствовали в серверном
	// каталоге shmot_items.json — покупка выглядела успешной на клиенте, но сервер её
	// отклонял, а следующий автосейв тихо откатывал owned=true обратно, т.к.
	// users.php._sanitizeShmot() не пропускает false→true, если сервер сам не подтвердил
	// покупку). Раньше клиент СРАЗУ списывал валюту/выдавал вещь ДО ответа сервера и не
	// проверял ошибку (err-колбэк был null) — переписано на тот же честный паттерн
	// запрос→ответ, что уже используется в weapons.js._buy(): ничего не меняем локально,
	// пока сервер не подтвердит, при ошибке показываем реальную причину через
	// iface._openSidorovichError вместо тихого "успеха".
	_buy(item){
		if(this._shmotBuyInFlight){
			console.log('[shmot._buy] запрос уже выполняется, повторный клик проигнорирован');
			return;
		}
		if(!window.TS){
			console.error('[shmot._buy] window.TS недоступен, запрос не отправлен');
			return;
		}
		this._shmotBuyInFlight = true;
		console.log('[shmot._buy] → сервер | item_id:', item.id, 'price:', JSON.stringify(item.price));

		// 28.09.2026 (та же защита, что в _onWear() выше — см. память агента
		// incident_checkall_flush_wipes_server_credits): shmot.buy() тоже пишет coins/stew/shmot
		// напрямую на сервере.
		if(window.suspendPlayerSave) suspendPlayerSave('shmot_buy');
		TS.php('shmot.buy', {item_id: item.id}, (res) => {
			this._shmotBuyInFlight = false;
			console.log('[shmot._buy] ← ответ сервера:', JSON.stringify(res));
			if(!res || !res.patch){
				console.error('[shmot._buy] некорректный ответ сервера (нет patch), покупка не применена:', JSON.stringify(res));
				if(window.resumePlayerSave) resumePlayerSave('shmot_buy');
				return;
			}
			applyPatch(res.patch);
			if(window.resumePlayerSave) resumePlayerSave('shmot_buy');
			this._loadFromUdata();
			iface.updateUp();
			this._renderGrid(this.currentCat);
			notify.showResult({text:'Куплено: ' + item.name}, 1);
			// 19.09.2026 (баг найден: ачивка "потратил много монет" появлялась только после
			// победы над боссом, а не сразу после покупки шмотки) — у любой другой покупки в
			// игре (weapons.js._buy → achievements.onWeaponBuy) есть свой триггер, у shmot.js
			// такого не было вообще.
			if(window.achievements) achievements.onShmotBuy();
		}, (err) => {
			this._shmotBuyInFlight = false;
			console.error('[shmot._buy] ← ошибка сервера | item_id:', item.id, '| код:', err && err.code, '| полностью:', JSON.stringify(err));
			if(window.resumePlayerSave) resumePlayerSave('shmot_buy');
			// 22.09.2026 (баг найден по прямому указанию — "недостаточно тушёнки, хотя её в разы
			// больше, чем нужно"): раньше ЛЮБАЯ ошибка сервера (51 — предмет не в каталоге,
			// 52 — уже куплено, 54 — некорректный тип цены, 99 — не удалось сохранить) ВСЕГДА
			// показывалась как "недостаточно [валюты]", независимо от реальной причины отказа —
			// код err.code вообще не проверялся. Игрок с балансом 7400 тушёнки и ценой 40 видел
			// "недостаточно тушёнки", хотя реальная причина была другой (скорее всего 52 —
			// предмет уже куплен, экран просто не обновился на "куплено").
			const code = err && err.code;
			if(code === 50){
				const cur   = {coins:'coins', stew:'stew', cig:'cigarettes'}[item.price.type];
				const label = {coins:'монет', stew:'тушенки', cig:'папирос'}[item.price.type];
				const have  = parseInt(udata[cur] || 0);
				if(window.iface) iface._openSidorovichError('Недостаточно ' + label + '!', 'Нужно: ' + item.price.a + ' • У вас: ' + have);
			} else if(code === 52){
				// Уже куплено — подтягиваем актуальное состояние с сервера вместо доверия
				// устаревшему локальному owned:false, из-за которого игрок вообще смог нажать
				// "купить" на уже принадлежащей ему вещи.
				item.owned = true;
				this._loadFromUdata();
				this._renderGrid(this.currentCat);
				if(window.notify) notify.showResult({text: item.name + ' уже куплено — экран обновлён'}, 0);
			} else if(code === 51){
				if(window.notify) notify.showResult({text: 'Этот предмет недоступен для покупки'}, 0);
			} else {
				if(window.notify) notify.showResult({text: 'Не удалось купить ' + item.name}, 0);
			}
		});
	}

	_renderMannequin(){
		// 19.09.2026: тот же случай, что и в _renderGrid() — this.win (старый FLA-экран)
		// реально никогда не открыт, актуальный манекен рисует shmot_shop.js (_updateManSprites).
		if(this.win && this.win.equip_slots) this._renderMannequinFla();
		if(this._manSlots && typeof this._updateManSprites === 'function') this._updateManSprites();
	}

	_renderMannequinFla(){
		const slots = this.win.equip_slots;
		const cats  = [0,1,2,3,4,5];
		cats.forEach((cat, i)=>{
			const equipped = this.items.find(it=>it.cat===cat&&it.equipped);
			const sl = slots['slot_'+i];
			if(equipped){
				sl.item_txt.text  = equipped.icon + ' ' + equipped.name;
				sl.item_txt.style.fill = '#b0d060';
				sl.bonus_txt.text = equipped.bonus;
			} else {
				sl.item_txt.text  = 'Пусто';
				sl.item_txt.style.fill = '#2a4a2a';
				sl.bonus_txt.text = '';
			}
		});
	}

	// 25.09.2026: _saveToUdata() удалена — 'shmot' убран из client-writable whitelist (см.
	// users.php $allowed), единственные писатели теперь shmot.php.buy()/equip() и (для выдачи
	// из казино/dev-кнопок) users.devGrantShmot(), все через Gameops::saveUser()/прямой SQL,
	// а не generic users.save(). Формат по-прежнему тот же (индекс массива = item.id, не
	// порядковая позиция в this.items, см. фикс 18.09.2026 про id24+ до этого места) —
	// воспроизведён в каждом новом месте записи (giveRandom() ниже, dev_panel.js).

	_loadFromUdata(){
		if(udata && udata['shmot']){
			try{
				const saved = helper.safeParseJSON(udata['shmot'], null);
				// PHP json_encode() превращает разреженный массив (например, когда первая
				// запись связки — id 100) в JSON-объект. Object.entries работает и для
				// обычного массива, и для такого объекта; Array#forEach во втором случае
				// падал, а catch молча скрывал всю одежду из сохранения.
				Object.entries(saved || {}).forEach(([rawId, s]) => {
					if(!s) return;
					const id = parseInt(rawId);
					const item = this.items.find(it => it.id === id);
					if(item){ item.owned = s.owned; item.equipped = s.equipped; }
				});
			} catch(e){}
		}

		// 22.09.2026 (дроп персональных вещей боссов, по прямому указанию) — прогресс сборки
		// "N/20 частей" сета "ссср" (server-only udata['shmot_fragments'], см.
		// bosses.php.claimKill()) читаем отдельно от shmot, чтобы тултип магазина
		// (shmot_shop.js._showShopTip) мог показать реальный прогресс вместо голого текста
		// источника. Ключи — id вещи (строка, т.к. JSON-объект на сервере, не массив).
		this.fragmentsProgress = {};
		if(udata && udata['shmot_fragments']){
			try{
				const frag = helper.safeParseJSON(udata['shmot_fragments'], null);
				Object.keys(frag).forEach(id => { this.fragmentsProgress[id] = parseInt(frag[id]) || 0; });
			} catch(e){}
		}

		// Право на боссов живёт в отдельном server-only флаге, а экипировка связки —
		// в общем массиве shmot: так она является обычным предметом руки и снимается
		// при надевании любого другого cat:6 предмета.
		const keyringItem = this.items.find(it => it.id === 100);
		if(keyringItem){
			keyringItem.owned = !!(udata && parseInt(udata['keyring_owner']) > 0);
			if(!keyringItem.owned) keyringItem.equipped = false;
		}
	}

	open(){
		this._openShmotShop();
	}

	close(){
		home.closeScreen();
	}
}

attachShmotShop(Shmot.prototype);
attachShmotPosEditor(Shmot.prototype);
