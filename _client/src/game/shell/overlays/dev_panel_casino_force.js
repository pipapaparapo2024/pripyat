/**
 * Dev-панель — форс-кнопки "100%" на каждую комбинацию казино (Зарики/Покер/Блэкджек/Рулетка).
 *
 * 25.09.2026 (по прямому указанию — "хочу тестировать все азартные игры, добавь во вкладки
 * покер/рулетка/блэкджек/зарики кнопку 100% около каждой комбинации, при нажатии на следующей
 * раздаче/броске/спине железобетонно выпадет именно она").
 *
 * Реализовано как 4 секции внутри УЖЕ существующей скроллируемой области dev-панели (не
 * отдельные переключаемые вкладки — панель и так одним колесом мыши скроллит весь список
 * секций, отдельная система вкладок здесь ничего не даёт, только усложняет). Список комбинаций
 * (18+10+9+13=50 строк) даёт длинный, но полностью просматриваемый список — прокрутка уже
 * поддержана существующим механизмом dev_panel.js (content.mask + wheel-хендлер), ничего
 * дополнительно строить не нужно.
 *
 * Каждая кнопка шлёт users.setDevCombo({game, combo}) — сервер сам гасит флаг на СЛЕДУЮЩЕЙ
 * раздаче/броске/спине этой игры (см. dice.php.start()/poker.php.deal()/blackjack.php.deal()/
 * roulette.php.spin() — везде один и тот же комментарий "DEV FORCE"). Разовый форс — под
 * следующую попытку, дальше снова честная игра, пока не нажать другую кнопку.
 *
 * Комбинации/индексы 1-в-1 совпадают с тем, что реально проверяет сервер:
 *  - Зарики: индекс строки в dice_config.json.table (0-17) — тот же порядок, что
 *    DICE_ROW_Y на клиенте (dvor-dice-screen.js).
 *  - Покер: comboKey — те же строки, что COMBO_ROW_ORDER (dvor-poker-screen.js) и
 *    poker.php._generateHandForCombo() принимает штатно.
 *  - Блэкджек: ранг из blackjack_config.json.ranks либо спецключ '__nonpair'.
 *  - Рулетка: slotIdx (0-14) — тот же индекс, что SPIN_SLOTS (roulette.php).
 */
