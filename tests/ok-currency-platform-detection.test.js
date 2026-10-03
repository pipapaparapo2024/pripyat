// Модерация ОК (02.10.2026, п.4 отказа): "Стоимость покупок должна быть указана в валюте
// площадки размещения" — цены в магазине показывали VK-слово "голосов" даже когда игра
// открыта внутри ОК (Путь A — тот же бандл, обёртка ОК рендерит VK Bridge). Фикс —
// modules/platform.js.detectPlatform() по document.referrer/ancestorOrigins + подстановка
// названия валюты в UniHelp.numberEnd(n,'votes'). Тест проверяет: (1) определение площадки
// по referrer/ancestorOrigins в обе стороны и безопасный фолбэк на 'vk' при неоднозначном
// сигнале, (2) что numberEnd реально возвращает ОК-склонения, когда площадка — ОК.
const fs = require('fs'), vm = require('vm'), assert = require('assert'), path = require('path');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

function loadPlatform(referrer, ancestorOrigins){
    const src = read('_client/src/modules/platform.js')
        .replace(/export function/g, 'function')
        .replace(/export const/g, 'const');
    const ctx = {
        document: { referrer: referrer || '' },
        window: { location: { ancestorOrigins: ancestorOrigins } },
        console: { log(){}, error(){} }
    };
    vm.createContext(ctx);
    vm.runInContext(src, ctx);
    return ctx;
}

// 1. ОК — определяется по referrer родительской страницы (iframe встроен в ok.ru)
{
    const ctx = loadPlatform('https://ok.ru/game/12345', undefined);
    assert.equal(ctx.detectPlatform(), 'ok', 'referrer с ok.ru должен давать площадку ok');
    assert.deepEqual(ctx.currencyNames(), ['ОК', 'ОКа', 'ОКов']);
}

// 2. ОК — определяется по ancestorOrigins, даже если referrer пуст (встречается в некоторых браузерах)
{
    const ctx = loadPlatform('', ['https://www.odnoklassniki.ru']);
    assert.equal(ctx.detectPlatform(), 'ok', 'ancestorOrigins с odnoklassniki.ru должен давать площадку ok');
}

// 3. VK — обычный referrer vk.com
{
    const ctx = loadPlatform('https://vk.com/app54574178_438953352', undefined);
    assert.equal(ctx.detectPlatform(), 'vk');
    assert.deepEqual(ctx.currencyNames(), ['голос', 'голоса', 'голосов']);
}

// 4. Неоднозначный/пустой сигнал (прямой заход в браузере, старый клиент без ancestorOrigins)
//    — ОБЯЗАН остаться 'vk' по умолчанию, иначе реальным VK-игрокам (подавляющее большинство)
//    подменится валюта/оплата.
{
    const ctx = loadPlatform('', undefined);
    assert.equal(ctx.detectPlatform(), 'vk', 'пустой сигнал должен безопасно фолбечиться на vk');
}

// 5. Результат кешируется за вызов (повторный detectPlatform() не пересчитывает referrer)
{
    const ctx = loadPlatform('https://ok.ru/game/12345', undefined);
    ctx.detectPlatform();
    ctx.document.referrer = 'https://vk.com/app1'; // подменяем "на лету" — не должно повлиять
    assert.equal(ctx.detectPlatform(), 'ok', 'площадка должна кешироваться после первого вызова');
}

// 6. Интеграция с UniHelp.numberEnd(n,'votes') — реальный выбор склонения по площадке
{
    const helperSrc = read('_client/src/modules/universal_helper.js')
        .replace("import { currencyNames } from './platform.js';", '')
        .replace('export default class UniHelp{', 'class UniHelp{');
    const ctx = {
        console: { log(){}, error(){} },
        currencyNames: () => ['ОК', 'ОКа', 'ОКов']
    };
    vm.createContext(ctx);
    vm.runInContext(helperSrc + '\nthis.UniHelp = UniHelp;', ctx);
    const h = new ctx.UniHelp();
    assert.equal(h.numberEnd(1, 'votes'), 'ОК');
    assert.equal(h.numberEnd(3, 'votes'), 'ОКа');
    assert.equal(h.numberEnd(10, 'votes'), 'ОКов');
}

console.log('PASS: определение площадки VK/ОК по referrer/ancestorOrigins, безопасный фолбэк на vk, подстановка валюты в numberEnd');
