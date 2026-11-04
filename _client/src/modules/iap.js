/** Единая точка запуска покупки (донат) — платформо-зависимая. Модерация ОК (05.10.2026, п.5
 * отказа — "платежи не работают").
 *
 * История решения (всё за один день, 05.10.2026, по прямому указанию на каждом шаге):
 * 1. Раньше на ОК вызывался прямой FAPI.UI.showPayment() — считалось (по таблице совместимости
 *    apiok.ru/apps/vk), что VK Pay (VKWebAppShowOrderBox) в принципе не работает на ОК.
 * 2. После разбора живого консольного лога (видно "[VK MINI APP] Launcher v. 0.1.136" — ОК
 *    запускает кросспостинг-приложения через свой Launcher, который перехватывает ВСЕ VK
 *    Bridge-вызовы, включая VKWebAppShowOrderBox, см. handlers: в логе) показалось, что таблица
 *    совместимости неверна — покупку упростили до ОБЫЧНОГО VKWebAppShowOrderBox для обеих
 *    площадок, прямой вызов FAPI убрали.
 * 3. ЖИВОЙ ТЕСТ этого упрощения показал реальную ошибку: попап оплаты на ОК показал "item за
 *    null OK" / "Цена функции: null OK", затем страницу ОК "платёжная система на профилактике".
 *    Причина — VKWebAppShowOrderBox в принципе НЕ передаёт цену (ни в протоколе VK, ни в нашем
 *    вызове): для VK цену подтягивает сам VK по номеру item из СВОЕГО прайс-листа (кабинет VK).
 *    Launcher ОК, перехватывая этот вызов, пытается сделать то же самое — ищет цену item'а в
 *    СВОЁМ (ОК-шном) каталоге платежей, где она не настроена → null.
 * Вывод: таблица совместимости apiok.ru была права про сам факт (VKWebAppShowOrderBox для ОК не
 * годится), просто причина не в том, что событие не доходит (Launcher его честно перехватывает),
 * а в том, что ему неоткуда взять цену. FAPI.UI.showPayment() эту проблему не имеет — цена
 * передаётся ЯВНЫМ параметром от нас (priceOk, который мы и так знаем из server/json/donuts.json
 * через price_ok), а не ищется в каком-либо каталоге. Поэтому прямой вызов FAPI возвращён для ОК,
 * VK остаётся на VKWebAppShowOrderBox (у VK цена настроена в его собственном кабинете и этот
 * путь годами работал без проблем).
 */
// v746: the historical FAPI workaround above applies only to native OK launches.
// Cross-posted Mini Apps use the launcher's Bridge and an OK-specific server catalogue.
import { isOk } from './platform.js';
import { logOkPayment } from './ok-payment-diagnostics.js';

// VK-ветка — поведение 1-в-1 как раньше (bridge.send('VKWebAppShowOrderBox', ...)).
function _startVkPurchase(itemId){
    console.log('[iap._startVkPurchase] запрошена покупка за голоса ВК | item:', itemId);
    // Compatibility fallback protects an already running VK/OK client if a stale cached
    // bundle loads before the new bootstrap module. Normal runtime always uses the adapter.
    if(window.platformRuntime && typeof window.platformRuntime.startNativePurchase === 'function'){
        return window.platformRuntime.startNativePurchase(itemId);
    }
    return bridge.send('VKWebAppShowOrderBox', { type: 'item', item: itemId });
}

