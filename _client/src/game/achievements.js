import { attachAchievementPopup } from './shell/popups/achievement.js';
import { collapseNewlyEarnedForPopup } from '../modules/achievement-tiers.js';
import { flushPlayerSave } from '../modules/player-save.js';
import { applyPatch } from '../modules/patch.js';

export default class Achievements {
	constructor(){
		// Все достижения по ТЗ
		this.list = [
			// Урон
			{id:'dmg_1k',    cat:'damage',  name:'Первая кровь',            pts:1,   threshold:1000, statPath:["dmg"], check:s=>s.dmg>=1000},
			{id:'dmg_10k',   cat:'damage',  name:'Опасный сталкер',         pts:1,   threshold:10000, statPath:["dmg"], check:s=>s.dmg>=10000},
			{id:'dmg_50k',   cat:'damage',  name:'Раздающий боль',          pts:2,   threshold:50000, statPath:["dmg"], check:s=>s.dmg>=50000},
			{id:'dmg_100k',  cat:'damage',  name:'Машина урона',            pts:2,   threshold:100000, statPath:["dmg"], check:s=>s.dmg>=100000},
			{id:'dmg_500k',  cat:'damage',  name:'Легенда зоны',            pts:3,   threshold:500000, statPath:["dmg"], check:s=>s.dmg>=500000},
			{id:'dmg_1kk',   cat:'damage',  name:'Миллионер боли',          pts:4,   threshold:1000000, statPath:["dmg"], check:s=>s.dmg>=1000000},
			{id:'dmg_2kk',   cat:'damage',  name:'Дважды миллионер',        pts:5,   threshold:2000000, statPath:["dmg"], check:s=>s.dmg>=2000000},
			{id:'dmg_3kk',   cat:'damage',  name:'Урон на завтрак',         pts:6,   threshold:3000000, statPath:["dmg"], check:s=>s.dmg>=3000000},
			{id:'dmg_4kk',   cat:'damage',  name:'Сила четырех',            pts:7,   threshold:4000000, statPath:["dmg"], check:s=>s.dmg>=4000000},
			{id:'dmg_5kk',   cat:'damage',  name:'Урон без границ',         pts:10,  threshold:5000000, statPath:["dmg"], check:s=>s.dmg>=5000000},
			{id:'dmg_10kk',  cat:'damage',  name:'Десятикратный',           pts:10,  threshold:10000000, statPath:["dmg"], check:s=>s.dmg>=10000000},
			{id:'dmg_20kk',  cat:'damage',  name:'Мясник зоны',             pts:10,  threshold:20000000, statPath:["dmg"], check:s=>s.dmg>=20000000},
			{id:'dmg_30kk',  cat:'damage',  name:'Ломать не строить',       pts:15,  threshold:30000000, statPath:["dmg"], check:s=>s.dmg>=30000000},
			// Автоматы
			{id:'auto_10',   cat:'auto',    name:'Автоматная нычка',        pts:1,   threshold:10, statPath:["auto"], check:s=>s.auto>=10},
			{id:'auto_100',  cat:'auto',    name:'Автоматный запас',        pts:1,   threshold:100, statPath:["auto"], check:s=>s.auto>=100},
			{id:'auto_150',  cat:'auto',    name:'Автоматов мне!',          pts:1,   threshold:150, statPath:["auto"], check:s=>s.auto>=150},
			{id:'auto_200',  cat:'auto',    name:'Газель автоматов',        pts:1,   threshold:200, statPath:["auto"], check:s=>s.auto>=200},
			{id:'auto_500',  cat:'auto',    name:'Автоматчик',              pts:2,   threshold:500, statPath:["auto"], check:s=>s.auto>=500},
			{id:'auto_1k',   cat:'auto',    name:'Закупился на славу',      pts:3,   threshold:1000, statPath:["auto"], check:s=>s.auto>=1000},
			{id:'auto_10k',  cat:'auto',    name:'Автомата очередь',        pts:4,   threshold:10000, statPath:["auto"], check:s=>s.auto>=10000},
			{id:'auto_25k',  cat:'auto',    name:'Рэмбо',                   pts:5,   threshold:25000, statPath:["auto"], check:s=>s.auto>=25000},
			{id:'auto_50k',  cat:'auto',    name:'Шквал автомата',          pts:6,   threshold:50000, statPath:["auto"], check:s=>s.auto>=50000},
			{id:'auto_100k', cat:'auto',    name:'Целый склад',             pts:10,  threshold:100000, statPath:["auto"], check:s=>s.auto>=100000},
			{id:'auto_150k', cat:'auto',    name:'Поставщик',               pts:15,  threshold:150000, statPath:["auto"], check:s=>s.auto>=150000},
			{id:'auto_300k', cat:'auto',    name:'Терминатор',              pts:50,  threshold:300000, statPath:["auto"], check:s=>s.auto>=300000},
			{id:'auto_500k', cat:'auto',    name:'Оружейный барон',         pts:100, threshold:500000, statPath:["auto"], check:s=>s.auto>=500000},
			// Стволы
			{id:'gun_10',    cat:'gun',     name:'Пукалка',                 pts:1,   threshold:10, statPath:["gun"], check:s=>s.gun>=10},
			{id:'gun_100',   cat:'gun',     name:'Дешевый стрелок',         pts:1,   threshold:100, statPath:["gun"], check:s=>s.gun>=100},
			{id:'gun_150',   cat:'gun',     name:'Кобура под подушкой',     pts:1,   threshold:150, statPath:["gun"], check:s=>s.gun>=150},
			{id:'gun_200',   cat:'gun',     name:'Кладовщик огнестрела',    pts:1,   threshold:200, statPath:["gun"], check:s=>s.gun>=200},
			{id:'gun_500',   cat:'gun',     name:'Арсенал зоны',            pts:2,   threshold:500, statPath:["gun"], check:s=>s.gun>=500},
			{id:'gun_1k',    cat:'gun',     name:'Патронный король',        pts:3,   threshold:1000, statPath:["gun"], check:s=>s.gun>=1000},
			{id:'gun_10k',   cat:'gun',     name:'С двух рук',              pts:4,   threshold:10000, statPath:["gun"], check:s=>s.gun>=10000},
			{id:'gun_36k',   cat:'gun',     name:'Склад стволов',           pts:5,   threshold:36000, statPath:["gun"], check:s=>s.gun>=36000},
			{id:'gun_180k',  cat:'gun',     name:'Вооружен до зубов',       pts:10,  threshold:180000, statPath:["gun"], check:s=>s.gun>=180000},
			{id:'gun_360k',  cat:'gun',     name:'Огневая мощь',            pts:50,  threshold:360000, statPath:["gun"], check:s=>s.gun>=360000},
			{id:'gun_720k',  cat:'gun',     name:'Огнестрельный магнат',    pts:100, threshold:720000, statPath:["gun"], check:s=>s.gun>=720000},
			// Мачете
			{id:'mac_10',    cat:'machete', name:'Царапка',                 pts:1,   threshold:10, statPath:["mac"], check:s=>s.mac>=10},
			{id:'mac_100',   cat:'machete', name:'Прокальщик',              pts:1,   threshold:100, statPath:["mac"], check:s=>s.mac>=100},
			{id:'mac_150',   cat:'machete', name:'Острый малец',            pts:1,   threshold:150, statPath:["mac"], check:s=>s.mac>=150},
			{id:'mac_200',   cat:'machete', name:'Клад под матрасом',       pts:1,   threshold:200, statPath:["mac"], check:s=>s.mac>=200},
			{id:'mac_500',   cat:'machete', name:'Секретарь заточек',       pts:2,   threshold:500, statPath:["mac"], check:s=>s.mac>=500},
			{id:'mac_1k',    cat:'machete', name:'Завхоз мачете',           pts:3,   threshold:1000, statPath:["mac"], check:s=>s.mac>=1000},
			{id:'mac_10k',   cat:'machete', name:'Коллекционер клинков',    pts:4,   threshold:10000, statPath:["mac"], check:s=>s.mac>=10000},
			{id:'mac_36k',   cat:'machete', name:'Сталь в запасе',          pts:5,   threshold:36000, statPath:["mac"], check:s=>s.mac>=36000},
			{id:'mac_180k',  cat:'machete', name:'Зона заточек',            pts:10,  threshold:180000, statPath:["mac"], check:s=>s.mac>=180000},
			{id:'mac_360k',  cat:'machete', name:'Клинковый магнат',        pts:50,  threshold:360000, statPath:["mac"], check:s=>s.mac>=360000},
			{id:'mac_720k',  cat:'machete', name:'Стальной король',         pts:100, threshold:720000, statPath:["mac"], check:s=>s.mac>=720000},
			// Соло боссы
			{id:'solo_0',    cat:'solo',    name:'Попался в капкан',        pts:1,   threshold:1, statPath:["soloKills",0], check:s=>s.soloKills[0]>=1},
			{id:'solo_1',    cat:'solo',    name:'Переиграл и уничтожил',   pts:2,   threshold:1, statPath:["soloKills",1], check:s=>s.soloKills[1]>=1},
			{id:'solo_2',    cat:'solo',    name:'Настоящий орел',          pts:3,   threshold:1, statPath:["soloKills",2], check:s=>s.soloKills[2]>=1},
			{id:'solo_3',    cat:'solo',    name:'Сорвиголова',             pts:4,   threshold:1, statPath:["soloKills",3], check:s=>s.soloKills[3]>=1},
			{id:'solo_4',    cat:'solo',    name:'Попался в мышеловку',     pts:10,  threshold:1, statPath:["soloKills",4], check:s=>s.soloKills[4]>=1},
			{id:'solo_5',    cat:'solo',    name:'Жилистый прогнулся',      pts:15,  threshold:1, statPath:["soloKills",5], check:s=>s.soloKills[5]>=1},
			{id:'solo_6',    cat:'solo',    name:'Пора на пенсию',          pts:20,  threshold:1, statPath:["soloKills",6], check:s=>s.soloKills[6]>=1},
			{id:'solo_7',    cat:'solo',    name:'Месть Люси',              pts:50,  threshold:1, statPath:["soloKills",7], check:s=>s.soloKills[7]>=1},
			// Победа над боссом
			{id:'kill_0',    cat:'kill',    name:'Охотник повержен',        pts:1,   threshold:1, statPath:["kills",0], check:s=>s.kills[0]>=1},
			{id:'kill_1',    cat:'kill',    name:'Счастливчик повержен',    pts:2,   threshold:1, statPath:["kills",1], check:s=>s.kills[1]>=1},
			{id:'kill_2',    cat:'kill',    name:'Ястреб повержен',         pts:3,   threshold:1, statPath:["kills",2], check:s=>s.kills[2]>=1},
			{id:'kill_3',    cat:'kill',    name:'Меченный повержен',       pts:4,   threshold:1, statPath:["kills",3], check:s=>s.kills[3]>=1},
			{id:'kill_4',    cat:'kill',    name:'Крыс повержен',           pts:6,   threshold:1, statPath:["kills",4], check:s=>s.kills[4]>=1},
			{id:'kill_5',    cat:'kill',    name:'Баркут повержен',         pts:8,   threshold:1, statPath:["kills",5], check:s=>s.kills[5]>=1},
			{id:'kill_6',    cat:'kill',    name:'Борода повержен',         pts:8,   threshold:1, statPath:["kills",6], check:s=>s.kills[6]>=1},
			{id:'kill_7',    cat:'kill',    name:'Жгут повержен',           pts:15,  threshold:1, statPath:["kills",7], check:s=>s.kills[7]>=1},
			// Победа за 1 час
			{id:'fast_0',    cat:'fast',    name:'Молниеносно Охотник',     pts:2,   threshold:1, statPath:["speedKills",0], check:s=>s.speedKills[0]>=1},
			{id:'fast_1',    cat:'fast',    name:'Молниеносно Счастливчик', pts:4,   threshold:1, statPath:["speedKills",1], check:s=>s.speedKills[1]>=1},
			{id:'fast_2',    cat:'fast',    name:'Молниеносно Ястреб',      pts:4,   threshold:1, statPath:["speedKills",2], check:s=>s.speedKills[2]>=1},
			{id:'fast_3',    cat:'fast',    name:'Молниеносно Меченный',    pts:5,   threshold:1, statPath:["speedKills",3], check:s=>s.speedKills[3]>=1},
			{id:'fast_4',    cat:'fast',    name:'Молниеносно Крыс',        pts:6,   threshold:1, statPath:["speedKills",4], check:s=>s.speedKills[4]>=1},
			{id:'fast_5',    cat:'fast',    name:'Молниеносно Баркут',      pts:7,   threshold:1, statPath:["speedKills",5], check:s=>s.speedKills[5]>=1},
			{id:'fast_6',    cat:'fast',    name:'Молниеносно Борода',      pts:7,   threshold:1, statPath:["speedKills",6], check:s=>s.speedKills[6]>=1},
			{id:'fast_7',    cat:'fast',    name:'Молниеносно Жгут',        pts:10,  threshold:1, statPath:["speedKills",7], check:s=>s.speedKills[7]>=1},
			// Прокачка скиллов
			{id:'sk_10',     cat:'skills',  name:'Новичок',                 pts:1,   threshold:10, statPath:["skillLvls"], check:s=>s.skillLvls>=10},
			{id:'sk_30',     cat:'skills',  name:'Ученик',                  pts:1,   threshold:30, statPath:["skillLvls"], check:s=>s.skillLvls>=30},
			{id:'sk_50',     cat:'skills',  name:'Знающий',                 pts:2,   threshold:50, statPath:["skillLvls"], check:s=>s.skillLvls>=50},
			{id:'sk_75',     cat:'skills',  name:'Разносторонний',          pts:2,   threshold:75, statPath:["skillLvls"], check:s=>s.skillLvls>=75},
			{id:'sk_100',    cat:'skills',  name:'Знаток',                  pts:4,   threshold:100, statPath:["skillLvls"], check:s=>s.skillLvls>=100},
			{id:'sk_150',    cat:'skills',  name:'Местный мудрец',          pts:4,   threshold:150, statPath:["skillLvls"], check:s=>s.skillLvls>=150},
			{id:'sk_200',    cat:'skills',  name:'Опытный',                 pts:5,   threshold:200, statPath:["skillLvls"], check:s=>s.skillLvls>=200},
			{id:'sk_300',    cat:'skills',  name:'Мастер',                  pts:5,   threshold:300, statPath:["skillLvls"], check:s=>s.skillLvls>=300},
			{id:'sk_460',    cat:'skills',  name:'Черный пояс',             pts:10,  threshold:460, statPath:["skillLvls"], check:s=>s.skillLvls>=460},
			// Зачистки локаций
			{id:'zk_k1',  cat:'zone_clear', name:'Первая зачистка',         pts:1,  threshold:1, statPath:["zoneClear",0], check:s=>s.zoneClear[0]>=1},
			{id:'zk_k5',  cat:'zone_clear', name:'Привык к Кордону',        pts:2,  threshold:5, statPath:["zoneClear",0], check:s=>s.zoneClear[0]>=5},
			{id:'zk_k10', cat:'zone_clear', name:'Завсегдатай',             pts:3,  threshold:10, statPath:["zoneClear",0], check:s=>s.zoneClear[0]>=10},
			{id:'zk_k25', cat:'zone_clear', name:'Опытный сталкер',         pts:5,  threshold:25, statPath:["zoneClear",0], check:s=>s.zoneClear[0]>=25},
			{id:'zk_k50', cat:'zone_clear', name:'Король Кордона',          pts:10, threshold:50, statPath:["zoneClear",0], check:s=>s.zoneClear[0]>=50},
			{id:'zk_s1',  cat:'zone_clear', name:'Новичок на свалке',       pts:1,  threshold:1, statPath:["zoneClear",1], check:s=>s.zoneClear[1]>=1},
			{id:'zk_s5',  cat:'zone_clear', name:'Привык к запаху',         pts:2,  threshold:5, statPath:["zoneClear",1], check:s=>s.zoneClear[1]>=5},
			{id:'zk_s10', cat:'zone_clear', name:'Сторожила',               pts:3,  threshold:10, statPath:["zoneClear",1], check:s=>s.zoneClear[1]>=10},
			{id:'zk_s25', cat:'zone_clear', name:'Хозяин Свалки',           pts:5,  threshold:25, statPath:["zoneClear",1], check:s=>s.zoneClear[1]>=25},
			{id:'zk_s50', cat:'zone_clear', name:'Король Свалки',           pts:10, threshold:50, statPath:["zoneClear",1], check:s=>s.zoneClear[1]>=50},
			{id:'zk_d1',  cat:'zone_clear', name:'Постоялец',               pts:1,  threshold:1, statPath:["zoneClear",2], check:s=>s.zoneClear[2]>=1},
			{id:'zk_d5',  cat:'zone_clear', name:'Не первый раз',           pts:2,  threshold:5, statPath:["zoneClear",2], check:s=>s.zoneClear[2]>=5},
			{id:'zk_d10', cat:'zone_clear', name:'Темнее ночи',             pts:3,  threshold:10, statPath:["zoneClear",2], check:s=>s.zoneClear[2]>=10},
			{id:'zk_d25', cat:'zone_clear', name:'Уверенно',                pts:5,  threshold:25, statPath:["zoneClear",2], check:s=>s.zoneClear[2]>=25},
			{id:'zk_d50', cat:'zone_clear', name:'Король Темной долины',    pts:10, threshold:50, statPath:["zoneClear",2], check:s=>s.zoneClear[2]>=50},
			{id:'zk_a1',  cat:'zone_clear', name:'Ученик',                  pts:1,  threshold:1, statPath:["zoneClear",3], check:s=>s.zoneClear[3]>=1},
			{id:'zk_a5',  cat:'zone_clear', name:'Мастер',                  pts:2,  threshold:5, statPath:["zoneClear",3], check:s=>s.zoneClear[3]>=5},
			{id:'zk_a10', cat:'zone_clear', name:'Старший смены',           pts:3,  threshold:10, statPath:["zoneClear",3], check:s=>s.zoneClear[3]>=10},
			{id:'zk_a25', cat:'zone_clear', name:'Начальник',               pts:5,  threshold:25, statPath:["zoneClear",3], check:s=>s.zoneClear[3]>=25},
			{id:'zk_a50', cat:'zone_clear', name:'Хозяин',                  pts:10, threshold:50, statPath:["zoneClear",3], check:s=>s.zoneClear[3]>=50},
			{id:'zk_y1',  cat:'zone_clear', name:'Чистильщик Янтаря',      pts:1,  threshold:1, statPath:["zoneClear",4], check:s=>s.zoneClear[4]>=1},
			{id:'zk_y5',  cat:'zone_clear', name:'Глушитель Зоны',         pts:2,  threshold:5, statPath:["zoneClear",4], check:s=>s.zoneClear[4]>=5},
			{id:'zk_y10', cat:'zone_clear', name:'Санитар Зоны',           pts:3,  threshold:10, statPath:["zoneClear",4], check:s=>s.zoneClear[4]>=10},
			{id:'zk_y25', cat:'zone_clear', name:'Тишина над болотом',      pts:5,  threshold:25, statPath:["zoneClear",4], check:s=>s.zoneClear[4]>=25},
			{id:'zk_y50', cat:'zone_clear', name:'Последний сигнал Янтаря', pts:10, threshold:50, statPath:["zoneClear",4], check:s=>s.zoneClear[4]>=50},
			// 25.09.2026 (по прямому указанию — "нычки больше не классифицируются вообще, нычка
			// есть нычка — эти 14 пер-типовых достижений становятся недостижимыми, убираю из
			// каталога, но просто отключи/закомментируй, не удаляй — мёртвый код, потом оживим"):
			// вся секция "Заначки" (5 локаций × 3 типа × 2 порога) закомментирована целиком.
			// zone.php.fillCheckpoint() больше не классифицирует находку по типу (см. zone.php,
			// zone.js) — statPath ["stash", key] этих правил физически нечем заполнить.
			// achievements.js.onStashCollect() (вызывался ТОЛЬКО отсюда) тоже отключён ниже.
			// // Заначки Кордон
			// {id:'st_k_lezv1',  cat:'stash', name:'Первый след',            pts:5,  threshold:1, statPath:["stash","k_lezv"], check:s=>(s.stash['k_lezv']||0)>=1},
			// {id:'st_k_lezv10', cat:'stash', name:'Любопытный Сталкер',     pts:10, threshold:10, statPath:["stash","k_lezv"], check:s=>(s.stash['k_lezv']||0)>=10},
			// {id:'st_k_lyub1',  cat:'stash', name:'Сборщик находок',        pts:5,  threshold:1, statPath:["stash","k_lyub"], check:s=>(s.stash['k_lyub']||0)>=1},
			// {id:'st_k_lyub10', cat:'stash', name:'По следам тайников',      pts:10, threshold:10, statPath:["stash","k_lyub"], check:s=>(s.stash['k_lyub']||0)>=10},
			// {id:'st_k_avto1',  cat:'stash', name:'Первые реликвии',         pts:5,  threshold:1, statPath:["stash","k_avto"], check:s=>(s.stash['k_avto']||0)>=1},
			// {id:'st_k_avto10', cat:'stash', name:'Охотник за тайниками',    pts:10, threshold:10, statPath:["stash","k_avto"], check:s=>(s.stash['k_avto']||0)>=10},
			// // Заначки Свалка
			// {id:'st_s_yuv1',   cat:'stash', name:'Следопыт Зоны',          pts:5,  threshold:1, statPath:["stash","s_yuv"], check:s=>(s.stash['s_yuv']||0)>=1},
			// {id:'st_s_yuv10',  cat:'stash', name:'Знаток укромных мест',    pts:10, threshold:10, statPath:["stash","s_yuv"], check:s=>(s.stash['s_yuv']||0)>=10},
			// {id:'st_s_sysh1',  cat:'stash', name:'Коллекционер аномалий',   pts:5,  threshold:1, statPath:["stash","s_sysh"], check:s=>(s.stash['s_sysh']||0)>=1},
			// {id:'st_s_sysh10', cat:'stash', name:'Старьевщик Зоны',         pts:10, threshold:10, statPath:["stash","s_sysh"], check:s=>(s.stash['s_sysh']||0)>=10},
			// {id:'st_s_met1',   cat:'stash', name:'Хранитель находок',       pts:5,  threshold:1, statPath:["stash","s_met"], check:s=>(s.stash['s_met']||0)>=1},
			// {id:'st_s_met10',  cat:'stash', name:'Мастер тайников',         pts:10, threshold:10, statPath:["stash","s_met"], check:s=>(s.stash['s_met']||0)>=10},
			// // Заначки Темная Долина
			// {id:'st_d_umn1',   cat:'stash', name:'Легенда Сталкерских схронов', pts:5,  threshold:1, statPath:["stash","d_umn"], check:s=>(s.stash['d_umn']||0)>=1},
			// {id:'st_d_umn10',  cat:'stash', name:'Собиратель Зоны',          pts:10, threshold:10, statPath:["stash","d_umn"], check:s=>(s.stash['d_umn']||0)>=10},
			// {id:'st_d_az1',    cat:'stash', name:'Архивариус Зоны',          pts:5,  threshold:1, statPath:["stash","d_az"], check:s=>(s.stash['d_az']||0)>=1},
			// {id:'st_d_az10',   cat:'stash', name:'Хроновед',                 pts:10, threshold:10, statPath:["stash","d_az"], check:s=>(s.stash['d_az']||0)>=10},
			// {id:'st_d_kost1',  cat:'stash', name:'Охотник за утерянным',     pts:5,  threshold:1, statPath:["stash","d_kost"], check:s=>(s.stash['d_kost']||0)>=1},
			// {id:'st_d_kost10', cat:'stash', name:'Тайная добыча',            pts:10, threshold:10, statPath:["stash","d_kost"], check:s=>(s.stash['d_kost']||0)>=10},
			// // Заначки Агропром
			// {id:'st_a_rast1',  cat:'stash', name:'Хранитель забытых вещей',  pts:5,  threshold:1, statPath:["stash","a_rast"], check:s=>(s.stash['a_rast']||0)>=1},
			// {id:'st_a_rast10', cat:'stash', name:'Собиратель легенд',        pts:10, threshold:10, statPath:["stash","a_rast"], check:s=>(s.stash['a_rast']||0)>=10},
			// {id:'st_a_kur1',   cat:'stash', name:'Следы прошлого',           pts:5,  threshold:1, statPath:["stash","a_kur"], check:s=>(s.stash['a_kur']||0)>=1},
			// {id:'st_a_kur10',  cat:'stash', name:'Зоновский кладоискатель',  pts:10, threshold:10, statPath:["stash","a_kur"], check:s=>(s.stash['a_kur']||0)>=10},
			// {id:'st_a_pozh1',  cat:'stash', name:'Трофеи Пустоши',           pts:5,  threshold:1, statPath:["stash","a_pozh"], check:s=>(s.stash['a_pozh']||0)>=1},
			// {id:'st_a_pozh10', cat:'stash', name:'Артефактолог',             pts:10, threshold:10, statPath:["stash","a_pozh"], check:s=>(s.stash['a_pozh']||0)>=10},
			// // Заначки Янтарь
			// {id:'st_y_koll1',  cat:'stash', name:'Разгадчик схронов',        pts:5,  threshold:1, statPath:["stash","y_koll"], check:s=>(s.stash['y_koll']||0)>=1},
			// {id:'st_y_koll10', cat:'stash', name:'Тихий мародер',            pts:10, threshold:10, statPath:["stash","y_koll"], check:s=>(s.stash['y_koll']||0)>=10},
			// {id:'st_y_muz1',   cat:'stash', name:'Собиратель тайн',          pts:5,  threshold:1, statPath:["stash","y_muz"], check:s=>(s.stash['y_muz']||0)>=1},
			// {id:'st_y_muz10',  cat:'stash', name:'Пыльные реликвии',         pts:10, threshold:10, statPath:["stash","y_muz"], check:s=>(s.stash['y_muz']||0)>=10},
			// {id:'st_y_kegl1',  cat:'stash', name:'Секреты под ржавчиной',    pts:5,  threshold:1, statPath:["stash","y_kegl"], check:s=>(s.stash['y_kegl']||0)>=1},
			// {id:'st_y_kegl10', cat:'stash', name:'Поиск без конца',          pts:10, threshold:10, statPath:["stash","y_kegl"], check:s=>(s.stash['y_kegl']||0)>=10},
			// Потраченная энергия
			{id:'en_50',    cat:'energy', name:'Первые искры',         pts:1,  threshold:50, statPath:["energy"], check:s=>s.energy>=50},
			{id:'en_500',   cat:'energy', name:'Разогрев',              pts:1,  threshold:500, statPath:["energy"], check:s=>s.energy>=500},
			{id:'en_1k',    cat:'energy', name:'Поток энергии',         pts:1,  threshold:1000, statPath:["energy"], check:s=>s.energy>=1000},
			{id:'en_2k5',   cat:'energy', name:'Энергетический импульс',pts:2,  threshold:2500, statPath:["energy"], check:s=>s.energy>=2500},
			{id:'en_5k',    cat:'energy', name:'На полном заряде',      pts:2,  threshold:5000, statPath:["energy"], check:s=>s.energy>=5000},
			{id:'en_10k',   cat:'energy', name:'Перегрузка системы',    pts:2,  threshold:10000, statPath:["energy"], check:s=>s.energy>=10000},
			{id:'en_25k',   cat:'energy', name:'Энергетический шторм',  pts:3,  threshold:25000, statPath:["energy"], check:s=>s.energy>=25000},
			{id:'en_50k',   cat:'energy', name:'Критическая мощность',  pts:3,  threshold:50000, statPath:["energy"], check:s=>s.energy>=50000},
			{id:'en_75k',   cat:'energy', name:'Генератор хаоса',       pts:5,  threshold:75000, statPath:["energy"], check:s=>s.energy>=75000},
			{id:'en_100k',  cat:'energy', name:'Абсолютный заряд',      pts:5,  threshold:100000, statPath:["energy"], check:s=>s.energy>=100000},
			{id:'en_150k',  cat:'energy', name:'За пределами нормы',    pts:8,  threshold:150000, statPath:["energy"], check:s=>s.energy>=150000},
			{id:'en_200k',  cat:'energy', name:'Живая энергия',         pts:8,  threshold:200000, statPath:["energy"], check:s=>s.energy>=200000},
			{id:'en_300k',  cat:'energy', name:'Ядро силы',             pts:10, threshold:300000, statPath:["energy"], check:s=>s.energy>=300000},
			{id:'en_500k',  cat:'energy', name:'Источник разрушения',   pts:25, threshold:500000, statPath:["energy"], check:s=>s.energy>=500000},
			{id:'en_1kk',   cat:'energy', name:'Повелитель энергии',    pts:50, threshold:1000000, statPath:["energy"], check:s=>s.energy>=1000000},
			// Карты — уровни
			{id:'crd_l25',  cat:'cards',  name:'(карты) 25 уровень',   pts:1,  threshold:25, statPath:["cardsLvl"], check:s=>s.cardsLvl>=25},
			{id:'crd_l50',  cat:'cards',  name:'(карты) 50 уровень',   pts:2,  threshold:50, statPath:["cardsLvl"], check:s=>s.cardsLvl>=50},
			{id:'crd_l100', cat:'cards',  name:'(карты) 100 уровень',  pts:4,  threshold:100, statPath:["cardsLvl"], check:s=>s.cardsLvl>=100},
			{id:'crd_l150', cat:'cards',  name:'(карты) 150 уровень',  pts:8,  threshold:150, statPath:["cardsLvl"], check:s=>s.cardsLvl>=150},
			{id:'crd_l200', cat:'cards',  name:'(карты) 200 уровень',  pts:10, threshold:200, statPath:["cardsLvl"], check:s=>s.cardsLvl>=200},
			{id:'crd_l300', cat:'cards',  name:'(карты) 300 уровень',  pts:20, threshold:300, statPath:["cardsLvl"], check:s=>s.cardsLvl>=300},
			// Карты — комбинации
			{id:'crd_77',  cat:'cards', name:'Семерки',  pts:1, threshold:1, statPath:["cardsCombos","77"], check:s=>s.cardsCombos['77']>=1},
			{id:'crd_88',  cat:'cards', name:'Восьмерки',pts:1, threshold:1, statPath:["cardsCombos","88"], check:s=>s.cardsCombos['88']>=1},
			{id:'crd_99',  cat:'cards', name:'Девятки',  pts:2, threshold:1, statPath:["cardsCombos","99"], check:s=>s.cardsCombos['99']>=1},
			{id:'crd_tt',  cat:'cards', name:'Десятки',  pts:2, threshold:1, statPath:["cardsCombos","tt"], check:s=>s.cardsCombos['tt']>=1},
			{id:'crd_jj',  cat:'cards', name:'Валеты',   pts:3, threshold:1, statPath:["cardsCombos","jj"], check:s=>s.cardsCombos['jj']>=1},
			{id:'crd_qq',  cat:'cards', name:'Дамы',     pts:3, threshold:1, statPath:["cardsCombos","qq"], check:s=>s.cardsCombos['qq']>=1},
			{id:'crd_kk',  cat:'cards', name:'Короли',   pts:3, threshold:1, statPath:["cardsCombos","kk"], check:s=>s.cardsCombos['kk']>=1},
			{id:'crd_aa',  cat:'cards', name:'Тузы',     pts:3, threshold:1, statPath:["cardsCombos","aa"], check:s=>s.cardsCombos['aa']>=1},
			// Покер — уровни
			{id:'pkr_l10',  cat:'poker', name:'Азартное начало',   pts:5,  threshold:10, statPath:["pokerLvl"], check:s=>s.pokerLvl>=10},
			{id:'pkr_l30',  cat:'poker', name:'Сегодня везёт',     pts:5,  threshold:30, statPath:["pokerLvl"], check:s=>s.pokerLvl>=30},
			{id:'pkr_l50',  cat:'poker', name:'Любимец карт',      pts:10, threshold:50, statPath:["pokerLvl"], check:s=>s.pokerLvl>=50},
			{id:'pkr_l70',  cat:'poker', name:'Опытный картёжник', pts:20, threshold:70, statPath:["pokerLvl"], check:s=>s.pokerLvl>=70},
			{id:'pkr_l100', cat:'poker', name:'Катала',            pts:30, threshold:100, statPath:["pokerLvl"], check:s=>s.pokerLvl>=100},
			// Покер — комбинации
			// 04.10.2026 (по прямому указанию — "подписывать покер не нужно, просто пиши
			// название"): префикс "(покер) " убран из name (аналогично cat 'cards' выше, где
			// комбинации уже без префикса "(карты) ").
			{id:'pkr_kare',   cat:'poker', name:'Каре',       pts:20, threshold:1, statPath:["pokerCombos","kare"], check:s=>s.pokerCombos['kare']>=1},
			{id:'pkr_sf',     cat:'poker', name:'Стрит-Флеш', pts:40, threshold:1, statPath:["pokerCombos","sf"], check:s=>s.pokerCombos['sf']>=1},
			{id:'pkr_rf',     cat:'poker', name:'Роял-Флеш',  pts:60, threshold:1, statPath:["pokerCombos","rf"], check:s=>s.pokerCombos['rf']>=1},
			// Покер — фиолетовые спички
			{id:'pkr_sp1k',  cat:'poker', name:'Непосильным трудом', pts:5,  threshold:1000, statPath:["pokerSpichki"], check:s=>s.pokerSpichki>=1000},
			{id:'pkr_sp2k',  cat:'poker', name:'Азартное состояние', pts:6,  threshold:2000, statPath:["pokerSpichki"], check:s=>s.pokerSpichki>=2000},
			{id:'pkr_sp4k',  cat:'poker', name:'Выгодная игра',      pts:10, threshold:4000, statPath:["pokerSpichki"], check:s=>s.pokerSpichki>=4000},
			{id:'pkr_sp6k',  cat:'poker', name:'Дорога к богатству', pts:15, threshold:6000, statPath:["pokerSpichki"], check:s=>s.pokerSpichki>=6000},
			{id:'pkr_sp10k', cat:'poker', name:'Поднялся на покере', pts:20, threshold:10000, statPath:["pokerSpichki"], check:s=>s.pokerSpichki>=10000},
			// Рулетка — уровни
			{id:'rul_l2',   cat:'roulette', name:'Первые обороты', pts:1,  threshold:2, statPath:["rouletteLvl"], check:s=>s.rouletteLvl>=2},
			{id:'rul_l10',  cat:'roulette', name:'Колесник',       pts:4,  threshold:10, statPath:["rouletteLvl"], check:s=>s.rouletteLvl>=10},
			{id:'rul_l25',  cat:'roulette', name:'Везунчик',       pts:10, threshold:25, statPath:["rouletteLvl"], check:s=>s.rouletteLvl>=25},
			{id:'rul_l50',  cat:'roulette', name:'Мастер удачи',   pts:20, threshold:50, statPath:["rouletteLvl"], check:s=>s.rouletteLvl>=50},
			{id:'rul_l100', cat:'roulette', name:'Легенда фортуны',pts:50, threshold:100, statPath:["rouletteLvl"], check:s=>s.rouletteLvl>=100},
			// Рулетка — голубые спички
			{id:'rul_sp100',  cat:'roulette', name:'Первая сотня',    pts:3,  threshold:100, statPath:["rouletteSpichki"], check:s=>s.rouletteSpichki>=100},
			{id:'rul_sp500',  cat:'roulette', name:'Полтысячи',       pts:5,  threshold:500, statPath:["rouletteSpichki"], check:s=>s.rouletteSpichki>=500},
			{id:'rul_sp1k',   cat:'roulette', name:'Косарик',         pts:8,  threshold:1000, statPath:["rouletteSpichki"], check:s=>s.rouletteSpichki>=1000},
			{id:'rul_sp2k',   cat:'roulette', name:'Горячая пара',    pts:10, threshold:2000, statPath:["rouletteSpichki"], check:s=>s.rouletteSpichki>=2000},
			{id:'rul_sp5k',   cat:'roulette', name:'Спичечный магнат',pts:20, threshold:5000, statPath:["rouletteSpichki"], check:s=>s.rouletteSpichki>=5000},
			{id:'rul_sp10k',  cat:'roulette', name:'Пироман',         pts:40, threshold:10000, statPath:["rouletteSpichki"], check:s=>s.rouletteSpichki>=10000},

			// ─── Экономические (15.09.2026, полный список от руководителя) ───

			// Опыт (накопить, s.exp — текущий баланс, монотонно растёт, не тратится)
			{id:'exp_10k',   cat:'exp', name:'Малек',                     pts:1,  threshold:10000, statPath:["exp"], check:s=>s.exp>=10000},
			{id:'exp_20k',   cat:'exp', name:'Работяга',                  pts:2,  threshold:20000, statPath:["exp"], check:s=>s.exp>=20000},
			{id:'exp_50k',   cat:'exp', name:'Эльдорадо',                 pts:3,  threshold:50000, statPath:["exp"], check:s=>s.exp>=50000},
			{id:'exp_100k',  cat:'exp', name:'Кормленный с Хабара',       pts:4,  threshold:100000, statPath:["exp"], check:s=>s.exp>=100000},
			{id:'exp_150k',  cat:'exp', name:'Почти тракторист',          pts:5,  threshold:150000, statPath:["exp"], check:s=>s.exp>=150000},
			{id:'exp_300k',  cat:'exp', name:'Тракторист',                pts:6,  threshold:300000, statPath:["exp"], check:s=>s.exp>=300000},
			{id:'exp_500k',  cat:'exp', name:'Мощно',                     pts:8,  threshold:500000, statPath:["exp"], check:s=>s.exp>=500000},
			{id:'exp_1kk',   cat:'exp', name:'внатуре четко',             pts:10, threshold:1000000, statPath:["exp"], check:s=>s.exp>=1000000},
			{id:'exp_5kk',   cat:'exp', name:'Блатной',                   pts:12, threshold:5000000, statPath:["exp"], check:s=>s.exp>=5000000},
			{id:'exp_10kk',  cat:'exp', name:'Мужик',                     pts:15, threshold:10000000, statPath:["exp"], check:s=>s.exp>=10000000},
			{id:'exp_20kk',  cat:'exp', name:'Старший по зачистке',       pts:20, threshold:20000000, statPath:["exp"], check:s=>s.exp>=20000000},
			{id:'exp_30kk',  cat:'exp', name:'Куратор Зоны',              pts:25, threshold:30000000, statPath:["exp"], check:s=>s.exp>=30000000},
			{id:'exp_40kk',  cat:'exp', name:'Слово имеет вес',           pts:30, threshold:40000000, statPath:["exp"], check:s=>s.exp>=40000000},
			{id:'exp_50kk',  cat:'exp', name:'Главный',                   pts:40, threshold:50000000, statPath:["exp"], check:s=>s.exp>=50000000},
			{id:'exp_100kk', cat:'exp', name:'Первый среди первых',       pts:60, threshold:100000000, statPath:["exp"], check:s=>s.exp>=100000000},
			{id:'exp_200kk', cat:'exp', name:'Лучший друг Седого',        pts:80, threshold:200000000, statPath:["exp"], check:s=>s.exp>=200000000},

			// Сигареты (накопить, текущий баланс)
			{id:'cig_10k',  cat:'cig_hoard', name:'Первая затяжка',      pts:1,  threshold:10000, statPath:["cig"], check:s=>s.cig>=10000},
			{id:'cig_50k',  cat:'cig_hoard', name:'Пыхарь',              pts:2,  threshold:50000, statPath:["cig"], check:s=>s.cig>=50000},
			{id:'cig_100k', cat:'cig_hoard', name:'Закурил конкретно',   pts:3,  threshold:100000, statPath:["cig"], check:s=>s.cig>=100000},
			{id:'cig_300k', cat:'cig_hoard', name:'Дымовая завеса',      pts:4,  threshold:300000, statPath:["cig"], check:s=>s.cig>=300000},
			{id:'cig_500k', cat:'cig_hoard', name:'Сигаретный магнат',   pts:5,  threshold:500000, statPath:["cig"], check:s=>s.cig>=500000},
			{id:'cig_1kk',  cat:'cig_hoard', name:'Сигаретный барон',    pts:6,  threshold:1000000, statPath:["cig"], check:s=>s.cig>=1000000},
			{id:'cig_5kk',  cat:'cig_hoard', name:'Босс по табаку',      pts:8,  threshold:5000000, statPath:["cig"], check:s=>s.cig>=5000000},
			{id:'cig_10kk', cat:'cig_hoard', name:'Легенда курилки',     pts:10, threshold:10000000, statPath:["cig"], check:s=>s.cig>=10000000},

			// Рубли (накопить, текущий баланс)
			{id:'coin_8',    cat:'coins_hoard', name:'Мелочь',                 pts:1,  threshold:8, statPath:["coinsBalance"], check:s=>s.coinsBalance>=8},
			{id:'coin_18',   cat:'coins_hoard', name:'Копейка рубль бережет',  pts:1,  threshold:18, statPath:["coinsBalance"], check:s=>s.coinsBalance>=18},
			{id:'coin_50',   cat:'coins_hoard', name:'Первый полтос',          pts:1,  threshold:50, statPath:["coinsBalance"], check:s=>s.coinsBalance>=50},
			{id:'coin_100',  cat:'coins_hoard', name:'Соточка на ход ноги',    pts:1,  threshold:100, statPath:["coinsBalance"], check:s=>s.coinsBalance>=100},
			{id:'coin_500',  cat:'coins_hoard', name:'Полосатый на кармане',   pts:2,  threshold:500, statPath:["coinsBalance"], check:s=>s.coinsBalance>=500},
			{id:'coin_1k',   cat:'coins_hoard', name:'Косарик',                pts:2,  threshold:1000, statPath:["coinsBalance"], check:s=>s.coinsBalance>=1000},
			{id:'coin_5k',   cat:'coins_hoard', name:'С Хабаровска',           pts:3,  threshold:5000, statPath:["coinsBalance"], check:s=>s.coinsBalance>=5000},
			{id:'coin_10k',  cat:'coins_hoard', name:'Десяточка',              pts:4,  threshold:10000, statPath:["coinsBalance"], check:s=>s.coinsBalance>=10000},
			{id:'coin_25k',  cat:'coins_hoard', name:'Получка',                pts:5,  threshold:25000, statPath:["coinsBalance"], check:s=>s.coinsBalance>=25000},
			{id:'coin_50k',  cat:'coins_hoard', name:'Получил зарплату',       pts:6,  threshold:50000, statPath:["coinsBalance"], check:s=>s.coinsBalance>=50000},
			{id:'coin_100k', cat:'coins_hoard', name:'Пахан',                  pts:7,  threshold:100000, statPath:["coinsBalance"], check:s=>s.coinsBalance>=100000},
			{id:'coin_250k', cat:'coins_hoard', name:'Башлевый',               pts:8,  threshold:250000, statPath:["coinsBalance"], check:s=>s.coinsBalance>=250000},
			{id:'coin_500k', cat:'coins_hoard', name:'Богач',                  pts:9,  threshold:500000, statPath:["coinsBalance"], check:s=>s.coinsBalance>=500000},
			{id:'coin_1kk',  cat:'coins_hoard', name:'Миллионер',              pts:10, threshold:1000000, statPath:["coinsBalance"], check:s=>s.coinsBalance>=1000000},

			// Тушенка (накопить, текущий баланс)
			{id:'stew_10',   cat:'stew_hoard', name:'Официант',                 pts:1,   threshold:10, statPath:["stewBalance"], check:s=>s.stewBalance>=10},
			{id:'stew_50',   cat:'stew_hoard', name:'Повар',                    pts:1,   threshold:50, statPath:["stewBalance"], check:s=>s.stewBalance>=50},
			{id:'stew_100',  cat:'stew_hoard', name:'Любитель',                 pts:2,   threshold:100, statPath:["stewBalance"], check:s=>s.stewBalance>=100},
			{id:'stew_600',  cat:'stew_hoard', name:'Кондитер',                 pts:4,   threshold:600, statPath:["stewBalance"], check:s=>s.stewBalance>=600},
			{id:'stew_1k',   cat:'stew_hoard', name:'Дегустатор',               pts:5,   threshold:1000, statPath:["stewBalance"], check:s=>s.stewBalance>=1000},
			{id:'stew_2k5',  cat:'stew_hoard', name:'Су Шеф',                   pts:6,   threshold:2500, statPath:["stewBalance"], check:s=>s.stewBalance>=2500},
			{id:'stew_5k',   cat:'stew_hoard', name:'Шеф повар',                pts:7,   threshold:5000, statPath:["stewBalance"], check:s=>s.stewBalance>=5000},
			{id:'stew_10k',  cat:'stew_hoard', name:'Обжора',                   pts:8,   threshold:10000, statPath:["stewBalance"], check:s=>s.stewBalance>=10000},
			{id:'stew_25k',  cat:'stew_hoard', name:'Богатый',                  pts:10,  threshold:25000, statPath:["stewBalance"], check:s=>s.stewBalance>=25000},
			{id:'stew_50k',  cat:'stew_hoard', name:'Тушенки много не бывает',  pts:10,  threshold:50000, statPath:["stewBalance"], check:s=>s.stewBalance>=50000},
			{id:'stew_100k', cat:'stew_hoard', name:'Анти-донатер',             pts:12,  threshold:100000, statPath:["stewBalance"], check:s=>s.stewBalance>=100000},
			{id:'stew_150k', cat:'stew_hoard', name:'Баночный магнат',          pts:25,  threshold:150000, statPath:["stewBalance"], check:s=>s.stewBalance>=150000},
			{id:'stew_200k', cat:'stew_hoard', name:'Пройдет не каждый',        pts:50,  threshold:200000, statPath:["stewBalance"], check:s=>s.stewBalance>=200000},
			{id:'stew_300k', cat:'stew_hoard', name:'Король тушенки',           pts:100, threshold:300000, statPath:["stewBalance"], check:s=>s.stewBalance>=300000},
			{id:'stew_500k', cat:'stew_hoard', name:'Инвестор',                 pts:150, threshold:500000, statPath:["stewBalance"], check:s=>s.stewBalance>=500000},
			{id:'stew_1kk',  cat:'stew_hoard', name:'Вот это и аппетит',        pts:200, threshold:1000000, statPath:["stewBalance"], check:s=>s.stewBalance>=1000000},

			// ─── Прочие ───

			// Качалка (04.10.2026, по прямому указанию — смена триггера: раньше считала личные
			// тренировки base.js train_count, теперь считает, сколько раз ЭТОТ игрок позвал ДРУГИХ
			// в качалку с чужой визитки, см. zaruba.php.pump()/gym_invites_sent). ⚠️ У игроков,
			// качавшихся лично, но не звавших других, прогресс по этой теме обнуляется — прямое
			// следствие смены триггера, не баг.
			{id:'gym_10',   cat:'gym', name:'Первая прокачка', pts:2,  threshold:10, statPath:["gymInvitesSent"], check:s=>s.gymInvitesSent>=10},
			{id:'gym_30',   cat:'gym', name:'Подтянутый',      pts:3,  threshold:30, statPath:["gymInvitesSent"], check:s=>s.gymInvitesSent>=30},
			{id:'gym_50',   cat:'gym', name:'Силач Зоны',      pts:5,  threshold:50, statPath:["gymInvitesSent"], check:s=>s.gymInvitesSent>=50},
			{id:'gym_100',  cat:'gym', name:'Железные банки',  pts:10, threshold:100, statPath:["gymInvitesSent"], check:s=>s.gymInvitesSent>=100},
			{id:'gym_500',  cat:'gym', name:'Качок от Бога',   pts:15, threshold:500, statPath:["gymInvitesSent"], check:s=>s.gymInvitesSent>=500},
			{id:'gym_1k',   cat:'gym', name:'Зверюга',         pts:20, threshold:1000, statPath:["gymInvitesSent"], check:s=>s.gymInvitesSent>=1000},

			// Сила (base.js "Сила", суммарный XP, вложенный именно в эту характеристику)
			{id:'str_50',    cat:'strength', name:'Крепкая хватка',   pts:2,  threshold:50, statPath:["strXp"], check:s=>s.strXp>=50},
			{id:'str_100',   cat:'strength', name:'Сила Сталкера',    pts:3,  threshold:100, statPath:["strXp"], check:s=>s.strXp>=100},
			{id:'str_500',   cat:'strength', name:'железные руки',    pts:5,  threshold:500, statPath:["strXp"], check:s=>s.strXp>=500},
			{id:'str_1k',    cat:'strength', name:'Тяжеловес',        pts:10, threshold:1000, statPath:["strXp"], check:s=>s.strXp>=1000},
			{id:'str_2k5',   cat:'strength', name:'Несгибаемый',      pts:10, threshold:2500, statPath:["strXp"], check:s=>s.strXp>=2500},
			{id:'str_10k',   cat:'strength', name:'Сталкерская мощь', pts:20, threshold:10000, statPath:["strXp"], check:s=>s.strXp>=10000},
			{id:'str_25k',   cat:'strength', name:'Сила Зоны',        pts:25, threshold:25000, statPath:["strXp"], check:s=>s.strXp>=25000},
			{id:'str_50k',   cat:'strength', name:'Стальной Сталкер', pts:25, threshold:50000, statPath:["strXp"], check:s=>s.strXp>=50000},

			// Бои с игроком (15.09.2026, из ТЗ стр.34 — в коде отсутствовала целиком).
			// 04.10.2026 (по прямому указанию): подключена к "Зарубе" (zaruba.php.fight(), PvP
			// со страницы визита к другу) — pvp_wins теперь реально инкрементируется сервером
			// при победе, см. zaruba.php и player_profile.js._startZaruba().
			{id:'pvp_10',   cat:'pvp', name:'Первый выживший',            pts:2,  threshold:10, statPath:["pvpWins"], check:s=>s.pvpWins>=10},
			{id:'pvp_30',   cat:'pvp', name:'Закаленный в боях',          pts:3,  threshold:30, statPath:["pvpWins"], check:s=>s.pvpWins>=30},
			{id:'pvp_50',   cat:'pvp', name:'Опытный боец Зоны',          pts:5,  threshold:50, statPath:["pvpWins"], check:s=>s.pvpWins>=50},
			{id:'pvp_100',  cat:'pvp', name:'Гроза мутантов и бандитов',  pts:8,  threshold:100, statPath:["pvpWins"], check:s=>s.pvpWins>=100},
			{id:'pvp_500',  cat:'pvp', name:'Ветеран перестрелок',        pts:10, threshold:500, statPath:["pvpWins"], check:s=>s.pvpWins>=500},
			{id:'pvp_1k',   cat:'pvp', name:'Чемпион Зоны',               pts:15, threshold:1000, statPath:["pvpWins"], check:s=>s.pvpWins>=1000},

			// Заход в игру без перерыва (реальный стрик подряд идущих дней — см. preloader.js._updateLoginStreak)
			{id:'streak_7',   cat:'streak', name:'Неделя в Зоне',       pts:5,   threshold:7, statPath:["loginStreak"], check:s=>s.loginStreak>=7},
			{id:'streak_14',  cat:'streak', name:'Привыкший к Зоне',    pts:5,   threshold:14, statPath:["loginStreak"], check:s=>s.loginStreak>=14},
			{id:'streak_30',  cat:'streak', name:'Месяц прожит',        pts:10,  threshold:30, statPath:["loginStreak"], check:s=>s.loginStreak>=30},
			{id:'streak_60',  cat:'streak', name:'Закалённый Зоной',    pts:15,  threshold:60, statPath:["loginStreak"], check:s=>s.loginStreak>=60},
			{id:'streak_120', cat:'streak', name:'Постоянный Сталкер',  pts:50,  threshold:120, statPath:["loginStreak"], check:s=>s.loginStreak>=120},
			{id:'streak_240', cat:'streak', name:'Житель Зоны',         pts:100, threshold:240, statPath:["loginStreak"], check:s=>s.loginStreak>=240},
			{id:'streak_365', cat:'streak', name:'Старожитель Зоны',    pts:150, threshold:365, statPath:["loginStreak"], check:s=>s.loginStreak>=365},

			// Баттл-Пасс — Бател Пасс временно отключён (см. battlepass.js/vassilich.js), эти
			// достижения дормантны, пока bp_level заморожен — сработают сами, когда БП вернут.
			{id:'bp_50',  cat:'bp', name:'Трудяга',           pts:2,  threshold:50, statPath:["bpLevel"], check:s=>s.bpLevel>=50},
			{id:'bp_100', cat:'bp', name:'Прошаренный',       pts:3,  threshold:100, statPath:["bpLevel"], check:s=>s.bpLevel>=100},
			{id:'bp_200', cat:'bp', name:'Крепкий орешек',    pts:5,  threshold:200, statPath:["bpLevel"], check:s=>s.bpLevel>=200},
			{id:'bp_300', cat:'bp', name:'Повелитель заданий',pts:6,  threshold:300, statPath:["bpLevel"], check:s=>s.bpLevel>=300},
			{id:'bp_400', cat:'bp', name:'Уверенно',          pts:10, threshold:400, statPath:["bpLevel"], check:s=>s.bpLevel>=400},
			{id:'bp_500', cat:'bp', name:'Геймер',            pts:15, threshold:500, statPath:["bpLevel"], check:s=>s.bpLevel>=500},

			// Потратить голосов (VK-донат, bank.js.successDonat → votes_spent)
			{id:'vote_10',    cat:'spend_votes', name:'Школьник',        pts:1,  threshold:10, statPath:["votesSpent"], check:s=>s.votesSpent>=10},
			{id:'vote_50',    cat:'spend_votes', name:'Попрошайка',      pts:2,  threshold:50, statPath:["votesSpent"], check:s=>s.votesSpent>=50},
			{id:'vote_100',   cat:'spend_votes', name:'Процветающий',    pts:2,  threshold:100, statPath:["votesSpent"], check:s=>s.votesSpent>=100},
			{id:'vote_250',   cat:'spend_votes', name:'Не жалко',        pts:3,  threshold:250, statPath:["votesSpent"], check:s=>s.votesSpent>=250},
			{id:'vote_500',   cat:'spend_votes', name:'Закуп к рейду',   pts:4,  threshold:500, statPath:["votesSpent"], check:s=>s.votesSpent>=500},
			{id:'vote_1k',    cat:'spend_votes', name:'Слил пенсию',     pts:4,  threshold:1000, statPath:["votesSpent"], check:s=>s.votesSpent>=1000},
			{id:'vote_2k',    cat:'spend_votes', name:'Нашел заначку',   pts:5,  threshold:2000, statPath:["votesSpent"], check:s=>s.votesSpent>=2000},
			{id:'vote_5k',    cat:'spend_votes', name:'Богач',           pts:10, threshold:5000, statPath:["votesSpent"], check:s=>s.votesSpent>=5000},
			{id:'vote_10k',   cat:'spend_votes', name:'Мужик',           pts:10, threshold:10000, statPath:["votesSpent"], check:s=>s.votesSpent>=10000},
			{id:'vote_12k',   cat:'spend_votes', name:'Заводчанин',      pts:12, threshold:12000, statPath:["votesSpent"], check:s=>s.votesSpent>=12000},
			{id:'vote_15k',   cat:'spend_votes', name:'Как новый айфон', pts:12, threshold:15000, statPath:["votesSpent"], check:s=>s.votesSpent>=15000},
			{id:'vote_20k',   cat:'spend_votes', name:'Семья подождет',  pts:15, threshold:20000, statPath:["votesSpent"], check:s=>s.votesSpent>=20000},
			{id:'vote_35k',   cat:'spend_votes', name:'Кредитнулся',     pts:20, threshold:35000, statPath:["votesSpent"], check:s=>s.votesSpent>=35000},
			{id:'vote_50k',   cat:'spend_votes', name:'Антонов выручил', pts:50, threshold:50000, statPath:["votesSpent"], check:s=>s.votesSpent>=50000},

			// Потратить рубли (coins_spent — новый счётчик, см. проводку по всем местам трат)
			{id:'spc_500',   cat:'spend_coins', name:'Первый хабар',            pts:1,  threshold:500, statPath:["coinsSpent"], check:s=>s.coinsSpent>=500},
			{id:'spc_1k',    cat:'spend_coins', name:'Новичок у костра',        pts:1,  threshold:1000, statPath:["coinsSpent"], check:s=>s.coinsSpent>=1000},
			{id:'spc_2k5',   cat:'spend_coins', name:'Торговля с барыгой',      pts:1,  threshold:2500, statPath:["coinsSpent"], check:s=>s.coinsSpent>=2500},
			{id:'spc_5k',    cat:'spend_coins', name:'Свой среди сталкеров',    pts:1,  threshold:5000, statPath:["coinsSpent"], check:s=>s.coinsSpent>=5000},
			{id:'spc_10k',   cat:'spend_coins', name:'Зона принимает',         pts:2,  threshold:10000, statPath:["coinsSpent"], check:s=>s.coinsSpent>=10000},
			{id:'spc_25k',   cat:'spend_coins', name:'Опытный ходок',          pts:3,  threshold:25000, statPath:["coinsSpent"], check:s=>s.coinsSpent>=25000},
			{id:'spc_50k',   cat:'spend_coins', name:'Сталкер со стажем',      pts:4,  threshold:50000, statPath:["coinsSpent"], check:s=>s.coinsSpent>=50000},
			{id:'spc_100k',  cat:'spend_coins', name:'Зона кормит',            pts:6,  threshold:100000, statPath:["coinsSpent"], check:s=>s.coinsSpent>=100000},
			{id:'spc_150k',  cat:'spend_coins', name:'Охотник за артефактами', pts:8,  threshold:150000, statPath:["coinsSpent"], check:s=>s.coinsSpent>=150000},
			{id:'spc_300k',  cat:'spend_coins', name:'Тень Припяти',           pts:10, threshold:300000, statPath:["coinsSpent"], check:s=>s.coinsSpent>=300000},
			{id:'spc_500k',  cat:'spend_coins', name:'Легенда Зоны',           pts:12, threshold:500000, statPath:["coinsSpent"], check:s=>s.coinsSpent>=500000},
			{id:'spc_1kk',   cat:'spend_coins', name:'Богач Зоны',             pts:15, threshold:1000000, statPath:["coinsSpent"], check:s=>s.coinsSpent>=1000000},

			// Потратить тушенку (stew_spent — уже существовал и был проведён)
			{id:'sps_10',    cat:'spend_stew', name:'Первая банка',        pts:1,  threshold:10, statPath:["stewSpent"], check:s=>s.stewSpent>=10},
			{id:'sps_50',    cat:'spend_stew', name:'Запас на ночь',       pts:1,  threshold:50, statPath:["stewSpent"], check:s=>s.stewSpent>=50},
			{id:'sps_100',   cat:'spend_stew', name:'Не пропадешь',        pts:1,  threshold:100, statPath:["stewSpent"], check:s=>s.stewSpent>=100},
			{id:'sps_500',   cat:'spend_stew', name:'Мешок провизии',      pts:1,  threshold:500, statPath:["stewSpent"], check:s=>s.stewSpent>=500},
			{id:'sps_1k',    cat:'spend_stew', name:'Склад новичка',       pts:2,  threshold:1000, statPath:["stewSpent"], check:s=>s.stewSpent>=1000},
			{id:'sps_5k',    cat:'spend_stew', name:'Торговец у костра',   pts:2,  threshold:5000, statPath:["stewSpent"], check:s=>s.stewSpent>=5000},
			{id:'sps_10k',   cat:'spend_stew', name:'Затраты растут',      pts:3,  threshold:10000, statPath:["stewSpent"], check:s=>s.stewSpent>=10000},
			{id:'sps_25k',   cat:'spend_stew', name:'Барыга Зоны',         pts:3,  threshold:25000, statPath:["stewSpent"], check:s=>s.stewSpent>=25000},
			{id:'sps_50k',   cat:'spend_stew', name:'Серьезные затраты',   pts:5,  threshold:50000, statPath:["stewSpent"], check:s=>s.stewSpent>=50000},
			{id:'sps_100k',  cat:'spend_stew', name:'Король тушенки',      pts:5,  threshold:100000, statPath:["stewSpent"], check:s=>s.stewSpent>=100000},
			{id:'sps_250k',  cat:'spend_stew', name:'Оптовик Зоны',        pts:10, threshold:250000, statPath:["stewSpent"], check:s=>s.stewSpent>=250000},
			{id:'sps_500k',  cat:'spend_stew', name:'Хозяин склада',       pts:20, threshold:500000, statPath:["stewSpent"], check:s=>s.stewSpent>=500000},
			{id:'sps_1kk',   cat:'spend_stew', name:'Легендарный снабженец',pts:50, threshold:1000000, statPath:["stewSpent"], check:s=>s.stewSpent>=1000000},

			// Набрать друзей (udata['friends'] — комма-список ВК друзей, синхронизируемый
			// сервером для "РЕЙТИНГА УРОНА"; лучший доступный прокси для "друзей в игре",
			// приглашений/рефералки в игре не существует)
			{id:'fr_50',   cat:'friends', name:'Знают у костра',          pts:4,  threshold:50, statPath:["friendsCount"], check:s=>s.friendsCount>=50},
			{id:'fr_100',  cat:'friends', name:'Свои люди',               pts:5,  threshold:100, statPath:["friendsCount"], check:s=>s.friendsCount>=100},
			{id:'fr_250',  cat:'friends', name:'Ходишь не один',          pts:6,  threshold:250, statPath:["friendsCount"], check:s=>s.friendsCount>=250},
			{id:'fr_500',  cat:'friends', name:'Есть поддержка',          pts:7,  threshold:500, statPath:["friendsCount"], check:s=>s.friendsCount>=500},
			{id:'fr_1k',   cat:'friends', name:'Имя на слуху',            pts:8,  threshold:1000, statPath:["friendsCount"], check:s=>s.friendsCount>=1000},
			{id:'fr_2k5',  cat:'friends', name:'Связи по всей Зоне',      pts:9,  threshold:2500, statPath:["friendsCount"], check:s=>s.friendsCount>=2500},
			{id:'fr_5k',   cat:'friends', name:'Легенда среди сталкеров', pts:10, threshold:5000, statPath:["friendsCount"], check:s=>s.friendsCount>=5000},

			// Пройти достижения (мета — по общему счёту achievement_stars)
			{id:'meta_100',  cat:'meta', name:'Первые шаги в Зоне', pts:5,   threshold:100, statPath:["achPts"], check:s=>s.achPts>=100},
			{id:'meta_500',  cat:'meta', name:'Вошел в игру',       pts:10,  threshold:500, statPath:["achPts"], check:s=>s.achPts>=500},
			{id:'meta_1k',   cat:'meta', name:'Закаленный сталкер', pts:20,  threshold:1000, statPath:["achPts"], check:s=>s.achPts>=1000},
			{id:'meta_1k5',  cat:'meta', name:'Зона признает',      pts:30,  threshold:1500, statPath:["achPts"], check:s=>s.achPts>=1500},
			{id:'meta_2k',   cat:'meta', name:'Опыт не пропьешь',   pts:40,  threshold:2000, statPath:["achPts"], check:s=>s.achPts>=2000},
			{id:'meta_2k5',  cat:'meta', name:'Ветеран Зоны',       pts:50,  threshold:2500, statPath:["achPts"], check:s=>s.achPts>=2500},
			{id:'meta_3k',   cat:'meta', name:'Имя на слуху',       pts:100, threshold:3000, statPath:["achPts"], check:s=>s.achPts>=3000},
			{id:'meta_3k5',  cat:'meta', name:'Легенда ходоков',    pts:200, threshold:3500, statPath:["achPts"], check:s=>s.achPts>=3500},
			{id:'meta_4k',   cat:'meta', name:'Нечисть не страшна', pts:250, threshold:4000, statPath:["achPts"], check:s=>s.achPts>=4000},
		];

		this.earned = {}; // {id: true}
		this._loadFromUdata();
	}

