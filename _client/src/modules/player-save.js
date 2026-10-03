/**
 * Единое сохранение состояния игрока.
 *
 * Большая часть старых игровых модулей меняет поля udata напрямую. Раньше эти
 * изменения попадали в БД только по общему таймеру раз в минуту, поэтому оружие,
 * одежда и прогресс откатывались при быстрой перезагрузке или закрытии Mini App.
 * Proxy перехватывает все изменения верхнего уровня udata и объединяет их в один
 * запрос. Все составные состояния в игре (weapons, shmot, zone и т.д.) перед
 * записью в udata сериализуются в строку, поэтому перехвата верхнего уровня
 * достаточно.
 */

const SAVE_DELAY_MS = 500;
const RETRY_DELAY_MS = 2000;
const PERIODIC_FLUSH_MS = 30000;
// 26.09.2026 (аудит перед модерацией VK — безлимитные ретраи автосейва): раньше ошибка сети/
// сессии заставляла flushPlayerSave ретраить КАЖДЫЕ 2с бесконечно, без единого сообщения
// игроку. 5 подряд неудач (10с) — явно устойчивая проблема, а не разовый сетевой сбой.
const MAX_RETRIES = 5;

let saveTimer = null;
let retryTimer = null;
let retryCount = 0;
let revision = 0;
let savedRevision = 0;
let lifecycleInstalled = false;
// 24.09.2026 (баг найден по прямому указанию — "не сохраняются ключи/лимиты/последний убийца
// боссов"): подтверждено логами сервера (saveVerifyMismatch:true в bosses.claimKill/attack) —
// пока bosses.startFight()/attack()/claimKill() пишут bosses_data НАПРЯМУЮ через
// Gameops::saveUser() (в обход этого дебаунса), ЛЮБОЙ другой автосейв (debounce/periodic/
// hidden/pagehide), запланированный НЕЗАВИСИМОЙ мутацией udata (например, тиком регенерации
// энергии) ровно в этом окне, всё ещё шлёт СТАРЫЙ снимок udata (ещё без applyPatch(res.patch)
// от этого запроса) — если его ответ долетает до сервера ПОСЛЕ прямой записи сервера, он тихо
// затирает её обратно на старое значение. flushPlayerSave('boss_start_fight'/'boss_claim_kill',
// ...) ПЕРЕД запросом уже защищал от гонки СО СТОРОНЫ ужé стоявшего в очереди сейва, но не мог
// помешать НОВОМУ автосейву сработать ПОКА сам критичный запрос летит туда-обратно. suspend/
// resume ниже перекрывают именно это окно целиком.
let saveSuspended = 0;
let pendingFlushOnResume = false;
const wrappedTargets = new WeakMap();
const wrappedProxies = new WeakSet();

function canSave(){
    return Boolean(window.udata && window.TS && window.TS.token);
}

function schedule(delay){
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => flushPlayerSave('debounce'), delay);
}

export function queuePlayerSave(reason = 'mutation'){
    revision++;
    if(window.debug_mode) console.log('[player-save.queue]', reason, 'revision:', revision);
    schedule(SAVE_DELAY_MS);
}

