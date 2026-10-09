import { collapseToTopPerFamily, achievementFamilyKey, achievementThreshold, familyMembers, getStatValue } from '../../modules/achievement-tiers.js';

/** «Мои достижения» — вкладка внутри «Топ по достижениям» (второй саб-таб рядом с «Общий
 * топ»). Показывает СОБСТВЕННЫЙ прогресс игрока по реальному списку window.achievements.list
 * (331 достижение, game/achievements.js) — не тот старый отдельный список из 33 ачивок,
 * что был в прежней Сводке (см. правило пользователя 17.09.2026 — заменить полностью).
 *
 * Схлопывание по темам (17.09.2026, по прямому указанию): "выбил 20 достижений — тушёнка и
 * голоса — показывай не 20, а 2" — т.е. для КАЖДОЙ темы (family) показывается ОДНА карточка:
 * максимальный УЖЕ ЗАРАБОТАННЫЙ уровень, а если в теме ещё ничего не заработано — минимальный
 * (следующая цель). Логика группировки — в общем модуле modules/achievement-tiers.js (та же,
 * что используется в achievements.js для схлопывания попапов при одновременном пересечении
 * нескольких порогов одной темы).
 *
 * Координаты карточки (X=354 Y=169, W=672 H=149) — из PSD-макета, снятые пользователем
 * 17.09.2026 напрямую (не расчёт по центру панели, как было раньше).
 *
 * 21.09.2026 (аккордеон, по прямому указанию): темы с БОЛЬШЕ ЧЕМ ОДНИМ тиром кликабельны —
 * разворачивают список ВСЕХ тиров темы прямо под карточкой (сдвигая последующие карточки
 * вниз). Тиры из одного пункта (kill/solo/fast, комбинации карт/покера/рулетки) не
 * разворачиваются — familyMembers() вернёт массив длины 1.
 *
 * 21.09.2026 (правка того же дня, по прямому указанию — репорт "самодельные ячейки, должна
 * открываться ячейка как изначальный файл, между ячейками огромное расстояние"): тиры внутри
 * развёрнутой темы раньше рисовались ОТДЕЛЬНЫМ пулом с Graphics-фоном собственного дизайна —
 * выглядели чужеродно рядом с настоящими карточками и требовали лишний CHILD_H/CHILD_GAP,
 * из-за которых на глаз казался разрыв между карточками при развороте. Теперь тиры — это
 * СТРОГО ТЕ ЖЕ pool-карточки (та же текстура «кароточка достижений.png», тот же CARD_H,
 * тот же шаг), просто вставленные в общую последовательность сразу под "базовой" карточкой
 * темы; отличаются только тем, что вместо очков/статуса показывают прогресс-бар (current/
 * target) и не кликабельны (не разворачивают ничего дальше).
 *
 * 21.09.2026 (та же тема, повторный репорт со скриншотом редактора позиций — "ячейки всё ещё
 * имеют прозрачные отступы сверху и снизу, убери их, сделай зазор между ячейками 10px, а то,
 * что скроллится, опусти вниз на 36px") — прямым измерением альфа-канала «кароточка
 * достижений.png» (671×149) выяснилось: реально НЕПРОЗРАЧНЫЙ (видимый) рисунок занимает
 * только строки 43..112 (70px) — 43px прозрачного поля сверху и 36px снизу ВСЕГДА были частью
 * файла, просто раньше ВСЯ раскладка (позиции текста, шаг между карточками) считалась от
 * полных 149px, как будто рисунок занимает всю карточку. Первая попытка фикса компенсировала
 * это ТОЛЬКО в раскладке (CARD_VISIBLE_TOP-сдвиг для текста/иконки, CARD_STEP по видимой
 * высоте) — сама текстура при этом оставалась 149px, поэтому:
 *   1) редактор позиций (getBounds() по card/cardBg) по-прежнему показывал полные 149px —
 *      прозрачные поля были не видны глазом, но продолжали физически существовать;
 *   2) `card.interactive=true` (разворачивание темы по клику) использует bounds контейнера
 *      по умолчанию — хит-зона клика включала эти 43+36px прозрачных полей, а не только
 *      реально нарисованную карточку.
 * 22.09.2026 (повторный репорт — "ячейки всё ещё имеют прозрачные отступы, убери их"): вместо
 * очередной компенсации в раскладке файл «кароточка достижений.png» ОБРЕЗАН до реальных видимых
 * границ (671×70, ровно строки 43..112 старого файла) — теперь текстура и видимый рисунок
 * СОВПАДАЮТ, отступов не существует ни визуально, ни в хит-зоне/bounds. CARD_VISIBLE_TOP убран
 * (=0, крой уже сдвинул точку отсчёта), CARD_VISIBLE_H (=70, реальная высота файла теперь)
 * остался единственным источником правды для внутренней раскладки и шага между карточками.
 */
