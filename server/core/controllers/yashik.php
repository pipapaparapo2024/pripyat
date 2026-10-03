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

        // Списывает 1 патрон (bullets) ИЛИ, если патронов нет, bullet_cost_ach очков достижений
        // (та же логика, что было в yashik.js obyskat pointerdown), катает награду и
        // откладывает её в yashik_session — НЕ начисляет сразу (см. collect() ниже).
        function openBox(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);
            $catalog = $this->_catalog();

            $bullets = $this->ops->i($user, 'bullets', 0);
            if($bullets > 0){
                $user['bullets'] = $bullets - 1;
            } else {
                $achCost = intval($catalog['bullet_cost_ach']);
                $ach = $this->ops->i($user, 'ach_score', 0);
                if($ach < $achCost) return $this->ops->fail(70); // нет патрона и не хватает очков достижений
                $user['ach_score'] = $ach - $achCost;
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
            $user['yashik_session'] = json_encode($session);

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
            $pity = $this->ops->j($user, 'lost_stash_pity', []);
            $idx = intval($pity['idx'] ?? 0);
            if($idx < count($sets)){
                if(empty($pity['threshold'])){
                    $pity['threshold'] = rand(intval($catalog['lost_stash_pity_min'] ?? 100), intval($catalog['lost_stash_pity_max'] ?? 150));
                    $pity['count'] = 0;
                }
                $pity['count'] = intval($pity['count'] ?? 0) + 1;

                if($devForceDrops || $pity['count'] >= intval($pity['threshold'])){
                    $shmotArr = $this->_decodeShmot($user);
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
                    $user['shmot'] = json_encode($shmotArr);
                    $this->ops->applyShmotOwnBonus($user, $lostStashItemId);

                    // Переходим к следующему сету только после выдачи руки.
                    if($lostStashItemId === intval($set['hand'])) $idx++;
                    $pity['idx'] = $idx;
                    $pity['count'] = 0;
                    $pity['threshold'] = $idx < count($sets)
                        ? rand(intval($catalog['lost_stash_pity_min'] ?? 100), intval($catalog['lost_stash_pity_max'] ?? 150))
                        : 0;
                }
                $user['lost_stash_pity'] = json_encode($pity);
            }

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            $patch = $this->ops->patchCurrencies($user, ['bullets', 'ach_score', 'shmot', 'lost_stash_pity', 'max_energy']);
            $this->ops->ok(['patch' => $patch, 'reward' => $session, 'lostStashItemId' => $lostStashItemId]);
        }

        // Покупка патрона за тушёнку (кнопка "покупка патрона").
        function buyPatron(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);
            $catalog = $this->_catalog();

            $cost = intval($catalog['patron_cost_stew']);
            $have = $this->ops->i($user, 'stew');
            if($have < $cost){
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
            $this->ops->deduct($user, 'stew', $cost);

            $user['bullets'] = $this->ops->i($user, 'bullets') + 1;

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            $patch = $this->ops->patchCurrencies($user, ['stew', 'bullets']);
            $this->ops->ok(['patch' => $patch]);
        }

        // Игрок нажал ЗАБРАТЬ/крестик — начисляет ранее откатанную openBox() награду. Если
        // вместо этого нажата НАЗАД — collect() никогда не вызывается, yashik_session просто
        // перезатирается следующим openBox() (награда сгорает, как и было у клиента).
        function collect(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $raw = $user['yashik_session'] ?? null;
            $session = is_array($raw) ? $raw : (is_string($raw) && $raw !== '' ? json_decode($raw, true) : null);
            if(!is_array($session)) return $this->ops->fail(72); // нечего забирать (уже забрано или не открывали)

            $this->ops->add($user, 'stash_count', intval($session['stash']));
            $this->ops->add($user, 'cigarettes', intval($session['cig']));
            $this->ops->add($user, 'coins', intval($session['coins']));
            $this->ops->add($user, 'exp', intval($session['exp']));

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
                $shmotArr = $this->_decodeShmot($user);
                while(count($shmotArr) <= $shmotGranted) $shmotArr[] = ['owned' => false, 'equipped' => false];
                $shmotArr[$shmotGranted]['owned'] = true;
                $user['shmot'] = json_encode($shmotArr);
                $this->ops->applyShmotOwnBonus($user, $shmotGranted);
            }

            $user['yashik_session'] = null;

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            $patch = $this->ops->patchCurrencies($user, ['stash_count', 'cigarettes', 'coins', 'exp', 'shmot', 'max_energy']);
            $this->ops->ok(['patch' => $patch, 'reward' => $session, 'shmotGranted' => $shmotGranted]);
        }
    }
?>
