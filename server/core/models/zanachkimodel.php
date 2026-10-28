<?php
/** 26.10.2026 (по прямому указанию — фича "Заначки", коллекционные карточки): полноценная
 * версия существовала и была урезана 25.09.2026 ровно потому, что "арт не готов" (см.
 * zone.php.fillCheckpoint() и users.php — докблок про историю stash_data/stash_count). Теперь
 * арт прислан (15 коллекций по 7 карточек), эта модель восстанавливает задуманную механику
 * поверх уже готовой инфраструктуры — stash_data уже в whitelist users.php, просто не
 * использовался с 25.09.2026.
 *
 * Формат stash_data (JSON, whitelist): {"1":{"1":3,"2":0,...,"7":1}, "2":{...}, ..., "15":{...}}
 * — коллекция (строковый ключ "1".."15") → позиция ("1".."7") → количество копий у игрока.
 * НЕ путать со старым форматом (ключ локации => плоский счётчик) — тот убран 25.09.2026, см.
 * комментарий в zone.php, с тех пор поле не писалось никем вплоть до этой правки.
 *
 * stash_claims (server-only, НЕ в whitelist users.php) — {"3":true,"7":true,...}: какие
 * коллекции уже забраны. Отдельно от "набор полон" — полный набор можно сохранить и после
 * того, как часть карточек потом отдана друзьям через giveCard() (дубликаты не защищены).
 *
 * stash_wishlist (server-only, НЕ в whitelist users.php) — [{"col":4,"pos":2}, ...], максимум
 * MAX_WISHLIST одновременно активных запросов (без отдельного суточного счётчика — по прямому
 * указанию 26.10.2026: "просто максимум 7 одновременно", отменённый запрос сразу освобождает
 * слот для нового).
 */
class ZanachkiModel {

    const COLLECTIONS = [
        1 => 'граната', 2 => 'кассета', 3 => 'открытка', 4 => 'зажигалка', 5 => 'баллончик',
        6 => 'трубка', 7 => 'кость', 8 => 'фишка', 9 => 'шахматы', 10 => 'медальон',
        11 => 'монета', 12 => 'звезда', 13 => 'пистолет', 14 => 'автомат', 15 => 'нож',
    ];

    const MAX_WISHLIST = 7;

    // 28.10.2026 (по прямому указанию, 2-й скрин старого ТЗ — "первые 3 коллекции дают +50 опыта
    // и сухарей, последние три +80, все остальные +70"): раньше была одна плоская награда для
    // всех 15 коллекций (COLLECTION_CIG_REWARD/EXP_REWARD=50, оставлены ниже как fallback-
    // документация диапазона, сам расчёт теперь через collectionReward()). Совпадение чисел
    // 50/70/80 со старым zone_config.json (другая, брошенная схема коллекций по зонам, см.
    // AGENTS.md) — случайное, значения НЕ читаются оттуда, захардкожены здесь по новому ТЗ.
    const COLLECTION_CIG_REWARD = 50;
    const COLLECTION_EXP_REWARD = 50;

    // Одно и то же число — и для сухарей, и для опыта (см. тот же расчёт на клиенте,
    // svod-zanachki.js:rewardAmountForCol() — держать в синхроне при правке любой из сторон).
    static function collectionReward($col){
        $col = intval($col);
        if($col <= 3) return 50;
        if($col >= 13) return 80;
        return 70;
    }

    static function isValidCard($col, $pos){
        $col = intval($col); $pos = intval($pos);
        return isset(self::COLLECTIONS[$col]) && $pos >= 1 && $pos <= 7;
    }

    // Нормализованное чтение — ВСЕГДА все 15×7 ключей присутствуют (нули по умолчанию), чтобы
    // вызывающему коду не приходилось defensively проверять ?? на каждом шаге.
    static function getStashData($ops, $user){
        $raw = $ops->j($user, 'stash_data', []);
        $out = [];
        foreach(self::COLLECTIONS as $col => $theme){
            $colKey = strval($col);
            $out[$colKey] = [];
            for($pos = 1; $pos <= 7; $pos++){
                $posKey = strval($pos);
                $out[$colKey][$posKey] = intval($raw[$colKey][$posKey] ?? 0);
            }
        }
        return $out;
    }

    static function getClaimedMap($ops, $user){
        $raw = $ops->j($user, 'stash_claims', []);
        return is_array($raw) ? $raw : [];
    }

