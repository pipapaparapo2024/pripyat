<?php
	Class Zone {
        private $registry, $ops;

        // Порог энергии/наград ТЗ стр.15-21 — раньше считался только на клиенте (zone.js),
        // игрок мог вызвать внутренний метод из консоли в обход энергии/кулдауна. Перенос на
        // сервер 17.09.2026 (первый шаг проекта server-authoritative экономики, по прямому
        // указанию) — таблицы ЗДЕСЬ переписаны 1:1 из zone.js (сверено скриптом построчно,
        // без единого расхождения) в json/zone_config.json.
        // 28.09.2026: свой ENERGY_REGEN_SEC убран отсюда — формула регенерации энергии теперь
        // целиком в Gameops::energySnapshot()/spendEnergy() (server/core/models/gameops.php),
        // держать константу ЕЩЁ и здесь означало бы два источника истины для одного числа.
        const ZONE_COLLECT_COOLDOWN_SEC = 8 * 3600;

        public $permits;

        function __construct($registry){
            $this->registry = $registry;
            $this->ops = new Gameops($registry);

            $this->permits = ['leaders', 'recordRespect', 'fillCheckpoint', 'captureLocation', 'upgradeBusiness', 'collectIncome', 'collectAllIncome', 'resetMyRespectLeader'];
        }

        private function _catalog(){
            return $this->ops->catalog('zone_config');
        }

        // Текущая энергия ПРЯМО СЕЙЧАС, по серверным часам — делегирует в
        // Gameops::energySnapshot() (28.09.2026: формула вынесена туда, чтобы
        // base.php.train() не дублировал её отдельно — см. коммент в gameops.php).
        private function _currentEnergy($user){
            return $this->ops->energySnapshot($user)[0];
        }

        // Бонус банды — та же статическая таблица, что Gangs.getBonus() в gangs.js (карта
        // жёстко зашита в клиенте, банда там НЕ вычисляется динамически, это статический выбор
        // одной из 6, так что дублирование здесь безопасно и не требует синхронизации с БД банд).
        private function _gangBonus($user, $key){
            $gangId = $this->ops->i($user, 'gang_id', -1);
            // 28.09.2026 (по прямому указанию — "убери мёртвый код armor"): ключ 'armor' убран
            // из обоих гангов (1 и 5) — ни один предмет шмота (bk:'armor') нигде в каталоге не
            // существует, начислять бонус неоткуда, а сам ключ нигде не читался (см. тот же
            // мёртвый Shmot.getTotalArmor() на клиенте — тоже удалён).
            $map = [
                0 => ['max_energy'=>5,  'stew_bonus'=>10],
                1 => ['damage'=>10],
                2 => ['speed'=>8,       'coins_bonus'=>10],
                3 => ['damage'=>12,     'repair_cost'=>-20],
                4 => ['exp_bonus'=>15,  'drop_bonus'=>5],
                5 => ['damage'=>20],
            ];
            return isset($map[$gangId][$key]) ? $map[$gangId][$key] : 0;
        }

        // zone-прогресс хранится в udata['zone'] как {"<locIdx>":{"cps":[6 инт],"biz":[3 инт],"cleared":инт}}
        // — тот же формат, что zone.js._saveToUdata()/_loadFromUdata(), так что после переноса
        // старый прогресс, уже накопленный игроками, продолжает читаться без миграции.
        private function _loadZoneProgress($user){
            $raw = isset($user['zone']) ? $user['zone'] : null;
            $data = is_array($raw) ? $raw : (is_string($raw) && $raw !== '' ? json_decode($raw, true) : null);
            return is_array($data) ? $data : [];
        }

        private function _locProgress(&$progress, $locIdx, $catalogLoc){
            $key = strval($locIdx);
            if(!isset($progress[$key]) || !is_array($progress[$key])){
                $progress[$key] = ['cps' => array_fill(0, 6, 0), 'biz' => array_fill(0, 3, 0), 'cleared' => 0];
            }
            $p = &$progress[$key];
            if(!isset($p['cps']) || !is_array($p['cps'])) $p['cps'] = array_fill(0, 6, 0);
            while(count($p['cps']) < 6) $p['cps'][] = 0;
            if(!isset($p['biz']) || !is_array($p['biz'])) $p['biz'] = array_fill(0, 3, 0);
            while(count($p['biz']) < 3) $p['biz'][] = 0;
            if(!isset($p['cleared'])) $p['cleared'] = 0;
            return $p;
        }

        // Общий код захвата локации целиком — та же формула, что zone.js._capture():
        // 100/10/50 × (locIdx+1) сигарет/уважения/опыта, сброс всех ячеек в 0, cleared++.
        // Используется из ДВУХ мест: автоматически внутри fillCheckpoint() (когда только что
        // заполненный чекпоинт оказался последним) и из отдельного captureLocation() (кнопка
        // "ВЫПОЛНИТЬ" в попапе локации, если все точки уже были заполнены РАНЬШЕ — см.
        // zone/zone-popup.js, ветка allDone). Ничего не делает и возвращает null, если не все
        // 6 ячеек локации заполнены.
        private function _applyCaptureIfFull(&$progress, $locIdx, &$user){
            $locKey = strval($locIdx);
            foreach($progress[$locKey]['cps'] as $v){ if($v < 5) return null; }

            $mult = $locIdx + 1;
            $bonusCig = 100 * $mult; $bonusResp = 10 * $mult; $bonusExp = 50 * $mult;
            $this->ops->add($user, 'cigarettes', $bonusCig);
            $this->ops->add($user, 'respect', $bonusResp);
            $this->ops->add($user, 'exp', $bonusExp);
            $progress[$locKey]['cps'] = array_fill(0, 6, 0);
            $progress[$locKey]['cleared'] = intval($progress[$locKey]['cleared'] ?? 0) + 1;
            return ['cig' => $bonusCig, 'resp' => $bonusResp, 'exp' => $bonusExp, 'cleared' => $progress[$locKey]['cleared']];
        }

        // Отдельное прямое подключение к БД — тот же паттерн, что bosses.php._rawLink():
        // zone_respect_leader — глобальная таблица (не привязана к текущему игроку через
        // udb/utb), обычный getData/saveData тут не подходит.
        private function _rawLink(){
            $link = new mysqli($this->registry['server'], $this->registry['user'], $this->registry['pass'], $this->registry['db'], 3306);
            if($link->connect_error) return null;
            $link->set_charset('utf8mb4');
            return $link;
        }

        // 29.09.2026 (репорт игрока — "прокачал бизнес на двух локациях на максимум (50 сиг +
        // 100 сиг), собрал прибыль, получил суммарно только 70"): кнопка "Собрать прибыль"
        // (zone_screen.js) раньше слала до 5 параллельных запросов zone.collectIncome для
        // ОДНОГО игрока (по одному на каждую локацию с доходом) без ожидания ответа. Gameops::
        // loadUser()/saveUser() (gameops.php) — обычный SELECT + INSERT...ON DUPLICATE KEY
        // UPDATE, БЕЗ блокировки строки и без атомарного инкремента: если два таких запроса
        // выполняются параллельно (разные PHP-FPM воркеры), оба читают ОДНО И ТО ЖЕ старое
        // значение cigarettes, каждый добавляет свою сумму К НЕМУ и пишет обратно — тот запрос,
        // что сохранился НЕ последним, теряет своё начисление целиком (классический lost
        // update). То же самое верно для fillCheckpoint/captureLocation/upgradeBusiness — все
        // они мутируют cigarettes/exp/respect/'zone' по той же схеме read-modify-write. Клиент
        // теперь сериализует собственные запросы (см. zone.js._collectIncome()), но сервер не
        // должен полагаться только на дисциплину клиента (повтор из-за сетевого ретрая,
        // несколько открытых вкладок и т.п. дают тот же race). GET_LOCK на ОТДЕЛЬНОМ
        // соединении (тот же приём, что _rawLink() выше) сериализует все мутации Зоны одного
        // игрока — второй параллельный запрос ждёт, пока первый полностью прочитает и запишет
        // строку, вместо гонки на одной и той же строке БД. Таймаут 5с — с большим запасом
        // выше времени одного load+save; если лок всё же не достался (истёк таймаут или не
        // удалось открыть отдельное соединение), выполняем действие без него — лучше редкий
        // шанс гонки, чем полностью заблокированная Зона при временной проблеме с БД.
        private function _withUserLock(callable $fn){
            $link = $this->_rawLink();
            if(!$link) return $fn();

            $lockName = 'zone_user_' . intval($this->registry['uid']);
            $escaped = $link->real_escape_string($lockName);
            $link->query("SELECT GET_LOCK('{$escaped}', 5)");
            try {
                return $fn();
            } finally {
                $link->query("SELECT RELEASE_LOCK('{$escaped}')");
                $link->close();
            }
        }

        // Тот же INSERT...ON DUPLICATE KEY UPDATE GREATEST(...), что recordRespect() ниже
        // делал по вызову с клиента (zone.js._addLocRespect, fire-and-forget). Теперь, когда
        // уважение начисляется НА СЕРВЕРЕ (fillCheckpoint/collectIncome/captureLocation), эти
        // же методы обновляют глобальный рекорд «рамки уважения» сами, без похода клиента —
        // иначе рамка уважения перестала бы обновляться после переноса Зоны на сервер.
        private function _recordRespectLeader($locIdx, $total){
            $link = $this->_rawLink();
            if(!$link) return; // не критично для основного действия — просто лог, не fail()
            $uid = intval($this->registry['uid']);
            $now = time();
            $link->query("INSERT INTO `zone_respect_leader` (`location_id`, `user_id`, `amount`, `updated_at`) VALUES ($locIdx, $uid, $total, $now)
                ON DUPLICATE KEY UPDATE
                    `user_id`    = IF($total > `amount`, $uid, `user_id`),
                    `updated_at` = IF($total > `amount`, $now, `updated_at`),
                    `amount`     = GREATEST(`amount`, $total)");
            $link->close();
        }

        // Кто заработал БОЛЬШЕ ВСЕГО уважения с каждой из 5 локаций — ГЛОБАЛЬНО, среди ВСЕХ
        // игроков игры (аналог bosses.php.killers(), только тут не "последний", а "рекордсмен
        // по максимуму" — см. recordRespect()). Хранится в zone_respect_leader (location_id PK,
        // 5 строк максимум).
        function leaders(){
            $link = $this->_rawLink();
            if(!$link) return $this->registry['tools']->output(['leaders' => []]);

            // 26.09.2026 (по прямому живому репорту, скриншот — "картинка всё ещё сохраняется
            // в локации" после удаления аккаунта админом напрямую из БД, минуя игровой
            // "СБРОС ВСЕГО"/resetMyRespectLeader(), который чистит только свою же запись при
            // самостоятельном сбросе): zone_respect_leader хранит user_id БЕЗ FOREIGN KEY на
            // users — при удалении строки игрока напрямую (SQL, не через игровой эндпоинт)
            // запись рекордсмена осталась и продолжала отдавать фото/уважение уже
            // не существующего аккаунта. INNER JOIN с users — рекордсмен, чей аккаунт больше
            // не существует, теперь просто не попадает в выдачу (не нужно помнить чистить эту
            // таблицу вручную при каждом будущем удалении игрока — фикс постоянный, на уровне
            // самого запроса).
            $out = [];
            $res = $link->query(
                "SELECT z.`location_id`, z.`user_id`, z.`amount`
                 FROM `zone_respect_leader` z
                 INNER JOIN `{$this->registry['utb']}` u ON u.`id` = z.`user_id`"
            );
            if($res) while($row = $res->fetch_assoc()){
                $out[] = ['loc' => intval($row['location_id']), 'id' => intval($row['user_id']), 'amount' => intval($row['amount'])];
            }
            $link->close();

            $this->registry['tools']->output(['leaders' => $out]);
        }

        // 26.09.2026 (по прямому репорту — "при сбросе аккаунта остался в рамке локации как
        // человек с больше всего уважения"): zone_respect_leader — ГЛОБАЛЬНАЯ таблица рекордов
        // (не привязана к udb/utb, см. _rawLink() выше), обычный "СБРОС ВСЕГО" в dev_panel.js
        // (users.save + resetSession по server-only полям) физически не мог её коснуться —
        // respect в users обнулялся, а рекорд "кто набрал больше всего" в отдельной таблице
        // оставался прежним. Вызывается ИЗ _resetAccount() ДОПОЛНИТЕЛЬНО к обычному сбросу —
        // удаляет ТОЛЬКО строки, где рекордсмен = сам вызывающий (не трогает чужие рекорды).
        function resetMyRespectLeader(){
            $link = $this->_rawLink();
            if(!$link) return $this->ops->fail(99);
            $uid = intval($this->registry['uid']);
            $link->query("DELETE FROM `zone_respect_leader` WHERE `user_id` = $uid");
            $affected = $link->affected_rows;
            $link->close();
            $this->registry['tools']->output(['cleared' => $affected]);
        }

        // Записывает текущий НАКОПЛЕННЫЙ ИТОГ уважения ТЕКУЩЕГО игрока с данной локации —
        // вызывается с клиента (zone.js._addLocRespect) после каждого начисления уважения за
        // локацию (чекпоинт/захват/сбор прибыли бизнеса), fire-and-forget. Клиент присылает
        // именно итог (не дельту) — сервер просто заменяет рекорд, если итог больше текущего
        // (GREATEST/IF в ON DUPLICATE KEY UPDATE — атомарно, без гонок между игроками).
        function recordRespect(){
            $loc = isset($this->registry['user_params']['loc']) ? intval($this->registry['user_params']['loc']) : -1;
            $amount = isset($this->registry['user_params']['amount']) ? intval($this->registry['user_params']['amount']) : -1;
            // Аудит безопасности 17.09.2026: раньше $amount ничем не ограничивался сверху —
            // игрок мог вызвать zone.recordRespect с amount=999999999 и мгновенно стать
            // «рекордсменом по уважению» на любой локации без единой игры. Потолок ниже —
            // с большим запасом выше любого реалистичного накопленного уважения.
            if($loc < 0 || $loc > 4 || $amount < 0 || $amount > 100000000) return $this->registry['tools']->output(['ok' => false]);

            $link = $this->_rawLink();
            if(!$link) return $this->registry['tools']->output(['ok' => false]);

            $uid = intval($this->registry['uid']);
            $now = time();
            $link->query("INSERT INTO `zone_respect_leader` (`location_id`, `user_id`, `amount`, `updated_at`) VALUES ($loc, $uid, $amount, $now)
                ON DUPLICATE KEY UPDATE
                    `user_id`    = IF($amount > `amount`, $uid, `user_id`),
                    `updated_at` = IF($amount > `amount`, $now, `updated_at`),
                    `amount`     = GREATEST(`amount`, $amount)");
            $link->close();

            $this->registry['tools']->output(['ok' => true]);
        }

        // ── SERVER-AUTHORITATIVE ЗОНА (17.09.2026, первый шаг переноса экономики) ──────────
        //
        // Раньше zone.js САМ считал награду за чекпоинт/захват/бизнес/заначку на клиенте и
        // просто слал готовый udata на сохранение — игрок мог вызвать внутренний метод из
        // консоли браузера в обход энергии и кулдаунов и начислить себе что угодно. Теперь
        // клиент только ПРОСИТ сервер выполнить действие (loc/cp индексы — не суммы), сервер
        // сам проверяет энергию/кулдаун/состояние и сам считает награду по каталогу
        // json/zone_config.json (сверен построчно с исходными таблицами zone.js).

        // Заполнить одну ячейку чекпоинта локации — самое частое действие в Зоне.
        function fillCheckpoint(){
            $locIdx = intval($this->registry['user_params']['loc'] ?? -1);
            $cpIdx  = intval($this->registry['user_params']['cp']  ?? -1);
            if($locIdx < 0 || $locIdx > 4 || $cpIdx < 0 || $cpIdx > 5) return $this->ops->fail(54);

            $catalog = $this->_catalog();
            $locCfg  = $catalog['locations'][$locIdx];
            $cpCfg   = $locCfg['checkpoints'][$cpIdx];

            // Блокировка на время load→mutate→save — см. _withUserLock() выше (защита от
            // параллельных запросов Зоны одного игрока, теряющих часть начисления).
            $this->_withUserLock(function() use ($locIdx, $cpIdx, $locCfg, $cpCfg){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $progress = $this->_loadZoneProgress($user);
            $this->_locProgress($progress, $locIdx, $locCfg);
            $locKey = strval($locIdx);

            if($progress[$locKey]['cps'][$cpIdx] >= 5) return $this->ops->fail(55); // ячейка уже заполнена

            $energyCost = intval($cpCfg['cell_cost']);
            // 28.09.2026: списание через Gameops::spendEnergy() — сохраняет остаток прогресса
            // до следующей единицы энергии вместо жёсткого сброса energy_time=time() (см.
            // подробный разбор в gameops.php). fail(56) — недостаточно энергии, как раньше.
            if(!$this->ops->spendEnergy($user, $energyCost)) return $this->ops->fail(56);
            $newEnergy = $this->ops->i($user, 'energy');

            $progress[$locKey]['cps'][$cpIdx]++;

            // Бонусы банды — та же формула, что zone.js._attack() (cigBonus/expBonus).
            $cigMult = 1 + $this->_gangBonus($user, 'stew_bonus') / 100;
            $expMult = 1 + $this->_gangBonus($user, 'exp_bonus')  / 100;
            $earnedCig  = intval(floor($cpCfg['cig'] * $cigMult));
            $earnedExp  = intval(floor($cpCfg['exp'] * $expMult));
            $earnedResp = intval($cpCfg['resp']);

            $this->ops->add($user, 'cigarettes', $earnedCig);
            $this->ops->add($user, 'exp', $earnedExp);
            $this->ops->add($user, 'respect', $earnedResp);

            $user['energy_spent'] = $this->ops->i($user, 'energy_spent') + $energyCost;
            $user['zone_fights']  = $this->ops->i($user, 'zone_fights') + 1;
            $zfKey = 'zone_fights_' . $locIdx;
            $user[$zfKey] = $this->ops->i($user, $zfKey) + 1;
            $user['total_damage'] = $this->ops->i($user, 'total_damage') + $energyCost * 10;

            // 25.09.2026 (по прямому указанию — "нычки визуально не готовы, сейчас находка не
            // должна иметь НИКАКОГО функционала — просто счётчик в БД, без классификации по
            // типу и без награды; когда появится арт, тогда включим полную логику обмена"):
            // раньше здесь была per-key коллекция (cards/completed по каждому из 2-3 типов
            // нычек локации) с наградой сигаретами/опытом за собранный полный набор — убрано
            // целиком (это же убрало и реальный баг: per-key объект писался в udata['stash_data'],
            // которое ОДНОВРЕМЕННО читает/пишет как плоский счётчик achievements.js.onStashCollect()
            // — коллизия форматов роняла клиент TypeError'ом при последующем сборе заначки).
            // stash_count — плоский счётчик "сколько нычек всего найдено", без темы/типа
            // ("нычка есть нычка", по прямому указанию). 15%-й шанс не изменился.
            $stashOut = ['dropped' => false];
            if(mt_rand(1, 100) <= 15){
                $user['stash_count'] = $this->ops->i($user, 'stash_count') + 1;
                $stashOut['dropped'] = true;
            }

            // Захват локации целиком — если этот чекпоинт оказался последним незаполненным.
            $captureOut = $this->_applyCaptureIfFull($progress, $locIdx, $user);

            $user['zone'] = json_encode($progress);

            // «Рамка уважения» — суммарный итог уважения по этой локации (чекпоинт + захват).
            $totalRespGain = $earnedResp + ($captureOut ? $captureOut['resp'] : 0);
            $locRespKey = 'loc_respect_' . $locIdx;
            if($totalRespGain > 0){
                $user[$locRespKey] = $this->ops->i($user, $locRespKey) + $totalRespGain;
            }

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            if($totalRespGain > 0) $this->_recordRespectLeader($locIdx, $user[$locRespKey]);

            $patch = $this->ops->patchCurrencies($user, [
                'coins','cigarettes','stew','energy','energy_time','exp','respect',
                'energy_spent','zone_fights','total_damage','zone','stash_count',
                $zfKey, $locRespKey,
            ]);

            $this->ops->ok([
                'patch' => $patch,
                'checkpoint' => ['cig' => $earnedCig, 'exp' => $earnedExp, 'resp' => $earnedResp],
                'stash' => $stashOut,
                'captured' => $captureOut !== null,
                'capture' => $captureOut,
                'energy' => $newEnergy,
            ]);
            });
        }

        // Отдельная явная кнопка "ВЫПОЛНИТЬ" в попапе локации (zone-popup.js) вызывает это,
        // когда все 6 ячеек УЖЕ были заполнены раньше (обычный путь захвата — автоматически
        // внутри fillCheckpoint выше; это лишь подстраховка на случай, если состояние "все
        // заполнены, но не захвачено" всё же встретится).
        function captureLocation(){
            $locIdx = intval($this->registry['user_params']['loc'] ?? -1);
            if($locIdx < 0 || $locIdx > 4) return $this->ops->fail(54);

            $catalog = $this->_catalog();
            $locCfg  = $catalog['locations'][$locIdx];

            // Блокировка на время load→mutate→save — см. _withUserLock() (защита от
            // параллельных запросов Зоны одного игрока, теряющих часть начисления).
            $this->_withUserLock(function() use ($locIdx, $locCfg){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $progress = $this->_loadZoneProgress($user);
            $this->_locProgress($progress, $locIdx, $locCfg);

            $captureOut = $this->_applyCaptureIfFull($progress, $locIdx, $user);
            if($captureOut === null){
                // 19.09.2026 (репорт "прохожу локацию — не начинается заново"): этот путь
                // ("ВЫПОЛНИТЬ" при уже якобы all-done локации) — по конвенции captureLocation()
                // считается лишь подстраховкой (обычный захват идёт автоматически внутри
                // fillCheckpoint), так что если он реально сработал — значит клиент и сервер
                // разошлись во мнении, всё ли заполнено. Логируем фактический cps, чтобы при
                // повторе бага не гадать, а сразу увидеть расхождение.
                error_log('[zone.captureLocation] fail(61) — не все ячейки заполнены | uid=' .
                    $this->registry['uid'] . ' | locIdx=' . $locIdx . ' | cps=' .
                    json_encode($progress[strval($locIdx)]['cps'] ?? null));
                return $this->ops->fail(61); // не все ячейки заполнены
            }

            $user['zone'] = json_encode($progress);
            $locRespKey = 'loc_respect_' . $locIdx;
            $user[$locRespKey] = $this->ops->i($user, $locRespKey) + $captureOut['resp'];

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            $this->_recordRespectLeader($locIdx, $user[$locRespKey]);

            $patch = $this->ops->patchCurrencies($user, ['cigarettes','exp','respect','zone',$locRespKey]);
            $this->ops->ok(['patch' => $patch, 'captured' => true, 'capture' => $captureOut]);
            });
        }

        // Прокачать один уровень бизнеса на локации — за сигареты, требует хотя бы одного
        // взятого чекпоинта или зачистки (та же проверка hasCapture, что zone-biz.js рисует
        // активной/неактивной кнопкой прокачки).
        function upgradeBusiness(){
            $locIdx = intval($this->registry['user_params']['loc'] ?? -1);
            $bizIdx = intval($this->registry['user_params']['biz'] ?? -1);
            if($locIdx < 0 || $locIdx > 4 || $bizIdx < 0 || $bizIdx > 2) return $this->ops->fail(54);

            $catalog = $this->_catalog();
            $locCfg  = $catalog['locations'][$locIdx];
            $bizCfg  = $locCfg['businesses'][$bizIdx];

            // Блокировка на время load→mutate→save — см. _withUserLock() (защита от
            // параллельных запросов Зоны одного игрока, теряющих часть начисления/уровня).
            $this->_withUserLock(function() use ($locIdx, $bizIdx, $locCfg, $bizCfg){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $progress = $this->_loadZoneProgress($user);
            $this->_locProgress($progress, $locIdx, $locCfg);
            $locKey = strval($locIdx);

            $hasCapture = intval($progress[$locKey]['cleared'] ?? 0) > 0
                || array_sum($progress[$locKey]['cps']) > 0;
            if(!$hasCapture) return $this->ops->fail(57); // локация ещё не тронута

            $lvl = intval($progress[$locKey]['biz'][$bizIdx]);
            if($lvl >= 10) return $this->ops->fail(58); // уже максимум

            $cost = intval($bizCfg['costs'][$lvl]);
            if(!$this->ops->deduct($user, 'cigarettes', $cost)) return $this->ops->fail(50); // не хватает сигарет

            $progress[$locKey]['biz'][$bizIdx] = $lvl + 1;
            $user['zone'] = json_encode($progress);

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            $patch = $this->ops->patchCurrencies($user, ['cigarettes', 'zone']);
            $this->ops->ok(['patch' => $patch, 'newLevel' => $lvl + 1]);
            });
        }

        // Собрать накопленный доход бизнесов локации — раз в 8 часов, та же формула сумм
        // по уровням, что zone.js.collectLocIncome().
        function collectIncome(){
            $locIdx = intval($this->registry['user_params']['loc'] ?? -1);
            if($locIdx < 0 || $locIdx > 4) return $this->ops->fail(54);

            $catalog = $this->_catalog();
            $locCfg  = $catalog['locations'][$locIdx];

            // Блокировка на время load→mutate→save — см. _withUserLock() (см. её большой
            // комментарий выше — это и есть фикс бага "собрал 50+100 сигарет с двух локаций,
            // получил только 70": без лока два параллельных collectIncome читали одно и то же
            // старое значение cigarettes и один из них терял своё начисление при записи).
            $this->_withUserLock(function() use ($locIdx, $locCfg){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $progress = $this->_loadZoneProgress($user);
            $this->_locProgress($progress, $locIdx, $locCfg);
            $locKey = strval($locIdx);

            $collectKey = 'zone_collect_' . $locIdx;
            $now  = time();
            $last = $this->ops->i($user, $collectKey, 0);
            $cooldownLeft = $last > 0 ? (self::ZONE_COLLECT_COOLDOWN_SEC - ($now - $last)) : 0;
            if($cooldownLeft > 0) return $this->ops->fail(59); // кулдаун ещё не истёк

            $totalCig = 0; $totalExp = 0; $totalResp = 0;
            foreach($locCfg['businesses'] as $bi => $bizCfg){
                $lvl = intval($progress[$locKey]['biz'][$bi] ?? 0);
                if($lvl <= 0) continue;
                $val = intval($bizCfg['table'][$lvl]);
                if($bizCfg['income'] === 'cig')  $totalCig  += $val;
                if($bizCfg['income'] === 'exp')  $totalExp  += $val;
                if($bizCfg['income'] === 'resp') $totalResp += $val;
            }
            if($totalCig === 0 && $totalExp === 0 && $totalResp === 0) return $this->ops->fail(60); // бизнес не прокачан

            $user[$collectKey] = $now;
            if($totalCig)  $this->ops->add($user, 'cigarettes', $totalCig);
            if($totalExp)  $this->ops->add($user, 'exp', $totalExp);
            if($totalResp) $this->ops->add($user, 'respect', $totalResp);

            $locRespKey = 'loc_respect_' . $locIdx;
            if($totalResp > 0) $user[$locRespKey] = $this->ops->i($user, $locRespKey) + $totalResp;

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            if($totalResp > 0) $this->_recordRespectLeader($locIdx, $user[$locRespKey]);

            $patch = $this->ops->patchCurrencies($user, ['cigarettes','exp','respect',$collectKey,$locRespKey]);
            $this->ops->ok(['patch' => $patch, 'cig' => $totalCig, 'exp' => $totalExp, 'resp' => $totalResp]);
            });
        }

        // Общий сбор по кнопке «Собрать прибыль»: все готовые бизнесы всех локаций
        // складываются в ОДИН ответ и сохраняются ОДИН раз. Это исключает ситуацию, когда
        // несколько отдельных ответов/попапов визуально оставляют игроку только последнюю
        // награду, и делает сумму независимой от порядка локаций.
        function collectAllIncome(){
            $catalog = $this->_catalog();

            $this->_withUserLock(function() use ($catalog){
                $user = $this->ops->loadUser();
                if(!$user) return $this->ops->fail(99);

                $progress = $this->_loadZoneProgress($user);
                $now = time();
                $totalCig = 0; $totalExp = 0; $totalResp = 0;
                $collectedLocs = [];
                $respectUpdates = [];

                foreach($catalog['locations'] as $locIdx => $locCfg){
                    $this->_locProgress($progress, $locIdx, $locCfg);
                    $locKey = strval($locIdx);
                    $collectKey = 'zone_collect_' . $locIdx;
                    $last = $this->ops->i($user, $collectKey, 0);
                    if($last > 0 && ($now - $last) < self::ZONE_COLLECT_COOLDOWN_SEC) continue;

                    $locCig = 0; $locExp = 0; $locResp = 0;
                    foreach($locCfg['businesses'] as $bi => $bizCfg){
                        $lvl = intval($progress[$locKey]['biz'][$bi] ?? 0);
                        if($lvl <= 0) continue;
                        $value = intval($bizCfg['table'][$lvl] ?? 0);
                        if($bizCfg['income'] === 'cig')  $locCig += $value;
                        if($bizCfg['income'] === 'exp')  $locExp += $value;
                        if($bizCfg['income'] === 'resp') $locResp += $value;
                    }
                    if($locCig === 0 && $locExp === 0 && $locResp === 0) continue;

                    $user[$collectKey] = $now;
                    $totalCig += $locCig; $totalExp += $locExp; $totalResp += $locResp;
                    $collectedLocs[] = $locIdx;
                    if($locResp > 0){
                        $locRespKey = 'loc_respect_' . $locIdx;
                        $user[$locRespKey] = $this->ops->i($user, $locRespKey) + $locResp;
                        $respectUpdates[$locIdx] = $user[$locRespKey];
                    }
                }

                if(empty($collectedLocs)) return $this->ops->fail(60);

                if($totalCig)  $this->ops->add($user, 'cigarettes', $totalCig);
                if($totalExp)  $this->ops->add($user, 'exp', $totalExp);
                if($totalResp) $this->ops->add($user, 'respect', $totalResp);
                if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
                foreach($respectUpdates as $locIdx => $total) $this->_recordRespectLeader($locIdx, $total);

                $patchFields = ['cigarettes', 'exp', 'respect'];
                for($i = 0; $i < 5; $i++){
                    $patchFields[] = 'zone_collect_' . $i;
                    $patchFields[] = 'loc_respect_' . $i;
                }
                $patch = $this->ops->patchCurrencies($user, $patchFields);
                $this->ops->ok(['patch' => $patch, 'cig' => $totalCig, 'exp' => $totalExp,
                    'resp' => $totalResp, 'locations' => $collectedLocs]);
            });
        }
	}
?>