	// --- Состояние из udata ---
	_state(){
		let kills = new Array(8).fill(0), soloKills = new Array(8).fill(0), speedKills = new Array(8).fill(0);
		// 24.09.2026: helper.safeParseJSON() — те же поля, что "приходят объектом сразу после
		// users.get" (Database::trueJSON()), см. большой коммент в universal_helper.js и
		// bosses-combat.js._loadFromUdata(). Голый JSON.parse() тут кидал исключение молча.
		{
			const bd = helper.safeParseJSON(udata['bosses_data'], {});
			if(bd.killsTotal) kills = bd.killsTotal;
		}
		soloKills  = helper.safeParseJSON(udata['solo_kills'],  soloKills)  || soloKills;
		speedKills = helper.safeParseJSON(udata['speed_kills'], speedKills) || speedKills;

		// Зачистки зоны
		const zoneClear = [0,0,0,0,0];
		try{
			const zd = helper.safeParseJSON(udata['zone'], {});
			for(let i=0;i<5;i++) if(zd[i]) zoneClear[i] = zd[i].cleared || 0;
		} catch(e){}

		// Заначки
		let stash = {};
		stash = helper.safeParseJSON(udata['stash_data'], {});

		// Уровни двора: 1 игра = 1 XP, 10 XP = 1 уровень (карты/рулетка)
		// Покер: нелинейная прогрессия, но для проверки ачивок достаточно счетчика игр
		const cardsGames   = parseInt(udata['cards_games']   || 0);
		const pokerGames   = parseInt(udata['poker_games']   || 0);
		const rouletteGames= parseInt(udata['roulette_games']|| 0);
		const cardsLvl     = Math.floor(cardsGames   / 10);
		const rouletteLvl  = Math.floor(rouletteGames/ 10);
		// Покер прогрессия: тиры по 10 уровней; XP на тир: 6,8,10,11,13,15,16,18,20,22
		const POKER_TIERS  = [6,8,10,11,13,15,16,18,20,22];
		let pokerLvl = 0, pokerXp = pokerGames;
		for(let t=0;t<10 && pokerXp>0;t++){
			const xpForTier = POKER_TIERS[t] * 10;
			if(pokerXp >= xpForTier){ pokerLvl += 10; pokerXp -= xpForTier; }
			else { pokerLvl += Math.floor(pokerXp / POKER_TIERS[t]); pokerXp = 0; }
		}
		pokerLvl = Math.min(100, pokerLvl);

		// Комбинации карт
		let cardsCombos = {};
		cardsCombos = helper.safeParseJSON(udata['cards_combos'], {});

		// Комбинации покера
		let pokerCombos = {};
		pokerCombos = helper.safeParseJSON(udata['poker_combos'], {});

		return {
			dmg:        parseInt(udata['total_damage']   || 0),
			auto:       parseInt(udata['auto_count']     || 0),
			gun:        parseInt(udata['gun_count']      || 0),
			mac:        parseInt(udata['machete_count']  || 0),
			kills,
			soloKills,
			speedKills,
			skillLvls:  window.skills ? skills.totalUnlockedLevels : 0,
			zoneClear,
			stash,
			energy:     parseInt(udata['energy_spent']   || 0),
			cardsLvl,
			cardsCombos,
			pokerLvl,
			pokerCombos,
			pokerSpichki:    parseInt(udata['poker_spichki']    || 0),
			rouletteLvl,
			rouletteSpichki: parseInt(udata['roulette_spichki'] || 0),

			// Экономические/прочие (15.09.2026) — текущие балансы (exp/cig/coins/stew
			// монотонно проверяются на КАЖДЫЙ _checkAll(), который почти всегда срабатывает
			// сразу после начисления — см. комментарий у onDamage/onEnergySpent/onDvorGame).
			exp:          parseInt(udata['exp']         || 0),
			cig:          parseInt(udata['cigarettes']  || 0),
			coinsBalance: parseInt(udata['coins']       || 0),
			stewBalance:  parseInt(udata['stew']        || 0),
			trainCount:   parseInt(udata['train_count']   || 0),
			// 04.10.2026: gymInvitesSent — приглашения в качалку, отправленные ЭТИМ игроком, см.
			// zaruba.php.pump() и коммент у cat 'gym' выше.
			gymInvitesSent: parseInt(udata['gym_invites_sent'] || 0),
			strXp:        parseInt(udata['str_xp_total']  || 0),
			// pvp_wins — пишет сервер при победе в "Зарубе" (04.10.2026, см. zaruba.php.fight()
			// и patch в player_profile.js._startZaruba()).
			pvpWins:      parseInt(udata['pvp_wins']      || 0),
			loginStreak:  parseInt(udata['login_streak']  || 0),
			bpLevel:      parseInt(udata['bp_level']      || 0),
			votesSpent:   parseInt(udata['votes_spent']   || 0),
			coinsSpent:   parseInt(udata['coins_spent']   || 0),
			stewSpent:    parseInt(udata['stew_spent']    || 0),
			friendsCount: (udata['friends'] || '').split(',').filter(Boolean).length,
			achPts:       parseInt(udata['achievement_stars'] || 0),
		};
	}

