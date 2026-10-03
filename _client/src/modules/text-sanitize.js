// Шрифт Southbank LT не содержит заглавную «Ё» — она рендерится как чужеродная строчная
// «ё» посреди капса (см. попап «ЗАЧИСТИ ТёМНАЯ ДОЛИНА!»). Патчим PIXI.Text.text на уровне
// сеттера, чтобы любой текст (и статичные строки, и динамический — ники, названия локаций)
// автоматически заменял ё/Ё на е/Е, без правок в каждом месте создания текста по отдельности.
export function installYoFix(pixi = window.PIXI){
    if(!pixi || !pixi.Text || !pixi.Text.prototype) return;
    const desc = Object.getOwnPropertyDescriptor(pixi.Text.prototype, 'text');
    if(!desc || !desc.set || desc.set._yoFixInstalled) return;

    const origSet = desc.set;
    const patchedSet = function(value){
        if(typeof value === 'string' && (value.indexOf('ё') !== -1 || value.indexOf('Ё') !== -1)){
            value = value.replace(/Ё/g, 'Е').replace(/ё/g, 'е');
        }
        origSet.call(this, value);
    };
    patchedSet._yoFixInstalled = true;

    Object.defineProperty(pixi.Text.prototype, 'text', { ...desc, set: patchedSet });
}