export function attachDevPanelCasinoForce(proto){

    // Порядок и подписи — зеркало DICE_ROW_Y (dvor-dice-screen.js), индекс = позиция в массиве.
    const DICE_COMBOS = [
        '4×6 — Шмотка 5шт', '3×6 — 100 рублей', '2×6 — 10.000 сигарет',
        '4×5 — 50 рублей', '3×5 — 5.000 сигарет', '2×5 — 2 поинта',
        '4×4 — 10 автоматов', '3×4 — 10 стволов', '2×4 — 2000 сигарет',
        '4×3 — 10 мачете', '3×3 — 1000 опыта', '2×3 — 25 рублей',
        '4×2 — 2 автомат', '3×2 — 1 автомат', '2×2 — 500 опыта',
        '4×1 — 1000 сигарет', '3×1 — 250 опыта', '2×1 — 500 сигарет',
    ];

    // Порядок и подписи — зеркало COMBO_ROW_ORDER (dvor-poker-screen.js).
    const POKER_COMBOS = [
        {key:'royal_flush',     label:'Флеш-рояль'},
        {key:'straight_flush',  label:'Стрит-флеш'},
        {key:'four_of_a_kind',  label:'Каре'},
        {key:'full_house',      label:'Фулл-хаус'},
        {key:'flush',           label:'Флеш'},
        {key:'straight',        label:'Стрит'},
        {key:'three_of_a_kind', label:'Сет (тройка)'},
        {key:'two_pair',        label:'Две пары'},
        {key:'pair',            label:'Пара'},
        {key:'high_card',       label:'Старшая карта'},
    ];

    // Порядок и подписи — зеркало BJ_ROW_Y (dvor-blackjack.js). Ключ — ранг из
    // blackjack_config.json.ranks (кириллица, как на сервере), '__nonpair' — спецключ.
    const BJ_COMBOS = [
        {key:'туз',        label:'Туз-Туз (AA)'},
        {key:'король',     label:'Король-Король (KK)'},
        {key:'дама',       label:'Дама-Дама (QQ)'},
        {key:'валет',      label:'Валет-Валет (JJ)'},
        {key:'десятка',    label:'Десятка-Десятка'},
        {key:'девятка',    label:'Девятка-Девятка'},
        {key:'восьмерка',  label:'Восьмерка-Восьмерка'},
        {key:'семерка',    label:'Семерка-Семерка'},
        {key:'__nonpair',  label:'Любая непарная'},
    ];

    // Порядок — зеркало SPIN_SLOTS (roulette.php). idx 0/12 — честные отдельные ветки
    // (ключи/джекпот), не обычные валютные слоты, но форсировать их тем же способом можно —
    // идекс просто передаётся как есть, сервер сам знает, что с ним делать (jackpot=idx12
    // уже приравнивается к обычному "100% джекпот", ключи idx0 просто выпадут пустым слотом).
    const ROULETTE_SLOTS = [
        'idx0 — Связка ключей',
        'idx1 — 2 синих поинта',
        'idx2 — 40 спичек рулетки',
        'idx3 — Патроны (авто)',
        'idx4 — 10 спичек рулетки',
        'idx5 — 10.000 опыта',
        'idx6 — 20 спичек рулетки',
        'idx7 — Патроны (ствол)',
        'idx8 — 1000 сигарет',
        'idx9 — 50 спичек рулетки',
        'idx10 — 20 рублей',
        'idx11 — 10 рублей',
        'idx12 — ДЖЕКПОТ/Куш',
        'idx13 — 30 спичек рулетки',
        'idx14 — 10.000 опыта',
    ];

    proto._setDevCombo = function(game, combo){
        if(!window.TS){ console.error('[devPanel._setDevCombo] window.TS недоступен'); return; }
        TS.php('users.setDevCombo', {game, combo}, (res) => {
            console.log('[devPanel._setDevCombo] ← сохранено:', JSON.stringify(res));
            if(window.notify) notify.showResult({text: 'Форс включён (' + game + '): следующая попытка гарантирована'}, 1);
        }, (err) => {
            console.error('[devPanel._setDevCombo] ← ошибка:', JSON.stringify(err));
        });
    };

    // ctx = { _section, _row } — те же локальные билдеры, что уже используются во всех
    // остальных секциях _buildDevPanel() (см. dev_panel.js) — переиспользуем их напрямую,
    // чтобы новые строки визуально не отличались и корректно учитывались в высоте скролла
    // (curY — общая замкнутая переменная, растёт независимо от того, кто её двигает).
    proto._buildCasinoForceSections = function(ctx){
        const { _section, _row } = ctx;
        const FORCE_COLOR = 0x7a2020;
        const mkBtn = (game, combo) => [{label:'100%', color:FORCE_COLOR, action:()=>this._setDevCombo(game, combo)}];

        _section('ЗАРИКИ — 100% на комбинацию (следующий бросок)');
        DICE_COMBOS.forEach((label, i) => _row(label, mkBtn('dice', String(i))));

        _section('ПОКЕР — 100% на комбинацию (следующая раздача)');
        POKER_COMBOS.forEach(c => _row(c.label, mkBtn('poker', c.key)));

        _section('БЛЭКДЖЕК — 100% на комбинацию (следующая раздача)');
        BJ_COMBOS.forEach(c => _row(c.label, mkBtn('blackjack', c.key)));

        _section('РУЛЕТКА — 100% на сектор (следующий спин)');
        ROULETTE_SLOTS.forEach((label, i) => _row(label, mkBtn('roulette', String(i))));
    };
}