	// --- Триггеры ---
	onDamage(){
		this._checkAll();
	}

	onZoneClear(locIdx){
		this._checkAll();
	}

	// Аудит 17.09.2026: energy_spent считался ДВАЖДЫ за один чекпоинт зоны — zone.js уже
	// увеличивает udata['energy_spent'] сам ДО вызова этого триггера (тот же паттерн, что
	// onDamage()/onZoneClear() — вызывающий код отвечает за сам стат, триггер только проверяет
	// достижения), а эта строка молча делала это ещё раз поверх. Единственный вызывающий —
	// zone.js, отдельного места, которое полагалось бы на инкремент именно здесь, нет.
	onEnergySpent(amount){
		this._checkAll();
	}

	// 25.09.2026 (по прямому указанию — "нычки больше не классифицируются, отключи/закомментируй,
	// не удаляй"): единственный вызывающий (zone.js._attack()) больше не передаёт stashKey —
	// сервер не отдаёт тип находки. Тело метода закомментировано, не удалено — оживим вместе с
	// пер-типовыми достижениями (см. секцию 'stash' выше в this.list), когда появится арт.
	onStashCollect(stashKey){
		// let stash = {};
		// stash = helper.safeParseJSON(udata['stash_data'], {});
		// stash[stashKey] = (stash[stashKey] || 0) + 1;
		// udata['stash_data'] = JSON.stringify(stash);
		// this._checkAll();
	}

