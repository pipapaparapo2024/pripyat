/** Единая точка запуска покупки (донат) — платформо-зависимая. Модерация ОК (05.10.2026, п.5
 * отказа — "платежи не работают"): bank.js/energy_buy.js раньше ВСЕГДА вызывали
 * VKWebAppShowOrderBox (VK Pay) — площадка ОК эту механику не поддерживает вообще (подтверждено
 * таблицей совместимости apiok.ru/apps/vk: VKWebAppShowOrderBox — "Не поддерживается").
 *
 * 05.10.2026 (по прямому указанию, после разбора трёх независимых источников — две "нейронки" +
 * собственное чтение apiok.ru — сошедшихся на том, что реального моста для VK-платежей на ОК
 * нет): вместо того чтобы прятать покупки на ОК насовсем, подключён РЕАЛЬНЫЙ платёжный SDK ОК —
 * FAPI.UI.showPayment (apiok.ru/dev/sdk/js/ui.showPayment, apiok.ru/dev/sdk/js/init). Поток:
 * игрок жмёт "Купить" → FAPI.UI.showPayment() → ОК сама показывает своё окно оплаты → игрок
 * подтверждает → ОК шлёт подписанный GET-колбэк на server/ok_pay_callback.php → сервер проверяет
 * подпись и начисляет товар (без этого подтверждения платёж у игрока не завершится успешно —
 * так требует документация ОК).
 *
 * ⚠️ ЧЕСТНО О СТАТУСЕ: это первая попытка подключения, собранная строго по документации apiok.ru
 * (проверенной за эту же сессию — не угадано), но БЕЗ доступа к песочнице ОК для живой проверки.
 * Единственный остающийся источник неопределённости — FAPI может быть недоступен в этой сессии
 * вообще (window.FAPI не определён, либо FAPI.init() не находит нужные параметры запуска в URL),
 * тогда показываем то же честное сообщение "недоступно", что было здесь раньше, вместо тишины/
 * исключения. Секрет для серверной проверки подписи колбэка (server/ok_pay_callback.php) УЖЕ
 * есть — для кросспостинг-приложений ОК он совпадает с VK (apiok.ru/apps/vk: "Секретный ключ
 * остаётся идентичным приложению в ВКонтакте"), отдельного кабинета/ключа ОК не требуется.
 */
import { isOk } from './platform.js';

// VK-ветка — поведение 1-в-1 как раньше (bridge.send('VKWebAppShowOrderBox', ...)).
function _startVkPurchase(itemId){
    console.log('[iap._startVkPurchase] запрошена покупка за голоса ВК | item:', itemId);
    bridge.send('VKWebAppShowOrderBox', { type: 'item', item: itemId });
}

// Инициализация FAPI — один раз на сессию, кэшируем промис (повторные вызовы startPurchase на
// ОК не должны слать FAPI.init() заново). Возвращает true/false, никогда не бросает исключение —
// вызывающий код (_startOkPurchase) всегда получает определённый ответ, на котором можно решить
// "показывать окно оплаты" или "честно сказать недоступно".
let _fapiInitPromise = null;
function _initFapi(){
    if(_fapiInitPromise) return _fapiInitPromise;
    _fapiInitPromise = new Promise((resolve) => {
        if(typeof window.FAPI === 'undefined' || !window.FAPI || !window.FAPI.Util || !window.FAPI.init){
            console.warn('[iap._initFapi] window.FAPI недоступен в этой сессии (скрипт не загрузился либо площадка не пробросила SDK)');
            resolve(false);
            return;
        }
        try {
            // apiok.ru/dev/sdk/js/init — rParams['api_server']/rParams['apiconnection'] ОК сама
            // добавляет в URL-параметры запуска приложения; если их нет — значит эта обёртка
            // (пока) их не передаёт нам, honest-деградация, не угадываем альтернативные имена.
            const rParams = FAPI.Util.getRequestParameters();
            if(!rParams || !rParams['api_server'] || !rParams['apiconnection']){
                console.warn('[iap._initFapi] FAPI есть, но api_server/apiconnection отсутствуют в параметрах запуска | rParams:', JSON.stringify(rParams));
                resolve(false);
                return;
            }
            FAPI.init(rParams['api_server'], rParams['apiconnection'],
                () => { console.log('[iap._initFapi] FAPI.init успешно'); resolve(true); },
                (err) => { console.error('[iap._initFapi] FAPI.init вернул ошибку', err); resolve(false); }
            );
        } catch(e){
            console.error('[iap._initFapi] исключение при инициализации FAPI', e);
            resolve(false);
        }
    });
    return _fapiInitPromise;
}