export function attachSvodAchievements(proto){
    const IMG = './images/';

    const PANEL_X = 284, PANEL_Y = 65;
    // 22.09.2026 (по прямому указанию, редактор позиций): зазор между карточками уменьшен на
    // 4px (10→6), отступ первой карточки сверху увеличен на 4px (10→14).
    const CARD_W = 672, CARD_GAP = 6;
    // «кароточка достижений.png» обрезан до реальных видимых границ (671×70, см. коммент в
    // шапке файла) — текстура теперь РОВНО видимый рисунок, без прозрачных полей.
    // CARD_VISIBLE_H — единственная высота, которая существует (текстура = контент).
    const CARD_VISIBLE_H = 70;
    // Шаг между карточками — реальная высота карточки + видимый зазор CARD_GAP.
    const CARD_STEP = CARD_VISIBLE_H + CARD_GAP;
    // 23.09.2026 (по прямому указанию, репорт "слишком большой отступ сверху, сделай такой же,
    // как в топе по урону"): в svod-leaderboard.js (Топ по урону/авторитету) первая строка
    // стоит РОВНО у верхней границы видимой области (row.y = i*ROW_H, для строки 0 это 0,
    // никакого дополнительного отступа внутри viewport нет вообще) — а здесь сверх LIST_TOP
    // (который уже сдвинут вниз ради заголовков/анти-бага, см. коммент у LIST_TOP ниже) ещё
    // накручивался СВОЙ отдельный внутренний отступ CARD_TOP_OFFSET=34px. Убран (=0) — первая
    // карточка теперь тоже стоит вплотную к верху viewport, тот же принцип, что у лидерборда.
    // Было (история): 14.09→14, 22.09 "увеличь отступ от первой ячейки на 20px"→34.
    const CARD_TOP_OFFSET = 0;
    // 25.09.2026 (по прямому указанию, редактор позиций — маска списка сделана редактируемой,
    // см. коммент "маска сделана РЕДАКТИРУЕМОЙ" в svod-scroll.js): x/y/w/h окна списка сняты
    // пользователем напрямую (349,242,672,286) — было 354/(169+36+38=243)/672/298.
    const CARD_X = 349;
    // 21.09.2026 (по прямому указанию — "то, что скроллится, опусти вниз на 36px"): базовые
    // 169 (PSD) + 36 — первая карточка была слишком близко к дублирующим заголовкам
    // "МЕСТО/ИГРОК/УРОВЕНЬ/ДОСТИЖЕНИЯ", запечённым в фоне панели.
    // 22.09.2026 (повторный репорт, по прямому указанию — "сверху ограничение для ячеек
    // достижений слишком маленькое, опусти его вниз на 50px"): верхняя граница маски списка
    // (viewY в _buildSvodScroll) стояла слишком высоко — верх предыдущей проскроленной
    // карточки оставался виден над первой видимой карточкой. Эти два сдвига (36+50) — про
    // положение viewport относительно ФОНА панели (борьба с наездом на запечённые заголовки/
    // утечкой соседней карточки) и НЕ трогаются правкой 23.09.2026 выше — это другая причина,
    // не тот же "лишний отступ", на который жаловались в этот раз (см. комментарий у
    // CARD_TOP_OFFSET).
    // LIST_TOP поднят на 12px: зазор между строкой заголовков и первой карточкой был заметно
    // больше, чем между самими карточками. LIST_H — высота, вмещающая РОВНО 4 полных карточки при текущем CARD_TOP_OFFSET (формула
    // ниже пересчитывается автоматически, если он снова изменится): 0 + 4*70 + 3*6 = 298.
    // LIST_H снят напрямую редактором позиций (286, было 298 по формуле) — окно списка
    // (viewport маски, не размер самих карточек) уменьшено пользователем вручную.
    const LIST_TOP = 242, LIST_H = 286;
    // 110 семей + запас на разворот самой длинной темы (16 тиров exp, минус 1 уже учтённый
    // как "базовая" карточка = +15 доп.строк) — с большим запасом на будущее.
    const CARD_POOL = 130;

    // Позиции внутри карточки — теперь просто координаты внутри обрезанной текстуры (0..70),
    // без CARD_VISIBLE_TOP-сдвига (крой уже перенёс точку отсчёта — см. коммент в шапке файла).
    const ICON_CENTER_Y   = CARD_VISIBLE_H / 2; // 35
    // 22.09.2026 (по прямому указанию, новый снимок редактора позиций поверх иконки — "поменял
    // расположение иконок для достижений"): x было 60, y/w/h (35/56/56) не менялись.
    const ICON_X = 54;
    // 22.09.2026 (по прямому указанию, редактор позиций — читка "Автоматная нычка" x:102 y:57
    // в СТАРОЙ, ещё не обрезанной на тот момент текстуре, где 0 = верх ПОЛНЫХ 149px, а видимая
    // полоса начиналась с 43 — конвертация в новую систему отсчёта: 57-43=14, x без изменений).
    // 22.09.2026 (повторный снимок редактора, тем же днём — "поменял расположение и координаты
    // названия ячейки"): было 102/14, стало 95/11.
    const NAME_X = 95;
    const NAME_Y = 11;
    // 22.09.2026 (по прямому указанию — "уменьшил размер текста [описания]"): было снято
    // редактором позиций как scale:0.965 поверх fontSize:13 — 08.10.2026 (фикс пикселизации
    // текста, по прямому указанию дизайнера) свёрнуто прямо в wordWrapWidth descTxt ниже
    // (*0.965), сам scale.set() убран.
    const DESC_Y          = 29;
    const PTS_Y           = 50;
    // 23.09.2026 (по прямому указанию — координаты X:518 Y:258 из PSD-макета карточки
    // достижений, тот же макет, что уже даёт X=354/Y=169 для самой карточки, см. шапку файла):
    // переведено в локальные координаты относительно карточки — (518-354, 258-169) = (164, 89),
    // минус 43px обрезанного прозрачного поля сверху (см. историю CARD_VISIBLE_H в шапке файла)
    // = (164, 46). Размер задан прямо пользователем — 308×12 (было формулой = PTS_Y/420×12).
    // Применяется одинаково ко ВСЕМ карточкам списка (PROGRESS_BAR_* — общие константы для
    // цикла создания карточек, не только для первой).
    const PROGRESS_BAR_X = 164, PROGRESS_BAR_Y = 46, PROGRESS_BAR_W = 308, PROGRESS_BAR_H = 12;
    // 22.09.2026 (по прямому указанию — "центрируй [описание] относительно прогресс-бара, а не
    // всей ячейки"): раньше descTxt.x = CARD_W/2 (центр ВСЕЙ карточки, 336) — теперь центр
    // именно прогресс-бара (120+420/2=330), формулой от тех же PROGRESS_BAR_X/W, что и сам бар,
    // а не независимым отдельным числом — так оба элемента остаются согласованы, если ширина/
    // позиция бара когда-нибудь ещё раз изменится.
    const DESC_CENTER_X = PROGRESS_BAR_X + PROGRESS_BAR_W / 2;

    // 24.09.2026 (по прямому указанию, координаты из Photoshop — тот же PSD-макет карточки, что
    // и PROGRESS_BAR_* выше): галочка снята как X:834 Y:250, бейдж «звёзды получены» — X:895
    // Y:249. Перевод в локальные координаты карточки — та же формула, что уже использована для
    // PROGRESS_BAR_* (минус базовые 354/169 макета, минус 43px обрезанного прозрачного поля
    // сверху, см. историю CARD_VISIBLE_H в шапке файла): (834-354, 250-169-43)=(480,38);
    // (895-354, 249-169-43)=(541,37).
    // 25.09.2026 (по прямому указанию, редактор позиций — новые точечные снимки поверх карточки
    // "ОХОТНИК ПОВЕРЖЕН"): галочка X:490 Y:50 (было 480/38), бейдж «звёзды получены» Y:49
    // (было 37, X:541 не менялся), число очков X:519 Y:50 (было формулой-серединой между
    // галочкой и бейджем — снято отдельно, больше не привязано к их позициям).
    const CHECK_X = 490, CHECK_Y = 50;
    const STARS_GOT_X = 541, STARS_GOT_Y = 49;
    const PTS_TXT_X = 519, PTS_TXT_Y = 50;

    // 21.09.2026 (общая копия саб-табов "ОБЩИЙ ТОП"/"МОИ ДОСТИЖЕНИЯ" — баг найден, по прямому
    // указанию: "кнопки пропали при открытии Мои достижения") — эти кнопки физически жили
    // ТОЛЬКО внутри окна лидерборда (svod-leaderboard.js._buildLeaderboardPanel), а переход на
    // "Мои достижения" прячет ВСЁ окно лидерборда целиком (panel.visible=false), включая сами
    // кнопки — обратно переключиться было нечем. Константы позиций — те же самые, что в
    // svod-leaderboard.js (SUBTAB_*), скопированы намеренно: это две независимые панели,
    // каждая рисует свою пару кнопок сама, не полагаясь на соседнюю (которая в момент показа
    // текущей — скрыта).
    const SUBTAB_Y = 173;
    const SUBTAB_ALL_X = 542;
    // 22.09.2026 (баг найден по живому репорту — "когда МОИ ДОСТИЖЕНИЯ активна, расстояние
    // между кнопками почти пропадает"): эта копия константы отстала от svod-leaderboard.js —
    // там SUBTAB_SECOND_X уже подняли до 801 (см. svod-achievements-tab-position-and-
    // transparent-padding-crop.test.js), а эту вторую намеренно продублированную копию забыли
    // обновить, кнопка на этой панели рисовалась на 12px левее, чем должна.
    const SUBTAB_SECOND_X = 801, SUBTAB_SECOND_Y = 191;

    proto._buildMyAchievementsPanel = function(cfg){
        const win = new PIXI.Container();
        win.visible = false;
        // 25.09.2026: тот же фикс, что в svod-leaderboard.js (см. коммент там) — win.interactive
        // обязателен, иначе _buildSvodScroll вообще не может доставить pointermove/pointerup
        // для перетаскивания бегунка (колесо мыши работает независимо, через DOM-слушатель).
        win.interactive = true;

        const bg = new PIXI.Sprite(PIXI.Texture.from(IMG + cfg.bgFile));
        bg.x = PANEL_X; bg.y = PANEL_Y;
        win.addChild(bg);

        // Саб-табы — своя копия (см. коммент у SUBTAB_* выше). "Общий топ" здесь всегда
        // неактивен (мы уже на "Мои достижения"), клик по нему возвращает на лидерборд.
        const subAll = new PIXI.Sprite(PIXI.Texture.from(IMG + 'общий топ неактив.png'));
        subAll.anchor.set(0.5, 0.5);
        subAll.x = SUBTAB_ALL_X + 79; subAll.y = SUBTAB_Y + 17.5;
        subAll.interactive = true; subAll.buttonMode = true;
        subAll.on('pointerdown', () => { if(typeof cfg.onSwitchToGeneral === 'function') cfg.onSwitchToGeneral(); });
        win.addChild(subAll);

        const subSecond = new PIXI.Sprite(PIXI.Texture.from(IMG + cfg.secondBtnActive));
        subSecond.anchor.set(0.5, 0.5);
        subSecond.x = SUBTAB_SECOND_X; subSecond.y = SUBTAB_SECOND_Y;
        // Уже выбрана (мы на ней) — не интерактивна, чисто индикатор, как subAll на соседней панели.
        win.addChild(subSecond);

        const cardsContainer = new PIXI.Container();
        cardsContainer.x = CARD_X; cardsContainer.y = LIST_TOP;
        win.addChild(cardsContainer);

        const cards = [];
        for(let i = 0; i < CARD_POOL; i++){
            const card = new PIXI.Container();
            card.visible = false; // .y выставляется динамически в _svodRefreshAchievements

            const cardBg = new PIXI.Sprite(PIXI.Texture.from(IMG + 'кароточка достижений.png'));
            card.addChild(cardBg);

            const iconTxt = new PIXI.Text('🏆', { fontFamily:'Arial', fontSize:32 });
            iconTxt.anchor.set(0.5, 0.5);
            iconTxt.x = ICON_X; iconTxt.y = ICON_CENTER_Y;
            card.addChild(iconTxt);

            // Цвет текста #1a1c1c — снят пользователем 18.09.2026 напрямую в Photoshop из
            // достиги.psd. Карточка «кароточка достижений.png» — светлый пергамент, старый
            // светлый цвет (#e8d9b8/#b8a888) на нём был почти нечитаем.
            const nameTxt = new PIXI.Text('', {
                fontFamily:'Southbank LT', fontSize:16, fill:'#1a1c1c', fontWeight:'bold',
                wordWrap:true, wordWrapWidth: CARD_W - 260,
            });
            nameTxt.x = NAME_X; nameTxt.y = NAME_Y;
            card.addChild(nameTxt);

            // 22.09.2026 (по прямому указанию — "добавил блок для текста, текст внутри
            // центрирует"): раньше лево-выровнен (anchor 0,0, x=120) — теперь центрирован по
            // горизонтали относительно ширины всей карточки (align:'center' на случай переноса
            // строки при wordWrap — иначе центрируется только БЛОК текста целиком, а не каждая
            // строка внутри него).
            const descTxt = new PIXI.Text('', {
                fontFamily:'Southbank LT', fontSize:13, fill:'#1a1c1c', align:'center',
                wordWrap:true, wordWrapWidth: (CARD_W - 260) * 0.965,
            });
            descTxt.anchor.set(0.5, 0);
            descTxt.x = DESC_CENTER_X; descTxt.y = DESC_Y;
            card.addChild(descTxt);

            // Очки/статус — режим "базовая карточка темы" (не тир). Взаимоисключающе со
            // прогресс-баром ниже (см. bar/fracTxt) — показывается только один из двух.
            // 24.09.2026: раньше стояла на 120/PTS_Y и текст никогда не выставлялся (осталась
            // заглушкой без реального использования) — переиспользована и передвинута между
            // галочкой и бейджем «звёзды получены» (см. CHECK_X/STARS_GOT_X выше), теперь
            // реально показывает суммарные очки, полученные игроком в этой теме достижений.
            const ptsTxt = new PIXI.Text('', { fontFamily:'Southbank LT', fontSize:14, fill:'#1a1c1c', fontWeight:'bold' });
            ptsTxt.anchor.set(0.5, 0.5);
            ptsTxt.x = PTS_TXT_X; ptsTxt.y = PTS_TXT_Y;
            card.addChild(ptsTxt);

            // Галочка — тема ПОЛНОСТЬЮ выполнена (заработаны ВСЕ тиры темы), см. _fillCard.
            const checkMark = new PIXI.Sprite(PIXI.Texture.from(IMG + 'галочка.png'));
            checkMark.anchor.set(0.5, 0.5);
            checkMark.x = CHECK_X; checkMark.y = CHECK_Y;
            checkMark.visible = false;
            card.addChild(checkMark);

            // Бейдж «звёзды получены» — игрок заработал ХОТЯ БЫ один тир этой темы (не обязательно
            // все, см. _fillCard) — в отличие от галочки выше, которая требует полного комплекта.
            const starsGotBadge = new PIXI.Sprite(PIXI.Texture.from(IMG + 'звезды полученные.png'));
            starsGotBadge.anchor.set(0.5, 0.5);
            starsGotBadge.x = STARS_GOT_X; starsGotBadge.y = STARS_GOT_Y;
            starsGotBadge.visible = false;
            card.addChild(starsGotBadge);

            // Прогресс-бар — режим "строка тира внутри развёрнутой темы" (21.09.2026). Та же
            // карточка целиком (текстура/размер/шаг), просто эти два элемента заменяют ptsTxt.
            // 22.09.2026 (по прямому указанию, новый файл «прогресс заполнения достижений.png» —
            // "это по факту полное заполнение всего прогресса ячейки, покажи прогресс заполнения
            // благодаря этому файлу"): вместо сплошной заливки Graphics — текстурный спрайт,
            // раскрытый маской слева направо на долю frac (та же формула ширины, что была у
            // Graphics-варианта — просто применяется как маска поверх текстуры, а не как заливка).
            const bar = new PIXI.Container();
            bar.x = PROGRESS_BAR_X; bar.y = PROGRESS_BAR_Y;
            bar.visible = false;
            card.addChild(bar);

            const barTrack = new PIXI.Graphics();
            barTrack.beginFill(0x5a4a32, 0.5);
            barTrack.drawRoundedRect(0, 0, PROGRESS_BAR_W, PROGRESS_BAR_H, PROGRESS_BAR_H / 2);
            barTrack.endFill();
            bar.addChild(barTrack);

            const barFill = new PIXI.Sprite(PIXI.Texture.from(IMG + 'прогресс заполнения достижений.png'));
            barFill.width = PROGRESS_BAR_W; barFill.height = PROGRESS_BAR_H;
            bar.addChild(barFill);

            const barFillMask = new PIXI.Graphics();
            bar.addChild(barFillMask);
            barFill.mask = barFillMask;

            const fracTxt = new PIXI.Text('', { fontFamily:'Southbank LT', fontSize:12, fill:'#8a7a5a' });
            fracTxt.x = PROGRESS_BAR_X + PROGRESS_BAR_W + 10; fracTxt.y = PROGRESS_BAR_Y - 3;
            fracTxt.visible = false;
            card.addChild(fracTxt);

            // 29.09.2026 (по прямому указанию): alpha=0.85 на всю группу звезды (основание +
            // заливка прогресса + число очков внутри) — раньше рисовалась полностью непрозрачной
            // (alpha по умолчанию 1), звезда с числом суммарных очков достижения/темы (если
            // пройти полностью) должна визуально чуть "уходить на второй план" рядом с галочкой/
            // прогресс-баром, а не перетягивать внимание наравне с ними.
            const star = new PIXI.Sprite(PIXI.Texture.from(IMG + 'звездочка пустая.png'));
            star.anchor.set(0.5, 0.5);
            star.x = CARD_W - 60; star.y = ICON_CENTER_Y;
            star.scale.set(0.75); // на 70px видимой полосы полноразмерная звезда (для 149px карточки) не помещалась
            star.alpha = 0.85;
            card.addChild(star);

            // Пустая звезда всегда остаётся основанием. Цветная звезда поверх неё обрезается
            // сектором прогресса; сектор начинается сверху и идёт против часовой стрелки.
            const starFill = new PIXI.Sprite(PIXI.Texture.from(IMG + 'звездочка фулл.png'));
            starFill.anchor.set(0.5, 0.5);
            starFill.x = star.x; starFill.y = star.y;
            starFill.scale.set(0.75);
            starFill.alpha = 0.85;
            card.addChild(starFill);
            const starFillMask = new PIXI.Graphics();
            card.addChild(starFillMask);
            starFill.mask = starFillMask;

            // 27.09.2026 (по прямому указанию, скриншот со стрелкой на звёздочку прогресса —
            // "если звёздочка полная, пиши в ней кол-во очков достижений"): число очков, которое
            // даёт тема/достижение — только когда звезда заполнена целиком (starProgress===1),
            // см. _fillCard. Для базовой карточки темы, завершённой ПОЛНОСТЬЮ (все тиры
            // заработаны) — сумма очков всей темы (opts.totalPtsEarned, то же число, что уже
            // показывает ptsTxt в ветке themeComplete); для одиночного достижения/тира — очки
            // именно этого достижения (a.pts, то же поле, что и ptsTxt в ветке showBar).
            // 29.09.2026 (по прямому указанию): x сдвинут на +1px вправо относительно центра
            // звезды (star.x) — на глаз число сидело чуть левее геометрического центра иконки.
            const starPtsTxt = new PIXI.Text('', { fontFamily:'Southbank LT', fontSize:12, fill:'#ffffff', fontWeight:'bold' });
            starPtsTxt.anchor.set(0.5, 0.5);
            starPtsTxt.x = star.x + 1; starPtsTxt.y = star.y;
            starPtsTxt.visible = false;
            starPtsTxt.alpha = 0.85;
            card.addChild(starPtsTxt);

            cardsContainer.addChild(card);
            const co = { card, iconTxt, nameTxt, descTxt, ptsTxt, checkMark, starsGotBadge, bar, barFillMask, fracTxt, star, starFill, starFillMask, starPtsTxt, _familyKey: null, _expandable: false, _isTierRow: false };
            cards.push(co);

            // Слушатель ставится ОДИН раз на пул-объект, а не каждый рефреш — читает АКТУАЛЬНОЕ
            // состояние co._familyKey/_expandable/_isTierRow, которое refresh() обновляет
            // каждый раз перед этим (клик всегда происходит уже после того, как пул отрисован
            // хотя бы раз). Строки тиров (_isTierRow) НИКОГДА не разворачиваются — им нечего
            // разворачивать дальше, клик по ним — no-op.
            // 28.09.2026 (адаптив под мобильные): было card.on('pointerdown', ...) — аккордеон
            // разворачивался в момент КАСАНИЯ, поэтому любая попытка пролистать список пальцем
            // (свайп начинается с карточки) сначала раскрывала эту карточку. helper.onTap
            // срабатывает на отпускании и только если палец не уехал дальше 10px — свайп больше
            // не считается кликом. Именно это разблокировало свайп-прокрутку в svod-scroll.js.
            // Мышью поведение то же самое: нажал-отпустил на месте = клик.
            helper.onTap(card, () => {
                if(co._isTierRow || !co._expandable) return;
                win._expandedKey = (win._expandedKey === co._familyKey) ? null : co._familyKey;
                win._svodRefreshAchievements();
            });
        }

        let totalContentH = CARD_TOP_OFFSET;
        win._expandedKey = null;
        // 24.09.2026 (по прямому указанию — "стрелка вниз в Мои достижения на x1033 y543, а в
        // Общем топе на x1034 y480, сделай одинаково"): раньше arrowDownY здесь не передавался —
        // дефолтная формула viewY+viewH+2 (243+298+2=543) давала другую позицию, чем у соседнего
        // экрана топа (там она явно зафиксирована на 480, см. svod-leaderboard.js). arrowDownY
        // теперь тоже явный 480, единый для обоих экранов Сводки.
        // 25.09.2026 (повторный репорт, по прямому указанию — "как будто разное расположение
        // стрелок вверх/вниз, сделай как в общем топе"): arrowX всё ещё был 1033 здесь против
        // 1034 в svod-leaderboard.js — только Y унифицировали вчера, X остался рассинхронизирован
        // на 1px, из-за чего разница осталась видна. Теперь оба экрана используют arrowX:1034.
        const scroll = this._buildSvodScroll({
            parent: win,
            contentContainer: cardsContainer,
            viewX: CARD_X, viewY: LIST_TOP, viewW: CARD_W, viewH: LIST_H,
            trackX: 1035, arrowX: 1034, arrowDownY: 480,
            stepPx: CARD_STEP,
            getTotalH: () => totalContentH,
        });

        const _setStarProgress = (c, progress) => {
            const fraction = Math.max(0, Math.min(1, Number(progress) || 0));
            const mask = c.starFillMask;
            const cx = c.star.x, cy = c.star.y;
            const radius = 90;
            mask.clear();
            if(fraction <= 0){
                c.starFill.visible = false;
                return;
            }
            c.starFill.visible = true;
            mask.beginFill(0xffffff);
            if(fraction >= 1){
                mask.drawCircle(cx, cy, radius);
            } else {
                const segments = Math.max(2, Math.ceil(48 * fraction));
                mask.moveTo(cx, cy);
                for(let i = 0; i <= segments; i++){
                    // В экранных координатах рост угла идёт по часовой, поэтому вычитаем его.
                    const angle = -Math.PI / 2 - (Math.PI * 2 * fraction * i / segments);
                    mask.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
                }
                mask.lineTo(cx, cy);
            }
            mask.endFill();
        };

        // Заполняет ОДНУ pool-карточку данными — общая для базовой карточки темы и для строки
        // тира; разница только в isTierRow (переключает pts/star ⇄ progress-bar и кликабельность).
        const _fillCard = (c, a, opts) => {
            const { isTierRow, expandable, familyKey, state } = opts;
            const done = !!(window.achievements && window.achievements.earned && window.achievements.earned[a.id]);

            c._familyKey = familyKey;
            c._expandable = expandable;
            c._isTierRow = isTierRow;

            const hasIconHelper = window.iface && typeof iface._achievementIconFor === 'function';
            if(hasIconHelper){
                c.iconTxt.visible = false;
                if(!c._iconSpr){
                    c._iconSpr = new PIXI.Sprite();
                    c._iconSpr.anchor.set(0.5, 0.5);
                    c._iconSpr.x = ICON_X; c._iconSpr.y = ICON_CENTER_Y;
                    // 21.09.2026: было 64×64 под полноразмерную 149px карточку — на 70px видимой
                    // полосы не помещалось (вылезало в прозрачные поля соседних карточек).
                    c._iconSpr.width = 56; c._iconSpr.height = 56;
                    c.card.addChildAt(c._iconSpr, 1);
                }
                c._iconSpr.texture = PIXI.Texture.from(iface._achievementIconFor(a));
            }
            c.nameTxt.text = a.name;
            c.descTxt.text = (window.iface && typeof iface._achievementDesc === 'function') ? iface._achievementDesc(a) : '';

            // 25.09.2026 (по прямому указанию, 2 скриншота — "у раскрытого «Раздающий боль» нет
            // полоски прогресса, хотя у той же карточки в развёрнутом списке она есть" +
            // "«Охотник повержен» выполнен, но должен быть заполнен с прогрессом"): базовая
            // карточка темы (не тир) раньше ВСЕГДА скрывала прогресс-бар и показывала вместо
            // него очки/галочку/бейдж — это было нормально, пока карточка показывала МАКСИМАЛЬНЫЙ
            // ЗАРАБОТАННЫЙ тир (там играть было нечего, тема и так "закрыта"). Но после фикса
            // collapseToTopPerFamily() (см. modules/achievement-tiers.js) карточка темы теперь
            // чаще показывает СЛЕДУЮЩУЮ НЕЗАРАБОТАННУЮ цель — для нецелой темы нужен именно
            // прогресс-бар к этой цели, а не сводка "уже получено". Для тем из ОДНОГО тира
            // (kill/solo/fast/комбинации — membersCount<=1, не разворачиваются) сводка тоже не
            // имеет смысла — это не "тема с несколькими тирами", а просто одно достижение целиком,
            // бар нагляднее галочки+звёздочки-индикатора (которая заметно теряется рядом с
            // соседними элементами). Бар теперь показывается ВСЕГДА, кроме случая, когда тема
            // состоит из НЕСКОЛЬКИХ тиров и ВСЕ они уже заработаны — там сводка (общие очки +
            // галочка "тема выполнена целиком") по-прежнему уместнее одного бара на 100%.
            const membersCount  = opts.membersCount || 0;
            const earnedCount   = opts.earnedCount || 0;
            const themeComplete = membersCount > 1 && earnedCount === membersCount;
            const showBar = isTierRow || !themeComplete;

            if(showBar){
                const target = achievementThreshold(a);
                const cur = getStatValue(state, a.statPath);
                // 25.09.2026 (по прямому указанию, скриншот — "достижение выполнено (галочка +
                // награда), а полоска прогресса сверху не заполнена"): done приходит из
                // серверного window.achievements.earned (см. строку выше) — источник истины с
                // 25.09.2026 миграции достижений на сервер (achievements.php.sync()). cur/target
                // же считаются ЗДЕСЬ, на клиенте, по живому udata-снимку (window.achievements
                // ._state()) — тот же statPath, что и на сервере, но не гарантированно то же
                // самое число В ТОЧНОСТИ на момент показа карточки (иная секунда чтения,
                // округления и т.п.). Для уже заработанного достижения бар обязан показывать
                // 100% независимо от текущего cur — сервер уже подтвердил цель достигнутой,
                // недолив бара при этом читается как баг ("выполнено, но не выполнено").
                const frac = done ? 1 : (target > 0 ? Math.min(1, cur / target) : 0);

                // 26.09.2026 (по прямому указанию, скриншот — "Охотник повержен выполнен, но
                // галочка не стоит, а должна стоять, если достижение выполнено"): раньше
                // галочка ЖЁСТКО скрывалась в этой ветке (бар против галочки — выбирали ТОЛЬКО
                // бар, см. большой коммент выше про 25.09.2026: "галочка+звёздочка теряется
                // рядом с соседними элементами"). CHECK_X=490/PTS_TXT_X=519/STARS_GOT_X=541 стоят
                // ПОСЛЕДОВАТЕЛЬНО СРАЗУ ЗА концом бара (PROGRESS_BAR_X+PROGRESS_BAR_W=164+308=472)
                // — визуально не перекрывают ни бар, ни друг друга, поэтому можно показывать все
                // элементы одновременно: бар остаётся индикатором прогресса, галочка/очки/бейдж —
                // подтверждением "уже выполнено", когда done===true (для одиночных достижений —
                // kill/solo/fast — done===true и есть 100% факта; для тира внутри развёрнутой
                // темы — тот же смысл на уровне конкретного тира).
                // 26.09.2026 (повторный репорт тем же днём, скриншот — "у выполненных достижений
                // нет ни галочки, ни количества очков, ни значка звёзд"): предыдущий фикс добавил
                // только галочку, ptsTxt/starsGotBadge остались жёстко скрыты в этой ветке — теперь
                // все три показываются вместе при done===true, очки берутся из a.pts (то же поле,
                // что уже использует collapseToTopPerFamily()/achievements.js для конкретного тира).
                c.checkMark.visible = done;
                c.starsGotBadge.visible = done;
                c.ptsTxt.visible = done;
                c.ptsTxt.text = done ? ('+' + (a.pts || 0)) : '';
                c.bar.visible = true; c.fracTxt.visible = false;
                c.fracTxt.text = '';

                // Трек (пустой фон бара) статичен — рисуется один раз при создании (barTrack).
                // Заполнение — та же формула ширины, что была у Graphics-варианта, только
                // теперь это маска поверх текстурного спрайта (прогресс заполнения достижений.png).
                // 26.09.2026 (баг найден по прямому указанию, скриншот — "у невыполненного
                // достижения виден маленький красный кусочек прогресса, хотя должно быть
                // пусто"): Math.max(PROGRESS_BAR_H, ...) держал МИНИМАЛЬНУЮ ширину заливки
                // равной высоте бара даже при frac===0 — задумано было не ломать скруглённые
                // края при почти-нулевом, но НЕНУЛЕВОМ прогрессе, а по факту рисовало заметный
                // кусочек заливки вообще всегда, включая честный 0%. Минимальная ширина
                // применяется, только если frac реально больше нуля — ровно 0% теперь ровно 0px.
                c.barFillMask.clear();
                c.barFillMask.beginFill(0xffffff);
                const fillW = frac > 0 ? Math.max(PROGRESS_BAR_H, PROGRESS_BAR_W * frac) : 0;
                c.barFillMask.drawRoundedRect(0, 0, fillW, PROGRESS_BAR_H, PROGRESS_BAR_H / 2);
                c.barFillMask.endFill();

                // Тир внутри развёрнутой темы — никогда не кликабелен (нечего разворачивать
                // дальше). Базовая карточка темы (не тир), показанная как бар — по-прежнему
                // кликабельна, ЕСЛИ у темы больше одного тира (есть что разворачивать).
                c.card.interactive = c.card.buttonMode = isTierRow ? false : expandable;
            } else {
                c.bar.visible = false; c.fracTxt.visible = false;

                // Очки/галочка/бейдж — считаются по ВСЕЙ теме (familyMembers), а не только по
                // отображённому топ-тиру (a): earnedCount/membersCount/totalPtsEarned переданы
                // из win._svodRefreshAchievements, где уже посчитаны members этой темы.
                c.checkMark.visible = true; // themeComplete уже гарантирует earnedCount === membersCount
                c.starsGotBadge.visible = true;
                c.ptsTxt.visible = true;
                c.ptsTxt.text = '+' + (opts.totalPtsEarned || 0);

                c.card.interactive = c.card.buttonMode = expandable;
            }

            // 27.09.2026 (по прямому указанию): звёздочка-индикатор показывает число очков
            // ВНУТРИ себя — сколько очков навыков игрок УЖЕ получил по этой теме.
            // 04.10.2026 (повторный репорт, по прямому указанию — "я уже просил это сделать, но
            // там ничего не выводится"): баг найден — для БАЗОВОЙ карточки многотировой темы
            // (showBar===true, т.к. !themeComplete) число бралось из a.pts (очки СЛЕДУЮЩЕГО,
            // ещё НЕ заработанного тира) и показывалось только при starProgress>=1 — то есть
            // практически никогда, потому что showBar специально выбирается, когда тема НЕ
            // завершена целиком (membersCount>1 && earnedCount<membersCount), а starProgress
            // считается как earnedCount/membersCount — для тем из 10+ тиров (урон/автоматы/
            // стволы/мачете и т.п.) 100% заполнение звезды наступает, только когда заработаны
            // АБСОЛЮТНО ВСЕ тиры темы, что игроки почти никогда не успевают сделать рано. Итог —
            // "Опасный сталкер"/"Автоматная нычка"/"Пукалка"/"Царапка" и все подобные карточки
            // показывали пустую звезду без числа, даже когда младшие тиры темы уже заработаны.
            // Теперь источник числа — ВСЕГДА уже накопленная сумма: opts.totalPtsEarned (сумма
            // pts всех заработанных тиров темы, 0 если ещё ничего не заработано) для базовой
            // карточки темы/одиночного достижения, и a.pts (если этот конкретный тир уже
            // заработан, см. done) — для строки тира внутри развёрнутой темы.
            const earnedStarPts = isTierRow ? (done ? (a.pts || 0) : 0) : (opts.totalPtsEarned || 0);
            c.starPtsTxt.visible = earnedStarPts > 0;
            c.starPtsTxt.text = earnedStarPts > 0 ? String(earnedStarPts) : '';

            c.star.texture = PIXI.Texture.from(IMG + 'звездочка пустая.png');
            _setStarProgress(c, opts.starProgress);
        };

        win._svodRefreshAchievements = () => {
            const rawList = (window.achievements && window.achievements.list) || [];
            const earned  = (window.achievements && window.achievements.earned) || {};
            const state   = (window.achievements && typeof window.achievements._state === 'function') ? window.achievements._state() : {};
            const display = collapseToTopPerFamily(rawList, earned);
            console.log('[svod.achievements] схлопнуто', rawList.length, '→', display.length, 'тем, развёрнута тема:', win._expandedKey);

            let y = CARD_TOP_OFFSET;
            let used = 0;

            display.forEach((a) => {
                const familyKey = achievementFamilyKey(a);
                const members = familyMembers(rawList, familyKey);
                const expandable = members.length > 1;
                const earnedMembers = members.filter(tier => !!earned[tier.id]);
                const earnedCount = earnedMembers.length;
                const starProgress = members.length ? earnedCount / members.length : 0;
                const totalPtsEarned = earnedMembers.reduce((sum, tier) => sum + (parseInt(tier.pts) || 0), 0);

                const c = cards[used];
                if(c){
                    c.card.visible = true;
                    c.card.y = y;
                    _fillCard(c, a, { isTierRow: false, expandable, familyKey, state, starProgress,
                        earnedCount, membersCount: members.length, totalPtsEarned });
                    used++;
                    y += CARD_STEP;
                } else {
                    console.warn('[svod.achievements] пул карточек исчерпан (CARD_POOL=' + CARD_POOL + '), тема пропущена:', familyKey);
                }

                if(expandable && win._expandedKey === familyKey){
                    // 26.09.2026: свёрнутая карточка темы (a, только что отрисована строкой
                    // выше) — это ВСЕГДА один из тиров этой же семьи (тот, что
                    // collapseToTopPerFamily() выбрал как текущую цель или финальный при полном
                    // прохождении). Раньше этот тир исключался из списка ниже фильтром (tier.id
                    // !== a.id), чтобы не показывать его дважды подряд — но это ломало
                    // последовательность порогов (например, "Опасный сталкер" 10к сразу
                    // сменялся "Машиной урона" 100к, минуя "Раздающий боль" 50к между ними, по
                    // прямому указанию — "по списку после 10к должна быть раздающая боль, она
                    // должна повториться там"). Фильтр убран — шапка темы (с баром) и её же
                    // строка в развёрнутом списке (обычный тир-ряд) теперь СОЗНАТЕЛЬНО
                    // показывают один и тот же порог дважды, каждый раз в своём стиле: тир
                    // сохраняет естественное место в последовательности порогов.
                    members.forEach(tier => {
                        const tc = cards[used];
                        if(!tc){
                            console.warn('[svod.achievements] пул карточек исчерпан (CARD_POOL=' + CARD_POOL + '), тир пропущен:', tier.id);
                            return;
                        }
                        tc.card.visible = true;
                        tc.card.y = y;
                        _fillCard(tc, tier, { isTierRow: true, expandable: false, familyKey, state, starProgress: earned[tier.id] ? 1 : 0 });
                        used++;
                        y += CARD_STEP;
                    });
                }
            });

            for(let i = used; i < CARD_POOL; i++){
                if(cards[i]) cards[i].card.visible = false;
            }

            totalContentH = y;
            scroll.refresh();
        };

        return win;
    };
}