// 22.09.2026 (по прямому указанию, репорт "зашёл в ящик — было мало патронов, купил —
// стало сразу намного больше, потому что нет перерендера"): корень — гонка между этим
// 500мс-дебаунсом и server/core/controllers/yashik.php (openBox/buyPatron делают СВОЙ
// loadUser() — свежее чтение из БД — и полный перезапись всей строки saveUser()). Если
// достижение начисляет патрон клиенту ПРЯМО ПЕРЕД тем, как игрок жмёт ОБЫСКАТЬ/купить
// патрон, а дебаунс ещё не успел сохранить, yashik.php читает СТАРОЕ значение bullets из
// БД, считает от него, и applyPatch() отвечает клиенту этим устаревшим числом — локальный
// ещё не сохранённый прирост тихо перезаписывается. onDone (опционально) вызывается ПОСЛЕ
// реального завершения сохранения (или сразу, если сохранять было нечего) — так вызывающий
// код может дождаться гарантированно актуальной БД перед следующим запросом, который сам
// делает read-modify-write (см. yashik.js._openYashikScreen/_openBuyPatronPopup).
export function flushPlayerSave(reason = 'manual', onDone){
    clearTimeout(saveTimer);
    saveTimer = null;

    if(saveSuspended > 0){
        // Сохранение приостановлено (идёт startFight/attack/claimKill) — не шлём СЕЙЧАС,
        // иначе именно этот вызов и есть та самая гонка (см. большой комментарий выше).
        // Запоминаем, что сохранить всё равно нужно — resumePlayerSave() сделает это сразу,
        // как только критичный запрос завершится (успешно или с ошибкой).
        pendingFlushOnResume = true;
        if(window.debug_mode) console.log('[player-save.flush]', reason, 'отложен — сохранение приостановлено');
        if(typeof onDone === 'function') onDone();
        return false;
    }

    if(!canSave() || revision <= savedRevision){
        if(typeof onDone === 'function') onDone();
        return false;
    }

    const sendingRevision = revision;
    const snapshot = JSON.stringify(window.udata);
    window.TS.php('users.save', {udata_json: snapshot}, (result) => {
        savedRevision = Math.max(savedRevision, sendingRevision);
        clearTimeout(retryTimer);
        retryTimer = null;
        retryCount = 0; // сброс счётчика — серия ошибок закончилась первым же успехом
        if(window.debug_mode) console.log('[player-save.ok]', reason, 'revision:', sendingRevision, result);
        // Пока запрос стоял в очереди, игра могла изменить данные ещё раз.
        if(revision > savedRevision) schedule(SAVE_DELAY_MS);
        if(typeof onDone === 'function') onDone();
    }, (error) => {
        console.error('[player-save.error]', reason, 'revision:', sendingRevision, error);
        clearTimeout(retryTimer);
        retryTimer = null;
        retryCount++;
        if(retryCount <= MAX_RETRIES){
            retryTimer = setTimeout(() => flushPlayerSave('retry'), RETRY_DELAY_MS);
        } else {
            // 26.09.2026 (по прямому указанию — ограничить бесконечный ретрай автосейва):
            // после MAX_RETRIES подряд неудач прекращаем агрессивный ретрай каждые 2с и
            // показываем игроку понятное сообщение вместо тихого бесконечного цикла. Прогресс
            // не теряется совсем — резервный периодический flush раз в PERIODIC_FLUSH_MS
            // (installPlayerPersistence() ниже) продолжает идти независимо и сбросит
            // retryCount при первом же успехе, если сеть/сессия восстановится.
            console.error('[player-save.error] превышен лимит повторов (' + MAX_RETRIES + ') подряд — прекращаю ретрай каждые ' + RETRY_DELAY_MS + 'мс, жду резервный периодический flush');
            if(window.notify) notify.showResult({text:'Проблема с сохранением прогресса — проверьте интернет-соединение'}, 0);
        }
        if(typeof onDone === 'function') onDone(error);
    });
    return true;
}

// Приостанавливает автосейв (debounce/periodic/hidden/pagehide) — вызывать ПЕРЕД тем, как
// отправить server-authoritative запрос, который сам пишет udata-поля в обход этого модуля
// (bosses.startFight/attack/claimKill — см. большой комментарий у объявления saveSuspended
// выше). Счётчик, а не флаг — на случай вложенных/параллельных критичных запросов, ни один
// resumePlayerSave() не должен снять чужую приостановку раньше времени.
export function suspendPlayerSave(reason = 'manual'){
    saveSuspended++;
    clearTimeout(saveTimer);
    saveTimer = null;
    if(window.debug_mode) console.log('[player-save.suspend]', reason, 'глубина:', saveSuspended);
}

// Снимает приостановку — вызывать в ОБОИХ колбэках критичного запроса (успех и ошибка),
// иначе автосейв замрёт навсегда при сетевой ошибке. Если что-то пыталось сохраниться, пока
// было приостановлено (см. pendingFlushOnResume в flushPlayerSave выше), — сохраняем сразу
// же, теперь уже с гарантированно свежим udata (patch от критичного запроса уже применён).
export function resumePlayerSave(reason = 'manual'){
    if(saveSuspended > 0) saveSuspended--;
    if(window.debug_mode) console.log('[player-save.resume]', reason, 'глубина:', saveSuspended);
    if(saveSuspended > 0) return; // вложенный suspend — ещё не всё разрешено
    if(pendingFlushOnResume){
        pendingFlushOnResume = false;
        flushPlayerSave('resume:' + reason);
    } else if(revision > savedRevision){
        schedule(SAVE_DELAY_MS);
    }
}

