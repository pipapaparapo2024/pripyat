/** Одноразовая подсказка при старте на портретном мобильном (05.10.2026, по прямому указанию —
 * "сообщение перевернуть телефон для начала игры", уточнено в ходе разговора: НЕ блокирующий
 * экран (CSS-автоповорот из modules/forced-landscape.js остаётся как есть и НЕ отключается),
 * только одноразовая подсказка-тост при первом обнаружении портретной ориентации на мобильном.
 *
 * Чистый DOM (как modules/rotate-overlay.js, от которого унаследован визуальный стиль иконки) —
 * не PIXI-попап, потому что должен быть независим от состояния сцены/загрузки игры и работать
 * even если PIXI ещё не инициализирован. Показывается РОВНО один раз за сессию (модульный флаг
 * _shown) — resize() в index.js может вызываться много раз подряд (поворот, изменение
 * visualViewport и т.п.), подсказка не должна выскакивать заново на каждый вызов.
 */
let _shown = false;
let _hideTimer = null;

export function showRotateHintOnce(){
    if(_shown) return;
    _shown = true;

    const el = document.createElement('div');
    el.id = '_rotateHint';
    el.style.cssText = 'position:fixed;left:50%;top:16px;transform:translateX(-50%) translateY(-20px);'
        + 'z-index:10001;max-width:86%;display:flex;align-items:center;gap:10px;'
        + 'background:rgba(10,10,10,0.88);color:#e8e0d0;border:1px solid rgba(232,224,208,0.25);'
        + 'border-radius:10px;padding:10px 16px;font-family:Arial,sans-serif;font-size:14px;'
        + 'line-height:1.35;box-shadow:0 4px 16px rgba(0,0,0,0.4);'
        + 'opacity:0;transition:opacity 0.35s ease,transform 0.35s ease;pointer-events:none;';
    el.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#e8e0d0" '
        + 'stroke-width="1.5" style="flex:0 0 auto;animation:_rotateHintSpin 1.8s ease-in-out infinite;">'
        + '<rect x="6" y="2" width="12" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/></svg>'
        + '<span>Для игры удобнее горизонтальное положение телефона — экран развернётся сам, '
        + 'можно играть и так</span>';

    const style = document.createElement('style');
    style.textContent = '@keyframes _rotateHintSpin{'
        + '0%,20%{transform:rotate(0deg)}50%,70%{transform:rotate(-90deg)}100%{transform:rotate(-90deg)}}';
    document.head.appendChild(style);
    document.body.appendChild(el);

    // Две анимационных фазы: появление (требует отдельного кадра — иначе браузер схлопывает
    // transition в мгновенную смену стилей, т.к. элемент только что вставлен в DOM), затем
    // автоскрытие через 5с. Тот же приём двойного requestAnimationFrame, что уже используется
    // в проекте для похожих CSS-переходов (см. modules/mobile-viewport.js debounce-паттерн).
    requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateX(-50%) translateY(0)';
    }));

    _hideTimer = setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => { if(el.parentNode) el.parentNode.removeChild(el); }, 400);
    }, 5000);
}

// Только для тестов/отладки — сбрасывает "уже показано", позволяя проверить логику сначала.
export function _resetRotateHintForTests(){
    _shown = false;
    if(_hideTimer) clearTimeout(_hideTimer);
    const el = document.getElementById('_rotateHint');
    if(el && el.parentNode) el.parentNode.removeChild(el);
}
