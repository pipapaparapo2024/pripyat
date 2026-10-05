<?php
    // ── SERVER-AUTHORITATIVE ЯЩИК / ЛУТБОКС (18.09.2026, перенос экономики) ──
    //
    // Раньше вся игра — списание патрона (или 50 очков достижений вместо него), покупка
    // патрона за тушёнку, RNG наград (нычки/сигареты/рубли/опыт/7% шанс шмотки) и само
    // начисление — считал клиент (yashik.js._openOtkrytYashik/obyskat pointerdown). Читер мог
    // вызвать эту функцию напрямую из консоли БЕЗ патрона, либо просто присвоить себе
    // сигареты/рубли/опыт напрямую через udata. Теперь: openBox (списывает патрон/очки, катает
    // и ВРЕМЕННО ОТКЛАДЫВАЕТ награду) → collect (начисляет отложенное). Два шага сохраняют
    // оригинальный UX: клиент показывает выпавшую награду ДО начисления, кнопка "НАЗАД" может
    // сжечь её не забрав (collect() просто никогда не вызывается) — то же поведение, что было.
    //
    // yashik_session — служебное поле, НЕ входит в whitelist users.php (как dice_session у
    // Зариков) — клиент физически не может подделать отложенную награду через users.save.
    //
    // Шмотка (7% шанс) — гардероб ещё не перенесён на сервер, поэтому сервер только РЕШАЕТ,
    // какой id предмета выпал (проверяя owned-статус из client-writable udata['shmot'], чтобы
    // не выдать дубликат — тот же уровень доверия, что уже применяется к dvor_games_data.dice.exp
    // в dice.php), а фактическую отметку owned=true клиент делает сам через существующую
    // подсистему shmot.js.
    Class Yashik {
        private $registry, $ops;

        public $permits;

        function __construct($registry){
            $this->registry = $registry;
            $this->ops = new Gameops($registry);
            $this->permits = ['openBox', 'buyPatron', 'collect'];
        }

        private function _catalog(){
            return $this->ops->catalog('yashik_config');
        }

        private function _decodeShmot($user){
            $raw = $user['shmot'] ?? null;
            $data = is_array($raw) ? $raw : (is_string($raw) && $raw !== '' ? json_decode($raw, true) : null);
            return is_array($data) ? $data : [];
        }

        // Отдельное прямое подключение к БД — тот же паттерн, что zone.php/bosses.php._rawLink()
        // (04.10.2026, аудит гонок состояний).
        private function _rawLink(){
            $link = new mysqli($this->registry['server'], $this->registry['user'], $this->registry['pass'], $this->registry['db'], 3306);
            if($link->connect_error) return null;
            $link->set_charset('utf8mb4');
            return $link;
        }

        // Списывает 1 патрон (bullets) ИЛИ, если патронов нет, bullet_cost_ach очков достижений
        // (та же логика, что было в yashik.js obyskat pointerdown), катает награду и
        // откладывает её в yashik_session — НЕ начисляет сразу (см. collect() ниже).
        function openBox(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);
            $catalog = $this->_catalog();
            $uid = intval($this->registry['uid']);

            // 04.10.2026 (аудит гонок состояний): без лока два параллельных клика openBox()
            // могли оба прочитать bullets/ach_score устаревшими, оба пройти проверку и оба
            // списать — лишнее открытие сверх реально доступных попыток, плюс pity-счётчик
            // lost_stash_pity мог потерять инкремент (lost update). Ведём всю бизнес-логику на
            // копии $lockedUser с АКТУАЛЬНЫМИ значениями под SELECT...FOR UPDATE (та же техника,
            // что в habar.php.buy()) — $user[поле] для залоченных колонок остаётся НЕТРОНУТЫМ до
            // конца функции.
            $lockCols = ['bullets', 'ach_score', 'yashik_session', 'lost_stash_pity', 'shmot', 'max_energy'];
            $link = $this->_rawLink();
            $lockedUser = $user;
            if($link){
                $link->begin_transaction();
                $colList = implode(',', array_map(function($c){ return "`$c`"; }, $lockCols));
                $res = $link->query("SELECT $colList FROM `{$this->registry['utb']}` WHERE `id`=$uid FOR UPDATE");
                $row = ($res && $res->num_rows > 0) ? $res->fetch_assoc() : null;
                if($row !== null) $lockedUser = array_merge($lockedUser, $row);
            }

            $bullets = $this->ops->i($lockedUser, 'bullets', 0);
            if($bullets > 0){
                $lockedUser['bullets'] = $bullets - 1;
            } else {
                $achCost = intval($catalog['bullet_cost_ach']);
                $ach = $this->ops->i($lockedUser, 'ach_score', 0);
                if($ach < $achCost){
                    if($link){ $link->rollback(); $link->close(); }
                    return $this->ops->fail(70); // нет патрона и не хватает очков достижений
                }
                $lockedUser['ach_score'] = $ach - $achCost;
            }

            // 22.09.2026 (по прямому указанию — "добавь в dev кнопку которая делает 100% шанс
            // дропа шмоток отовсюду") — личный server-only флаг, форсирует гарантированный дроп
            // ниже (общий пул + Потерянный тайник), только для аккаунта с включённым флагом.
            $devForceDrops = !empty($user['dev_force_drops']);

            $stash = rand(intval($catalog['stash_min']), intval($catalog['stash_max']));
            $cig   = rand(intval($catalog['cig_min']),   intval($catalog['cig_max']));
            $coins = rand(intval($catalog['coins_min']), intval($catalog['coins_max']));
            $exp   = rand(intval($catalog['exp_min']),   intval($catalog['exp_max']));

            // Обычная награда ящика никогда не содержит случайную одежду. Одежда из
            // Потерянного тайника выдаётся только отдельной механикой ниже.
            $shmotId = null;

            $session = ['stash' => $stash, 'cig' => $cig, 'coins' => $coins, 'exp' => $exp, 'shmotId' => $shmotId];
            $lockedUser['yashik_session'] = json_encode($session);

            // Индивидуальный прогресс Потерянного тайника: предмет выдаётся через случайные
            // 100–150 открытий. Сеты не перескакиваются; внутри текущего сета первые четыре
            // предмета выбираются случайно из недостающих, предмет руки выдаётся последним.
            // Server-only поле lost_stash_pity {idx,count,threshold} — НЕ в whitelist
            // users.php, клиент не может подделать прогресс. threshold рождается заново
            // (rand 100-150) при переходе к следующему предмету — у каждого свой случайный
            // порог, не общий счётчик на все 15. Выдаётся СРАЗУ в этом же openBox() (не через
            // yashik_session/collect — редкая награда не должна сгорать от случайного "НАЗАД"
            // после 100+ открытий, в отличие от обычной награды ящика).
            $lostStashItemId = null;
            $sets = $catalog['lost_stash_sets'] ?? [];
            $pity = $this->ops->j($lockedUser, 'lost_stash_pity', []);
            $idx = intval($pity['idx'] ?? 0);
            if($idx < count($sets)){
                if(empty($pity['threshold'])){
                    $pity['threshold'] = rand(intval($catalog['lost_stash_pity_min'] ?? 100), intval($catalog['lost_stash_pity_max'] ?? 150));
                    $pity['count'] = 0;
                }
                $pity['count'] = intval($pity['count'] ?? 0) + 1;

                if($devForceDrops || $pity['count'] >= intval($pity['threshold'])){
                    $shmotArr = $this->_decodeShmot($lockedUser);
                    $set = $sets[$idx];
                    $available = [];
                    foreach(($set['items'] ?? []) as $itemId){
                        $itemId = intval($itemId);
                        if(empty($shmotArr[$itemId]['owned'])) $available[] = $itemId;
                    }
                    $lostStashItemId = !empty($available)
                        ? $available[array_rand($available)]
                        : intval($set['hand']);
                    while(count($shmotArr) <= $lostStashItemId) $shmotArr[] = ['owned' => false, 'equipped' => false];
                    $shmotArr[$lostStashItemId]['owned'] = true;
                    $lockedUser['shmot'] = json_encode($shmotArr);
                    $this->ops->applyShmotOwnBonus($lockedUser, $lostStashItemId);

                    // Переходим к следующему сету только после выдачи руки.
                    if($lostStashItemId === intval($set['hand'])) $idx++;
                    $pity['idx'] = $idx;
                    $pity['count'] = 0;
                    $pity['threshold'] = $idx < count($sets)
                        ? rand(intval($catalog['lost_stash_pity_min'] ?? 100), intval($catalog['lost_stash_pity_max'] ?? 150))
                        : 0;
                }
                $lockedUser['lost_stash_pity'] = json_encode($pity);
            }

            if($link){
                $setsSql = [];
                foreach($lockCols as $c) $setsSql[] = "`$c`='".$link->real_escape_string($lockedUser[$c] ?? '')."'";
                $link->query("UPDATE `{$this->registry['utb']}` SET ".implode(',', $setsSql)." WHERE `id`=$uid");
                $link->commit();
                $link->close();
                // Залоченные поля уже записаны отдельным UPDATE под локом — присвоение в $user
                // переносится ПОСЛЕ saveUser() (тот же принцип, что в weapons.php.buy()).
            } else {
                // Без лока — сохраняем как раньше, обычным $user ДО saveUser() (тот же баг-класс,
                // что уже находили в bosses/weapons/ryukzak/habar).
                foreach($lockCols as $c) $user[$c] = $lockedUser[$c];
            }

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            if($link) foreach($lockCols as $c) $user[$c] = $lockedUser[$c];

            $patch = $this->ops->patchCurrencies($user, ['bullets', 'ach_score', 'shmot', 'lost_stash_pity', 'max_energy']);
            $this->ops->ok(['patch' => $patch, 'reward' => $session, 'lostStashItemId' => $lostStashItemId]);
        }

        // Покупка патрона за тушёнку (кнопка "покупка патрона").
        function buyPatron(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);
            $catalog = $this->_catalog();
            $uid = intval($this->registry['uid']);

            $cost = intval($catalog['patron_cost_stew']);

            // 04.10.2026 (аудит гонок состояний): без лока два параллельных клика buyPatron()
            // могли оба прочитать stew устаревшим, оба пройти проверку и оба списать со своего
            // локального баланса — лишняя покупка патрона проходит бесплатно (lost update). Та
            // же техника $lockedUser, что в openBox() выше.
            $lockCols = ['stew', 'bullets', 'stew_spent'];
            $link = $this->_rawLink();
            $lockedUser = $user;
            if($link){
                $link->begin_transaction();
                $colList = implode(',', array_map(function($c){ return "`$c`"; }, $lockCols));
                $res = $link->query("SELECT $colList FROM `{$this->registry['utb']}` WHERE `id`=$uid FOR UPDATE");
                $row = ($res && $res->num_rows > 0) ? $res->fetch_assoc() : null;
                if($row !== null) $lockedUser = array_merge($lockedUser, $row);
            }

            $have = $this->ops->i($lockedUser, 'stew');
            if($have < $cost){
                if($link){ $link->rollback(); $link->close(); }
                // 24.09.2026 (баг найден по прямому указанию — репорт "ошибка: нужно 50, у меня
                // 104"): раньше клиент при отказе (fail(71), только код ошибки, без данных)
                // сам рисовал текст "Нужно: 50 • У вас: X" из СВОЕГО udata['stew'] — если
                // тушёнка была начислена (донат/достижение) прямо перед кликом и 500мс-дебаунс
                // автосейва ещё не успел долететь до БД, реальный остаток на сервере на момент
                // ИМЕННО ЭТОГО запроса был меньше 50, а клиент показывал число, которому сам
                // верил локально, а не то, что реально видел сервер — отсюда обманчивое
                // "недостаточно, хотя у вас больше". Теперь сервер отдаёт РЕАЛЬНЫЙ остаток
                // (need/have) прямо в ответе ошибки — клиент показывает то, что действительно
                // в БД на момент отказа, а не гадает по локальному состоянию.
                $this->registry['tools']->output(['status'=>'error', 'text'=>'Недостаточно тушёнки!',
                    'code'=>71, 'need'=>$cost, 'have'=>$have]);
                return;
            }
            $this->ops->deduct($lockedUser, 'stew', $cost);
            $lockedUser['bullets'] = $this->ops->i($lockedUser, 'bullets') + 1;

            if($link){
                $sets = [];
                foreach($lockCols as $c) $sets[] = "`$c`='".$link->real_escape_string($lockedUser[$c] ?? '')."'";
                $link->query("UPDATE `{$this->registry['utb']}` SET ".implode(',', $sets)." WHERE `id`=$uid");
                $link->commit();
                $link->close();
            } else {
                foreach($lockCols as $c) $user[$c] = $lockedUser[$c];
            }

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            if($link) foreach($lockCols as $c) $user[$c] = $lockedUser[$c];

            $patch = $this->ops->patchCurrencies($user, ['stew', 'bullets']);
            $this->ops->ok(['patch' => $patch]);
        }

        // Игрок нажал ЗАБРАТЬ/крестик — начисляет ранее откатанную openBox() награду. Если
        // вместо этого нажата НАЗАД — collect() никогда не вызывается, yashik_session просто
        // перезатирается следующим openBox() (награда сгорает, как и было у клиента).
        function collect(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);
            $uid = intval($this->registry['uid']);

            // 04.10.2026 (аудит гонок состояний — САМЫЙ серьёзный риск этого файла): без лока
            // два параллельных клика collect() могли оба прочитать ОДНУ И ТУ ЖЕ отложенную
            // yashik_session, оба пройти проверку "есть что забрать" и оба начислить
            // stash/cig/coins/exp/shmot — то есть игрок получал бы НАГРАДУ ДВАЖДЫ за один
            // открытый ящик (двойная трата одной и той же сессии). Ведём всю бизнес-логику на
            // копии $lockedUser с АКТУАЛЬНЫМИ значениями под SELECT...FOR UPDATE — та же
            // техника, что в openBox()/buyPatron() выше.
            $lockCols = ['stash_count', 'cigarettes', 'coins', 'exp', 'shmot', 'yashik_session', 'max_energy'];
            $link = $this->_rawLink();
            $lockedUser = $user;
            if($link){
                $link->begin_transaction();
                $colList = implode(',', array_map(function($c){ return "`$c`"; }, $lockCols));
                $res = $link->query("SELECT $colList FROM `{$this->registry['utb']}` WHERE `id`=$uid FOR UPDATE");
                $row = ($res && $res->num_rows > 0) ? $res->fetch_assoc() : null;
                if($row !== null) $lockedUser = array_merge($lockedUser, $row);
            }

            $raw = $lockedUser['yashik_session'] ?? null;
            $session = is_array($raw) ? $raw : (is_string($raw) && $raw !== '' ? json_decode($raw, true) : null);
            if(!is_array($session)){
                if($link){ $link->rollback(); $link->close(); }
                return $this->ops->fail(72); // нечего забирать (уже забрано или не открывали)
            }

            $this->ops->add($lockedUser, 'stash_count', intval($session['stash']));
            $this->ops->add($lockedUser, 'cigarettes', intval($session['cig']));
            $this->ops->add($lockedUser, 'coins', intval($session['coins']));
            $this->ops->add($lockedUser, 'exp', intval($session['exp']));

            $shmotGranted = isset($session['shmotId']) && $session['shmotId'] !== null ? intval($session['shmotId']) : null;

            // 22.09.2026 (баг найден по прямому указанию — "всё что делаешь сразу делай на
            // сервер, чтобы потом не перекидывали логику с JS на сервер"): раньше сервер только
            // РЕШАЛ, какой id выпал (shmotGranted), а отметку owned=true в БД делал клиент сам
            // через shmot.js._saveToUdata() → users.save() — но _sanitizeShmot() там запрещает
            // именно owned:false→true (анти-чит, см. users.php), так что легитимная выдача
            // тихо отклонялась тем же самым guard'ом, который должен защищать от подделки.
            // Пишем владение здесь напрямую через Gameops::saveUser() (полная строка, в обход
            // whitelist) — тот же паттерн, что уже применяется в bosses.php.claimKill().
            if($shmotGranted !== null){
                $shmotArr = $this->_decodeShmot($lockedUser);
                while(count($shmotArr) <= $shmotGranted) $shmotArr[] = ['owned' => false, 'equipped' => false];
                $shmotArr[$shmotGranted]['owned'] = true;
                $lockedUser['shmot'] = json_encode($shmotArr);
                $this->ops->applyShmotOwnBonus($lockedUser, $shmotGranted);
            }

            $lockedUser['yashik_session'] = null;

            if($link){
                $sets = [];
                foreach($lockCols as $c) $sets[] = "`$c`='".$link->real_escape_string($lockedUser[$c] ?? '')."'";
                $link->query("UPDATE `{$this->registry['utb']}` SET ".implode(',', $sets)." WHERE `id`=$uid");
                $link->commit();
                $link->close();
            } else {
                foreach($lockCols as $c) $user[$c] = $lockedUser[$c];
            }

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            if($link) foreach($lockCols as $c) $user[$c] = $lockedUser[$c];

            $patch = $this->ops->patchCurrencies($user, ['stash_count', 'cigarettes', 'coins', 'exp', 'shmot', 'max_energy']);
            $this->ops->ok(['patch' => $patch, 'reward' => $session, 'shmotGranted' => $shmotGranted]);
        }
    }
?>
