import UniHelp from './modules/universal_helper.js';
import ModuleControl from './modules/module_control.js';
import Server from './modules/server.js';
import Timers from './modules/timers.js';
import Preloader from './game/preloader.js';
import { setupGameBoot } from './game/game-boot.js';
import { setupDebugTools } from './game/debug-tools.js';
import { installAssetVersion } from './modules/asset-version.js';
import { installYoFix } from './modules/text-sanitize.js';
import { installPlayerPersistence } from './modules/player-save.js';
import { startPreloaderVisual } from './modules/preloader-visual.js';
import { installMobileViewport, viewportMetrics, onViewportChange } from './modules/mobile-viewport.js';
import { applyRotatedCanvasStyle, clearRotatedCanvasStyle, mapPositionToPointRotated } from './modules/forced-landscape.js';
import { installAppLifecyclePause } from './modules/app-lifecycle.js';
import { registerLaunch } from './modules/friends-scope-gate.js';

const _VER = (() => {
    const s = document.querySelector('script[src*="index.js"]');
    const m = s && s.src.match(/[?&]v=(\d+)/);
    return m ? m[1] : '?';
})();
installAssetVersion(_VER);
installYoFix();
console.log('%c ПРИПЯТЬ v' + _VER + ' ', 'background:#cc2222;color:#fff;font-size:18px;font-weight:bold;padding:4px 8px;border-radius:4px;');
(function(){
    // 27.09.2026 (баг со скриншота — плашка "v508" видна в правом верхнем углу поверх
    // прелоадера): раньше плашка появлялась СРАЗУ при старте скрипта (z-index:99999 — выше
    // и видео preloader-visual.js, и компаса/прогресс-бара из index.html, у которых z-index
    // 9999/10000) и пряталась через фиксированные 15с от старта скрипта. Реальная загрузка
    // (VK API + JSON + текстуры + 16 фоновых модулей, см. game-boot.js) почти всегда занимает
    // дольше 15с, поэтому игрок гарантированно видел номер версии весь этап прелоадера.
    // Теперь плашка создаётся СКРЫТОЙ и показывается только когда прелоадер реально скрыт —
    // сигнал даёт window._onPreloaderHidden(), вызываемый из preloader-visual.js._remove()
    // (тот самый момент, когда видео/компас на чистой границе цикла убираются с экрана после
    // готовности игры). 15-секундный автоскрытие теперь отсчитывается от этого момента, а не
    // от старта скрипта — поведение плашки ПОСЛЕ загрузки не меняется, меняется только момент
    // её первого появления.
    const d = document.createElement('div');
    d.textContent = 'v' + _VER;
    // 27.09.2026: top/right через calc(... + env(safe-area-inset-*)) — на телефонах с вырезом
    // плашка иначе оказывалась частично под "бровью".
    d.style.cssText = 'position:fixed;top:calc(6px + env(safe-area-inset-top));right:calc(8px + env(safe-area-inset-right));background:rgba(180,0,0,0.85);color:#fff;font-size:13px;font-weight:bold;z-index:99999;padding:2px 8px;border-radius:4px;pointer-events:none;font-family:monospace;display:none';
    document.body.appendChild(d);
    // 30.09.2026 (баг по живому тесту обучения — "первая озвучка Седого запускается ещё ДО
    // того, как видео-прелоадер реально закончилось"): onboarding.js раньше стартовал прямо из
    // module_control.js.constructShmot() — того момента, когда игровые данные готовы, а не
    // когда прелоадер ВИЗУАЛЬНО убран (preloader-visual.js._remove() ждёт ещё и чистой границы
    // цикла видео). Оба события независимы и могут наступить в любом порядке. Превращаем
    // window._onPreloaderHidden в регистр колбэков (а не одноразовую функцию только для
    // плашки версии) — onboarding.js подписывается через window.onPreloaderHidden(cb) и не
    // показывает попап/не включает озвучку, пока видео реально не исчезло с экрана.
    window._preloaderHiddenFired = false;
    const _preloaderHiddenListeners = [];
    window._onPreloaderHidden = () => {
        console.log('[index.js] прелоадер скрыт — показываем плашку версии v' + _VER);
        window._preloaderHiddenFired = true;
        d.style.display = 'block';
        setTimeout(()=>{ d.style.display='none'; }, 15000);
        _preloaderHiddenListeners.forEach(cb => { try{ cb(); }catch(e){ console.error('[index.js] onPreloaderHidden колбэк упал:', e); } });
        _preloaderHiddenListeners.length = 0;
    };
    window.onPreloaderHidden = (cb) => {
        if(window._preloaderHiddenFired) cb();
        else _preloaderHiddenListeners.push(cb);
    };
})();

