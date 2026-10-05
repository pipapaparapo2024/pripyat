/** Гейт для VKWebAppGetAuthToken(scope:'friends') — модерация VK (30.09.2026, п.1 отказа):
 * правило 2.6.3 (dev.vk.com/ru/mini-apps-rules) запрещает фоновые предложения (диалог VK без
 * собственного модального окна игры с кнопками "принять"/"отказаться") раньше 2-го запуска и
 * чаще раза в 30 дней. До этой правки preloader.js вызывал VKWebAppGetAuthToken со scope
 * 'friends' БЕЗ какого-либо объяснения НА КАЖДОЙ сессии (см. комментарии в preloader.js от
 * 26.09/28.09.2026) — именно этот системный диалог VK "разрешить доступ к друзьям" видел
 * модератор на скриншоте 1.
 *
 * 04.10.2026 (повторный отказ модерации ОК, п.1 — "в каждой сессии"): в реальных call-сайтах
 * (interface.js HUD-кнопка «Друзья», svod-leaderboard.js вкладка «Друзья», onboarding финальный
 * экран) этот гейт либо вызывается с force:true (явный клик игрока — правило 2.6.3 это разрешает
 * без лимита 30 дней), либо не вызывается вовсе (onboarding «permission»-экран — одноразовый по
 * серверному onboarding_step). То есть shouldAskFriendsScope() СЕЙЧАС нигде не определяет
 * реальное поведение — настоящая причина повтора на каждой сессии, судя по всему, была в ДРУГОМ
 * месте (баг "обучение запускается по несколько раз", см. onboarding-popup.js._finish(),
 * починено тем же днём). Этот файл всё равно переведён на VKWebAppStorageGet/Set — localStorage
 * в embed-обёртке площадки (особенно мобильная ОК) часто не переживает между запусками, поэтому
 * локальное хранилище само по себе ненадёжный источник для "не чаще раза в 30 дней", даже если
 * сейчас эта ветка не на критическом пути. VK Storage хранится на сервере VK, привязан к
 * аккаунту игрока, не к устройству/вкладке — тот же принцип, что уже применён для
 * friends_scope_granted (см. users.friends_scope_granted в БД).
 *
 * localStorage остаётся как: (а) синхронный быстрый фолбэк, если Storage API недоступен/не
 * успел ответить; (б) кэш, чтобы не дёргать Storage API на каждый чих — VK Bridge Storage имеет
 * лимиты (до 100 ключей на приложение, см. dev.vk.com/bridge/VKWebAppStorageGet).
 */
const LAUNCH_COUNT_KEY = 'pripyat_launch_count';
const LAST_ASKED_KEY   = 'pripyat_friends_scope_last_asked_ms';
const GRANTED_KEY      = 'pripyat_friends_scope_granted';
const THIRTY_DAYS_MS   = 30 * 24 * 60 * 60 * 1000;

// VK Bridge Storage ключи — отдельные от localStorage-ключей выше во избежание путаницы при
// чтении кода (те же данные, два разных хранилища).
const VK_STORAGE_LAUNCH_COUNT = 'pripyat_launch_count';
const VK_STORAGE_LAST_ASKED   = 'pripyat_friends_last_asked_ms';

function _localGetInt(key){
    try{ return parseInt(localStorage.getItem(key) || '0', 10) || 0; }
    catch(e){ return 0; }
}
function _localSet(key, value){
    try{ localStorage.setItem(key, String(value)); }
    catch(e){ console.error('[friends-scope-gate._localSet] localStorage недоступен:', e.message); }
}

// Обёртка над VKWebAppStorageGet — мягко деградирует (resolve(null)) на любой ошибке
// (bridge не готов, площадка не поддерживает Storage API, лимит ключей и т.п.) — вызывающий
// код сам решает, что делать при null (обычно — довериться локальному фолбэку).
function _vkStorageGet(key){
    try{
        if(!window.bridge || typeof bridge.sendPromise !== 'function') return Promise.resolve(null);
        return bridge.sendPromise('VKWebAppStorageGet', {keys: [key]})
            .then(res => {
                const entry = res && Array.isArray(res.keys) ? res.keys.find(k => k.key === key) : null;
                return entry && entry.value !== '' ? entry.value : null;
            })
            .catch(e => {
                console.error('[friends-scope-gate._vkStorageGet] ошибка VKWebAppStorageGet для "' + key + '":', e && e.message ? e.message : JSON.stringify(e));
                return null;
            });
    } catch(e){
        console.error('[friends-scope-gate._vkStorageGet] синхронная ошибка:', e.message);
        return Promise.resolve(null);
    }
}

function _vkStorageSet(key, value){
    try{
        if(!window.bridge || typeof bridge.sendPromise !== 'function') return;
        bridge.sendPromise('VKWebAppStorageSet', {key, value: String(value)})
            .catch(e => console.error('[friends-scope-gate._vkStorageSet] ошибка VKWebAppStorageSet для "' + key + '":', e && e.message ? e.message : JSON.stringify(e)));
    } catch(e){
        console.error('[friends-scope-gate._vkStorageSet] синхронная ошибка:', e.message);
    }
}

