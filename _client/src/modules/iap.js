/** Единая точка запуска покупки (донат). Модерация ОК (05.10.2026, п.5 отказа — "платежи не
 * работают"): раньше на ОК вызывался прямой FAPI.UI.showPayment() (apiok.ru/dev/sdk/js/
 * ui.showPayment) вместо VKWebAppShowOrderBox — считалось (по таблице совместимости apiok.ru/
 * apps/vk), что VK Pay в принципе не работает на ОК.
 *
 * 05.10.2026 (по прямому указанию, после разбора РЕАЛЬНОГО консольного лога живой сессии в ОК):
 * таблица совместимости оказалась НЕВЕРНОЙ (или устаревшей) для кросспостинг-приложений. Живой
 * лог показал, что ОК запускает такие приложения через собственный "VK Mini App Launcher"
 * (console: "[VK MINI APP] Launcher v. 0.1.136"), который перехватывает ВСЕ стандартные VK
 * Bridge postMessage-вызовы — список `handlers:` из лога прямо включает VKWebAppShowOrderBox —
 * и сам транслирует их в FAPI внутри себя (ОК сама показывает своё окно оплаты, как и раньше
 * планировалось через FAPI.UI.showPayment, просто вызывать его напрямую не нужно). Это тот же
 * Launcher, что уже прозрачно обслуживает VKWebAppGetAuthToken/VKWebAppStorageGet/Set — их этот
 * файл и раньше вызывал одинаково для VK и ОК без проблем.
 *
 * Поэтому с 05.10.2026 покупка на ОК ничем не отличается от VK на клиенте: тот же
 * bridge.send('VKWebAppShowOrderBox', ...), то же событие VKWebAppShowOrderBoxResult в
 * bank.js.bridge.subscribe() (Launcher эмулирует его так же, как остальные VK Bridge события).
 * server/ok_pay_callback.php (подписанный GET-колбэк подтверждения платежа от ОК) НЕ убран и
 * остаётся нужен — это серверная сторона, она срабатывает независимо от того, как именно на
 * клиенте был инициирован платёж (напрямую через FAPI или через Launcher-перехват VK Bridge).
 */
export function startPurchase(itemId){
    console.log('[iap.startPurchase] запрошена покупка | item:', itemId);
    bridge.send('VKWebAppShowOrderBox', { type: 'item', item: itemId });
}