window.bridge = vkBridge;
// Аудит безопасности 17.09.2026: раньше здесь было true БЕЗУСЛОВНО — в проде это давало
// любому игроку доступ к GIVE_MILLION()/RUN_TESTS() прямо из консоли браузера, т.к.
// setupDebugTools() ниже вызывается один раз при загрузке страницы, только если
// debug_mode===true (флаг, выставленный в консоли ПОСЛЕ загрузки, уже не успевает —
// setupDebugTools() к тому моменту не вызовется). Для локальной отладки — временно
// поставить true здесь и пересобрать (npm run build), как с любой другой правкой кода;
// сами функции GIVE_MILLION/RUN_TESTS из сборки не убраны, просто больше не включены по
// умолчанию для всех игроков. Дополнительный барьер (на случай если этот флаг всё же
// обойдут) — сервер (users.php.save()) теперь сам отклоняет неправдоподобные значения
// основных валют/прогресса, даже если GIVE_MILLION() успеет отработать на клиенте.
window.debug_mode = false;

// 26.09.2026 (по прямому указанию, перед модерацией VK) — весь console.log/warn/error/info
// по всему проекту (Правило №8 CLAUDE.md, сотни вызовов во всех модулях) заглушается для
// игроков ЗДЕСЬ, глобальной подменой самих console.* методов, а не построчным удалением каждого
// вызова — сами console.log(...) в коде НЕ убраны (по тому же принципу, что и dev-панель/
// редакторы позиций ниже: "убрать от игроков, не удалять код"), поэтому детальная отладка
// (Правило №8) продолжает работать локально — включить обратно достаточно поставить
// window.debug_mode = true СТРОКОЙ ВЫШЕ и пересобрать (npm run build), как с любой другой
// правкой кода. Настоящий баннер "ПРИПЯТЬ vN" в титульной строке ниже — единственное
// исключение (не через console.log, а собственным CSS-блоком на странице), поэтому версия
// в углу экрана видна игроку как и раньше.
if(!window.debug_mode){
	const _noop = () => {};
	console.log = _noop;
	console.warn = _noop;
	console.error = _noop;
	console.info = _noop;
	console.debug = _noop;
}

window.session_hash = md5(Math.random().toString());
// Модерация VK (30.09.2026, п.1): считаем запуски, чтобы preloader.js мог решить, можно ли
// сейчас фоново спрашивать scope 'friends' (не раньше 2-го запуска) — см. friends-scope-gate.js.
registerLaunch();

let partsData = decodeURIComponent(document.location.search.substr(1)).split("&");
let userDataVk = {}, currentData;
for(let i = 0; i < partsData.length; i++) {
	currentData = partsData[i].split('=');
	userDataVk[currentData[0]] = currentData[1];
}

bridge.send("VKWebAppInit").then(e => window.VKinit = true).catch(() => { window.VKinit = true; });

// 28.09.2026 (адаптив под мобильные): в iOS-клиенте VK горизонтальный свайп от левого края
// экрана — системный жест "назад", который сворачивает/закрывает мини-приложение. В игре
// горизонтальные драги есть (перетаскивание бегунков скролла, будущий свайп по спискам), и
// начатый близко к краю драг выкидывал игрока из игры прямо посреди боя. VKWebAppSetSwipeSettings
// с history:false запрещает клиенту VK перехватывать этот жест — страницей управляет игра.
// Метод есть не во всех версиях клиента (и вообще отсутствует в вебе) — .catch() обязателен,
// иначе неподдерживаемый метод роняет промис в необработанное исключение.
bridge.send('VKWebAppSetSwipeSettings', { history: false })
    .then(() => console.log('[index.js] VKWebAppSetSwipeSettings: системный свайп-назад отключён'))
    .catch(e => console.log('[index.js] VKWebAppSetSwipeSettings недоступен (норма для веба/старых клиентов):', e && e.error_data));

