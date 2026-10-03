// Мобильный вьюпорт — единая точка правды о РЕАЛЬНО доступной области экрана и о том,
// когда эта область изменилась.
//
// 27.09.2026 (запрос "сделать проект адаптивным под мобильные и иные устройства", этап
// "мобильная гигиена"): до этого index.js считал размер канваса напрямую из
// window.innerWidth/innerHeight и слушал только событие 'resize'. На телефоне этого мало:
//   1) 'resize' на iOS приходит ДО того, как innerWidth/innerHeight обновятся после поворота
//      экрана — канвас пересчитывался по СТАРЫМ размерам и оставался повёрнутым неправильно
//      до следующего случайного resize. Лечится повторными пересчётами через 120/350/700 мс.
//   2) Поворот экрана в части мобильных браузеров вообще не даёт 'resize', только
//      'orientationchange', а сворачивание/разворачивание адресной строки и появление
//      экранной клавиатуры меняют только visualViewport, не window.
//   3) innerWidth/innerHeight включают области под "бровью"/вырезом камеры и под
//      системной полосой жестов (в index.html стоит viewport-fit=cover, то есть страница
//      САМА отвечает за отступы) — канвас залезал под них, и кнопки в углах игры
//      физически невозможно было нажать.
// Логические координаты игры (1280×720) этот модуль не трогает вообще — он отвечает только
// на вопрос "в какой прямоугольник физического экрана можно вписывать канвас".
//
// Экранная клавиатура сознательно НЕ учитывается как изменение вьюпорта: visualViewport при
// открытой клавиатуре уменьшается почти вдвое, и если брать размер оттуда, вся игра будет
// прыгать в масштабе на каждый ввод текста. Размер берём из window.innerWidth/innerHeight
// (устойчив к клавиатуре), а visualViewport используем только как ДОПОЛНИТЕЛЬНЫЙ сигнал
// "что-то поменялось, пересчитай".

const _subs = [];
let _timers = [];
let _rafId  = 0;
let _insets = { top: 0, right: 0, bottom: 0, left: 0 };
let _probe  = null;

// Тач-устройство. Старая проверка (только User-Agent) пропускала iPad на iPadOS 13+ (он
// отдаёт UA обычного Mac) и планшеты на Windows — поэтому к ней добавлены maxTouchPoints и
// CSS-медиазапрос (pointer:coarse = основной указатель "грубый", то есть палец).
export function detectTouch(scope = window){
    const nav = scope.navigator || {};
    if(/iPhone|iPad|iPod|Android/i.test(nav.userAgent || '')) return true;
    if((nav.maxTouchPoints || 0) > 1){
        if(!scope.matchMedia) return true;
        return scope.matchMedia('(pointer: coarse)').matches;
    }
    return false;
}

// Отступы безопасной зоны (вырез камеры, "бровь", полоса жестов). Читаются не из JS-API
// (его нет), а через скрытый элемент, которому в CSS заданы padding'и из env(safe-area-*) —
// браузер сам подставляет числа, дальше их достаточно прочитать из computed style.
// На устройствах без вырезов и в десктопных браузерах env(*) = 0, поведение не меняется.
function _readInsets(scope){
    const doc = scope.document;
    if(!_probe){
        _probe = doc.createElement('div');
        _probe.id = '_safeAreaProbe';
        _probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;'
            + 'pointer-events:none;'
            + 'padding-top:env(safe-area-inset-top);'
            + 'padding-right:env(safe-area-inset-right);'
            + 'padding-bottom:env(safe-area-inset-bottom);'
            + 'padding-left:env(safe-area-inset-left)';
        doc.body.appendChild(_probe);
    }
    const cs = scope.getComputedStyle(_probe);
    const num = (v) => { const n = parseFloat(v); return isFinite(n) && n > 0 ? n : 0; };
    _insets = {
        top:    num(cs.paddingTop),
        right:  num(cs.paddingRight),
        bottom: num(cs.paddingBottom),
        left:   num(cs.paddingLeft),
    };
    return _insets;
}

// Доступный под канвас прямоугольник физического экрана в CSS-пикселях.
export function viewportMetrics(scope = window){
    const ins = _probe ? _insets : _readInsets(scope);
    const w = Math.max(1, scope.innerWidth  - ins.left - ins.right);
    const h = Math.max(1, scope.innerHeight - ins.top  - ins.bottom);
    return { w, h, left: ins.left, top: ins.top, insets: ins, portrait: h > w };
}

export function onViewportChange(cb){
    if(typeof cb === 'function' && _subs.indexOf(cb) === -1) _subs.push(cb);
}

function _emit(scope){
    _readInsets(scope);
    const m = viewportMetrics(scope);
    for(const cb of _subs){
        try { cb(m); } catch(e){ console.error('[mobile-viewport] подписчик упал:', e); }
    }
}

// Пересчёт откладывается до следующего кадра (событий resize за один поворот прилетает
// десятки), плюс дополнительные пересчёты через 120/350/700 мс — на iOS/Android метрики
// окна после поворота приходят в актуальное состояние не сразу, а один "поздний" пересчёт
// стоит доли миллисекунды.
function _schedule(scope, late){
    if(_rafId) scope.cancelAnimationFrame(_rafId);
    _rafId = scope.requestAnimationFrame(() => { _rafId = 0; _emit(scope); });
    if(!late) return;
    for(const t of _timers) scope.clearTimeout(t);
    _timers = [120, 350, 700].map(ms => scope.setTimeout(() => _emit(scope), ms));
}

export function installMobileViewport(scope = window){
    const doc = scope.document;
    scope.isMobile = detectTouch(scope);
    _readInsets(scope);

    // Долгий тап по канвасу в мобильных браузерах открывает системное меню "сохранить
    // изображение" поверх игры, а pinch/двойной тап масштабируют страницу (канвас при этом
    // остаётся прежнего размера — видно только обрезанный кусок игры). Всё это гасится:
    // разметка запрещает зум через meta viewport + touch-action, а эти два обработчика
    // закрывают остатки (iOS-жесты и контекстное меню).
    doc.addEventListener('contextmenu', (e) => {
        if(e.target && e.target.id === 'stage') e.preventDefault();
    });
    doc.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });

    scope.addEventListener('resize', () => _schedule(scope, false));
    scope.addEventListener('orientationchange', () => _schedule(scope, true));
    if(scope.visualViewport){
        scope.visualViewport.addEventListener('resize', () => _schedule(scope, false));
        scope.visualViewport.addEventListener('scroll', () => _schedule(scope, false));
    }

    const m = viewportMetrics(scope);
    console.log('[mobile-viewport] isMobile:', scope.isMobile, '| вьюпорт:', Math.round(m.w) + '×' + Math.round(m.h),
        '| safe-area:', JSON.stringify(_insets), '| dpr:', scope.devicePixelRatio || 1);
    return m;
}