// 26.09.2026 (по прямому репорту — "оплата прошла, но начисленное позже пропало"): найдено,
// что suspendPlayerSave() защищает только ЭТОТ модуль (debounce/periodic/hidden/pagehide), но
// dev_panel.js.saveDevChanges() — ПОЛНОСТЬЮ ОТДЕЛЬНАЯ реализация сохранения (свой
// TS.php('users.save', ...), в обход этого файла вообще), которая ничего не знала о suspend и
// могла отправить СТАРЫЙ снимок udata (например, coins ещё не подтянутые с сервера после
// покупки) поверх уже честно начисленного сервером баланса — подтверждено живыми логами
// (universal_pay начислил coins 3→20003, а следующий saveDevChanges() снова записал 3).
// Геттер ниже даёт любому внешнему коду (не только этому модулю) узнать текущее состояние
// приостановки и самому решить не сохранять прямо сейчас.
export function isPlayerSaveSuspended(){
    return saveSuspended > 0;
}

// 27.09.2026 (репорт — "покупка валюты не начисляет валюту"): объявляет текущий udata
// идентичным серверному состоянию, то есть «сохранять нечего». Нужно там, где клиент только
// что ЦЕЛИКОМ заменил udata полным снимком с сервера (bank.js._refreshBalanceAfterPurchase →
// users.get): после такой замены локальных несохранённых изменений не существует по
// определению, но счётчик revision о замене ничего не знает и остаётся «грязным» — любой
// следующий flush (в т.ч. немедленный из resumePlayerSave()) отправит этот снимок обратно на
// сервер. Для обычных полей это безвредное эхо, но для валюты — нет: вебхук VK
// (universal_pay.php) пишет баланс НАПРЯМУЮ в БД, в обход клиента, и такой эхо-сейв,
// долетевший позже вебхука, затирает свежее начисление старым значением.
export function markPlayerDataFresh(reason = 'manual'){
    savedRevision = revision;
    clearTimeout(saveTimer);
    saveTimer = null;
    pendingFlushOnResume = false;
    if(window.debug_mode) console.log('[player-save.markFresh]', reason, 'revision:', revision);
}

export function wrapPlayerData(data){
    const target = data && typeof data === 'object' ? data : {};
    if(wrappedProxies.has(target)) return target;
    if(wrappedTargets.has(target)) return wrappedTargets.get(target);

    const proxy = new Proxy(target, {
        set(obj, key, value){
            const changed = obj[key] !== value;
            obj[key] = value;
            if(changed) queuePlayerSave(String(key));
            return true;
        },
        deleteProperty(obj, key){
            if(!Object.prototype.hasOwnProperty.call(obj, key)) return true;
            delete obj[key];
            queuePlayerSave('delete:' + String(key));
            return true;
        }
    });
    wrappedTargets.set(target, proxy);
    wrappedProxies.add(proxy);
    return proxy;
}

export function installPlayerPersistence(){
    window.wrapPlayerData = wrapPlayerData;
    window.queuePlayerSave = queuePlayerSave;
    window.flushPlayerSave = flushPlayerSave;
    window.suspendPlayerSave = suspendPlayerSave;
    window.resumePlayerSave = resumePlayerSave;
    window.isPlayerSaveSuspended = isPlayerSaveSuspended;
    window.markPlayerDataFresh = markPlayerDataFresh;

    if(window.udata) window.udata = wrapPlayerData(window.udata);
    if(lifecycleInstalled) return;
    lifecycleInstalled = true;

    // Резервный периодический flush оставлен на случай, если старый модуль заменит
    // объект udata без обёртки. Основной путь сохраняет изменения через 500 мс.
    window._saveInterval = setInterval(() => {
        if(window.udata && !wrappedProxies.has(window.udata)){
            window.udata = wrapPlayerData(window.udata);
            queuePlayerSave('rewrap');
        }
        flushPlayerSave('interval');
    }, PERIODIC_FLUSH_MS);

    document.addEventListener('visibilitychange', () => {
        if(document.visibilityState === 'hidden') flushPlayerSave('hidden');
    });
    window.addEventListener('pagehide', () => flushPlayerSave('pagehide'));
}

