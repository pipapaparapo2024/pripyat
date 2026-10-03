import { achievementThreshold, formatAchNum } from '../../modules/achievement-tiers.js';

/** Описание достижения для карточки «Мои достижения» (svod/svod-achievements.js).
 *
 * Раньше iface._achievementDesc() вообще не существовала — svod-achievements.js звал
 * typeof iface._achievementDesc === 'function' (всегда false) и оставлял описание пустой
 * строкой у КАЖДОЙ карточки (репорт 17.09.2026 — "что-то не так с достижениями"). Заодно
 * найден и исправлен соседний баг: achievementThreshold() (modules/achievement-tiers.js)
 * брал ПЕРВОЕ число во всей строке check-функции — для check:s=>s.zoneClear[0]>=1 это был
 * ИНДЕКС массива (0), а не порог (1), из-за чего текст порога показал бы "0 раз".
 *
 * iface._achievementIconFor() (18.09.2026, по прямому указанию — раньше сознательно не
 * реализовывалась "за неимением ассетов", теперь ассеты присланы): маппинг category → файл
 * из C:\Users\HONOR\Desktop\vk_game\достижения\картинки достижений (скопированы в
 * _client/development/images/achievements/). У 3 категорий (bp, stash, meta) нет отдельной
 * картинки по смыслу названия — используют общий файл 'достижения.png' как фолбэк. Для
 * cards/poker/roulette среди присланных файлов было 4 "покер"-файла на 3 категории —
 * распределены по смыслу названия (см. ICON_MAP ниже), 'покеер.png' (дубль с опечаткой) и
 * 'покер спички.png' остались неиспользованными — если распределение не то, что задумано,
 * поправить ICON_MAP.
 */
// 21.09.2026 (по прямому указанию) — пороги в описаниях достижений теперь показываются в
// игровом стиле сокращений: "к" за тысячи, "кк" за миллионы (та же логика, что уже отражена в
// id самих достижений — dmg_5kk, auto_1k и т.п.), а не полным числом с точками-разрядами.
// Сама логика теперь в modules/achievement-tiers.js (formatAchNum) — используется здесь и в
// прогресс-барах тиров аккордеона «Мои достижения» (svod-achievements.js), один источник правды.
function _fmtAchNum(n){
    return formatAchNum(n);
}