window.root = window.udata = window.pre_control = null;
window.non_app_friends = [];
// Наличие launch-token не означает, что в ЭТОЙ сессии уже загружен список друзей.
// Это отдельное состояние выставляет только Preloader._loadFriends() после успеха VK API.
window._friendsScopeReady = false;
installPlayerPersistence();
// Модерация VK (30.09.2026, п.6): звук/рендер должны останавливаться при сворачивании
// приложения — см. modules/app-lifecycle.js.
installAppLifecyclePause();

window.vk_params = userDataVk;
window.VK_token = vk_params['access_token'];
window.VK_version = '5.132';

window.my_server = 'https://pripyat-game.ru/server';

window.bridge = bridge;
window.Timers = Timers;

window.helper = new UniHelp();
window.modules = new ModuleControl();
window.TS = new Server([vk_params['vk_app_id'], vk_params['vk_user_id'], my_server]);

window.errors = [{text:'Undefined function', code:34}, {text:'Invalid request', code:35}, {text:'Output have invalid format', code:36}];
window.bitmaps50 = {id:[], bm:[]};
window.null_photo50 = my_server+'/images/noicon.png';

// 27.09.2026: раньше здесь стояла проверка isMobile только по User-Agent (пропускала iPad на
// iPadOS 13+ — он отдаёт UA обычного Mac — и планшеты на Windows), и флаг никем не читался.
// Теперь определение живёт в modules/mobile-viewport.js (UA + maxTouchPoints + pointer:coarse),
// туда же переехали безопасная зона экрана, гашение системных жестов и все события пересчёта
// размера канваса. window.isMobile выставляет installMobileViewport() — имя флага сохранено.
installMobileViewport();
// 03.10.2026: installRotateOverlay()/setRotateOverlay() (экран "поверните устройство") убраны
// отсюда — портретный мобильный теперь форс-поворачивается через CSS, см. resize() ниже и
// modules/forced-landscape.js. Сам modules/rotate-overlay.js не удалён (на случай отката).

window.canv = document.createElement("canvas");
canv.id = "stage";
canv.setAttribute("style", "display: block; position: absolute; top: 0; left: 0;");
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
// 30.09.2026 (НАЙДЕН РЕАЛЬНЫЙ БАГ — 3 дня жалоб "фон/колесо/связка не отображаются", не имел
// отношения к кэшу вообще): здесь ЕЩЁ ОДНОЙ строкой ставился инлайн body.style.background = '#000' —
// инлайн-стиль ВСЕГДА побеждает правило из <style> в index.html (там же — та же заливка #000
// как fallback, ПЛЮС картинка side-background.png поверх неё, см. комментарий там от
// 29-30.09.2026). Эта строка перезаписывала body.background на голую заливку СРАЗУ на каждой
// загрузке страницы, целиком стирая url(...)/background-size из CSS-правила — картинка физически
// не могла отобразиться НИ ПРИ КАКОМ состоянии кэша, потому что инлайн-стиль её каждый раз убирал
// уже ПОСЛЕ того, как браузер успевал её применить. К колесу рулетки/связке ключей эта конкретная
// строка отношения не имеет (те через PIXI.Texture, не CSS body-background) — их разбор продолжается
// отдельно (добавлено логирование ниже по всей цепочке, см. dvor-roulette-screen.js/shmot.js).
document.body.appendChild(canv);

// Визуал загрузочного экрана — видео (preloader.mp4), играется один раз; если ролик кончится
// раньше игры — показывается компас загрузки до реальной готовности (см. preloader-visual.js).
// Вся логика вынесена в отдельный модуль (см. коммент там) — самодостаточный кусок, не часть
// игровой модели window.*, не место ему разрастаться прямо в точке входа.
startPreloaderVisual();

// Регистрируем window.endLoadGame и window.loadGame
setupGameBoot();
if(window.debug_mode) setupDebugTools();

