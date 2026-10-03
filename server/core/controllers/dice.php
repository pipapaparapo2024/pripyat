<?php
    // ── SERVER-AUTHORITATIVE ЗАРИКИ (18.09.2026, перенос экономики — Казино, игра 1/5) ──
    //
    // Раньше ВСЯ игра (RNG бросков, скрытый pity-счётчик до гарантированного 4×6, начисление
    // награды) считалась на клиенте (dvor-dice-game.js) — читер мог форсировать джекпот, поменяв
    // udata['dvor_games_data'].dice.pity через консоль, либо просто вызвать _give('cig', 999999)
    // напрямую. Теперь: бросок/переброс/итог — три отдельных запроса, RNG и выплата — только
    // здесь. Состояние текущего броска хранится в dice_session — ЭТО ПОЛЕ СОЗНАТЕЛЬНО НЕ В
    // whitelist users.php (как roulette_cups у Roulette) — клиент физически не может отправить/
    // подделать его через users.save, читает и пишет только сервер напрямую через
    // Gameops::loadUser()/saveUser().
    //
    // Уровень зариков (udata['dvor_games_data'].dice.exp, отсюда — кол-во доступных перебросов)
    // остаётся client-writable — ниже риска, чем сам RNG/выплата (даёт лишний шанс перебросить
    // кость, не создаёт валюту напрямую), не в фокусе этого шага.
    //
    // Награды типа shmot/auto/gun/machete возвращаются клиенту как clientRewards — эти
    // подсистемы (гардероб/оружие) ещё не перенесены на сервер, применяются как раньше через
    // shmot.giveRandom()/weapons.grantAmmo() на клиенте.
    //
    // 23.09.2026 (по прямому указанию, после находки похожего репорта в блэкджеке — "выпала AA
    // хотя pity ещё далеко", там пока не найдена — на всякий случай тот же класс максимального
    // логирования добавлен и сюда, ПРЕВЕНТИВНО, конкретного бага здесь не репортили): та же
    // схема, что в blackjack.php — error_log (Правило №8) + поле debug в каждом ответе, клиент
    // печатает его в консоль (см. dvor-dice-*.js).
    //
    // 02.10.2026 (по прямому указанию, после находки при разборе полного прогона tests/: v551
    // заменил pity-счётчик + гарантированный джекпот 4×6 на die_weights + _reducePremiumRoll()
    // без дата-комментария, объясняющего замену — найдено прямое противоречие со старым
    // комментарием 29.09.2026 про "аннулирование" в resolve(), которого в коде уже не было):
    // подтверждено пользователем — это ОСОЗНАННАЯ замена, не регрессия. Pity-счётчик и джекпот
    // 4×6 как отдельная гарантированная награда больше НЕ существуют — dice_session не хранит
    // pity/pity_t, и это согласуется с тем, что панель "До Куша" была убрана из HUD ещё
    // 27.09.2026 (см. dvor-dice-screen.js — она уже тогда перестала иметь смысл). Текущая
    // механика — вероятностная: die_weights (веса граней костей, см. _weightedDie()) снижают
    // шанс граней 5/6, а _reducePremiumRoll() (см. ниже) добавляет 10%-й шанс полностью
    // переброcить уже выпавшую ЦЕННУЮ (coins/shmot, 4 строки из 18 в catalog['table'])
    // комбинацию ДО показа игроку — применяется и в start(), и в reroll(). Остальные 14 строк
    // таблицы (cig/exp/auto/gun/machete) этим снижением НЕ затронуты — подтверждено пользователем
    // как осознанное сужение буквального текста запроса 29.09.2026 ("уменьши ВСЕ комбинации").
    // Докидать джекпот 4×6 переброском теперь МОЖНО (90% шанс, что доброшенный результат
    // останется) — прежний хард-блок (othersAll6) снят и сознательно не восстанавливается.
    Class Dice {
        private $registry, $ops;

        public $permits;

        function __construct($registry){
            $this->registry = $registry;
            $this->ops = new Gameops($registry);
            $this->permits = ['start', 'reroll', 'resolve', 'getSession', 'buyPoints'];
        }

        // 25.09.2026 (по прямому указанию — "выбор сбрасывается при смене вкладки/перезагрузке,
        // игра уничтожается"): бросок уже писался в dice_session на сервере, но клиент никогда
        // не читал его обратно при повторном открытии экрана — только держал в JS-полях
        // (this._diceState и т.п.), обнуляемых при пересоздании объекта Dvor (перезагрузка/новая
        // вкладка). Без побочных эффектов — не списывает валюту, не трогает сессию.
        function getSession(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);
            $session = $this->_loadSession($user);
            $active = $session['active'] ?? null;
            if(!is_array($active)){
                $this->ops->ok(['active' => false]);
                return;
            }
            $this->ops->ok([
                'active' => true,
                'rolls' => $active['rolls'],
                'swapsUsed' => intval($active['swapsUsed']),
                'swapsAllowed' => intval($active['swapsAllowed']),
                'forced' => false,
            ]);
        }

        // 26.09.2026 (по прямому указанию — аудит "покупка поинтов зариков/рулетки за рубли
        // напрямую вызывает users.save"): dvor-dice-screen.js.buyDicePoints() и
        // dvor-roulette-buy.js.buyBluePoints() и раньше уже писали coins/dice_points/blue_points
        // ОПТИМИСТИЧНО на клиенте (с откатом при сетевой ошибке), но реальное сохранение шло
        // через общий whitelist-эндпоинт users.save — сервер верил присланным числам целиком
        // (в пределах общего потолка 100 млн), читер мог себе накрутить любое количество поинтов
        // без реальной траты рублей, просто отредактировав udata перед вызовом. Таблица цены/
        // количества (те же 6 пакетов, что уже отрисованы в PKGS на клиенте) перенесена в
        // dice_config.json → buy_points[] — единственный источник истины для цены, клиентский
        // массив используется только для отрисовки карточек. pkg_idx — индекс строки (0-5),
        // приходит от клиента как PKGS.indexOf(pkg) — сам индекс не секрет (пакет всё равно
        // виден на кнопке), подделать можно только сам факт списания/начисления, а его теперь
        // делает исключительно сервер.
        function buyPoints(){
            $idx = intval($this->registry['user_params']['pkg_idx'] ?? -1);
            $catalog = $this->_catalog();
            $table = isset($catalog['buy_points']) && is_array($catalog['buy_points']) ? $catalog['buy_points'] : [];
            if($idx < 0 || $idx >= count($table)) return $this->ops->fail(54); // некорректный индекс пакета

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $pkg = $table[$idx];
            $price = intval($pkg['price']);
            $pts = intval($pkg['pts']);

            if(!$this->ops->deduct($user, 'coins', $price)) return $this->ops->fail(50); // недостаточно рублей
            $this->ops->add($user, 'dice_points', $pts);

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            $debug = ['fn' => 'buyPoints', 'uid' => abs(intval($this->registry['uid'])),
                'time' => date('Y-m-d H:i:s'), 'microtime' => microtime(true),
                'pkg_idx' => $idx, 'price' => $price, 'pts' => $pts];
            error_log('[dice.buyPoints] ' . json_encode($debug));

            $patch = $this->ops->patchCurrencies($user, ['coins', 'dice_points']);
            $this->ops->ok(['patch' => $patch, 'pts' => $pts, 'price' => $price, 'debug' => $debug]);
        }

        private function _catalog(){
            return $this->ops->catalog('dice_config');
        }

        private function _loadSession($user){
            $raw = $user['dice_session'] ?? null;
            $data = is_array($raw) ? $raw : (is_string($raw) && $raw !== '' ? json_decode($raw, true) : null);
            if(!is_array($data)) $data = [];
            return $data;
        }

        // 23.09.2026: перечитывает dice_session ЗАНОВО из БД после saveUser() — верификация
        // "записанное === прочитанное обратно", тот же приём, что в blackjack.php.
        // 25.09.2026 (тот же баг-класс, найден и исправлен в poker.php — см. большой комментарий
        // там же): !== между JSON-строкой ($expectedRaw) и уже раскодированным trueJSON()
        // PHP-массивом ($verifyRaw) ВСЕГДА даёт ложное расхождение, независимо от реальных
        // данных. Переведено на Gameops::sameJsonState() (та же функция, что уже использует
        // blackjack.php).
        private function _verifySaved($expectedRaw){
            $verifyUser = $this->ops->loadUser(['id', 'dice_session']);
            $verifyRaw  = $verifyUser ? ($verifyUser['dice_session'] ?? null) : '!!! loadUser() ПОСЛЕ save вернул null !!!';
            return ['raw' => $verifyRaw, 'mismatch' => !$this->ops->sameJsonState($expectedRaw, $verifyRaw)];
        }

        // Уровень зариков — та же формула, что Dvor._simpleLevelInfo() (dvor.js): floor(exp/10),
        // максимум 100. Кол-во доступных перебросов — swaps_by_level каталога (первая строка,
        // чей min_level удовлетворён), совпадает с bosses-combat.js._getDiceSwapsAllowed().
        // 21.09.2026 (по прямому указанию, разбор экономического риска зариков) — раньше каждая
        // кость была честным rand(1,6) — 1/6 (≈16.7%) на грань, и ПЕРЕБРОС (см. reroll() ниже)
        // тоже был честным rand(1,6). Проблема: игрок с прицельными перебросами (до 3 доступных)
        // добивает себе именно 5/6 заметно надёжнее, чем 1.5%-шанс "3 шестёрки одним броском" —
        // и такие комбинации (3×6=100₽, 4×5=50₽) при этом самые дорогие. Награды/лимит
        // перебросов трогать явно попросили не трогать — вместо этого снижаем вероятность
        // ВЫПАДЕНИЯ именно граней 5 и 6 (и на первом броске, и на каждом переброс — раз проблема
        // именно в перебросах) через die_weights каталога: [1,2,3,4,5,6] → веса из 100, сумма
        // ровно 100. Дефолт [19,19,19,19,12,12] — 5/6 снижены с 16.7% до 12% (лишние 9.34 п.п.
        // поровну ушли на грани 1-4), заметно режет вероятность именно "3+ одинаковых 5/6", не
        // трогая ни таблицу наград, ни лимит перебросов. {6,n:4} (шмотка, джекпот 4×6)
        // теоретически достижима честным путём — веса не делают её невозможной, просто редкой.
        // 02.10.2026: прежний хард-блок "нельзя докидать джекпот переброском" (othersAll6) и
        // резервирование этой строки за pity-гарантией убраны вместе со всей pity-системой —
        // осталась только та же вероятностная защита, что у остальных премиальных комбинаций
        // (см. _reducePremiumRoll() ниже).
        // 23.09.2026: &$trace — по ссылке, копит лог каждого броска (для debug-ответа).
        private function _weightedDie($catalog, &$trace = null){
            $weights = isset($catalog['die_weights']) && is_array($catalog['die_weights']) && count($catalog['die_weights']) === 6
                ? $catalog['die_weights'] : [1,1,1,1,1,1]; // фолбэк — честный кубик, если каталог не задан/повреждён
            $total = array_sum($weights);
            if($total <= 0){ if($trace !== null) $trace[] = 'total<=0, fallback rand(1,6)'; return rand(1, 6); }
            $roll = mt_rand(1, $total);
            $cum = 0;
            foreach($weights as $i => $w){
                $cum += intval($w);
                if($roll <= $cum){
                    if($trace !== null) $trace[] = "roll=$roll/total=$total weights=" . json_encode($weights) . " → value=" . ($i+1);
                    return $i + 1;
                }
            }
            if($trace !== null) $trace[] = "roll=$roll/total=$total weights=" . json_encode($weights) . " → ФОЛБЭК value=6 (округление)";
            return 6; // защита от ошибок округления — сюда не доходит при корректной сумме весов
        }

        private function _swapsAllowed($user, $catalog){
            $dvorData = $this->ops->j($user, 'dvor_games_data', []);
            $exp = intval($dvorData['dice']['exp'] ?? 0);
            $level = min(100, intval(floor($exp / 10)));
            foreach($catalog['swaps_by_level'] as $row){
                if($level >= intval($row['min_level'])) return intval($row['swaps']);
            }
            return 0;
        }

        private function _isPremiumCombination($rolls, $catalog){
            $counts = [];
            foreach($rolls as $roll) $counts[intval($roll)] = ($counts[intval($roll)] ?? 0) + 1;
            foreach(($catalog['table'] ?? []) as $row){
                if(($row['type'] ?? '') !== 'coins' && ($row['type'] ?? '') !== 'shmot') continue;
                if(($counts[intval($row['v'])] ?? 0) >= intval($row['n'])) return true;
            }
            return false;
        }

        // 02.10.2026 (по прямому указанию — закрытие вопроса из старого запроса 29.09.2026
        // "уменьши вероятность выпадения ВСЕХ комбинаций на 10%"): сознательно сужено до
        // ценных комбинаций ТОЛЬКО coins/shmot (4 строки из 18 в catalog['table'], см.
        // _isPremiumCombination выше) — остальные 14 (cig/exp/auto/gun/machete) этим снижением
        // НЕ затронуты, это подтверждённое решение, не недосмотр. Шанс уменьшается ДО показа
        // костей игроку (в start()/reroll(), не в resolve()) — поэтому resolve() никогда не
        // отбирает уже показанную награду.
        private function _reducePremiumRoll($rolls, $catalog, &$trace){
            if(!$this->_isPremiumCombination($rolls, $catalog) || mt_rand(1, 100) > 10) return $rolls;
            $trace[] = 'premium outcome rerolled before display (x0.9)';
            do {
                $rolls = [
                    $this->_weightedDie($catalog, $trace), $this->_weightedDie($catalog, $trace),
                    $this->_weightedDie($catalog, $trace), $this->_weightedDie($catalog, $trace),
                ];
            } while($this->_isPremiumCombination($rolls, $catalog));
            return $rolls;
        }

        // Начало новой партии: проверяет/списывает стоимость (бесплатный ежедневный бросок ИЛИ
        // 1 красный поинт), бросает 4 взвешенных кубика (см. _weightedDie()/_reducePremiumRoll(),
        // pity-гарантии больше нет — см. дата-комментарий 02.10.2026 в начале файла), сохраняет
        // как активную сессию. dice_free_ts обновляет ТОЛЬКО сервер (единственный легитимный
        // писатель после переноса — раньше клиент сам ставил timestamp и мог просто обнулить его
        // консолью, получая бесплатные броски бесконечно).
        function start(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $rawSessionFromDb = isset($user['dice_session']) ? $user['dice_session'] : null;

            $catalog = $this->_catalog();
            $session = $this->_loadSession($user);

            // 25.09.2026 (по прямому указанию, фикс "выбор сбрасывается при смене вкладки/
            // перезагрузке, игра уничтожается"): та же идемпотентность, что у poker.php.deal() и
            // bosses.php.startFight() — если бросок уже активен, просто возвращаем его же, ничего
            // не списывая и не перебрасывая заново.
            if(is_array($session['active'] ?? null)){
                $active = $session['active'];
                $patch = $this->ops->patchCurrencies($user, ['dice_points', 'dice_free_ts']);
                $this->ops->ok([
                    'patch' => $patch,
                    'rolls' => $active['rolls'],
                    'swapsAllowed' => intval($active['swapsAllowed']),
                    'swapsUsed' => intval($active['swapsUsed']),
                    'resumed' => true,
                ]);
                return;
            }

            $now = intval(round(microtime(true) * 1000));
            $lastFree = $this->ops->i($user, 'dice_free_ts', 0);
            $freeAvailable = !$lastFree || ($now - $lastFree) >= intval($catalog['free_cooldown_ms']);

            if($freeAvailable){
                $user['dice_free_ts'] = $now;
            } else {
                if(!$this->ops->deduct($user, 'dice_points', 1)) return $this->ops->fail(67); // недостаточно красных поинтов
            }

            // 4×6 — только естественный результат четырёх взвешенных бросков, без pity.
            $forced = false;
            $rollTrace = [];
            // 25.09.2026 (по прямому указанию — "хочу тестировать все комбинации зариков"):
            // dev_force_dice — личный одноразовый флаг (dev-панель, users.setDevCombo), хранит
            // ИНДЕКС строки в catalog['table'] (0-17, тот же порядок, что DICE_ROW_Y на клиенте).
            // Гасится сразу — форсирует ИМЕННО этот бросок этого игрока, не трогает ничего общего
            // (02.10.2026: раньше здесь была оговорка про "общий pity-счётчик", pity-системы с
            // тех пор не существует вообще — см. дата-комментарий в начале файла). НЕ помечаем
            // как $forced=true ($forced больше ничего не означает, оставлен константой false ниже
            // как заглушка под старый формат ответа) — обычный табличный проход в resolve() и так
            // честно засчитает нужную строку по факту count(value)>=n, спецветка не нужна.
            // ВАЖНО: intval('') === 0 — тот же индекс, что и валидная строка "4×6" (idx 0),
            // поэтому нельзя читать через Gameops::i() (она вернула бы 0 для дефолтного пустого
            // поля, форся 4×6 КАЖДОМУ игроку на КАЖДОМ броске). Проверяем именно пустую строку.
            $devForceDiceRaw = isset($user['dev_force_dice']) ? strval($user['dev_force_dice']) : '';
            $devForceRow = null;
            if($devForceDiceRaw !== ''){
                $devForceIdx = intval($devForceDiceRaw);
                if(isset($catalog['table'][$devForceIdx])) $devForceRow = $catalog['table'][$devForceIdx];
            }
            if($devForceRow){
                $user['dev_force_dice'] = '';
                $v = intval($devForceRow['v']); $n = intval($devForceRow['n']);
                $fillerPool = array_values(array_diff([1,2,3,4,5,6], [$v]));
                shuffle($fillerPool);
                $rolls = array_fill(0, $n, $v);
                for($f = 0; $f < 4 - $n; $f++) $rolls[] = $fillerPool[$f % count($fillerPool)];
                shuffle($rolls);
                $rollTrace[] = "DEV FORCE idx=$devForceIdx → v=$v n=$n rolls=" . json_encode($rolls);
            } else {
                $rolls = [
                    $this->_weightedDie($catalog, $rollTrace),
                    $this->_weightedDie($catalog, $rollTrace),
                    $this->_weightedDie($catalog, $rollTrace),
                    $this->_weightedDie($catalog, $rollTrace),
                ];
                $rolls = $this->_reducePremiumRoll($rolls, $catalog, $rollTrace);
            }

            $swapsAllowed = $this->_swapsAllowed($user, $catalog);
            $session['active'] = [
                'rolls'        => $rolls,
                'swapsUsed'    => 0,
                'swapsAllowed' => $swapsAllowed,
                'forced'       => $forced,
            ];
            $user['dice_session'] = json_encode($session);

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            $verify = $this->_verifySaved($user['dice_session']);

            $debug = [
                'fn' => 'start', 'uid' => abs(intval($this->registry['uid'])),
                'time' => date('Y-m-d H:i:s'), 'microtime' => microtime(true),
                'rawParams' => $this->registry['user_params'],
                'rawSessionFromDb' => $rawSessionFromDb,
                'catalogFull' => $catalog,
                'forced' => false,
                'freeAvailable' => $freeAvailable,
                'rollTrace' => $rollTrace,
                'rolls' => $rolls, 'swapsAllowed' => $swapsAllowed,
                'sessionSavedRaw' => $user['dice_session'],
                'sessionVerifiedFromDbAfterSave' => $verify['raw'],
                'saveVerifyMismatch' => $verify['mismatch'],
            ];
            error_log('[dice.start] ' . json_encode($debug)
                . ($verify['mismatch'] ? ' !!! ЗАПИСАННОЕ И ПРОЧИТАННОЕ ОБРАТНО ЗНАЧЕНИЕ РАЗОШЛИСЬ !!!' : ''));

            $patch = $this->ops->patchCurrencies($user, ['dice_points', 'dice_free_ts']);
            $this->ops->ok(['patch' => $patch, 'rolls' => $rolls, 'swapsAllowed' => $swapsAllowed, 'swapsUsed' => 0, 'debug' => $debug]);
        }

        // Перебрасывает ОДНУ кость (idx 0-3). Докинуть джекпот 4×6 переброском МОЖНО — старый
        // хард-блок (othersAll6: докинутая 4×6 перебрасывалась заново, пока не получался другой
        // результат) снят 02.10.2026 по прямому указанию вместе со всей pity-системой; единственная
        // защита, применяемая и здесь — та же вероятностная _reducePremiumRoll() (10% переброса
        // для coins/shmot-комбинаций), что и в start().
        function reroll(){
            $idx = intval($this->registry['user_params']['idx'] ?? -1);
            if($idx < 0 || $idx > 3) return $this->ops->fail(54);

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $rawSessionFromDb = isset($user['dice_session']) ? $user['dice_session'] : null;

            $catalog = $this->_catalog();
            $session = $this->_loadSession($user);
            $active  = $session['active'] ?? null;
            if(!is_array($active)) return $this->ops->fail(68); // нет активного броска — start не вызывался или уже resolve'нут

            if(intval($active['swapsUsed']) >= intval($active['swapsAllowed'])) return $this->ops->fail(69); // заряды переброса кончились

            $rollsBefore = $active['rolls'];
            $rollTrace = [];
            $v = $this->_weightedDie($catalog, $rollTrace);

            $active['rolls'][$idx] = $v;
            $active['rolls'] = $this->_reducePremiumRoll($active['rolls'], $catalog, $rollTrace);
            $v = $active['rolls'][$idx];
            $active['swapsUsed']   = intval($active['swapsUsed']) + 1;
            $session['active']     = $active;
            $user['dice_session']  = json_encode($session);
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            $verify = $this->_verifySaved($user['dice_session']);

            $debug = [
                'fn' => 'reroll', 'uid' => abs(intval($this->registry['uid'])),
                'time' => date('Y-m-d H:i:s'), 'microtime' => microtime(true),
                'idx' => $idx, 'rawParams' => $this->registry['user_params'],
                'rawSessionFromDb' => $rawSessionFromDb, 'catalogFull' => $catalog,
                'rollsBefore' => $rollsBefore, 'forced' => (bool)$active['forced'],
                'rollTrace' => $rollTrace, 'newValue' => $v,
                'rollsAfter' => $active['rolls'],
                'sessionSavedRaw' => $user['dice_session'],
                'sessionVerifiedFromDbAfterSave' => $verify['raw'],
                'saveVerifyMismatch' => $verify['mismatch'],
            ];
            error_log('[dice.reroll] ' . json_encode($debug)
                . ($verify['mismatch'] ? ' !!! ЗАПИСАННОЕ И ПРОЧИТАННОЕ ОБРАТНО ЗНАЧЕНИЕ РАЗОШЛИСЬ !!!' : ''));

            $this->ops->ok(['value' => $v, 'swapsUsed' => $active['swapsUsed'], 'rolls' => $active['rolls'], 'debug' => $debug]);
        }

        // Итог партии: считает награду по итоговым костям (та же таблица и то же правило "за
        // КАЖДОЕ значение, набравшее пару и более, отдельная награда" — с 4 костями максимум
        // 2 одновременных пары, см. dvor-dice-game.js._resolveDiceNewScreen), применяет валюту,
        // закрывает активную сессию.
        function resolve(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $rawSessionFromDb = isset($user['dice_session']) ? $user['dice_session'] : null;

            $catalog = $this->_catalog();
            $session = $this->_loadSession($user);
            $active  = $session['active'] ?? null;
            if(!is_array($active)) return $this->ops->fail(68); // нет активного броска

            $rolls  = array_map('intval', $active['rolls']);
            $forced = false;
            $session['active'] = null;
            $user['dice_session'] = json_encode($session);

            $clientRewards = []; $shmotGranted = [];
            $applyCurrency = function($type, $amt) use (&$user, &$clientRewards, &$shmotGranted){
                $amt = intval($amt);
                switch($type){
                    case 'cig': $this->ops->add($user, 'cigarettes', $amt); break;
                    case 'exp':
                        $this->ops->add($user, 'exp', $amt);
                        // battlepass.addXp() — отдельная, ещё не перенесённая система; клиент
                        // применяет её сам по этой подсказке (та же формула, что Dvor._give('exp',...)).
                        $clientRewards[] = ['type' => 'battlepass_xp', 'amt' => max(1, intval(floor($amt / 100)))];
                        break;
                    case 'coins':
                        $this->ops->add($user, 'coins', $amt);
                        $user['coins_earned'] = $this->ops->i($user, 'coins_earned') + $amt;
                        break;
                    case 'red_points': $this->ops->add($user, 'dice_points', $amt); break;
                    case 'shmot':
                        for($i = 0; $i < $amt; $i++){
                            $id = $this->ops->grantShmotFromSource($user, 'dice');
                            if($id !== null) $shmotGranted[] = $id;
                        }
                        break;
                    default:
                        // Оружейные награды пока не имеют серверного инвентаря.
                        $clientRewards[] = ['type' => $type, 'amt' => $amt];
                }
            };

            $rewards = [];
            $tableTrace = [];
            {
                $cnt = [];
                foreach($rolls as $r) $cnt[$r] = ($cnt[$r] ?? 0) + 1;

                $takenValues = [];
                $matchedRows = [];
                foreach($catalog['table'] as $row){
                    $have = $cnt[$row['v']] ?? 0;
                    $enough = $have >= $row['n'];
                    $already = in_array($row['v'], $takenValues, true);
                    $tableTrace[] = "v={$row['v']} n={$row['n']} have=$have enough=" . ($enough?'1':'0') . " alreadyTaken=" . ($already?'1':'0');
                    if(!$enough) continue;
                    if($already) continue;
                    $takenValues[] = $row['v'];
                    $matchedRows[] = $row;
                }

                // 02.10.2026 (по прямому указанию — уточнение после находки устаревшего
                // комментария): здесь никакого "аннулирования после розыгрыша" больше нет —
                // снижение шанса премиальных (coins/shmot) комбинаций на 10% переехало ДО этой
                // точки, в _reducePremiumRoll() (вызывается из start()/reroll(), см. выше) —
                // resolve() просто честно читает уже окончательные $rolls, пришедшие из
                // dice_session. matchedRows ниже — обычное сопоставление с таблицей, без
                // дополнительной вероятностной правки.
                foreach($matchedRows as $row){
                    $applyCurrency($row['type'], $row['amt']);
                    $rewards[] = $row;
                }
                if(empty($rewards)){
                    $applyCurrency($catalog['consolation']['type'], $catalog['consolation']['amt']);
                    $rewards[] = $catalog['consolation'];
                }
            }

            $user['dvor_games'] = $this->ops->i($user, 'dvor_games') + 1;

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            $verify = $this->_verifySaved($user['dice_session']);

            $debug = [
                'fn' => 'resolve', 'uid' => abs(intval($this->registry['uid'])),
                'time' => date('Y-m-d H:i:s'), 'microtime' => microtime(true),
                'rawSessionFromDb' => $rawSessionFromDb, 'catalogFull' => $catalog,
                'rolls' => $rolls, 'forced' => false,
                'tableTrace' => $tableTrace, 'rewards' => $rewards,
                'sessionSavedRaw' => $user['dice_session'],
                'sessionVerifiedFromDbAfterSave' => $verify['raw'],
                'saveVerifyMismatch' => $verify['mismatch'],
            ];
            error_log('[dice.resolve] ' . json_encode($debug)
                . ($verify['mismatch'] ? ' !!! ЗАПИСАННОЕ И ПРОЧИТАННОЕ ОБРАТНО ЗНАЧЕНИЕ РАЗОШЛИСЬ !!!' : ''));

            $patch = $this->ops->patchCurrencies($user, ['cigarettes', 'coins', 'coins_earned', 'exp', 'dice_points', 'dvor_games', 'shmot', 'max_energy']);
            $this->ops->ok([
                'patch' => $patch, 'rolls' => $rolls, 'forced' => $forced,
                'rewards' => $rewards, 'clientRewards' => $clientRewards,
                'shmotGranted' => $shmotGranted,
                'debug' => $debug,
            ]);
        }
    }
?>