	onDvorLevel(game, level){ this._checkAll(); }

	onDvorGame(gameType, data){
		// data: {combo, spichki}
		if(gameType === 'cards'){
			udata['cards_games'] = (parseInt(udata['cards_games'] || 0) + 1).toString();
			if(data && data.combo){
				let c = {};
				c = helper.safeParseJSON(udata['cards_combos'], {});
				c[data.combo] = (c[data.combo] || 0) + 1;
				udata['cards_combos'] = JSON.stringify(c);
			}
		}
		if(gameType === 'poker'){
			udata['poker_games'] = (parseInt(udata['poker_games'] || 0) + 1).toString();
			if(data && data.combo){
				let c = {};
				c = helper.safeParseJSON(udata['poker_combos'], {});
				c[data.combo] = (c[data.combo] || 0) + 1;
				udata['poker_combos'] = JSON.stringify(c);
			}
			// poker_spichki comes exclusively from the poker.resolve() server patch.
		}
		if(gameType === 'roulette'){
			udata['roulette_games'] = (parseInt(udata['roulette_games'] || 0) + 1).toString();
			// 28.09.2026 (репорт — "спички рулетки выдаются вдвойне"): roulette_spichki уже
			// начисляется сервером (roulette.php._rollSlot()) и приходит в udata через
			// applyPatch(res.patch) ДО этого вызова (см. dvor-roulette.js._spinRoulette() /
			// dvor-roulette-screen.js._resolveRouletteNewScreen()). Эта строка складывала
			// reward.sp ЕЩЁ РАЗ поверх уже актуального серверного значения — тот же класс бага,
			// что уже был закрыт для poker_spichki (см. комментарий у 'poker' выше), просто
			// руки до roulette_spichki тогда не дошли. Убрано целиком; roulette_spichki
			// приходит исключительно из ответа roulette.spin().
		}
		this._checkAll();
	}