// Запускаем предзагрузку PNG сразу — параллельно с анимацией и VK API-вызовами.
// К моменту вызова endLoadGame() большинство текстур уже в PIXI-кэше → _showGame() срабатывает мгновенно.
setTimeout(() => {
    if(window._startEarlyPngPreload && window.PIXI) {
        console.log('[index.js] early PNG preload:', window._allGamePngs.length, 'files');
        try { window._startEarlyPngPreload(); } catch(e) {
            console.error('[index.js] early PNG preload failed:', e);
        }
    }
}, 300);

let initPreloader = () => {
	window.scene = new PIXI.animate.Scene({
		width: 1280,
		height: 720,
		view: canv,
		antialias: true,
		transparent: true
	});

	function resize() {
		const ratio = 1280 / 720;
		// 27.09.2026: было window.innerWidth/innerHeight напрямую. Теперь доступная область
		// приходит из modules/mobile-viewport.js — те же числа минус безопасная зона экрана
		// (вырез камеры, "бровь", системная полоса жестов): без этого канвас залезал под них
		// и углы игры (кнопка выхода, HUD) было физически нечем нажать. На устройствах без
		// вырезов safe-area = 0 и поведение ровно прежнее.
		const vp = viewportMetrics();

		// 28.09.2026 (блокер №1 адаптива, вариант A): на портретном мобильном экране letterbox
		// 16:9 даёт узкую полосу через весь экран. 03.10.2026 (по прямому указанию — "пусть игра
		// сама разворачивает экран в горизонт, а не через кнопку поворота"): вместо прежнего
		// экрана "поверните устройство" канвас теперь поворачивается через CSS transform —
		// см. modules/forced-landscape.js (там же разбор, почему раньше это ломало клики и как
		// теперь починено — свой mapPositionToPoint вместо штатного).
		const needsRotate = window.isMobile && vp.portrait;
		canv.style.display = 'block';

		let w, h;
		if(needsRotate){
			({ w, h } = applyRotatedCanvasStyle(canv, vp));
		} else {
			clearRotatedCanvasStyle(canv);
			w = vp.w;
			h = vp.h;
			if(w / h > ratio){ w = h * ratio; } else { h = w / ratio; }
			canv.style.width  = w + "px";
			canv.style.height = h + "px";
			canv.style.left   = (vp.left + (vp.w - w) / 2) + "px";
			canv.style.top    = (vp.top  + (vp.h - h) / 2) + "px";
		}

		// Свой обработчик координат кликов/тача переключается между повёрнутым/обычным режимом
		// по needsRotate; оригинальная реализация PIXI сохраняется один раз в
		// ia._defaultMapPositionToPoint и возвращается обратно, как только поворот не нужен.
		if(window.scene && scene.renderer && scene.renderer.plugins && scene.renderer.plugins.interaction){
			const ia = scene.renderer.plugins.interaction;
			if(!ia._defaultMapPositionToPoint) ia._defaultMapPositionToPoint = ia.mapPositionToPoint.bind(ia);
			if(needsRotate && !ia._rotatedMapInstalled){
				ia.mapPositionToPoint = mapPositionToPointRotated(canv);
				ia._rotatedMapInstalled = true;
				console.log('[index.js.resize] включён повёрнутый mapPositionToPoint (форс-ландшафт)');
			} else if(!needsRotate && ia._rotatedMapInstalled){
				ia.mapPositionToPoint = ia._defaultMapPositionToPoint;
				ia._rotatedMapInstalled = false;
				console.log('[index.js.resize] возвращён штатный mapPositionToPoint');
			}
		}

		// 18.09.2026 (репорт пользователя — "разрешение совпадает, но качество плохое"):
		// PIXI.animate.Scene создавался без resolution → внутренний буфер рендера всегда
		// РОВНО 1280×720 "сырых" пикселей, а CSS-размер canv.style.width/height (см. выше)
		// почти всегда БОЛЬШЕ (растягивается под окно браузера) + ещё раз множится на
		// devicePixelRatio физическим экраном — итог: браузер дважды увеличивает уже
		// готовую растровую картинку, размывая буквально всё в игре (не отдельные файлы).
		// Пересчитываем resolution рендера под реальный физический размер CSS-канваса —
		// логические координаты (1280×720, всё позиционирование спрайтов) не меняются,
		// меняется только плотность пикселей в буфере.
		if(window.scene && scene.renderer){
			const dpr = window.devicePixelRatio || 1;
			const targetRes = Math.max(1, (w * dpr) / 1280);
			if(Math.abs(scene.renderer.resolution - targetRes) > 0.05){
				scene.renderer.resolution = targetRes;
				scene.renderer.resize(1280, 720);
				// 18.09.2026 (репорт пользователя — "вся кликабельность съехала"): у PIXI
				// InteractionManager (обработка кликов/тача) СВОЁ ОТДЕЛЬНОЕ поле resolution,
				// не связанное с renderer.resolution — оно выставляется один раз при создании
				// плагина и НЕ обновляется автоматически, если менять renderer.resolution
				// потом вручную (как здесь). Из-за рассинхрона клики регистрировались по
				// старому масштабу (1), а спрайты рисовались по новому — отсюда смещение.
				// Обновляем resolution интеракшна вручную вслед за рендером.
				if(scene.renderer.plugins && scene.renderer.plugins.interaction){
					scene.renderer.plugins.interaction.resolution = targetRes;
				}
				console.log('[index.js.resize] renderer.resolution обновлён:', targetRes.toFixed(3), '(dpr=' + dpr + ', cssW=' + Math.round(w) + ')');
			}
		}
	}

	// 27.09.2026: было window.addEventListener("resize", resize) — на телефоне этого мало.
	// onViewportChange подписывает пересчёт сразу на resize + orientationchange +
	// visualViewport, с дебаунсом по кадру и повторными пересчётами после поворота экрана
	// (iOS отдаёт актуальные innerWidth/innerHeight не в момент события, а позже) —
	// подробности в комментарии modules/mobile-viewport.js.
	onViewportChange(resize);
	resize();

	window.mouseXY = scene.renderer.plugins.interaction.mouse.global;

	try{
		window['preloader'].setup(PIXI.animate);
		scene.load(window['preloader'], e => {
			scene.stage.interactive = true;
			window.root = scene.stage;
			include('libs/notify.min.js?'+session_hash);
			pre_control = new Preloader(e);
			gameConnect();
		});
	} catch(e){ return; }
};

