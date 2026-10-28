<?php
    // ── SERVER-AUTHORITATIVE ДОСТИЖЕНИЯ (23.09.2026, перенос экономики) ──
    //
    // Раньше ВЕСЬ прогресс достижений (earned-карта, achievement_stars, патроны ящика
    // ach_score/bullets) считался и писался клиентом (achievements.js._checkAll()) в
    // client-writable поля — читер мог выставить achievement_stars/bullets любым числом одним
    // users.save. Плюс сама клиентская архитектура (пиши в udata сразу, реальная отправка на
    // сервер — только через 500мс-дебаунс автосейва) была источником минимум 3 задокументированных
    // багов "вылетает как попало" (двойной счёт, потеря ачивки в окне автосейва при перезагрузке,
    // запоздалая проверка после трат на шмотки — см. комментарии 17.09/19.09/22.09.2026 в
    // achievements.js). Теперь earned/очки/патроны читает и пишет ТОЛЬКО сервер (см.
    // achievements.php.sync()) — тот же класс поля, что skills_levels/dice_session.
    //
    // Список из achievements.js.this.list (331 правило) перенесён как чистые данные в
    // server/json/achievements_config.json — {id,cat,name,pts,threshold,statPath}. Все правила
    // без исключений сводятся к "значение_по_statPath >= threshold", поэтому вместо портирования
    // 331 JS-лямбды здесь один генерик-компаратор.
    //
    // buildState() ЧИТАЕТ ТЕ ЖЕ udata-поля, что и раньше читал клиент в achievements.js._state()
    // — счётчики вроде total_damage/auto_count/train_count/coins_spent и т.п. остаются
    // client-writable (это отдельная, гораздо более крупная миграция экономики боя, не в фокусе
    // этого шага) — сервер здесь не ужесточает доверие к НИМ, только к самому бухгалтерскому
    // начислению очков/патронов и атомарности earned-карты.
    Class AchievementEngine {

        // Порт achievements.js._state() 1-в-1 — те же поля, те же формулы.
        static function buildState($ops, $user){
            $bd = $ops->j($user, 'bosses_data', []);
            $kills = (isset($bd['killsTotal']) && is_array($bd['killsTotal']) && count($bd['killsTotal']) === 8)
                ? array_map('intval', $bd['killsTotal']) : array_fill(0, 8, 0);

            $soloRaw  = $ops->j($user, 'solo_kills', []);
            $soloKills = (is_array($soloRaw) && count($soloRaw) === 8) ? array_map('intval', $soloRaw) : array_fill(0, 8, 0);

            $speedRaw   = $ops->j($user, 'speed_kills', []);
            $speedKills = (is_array($speedRaw) && count($speedRaw) === 8) ? array_map('intval', $speedRaw) : array_fill(0, 8, 0);

            $zoneClear = array_fill(0, 5, 0);
            $zd = $ops->j($user, 'zone', []);
            for($i = 0; $i < 5; $i++) if(isset($zd[$i]['cleared'])) $zoneClear[$i] = intval($zd[$i]['cleared']);

            $stash = $ops->j($user, 'stash_data', []);

            // «Скиллов» — сумма уровней всех прокачанных скиллов из server-only skills_levels
            // (тот же формат/подсчёт, что users.php.getProfile() уже использует для визитки).
            $skillsData = $ops->j($user, 'skills_levels', []);
            $skillsLevels = (is_array($skillsData) && isset($skillsData['levels']) && is_array($skillsData['levels'])) ? $skillsData['levels'] : [];
            $skillLvls = array_sum(array_map('intval', $skillsLevels));

            $cardsGames    = $ops->i($user, 'cards_games');
            $pokerGames    = $ops->i($user, 'poker_games');
            $rouletteGames = $ops->i($user, 'roulette_games');
            $cardsLvl    = intval(floor($cardsGames / 10));
            $rouletteLvl = intval(floor($rouletteGames / 10));

            // Покер прогрессия: тиры по 10 уровней; XP на тир: 6,8,10,11,13,15,16,18,20,22 —
            // тот же порт, что achievements.js._state().
            $POKER_TIERS = [6,8,10,11,13,15,16,18,20,22];
            $pokerLvl = 0; $pokerXp = $pokerGames;
            for($t = 0; $t < 10 && $pokerXp > 0; $t++){
                $xpForTier = $POKER_TIERS[$t] * 10;
                if($pokerXp >= $xpForTier){ $pokerLvl += 10; $pokerXp -= $xpForTier; }
                else { $pokerLvl += intval(floor($pokerXp / $POKER_TIERS[$t])); $pokerXp = 0; }
            }
            $pokerLvl = min(100, $pokerLvl);

            return [
                'dmg'  => $ops->i($user, 'total_damage'),
                'auto' => $ops->i($user, 'auto_count'),
                'gun'  => $ops->i($user, 'gun_count'),
                'mac'  => $ops->i($user, 'machete_count'),
                'kills'      => $kills,
                'soloKills'  => $soloKills,
                'speedKills' => $speedKills,
                'skillLvls'  => $skillLvls,
                'zoneClear'  => $zoneClear,
                'stash'      => is_array($stash) ? $stash : [],
                'energy'     => $ops->i($user, 'energy_spent'),
                'cardsLvl'    => $cardsLvl,
                // 28.10.2026 (баг найден по репорту — "выбил десятки+девятки в блэкджеке,
                // 'Десятки' не засчиталась"): PHP json_encode() пустого ассоциативного массива
                // всегда даёт "[]", не "{}" — cards_combos/poker_combos периодически уходили на
                // клиент пустым МАССИВОМ вместо объекта, клиент тихо терял следующую же запись
                // (см. полный разбор в achievements.js.onDvorGame()), а здесь, на сервере,
                // array_is_list()==true означает ТОЧНО ТАКОЙ ЖЕ испорченный массив — без этой
                // защиты _getPath(['cardsCombos','88']) совпадал бы с ЧИСЛОВЫМ индексом 88
                // массива (PHP приравнивает числовую строку-ключ к int-индексу), ложно засчитывая
                // достижение по случайному мусору, а не по реальной комбинации. Подтверждено
                // вживую: uid 382448269 (прод) имел cards_combos массивом из 100 элементов,
                // непустые позиции ровно 88 и 99 — 'crd_88'/'crd_99' оказались засчитаны именно
                // так, не от реальных побед. 142 аккаунта на проде/110 на тесте затронуты той же
                // формой (у большинства — просто "[]").
                'cardsCombos' => self::_dropIfList($ops->j($user, 'cards_combos', [])),
                'pokerLvl'    => $pokerLvl,
                'pokerCombos' => self::_dropIfList($ops->j($user, 'poker_combos', [])),
                // 20.10.2026 (по прямому указанию — "это должны быть одинаковые спички"):
                // poker_spichki и roulette_spichki объединены в одну валюту, канонический
                // столбец — roulette_spichki (см. poker.php.openBag()). Достижения семейства
                // "pokerSpichki" теперь тоже читают его — иначе застыли бы навсегда на
                // последнем значении poker_spichki (поле больше нигде не пишется).
                'pokerSpichki'    => $ops->i($user, 'roulette_spichki'),
                'rouletteLvl'     => $rouletteLvl,
                'rouletteSpichki' => $ops->i($user, 'roulette_spichki'),
                'exp'          => $ops->i($user, 'exp'),
                'cig'          => $ops->i($user, 'cigarettes'),
                'coinsBalance' => $ops->i($user, 'coins'),
                'stewBalance'  => $ops->i($user, 'stew'),
                'trainCount'   => $ops->i($user, 'train_count'),
                // 04.10.2026: cat 'gym' переключена с личных тренировок (trainCount) на
                // приглашения в качалку, отправленные ИНИЦИАТОРОМ (zaruba.php.pump()).
                'gymInvitesSent' => $ops->i($user, 'gym_invites_sent'),
                'strXp'        => $ops->i($user, 'str_xp_total'),
                'pvpWins'      => $ops->i($user, 'pvp_wins'),
                'loginStreak'  => $ops->i($user, 'login_streak'),
                'bpLevel'      => $ops->i($user, 'bp_level'),
                'votesSpent'   => $ops->i($user, 'votes_spent'),
                'coinsSpent'   => $ops->i($user, 'coins_spent'),
                'stewSpent'    => $ops->i($user, 'stew_spent'),
                'friendsCount' => count(array_filter(explode(',', strval($user['friends'] ?? '')))),
                // Замороженный снимок ДО начислений этого прохода — так же, как клиент раньше
                // считал _state() один раз в начале _checkAll(): мета-достижения по общему счёту
                // очков видят значение "на входе", догоняют на следующем проходе, не в этом же.
                'achPts' => $ops->i($user, 'achievement_stars'),
            ];
        }

        // Защита от PHP-испорченного "[]" вместо "{}" (см. большой коммент у buildState() выше,
        // 28.10.2026) — числовые позиции в list-массиве НЕ являются реальными ключами-комбо
        // ('tt'/'jj'/'88' и т.п.), совпадение с ними было бы случайным, а не честным прогрессом.
        private static function _dropIfList($v){
            return (is_array($v) && array_is_list($v)) ? [] : $v;
        }

        private static function _getPath($state, $statPath){
            $v = $state;
            foreach($statPath as $key){
                if(!is_array($v) || !array_key_exists($key, $v)) return 0;
                $v = $v[$key];
            }
            return is_numeric($v) ? floatval($v) : 0;
        }

        // Возвращает [$user (мутирован по ссылке через возврат), $newlyEarned].
        static function checkAll($ops, $user, $catalog){
            $state  = self::buildState($ops, $user);
            $earned = $ops->j($user, 'achievements', []);
            if(!is_array($earned)) $earned = [];
            // Миграция 41 помечает снятые у старых аккаунтов достижения: их прежняя
            // статистика не должна тут же вернуть запись обратно. У новых игроков поля нет.
            $revoked = $ops->j($user, 'achievement_revoked', []);
            if(!is_array($revoked)) $revoked = [];

            $newlyEarned = [];
            foreach($catalog as $a){
                $id = $a['id'];
                if(!empty($revoked[$id])) continue;
                if(!empty($earned[$id])) continue;
                if(self::_getPath($state, $a['statPath']) < floatval($a['threshold'])) continue;

                $earned[$id] = true;
                $newlyEarned[] = $a;

                $pts = intval($a['pts']);
                $user['achievement_stars'] = $ops->i($user, 'achievement_stars') + $pts;

                // ach_score — счётчик для ящика (yashik.php): каждые 50 очков достижений даёт
                // 1 патрон. Порт 1-в-1 из achievements.js._checkAll() (rollover-цикл).
                $ach = $ops->i($user, 'ach_score') + $pts;
                while($ach >= 50){
                    $ach -= 50;
                    $user['bullets'] = $ops->i($user, 'bullets') + 1;
                }
                $user['ach_score'] = $ach;
            }

            $user['achievements'] = json_encode($earned, JSON_UNESCAPED_UNICODE);
            return [$user, $newlyEarned];
        }
    }
?>