	onBossKill(idx, isSolo, fightMs){
		// 22.09.2026 (баг "считает 1 победу за 2", по прямому указанию): killsTotal сюда
		// приходит УЖЕ увеличенным сервером — bosses.php.claimKill() инкрементирует его и
		// применяется через applyPatch(res.patch) ДО вызова onBossKill (см.
		// bosses-combat.js._onDefeat). Повторный +1 здесь же задваивал счётчик. Инкремент
		// убран целиком — killsTotal больше нигде на клиенте не пишется.

		if(isSolo){
			try{
				const arr = helper.safeParseJSON(udata['solo_kills'], null) || new Array(8).fill(0);
				arr[idx] = (arr[idx] || 0) + 1;
				udata['solo_kills'] = JSON.stringify(arr);
			} catch(e){}
		}

		if(fightMs <= 3600000){
			try{
				const arr = helper.safeParseJSON(udata['speed_kills'], null) || new Array(8).fill(0);
				arr[idx] = (arr[idx] || 0) + 1;
				udata['speed_kills'] = JSON.stringify(arr);
			} catch(e){}
		}

		this._checkAll();
	}

	onWeaponBuy(type, qty){
		const map = {machete:'machete_count', gun:'gun_count', auto:'auto_count'};
		const key = map[type];
		if(key) udata[key] = (parseInt(udata[key] || 0) + qty).toString();
		this._checkAll();
	}

