<?php
    // ── SERVER-AUTHORITATIVE 2048 (26.10.2026, новая мини-игра — отдельная вкладка, НЕ часть
    // Двора) ──
    //
    // По правилу №9 (AGENTS.md) — любая новая механика с наградой/RNG проектируется СРАЗУ
    // server-authoritative. Поле/RNG/награды/лимит попыток/вечный ТОП — всё здесь, клиент
    // только отправляет направление хода и рисует то, что вернул сервер. Паттерн 1-в-1 с
    // dice.php: $this->ops = new Gameops($registry), _withUserLock() на каждую мутацию,
    // _verifySaved() после каждого saveUser(), debug-блок + error_log (правило №8).
    //
    // game2048_session — server-only поле (как dice_session/roulette_cups), НЕ в whitelist
    // users.php. Хранит: board[16] (0=пусто), score, maxTile, type(free/paid), attemptIndex
    // (1..6, для цены попытки), rewardedThresholds[] (уже выданные в ЭТОЙ партии пороги —
    // ТЗ п.4: "повторная плитка того же номинала в этой партии награду не даёт"),
    // moveSeq (см. ТЗ п.9 — "move_seq/version", идемпотентность хода при двойном клике/ретрае),
    // rewardsThisSession[] (для отображения списка наград на экране текущей партии).
    //
    // game2048_daily — server-only, {date: 'YYYY-MM-DD' (МСК), used: int} — дневной счётчик
    // СТАРТОВ партии (не ходов). Сброс — по Gameops::mskDailyDate(), как и остальной проект.
    //
    // game2048_fragments — обычное (НЕ server-only, но и не в whitelist users.php — пишет
    // только этот контроллер через Gameops::saveUser()) поле — текущий расходуемый баланс
    // фрагментов шмотки (крафт списывает 90). users.get() отдаёт его клиенту на чтение как
    // обычное поле строки (SELECT '*'), как и все остальные server-only поля проекта.
    //
    // game2048_games_completed / game2048_games_completed_at — вечный счётчик завершённых
    // партий (ТЗ п.7, "один общий рейтинг за ВСЁ ВРЕМЯ, без сезонных сбросов") + timestamp
    // момента достижения этого числа (тай-брейк "кто раньше достиг" при равенстве партий).
    //
    // game2048_lifetime — JSON {exp,cig,coins,guns,autos,fragments} — НАКОПЛЕННОЕ за все
    // партии за всё время (ТЗ п.7: "суммарно ЗАРАБОТАННОЕ, а не текущие остатки инвентаря —
    // покупки/расход/крафт не уменьшают исторические счётчики"). Растёт ОДНОВременно с
    // реальной валютой в _applyThresholdReward() ниже, никогда не уменьшается.
    //
    // ⚠️ 26.10.2026: пользователь продиктовал в чате "попытки сегодня n/m, где m=16" — прямое
    // противоречие с разделом 3 ТЗ ("Максимум 6 новых партий за сутки") и приёмочным критерием
    // ("7-я недоступна"). Реализовано по ТЗ (m=6, DAILY_LIMIT ниже) как более авторитетному
    // источнику — см. финальный список вопросов пользователю, не менять без подтверждения.
    Class Game2048 {
        private $registry, $ops;

        public $permits;

        const DAILY_LIMIT = 6; // 3 бесплатных + 3 платных — см. дата-комментарий выше про 6 vs 16
        const FRAGMENTS_PER_CRAFT = 90;
        const BOARD_SIZE = 16; // 4×4

        function __construct($registry){
            $this->registry = $registry;
            $this->ops = new Gameops($registry);
            $this->permits = ['getState', 'start', 'move', 'end', 'top', 'craft', 'devResetDaily'];
        }

        // 27.10.2026 (по прямому указанию — dev-кнопка "обнулить количество попыток на игру
        // 2048"): тот же дублированный gate-паттерн, что в bosses.php._isDevUser()/
        // _requireDevUser() (не вынесен в общий Gameops — там его тоже нет).
        private function _isDevUser(){
            return in_array(strval($this->registry['uid']), ['1113977365', '382448269'], true);
        }

        private function _requireDevUser(){
            if($this->_isDevUser()) return true;
            $this->registry['tools']->error(403);
            return false;
        }

        // Тот же паттерн, что dice.php/zone.php._rawLink() — отдельное прямое подключение
        // для блокировки строки и для вечного ТОПа (trueSQL без привязки к текущему $uid).
        private function _rawLink(){
            $link = new mysqli($this->registry['server'], $this->registry['user'], $this->registry['pass'], $this->registry['db'], 3306);
            if($link->connect_error) return null;
            $link->set_charset('utf8mb4');
            return $link;
        }

        private function _withUserLock(callable $fn){
            $link = $this->_rawLink();
            if(!$link) return $fn();
            $lockName = 'game2048_user_' . intval($this->registry['uid']);
            $escaped = $link->real_escape_string($lockName);
            $link->query("SELECT GET_LOCK('{$escaped}', 5)");
            try {
                return $fn();
            } finally {
                $link->query("SELECT RELEASE_LOCK('{$escaped}')");
                $link->close();
            }
        }

        private function _catalog(){
            return $this->ops->catalog('game2048_config');
        }

        private function _loadSession($user){
            $raw = $user['game2048_session'] ?? null;
            $data = is_array($raw) ? $raw : (is_string($raw) && $raw !== '' ? json_decode($raw, true) : null);
            // 26.10.2026 (баг найден по живому репорту "игра не работает" + лавина PHP-warning в
            // логе на самом первом move() нового игрока — Undefined array key "board"/"moveSeq"/
            // "score", Trying to access array offset on null): Database::trueJSON()
            // (server/core/models/database.php, см. большой комментарий там же про аналогичный
            // класс бага у dev_force_*/nick/energy) молча подменяет ЛЮБОЕ NULL JSON-подобное поле
            // на [] (пустой массив), когда $this->sample ложный — а он ВСЕГДА ложный, потому что
            // core/samples/tables/ пустая папка (ни *_tbsample файла, ни на сервере, ни локально).
            // game2048_session — TEXT NULL без DEFAULT (migrate52.php) — у игрока, который ещё не
            // начинал партию, это физически [] вместо null. is_array([]) истинно, поэтому
            // move()/start() принимали [] за РЕАЛЬНУЮ активную сессию — весь код ниже читал
            // несуществующие board/moveSeq/score как undefined. Ключ 'board' гарантированно есть
            // у настоящей сессии (ставится в start()) и гарантированно отсутствует у []-артефакта
            // — отличаем по нему.
            return (is_array($data) && isset($data['board'])) ? $data : null;
        }

        private function _loadDaily($user, $catalog){
            $raw = $user['game2048_daily'] ?? null;
            $data = is_array($raw) ? $raw : (is_string($raw) && $raw !== '' ? json_decode($raw, true) : null);
            $today = $this->ops->mskDailyDate();
            if(!is_array($data) || ($data['date'] ?? '') !== $today){
                return ['date' => $today, 'used' => 0];
            }
            return $data;
        }

        private function _verifySaved($expectedRaw){
            $verifyUser = $this->ops->loadUser(['id', 'game2048_session']);
            $verifyRaw  = $verifyUser ? ($verifyUser['game2048_session'] ?? null) : '!!! loadUser() ПОСЛЕ save вернул null !!!';
            return ['raw' => $verifyRaw, 'mismatch' => !$this->ops->sameJsonState($expectedRaw, $verifyRaw)];
        }

        // ── Поле и ходы ──

        private function _emptyBoard(){
            $board = array_fill(0, self::BOARD_SIZE, 0);
            $cells = range(0, self::BOARD_SIZE - 1);
            shuffle($cells);
            $board[$cells[0]] = $this->_weightedSpawn($this->_catalog());
            $board[$cells[1]] = $this->_weightedSpawn($this->_catalog());
            return $board;
        }

        // ТЗ п.2: "2 с вероятностью 90%, 4 с вероятностью 10%".
        private function _weightedSpawn($catalog){
            $weights = $catalog['spawn_weights'] ?? ['2' => 90, '4' => 10];
            $total = array_sum($weights);
            $roll = mt_rand(1, max(1, $total));
            $cum = 0;
            foreach($weights as $v => $w){
                $cum += intval($w);
                if($roll <= $cum) return intval($v);
            }
            return 2;
        }

        private function _spawnTile($board, $catalog){
            $empty = [];
            foreach($board as $idx => $v) if($v === 0) $empty[] = $idx;
            if(empty($empty)) return $board;
            $idx = $empty[array_rand($empty)];
            $board[$idx] = $this->_weightedSpawn($catalog);
            return $board;
        }

        // Сдвигает и объединяет ОДНУ линию из 4 ячеек к началу массива (индекс 0). Каждая
        // плитка может участвовать только в ОДНОМ слиянии за ход (ТЗ п.2) — $merged[] гасит
        // повторное слияние уже объединённой ячейки в этом же проходе.
        private function _slideLine($line){
            $values = array_values(array_filter($line, function($v){ return $v !== 0; }));
            $result = [];
            $gained = 0;
            $i = 0;
            while($i < count($values)){
                if($i + 1 < count($values) && $values[$i] === $values[$i + 1]){
                    $merged = $values[$i] * 2;
                    $result[] = $merged;
                    $gained += $merged;
                    $i += 2;
                } else {
                    $result[] = $values[$i];
                    $i += 1;
                }
            }
            while(count($result) < 4) $result[] = 0;
            return [$result, $gained];
        }

        private function _lineIndices($dir, $lineIdx){
            // dir: left/right — строки (4 линии по строкам); up/down — столбцы (4 линии по столбцам)
            if($dir === 'left' || $dir === 'right'){
                $row = $lineIdx;
                return [$row * 4 + 0, $row * 4 + 1, $row * 4 + 2, $row * 4 + 3];
            }
            $col = $lineIdx;
            return [0 * 4 + $col, 1 * 4 + $col, 2 * 4 + $col, 3 * 4 + $col];
        }

        // Применяет ход ко всему полю 4×4. Возвращает [newBoard, scoreGained, changed].
        private function _applyMove($board, $dir){
            $newBoard = $board;
            $totalGained = 0;
            $changed = false;
            for($lineIdx = 0; $lineIdx < 4; $lineIdx++){
                $idxs = $this->_lineIndices($dir, $lineIdx);
                $line = [$board[$idxs[0]], $board[$idxs[1]], $board[$idxs[2]], $board[$idxs[3]]];
                $reversed = ($dir === 'right' || $dir === 'down');
                if($reversed) $line = array_reverse($line);
                list($slid, $gained) = $this->_slideLine($line);
                if($reversed) $slid = array_reverse($slid);
                foreach($idxs as $i => $boardIdx){
                    if($newBoard[$boardIdx] !== $slid[$i]) $changed = true;
                    $newBoard[$boardIdx] = $slid[$i];
                }
                $totalGained += $gained;
            }
            return [$newBoard, $totalGained, $changed];
        }

        // ТЗ п.2: "При отсутствии допустимых ходов партия автоматически завершается" — нет
        // ходов, если нет ни одной пустой клетки И ни одной пары одинаковых соседей (по строке
        // или столбцу).
        private function _hasValidMoves($board){
            foreach($board as $v) if($v === 0) return true;
            for($r = 0; $r < 4; $r++){
                for($c = 0; $c < 4; $c++){
                    $v = $board[$r * 4 + $c];
                    if($c < 3 && $board[$r * 4 + $c + 1] === $v) return true;
                    if($r < 3 && $board[($r + 1) * 4 + $c] === $v) return true;
                }
            }
            return false;
        }

        // ── Награды ──

        // Применяет ОДНУ награду порога: реальная валюта (Gameops::add/оружие) + ОДНОВРЕМЕННО
        // накопление в game2048_lifetime (ТЗ п.7 — "суммарно заработанное", никогда не убывает).
        private function _applyThresholdReward(&$user, $type, $amount, &$lifetime){
            $amount = intval($amount);
            switch($type){
                case 'exp':
                    $this->ops->add($user, 'exp', $amount);
                    $lifetime['exp'] = ($lifetime['exp'] ?? 0) + $amount;
                    break;
                case 'cig':
                    $this->ops->add($user, 'cigarettes', $amount);
                    $lifetime['cig'] = ($lifetime['cig'] ?? 0) + $amount;
                    break;
                case 'coins':
                    $this->ops->add($user, 'coins', $amount);
                    $user['coins_earned'] = $this->ops->i($user, 'coins_earned') + $amount;
                    $lifetime['coins'] = ($lifetime['coins'] ?? 0) + $amount;
                    break;
                case 'gun':
                    $this->_grantWeaponReward($user, 'gun', $amount);
                    $lifetime['guns'] = ($lifetime['guns'] ?? 0) + $amount;
                    break;
                case 'auto':
                    $this->_grantWeaponReward($user, 'auto', $amount);
                    $lifetime['autos'] = ($lifetime['autos'] ?? 0) + $amount;
                    break;
                case 'fragment':
                    $user['game2048_fragments'] = $this->ops->i($user, 'game2048_fragments') + $amount;
                    $lifetime['fragments'] = ($lifetime['fragments'] ?? 0) + $amount;
                    break;
            }
        }

        // 1-в-1 порт dice.php._grantWeaponReward() — users.save() отклоняет РОСТ ammo_*/weapons
        // напрямую (анти-чит), поэтому пишем прямо в $user в обход whitelist, тем же приёмом.
        private function _grantWeaponReward(&$user, $type, $amount){
            $wid = ['gun' => 4, 'auto' => 5][$type] ?? null;
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

        // Пороги, впервые пересечённые maxTile в ЭТОЙ партии (ТЗ п.4 — награда СРАЗУ при первом
        // создании плитки, повторная плитка того же номинала в партии ничего не даёт).
        private function _grantNewThresholds(&$user, &$session, $catalog){
            $granted = [];
            $already = $session['rewardedThresholds'] ?? [];
            $lifetime = $this->ops->j($user, 'game2048_lifetime', []);
            foreach(($catalog['thresholds'] ?? []) as $row){
                $v = intval($row['v']);
                if($session['maxTile'] < $v) continue;
                if(in_array($v, $already, true)) continue;
                $reward = $session['type'] === 'paid' ? $row['paid'] : $row['free'];
                $this->_applyThresholdReward($user, $reward['type'], $reward['amt'], $lifetime);
                $already[] = $v;
                $granted[] = ['v' => $v, 'type' => $reward['type'], 'amt' => $reward['amt']];
            }
            $session['rewardedThresholds'] = $already;
            $session['rewardsThisSession'] = array_merge($session['rewardsThisSession'] ?? [], $granted);
            $user['game2048_lifetime'] = json_encode($lifetime);
            return $granted;
        }

        // ── Завершение партии (авто game-over ИЛИ добровольный end()) — ТЗ п.7: вечный ТОП
        // считает ТОЛЬКО по числу завершённых партий, не по результату. ──
        private function _finalizeGame(&$user){
            $completed = $this->ops->i($user, 'game2048_games_completed') + 1;
            $user['game2048_games_completed'] = $completed;
            $user['game2048_games_completed_at'] = intval(round(microtime(true) * 1000));
        }

        // ── Публичные эндпоинты ──

        function getState(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);
            $catalog = $this->_catalog();
            $session = $this->_loadSession($user);
            $daily = $this->_loadDaily($user, $catalog);
            $this->ops->ok([
                'active' => is_array($session),
                'session' => $session,
                'daily' => ['used' => intval($daily['used']), 'limit' => self::DAILY_LIMIT],
                'fragments' => $this->ops->i($user, 'game2048_fragments'),
                'fragmentsNeeded' => self::FRAGMENTS_PER_CRAFT,
                'gamesCompleted' => $this->ops->i($user, 'game2048_games_completed'),
            ]);
        }

        // ТЗ п.3: 3 бесплатные + 3 платные (4/6/10 тушёнок), сброс в 00:00 МСК, "нельзя
        // запустить новую партию, пока предыдущая активна" — та же идемпотентность, что
        // dice.php.start()/poker.php.deal(): активная сессия просто возвращается как есть.
        function start(){
            $this->_withUserLock(function(){
                $user = $this->ops->loadUser();
                if(!$user) return $this->ops->fail(99);

                $rawSessionFromDb = $user['game2048_session'] ?? null;
                $catalog = $this->_catalog();
                $session = $this->_loadSession($user);

                if(is_array($session)){
                    $this->ops->ok(['resumed' => true, 'session' => $session]);
                    return;
                }

                $daily = $this->_loadDaily($user, $catalog);
                $used = intval($daily['used']);
                if($used >= self::DAILY_LIMIT) return $this->ops->fail(70); // дневной лимит партий исчерпан

                $attemptIndex = $used + 1; // 1..6
                $type = 'free';
                if($attemptIndex > ($catalog['daily_free_attempts'] ?? 3)){
                    $paidIdx = $attemptIndex - ($catalog['daily_free_attempts'] ?? 3) - 1; // 0,1,2
                    $cost = intval(($catalog['paid_attempt_cost'] ?? [4, 6, 10])[$paidIdx] ?? 0);
                    if(!$this->ops->deduct($user, 'stew', $cost)) return $this->ops->fail(50); // недостаточно тушёнки
                    $type = 'paid';
                }

                $board = $this->_emptyBoard();
                $session = [
                    'board' => $board,
                    'score' => 0,
                    'maxTile' => max($board),
                    'type' => $type,
                    'attemptIndex' => $attemptIndex,
                    'rewardedThresholds' => [],
                    'rewardsThisSession' => [],
                    'moveSeq' => 0,
                    'startedAt' => intval(round(microtime(true) * 1000)),
                ];
                $daily['used'] = $attemptIndex;
                $user['game2048_daily'] = json_encode($daily);
                $user['game2048_session'] = json_encode($session);

                if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
                $verify = $this->_verifySaved($user['game2048_session']);

                $debug = [
                    'fn' => 'start', 'uid' => abs(intval($this->registry['uid'])),
                    'time' => date('Y-m-d H:i:s'), 'microtime' => microtime(true),
                    'rawSessionFromDb' => $rawSessionFromDb, 'type' => $type,
                    'attemptIndex' => $attemptIndex, 'daily' => $daily,
                    'sessionSavedRaw' => $user['game2048_session'],
                    'sessionVerifiedFromDbAfterSave' => $verify['raw'],
                    'saveVerifyMismatch' => $verify['mismatch'],
                ];
                error_log('[game2048.start] ' . json_encode($debug)
                    . ($verify['mismatch'] ? ' !!! ЗАПИСАННОЕ И ПРОЧИТАННОЕ ОБРАТНО ЗНАЧЕНИЕ РАЗОШЛИСЬ !!!' : ''));

                $patch = $this->ops->patchCurrencies($user, ['stew', 'stew_spent']);
                $this->ops->ok(['patch' => $patch, 'session' => $session, 'daily' => ['used' => $attemptIndex, 'limit' => self::DAILY_LIMIT], 'debug' => $debug]);
            });
        }

        // dir: left/right/up/down. seq: ожидаемый следующий moveSeq клиента — защита от
        // двойного клика/сетевого ретрая, дублирующего слияние и награду (ТЗ п.9 — "move_seq/
        // version", "идемпотентность повторных запросов"). Несовпавший seq — не ошибка, а
        // просто молчаливый повтор уже применённого ответа (как у dice.php.start() resumed).
        function move(){
            $dir = strval($this->registry['user_params']['dir'] ?? '');
            $seq = intval($this->registry['user_params']['seq'] ?? -1);
            if(!in_array($dir, ['left', 'right', 'up', 'down'], true)) return $this->ops->fail(54);

            $this->_withUserLock(function() use ($dir, $seq){
                $user = $this->ops->loadUser();
                if(!$user) return $this->ops->fail(99);

                $catalog = $this->_catalog();
                $session = $this->_loadSession($user);
                if(!is_array($session)) return $this->ops->fail(68); // нет активной партии

                if($seq !== (intval($session['moveSeq']) + 1)){
                    // Повтор уже применённого хода (или рассинхрон клиента) — отдаём текущее
                    // состояние как есть, НЕ применяя ход повторно.
                    $this->ops->ok(['session' => $session, 'replay' => true]);
                    return;
                }

                list($newBoard, $gained, $changed) = $this->_applyMove($session['board'], $dir);
                if(!$changed){
                    // ТЗ п.2: "Ход, не меняющий поле, не создаёт плитку" — просто подтверждаем
                    // seq, ничего не меняя в поле/наградах.
                    $session['moveSeq'] = $seq;
                    $user['game2048_session'] = json_encode($session);
                    if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
                    $this->ops->ok(['session' => $session, 'changed' => false]);
                    return;
                }

                $session['board'] = $this->_spawnTile($newBoard, $catalog);
                $session['score'] += $gained;
                $session['maxTile'] = max($session['board']);
                $session['moveSeq'] = $seq;

                $granted = $this->_grantNewThresholds($user, $session, $catalog);

                $gameOver = !$this->_hasValidMoves($session['board']);
                if($gameOver) $this->_finalizeGame($user);

                $user['game2048_session'] = $gameOver ? null : json_encode($session);

                if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
                $verify = $this->_verifySaved($user['game2048_session']);

                $debug = [
                    'fn' => 'move', 'uid' => abs(intval($this->registry['uid'])),
                    'time' => date('Y-m-d H:i:s'), 'microtime' => microtime(true),
                    'dir' => $dir, 'seq' => $seq, 'gained' => $gained, 'granted' => $granted,
                    'gameOver' => $gameOver,
                    'sessionSavedRaw' => $user['game2048_session'],
                    'sessionVerifiedFromDbAfterSave' => $verify['raw'],
                    'saveVerifyMismatch' => $verify['mismatch'],
                ];
                error_log('[game2048.move] ' . json_encode($debug)
                    . ($verify['mismatch'] ? ' !!! ЗАПИСАННОЕ И ПРОЧИТАННОЕ ОБРАТНО ЗНАЧЕНИЕ РАЗОШЛИСЬ !!!' : ''));

                $patchKeys = ['exp', 'cigarettes', 'coins', 'coins_earned', 'game2048_fragments',
                    'game2048_lifetime', 'game2048_games_completed', 'game2048_games_completed_at'];
                if(!empty($granted)){
                    $patchKeys[] = 'weapons';
                    foreach($granted as $g) if(in_array($g['type'], ['gun', 'auto'], true)) $patchKeys[] = 'ammo_' . $g['type'];
                }
                $patch = $this->ops->patchCurrencies($user, $patchKeys);
                $this->ops->ok([
                    'patch' => $patch, 'session' => $gameOver ? null : $session,
                    'changed' => true, 'gained' => $gained, 'granted' => $granted,
                    'gameOver' => $gameOver, 'debug' => $debug,
                ]);
            });
        }

        // Добровольное завершение (ТЗ п.2 — "игрок вправе добровольно завершить партию с
        // подтверждением; все уже начисленные награды сохраняются; использованная попытка не
        // возвращается"). Подтверждение — ответственность клиента (попап), сервер просто
        // закрывает активную партию и засчитывает её в вечный ТОП.
        function end(){
            $this->_withUserLock(function(){
                $user = $this->ops->loadUser();
                if(!$user) return $this->ops->fail(99);

                $session = $this->_loadSession($user);
                if(!is_array($session)) return $this->ops->fail(68);

                $this->_finalizeGame($user);
                $user['game2048_session'] = null;

                if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

                $debug = [
                    'fn' => 'end', 'uid' => abs(intval($this->registry['uid'])),
                    'time' => date('Y-m-d H:i:s'), 'microtime' => microtime(true),
                    'finalScore' => $session['score'], 'finalMaxTile' => $session['maxTile'],
                    'gamesCompleted' => $user['game2048_games_completed'],
                ];
                error_log('[game2048.end] ' . json_encode($debug));

                $patch = $this->ops->patchCurrencies($user, ['game2048_games_completed', 'game2048_games_completed_at']);
                $this->ops->ok(['patch' => $patch, 'debug' => $debug]);
            });
        }

        // Атомарное списание 90 фрагментов → предмет. Сам предмет ещё не прислан пользователем
        // (см. дата-комментарий в начале файла) — grantShmotFromSource('game2048') вернёт null,
        // пока в shmot_items.json не появится запись с source:"game2048"; эндпоинт уже полностью
        // рабочий и не потребует правок, когда каталог пополнится.
        function craft(){
            $this->_withUserLock(function(){
                $user = $this->ops->loadUser();
                if(!$user) return $this->ops->fail(99);

                $have = $this->ops->i($user, 'game2048_fragments');
                if($have < self::FRAGMENTS_PER_CRAFT) return $this->ops->fail(71); // недостаточно фрагментов

                $user['game2048_fragments'] = $have - self::FRAGMENTS_PER_CRAFT;
                $itemId = $this->ops->grantShmotFromSource($user, 'game2048');

                if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

                error_log('[game2048.craft] uid=' . abs(intval($this->registry['uid'])) . ' itemId=' . json_encode($itemId));

                $patch = $this->ops->patchCurrencies($user, ['game2048_fragments', 'shmot', 'max_energy']);
                $this->ops->ok(['patch' => $patch, 'itemId' => $itemId, 'itemPending' => $itemId === null]);
            });
        }

        // 27.10.2026 (по прямому указанию — dev-кнопка "обнулить количество попыток на игру
        // 2048"): сбрасывает ТОЛЬКО game2048_daily (used/date) текущего dev-аккаунта, не трогает
        // активную партию (game2048_session) — тот же узкий scope, что
        // bosses.php.devResetDailyLimits().
        function devResetDaily(){
            if(!$this->_requireDevUser()) return;
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);
            $user['game2048_daily'] = json_encode(['date' => $this->ops->mskDailyDate(), 'used' => 0]);
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            return $this->ops->ok(['patch' => $this->ops->patchCurrencies($user, ['game2048_daily'])]);
        }

        // ── Вечный ТОП (ТЗ п.7) — сортировка ТОЛЬКО по числу завершённых партий, тай-брейк —
        // кто раньше достиг этого числа (меньший timestamp), финальный тай-брейк — id. Та же
        // exclusion HIDDEN_FROM_TOP_UID, что top.php (см. reference_list_size_constants —
        // память агента про конвенцию размеров списков этого проекта). ──
        const HIDDEN_FROM_TOP_UID = 1113977365;
        const ROWS_LIMIT = 100; // тот же лимит прокручиваемого списка, что top.php ROWS_LIMIT_SCROLLABLE

        function top(){
            $link = $this->_rawLink();
            if(!$link) return $this->ops->fail(99);

            // СЛЕВА — список СТРОГО с места №2 (ТЗ п.7: "Первого места в левом списке НЕТ").
            $res = $link->query(
                "SELECT id, nick, game2048_games_completed AS c
                 FROM `{$this->registry['utb']}`
                 WHERE id != " . self::HIDDEN_FROM_TOP_UID . " AND game2048_games_completed - 0 > 0
                 ORDER BY game2048_games_completed - 0 DESC, game2048_games_completed_at - 0 ASC, id ASC
                 LIMIT " . (self::ROWS_LIMIT + 1)
            );
            $rows = [];
            if($res) while($row = $res->fetch_assoc()) $rows[] = $row;

            $top1 = $rows[0] ?? null;
            $rest = array_slice($rows, 1);

            $top1Full = null;
            if($top1){
                $full = $link->query(
                    "SELECT id, nick, game2048_games_completed AS c, game2048_lifetime
                     FROM `{$this->registry['utb']}` WHERE id=" . intval($top1['id'])
                )->fetch_assoc();
                $lifetimeRaw = $full['game2048_lifetime'] ?? null;
                $lifetime = is_string($lifetimeRaw) && $lifetimeRaw !== '' ? json_decode($lifetimeRaw, true) : [];
                $top1Full = [
                    'id' => intval($full['id']), 'nick' => strval($full['nick'] ?? ''),
                    'gamesCompleted' => intval($full['c']),
                    'lifetime' => is_array($lifetime) ? $lifetime : [],
                ];
            }

            $link->close();

            $this->ops->ok([
                'top1' => $top1Full,
                'rest' => array_map(function($r){
                    return ['id' => intval($r['id']), 'nick' => strval($r['nick'] ?? ''), 'gamesCompleted' => intval($r['c'])];
                }, $rest),
            ]);
        }
    }
?>