    static function getWishlist($ops, $user){
        $raw = $ops->j($user, 'stash_wishlist', []);
        return is_array($raw) ? array_values($raw) : [];
    }

    // Выдаёт $n независимых случайных карточек (коллекция 1-15, позиция 1-7 — равновероятно,
    // без исключения уже имеющихся), мутирует ТОЛЬКО $user['stash_data']. ⚠️ НЕ трогает
    // $user['stash_count'] — все 4 вызывающих места (zone.php/yashik.php/poker.php/
    // roulette.php) УЖЕ инкрементируют его отдельной строкой ДО этого вызова (старый, не
    // тронутый код) — повторный инкремент здесь задвоил бы счётчик. Вызывающий код сам
    // отвечает за saveUser(). Возвращает список выданных {col,pos} — не обязателен клиенту,
    // полезен для error_log/дебага.
    static function grantRandomCards($ops, &$user, $n){
        $n = max(0, intval($n));
        if($n === 0) return [];
        $data = self::getStashData($ops, $user);
        $granted = [];
        for($i = 0; $i < $n; $i++){
            $col = mt_rand(1, 15);
            $pos = mt_rand(1, 7);
            $colKey = strval($col); $posKey = strval($pos);
            $data[$colKey][$posKey] = intval($data[$colKey][$posKey]) + 1;
            $granted[] = ['col' => $col, 'pos' => $pos];
        }
        $user['stash_data'] = json_encode($data, JSON_UNESCAPED_UNICODE);
        return $granted;
    }

    static function isCollectionComplete($stashData, $col){
        $colKey = strval($col);
        if(!isset($stashData[$colKey])) return false;
        for($pos = 1; $pos <= 7; $pos++){
            if(intval($stashData[$colKey][strval($pos)] ?? 0) < 1) return false;
        }
        return true;
    }

    // 27.10.2026 (по прямому указанию — "забираться должны они не все, сделать расходуемой"):
    // раньше "Забрать" была ОДНОРАЗОВОЙ наградой за коллекцию на аккаунт (stash_claims блокировал
    // повторный клейм навсегда, карточки не списывались). Теперь клейм СПИСЫВАЕТ по 1 карте с
    // каждой из 7 позиций набора и доступен ПОВТОРНО — пока у игрока хватает карт на очередной
    // полный комплект, он может забирать снова и снова (актуально для dev-грантов по 100 каждой
    // и для игроков, фармящих дубликаты). stash_claims больше НЕ блокирует повторный клейм — это
    // теперь чисто статистика "какие коллекции забирались хотя бы раз" (для заголовка "Собрано
    // коллекций N/15" в svod-zanachki.js), не защита от повтора.
    // Возвращает true при успехе, иначе код ошибки (87 = невалидная коллекция, 88 = набор
    // неполон) — контроллер маппит код в $ops->fail(). Код 89 ("уже забрано") БОЛЬШЕ НЕ
    // ИСПОЛЬЗУЕТСЯ этой функцией (оставлен зарезервированным, не переназначать).
    static function claimCollectionReward($ops, &$user, $col){
        if(!isset(self::COLLECTIONS[intval($col)])) return 87;
        $stashData = self::getStashData($ops, $user);
        if(!self::isCollectionComplete($stashData, $col)) return 88;

        $colKey = strval(intval($col));
        for($pos = 1; $pos <= 7; $pos++){
            $posKey = strval($pos);
            $stashData[$colKey][$posKey] = intval($stashData[$colKey][$posKey]) - 1;
        }
        $user['stash_data'] = json_encode($stashData, JSON_UNESCAPED_UNICODE);

        $amt = self::collectionReward($col);
        $ops->add($user, 'cigarettes', $amt);
        $ops->add($user, 'exp', $amt);

        $claimed = self::getClaimedMap($ops, $user);
        $claimed[$colKey] = true;
        $user['stash_claims'] = json_encode($claimed, JSON_UNESCAPED_UNICODE);
        return true;
    }