	onSkillUnlock(){
		this._checkAll();
	}

	// 19.09.2026 (баг найден: "купил много шмоток — ачивка о тратах появилась только после
	// победы над боссом"). У ЛЮБОЙ другой покупки в игре (оружие — onWeaponBuy, казино и т.д.)
	// есть свой триггер, который сразу дёргает _checkAll() — у shmot.js такого триггера не
	// было вообще, поэтому прогресс по coins_spent/stew_spent от покупки шмотки пере
	// проверялся только когда СЛУЧАЙНО срабатывал какой-то другой, не связанный триггер
	// (например onBossKill после победы) — то есть с опозданием на неопределённое время, а
	// не сразу после самой покупки.
	onShmotBuy(){
		this._checkAll();
	}

	// 23.09.2026 (перенос достижений на сервер, репорт "ачивки вылетают как попало") — этот
	// локальный проход больше НЕ пишет earned-карту/очки/патроны в udata и не показывает попапы
	// напрямую (та архитектура и была причиной минимум 3 задокументированных багов: двойной
	// счёт, потеря ачивки в окне автосейва при перезагрузке, запоздалая проверка после трат на
	// шмотки). Он остаётся только как ДЁШЕВЫЙ локальный пре-чек — как раньше, работает на каждый
	// вызов триггера (в т.ч. на каждый удар через onDamage), но при первом же пересечении
	// какого-либо порога не пишет ничего сам, а спрашивает сервер, что реально засчиталось (см.
	// _syncWithServer/achievements.php.sync()) — источник истины теперь сервер.
	_checkAll(){
		const st = this._state();
		let changed = false;
		for(const a of this.list){
			if(!this.earned[a.id] && a.check(st)){
				this.earned[a.id] = true;
				changed = true;
			}
		}
		if(changed) this._syncWithServer();
	}