export function attachAchievementDesc(proto){
    const ZONE_NAMES = ['Кордон', 'Свалка', 'Темная Долина', 'Агропром', 'Янтарь'];
    const BOSS_NAMES = ['Охотника', 'Счастливчика', 'Ястреба', 'Меченого', 'Крыса', 'Баркута', 'Бороду', 'Жгута'];

    const CAT_PHRASE = {
        auto:         n => `Накопи ${_fmtAchNum(n)} патронов к автомату`,
        gun:          n => `Накопи ${_fmtAchNum(n)} патронов к стволу`,
        machete:      n => `Накопи ${_fmtAchNum(n)} зарядов к мачете`,
        damage:       n => `Нанеси ${_fmtAchNum(n)} суммарного урона боссам`,
        exp:          n => `Накопи ${_fmtAchNum(n)} опыта`,
        energy:       n => `Потрать ${_fmtAchNum(n)} энергии суммарно`,
        skills:       n => `Прокачай навыки суммарно на ${_fmtAchNum(n)} уровней`,
        cig_hoard:    n => `Накопи ${_fmtAchNum(n)} сигарет`,
        coins_hoard:  n => `Накопи ${_fmtAchNum(n)} рублей`,
        stew_hoard:   n => `Накопи ${_fmtAchNum(n)} тушёнки`,
        spend_coins:  n => `Потрать ${_fmtAchNum(n)} рублей`,
        spend_stew:   n => `Потрать ${_fmtAchNum(n)} тушёнки`,
        spend_votes:  n => `Потрать ${_fmtAchNum(n)} голосов`,
        bp:           n => `Достигни ${_fmtAchNum(n)} уровня боевого пропуска`,
        // 04.10.2026 (по прямому указанию — "такие досяги как «пригласи друзей», не пригласи,
        // а имей, чтобы у игрока было на аккаунте друзья в нужном количестве"): чисто текстовая
        // правка — statPath достижений cat 'friends' УЖЕ считает по friendsCount (реальное
        // число друзей на аккаунте, см. achievements.js._state()/achievementengine.php.
        // buildState(), count(explode(',', udata['friends']))), а не по инвайтам — логика была
        // верной, описание нет.
        friends:      n => `Имей ${_fmtAchNum(n)} друзей в игре`,
        // 04.10.2026 (по прямому указанию, вместе со сменой триггера в achievements.js —
        // см. коммент у cat 'gym' там): "сходи сам" → "позови других" (визитка друга, кнопка
        // "позвать в качалку", zaruba.php.pump()).
        gym:          n => `Позови в качалку ${_fmtAchNum(n)} раз`,
        streak:       n => `Заходи в игру ${_fmtAchNum(n)} дней подряд`,
        strength:     n => `Накопи ${_fmtAchNum(n)} очков силы`,
        pvp:          n => `Победи ${_fmtAchNum(n)} раз в PvP`,
        meta:         n => `Набери ${_fmtAchNum(n)} очков достижений`,
        stash:        n => `Собери ${_fmtAchNum(n)} карточек этой заначки`,
        // 04.10.2026 (по прямому указанию, скриншот — "Семерки"/"Восьмерки" (комбинации карт)
        // показывали описание "Достигни 1 уровня в «Сорви куш»" вместо описания комбинации):
        // cards/poker/roulette больше не отдают ОДНУ фразу на весь cat — внутри категории
        // смешаны РАЗНЫЕ подвиды (уровень игры / комбинация / спички), у каждого своё
        // описание — см. _CASINO_DESC ниже и ветки a.cat==='cards'|'poker'|'roulette' в
        // _achievementDesc(). Полный список названий/очков/описаний — ТЗ от пользователя
        // 04.10.2026 (прислан текстом целиком, "Азартные" блок).
    };
    // 04.10.2026 (по прямому указанию — "комбинации прописывать буквами", скриншот показывал
    // "СОБЕРИ КОМБИНАЦИЮ 7|7" вместо словесного описания): символьные обозначения карт
    // заменены словесными формами с учётом рода/числа ("две семёрки", "два валета" и т.п.).
    const CARD_COMBO_LABEL = {
        77:'две семёрки', 88:'две восьмёрки', 99:'две девятки', tt:'две десятки',
        jj:'два валета', qq:'две дамы', kk:'два короля', aa:'два туза',
    };
    const POKER_COMBO_LABEL = {kare:'Каре', sf:'Стрит-Флеш', rf:'Роял-Флеш'};

    proto._achievementDesc = function(a){
        const n = achievementThreshold(a);

        if(a.cat === 'zone_clear'){
            // Буква id → индекс локации: k=0,s=1,d=2,a=3,y=4 (см. achievements.js zk_* id).
            const m = a.id.match(/^zk_([a-z])/);
            const letterIdx = { k:0, s:1, d:2, a:3, y:4 }[m ? m[1] : ''];
            const locName = letterIdx !== undefined ? ZONE_NAMES[letterIdx] : 'локацию';
            return `Зачисти «${locName}» ${_fmtAchNum(n)} раз`;
        }
        if(a.cat === 'kill'){
            const idx = parseInt(a.id.replace('kill_', ''));
            return `Победи ${BOSS_NAMES[idx] || 'босса'}`;
        }
        if(a.cat === 'solo'){
            const idx = parseInt(a.id.replace('solo_', ''));
            return `Победи ${BOSS_NAMES[idx] || 'босса'} в одиночку (без помощи друзей)`;
        }
        if(a.cat === 'fast'){
            const idx = parseInt(a.id.replace('fast_', ''));
            // 04.10.2026 (по прямому указанию — "в достижения где написано победить босса
            // быстро допиши в скобках (за час)"): уточнение реального условия (fast_* тиры
            // начисляются от speedKills, засчитываемого при победе в пределах часа — см.
            // ICON_MAP.fast = 'победа над боссом за час.png' ниже, тот же факт, что здесь
            // просто не был отражён в тексте).
            return `Победи ${BOSS_NAMES[idx] || 'босса'} быстро (за час)`;
        }

        // 04.10.2026: cards/poker/roulette — категория смешивает уровни/комбинации/спички,
        // описание подбирается по виду id (та же логика распознавания, что уже использует
        // achievementFamilyKey() в modules/achievement-tiers.js, не дублируем её здесь жёстко
        // — просто отдельная ветка на каждый подвид).
        if(a.cat === 'cards'){
            if(/_l\d+$/.test(a.id)) return `Достигни ${_fmtAchNum(n)} уровня в игре в карты`;
            const key = a.id.replace('crd_', '');
            return `Собери комбинацию ${CARD_COMBO_LABEL[key] || key.toUpperCase()}`;
        }
        if(a.cat === 'poker'){
            if(/_l\d+$/.test(a.id)) return `Получи ${_fmtAchNum(n)} уровень в покере`;
            if(a.id.indexOf('pkr_sp') === 0) return `Собери ${_fmtAchNum(n)} фиолетовых спичек в покере`;
            const key = a.id.replace('pkr_', '');
            return `Собери ${POKER_COMBO_LABEL[key] || key}, играя в покер`;
        }
        if(a.cat === 'roulette'){
            if(/_l\d+$/.test(a.id)) return `Достигни ${_fmtAchNum(n)} уровня в колесе фортуны`;
            return `Собери ${_fmtAchNum(n)} голубых спичек`;
        }

        const phrase = CAT_PHRASE[a.cat];
        return phrase ? phrase(n) : '';
    };

    const ACH_ICON_DIR = './images/achievements/';
    const FALLBACK_ICON = ACH_ICON_DIR + 'достижения.png';
    const ICON_MAP = {
        auto:         'калаш.png',
        gun:          'ствол.png',
        machete:      'мачете.png',
        damage:       'нанести урон.png',
        exp:          'опыт.png',
        energy:       'потратить энку.png',
        skills:       'прокачка скиллов.png',
        cig_hoard:    'сиги.png',
        coins_hoard:  'рубли.png',
        stew_hoard:   'тушенка.png',
        spend_coins:  'потратить рубли.png',
        spend_stew:   'потратить тушняк.png',
        spend_votes:  'потратить голоса.png',
        friends:      'набрать друзей.png',
        gym:          'качалка.png',
        streak:       'Заход в игру без перерыва.png',
        strength:     'сила.png',
        pvp:          'бой с игроком.png',
        cards:        'покер комбинации.png',
        poker:        'покер.png',
        roulette:     'спички в колесе.png',
        zone_clear:   'зона пройдена.png',
        kill:         'победа над боссом.png',
        solo:         'победа соло босса.png',
        fast:         'победа над боссом за час.png',
        // bp/stash/meta — нет отдельной картинки по смыслу, используют FALLBACK_ICON.
    };

    proto._achievementIconFor = function(a){
        const file = ICON_MAP[a.cat];
        return file ? ACH_ICON_DIR + file : FALLBACK_ICON;
    };
}