// Инициализация FAPI — один раз на сессию, кэшируем промис. Возвращает true/false, никогда не
// бросает исключение. 05.10.2026: живой лог дважды подтвердил, что FAPI реально загружается и
// успешно инициализируется в реальной сессии ОК ("FAPI loaded" / "FAPI init success") — честная
// деградация ниже остаётся на случай, если площадка/сессия всё же не пробросит SDK, не потому
// что это ожидаемый исход.
let _fapiInitPromise = null;
function _initFapi(){
    logOkPayment('sdk-check',{fapi:!!window.FAPI,ui:!!window.FAPI?.UI,showPayment:typeof window.FAPI?.UI?.showPayment==='function',util:!!window.FAPI?.Util,init:typeof window.FAPI?.init==='function'});
    if(_fapiInitPromise) return _fapiInitPromise;
    // 09.10.2026 (живой репорт — "Покупки на этой площадке временно недоступны" при реальной
    // попытке купить на ОК): console-лог, присланный вместе с репортом, обрывается ДО момента
    // клика по покупке — видно только что ЛАУНЧЕР ОК сам успешно грузит и инициализирует СВОЙ
    // FAPI ("[VK MINI APP] FAPI loaded"/"FAPI init success" — это его собственные логи, не
    // наши), но неизвестно, что происходит, когда МЫ, уже после этого, зовём FAPI.init()
    // повторно (может быть не нужно/конфликтовать с уже выполненной инициализацией Launcher'а,
    // может быть безвредно — неизвестно без документации реализации Launcher'а). Подробное
    // логирование добавлено на каждом шаге именно для того, чтобы при СЛЕДУЮЩЕЙ попытке было
    // видно, на чём конкретно ломается: самого window.FAPI нет, нет нужных полей в rParams,
    // FAPI.init() сам вызывает error-колбэк, или бросает исключение.
    console.log('[iap._initFapi] состояние перед инициализацией | typeof window.FAPI:', typeof window.FAPI,
        '| ключи window.FAPI:', window.FAPI ? JSON.stringify(Object.keys(window.FAPI)) : null,
        '| window.FAPI.UI существует:', !!(window.FAPI && window.FAPI.UI),
        '| ключи window.FAPI.UI:', (window.FAPI && window.FAPI.UI) ? JSON.stringify(Object.keys(window.FAPI.UI)) : null);
    _fapiInitPromise = new Promise((resolve) => {
        // Launcher ОК мог инициализировать полноценный UI, но не передать в iframe игры
        // Util/init для повторной инициализации. Готовый showPayment — достаточный контракт для
        // покупки, поэтому эту ветку нужно проверять РАНЬШЕ требования Util/init.
        if(window.FAPI && window.FAPI.initialized === true && window.FAPI.UI && typeof window.FAPI.UI.showPayment === 'function'){
            console.log('[iap._initFapi] FAPI.UI.showPayment уже доступен — используем инициализацию Launcher ОК без повторного FAPI.init()');
            resolve(true);
            return;
        }
        if(typeof window.FAPI === 'undefined' || !window.FAPI || !window.FAPI.Util || !window.FAPI.init){
            console.warn('[iap._initFapi] window.FAPI недоступен в этой сессии (скрипт не загрузился либо площадка не пробросила SDK)');
            resolve(false);
            return;
        }
        try {
            const rParams = FAPI.Util.getRequestParameters();
            logOkPayment('sdk-parameters',{hasApiServer:!!rParams?.api_server,hasConnection:!!rParams?.apiconnection});
            console.log('[iap._initFapi] FAPI.Util.getRequestParameters() вернул:', JSON.stringify(rParams));
            if(!rParams || !rParams['api_server'] || !rParams['apiconnection']){
                console.warn('[iap._initFapi] FAPI есть, но api_server/apiconnection отсутствуют в параметрах запуска | rParams:', JSON.stringify(rParams));
                resolve(false);
                return;
            }
            FAPI.init(rParams['api_server'], rParams['apiconnection'],
                () => { console.log('[iap._initFapi] FAPI.init успешно'); resolve(true); },
                (err) => { console.error('[iap._initFapi] FAPI.init вернул ошибку | err:', JSON.stringify(err), '| err целиком:', err); resolve(false); }
            );
        } catch(e){
            console.error('[iap._initFapi] исключение при инициализации FAPI | message:', e.message, '| stack:', e.stack);
            resolve(false);
        }
    });
    return _fapiInitPromise;
}

// FAPI.UI.showPayment() с callback='true' сообщает исход через глобальный API_callback(), а не
// через VK Bridge. Не подменяем чужой обработчик: сохраняем и вызываем прежний, если Launcher
// или другой модуль уже установил его.
let _okPaymentCallbackInstalled = false;
function _installOkPaymentCallback(){
    if(_okPaymentCallbackInstalled) return;
    _okPaymentCallbackInstalled = true;
    const previous = window.API_callback;
    window.API_callback = function(method, result, data){
        logOkPayment('callback',{method,result,callbackData:data});
        console.log('[iap.API_callback] ответ ОК | method:', method, '| result:', result, '| data:', data);
        if(method === 'showPayment'){
            if(result === 'ok') console.log('[iap.API_callback] ОК подтвердили платёж на клиенте; начисление подтверждает server/ok_pay_callback.php');
            else console.warn('[iap.API_callback] оплата ОК не завершена | result:', result, '| data:', data);
        }
        if(typeof previous === 'function'){
            try { previous(method, result, data); }
            catch(e){ console.error('[iap.API_callback] исключение предыдущего обработчика:', e.message, e.stack); }
        }
    };
}

