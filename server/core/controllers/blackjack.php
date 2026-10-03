<?php
    // ── SERVER-AUTHORITATIVE БЛЭКДЖЕК / "КАРТЫ" (18.09.2026, перенос экономики — Казино,
    // игра 4/4, последняя из непереведённых) ──
    //
    // Раньше ВСЁ (списание рубля/бесплатной попытки, скрытый pity-счётчик AA/KK/QQ, честная
    // раздача пары, честная замена карты, итоговая оценка и выплата) считалось на клиенте
    // (dvor-blackjack.js) — читер мог подделать pity-счётчики (this._data.cards.aa/kk/qq) прямо
    // консолью через users.save (this._data.cards хранится в client-writable dvor_games_data)
    // и форсировать гарантированную пару тузов (10000 сигарет + шмотка) в каждой партии, либо
    // просто вызвать dvor._give('cig', 999999) напрямую.
    //
    // Теперь: раздача/замена/итог — три отдельных запроса (deal/swap/resolve). Pity-счётчики
    // AA/KK/QQ и признак "бесплатная попытка на сегодня уже использована" хранятся в НОВОМ
    // служебном поле blackjack_session — ЭТО ПОЛЕ СОЗНАТЕЛЬНО НЕ В whitelist users.php (как
    // dice_session/poker_session/yashik_session/skills_levels) — клиент физически не может
    // подделать его через users.save. Именно этот класс данных (pity к форсированному "джекпоту")
    // и был первопричиной переноса dice_free_ts на сервер для Зариков — тот же урок применён
    // здесь для дневной бесплатной попытки блэкджека.
    //
    // Декоративные карты (слоты 0/1 макета) НЕ участвуют в подсчёте пары и остаются полностью
    // клиентскими (см. dvor-blackjack.js: dealDecorative) — они не влияют на экономику, поэтому
    // переносить их RNG на сервер не требуется. Масть карт в блэкджеке нигде не показывается и
    // ни на что не влияет (по прямому указанию — "нет других мастей вообще"), поэтому сервер
    // оперирует ТОЛЬКО рангами (не парами rank+suit, как в покере).
    //
    // 23.09.2026 (репорт "выпала AA хотя pity ещё далеко", 2 честные последовательные смены —
    // НЕ гонка кликов, подтверждено пользователем) — построчный разбор deal()/swap()/resolve()
    // не нашёл дыру. По прямому указанию добавлено МАКСИМАЛЬНОЕ логирование — И в error_log
    // (Правило №8), И в сам ответ сервера (поле debug), которое клиент печатает в консоль
    // браузера (см. dvor-blackjack.js) — чтобы при следующем повторении сразу было видно
    // причину, не дожидаясь разбора серверных логов.
    Class Blackjack {
        private $registry, $ops;

        public $permits;

        function __construct($registry){
            $this->registry = $registry;
            $this->ops = new Gameops($registry);
            $this->permits = ['status', 'deal', 'swap', 'resolve'];
        }

        private function _catalog(){
            return $this->ops->catalog('blackjack_config');
        }

        private function _loadSession($user, $catalog){
            $raw = $this->ops->j($user, 'blackjack_session', null);
            $data = is_array($raw) ? $raw : [];
            foreach($catalog['premium_range'] as $key => $range){
                if(!isset($data[$key])) $data[$key] = 0;
                if(!isset($data[$key . '_t'])) $data[$key . '_t'] = rand(intval($range[0]), intval($range[1]));
            }
            return $data;
        }

        // Уровень блэкджека (для лимита смен карт) — то же поле/формула, что и у Зариков/Покера
        // (dvor_games_data.cards.exp, floor(exp/10) с потолком 100) — низкий риск, не переносится.
        private function _swapsAllowed($user, $catalog){
            $dvorData = $this->ops->j($user, 'dvor_games_data', []);
            $exp = intval($dvorData['cards']['exp'] ?? 0);
            $level = min(100, intval(floor($exp / 10)));
            foreach($catalog['swaps_by_level'] as $row){
                if($level >= intval($row['min_level'])) return intval($row['swaps']);
            }
            return 0;
        }

        private function _pickRank($RANKS){
            return $RANKS[array_rand($RANKS)];
        }

        // 28.09.2026 (по прямому указанию — "вся игра должна ориентироваться на московское
        // время"): раньше date('Y-m-d') (полночь по локальным часам PHP-процесса, де-факто
        // UTC) и strtotime('tomorrow') (та же полночь для обратного отсчёта) — независимо друг
        // от друга совпадали случайно только потому, что оба неявно опирались на одни и те же
        // локальные часы. Теперь оба через Gameops::mskDailyDate()/mskNextResetMs() — та же
        // граница 12:00 МСК, что и у дневного лимита боссов/дневной раздачи покера, и
        // nextFreeAt синхронизирован именно с ней (а не с отдельной, теперь не совпадающей
        // полуночью).
        private function _dailyState(&$session){
            $today = $this->ops->mskDailyDate();
            if(($session['dailyDate'] ?? null) !== $today){
                $session['dailyDate'] = $today;
                $session['dailyUsed'] = false;
            }
            return [
                'isFree' => empty($session['dailyUsed']),
                'serverNow' => intval(round(microtime(true) * 1000)),
                'nextFreeAt' => $this->ops->mskNextResetMs(),
            ];
        }

        function status(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);
            // 24.09.2026 (превентивно, тот же найденный класс бага, что чинили в poker.php —
            // см. большой комментарий у poker.php.deal()'s json_encode($session,
            // JSON_UNESCAPED_UNICODE)): blackjack_session тоже хранит кириллические ранги карт
            // ($RANKS из каталога) — без этого флага round-trip через database.php.toSQL()
            // (SQL-литерал без mysqli_real_escape_string) молча ломает "\uXXXX"-экранирование
            // MySQL'ем, и _evaluateHand()-эквивалент здесь тоже считал бы неверную комбинацию.
            $session = $this->_loadSession($user, $this->_catalog());
            $state = $this->_dailyState($session);
            $user['blackjack_session'] = json_encode($session, JSON_UNESCAPED_UNICODE);
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            // 25.09.2026 (по прямому указанию — "выбор сбрасывается при смене вкладки/
            // перезагрузке, игра уничтожается"): status() уже вызывается при каждом открытии
            // экрана (dvor-blackjack.js._syncBlackjackDailyStatus), но раньше не сообщал клиенту
            // об активной раздаче — только дневное состояние. Раздача уже писалась в
            // blackjack_session на сервере, клиент просто никогда её не читал обратно (JS-поля
            // this._bjHand/_bjPlaying живут только в памяти, обнуляются при пересоздании Dvor).
            $active = $session['active'] ?? null;
            if(is_array($active)){
                $state['active'] = [
                    'hand' => $active['hand'],
                    'swapsUsed' => intval($active['swapsUsed']),
                    'swapsAllowed' => intval($active['swapsAllowed']),
                ];
            } else {
                $state['active'] = null;
            }

            // 25.09.2026 (по прямому указанию — "показывай сбоку количество игр до
            // комбинации"): все 3 счётчика сразу — статус вызывается на каждом открытии
            // экрана, лучшее место для постоянной боковой панели прогресса.
            $state['aa'] = intval($session['aa']); $state['aa_t'] = intval($session['aa_t']);
            $state['kk'] = intval($session['kk']); $state['kk_t'] = intval($session['kk_t']);
            $state['qq'] = intval($session['qq']); $state['qq_t'] = intval($session['qq_t']);

            $this->ops->ok($state);
        }

        // Портировано 1-в-1 из dvor-blackjack.js:dealRealPair() (без suit — она нигде не
        // используется). Если $forcedRank задан — скрытый порог пити уже выбит, партия ОБЯЗАНА
        // выдать именно эту пару. Если не задан — случайное совпадение по премиум-рангу явно
        // исключается (по ТЗ "итоговая AA/KK/QQ невозможна, пока порог не достигнут"), обычные
        // пары (7..В) остаются честным шансом.
        // 23.09.2026: &$trace — по ссылке, копит attempt-by-attempt лог для debug-ответа клиенту.
        private function _dealRealPair($catalog, $forcedRank, &$trace){
            $RANKS   = $catalog['ranks'];
            $PREMIUM = $catalog['premium_ranks'];
            // 26.09.2026 (баг найден по прямому репорту + логам php_errors.log — реальный кейс
            // "forcedRank":"Array" на проде, uid 382448269, deal() 26.09.2026 08:00-08:02 UTC):
            // если forcedRank (из pity ИЛИ из dev_force_blackjack) не входит в каталог рангов —
            // раздача ломается целиком (обе карты получают несуществующий "ранг", .png не
            // грузится, карты не отображаются вообще). Источник конкретно "Array" пойман и
            // закрыт отдельно в users.php.setDevCombo() (там же логирование, если повторится),
            // но здесь — защита по факту на случай ЛЮБОГО другого пути порчи forcedRank:
            // невалидное значение просто игнорируется, раздача идёт честно, а не ломается.
            if($forcedRank !== null && !in_array($forcedRank, $RANKS, true)){
                $trace[] = "forcedRank='$forcedRank' НЕ входит в RANKS — игнорируем, раздаём честно";
                error_log('[blackjack._dealRealPair] !!! forcedRank НЕ входит в RANKS, раздача честная !!! forcedRank=' . json_encode($forcedRank));
                $forcedRank = null;
            }
            $first   = $forcedRank ?: $this->_pickRank($RANKS);
            $trace[] = "first=$first (forcedRank=" . json_encode($forcedRank) . ")";
            $second  = null;
            for($attempt = 0; $attempt < 50; $attempt++){
                $rank = $forcedRank ?: $this->_pickRank($RANKS);
                $rejected = (!$forcedRank && $rank === $first && in_array($rank, $PREMIUM, true));
                $trace[] = "  attempt#$attempt rank=$rank rejected=" . ($rejected ? '1(matches first+premium)' : '0');
                if($rejected) continue;
                $second = $rank;
                break;
            }
            if($second === null){
                $second = $forcedRank ?: $this->_pickRank($RANKS);
                $trace[] = "  FALLBACK (50 попыток исчерпаны) second=$second";
            }
            return [$first, $second];
        }

        // Раздача — списывает бесплатную попытку (одна в день) или 1 рубль, решает pity
        // (форсирует гарантированную пару, если порог выбит), раздаёт честную пару. Активная
        // раздача сохраняется в blackjack_session.
        function deal(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            // Сырая строка ИЗ БД до какого-либо декодирования — на случай, если проблема в
            // самом хранении/кодировании JSON (например повреждение из-за encoding), а не в
            // логике этого файла.
            $rawSessionFromDb = isset($user['blackjack_session']) ? $user['blackjack_session'] : null;

            $catalog = $this->_catalog();
            $session = $this->_loadSession($user, $catalog);

            // 25.09.2026 (по прямому указанию, фикс "выбор сбрасывается при смене вкладки/
            // перезагрузке, игра уничтожается"): та же идемпотентность, что у poker.php.deal() и
            // dice.php.start() — если раздача уже активна, просто возвращаем её же, ничего не
            // списывая и не раздавая заново.
            if(is_array($session['active'] ?? null)){
                $active = $session['active'];
                $existingDailyState = $this->_dailyState($session);
                $patch = $this->ops->patchCurrencies($user, ['coins', 'coins_spent']);
                $this->ops->ok([
                    'patch' => $patch,
                    'hand' => $active['hand'],
                    'swapsAllowed' => intval($active['swapsAllowed']),
                    'swapsUsed' => intval($active['swapsUsed']),
                    'isFree' => $existingDailyState['isFree'],
                    'serverNow' => $existingDailyState['serverNow'],
                    'nextFreeAt' => $existingDailyState['nextFreeAt'],
                    'resumed' => true,
                ]);
                return;
            }

            $dailyState = $this->_dailyState($session);
            $isFree = $dailyState['isFree'];
            if($isFree){
                $session['dailyUsed'] = true;
            } else {
                $cost = intval($catalog['play_cost_coins']);
                if(!$this->ops->deduct($user, 'coins', $cost)){
                    error_log('[blackjack.deal] отказ code=84 | uid=' . abs(intval($this->registry['uid'])) .
                        ' | coinsInDb=' . $this->ops->i($user, 'coins') . ' | cost=' . $cost .
                        ' | dailyUsed=' . (!empty($session['dailyUsed']) ? '1' : '0'));
                    return $this->ops->fail(84); // недостаточно рублей
                }
                $user['coins_spent'] = $this->ops->i($user, 'coins_spent') + $cost;
            }

            $forcedRank = null;
            $forcedTrace = [];
            $matured = [];
            foreach($catalog['premium_order'] as $row){
                list($key, $rank) = $row;
                $cur = intval($session[$key]);
                $thr = intval($session[$key . '_t']);
                $hit = $cur >= $thr;
                $forcedTrace[] = "$key: $cur >= $thr ? " . ($hit ? 'ДА (форс ' . $rank . ')' : 'нет');
                if($hit) $matured[] = [$key, $rank];
            }
            if(!empty($matured)){
                // При совпадении порогов выдаём младшую из готовых комбинаций сейчас
                // (QQ → KK → AA), а каждый более старший готовый порог переносим ровно
                // на 100 завершённых партий. Это разовая поправка порога, не очередь.
                $forcedRank = $matured[0][1];
                foreach(array_slice($matured, 1) as $delayed){
                    $delayedKey = $delayed[0];
                    $session[$delayedKey . '_t'] = intval($session[$delayedKey . '_t']) + 100;
                    $forcedTrace[] = "$delayedKey: совпал с {$matured[0][0]}, порог сдвинут на +100";
                }
            }

            // 25.09.2026 (по прямому указанию — "хочу тестировать все комбинации блэкджека"):
            // dev_force_blackjack — личный одноразовый флаг (dev-панель, users.setDevCombo),
            // хранит либо конкретный ранг из catalog['ranks'] (гарантированная пара этого
            // ранга — тот же forcedRank, что и у обычного pity выше, просто выставлен вручную,
            // не по счётчику), либо спецключ '__nonpair' (гарантированно РАЗНЫЕ ранги — обычный
            // _dealRealPair() такого не гарантирует, он лишь СНИЖАЕТ шанс совпадения премиум-
            // рангов, поэтому для этого случая раздаём в обход неё напрямую).
            $devForceBj = strval($user['dev_force_blackjack'] ?? '');
            $dealTrace = [];
            if($devForceBj !== '' && $devForceBj !== '__nonpair'){
                $user['dev_force_blackjack'] = '';
                $forcedRank = $devForceBj;
                $dealTrace[] = "DEV FORCE rank=$devForceBj (обычный pity-счётчик пропущен)";
                $hand = $this->_dealRealPair($catalog, $forcedRank, $dealTrace);
            } else if($devForceBj === '__nonpair'){
                $user['dev_force_blackjack'] = '';
                $RANKS = $catalog['ranks'];
                $r1 = $this->_pickRank($RANKS);
                do { $r2 = $this->_pickRank($RANKS); } while($r2 === $r1);
                $hand = [$r1, $r2];
                $dealTrace[] = "DEV FORCE __nonpair → [$r1, $r2] (гарантированно разные ранги)";
            } else {
                $hand = $this->_dealRealPair($catalog, $forcedRank, $dealTrace);
            }
            $swapsAllowed = $this->_swapsAllowed($user, $catalog);

            $session['active'] = [
                'hand'         => $hand,
                'forcedRank'   => $forcedRank,
                'swapsUsed'    => 0,
                'swapsAllowed' => $swapsAllowed,
            ];
            $user['blackjack_session'] = json_encode($session, JSON_UNESCAPED_UNICODE);
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            // 23.09.2026 (по прямому указанию — "залогируй вообще всё"): перечитываем ИЗ БД
            // СРАЗУ после saveUser(), а не доверяем локальной переменной — если saveData()/
            // trueJSON() (см. database.php) как-то искажают сохранённое значение (например
            // ksort() внутри trueJSON при следующем чтении), это будет видно здесь, а не
            // всплывёт молча в следующем запросе.
            $verifyUser = $this->ops->loadUser(['id', 'blackjack_session']);
            $verifyRaw  = $verifyUser ? ($verifyUser['blackjack_session'] ?? null) : '!!! loadUser() ПОСЛЕ save вернул null !!!';

            $debug = [
                'fn'                => 'deal',
                'uid'               => abs(intval($this->registry['uid'])),
                'time'              => date('Y-m-d H:i:s'),
                'microtime'         => microtime(true),
                'rawParams'         => $this->registry['user_params'],
                'rawSessionFromDb'  => $rawSessionFromDb,
                'catalogFull'       => $catalog,
                'pityBefore'        => [
                    'aa' => $session['aa'], 'aa_t' => $session['aa_t'],
                    'kk' => $session['kk'], 'kk_t' => $session['kk_t'],
                    'qq' => $session['qq'], 'qq_t' => $session['qq_t'],
                ],
                'forcedRankTrace'   => $forcedTrace,
                'forcedRank'        => $forcedRank,
                'dealTrace'         => $dealTrace,
                'hand'              => $hand,
                'swapsAllowed'      => $swapsAllowed,
                'sessionSavedRaw'   => $user['blackjack_session'],
                'sessionVerifiedFromDbAfterSave' => $verifyRaw,
                'saveVerifyMismatch' => !$this->ops->sameJsonState($user['blackjack_session'], $verifyRaw),
            ];
            error_log('[blackjack.deal] ' . json_encode($debug)
                . ($debug['saveVerifyMismatch'] ? ' !!! ЗАПИСАННОЕ И ПРОЧИТАННОЕ ОБРАТНО ЗНАЧЕНИЕ РАЗОШЛИСЬ !!!' : ''));

            $patch = $this->ops->patchCurrencies($user, ['coins', 'coins_spent']);
            $this->ops->ok(['patch' => $patch, 'hand' => $hand, 'swapsAllowed' => $swapsAllowed, 'swapsUsed' => 0,
                'isFree' => $isFree, 'serverNow' => $dailyState['serverNow'],
                'nextFreeAt' => $dailyState['nextFreeAt'], 'debug' => $debug]);
        }

        // Честная замена одной карты (idx 2 или 3 — только они формируют пару, слоты 0/1
        // декоративные и на сервер вообще не отправляются) — тот же принцип, что
        // dvor-blackjack.js._swapBlackjackCard(): новый ранг честно случайный, обязан
        // отличаться от старого В ЭТОМ ЖЕ слоте; единственное ограничение — нельзя случайно
        // СОБРАТЬ чужую (не выбитую в этой партии) премиум-пару, иначе игрок мог бы вручную
        // "нафармить" AA/KK/QQ сменами, обходя скрытый порог.
        function swap(){
            $idx = intval($this->registry['user_params']['idx'] ?? -1);
            if($idx !== 2 && $idx !== 3) return $this->ops->fail(54);

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $rawSessionFromDb = isset($user['blackjack_session']) ? $user['blackjack_session'] : null;

            $catalog = $this->_catalog();
            $session = $this->_loadSession($user, $catalog);
            $active  = $session['active'] ?? null;
            if(!is_array($active)) return $this->ops->fail(85); // нет активной раздачи
            if(intval($active['swapsUsed']) >= intval($active['swapsAllowed'])) return $this->ops->fail(86); // смены закончились

            $RANKS   = $catalog['ranks'];
            $PREMIUM = $catalog['premium_ranks'];
            $handIdx   = ($idx === 2) ? 0 : 1;
            $otherIdx  = 1 - $handIdx;
            $oldRank   = $active['hand'][$handIdx];
            $otherRank = $active['hand'][$otherIdx];
            $forcedRank = $active['forcedRank'];
            $handBefore = $active['hand'];

            $newRank = null;
            $usedFallback = false;
            $swapTrace = [];
            for($attempt = 0; $attempt < 50; $attempt++){
                $rank = $this->_pickRank($RANKS);
                $rejectOld    = ($rank === $oldRank);
                $rejectMatch  = ($rank === $otherRank && in_array($rank, $PREMIUM, true) && $rank !== $forcedRank);
                $swapTrace[] = "attempt#$attempt rank=$rank rejectOld=" . ($rejectOld?'1':'0') . " rejectMatch=" . ($rejectMatch?'1':'0');
                if($rejectOld) continue;
                if($rejectMatch) continue;
                $newRank = $rank;
                break;
            }
            if($newRank === null){
                $usedFallback = true;
                foreach($RANKS as $r) if($r !== $oldRank){ $newRank = $r; break; }
                $swapTrace[] = "!!! FALLBACK (50 попыток исчерпаны, проверка на чужую пару НЕ применялась) newRank=$newRank";
            }

            $active['hand'][$handIdx] = $newRank;
            $active['swapsUsed']      = intval($active['swapsUsed']) + 1;
            $session['active']        = $active;
            $user['blackjack_session'] = json_encode($session, JSON_UNESCAPED_UNICODE);
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            $verifyUser = $this->ops->loadUser(['id', 'blackjack_session']);
            $verifyRaw  = $verifyUser ? ($verifyUser['blackjack_session'] ?? null) : '!!! loadUser() ПОСЛЕ save вернул null !!!';

            $debug = [
                'fn'               => 'swap',
                'uid'              => abs(intval($this->registry['uid'])),
                'time'             => date('Y-m-d H:i:s'),
                'microtime'        => microtime(true),
                'idx'              => $idx,
                'rawParams'        => $this->registry['user_params'],
                'rawSessionFromDb' => $rawSessionFromDb,
                'catalogFull'      => $catalog,
                'handIdx'          => $handIdx,
                'otherIdx'         => $otherIdx,
                'oldRank'          => $oldRank,
                'otherRank'        => $otherRank,
                'forcedRank'       => $forcedRank,
                'handBefore'       => $handBefore,
                'swapsUsedBefore'  => intval($active['swapsUsed']) - 1, // до инкремента чуть выше
                'swapsAllowed'     => intval($active['swapsAllowed']),
                'swapTrace'        => $swapTrace,
                'usedFallback'     => $usedFallback,
                'newRank'          => $newRank,
                'handAfter'        => $active['hand'],
                'isPairAfter'      => ($active['hand'][0] === $active['hand'][1]),
                'isPremiumPairAfter' => ($active['hand'][0] === $active['hand'][1] && in_array($active['hand'][0], $PREMIUM, true)),
                'sessionSavedRaw'  => $user['blackjack_session'],
                'sessionVerifiedFromDbAfterSave' => $verifyRaw,
                'saveVerifyMismatch' => !$this->ops->sameJsonState($user['blackjack_session'], $verifyRaw),
            ];
            error_log('[blackjack.swap] ' . json_encode($debug)
                . ($debug['isPremiumPairAfter'] && !$forcedRank ? ' !!! ПРЕМИУМ-ПАРА СОБРАНА СВАПОМ БЕЗ FORCEDRANK — ЭТО ТА САМАЯ ДЫРА !!!' : '')
                . ($debug['saveVerifyMismatch'] ? ' !!! ЗАПИСАННОЕ И ПРОЧИТАННОЕ ОБРАТНО ЗНАЧЕНИЕ РАЗОШЛИСЬ !!!' : ''));

            $this->ops->ok([
                'rank'      => $newRank,
                // Возвращаем всю серверную пару: клиент после каждой смены полностью
                // синхронизирует обе игровые карты и не зависит от локального idx.
                'hand'      => $active['hand'],
                'swapsLeft' => intval($active['swapsAllowed']) - intval($active['swapsUsed']),
                'debug'     => $debug,
            ]);
        }

        // Итог — честно проверяет РЕАЛЬНУЮ пару на столе (замены могли увести итог от
        // изначально задуманного, как и в Покере), обновляет pity и начисляет награду. Порог
        // считается "использованным" в момент РАЗДАЧИ (если он был выбит), а не в момент
        // награды — даже если игрок сам сломал гарантированную пару неудачной сменой и не
        // получил награду, диапазон всё равно сбрасывается (та же логика, что в клиенте была).
        function resolve(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $rawSessionFromDb = isset($user['blackjack_session']) ? $user['blackjack_session'] : null;

            $catalog = $this->_catalog();
            $session = $this->_loadSession($user, $catalog);
            $active  = $session['active'] ?? null;
            if(!is_array($active)) return $this->ops->fail(85); // нет активной раздачи

            $hand      = $active['hand'];
            $bestRank  = ($hand[0] === $hand[1]) ? $hand[0] : null;
            $forcedKey = $active['forcedRank'] ? ($catalog['premium_map'][$active['forcedRank']] ?? null) : null;
            $isPremiumWin = $bestRank && in_array($bestRank, $catalog['premium_ranks'], true);

            if($forcedKey){
                $session[$forcedKey] = 0;
                $range = $catalog['premium_range'][$forcedKey];
                $session[$forcedKey . '_t'] = rand(intval($range[0]), intval($range[1]));
            } else {
                foreach($catalog['premium_map'] as $rank => $key){
                    $session[$key] = intval($session[$key] ?? 0) + 1;
                }
            }

            // Суммы возвращаются клиенту явно (cigAmt/respAmt/expAmt/shmot), а не как готовый
            // текст — клиент сам собирает строку результата (тот же формат, что был раньше), не
            // дублируя таблицу payouts у себя — единственный источник сумм остаётся здесь, в
            // каталоге.
            // 26.09.2026 (по прямому указанию — "за 77/99 должен выдаваться опыт, а не
            // авторитет"): добавлена ветка exp, параллельная уже существующей resp — payouts
            // для "семерка"/"девятка" в blackjack_config.json переведены с resp на exp (300/1000
            // соответственно), сама ветка resp оставлена для любых будущих рангов, где авторитет
            // всё ещё уместен (сейчас таких нет, но код не завязан на конкретные ранги).
            $cigAmt = 0; $respAmt = 0; $expAmt = 0; $shmotGiven = false; $shmotGranted = null;
            $clientReward = null;
            if($bestRank && isset($catalog['payouts'][$bestRank])){
                $p = $catalog['payouts'][$bestRank];
                if(!empty($p['cig'])){  $cigAmt  = intval($p['cig']);  $this->ops->add($user, 'cigarettes', $cigAmt); }
                if(!empty($p['resp'])){ $respAmt = intval($p['resp']); $this->ops->add($user, 'respect', $respAmt); }
                if(!empty($p['exp'])){  $expAmt  = intval($p['exp']);  $this->ops->add($user, 'exp', $expAmt); }
                if(!empty($p['shmot'])){
                    $shmotId = $catalog['premium_shmot'][$bestRank] ?? null;
                    $shmotGranted = $shmotId === null ? null : $this->ops->grantShmotById($user, $shmotId);
                    $shmotGiven = $shmotGranted !== null;
                }
            } else {
                $cigAmt = intval($catalog['consolation_cig']);
                $this->ops->add($user, 'cigarettes', $cigAmt);
            }
            // dvor_games — общий счётчик всех партий "Двора" (как у Зариков/Покера) — раньше
            // инкрементировался клиентским _give() при каждой награде, теперь сервер делает
            // это сам за клиента при каждом завершённом резолве.
            $user['dvor_games'] = $this->ops->i($user, 'dvor_games') + 1;

            $session['active'] = null;
            $user['blackjack_session'] = json_encode($session, JSON_UNESCAPED_UNICODE);
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            $verifyUser = $this->ops->loadUser(['id', 'blackjack_session']);
            $verifyRaw  = $verifyUser ? ($verifyUser['blackjack_session'] ?? null) : '!!! loadUser() ПОСЛЕ save вернул null !!!';

            $debug = [
                'fn'                 => 'resolve',
                'uid'                => abs(intval($this->registry['uid'])),
                'time'               => date('Y-m-d H:i:s'),
                'microtime'          => microtime(true),
                'rawParams'          => $this->registry['user_params'],
                'rawSessionFromDb'   => $rawSessionFromDb,
                'catalogFull'        => $catalog,
                'hand'               => $hand,
                'bestRank'           => $bestRank,
                'isPremiumWin'       => $isPremiumWin,
                'forcedRank_at_deal' => $active['forcedRank'],
                'forcedKey'          => $forcedKey,
                'swapsUsed'          => intval($active['swapsUsed']),
                'swapsAllowed'       => intval($active['swapsAllowed']),
                'cigAmt'             => $cigAmt,
                'respAmt'            => $respAmt,
                'expAmt'             => $expAmt,
                'shmotGiven'         => $shmotGiven,
                'sessionSavedRaw'    => $user['blackjack_session'],
                'sessionVerifiedFromDbAfterSave' => $verifyRaw,
                'saveVerifyMismatch' => !$this->ops->sameJsonState($user['blackjack_session'], $verifyRaw),
            ];
            error_log('[blackjack.resolve] ' . json_encode($debug)
                . ($isPremiumWin && !$forcedKey ? ' !!! ПРЕМИУМ-ПАРА БЕЗ FORCEDKEY — ЭТО ТА САМАЯ ДЫРА !!!' : '')
                . ($debug['saveVerifyMismatch'] ? ' !!! ЗАПИСАННОЕ И ПРОЧИТАННОЕ ОБРАТНО ЗНАЧЕНИЕ РАЗОШЛИСЬ !!!' : ''));

            $patch = $this->ops->patchCurrencies($user, ['cigarettes', 'respect', 'exp', 'dvor_games', 'shmot', 'max_energy']);
            $this->ops->ok([
                'patch'        => $patch,
                'hand'         => $hand,
                'bestRank'     => $bestRank,
                'cigAmt'       => $cigAmt,
                'respAmt'      => $respAmt,
                'expAmt'       => $expAmt,
                'shmot'        => $shmotGiven,
                'shmotGranted' => $shmotGranted,
                'clientReward' => $clientReward,
                // 25.09.2026 (по прямому указанию — "показывай сбоку количество игр до
                // комбинации"): значения ПОСЛЕ обновления счётчиков выше (или сброса в 0, если
                // именно этот раунд форсировал премиум-пару) — клиент обновляет боковую панель
                // сразу по этому ответу, не дожидаясь отдельного status().
                'aa' => intval($session['aa']), 'aa_t' => intval($session['aa_t']),
                'kk' => intval($session['kk']), 'kk_t' => intval($session['kk_t']),
                'qq' => intval($session['qq']), 'qq_t' => intval($session['qq_t']),
                'debug'        => $debug,
            ]);
        }
    }
?>
