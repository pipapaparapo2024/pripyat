<?php
    // ── SERVER-AUTHORITATIVE ЕЖЕДНЕВНЫЕ ЗАДАНИЯ (23.09.2026, перенос экономики) ──
    //
    // Раньше генерация задания (какие 3 дневных / 1 недельное / 1 особое достались игроку),
    // прогресс (сверка need/prog) и сама выдача награды считались ЦЕЛИКОМ на клиенте
    // (zadaniya.js) — udata['zadaniya'] был client-writable (аудит безопасности 18.09.2026 уже
    // удалил его из whitelist users.php именно по этой причине, см. комментарий там же), читер
    // мог одним users.save выставить себе {prog:99999,need:1,reward_val:99999} и забрать любую
    // награду в обход всей проверки. Более того, client-side claim() применял награду
    // ОПТИМИСТИЧНО (udata[...] += reward_val) ДО ответа сервера — а старый tasks.claim() ждал
    // от udata['zadaniya'] поля reward_type/reward_val/prog/need, которые клиент на самом деле
    // никогда туда не сохранял (_saveToUdata() писал только {id,type,claimed}) — эндпоинт
    // молча всегда проваливался, вся "выдача" по факту шла мимо сервера.
    //
    // Теперь: выбор заданий на сегодня, прогресс и выдача награды — только здесь. Активный
    // набор заданий на сегодня хранится в zadaniya_session — ЭТО ПОЛЕ СОЗНАТЕЛЬНО НЕ В
    // whitelist users.php (как dice_session/poker_session) — клиент физически не может
    // подделать его через users.save.
    //
    // BETA_LOCKED: раздел ещё не готов к бета-тесту (UI-кнопка уже убрана из HUD 22.09.2026,
    // см. interface-panels.js) — блокируем здесь тоже, чтобы вызов напрямую из консоли (мимо
    // отсутствующей кнопки) тоже ничего не давал. Убрать одной строкой, когда раздел будет
    // готов к запуску — клиент (zadaniya.js) уже переписан на этот API и заработает сразу.
    Class Tasks {
        private $registry, $ops;
        private $BETA_LOCKED = true;

        public $permits;

        function __construct($registry){
            $this->registry = $registry;
            $this->ops = new Gameops($registry);
            $this->permits = ['getTasks', 'claim'];
        }

        private function _catalog(){
            return $this->ops->catalog('zadaniya_config');
        }

        // Прогресс задания читается НАПРЯМУЮ из полей $user (те же самые поля, что уже
        // используются для достижений/статистики — см. achievements.js._state() для клиентского
        // зеркала того же списка ключей) — ни одно из них не может быть подделано только этим
        // контроллером, у каждого свой легитимный писатель (bosses.php/zone.php/habar.php/etc.).
        private function _statValue($user, $key){
            return $this->ops->i($user, $key, 0);
        }

        // Пикает 3 дневных + 1 недельное + 1 особое (тот же состав, что был у клиентского
        // _generateTasks()) — фиксированный порядок слотов 0-4, тот же, что ждёт UI (5 карточек).
        // 23.09.2026: "недельные"/"особые" задания в ЭТОЙ версии перегенерируются вместе с
        // дневными (раз в календарный день) — сохранено 1-в-1 поведение старого клиентского
        // кода (savedDay !== today перегенерировал ВСЕ 5 карточек разом), это перенос логики,
        // а не редизайн — настоящий недельный цикл, если понадобится, отдельная задача.
        private function _pickTasks($catalog){
            $pick = function($pool, $n){
                $idxs = array_keys($pool);
                shuffle($idxs);
                $idxs = array_slice($idxs, 0, min($n, count($idxs)));
                $out = [];
                foreach($idxs as $i) $out[] = ['id' => $pool[$i]['id'], 'type_pool' => null];
                return $out;
            };
            $daily   = $pick($catalog['daily'],   3);
            $weekly  = $pick($catalog['weekly'],  1);
            $special = $pick($catalog['special'], 1);

            $tasks = [];
            foreach($daily   as $t) $tasks[] = ['id' => $t['id'], 'type' => 'daily',   'claimed' => false];
            foreach($weekly  as $t) $tasks[] = ['id' => $t['id'], 'type' => 'weekly',  'claimed' => false];
            foreach($special as $t) $tasks[] = ['id' => $t['id'], 'type' => 'special', 'claimed' => false];
            return $tasks;
        }

        private function _findDef($catalog, $type, $id){
            $poolKey = $type; // 'daily'|'weekly'|'special' совпадает с ключом каталога
            foreach(($catalog[$poolKey] ?? []) as $row){
                if($row['id'] === $id) return $row;
            }
            return null;
        }

        // Возвращает актуальную сессию (перегенерирует набор заданий, если день сменился или
        // сессии ещё не было) — НЕ сохраняет сама, вызывающий код решает, когда делать saveUser.
        private function _loadOrGenerateSession($user, $catalog){
            $raw  = $user['zadaniya_session'] ?? null;
            $data = is_array($raw) ? $raw : (is_string($raw) && $raw !== '' ? json_decode($raw, true) : null);
            if(!is_array($data)) $data = [];

            // 28.09.2026 (по прямому указанию — "вся игра должна ориентироваться на московское
            // время"): раньше gmdate('Y-m-d') — полночь UTC явно. Теперь та же граница 12:00
            // МСК, что и у дневного лимита боссов/покера/блэкджека (Gameops::mskDailyDate()).
            $today = $this->ops->mskDailyDate();
            if(($data['day'] ?? null) !== $today || empty($data['tasks'])){
                $data['day']   = $today;
                $data['tasks'] = $this->_pickTasks($catalog);
            }
            return $data;
        }

        // getTasks — отдаёт клиенту актуальный набор заданий на сегодня вместе с честно
        // посчитанным прогрессом (клиент больше не читает udata напрямую для этого экрана).
        function getTasks(){
            if($this->BETA_LOCKED) return $this->ops->fail(56);

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $catalog = $this->_catalog();
            $session = $this->_loadOrGenerateSession($user, $catalog);
            $user['zadaniya_session'] = json_encode($session);
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            $rows = [];
            foreach($session['tasks'] as $idx => $t){
                $def = $this->_findDef($catalog, $t['type'], $t['id']);
                if(!$def) continue; // каталог поменяли между раздачами — пропускаем осиротевшее задание
                $prog = min(intval($def['need']), $this->_statValue($user, $def['key']));
                $rows[] = [
                    'idx'        => $idx,
                    'id'         => $t['id'],
                    'type'       => $t['type'],
                    'icon'       => $def['icon'],
                    'name'       => $def['name'],
                    'desc'       => $def['desc'],
                    'reward_lbl' => $def['reward_lbl'],
                    'need'       => intval($def['need']),
                    'prog'       => $prog,
                    'claimed'    => !!$t['claimed'],
                ];
            }

            $this->ops->ok(['patch' => $this->ops->patchCurrencies($user), 'tasks' => $rows]);
        }

        function claim(){
            if($this->BETA_LOCKED) return $this->ops->fail(56);

            $idx = intval($this->registry['user_params']['task_idx'] ?? -1);
            if($idx < 0) return $this->ops->fail(54);

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $catalog = $this->_catalog();
            $session = $this->_loadOrGenerateSession($user, $catalog);
            if(!isset($session['tasks'][$idx])) return $this->ops->fail(51);
            $t = $session['tasks'][$idx];
            if(!empty($t['claimed'])) return $this->ops->fail(52);

            $def = $this->_findDef($catalog, $t['type'], $t['id']);
            if(!$def) return $this->ops->fail(51); // каталог поменяли, задание больше не существует

            $prog = $this->_statValue($user, $def['key']);
            if($prog < intval($def['need'])) return $this->ops->fail(53);

            $session['tasks'][$idx]['claimed'] = true;
            $user['zadaniya_session'] = json_encode($session);

            $rtype = $def['reward_type'] ?? 'coins';
            $rval  = $def['reward_val']  ?? 0;
            if($rtype === 'cig_coins' && is_array($rval)){
                $this->ops->add($user, 'cigarettes', intval($rval[0]));
                $this->ops->add($user, 'coins', intval($rval[1]));
            } else {
                $map = ['coins' => 'coins', 'stew' => 'stew', 'cig' => 'cigarettes'];
                $cur = $map[$rtype] ?? 'coins';
                $this->ops->add($user, $cur, is_array($rval) ? intval($rval[0]) : intval($rval));
            }

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            $this->ops->ok(['patch' => $this->ops->patchCurrencies($user)]);
        }
    }
?>