// Вызывать РОВНО один раз за сессию, максимально рано (index.js) — считает запуски приложения.
// Остаётся СИНХРОННОЙ (пишет только в localStorage) — вызывается до VKWebAppInit в index.js,
// слишком рано доверять Storage API. Зеркалирование в VK Storage — отдельно, см.
// syncLaunchCountToServerStorage() ниже, вызывается уже после готовности bridge.
export function registerLaunch(){
    try{
        const count = _localGetInt(LAUNCH_COUNT_KEY) + 1;
        _localSet(LAUNCH_COUNT_KEY, count);
        console.log('[friends-scope-gate.registerLaunch] запуск №' + count + ' (локально)');
        return count;
    } catch(e){
        console.error('[friends-scope-gate.registerLaunch] localStorage недоступен:', e.message);
        return 2; // storage недоступен (приватный режим и т.п.) — не блокируем фичу вечно
    }
}

// 04.10.2026: сверяет локальный счётчик запусков с серверным (VK Storage) и берёт БОЛЬШЕЕ из
// двух значений — так счётчик переживает чистку localStorage площадкой (ОК/мобильный webview),
// но не теряет прогресс, если сам VK Storage временно недоступен. Вызывать один раз после
// готовности bridge (index.js, после VKWebAppInit) — не блокирует запуск игры, выполняется
// в фоне.
export async function syncLaunchCountToServerStorage(){
    try{
        const localCount = _localGetInt(LAUNCH_COUNT_KEY);
        const remoteRaw = await _vkStorageGet(VK_STORAGE_LAUNCH_COUNT);
        const remoteCount = remoteRaw !== null ? (parseInt(remoteRaw, 10) || 0) : 0;
        const merged = Math.max(localCount, remoteCount);
        if(merged !== localCount) _localSet(LAUNCH_COUNT_KEY, merged);
        if(merged !== remoteCount) _vkStorageSet(VK_STORAGE_LAUNCH_COUNT, merged);
        console.log('[friends-scope-gate.syncLaunchCountToServerStorage] локально=' + localCount + ' серверно=' + remoteCount + ' итог=' + merged);
    } catch(e){
        console.error('[friends-scope-gate.syncLaunchCountToServerStorage] ошибка синхронизации:', e.message);
    }
}

// Асинхронная версия — источник истины: VK Storage (если доступен), иначе localStorage.
// Используется там, где реально решается судьба автоматического предложения (НЕ для
// force:true кликов игрока — им эта проверка не нужна по правилу 2.6.3).
export async function shouldAskFriendsScopeAsync(){
    try{
        if(hasFriendsScopeGrantedLocal()) return false;

        const remoteLaunchRaw = await _vkStorageGet(VK_STORAGE_LAUNCH_COUNT);
        const count = remoteLaunchRaw !== null ? (parseInt(remoteLaunchRaw, 10) || 0) : _localGetInt(LAUNCH_COUNT_KEY);
        if(count < 2){
            console.log('[friends-scope-gate.shouldAskFriendsScopeAsync] запуск №' + count + ' — рано (нужен минимум 2-й), пропускаю');
            return false;
        }

        const remoteLastAskedRaw = await _vkStorageGet(VK_STORAGE_LAST_ASKED);
        const lastAsked = remoteLastAskedRaw !== null ? (parseInt(remoteLastAskedRaw, 10) || 0) : _localGetInt(LAST_ASKED_KEY);
        const sinceMs = Date.now() - lastAsked;
        if(lastAsked && sinceMs < THIRTY_DAYS_MS){
            console.log('[friends-scope-gate.shouldAskFriendsScopeAsync] уже спрашивали', Math.round(sinceMs / 86400000), 'дн. назад (< 30) — пропускаю');
            return false;
        }
        return true;
    } catch(e){
        console.error('[friends-scope-gate.shouldAskFriendsScopeAsync] ошибка, разрешаю по умолчанию:', e.message);
        return true;
    }
}

// Синхронный фолбэк (localStorage-only) — для мест, которые не могут позволить себе await
// (сейчас таких в проекте нет, оставлен для обратной совместимости/мелких синхронных проверок).
export function shouldAskFriendsScope(){
    try{
        if(localStorage.getItem(GRANTED_KEY) === '1') return false;
        const count = _localGetInt(LAUNCH_COUNT_KEY);
        if(count < 2) return false;
        const lastAsked = _localGetInt(LAST_ASKED_KEY);
        const sinceMs = Date.now() - lastAsked;
        if(lastAsked && sinceMs < THIRTY_DAYS_MS) return false;
        return true;
    } catch(e){
        console.error('[friends-scope-gate.shouldAskFriendsScope] localStorage недоступен, разрешаю по умолчанию:', e.message);
        return true;
    }
}

export function markFriendsScopeGranted(){
    _localSet(GRANTED_KEY, '1');
}

// Нужен для одноразового переноса ранее полученных согласий (до появления поля в БД).
// Это не заменяет серверную проверку отображения кнопки.
export function hasFriendsScopeGrantedLocal(){
    try{ return localStorage.getItem(GRANTED_KEY) === '1'; }
    catch(e){ return false; }
}

export function markFriendsScopeAsked(){
    const now = Date.now();
    _localSet(LAST_ASKED_KEY, now);
    _vkStorageSet(VK_STORAGE_LAST_ASKED, now);
    console.log('[friends-scope-gate.markFriendsScopeAsked] отметка времени запроса scope friends обновлена (локально + VK Storage)');
}