function gameConnect(){
    let _int = null;
    if(!window.VKinit){
        _int = setInterval(()=>{ clearInterval(_int); gameConnect(); }, 1000);
    } else {
        pre_control.initTimer();
    }
}

initPreloader();

// ── Сервисные функции ─────────────────────────────────────────────────────────

window.setButton = (e)=>{
	e.interactive = true;
	e.buttonMode = true;
	e._totalFrames = e._totalFrames || 1;
	if(e._totalFrames < 2) return;
	e.gotoAndStop(0);
	e.on('mouseover', ()=>e.gotoAndStop(1));
	e.on('mouseout',  ()=>e.gotoAndStop(0));
};

window.getLib = (name)=>{ return new root[name].constructor(); };

// 26.09.2026 (репорт — игра перестала грузиться, "Не удалось загрузить игру. Обновите
// страницу" на реальном мобильном VK-вебвью): module_control.js.load() раньше определял
// реальный сбой загрузки скрипта угадыванием по таймеру (3с) — на медленной сети/после
// VK Bridge round-trip скрипт мог легитимно загружаться дольше и всё равно успешно
// доехать, но таймер уже увольнял игру. onerror опционален и необязателен для старых мест
// вызова (game-boot.js/preloader.js), которым он не нужен — событие onerror самого
// script-тега даёт настоящий сигнал сбоя (404/сеть), а не догадку по времени.
window.include = (url, onerror)=>{
    let script = document.createElement('script');
    script.src = url;
    script.type = 'text/javascript';
    if(typeof onerror === 'function') script.onerror = onerror;
    document.getElementsByTagName('head')[0].appendChild(script);
};

window.include_preload = (url, type = "font/ttf")=>{
    let link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = 'font';
    link.type = type;
    link.crossorigin = true;
    document.getElementsByTagName('head')[0].appendChild(link);
};

window.setTextStyle = (txt, dop_params = {})=>{
	let arr = Object.keys(dop_params);
	for(let i = 0; i < arr.length; i++) txt.style[arr[i]] = dop_params[arr[i]];
};

PIXI.settings.ROUND_PIXELS = true;