	// Дожидается, пока свежие счётчики (dmg/auto/train_count и т.п. — те же поля, что читает
	// сервер) долетят до БД через общий автосейв (тот же приём "флаш СРАЗУ в критичный момент",
	// что раньше стоял прямо здесь — см. историю бага в git/старых комментариях), затем зовёт
	// achievements.sync и показывает попапы ТОЛЬКО по его ответу.
	_syncWithServer(){
		if(this._syncInFlight) return;
		this._syncInFlight = true;
		flushPlayerSave('achievement_earned', () => {
			if(!window.TS){ this._syncInFlight = false; return; }
			TS.php('achievements.sync', {}, (res) => {
				this._syncInFlight = false;
				if(!res || !res.patch){
					console.error('[achievements._syncWithServer] некорректный ответ сервера (нет patch):', JSON.stringify(res));
					return;
				}
				applyPatch(res.patch);
				this._loadFromUdata();
				// 04.10.2026 (по прямому указанию): если экран "Мои достижения" уже открыт,
				// он не знает о только что пришедшем server-подтверждении сам по себе —
				// см. коммент у Svod.refreshOpenAchievements() за полным разбором бага.
				if(window.svod && typeof svod.refreshOpenAchievements === 'function') svod.refreshOpenAchievements();

				const newlyEarned = (res.newly_earned || [])
					.map(a => this.list.find(x => x.id === a.id))
					.filter(Boolean);
				console.log('[achievements._syncWithServer] сервер подтвердил новых:', newlyEarned.length,
					'| ids:', newlyEarned.map(a => a.id).join(','));
				if(newlyEarned.length){
					// Аудит 17.09.2026 (по прямому указанию): если за один проход пересечено сразу
					// НЕСКОЛЬКО порогов одной темы (например, потратил разом 1000 энергии и
					// пересёк и en_500, и en_1k) — показываем попап ТОЛЬКО для самого высокого
					// порога темы (очки/бонусы уже начислены сервером за ВСЕ пересечённые пороги —
					// схлопывается только показ попапа, не начисление).
					const toShow = collapseNewlyEarnedForPopup(newlyEarned);
					console.log('[achievements._syncWithServer] попапов после схлопывания тем:', toShow.length);
					toShow.forEach(a => this._openAchievementPopup(a));
					if(window.iface && typeof iface._updateYashikScreen === 'function') iface._updateYashikScreen();
				}
			}, (err) => {
				this._syncInFlight = false;
				console.error('[achievements._syncWithServer] ошибка сервера:', JSON.stringify(err));
			});
		});
	}

	getTotalStars(){
		return parseInt(udata['achievement_stars'] || 0);
	}

	_loadFromUdata(){
		console.log('[achievements._loadFromUdata] udata[\'achievements\'] сырое:', udata && udata['achievements']);
		if(!udata || !udata['achievements']) return;
		try{
			this.earned = helper.safeParseJSON(udata['achievements'], {}) || {};
			console.log('[achievements._loadFromUdata] загружено earned.length:', Object.keys(this.earned).length,
				'| ids:', Object.keys(this.earned).join(','));
		} catch(e){}
	}
}

attachAchievementPopup(Achievements.prototype);