function _okUnavailable(itemId, reason){
    console.error('[iap._startOkPurchase] оплата на ОК недоступна в этой сессии | item:', itemId, '| причина:', reason);
    const last=(window.ok_payment_safe_history||[]).slice(-1)[0];
    const unavailable=window.__nativeProdDevDiagnostics===true && last && (last.reason==='unsupported'||last.errorCode===6);
    const text=unavailable ? 'Launcher ОК не предоставляет платёжный метод. Подробности: DEV → ЛОГИ → Диагностика оплаты ОК.' : 'Покупки на этой площадке временно недоступны. Мы уже работаем над этим.';
    if(window.notify) notify.showResult({text}, 0);
}

// item → {валюта, количество} — та же раскладка, что и серверный каталог
// (server/ok_pay_callback.php.okItemCatalog()), нужна ТОЛЬКО чтобы запустить опрос баланса
// после FAPI.UI.showPayment() — платформо-независимая, поэтому безопасно дублировать здесь на
// чистых данных, не завязываясь на donuts_info (он есть не на каждом экране).
function _okItemCurrencyAndCount(numericId){
    const lens = { stew: donuts_info['stew']['default'].length, coins: donuts_info['coins']['default'].length };
    if(numericId < lens.stew) return ['stew', donuts_info['stew']['default'][numericId]];
    if(numericId < lens.stew + lens.coins) return ['coins', donuts_info['coins']['default'][numericId - lens.stew]];
    const cigOff = lens.stew + lens.coins;
    if(numericId < cigOff + donuts_info['cigarettes']['default'].length) return ['cigarettes', donuts_info['cigarettes']['default'][numericId - cigOff]];
    if(numericId >= 100 && numericId <= 107){
        const ENERGY = [50, 110, 180, 400, 850, 1300, 2000, 3500];
        return ['energy', ENERGY[numericId - 100]];
    }
    return [null, 0];
}