    // Максимум MAX_WISHLIST ОДНОВРЕМЕННО активных запросов (без отдельного суточного счётчика
    // — по прямому указанию 26.10.2026). Возвращает true/код ошибки (87 = невалидная карточка,
    // 94 = уже максимум активных запросов, 95 = такая карточка уже в списке).
    static function requestCard($ops, &$user, $col, $pos){
        if(!self::isValidCard($col, $pos)) return 87;
        $wishlist = self::getWishlist($ops, $user);
        foreach($wishlist as $item){
            if(intval($item['col']) === intval($col) && intval($item['pos']) === intval($pos)) return 95;
        }
        if(count($wishlist) >= self::MAX_WISHLIST) return 94;
        $wishlist[] = ['col' => intval($col), 'pos' => intval($pos)];
        $user['stash_wishlist'] = json_encode($wishlist, JSON_UNESCAPED_UNICODE);
        return true;
    }

    // Возвращает true/код ошибки (96 = такого запроса нет в списке).
    static function cancelRequest($ops, &$user, $col, $pos){
        $wishlist = self::getWishlist($ops, $user);
        $found = false;
        $out = [];
        foreach($wishlist as $item){
            if(!$found && intval($item['col']) === intval($col) && intval($item['pos']) === intval($pos)){
                $found = true;
                continue;
            }
            $out[] = $item;
        }
        if(!$found) return 96;
        $user['stash_wishlist'] = json_encode($out, JSON_UNESCAPED_UNICODE);
        return true;
    }

    // 27.10.2026 (dev-панель, по прямому указанию — "кнопка, при нажатии на которую получаю по
    // 100 элементов каждой заначки"): в отличие от grantRandomCards() выше (случайные карточки,
    // честный игровой дроп), здесь ДЕТЕРМИНИРОВАННО ДОБАВЛЯЕТ ровно $amountEach ко ВСЕМ 15×7=105
    // позициям сразу — быстрый способ проверить экран со всеми заполненными коллекциями, не
    // дожидаясь RNG. Тоже НЕ трогает stash_count (та же причина, см. докблок grantRandomCards) —
    // это чисто dev-инструмент просмотра, не часть обычной игровой экономики.
    static function grantAllCollections($ops, &$user, $amountEach){
        $amountEach = max(0, intval($amountEach));
        $data = self::getStashData($ops, $user);
        foreach(self::COLLECTIONS as $col => $theme){
            $colKey = strval($col);
            for($pos = 1; $pos <= 7; $pos++){
                $posKey = strval($pos);
                $data[$colKey][$posKey] = intval($data[$colKey][$posKey]) + $amountEach;
            }
        }
        $user['stash_data'] = json_encode($data, JSON_UNESCAPED_UNICODE);
    }

    // Отдаёт 1 копию карточки (col,pos) из $giver в $target — giver обязан иметь ≥1 копию,
    // запись ДОЛЖНА реально быть в wishlist у target (защита от непрошеных подарков — тот же
    // принцип "контракта", что продиктован пользователем для этой фичи: "запрос" — это явное
    // согласие получить именно эту карточку). Возвращает true/код ошибки (87 = невалидная
    // карточка, 97 = у giver'а нет ни одной копии, 98 = target не просил эту карточку). Обе
    // стороны мутируются по ссылке — saveUser() для обеих и блокировка по двум uid — зона
    // ответственности контроллера (см. zanachki.php.giveCard()).
    static function giveCard($ops, &$giver, &$target, $col, $pos){
        if(!self::isValidCard($col, $pos)) return 87;
        $colKey = strval(intval($col)); $posKey = strval(intval($pos));

        $giverData = self::getStashData($ops, $giver);
        if(intval($giverData[$colKey][$posKey]) < 1) return 97;

        $targetWishlist = self::getWishlist($ops, $target);
        $idx = null;
        foreach($targetWishlist as $i => $item){
            if(intval($item['col']) === intval($col) && intval($item['pos']) === intval($pos)){ $idx = $i; break; }
        }
        if($idx === null) return 98;

        $giverData[$colKey][$posKey] = intval($giverData[$colKey][$posKey]) - 1;
        $giver['stash_data'] = json_encode($giverData, JSON_UNESCAPED_UNICODE);

        $targetData = self::getStashData($ops, $target);
        $targetData[$colKey][$posKey] = intval($targetData[$colKey][$posKey]) + 1;
        $target['stash_data'] = json_encode($targetData, JSON_UNESCAPED_UNICODE);

        array_splice($targetWishlist, $idx, 1);
        $target['stash_wishlist'] = json_encode(array_values($targetWishlist), JSON_UNESCAPED_UNICODE);

        return true;
    }
}
?>
