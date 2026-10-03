/** Гейт для VKWebAppGetAuthToken(scope:'friends') — модерация VK (30.09.2026, п.1 отказа):
 * правило 2.6.3 (dev.vk.com/ru/mini-apps-rules) запрещает фоновые предложения (диалог VK без
 * собственного модального окна игры с кнопками "принять"/"отказаться") раньше 2-го запуска и
 * чаще раза в 30 дней. До этой правки preloader.js вызывал VKWebAppGetAuthToken со scope
 * 'friends' БЕЗ какого-либо объяснения НА КАЖДОЙ сессии (см. комментарии в preloader.js от
 * 26.09/28.09.2026) — именно этот системный диалог VK "разрешить доступ к друзьям" видел
 * модератор на скриншоте 1.
 *
 * localStorage используется только как UX-гейт (когда можно снова показать предложение).
 * Само согласие дополнительно хранится сервером в users.friends_scope_granted: иначе после
 * очистки браузерного storage невозможно отличить игрока, уже давшего разрешение, от нового.
 */
const LAUNCH_COUNT_KEY = 'pripyat_launch_count';
const LAST_ASKED_KEY   = 'pripyat_friends_scope_last_asked_ms';
const GRANTED_KEY      = 'pripyat_friends_scope_granted';
const THIRTY_DAYS_MS   = 30 * 24 * 60 * 60 * 1000;

// Вызывать РОВНО один раз за сессию, максимально рано (index.js) — считает запуски приложения.
export function registerLaunch(){
    try{
        const count = parseInt(localStorage.getItem(LAUNCH_COUNT_KEY) || '0', 10) + 1;
        localStorage.setItem(LAUNCH_COUNT_KEY, String(count));
        console.log('[friends-scope-gate.registerLaunch] запуск №' + count);
        return count;
    } catch(e){
        console.error('[friends-scope-gate.registerLaunch] localStorage недоступен:', e.message);
        return 2; // storage недоступен (приватный режим и т.п.) — не блокируем фичу вечно
    }
}

export function shouldAskFriendsScope(){
    try{
        if(localStorage.getItem(GRANTED_KEY) === '1') return false;
        const count = parseInt(localStorage.getItem(LAUNCH_COUNT_KEY) || '0', 10);
        if(count < 2){
            console.log('[friends-scope-gate.shouldAskFriendsScope] запуск №' + count + ' — рано (нужен минимум 2-й), пропускаю запрос доступа к друзьям');
            return false;
        }
        const lastAsked = parseInt(localStorage.getItem(LAST_ASKED_KEY) || '0', 10);
        const sinceMs = Date.now() - lastAsked;
        if(lastAsked && sinceMs < THIRTY_DAYS_MS){
            console.log('[friends-scope-gate.shouldAskFriendsScope] уже спрашивали', Math.round(sinceMs / 86400000), 'дн. назад (< 30) — пропускаю запрос доступа к друзьям');
            return false;
        }
        return true;
    } catch(e){
        console.error('[friends-scope-gate.shouldAskFriendsScope] localStorage недоступен, разрешаю по умолчанию:', e.message);
        return true;
    }
}

export function markFriendsScopeGranted(){
    try{ localStorage.setItem(GRANTED_KEY, '1'); }
    catch(e){ console.error('[friends-scope-gate.markFriendsScopeGranted] localStorage недоступен:', e.message); }
}

// Нужен для одноразового переноса ранее полученных согласий (до появления поля в БД).
// Это не заменяет серверную проверку отображения кнопки.
export function hasFriendsScopeGrantedLocal(){
    try{ return localStorage.getItem(GRANTED_KEY) === '1'; }
    catch(e){ return false; }
}

export function markFriendsScopeAsked(){
    try{
        localStorage.setItem(LAST_ASKED_KEY, String(Date.now()));
        console.log('[friends-scope-gate.markFriendsScopeAsked] отметка времени запроса scope friends обновлена');
    } catch(e){
        console.error('[friends-scope-gate.markFriendsScopeAsked] localStorage недоступен:', e.message);
    }
}