// ОК-ветка — реальный вызов FAPI.UI.showPayment() с ЯВНОЙ ценой (priceOk) — в отличие от
// VKWebAppShowOrderBox, этот путь не зависит от того, настроен ли каталог цен на стороне ОК.
// itemId приходит как строка вида 'item8'/'item107' (формат, общий с VK-веткой) — для FAPI
// нужен голый числовой код.
function _startOkPurchase(itemId, priceOk, label){
    logOkPayment('buy-click',{item:Number(String(itemId).replace('item','')),price:Number(priceOk)});
    const numericId = parseInt(String(itemId).replace('item', ''));
    if(isNaN(numericId) || !priceOk || priceOk <= 0){
        _okUnavailable(itemId, 'некорректный itemId/priceOk: ' + itemId + ' / ' + priceOk);
        return;
    }
    // Cross-posted Mini Apps run inside the OK launcher. The game's fapi5.js is
    // a separate, uninitialised SDK (showPayment exists even in its stub state).
    // Request item information via the launcher; the server supplies the OK price.
    if(window.vk_params && window.vk_params.vk_client === 'ok'){
        logOkPayment('launcher-payment',{item:numericId,price:Number(priceOk)});
        const details={name:label||('Товар #'+numericId),description:'Внутриигровая покупка — Припять',price:Number(priceOk)};
        const startNative = () => window.platformRuntime && typeof window.platformRuntime.startNativePurchase === 'function'
            ? window.platformRuntime.startNativePurchase('ok_item'+numericId,details)
            : bridge.send('VKWebAppShowOrderBox', {type:'item',item:'ok_item'+numericId});
        return Promise.resolve().then(startNative).then(result => {
            if(result && result.success===false) throw new Error('OK payment was not completed');
            logOkPayment('launcher-result',{result:'ok'});
            const [currency,count] = _okItemCurrencyAndCount(numericId);
            if(currency && window.bank && window.bank._refreshBalanceAfterPurchase) window.bank._refreshBalanceAfterPurchase(currency,count);
        }).catch(error => {
            logOkPayment('callback',{method:'VKWebAppShowOrderBox',result:'error',callbackData:error});
            _okUnavailable(itemId,'launcher payment rejected');
        });
    }
    console.log('[iap._startOkPurchase] запрошена покупка через FAPI.UI.showPayment | item:', itemId, '| numericId:', numericId, '| priceOk:', priceOk);
    _initFapi().then((ok) => {
        logOkPayment('sdk-ready',{ready:ok});
        if(!ok){
            _okUnavailable(itemId, 'FAPI.init() не удался или FAPI недоступен');
            return;
        }
        const name = label || ('Товар #' + numericId);
        const desc = 'Внутриигровая покупка — Припять';
        console.log('[iap._startOkPurchase] зову FAPI.UI.showPayment | name:', name, '| desc:', desc,
            '| numericId:', numericId, '| priceOk:', priceOk, '| FAPI.UI существует:', !!(window.FAPI && window.FAPI.UI),
            '| typeof FAPI.UI.showPayment:', window.FAPI && window.FAPI.UI ? typeof window.FAPI.UI.showPayment : 'n/a');
        try {
            // code=numericId (не строка 'item8') — упрощает серверный колбэк (server/
            // ok_pay_callback.php читает product_code через intval(), без парсинга префикса).
            _installOkPaymentCallback();
            FAPI.UI.showPayment(name, desc, numericId, priceOk, null, null, 'ok', 'true', null);
            logOkPayment('payment-call-sent',{item:numericId,price:Number(priceOk)});
            // У прямого вызова FAPI.UI.showPayment() нет гарантированного VK Bridge-события
            // результата (в отличие от VKWebAppShowOrderBox, который Launcher мог бы
            // эмулировать) — переиспользуем УЖЕ проверенный на VK механизм: опрос баланса с
            // повторами (bank.js._refreshBalanceAfterPurchase), который ждёт реального роста
            // нужной валюты (приходит через server/ok_pay_callback.php, когда ОК подтвердит
            // платёж) и останавливается, как только она выросла.
            const [currency, count] = _okItemCurrencyAndCount(numericId);
            if(currency && window.bank && window.bank._refreshBalanceAfterPurchase){
                window.bank._refreshBalanceAfterPurchase(currency, count);
            } else {
                console.warn('[iap._startOkPurchase] не удалось определить валюту/количество для опроса баланса | numericId:', numericId);
            }
        } catch(e){
            console.error('[iap._startOkPurchase] исключение при вызове FAPI.UI.showPayment', e);
            logOkPayment('payment-call-failed');
            _okUnavailable(itemId, 'исключение в FAPI.UI.showPayment: ' + e.message);
        }
    });
}

// Единая точка входа — вызывать вместо прямого bridge.send('VKWebAppShowOrderBox', ...) везде,
// где начинается покупка (bank.js.genSlots(), energy_buy.js). label — читаемое имя товара для
// окна оплаты ОК (VK-ветка его не использует, у VK свой каталог с названиями).
export function startPurchase(itemId, priceOk, label){
    if(window.__closedNativeProd===true && window.__nativeProdPayments?.[isOk()?'ok':'vk']!==true){
        if(window.iface && typeof window.iface._showRewardPopup==='function') window.iface._showRewardPopup(['Оплата временно отключена на время проверки запуска.']);
        return Promise.resolve(false);
    }
    if(window.__nativeTestPaymentsDisabled===true && !(window.__nativeTestVkPaymentsEnabled===true && !isOk())){
        if(window.iface&&typeof window.iface._showRewardPopup==='function')window.iface._showRewardPopup(['Оплата на тестовом сервере отключена.']);
        return Promise.resolve(false);
    }
    if(window.platformRuntime && window.platformRuntime.platform==='telegram')return window.__telegramPurchase(itemId);
    if(isOk()) return _startOkPurchase(itemId, priceOk, label);
    return _startVkPurchase(itemId);
}
