import Notifications  from '../game/notifications.js';
import Skills         from '../game/skills.js';
import Achievements   from '../game/achievements.js';
import Interface from '../game/interface.js';
import Home from '../game/home.js';
import Bank from '../game/bank.js';
import Bosses    from '../game/bosses.js';
import Zone      from '../game/zone.js';
import Vassilich from '../game/vassilich.js';
import Weapons   from '../game/weapons.js';
import Shmot     from '../game/shmot.js';
import Gangs     from '../game/gangs.js';
import Dvor      from '../game/dvor.js';
import Base      from '../game/base.js';
import Habar     from '../game/habar.js';
import Top       from '../game/top.js';
import Svod      from '../game/svod.js';
import Zadaniya    from '../game/zadaniya.js';
import Battlepass  from '../game/battlepass.js';
import Hapuga      from '../game/hapuga.js';
import Bot         from '../game/bot.js';
import Hata        from '../game/shell/overlays/hata.js';
import Onboarding  from '../game/onboarding.js';

export default class ModuleControl{

    constructor(){
    	this.flags = {};

    	this.names = {};

        this.unical = {};

        this.temp = [];
    }

    //LOADING FUNCTIONS

	load(name, callback){
        // Имя FLA: из content_links или конвенция {name}_elements
        const fla = content_links[name] || (name + '_elements');

        // 26.09.2026 (репорт со скриншотом — игра перестала грузиться на реальном
        // VK-вебвью, "Не удалось загрузить игру"): предыдущая правка (риск бесконечного
        // зависания при 404/сетевом сбое) угадывала сбой по таймеру — 60 попыток×50мс=3с,
        // после чего безусловно показывала ошибку. На медленной сети/после VK Bridge
        // round-trip (getServerTime → security.getToken, ДО этого вызова) 3с оказалось
        // МЕНЬШЕ обычного времени загрузки — скрипт успешно доезжал позже, но таймер уже
        // увольнял игру. Реальный сбой (404/сеть) теперь ловится через onerror самого
        // script-тега (см. window.include в index.js) — мгновенно и точно, а не по
        // истечении произвольного времени. Опрос window[fla] остаётся БЕЗ верхнего лимита
        // попыток — это снова безопасно, т.к. настоящий сбой прерывает ожидание через
        // failed-флаг ниже, а не через угасание таймера.
        let failed = false;
        const onLoadError = () => {
            if(failed) return;
            failed = true;
            console.error('[module_control.load] скрипт "' + fla + '.min.js" не загрузился (сетевая ошибка/404)');
            if(window.notify) notify.showResult({text:'Не удалось загрузить игру. Обновите страницу'}, 0);
            else alert('Не удалось загрузить игру. Обновите страницу.');
        };

        const doLoad = () => {
            if(failed) return;
            if(!window[fla]){
                setTimeout(doLoad, 50);
                return;
            }
            window[fla].setup(PIXI.animate);
            scene.load(window[fla], e => {
                this.flags[name] = true;
                this.names[name] = e;
                this.nulledXY(e);
                if(callback)callback();
            });
        };

        // Если скрипт еще не загружен — include (с onerror-детектором сбоя) и ждем
        if(!window[fla]) include('libs/' + fla + '.min.js?' + session_hash, onLoadError);
        doLoad();
    }

	loadNotify(callback){
    	this.load('notify', callback);
    }

	loadInterface(callback){
    	this.load('interface', callback);
    }

	loadHome(callback){
    	this.load('home', callback);
    }

	loadBosses(callback){
		this.load('bosses', callback);
	}

	constructNotify(){
    	window.notify = new Notifications(this.names['notify'].result);
    }

	// Skills и Achievements не имеют FLA — создаются сразу после udata готова
	constructSkills(){
		window.skills = new Skills();
	}

	constructAchievements(){
		window.achievements = new Achievements();
	}

	constructInterface(){
		window.iface = new Interface(
			this.names['interface'].iface_up,
			this.names['interface'].iface_down,
			this.names['interface'].iface_left,
			this.names['interface'].iface_right
		);

		window.bank = new Bank(this.names['interface'].bank_mov);
		window.hata = new Hata();
		window.base = window.hata;
		window.habar = new Habar(null); // Pre-construct: PIXI-based, no FLA needed
    }

	constructHome(){
		window.home = new Home(this.names['home'].home_full);
    }

	constructBosses(){
		window.bosses = new Bosses(this.names['bosses']);
	}

	loadZone(callback){
		this.load('zone', callback);
	}

	constructZone(){
		window.zone = new Zone(this.names['zone']);
	}

	loadVassilich(callback){
		this.load('vassilich', callback);
	}

	constructVassilich(){
		window.vassilich = new Vassilich(this.names['vassilich']);
	}

	loadWeapons(callback){
		this.load('weapons', callback);
	}

	constructWeapons(){
		window.Weapons = Weapons;
		window.weapons = new Weapons(this.names['weapons']);
	}

	loadShmot(callback){
		this.load('shmot', callback);
	}

