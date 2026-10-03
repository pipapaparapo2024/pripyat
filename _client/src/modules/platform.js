/**
 * Единая точка определения площадки запуска (VK / ОК, в будущем — Telegram) и всех
 * платформо-зависимых констант. До этого модуля в проекте не было НИКАКОЙ абстракции
 * платформы (см. аудит выхода на ОК) — все тексты/вызовы были вплетены напрямую под VK,
 * из-за чего модерация ОК (02.10.2026, п.4) нашла хардкод VK-валюты "голоса" в ценах
 * магазина. Новый платформо-зависимый код должен читать площадку ОТСЮДА, а не плодить
 * свои if(...) по URL/referrer в разных файлах.
 *
 * Определение на клиенте: ОК рендерит мини-приложение VK в своей обёртке (iframe) — тот же
 * бандл, тот же VK Bridge (см. memory project_stalker_ok_audit, «Путь A»), поэтому сами
 * launch-параметры (vk_app_id, sign и т.п.) не отличают площадку. Надёжный сигнал —
 * document.referrer/ancestorOrigins родительской страницы, которая грузит iframe: это
 * домен ok.ru/odnoklassniki.ru либо vk.com/vk.ru/web.vk.me.
 *
 * ⚠️ Это первое боевое использование сигнала — проверено только логически, не вживую в ОК.
 * При первом тесте на тестовом стенде ОБЯЗАТЕЛЬНО сверить console-лог ниже (включить
 * window.debug_mode) с реальным поведением в ОК, прежде чем полагаться на него для чего-то
 * более рискованного, чем смена текста валюты.
 */

let _platform = null;

export function detectPlatform(){
    if(_platform) return _platform;

    let referrer = '', ancestors = [];
    try{
        referrer = document.referrer || '';
        if(window.location.ancestorOrigins){
            ancestors = Array.from(window.location.ancestorOrigins);
        }
    } catch(e){
        console.error('[platform.detectPlatform] ошибка чтения referrer/ancestorOrigins:', e.message);
    }

    const haystack = (referrer + ' ' + ancestors.join(' ')).toLowerCase();

    if(haystack.indexOf('ok.ru') !== -1 || haystack.indexOf('odnoklassniki.ru') !== -1){
        _platform = 'ok';
    } else {
        // VK по умолчанию — безопасный фолбэк: если сигнал неоднозначен (прямой заход в
        // браузере, старый клиент без ancestorOrigins), не должно ломать поведение для
        // реальных VK-игроков, которых подавляющее большинство.
        _platform = 'vk';
    }

    console.log('[platform.detectPlatform] площадка:', _platform, '| referrer:', referrer, '| ancestorOrigins:', ancestors);
    return _platform;
}

export function isOk(){
    return detectPlatform() === 'ok';
}

export function isVk(){
    return detectPlatform() === 'vk';
}

// Склонения названия донат-валюты по площадке — см. helper.numberEnd(n, 'votes').
// Реальная цена (конвертация price/7 в bank.js) по-прежнему временная VK-заглушка —
// настоящий прайс ОК придёт из кабинета apiok.ru отдельно (тот же класс отложенной задачи,
// что и п.5 отказа VK от 30.09.2026 — см. memory project_stalker_vk_moderation_30_09).
const CURRENCY_NAMES_BY_PLATFORM = {
    vk: ['голос', 'голоса', 'голосов'],
    ok: ['ОК', 'ОКа', 'ОКов']
};

export function currencyNames(){
    return CURRENCY_NAMES_BY_PLATFORM[detectPlatform()] || CURRENCY_NAMES_BY_PLATFORM.vk;
}