function _okUnavailable(itemId, reason){
    console.error('[iap._startOkPurchase] оплата на ОК недоступна в этой сессии | item:', itemId, '| причина:', reason);
    if(window.notify) notify.showResult({text:'Покупки на этой площадке временно недоступны. Мы уже работаем над этим.'}, 0);
}

// item → {валюта, количество} — та же раскладка, что и серверный каталог
// (server/ok_pay_callback.php.okItemCatalog()), нужна ТОЛЬКО чтобы запустить опрос баланса
// после FAPI.UI.showPayment() (см. ниже) — платформо-независимая, поэтому безопасно дублировать
// здесь на чистых данных, не завязываясь на donuts_info (он есть не на каждом экране).
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

// ОК-ветка — реальный вызов FAPI.UI.showPayment() (см. докблок файла). itemId приходит как
// строка вида 'item8'/'item107' (формат, общий с VK-веткой) — для FAPI нужен голый числовой код
// (apiok.ru пример: FAPI.UI.showPayment("Яблоко","...",777,1,null,null,"ok","true")).
function _startOkPurchase(itemId, priceOk, label){
    const numericId = parseInt(String(itemId).replace('item', ''));
    if(isNaN(numericId) || !priceOk || priceOk <= 0){
        _okUnavailable(itemId, 'некорректный itemId/priceOk: ' + itemId + ' / ' + priceOk);
        return;
    }
    console.log('[iap._startOkPurchase] запрошена покупка через FAPI.UI.showPayment | item:', itemId, '| numericId:', numericId, '| priceOk:', priceOk);
    _initFapi().then((ok) => {
        if(!ok){
            _okUnavailable(itemId, 'FAPI.init() не удался или FAPI недоступен');
            return;
        }
        const name = label || ('Товар #' + numericId);
        const desc = 'Внутриигровая покупка — Припять';
        try {
            // code=numericId (не строка 'item8') — упрощает серверный колбэк (server/
            // ok_pay_callback.php читает product_code через intval(), без парсинга префикса).
            FAPI.UI.showPayment(name, desc, numericId, priceOk, null, null, 'ok', 'true', null);
            // 05.10.2026: у ОК нет события, аналогичного VK-шному VKWebAppShowOrderBoxResult
            // (не подтверждено документацией) — вместо угадывания конкретного имени FAPI-
            // колбэка переиспользуем УЖЕ проверенный на VK механизм: тот же опрос баланса с
            // повторами (bank.js._refreshBalanceAfterPurchase), который ждёт реального роста
            // нужной валюты (приходит через server/ok_pay_callback.php, когда ОК подтвердит
            // платёж) и останавливается, как только она выросла — тот же принцип "сервер
            // решает, клиент просто ждёт", что и у VK-пути.
            const [currency, count] = _okItemCurrencyAndCount(numericId);
            if(currency && window.bank && window.bank._refreshBalanceAfterPurchase){
                window.bank._refreshBalanceAfterPurchase(currency, count);
            } else {
                console.warn('[iap._startOkPurchase] не удалось определить валюту/количество для опроса баланса | numericId:', numericId);
            }
        } catch(e){
            console.error('[iap._startOkPurchase] исключение при вызове FAPI.UI.showPayment', e);
            _okUnavailable(itemId, 'исключение в FAPI.UI.showPayment: ' + e.message);
        }
    });
}

// Единая точка входа — вызывать вместо прямого bridge.send('VKWebAppShowOrderBox', ...) везде,
// где начинается покупка (bank.js.genSlots(), energy_buy.js). label — опциональное читаемое имя
// товара для окна оплаты ОК (VK-ветка его не использует, у VK свой каталог с названиями).
export function startPurchase(itemId, priceOk, label){
    if(isOk()) return _startOkPurchase(itemId, priceOk, label);
    return _startVkPurchase(itemId);
}