	constructShmot(){
		window.shmot = new Shmot(this.names['shmot']);
		// home.init() рисует персонажа СРАЗУ при загрузке (index/load-sequence.js), а shmot
		// грузится в фоне на несколько секунд позже (_bgModules) — на тот момент window.shmot
		// ещё не существовал, updateClothes() внутри home.init() молча выходил без отрисовки,
		// и персонаж на главном экране оставался голым, пока игрок сам что-то не переодевал.
		if(window.home) home.updateClothes();

		// 19.09.2026 (репорт "достижения показываются кучкой после какого-то действия, а не
		// сразу"): часть статов (например login_streak — считается в preloader.js ДО того, как
		// готов игровой экран) не имеет собственного вызывающего действия в игре вообще — их
		// достижения не показывались, пока НЕ СЛУЧАЙНО срабатывал вообще любой другой триггер
		// (первая покупка/бой/etc.), то есть с произвольной задержкой. Этот момент — первая
		// точка после старта, где gарантированно готовы И udata (achievements создаётся сразу
		// после неё), И notify/iface (home уже отрисован, см. проверку выше) — безопасное место
		// для стартовой проверки, без риска показать попап на ещё не готовом экране.
		if(window.achievements) achievements._checkAll();

		// 30.09.2026 (обучение, по прямому указанию): та же "всё готово" точка, что и первый
		// achievements._checkAll() выше — udata/notify/iface/home уже гарантированно готовы,
		// безопасно решать, показывать ли обучение.
		window.onboarding = new Onboarding();
		onboarding.start();

		// 21.09.2026 (репорт "поиграл, вышел, зашёл снова — и разом вылезло много достижений за
		// прошлую сессию"): та же причина, что и с login_streak выше, но шире — ЛЮБОЙ стат,
		// который экономические/статусные достижения читают напрямую из udata (this._state()),
		// монотонно "почти всегда" проверяется через точечные вызовы achievements._checkAll()/
		// onXxx() у конкретных действий (base.js/bank.js/hapuga.js/gangs.js/vassilich.js/
		// bosses-combat.js/zone.js) — а если у КОНКРЕТНОГО источника изменения этого стата
		// такого вызова нет (или он появится позже, как только что было с bug'ом "не появляется
		// кнопка Собрать прибыль" в zone_screen.js), достижение просто ждёт СЛЕДУЮЩЕГО
		// случайного triggера — вплоть до следующей перезагрузки страницы. Аудит всех
		// currency-начисляющих мест ради 100% покрытия точечными вызовами — большая, отдельная
		// работа; пока подстраховываемся периодическим фоновым догоняющим чеком (раз в 30 сек,
		// пока страница открыта) — достижение теперь появится максимум с 30-секундной
		// задержкой после реального пересечения порога, а не только при следующей загрузке.
		setInterval(() => { if(window.achievements) achievements._checkAll(); }, 30000);
	}

	loadGangs(callback){
		this.load('gangs', callback);
	}

	constructGangs(){
		window.Gangs = Gangs;
		window.gangs = new Gangs(this.names['gangs']);
	}

	loadDvor(callback){
		this.load('dvor', callback);
	}

	constructDvor(){
		window.dvor = new Dvor(this.names['dvor']);
	}

	loadBase(callback){
		this.load('base', callback);
	}

	constructBase(){
		window.Base = Base;
		window.base = new Base(this.names['base']);
	}

	loadHabar(callback){
		this.load('habar', callback);
	}

	constructHabar(){
		window.habar = new Habar(this.names['habar']);
	}

	loadTop(callback){
		this.load('top', callback);
	}

	constructTop(){
		window.leaderboard = new Top(this.names['top']);
	}

	loadSvod(callback){
		this.load('svod', callback);
	}

	constructSvod(){
		window.svod = new Svod(this.names['svod']);
	}

	loadZadaniya(callback){
		this.load('zadaniya', callback);
	}

	constructZadaniya(){
		window.zadaniya = new Zadaniya(this.names['zadaniya']);
	}

	loadBattlepass(callback){
		this.load('battlepass', callback);
	}

	constructBattlepass(){
		window.battlepass = new Battlepass(this.names['battlepass']);
	}

	loadHapuga(callback){
		this.load('hapuga', callback);
	}

	constructHapuga(){
		window.hapuga = new Hapuga(this.names['hapuga']);
	}

	loadBot(callback){
		this.load('bot', callback);
	}

	constructBot(){
		window.bot = new Bot(this.names['bot']);
	}


    //SERVICE FUNCTIONS

    nulledXY(e){
    	let keys = Object.keys(e);
    	for(let i = 0; i < keys.length; i++)if(e[keys[i]] !== null && typeof e[keys[i]] == 'object')e[keys[i]].x = e[keys[i]].y = 0;

        while(e.children.length)e.removeChildAt(0);
    }

	checkFlags(flags, callback){
		for(let i = 0; i < flags.length; i++){
			if(!this.flags[flags[i]]){
				this['load'+this.ucFirst(flags[i])](()=>{
					if(this['construct'+this.ucFirst(flags[i])])this['construct'+this.ucFirst(flags[i])]();

					this.checkFlags(flags, callback);
				});

				return;
			}
		}

        for(let n = 0; n < flags.length; n++)if(!this.flags[flags[n]])return;

        if(callback)callback();
	}

	ucFirst(str){
	  	if (!str) return str;

	  	return str[0].toUpperCase() + str.slice(1);
	}
}