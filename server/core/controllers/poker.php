<?php
    // ── SERVER-AUTHORITATIVE ПОКЕР (18.09.2026, перенос экономики — Казино) ──
    //
    // Раньше ВСЯ игра (списание фишки/тушёнки, весовой RNG комбинации, генерация карт под
    // эту комбинацию, честная замена карт, финальная оценка руки и выплата) считалась на
    // клиенте (dvor-poker-game.js) — читер мог напрямую вызвать dvor._resolvePokerNewScreen()
    // с заранее подставленной картой рояль-флеша в this._pokerHand, либо просто вызвать
    // dvor._give('shmot', 999) напрямую. Теперь: раздача/замена/итог — три отдельных запроса,
    // RNG и выплата — только здесь. Активная раздача хранится в poker_session — ЭТО ПОЛЕ
    // СОЗНАТЕЛЬНО НЕ В whitelist users.php (как dice_session/yashik_session/roulette_cups) —
    // клиент физически не может подделать её через users.save.
    //
    // Уровень покера (udata['dvor_games_data'].poker.exp, отсюда — кол-во доступных смен
    // карт) остаётся client-writable — тот же уровень риска, что и у Зариков (даёт лишний
    // шанс на честную замену, не создаёт валюту напрямую), не в фокусе этого шага.
    //
    // 23.09.2026 (по прямому указанию, превентивно — тот же класс логирования, что у блэкджека
    // после репорта "выпала AA хотя pity ещё далеко"): error_log (Правило №8) + поле debug в
    // каждом ответе. ВАЖНО: у покера НЕТ pity-порога, как у блэкджека/зариков — комбинация
    // выбирается весовым roll ДО раздачи (_rollCombo), рука ГЕНЕРИРУЕТСЯ под неё
    // (_generateHandForCombo), а честные замены МОГУТ увести итог от изначально задуманной
    // комбинации в любую сторону (см. комментарий resolve() ниже) — это осознанная разница
    // дизайна, не баг, поэтому здесь нет аналога "нельзя собрать чужую премиум-пару".
    Class Poker {
        private $registry, $ops;

        public $permits;

        function __construct($registry){
            $this->registry = $registry;
            $this->ops = new Gameops($registry);
            $this->permits = ['deal', 'swap', 'resolve', 'openBag', 'getSession'];
        }

        // 25.09.2026 (по прямому указанию — "если во время выбора свернуть вкладку/
        // перезагрузить страницу, раздача пропадает, деньги потрачены впустую"): раздача уже
        // писалась в poker_session на сервере, но клиент никогда не читал её обратно при
        // повторном открытии экрана — только держал её в обычных JS-полях (this._pokerHand и
        // т.п.), которые обнуляются при пересоздании объекта Dvor (любая перезагрузка/новая
        // вкладка). Этот метод — точка входа для восстановления: вызывается из
        // _openPokerScreen() при каждом открытии экрана, без побочных эффектов (не списывает
        // валюту, не трогает сессию).
        function getSession(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);
            $session = $this->_loadSession($user);
            if(!is_array($session) || empty($session['active'])){
                $this->ops->ok(['active' => false]);
                return;
            }
            $this->ops->ok([
                'active' => true,
                'hand' => $session['hand'],
                'swapsUsed' => intval($session['swapsUsed']),
                'swapsAllowed' => intval($session['swapsAllowed']),
            ]);
        }

        // 23.09.2026: перечитывает poker_session ЗАНОВО из БД после saveUser().
        // 25.09.2026 (баг найден при расследовании ДРУГОГО репорта — reward-ссылки — по логам
        // живого сервера): mismatch считался через строгое !== между $expectedRaw (JSON-СТРОКА,
        // подготовленная прямо перед saveUser()) и $verifyRaw (после перечитывания из БД —
        // database.php.trueJSON() уже раскодировал его в PHP-МАССИВ, т.к. 'poker_session' не в
        // $isStringField). Строка !== массив — ВСЕГДА true, независимо от того, совпадают ли
        // данные на самом деле — каждый deal()/swap()/resolve() безусловно логировал ложную
        // тревогу "ЗАПИСАННОЕ И ПРОЧИТАННОЕ РАЗОШЛИСЬ" (то же самое видел пользователь в
        // консоли браузера). Тот же класс ошибки уже разобран и исправлен в Gameops::
        // sameJsonState() (используется в blackjack.php) — poker.php просто не был переведён на
        // неё при рефакторинге, использовал старую самописную проверку. Переведён на общий метод.
        private function _verifySaved($expectedRaw){
            $verifyUser = $this->ops->loadUser(['id', 'poker_session']);
            $verifyRaw  = $verifyUser ? ($verifyUser['poker_session'] ?? null) : '!!! loadUser() ПОСЛЕ save вернул null !!!';
            return ['raw' => $verifyRaw, 'mismatch' => !$this->ops->sameJsonState($expectedRaw, $verifyRaw)];
        }

        // openBag — 150 poker_spichki за открытие покерной "сумки" (лутбокс,
        // dvor-poker-bag.js._reallyOpenPokerBag). 22.09.2026: списание раньше шло целиком
        // client-side (udata['roulette_spichki'] = have - cost, без единого запроса к серверу)
        // — тот же класс дыры, что уже закрыт для оружия/шмоток/хаты (см. hata.php.buy()).
        // Сервер сам проверяет баланс и списывает; сами награды (exp/сигареты/заначка/монеты)
        // по-прежнему выдаёт клиент через _give() — не в фокусе этого шага.
        // 23.09.2026 (по прямому указанию, аудит "что ещё не на сервере" — продолжение этого же
        // переноса): списание стоимости уже было на сервере (22.09.2026, см. комментарий выше),
        // но сама НАГРАДА (exp/сигареты/заначка/монеты) до сих пор каталась и применялась на
        // клиенте (dvor-poker-bag.js._openPokerBagOpenedScreen, this._rand()) — читер мог просто
        // вызвать dvor._give('coins', 999999999) напрямую, минуя сумку вовсе. Диапазоны 1-в-1
        // порт клиентских this._rand(min,max) — тату по-прежнему отключено (комментарий "Бета"
        // в клиенте), сюда не включено.
        // 27.09.2026 (репорт со скриншотами — "счётчик спичек на экране покера (2200) не сходится
        // со счётчиком в сумке (60)"): изначально (22.09.2026) стоимость сумки по ошибке списывала
        // ЧУЖУЮ валюту roulette_spichki (спички РУЛЕТКИ, тратятся на кейс рулетки — см.
        // dvor-roulette-buy.js/dvor-roulette-screen.js) вместо poker_spichki (спички ПОКЕРА,
        // начисляются здесь же в resolve() за стрит/сет/старшую карту, см. currencyMap выше и
        // poker_config.json). Игрок гриндил покер, видел растущий счётчик "ГОЛУБЫЕ СПИЧКИ" на
        // экране покера (poker_spichki — фикс дисплея от того же дня, см.
        // tests/poker-spichki-counter-wrong-currency-field.test.js), но сумка проверяла и
        // списывала другое, почти всегда пустое поле. По аналогии с рулеткой (свой кейс — свои
        // spichki) у покерной сумки должна быть своя валюта — poker_spichki.
        function openBag(){
            $cost = 150;
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);
            if(!$this->ops->deduct($user, 'poker_spichki', $cost)) return $this->ops->fail(50); // не хватает спичек

            $reward = [
                'exp'   => mt_rand(1000, 2000),
                'cig'   => mt_rand(500, 1000),
                'stash' => mt_rand(5, 15),
                'coins' => mt_rand(1, 5),
            ];
            $this->ops->add($user, 'exp', $reward['exp']);
            $this->ops->add($user, 'cigarettes', $reward['cig']);
            $this->ops->add($user, 'stash_count', $reward['stash']);
            $this->ops->add($user, 'coins', $reward['coins']);
            $user['coins_earned'] = $this->ops->i($user, 'coins_earned') + $reward['coins'];

            // Тату (шмотка) из сумки — раньше решалось и СОХРАНЯЛОСЬ на клиенте
            // (dvor._give('shmot',1) → shmot.giveRandom() → users.save), которое
            // users.php._sanitizeShmot() молча отклоняет (users.save не может сам
            // выставить owned=true) — приз никогда реально не доходил до игрока. Теперь
            // решение и запись — на сервере, тем же grantShmotFromSource(), что и у боссов
            // (bosses.php.claimKill()). Шанс = 0 — дроп тату по-прежнему выключен в бете
            // (см. dvor-poker-bag.js, "Бета: выпадение тату отключено") — поднять шанс
            // достаточно поменять эту константу, выдача уже безопасна.
            $tatuChancePct = 0;
            $tatuItemId = (mt_rand(1, 100) <= $tatuChancePct) ? $this->ops->grantShmotFromSource($user, 'poker') : null;
            $hasTatu = $tatuItemId !== null;

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            $debug = [
                'fn' => 'openBag', 'uid' => abs(intval($this->registry['uid'])),
                'time' => date('Y-m-d H:i:s'), 'microtime' => microtime(true),
                'cost' => $cost, 'reward' => $reward, 'hasTatu' => $hasTatu, 'tatuItemId' => $tatuItemId,
            ];
            error_log('[poker.openBag] ' . json_encode($debug));

            $patch = $this->ops->patchCurrencies($user, ['poker_spichki', 'exp', 'cigarettes', 'stash_count', 'coins', 'coins_earned', 'shmot', 'max_energy']);
            $clientRewards = [['type' => 'battlepass_xp', 'amt' => max(1, intval(floor($reward['exp'] / 100)))]];
            $this->ops->ok(['patch' => $patch, 'reward' => $reward, 'hasTatu' => $hasTatu, 'clientRewards' => $clientRewards, 'debug' => $debug]);
        }

        private function _catalog(){
            return $this->ops->catalog('poker_config');
        }

        private function _loadSession($user){
            $raw = $this->ops->j($user, 'poker_session', null);
            return is_array($raw) ? $raw : null;
        }

        // Уровень покера (для лимита смен карт) — то же самое поле и та же таблица, что уже
        // используется для Зариков (dice.php._swapsAllowed) — низкий риск, не переносится.
        private function _swapsAllowed($user){
            $raw = $this->ops->j($user, 'dvor_games_data', []);
            $exp = (is_array($raw) && isset($raw['poker']['exp'])) ? intval($raw['poker']['exp']) : 0;
            $level = min(100, intval(floor($exp / 10)));
            if($level >= 100) return 3;
            if($level >= 60)  return 2;
            if($level >= 20)  return 1;
            return 0;
        }

        // 23.09.2026: &$trace — по ссылке, для debug-ответа.
        private function _rollCombo($catalog, &$trace = null){
            $r = mt_rand(0, 10000000) / 100000; // 0.00000 - 100.00000, тот же диапазон, что Math.random()*100
            foreach($catalog['roll_table'] as $row){
                $hit = $r < floatval($row['upto']);
                if($trace !== null) $trace[] = "roll=$r vs upto={$row['upto']} key={$row['key']} hit=" . ($hit?'1':'0');
                if($hit) return $row['key'];
            }
            if($trace !== null) $trace[] = "roll=$r не попал ни в один интервал roll_table — фолбэк high_card";
            return 'high_card';
        }

        private function _evaluateHand($catalog, $hand){
            $order = $catalog['ranks'];
            $n = count($order);
            $ranks = array_map(function($c) use ($order){ return array_search($c['rank'], $order); }, $hand);
            $suits = array_map(function($c){ return $c['suit']; }, $hand);

            $cnt = [];
            foreach($ranks as $r) $cnt[$r] = ($cnt[$r] ?? 0) + 1;
            $counts = array_values($cnt);
            rsort($counts);

            $isFlush = true;
            foreach($suits as $s) if($s !== $suits[0]) { $isFlush = false; break; }

            $sorted = $ranks; sort($sorted);
            $isStraight = ($counts[0] === 1) && ($sorted[4] - $sorted[0] === 4);

            // Рояль-флеш — стрит-флеш из САМЫХ старших 5 рангов колоды (десятка..туз), не
            // захардкоженный индекс 3 — иначе после расширения ranks (19.09.2026, добавлены
            // двойка..шестерка перед семёркой) рояль перестал бы находиться на своём месте.
            if($isFlush && $isStraight && $sorted[0] === $n - 5) return 'royal_flush';
            if($isFlush && $isStraight) return 'straight_flush';
            if($counts[0] === 4) return 'four_of_a_kind';
            if($counts[0] === 3 && ($counts[1] ?? 0) === 2) return 'full_house';
            if($isFlush) return 'flush';
            if($isStraight) return 'straight';
            if($counts[0] === 3) return 'three_of_a_kind';
            if($counts[0] === 2 && ($counts[1] ?? 0) === 2) return 'two_pair';
            if($counts[0] === 2) return 'pair';
            return 'high_card';
        }

        private function _pick($arr){ return $arr[array_rand($arr)]; }
        private function _shuffle($arr){ shuffle($arr); return $arr; }

        // Портировано 1-в-1 из dvor-poker-game.js._pokerGenerateHandForCombo() — строит 5
        // карт, которые честно оцениваются _evaluateHand() как именно запрошенную comboKey.
        // 23.09.2026: возвращает [$hand, $attemptsUsed] вместо просто $hand — для debug.
        private function _generateHandForCombo($catalog, $comboKey){
            $RANKS = $catalog['ranks'];
            $SUITS = $catalog['suits'];
            $n = count($RANKS);
            $idxAll = range(0, $n - 1);

            for($attempt = 0; $attempt < 200; $attempt++){
                $suit = $this->_pick($SUITS);
                $hand = null;

                if($comboKey === 'royal_flush'){
                    // Старшие 5 рангов колоды (десятка..туз) — не хардкод [3,4,5,6,7], см. _evaluateHand.
                    $topIdxs = array_slice($idxAll, -5);
                    $hand = array_map(function($i) use ($RANKS, $suit){ return ['rank'=>$RANKS[$i], 'suit'=>$suit]; }, $topIdxs);
                } else if($comboKey === 'straight_flush'){
                    // Старты 0..(n-6) — исключаем последний старт (n-5), это и есть рояль-флеш.
                    $start = $this->_pick(range(0, $n - 6));
                    $hand = array_map(function($d) use ($RANKS, $suit, $start){ return ['rank'=>$RANKS[$start+$d], 'suit'=>$suit]; }, [0,1,2,3,4]);
                } else if($comboKey === 'four_of_a_kind'){
                    $idxs = $this->_shuffle($idxAll);
                    $r = $idxs[0]; $filler = $idxs[1];
                    $hand = array_map(function($s) use ($RANKS, $r){ return ['rank'=>$RANKS[$r], 'suit'=>$s]; }, $SUITS);
                    $hand[] = ['rank'=>$RANKS[$filler], 'suit'=>$this->_pick($SUITS)];
                } else if($comboKey === 'full_house'){
                    $idxs = $this->_shuffle($idxAll);
                    $r1 = $idxs[0]; $r2 = $idxs[1];
                    $s1 = array_slice($this->_shuffle($SUITS), 0, 3);
                    $s2 = array_slice($this->_shuffle($SUITS), 0, 2);
                    $hand = array_merge(
                        array_map(function($s) use ($RANKS, $r1){ return ['rank'=>$RANKS[$r1], 'suit'=>$s]; }, $s1),
                        array_map(function($s) use ($RANKS, $r2){ return ['rank'=>$RANKS[$r2], 'suit'=>$s]; }, $s2)
                    );
                } else if($comboKey === 'flush'){
                    $idxs = array_slice($this->_shuffle($idxAll), 0, 5);
                    $hand = array_map(function($i) use ($RANKS, $suit){ return ['rank'=>$RANKS[$i], 'suit'=>$suit]; }, $idxs);
                } else if($comboKey === 'straight'){
                    $start = $this->_pick(range(0, $n - 5));
                    $hand = [];
                    foreach([0,1,2,3,4] as $pos => $d) $hand[] = ['rank'=>$RANKS[$start+$d], 'suit'=>$SUITS[$pos % count($SUITS)]];
                    $allSame = true;
                    foreach($hand as $c) if($c['suit'] !== $hand[0]['suit']){ $allSame = false; break; }
                    if($allSame){
                        $others = array_values(array_filter($SUITS, function($s) use ($hand){ return $s !== $hand[0]['suit']; }));
                        $hand[0]['suit'] = $this->_shuffle($others)[0];
                    }
                } else if($comboKey === 'three_of_a_kind'){
                    $idxs = $this->_shuffle($idxAll);
                    $r1 = $idxs[0]; $r2 = $idxs[1]; $r3 = $idxs[2];
                    $s1 = array_slice($this->_shuffle($SUITS), 0, 3);
                    $hand = array_merge(
                        array_map(function($s) use ($RANKS, $r1){ return ['rank'=>$RANKS[$r1], 'suit'=>$s]; }, $s1),
                        [['rank'=>$RANKS[$r2], 'suit'=>$this->_pick($SUITS)], ['rank'=>$RANKS[$r3], 'suit'=>$this->_pick($SUITS)]]
                    );
                } else if($comboKey === 'two_pair'){
                    $idxs = $this->_shuffle($idxAll);
                    $r1 = $idxs[0]; $r2 = $idxs[1]; $r3 = $idxs[2];
                    $s1 = array_slice($this->_shuffle($SUITS), 0, 2);
                    $s2 = array_slice($this->_shuffle($SUITS), 0, 2);
                    $hand = array_merge(
                        array_map(function($s) use ($RANKS, $r1){ return ['rank'=>$RANKS[$r1], 'suit'=>$s]; }, $s1),
                        array_map(function($s) use ($RANKS, $r2){ return ['rank'=>$RANKS[$r2], 'suit'=>$s]; }, $s2),
                        [['rank'=>$RANKS[$r3], 'suit'=>$this->_pick($SUITS)]]
                    );
                } else if($comboKey === 'pair'){
                    $idxs = $this->_shuffle($idxAll);
                    $r1 = $idxs[0];
                    $fillers = array_slice($idxs, 1, 3);
                    $s1 = array_slice($this->_shuffle($SUITS), 0, 2);
                    $hand = array_merge(
                        array_map(function($s) use ($RANKS, $r1){ return ['rank'=>$RANKS[$r1], 'suit'=>$s]; }, $s1),
                        array_map(function($ri) use ($RANKS, $SUITS){ return ['rank'=>$RANKS[$ri], 'suit'=>$this->_pick($SUITS)]; }, $fillers)
                    );
                } else { // high_card
                    $idxs = array_slice($this->_shuffle($idxAll), 0, 5);
                    $hand = array_map(function($ri) use ($RANKS, $SUITS){ return ['rank'=>$RANKS[$ri], 'suit'=>$this->_pick($SUITS)]; }, $idxs);
                }

                if($this->_evaluateHand($catalog, $hand) === $comboKey) return [$hand, $attempt + 1];
            }
            // Не должно случаться — на крайний случай честная раздача (без гарантии combo).
            $deck = [];
            foreach($RANKS as $r) foreach($SUITS as $s) $deck[] = ['rank'=>$r, 'suit'=>$s];
            return [array_slice($this->_shuffle($deck), 0, 5), 200];
        }

        // Раздача — списывает фишку/тушёнку (с дневным лимитом), катает весовой RNG и
        // генерирует под него честную руку. Активная раздача сохраняется в poker_session.
        function deal(){
            $useChip = !empty($this->registry['user_params']['use_chip']);

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $rawSessionFromDb = isset($user['poker_session']) ? $user['poker_session'] : null;

            // 25.09.2026 (по прямому указанию, фикс "выбор сбрасывается при смене вкладки/
            // перезагрузке, игра уничтожается"): раньше deal() безусловно перезаписывал активную
            // раздачу новой, повторно списывая валюту и теряя предыдущую оплаченную раздачу без
            // результата — та же идемпотентность, что уже сделана для bosses.php.startFight()
            // (см. CLAUDE.md, "Пример полного цикла (боссы)"). Если раздача уже активна — просто
            // возвращаем её же, ничего не списывая и не перегенерируя.
            $existingSession = $this->_loadSession($user);
            if(is_array($existingSession) && !empty($existingSession['active'])){
                $patch = $this->ops->patchCurrencies($user, ['poker_chips', 'stew', 'stew_spent', 'dvor_daily']);
                $this->ops->ok([
                    'patch' => $patch,
                    'hand' => $existingSession['hand'],
                    'swapsAllowed' => intval($existingSession['swapsAllowed']),
                    'swapsUsed' => intval($existingSession['swapsUsed']),
                    'resumed' => true,
                ]);
                return;
            }

            $catalog = $this->_catalog();
            $dailyKey = 'dvor_daily';
            $daily = $this->ops->j($user, $dailyKey, []);
            // 28.09.2026 (по прямому указанию — "вся игра должна ориентироваться на московское
            // время"): раньше date('Y-m-d') — полночь по локальным часам PHP-процесса (де-факто
            // UTC). Теперь та же граница 12:00 МСК, что и у дневного лимита боссов (см.
            // Gameops::mskDailyDate()).
            $today = $this->ops->mskDailyDate();
            if(!isset($daily['date']) || $daily['date'] !== $today){
                $daily = ['date' => $today, 'poker' => 0];
            }
            $pokerUsed = intval($daily['poker'] ?? 0);

            if($useChip){
                if(!$this->ops->deduct($user, 'poker_chips', 1)) return $this->ops->fail(79); // недостаточно фишек
            } else {
                if($pokerUsed >= intval($catalog['daily_stew_limit'])) return $this->ops->fail(80); // дневной лимит игр за тушёнку исчерпан
                if(!$this->ops->deduct($user, 'stew', intval($catalog['play_cost_stew']))) return $this->ops->fail(81); // недостаточно тушёнки
                $daily['poker'] = $pokerUsed + 1;
                $user[$dailyKey] = json_encode($daily);
            }

            $comboTrace = [];
            // 25.09.2026 (по прямому указанию — "хочу тестировать все комбинации покера"):
            // dev_force_poker — личный одноразовый флаг (dev-панель, users.setDevCombo), хранит
            // ГОТОВЫЙ comboKey (те же строки, что COMBO_ROW_ORDER на клиенте и сам
            // _generateHandForCombo() ниже принимает штатно) — гасится сразу, обычный
            // _rollCombo() (pity/веса) не трогаем при активном форсе.
            $devForcePoker = strval($user['dev_force_poker'] ?? '');
            if($devForcePoker !== ''){
                $user['dev_force_poker'] = '';
                $targetCombo = $devForcePoker;
                $comboTrace[] = "DEV FORCE comboKey=$devForcePoker (обычный _rollCombo пропущен)";
            } else {
                $targetCombo = $this->_rollCombo($catalog, $comboTrace);
            }
            list($hand, $genAttempts) = $this->_generateHandForCombo($catalog, $targetCombo);
            $swapsAllowed = $this->_swapsAllowed($user);

            // 24.09.2026 (баг "выпали две пары, а засчиталась старшая карта и неверная награда",
            // по прямому указанию + скриншот): найдено через несовпадение debug-полей deal()
            // (actualComboAtDeal:'two_pair', правильно) и resolve() (combo:'high_card', неверно)
            // для ОДНОЙ И ТОЙ ЖЕ неизменной руки (0 замен) — сама _evaluateHand() работает
            // корректно, ломался РАУНД-ТРИП через БД. json_encode() БЕЗ JSON_UNESCAPED_UNICODE
            // экранирует кириллицу ранга ("двойка" и т.п.) как "дв..." — а
            // database.php.toSQL() вставляет эту строку в SQL-литерал БЕЗ mysqli_real_escape_string
            // (голая конкатенация). MySQL, не распознав "\u" как валидный escape, молча ОТБРАСЫВАЕТ
            // обратный слэш ("д" → "u0434") при сохранении — при следующем чтении ранги
            // превращаются в мусорные строки, ничего не матчащие в RANKS каталога, и
            // _evaluateHand() у resolve() (читающей ЗАНОВО сохранённую сессию) закономерно не
            // находит пар/комбинаций → high_card. deal()'s actualComboAtDeal здесь ни при чём —
            // он считает по СВЕЖЕСГЕНЕРИРОВАННОМУ массиву, ещё не прошедшему через БД. Тот же
            // паттерн уже был опробован в achievementengine.php/jsonloader.php/tools.php — здесь
            // просто не был применён к poker_session. Тот же класс бага в blackjack_session
            // (тоже хранит кириллические ранги) — см. одноимённый фикс в blackjack.php.
            $session = ['hand' => $hand, 'swapsUsed' => 0, 'swapsAllowed' => $swapsAllowed, 'active' => true];
            $user['poker_session'] = json_encode($session, JSON_UNESCAPED_UNICODE);

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            $verify = $this->_verifySaved($user['poker_session']);

            // Сверяем: честно ли _evaluateHand() на СГЕНЕРИРОВАННОЙ руке даёт именно targetCombo
            // (та самая проверка, что уже есть в цикле генерации, но продублирована в debug
            // отдельно — если когда-нибудь разойдётся, это будет видно сразу, а не через 50 шагов).
            $actualComboAtDeal = $this->_evaluateHand($catalog, $hand);

            $debug = [
                'fn' => 'deal', 'uid' => abs(intval($this->registry['uid'])),
                'time' => date('Y-m-d H:i:s'), 'microtime' => microtime(true),
                'rawParams' => $this->registry['user_params'],
                'rawSessionFromDb' => $rawSessionFromDb, 'catalogFull' => $catalog,
                'useChip' => $useChip, 'pokerUsedToday' => $pokerUsed,
                'comboTrace' => $comboTrace, 'targetCombo' => $targetCombo,
                'genAttemptsUsed' => $genAttempts, 'hand' => $hand,
                'actualComboAtDeal' => $actualComboAtDeal,
                'comboMismatchAtDeal' => ($actualComboAtDeal !== $targetCombo),
                'swapsAllowed' => $swapsAllowed,
                'sessionSavedRaw' => $user['poker_session'],
                'sessionVerifiedFromDbAfterSave' => $verify['raw'],
                'saveVerifyMismatch' => $verify['mismatch'],
            ];
            error_log('[poker.deal] ' . json_encode($debug)
                . ($debug['comboMismatchAtDeal'] ? ' !!! СГЕНЕРИРОВАННАЯ РУКА НЕ РАВНА ЗАПРОШЕННОЙ КОМБИНАЦИИ !!!' : '')
                . ($verify['mismatch'] ? ' !!! ЗАПИСАННОЕ И ПРОЧИТАННОЕ ОБРАТНО ЗНАЧЕНИЕ РАЗОШЛИСЬ !!!' : ''));

            $patch = $this->ops->patchCurrencies($user, ['poker_chips', 'stew', 'stew_spent', $dailyKey]);
            $this->ops->ok(['patch' => $patch, 'hand' => $hand, 'swapsAllowed' => $swapsAllowed, 'swapsUsed' => 0, 'debug' => $debug]);
        }

        // Честная замена одной карты — тот же принцип, что dvor-poker-game.js._togglePokerSwap():
        // случайная карта, реально другая, и не дублирующая уже имеющуюся на руках.
        function swap(){
            $idx = intval($this->registry['user_params']['idx'] ?? -1);
            if($idx < 0 || $idx > 4) return $this->ops->fail(54);

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $rawSessionFromDb = isset($user['poker_session']) ? $user['poker_session'] : null;

            $session = $this->_loadSession($user);
            if(!is_array($session) || empty($session['active'])) return $this->ops->fail(82); // нет активной раздачи
            if(intval($session['swapsUsed']) >= intval($session['swapsAllowed'])) return $this->ops->fail(83); // смены закончились

            $catalog = $this->_catalog();
            $RANKS = $catalog['ranks']; $SUITS = $catalog['suits'];
            $hand = $session['hand'];
            $old = $hand[$idx];
            $others = array_values(array_filter($hand, function($c, $i) use ($idx){ return $i !== $idx; }, ARRAY_FILTER_USE_BOTH));

            $replacement = null;
            $swapTrace = [];
            for($attempt = 0; $attempt < 200; $attempt++){
                $cand = ['rank' => $this->_pick($RANKS), 'suit' => $this->_pick($SUITS)];
                $sameAsOld = ($cand['rank'] === $old['rank'] && $cand['suit'] === $old['suit']);
                $dup = false;
                foreach($others as $c) if($c['rank'] === $cand['rank'] && $c['suit'] === $cand['suit']){ $dup = true; break; }
                $swapTrace[] = "attempt#$attempt cand=" . json_encode($cand) . " sameAsOld=" . ($sameAsOld?'1':'0') . " dup=" . ($dup?'1':'0');
                if($sameAsOld) continue;
                if($dup) continue;
                $replacement = $cand;
                break;
            }
            $usedFallback = false;
            if($replacement === null){
                $usedFallback = true;
                $replacement = $old;
                $swapTrace[] = '!!! FALLBACK (200 попыток исчерпаны) — карта не заменена, оставлена старая';
            }

            $session['hand'][$idx] = $replacement;
            $session['swapsUsed'] = intval($session['swapsUsed']) + 1;
            $user['poker_session'] = json_encode($session, JSON_UNESCAPED_UNICODE);
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            $verify = $this->_verifySaved($user['poker_session']);

            $debug = [
                'fn' => 'swap', 'uid' => abs(intval($this->registry['uid'])),
                'time' => date('Y-m-d H:i:s'), 'microtime' => microtime(true),
                'idx' => $idx, 'rawParams' => $this->registry['user_params'],
                'rawSessionFromDb' => $rawSessionFromDb, 'catalogFull' => $catalog,
                'oldCard' => $old, 'handBefore' => $hand,
                'swapTrace' => $swapTrace, 'usedFallback' => $usedFallback,
                'replacement' => $replacement, 'handAfter' => $session['hand'],
                'sessionSavedRaw' => $user['poker_session'],
                'sessionVerifiedFromDbAfterSave' => $verify['raw'],
                'saveVerifyMismatch' => $verify['mismatch'],
            ];
            error_log('[poker.swap] ' . json_encode($debug)
                . ($verify['mismatch'] ? ' !!! ЗАПИСАННОЕ И ПРОЧИТАННОЕ ОБРАТНО ЗНАЧЕНИЕ РАЗОШЛИСЬ !!!' : ''));

            $this->ops->ok(['card' => $replacement, 'swapsLeft' => intval($session['swapsAllowed']) - intval($session['swapsUsed']), 'debug' => $debug]);
        }

        // Награда записывается вместе с завершением партии. users.save запрещает
        // клиенту увеличивать запас патронов, поэтому clientReward здесь недостаточен.
        private function _grantWeaponReward(&$user, $type, $amount){
            $wid = ['machete' => 3, 'gun' => 4, 'auto' => 5][$type] ?? null;
            $amount = max(0, intval($amount));
            if($wid === null || $amount === 0) return;
            $data = $this->ops->j($user, 'weapons', []);
            if(!is_array($data)) $data = [];
            for($i = 0; $i < 6; $i++){
                $data[$i] = array_merge(
                    ['owned' => $i < 3, 'equipped' => false, 'upg' => 0, 'qty' => 0],
                    isset($data[$i]) && is_array($data[$i]) ? $data[$i] : []
                );
            }
            $ammoKey = 'ammo_' . $type;
            $data[$wid]['qty'] = max(0, intval($data[$wid]['qty']), intval($user[$ammoKey] ?? 0)) + $amount;
            $data[$wid]['owned'] = true;
            ksort($data);
            $user['weapons'] = json_encode(array_values($data));
            $user[$ammoKey] = strval($data[$wid]['qty']);
        }

        // Итог — честно оценивает РЕАЛЬНУЮ руку на столе (замены могли увести итог от
        // изначально задуманной комбинации, как и на клиенте) и начисляет награду.
        function resolve(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $rawSessionFromDb = isset($user['poker_session']) ? $user['poker_session'] : null;

            $session = $this->_loadSession($user);
            if(!is_array($session) || empty($session['active'])) return $this->ops->fail(82); // нет активной раздачи

            $catalog = $this->_catalog();
            $combo = $this->_evaluateHand($catalog, $session['hand']);
            $c = $catalog['combos'][$combo];

            // AchievementEngine reads poker_spichki for poker thresholds.  It must
            // be awarded here, rather than reconstructed from a browser callback.
            $currencyMap = ['coins','stew','cigarettes','exp','respect','poker_chips','poker_spichki','roulette_spichki'];
            if(in_array($c['type'], $currencyMap, true)){
                $this->ops->add($user, $c['type'], intval($c['amt']));
            }
            $shmotGranted = null;
            if($c['type'] === 'shmot') $shmotGranted = $this->ops->grantShmotFromSource($user, 'poker');
            $this->_grantWeaponReward($user, $c['type'], $c['amt']);
            $clientReward = null;

            $this->ops->add($user, 'exp', intval($catalog['exp_reward']));
            $this->ops->add($user, 'cigarettes', intval($catalog['cig_reward']));
            // dvor_games — общий счётчик всех партий "Двора" (как у Зариков, dice.php) —
            // раньше инкрементировался клиентским _give() при каждой награде, теперь сервер
            // делает это сам за клиента при каждом завершённом резолве.
            $user['dvor_games'] = $this->ops->i($user, 'dvor_games') + 1;

            $session['active'] = false;
            $user['poker_session'] = json_encode($session, JSON_UNESCAPED_UNICODE);
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            $verify = $this->_verifySaved($user['poker_session']);

            $debug = [
                'fn' => 'resolve', 'uid' => abs(intval($this->registry['uid'])),
                'time' => date('Y-m-d H:i:s'), 'microtime' => microtime(true),
                'rawSessionFromDb' => $rawSessionFromDb, 'catalogFull' => $catalog,
                'hand' => $session['hand'], 'combo' => $combo, 'comboPayout' => $c,
                'sessionSavedRaw' => $user['poker_session'],
                'sessionVerifiedFromDbAfterSave' => $verify['raw'],
                'saveVerifyMismatch' => $verify['mismatch'],
            ];
            error_log('[poker.resolve] ' . json_encode($debug)
                . ($verify['mismatch'] ? ' !!! ЗАПИСАННОЕ И ПРОЧИТАННОЕ ОБРАТНО ЗНАЧЕНИЕ РАЗОШЛИСЬ !!!' : ''));

            $patchKeys = ['coins','stew','cigarettes','exp','respect','poker_chips','poker_spichki','roulette_spichki','dvor_games','shmot'];
            if(in_array($c['type'], ['auto','gun','machete'], true)){
                $patchKeys[] = 'weapons';
                $patchKeys[] = 'ammo_' . $c['type'];
            }
            $patch = $this->ops->patchCurrencies($user, $patchKeys);
            $this->ops->ok([
                'patch' => $patch,
                'combo' => $combo,
                'lbl' => $c['lbl'],
                'sp' => intval($c['sp']),
                'id' => $c['id'],
                'clientReward' => $clientReward,
                'shmotGranted' => $shmotGranted,
                'hand' => $session['hand'],
                'debug' => $debug,
            ]);
        }
    }
?>
