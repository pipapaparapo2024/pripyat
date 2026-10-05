<?php
    // ── SERVER-AUTHORITATIVE СКИЛЛЫ (18.09.2026, перенос экономики) ──
    //
    // Раньше levels[20] (реальная прокачка каждого скилла) хранился ВНУТРИ udata['skills_data']
    // — поля, которое ВСЕГДА было в client-writable whitelist users.php (это нужно для
    // skillsDmgSpent, который остаётся client-reported — как и сам урон по боссам, урон удара
    // по-прежнему считает клиент, это отдельный, намного больший фронт переноса). Значит игрок
    // мог одним users.save с поддельным skills_data мгновенно прокачать ВСЕ 20 скиллов до
    // максимума бесплатно — клиентская проверка "хватает ли очков" (skills.js.upgrade())
    // никогда даже не вызывалась бы для читера, дергающего users.save напрямую.
    //
    // Теперь: levels[20] хранятся в skills_levels — служебном поле, НЕ в whitelist users.php
    // (как dice_session/yashik_session/roulette_cups) — клиент физически не может подделать
    // его через users.save, читает и пишет только сервер.
    //
    // 22.09.2026 (по прямому указанию — "читеры могут делать себе огромное кол-во очков через
    // консоль"): skillsDmgSpent (сколько урона накоплено на следующее очко) ТОЖЕ переехал в
    // skills_levels — раньше он жил в client-writable skills_data, и читер мог одним users.save
    // выставить skillsDmgSpent = 999999999, мгновенно получить сотни доступных очков и тут же
    // прокачать ими реальные уровни через (уже server-authoritative) upgrade() — то есть
    // единственная реальная проверка была бесполезна против подделанного ВХОДНОГО числа.
    // Теперь dmgSpent растёт ТОЛЬКО через bosses.attack() (server/core/controllers/bosses.php,
    // на каждый реальный удар по боссу) — см. _loadState() ниже за миграцией существующих
    // игроков (тот же приём, что уже был у levels: подхватываем накопленное один раз).
    //
    // 18.09.2026 (по прямому указанию, отдельно от переноса на сервер): бесплатная прокачка
    // первого уровня скилла 0 ("С размашки") убрана целиком — раньше игрок получал этот
    // уровень без затраты очка (льгота "первый скилл бесплатно"), теперь ВСЕ уровни ВСЕХ
    // скиллов, включая этот, стоят полную цену очками. Существующим игрокам, уже получившим
    // этот уровень бесплатно, он не отбирается — просто больше не исключается из spentPoints.
    Class Skills {
        private $registry, $ops;

        public $permits;

        function __construct($registry){
            $this->registry = $registry;
            $this->ops = new Gameops($registry);
            $this->permits = ['upgrade'];
        }

        private function _catalog(){
            return $this->ops->catalog('skills_config');
        }

        // Отдельное прямое подключение к БД — тот же паттерн, что zone.php/bosses.php._rawLink()
        // (04.10.2026, аудит гонок состояний).
        private function _rawLink(){
            $link = new mysqli($this->registry['server'], $this->registry['user'], $this->registry['pass'], $this->registry['db'], 3306);
            if($link->connect_error) return null;
            $link->set_charset('utf8mb4');
            return $link;
        }

        // Та же арифметическая прогрессия, что _pointCost/_totalDmgForPoints/_calcPoints в
        // skills.js — сверено построчно, при изменении формулы на клиенте обязательно менять
        // и здесь одновременно.
        private function _pointCost($catalog, $n){
            return intval($catalog['point_base_cost']) + ($n - 1) * intval($catalog['point_cost_step']);
        }

        private function _totalDmgForPoints($catalog, $n){
            if($n <= 0) return 0;
            $base = intval($catalog['point_base_cost']);
            $step = intval($catalog['point_cost_step']);
            return $n * $base + intval(floor($step * $n * ($n - 1) / 2));
        }

        private function _calcPoints($catalog, $totalDmg){
            if($totalDmg <= 0) return 0;
            $lo = 0; $hi = intval($catalog['total_points']);
            while($lo < $hi){
                $mid = intval(ceil(($lo + $hi) / 2));
                if($this->_totalDmgForPoints($catalog, $mid) <= $totalDmg) $lo = $mid;
                else $hi = $mid - 1;
            }
            return $lo;
        }

        // Единое состояние скиллов игрока — {levels, dmgSpent, sessionStartPoints}. Мигрирует
        // СУЩЕСТВУЮЩИХ игроков ровно один раз с каждого поля (levels — с 18.09.2026, dmgSpent —
        // с 22.09.2026): пока skills_levels ещё не содержит нужного ключа, подхватываем то, что
        // накопил клиент в старом (client-writable) skills_data — дальше этот ключ пишет
        // ТОЛЬКО сервер (upgrade() ниже — levels; bosses.php.attack() — dmgSpent), обратно в
        // skills_data ничего не льётся, так что после первого захвата подделать уже нечем.
        private function _loadState($user){
            $raw   = $this->ops->j($user, 'skills_levels', null);
            $state = is_array($raw) ? $raw : [];

            if(!isset($state['levels']) || !is_array($state['levels'])){
                $oldData = $this->ops->j($user, 'skills_data', []);
                $state['levels'] = (is_array($oldData) && isset($oldData['levels']) && is_array($oldData['levels']))
                    ? $oldData['levels'] : array_fill(0, 20, 0);
            }
            while(count($state['levels']) < 20) $state['levels'][] = 0;
            $state['levels'] = array_values($state['levels']);

            if(!isset($state['dmgSpent'])){
                $oldSkillsData = $this->ops->j($user, 'skills_data', []);
                $state['dmgSpent'] = (is_array($oldSkillsData) && isset($oldSkillsData['skillsDmgSpent']))
                    ? max(0, intval($oldSkillsData['skillsDmgSpent'])) : 0;
            }
            if(!isset($state['sessionStartPoints'])) $state['sessionStartPoints'] = 0;

            return $state;
        }

        // spentPoints — сумма всех уровней всех скиллов. 18.09.2026 (по прямому указанию):
        // разовая бесплатная прокачка первого уровня скилла 0 убрана — раньше этот уровень
        // не вычитался из доступных очков (льгота "первый скилл бесплатно"), теперь ВСЕ
        // уровни ВСЕХ скиллов, включая первый уровень скилла 0, стоят полную цену.
        private function _spentPoints($levels){
            $spent = 0;
            foreach($levels as $v) $spent += intval($v);
            return $spent;
        }

        // 25.09.2026 (по прямому указанию — "может будем сохранять отдельным полем, мне
        // кажется это хорошее решение"): доступные очки раньше всегда пересчитывались на лету
        // (earned - spent) в upgrade() ниже — не баг (обе величины монотонно растут), но по
        // явной просьбе переведено на персистентный баланс $state['points']. Тот же хелпер,
        // что и bosses.php._syncSkillPoints() (дублирован по тому же принципу, разные
        // контроллеры) — держит points в актуальном состоянии относительно dmgSpent, мигрирует
        // существующих игроков один раз.
        private function _syncSkillPoints(&$state, $catalog){
            $earned = $this->_calcPoints($catalog, intval($state['dmgSpent'] ?? 0));
            if(!isset($state['earnedBaseline'])){
                $state['earnedBaseline'] = $earned;
                $state['points'] = max(0, $earned - $this->_spentPoints($state['levels']));
                return;
            }
            $delta = $earned - intval($state['earnedBaseline']);
            if($delta > 0){
                $state['points'] = intval($state['points'] ?? 0) + $delta;
                $state['earnedBaseline'] = $earned;
            }
        }

        function upgrade(){
            $sid = intval($this->registry['user_params']['skill_id'] ?? -1);
            if($sid < 0 || $sid > 19) return $this->ops->fail(76); // некорректный id скилла

            $catalog = $this->_catalog();
            $maxLvl  = intval($catalog['max_lvl'][$sid]);

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            // 04.10.2026 (аудит гонок состояний): bosses.php.attack()/claimKill()/
            // endFightSession() мутируют ТО ЖЕ самое skills_levels (прогресс урона на
            // следующее очко, финализация сессии) обычным loadUser()/saveUser() без лока — если
            // игрок прокачивает навык параллельно с ударом по боссу, $user['skills_levels'],
            // загруженный строкой выше, может устареть за время между ним и записью ниже.
            // SELECT...FOR UPDATE на строке (тот же лок, что теперь в bosses.php — общая
            // строка игрока) держит её до COMMIT, второй параллельный запрос реально ждёт и
            // видит уже обновлённое значение вместо гонки lost update.
            $link = $this->_rawLink();
            if($link){
                $link->begin_transaction();
                $res = $link->query("SELECT `skills_levels` FROM `{$this->registry['utb']}` WHERE `id`=".intval($this->registry['uid'])." FOR UPDATE");
                $row = ($res && $res->num_rows > 0) ? $res->fetch_assoc() : null;
                $userForState = $row ? array_merge($user, ['skills_levels' => $row['skills_levels']]) : $user;
            } else {
                $userForState = $user; // фолбэк без лока — лучше редкий шанс гонки, чем полностью заблокированный апгрейд
            }

            $state  = $this->_loadState($userForState);
            $levels = $state['levels'];

            if(intval($levels[$sid]) >= $maxLvl){
                if($link){ $link->rollback(); $link->close(); }
                return $this->ops->fail(77); // уже максимальный уровень скилла
            }

            // 18.09.2026 (по прямому указанию): бесплатная прокачка первого уровня скилла 0
            // убрана целиком — теперь ЛЮБОЙ апгрейд, включая этот, требует доступное очко.
            // 22.09.2026: dmgSpent теперь тоже server-authoritative (см. _loadState() выше) —
            // читер больше не может подделать ВХОДНОЕ число, от которого зависит earned.
            // 25.09.2026 (по прямому указанию — персистентный баланс очков вместо пересчёта на
            // лету): _syncSkillPoints() подтягивает любые новые очки, пересёкшие порог со
            // времени последней синхронизации, затем тратим напрямую из $state['points'].
            $this->_syncSkillPoints($state, $catalog);
            if(intval($state['points'] ?? 0) < 1){
                if($link){ $link->rollback(); $link->close(); }
                return $this->ops->fail(78); // недостаточно очков скиллов
            }
            $state['points'] = intval($state['points']) - 1;
            $levels[$sid] = intval($levels[$sid]) + 1;

            // Сохраняем levels В ТОМ ЖЕ объекте state — dmgSpent/sessionStartPoints остаются
            // как были, upgrade() их не трогает (иначе перезаписал бы прогресс урона нулём).
            $state['levels'] = $levels;
            $finalSkillsJson = json_encode($state);

            if($link){
                $link->query("UPDATE `{$this->registry['utb']}` SET `skills_levels`='".$link->real_escape_string($finalSkillsJson)."' WHERE `id`=".intval($this->registry['uid']));
                $link->commit();
                $link->close();
            } else {
                // 04.10.2026 (баг найден при написании теста на этот же фикс — "если
                // _rawLink() не смог открыть соединение, прокачка считалась, но НИКОГДА не
                // сохранялась": прямой UPDATE выше пропускался, а отложенное присвоение
                // $user['skills_levels'] происходило бы уже ПОСЛЕ saveUser(), то есть
                // слишком поздно для этого же запроса). Без лока — сохраняем как раньше, ДО
                // saveUser().
                $user['skills_levels'] = $finalSkillsJson;
            }

            // 28.09.2026 (по прямому указанию — перенос источников max_energy на сервер):
            // "Адреналин" (id:9) — единственный скилл типа 'energy', +1 макс. энергии за
            // уровень. Раньше бонус целиком считал и писал КЛИЕНТ (skills.js.upgrade()
            // callback: TIMERS.ENERGY_MAX += 1; udata['max_energy'] = ...), полагаясь на
            // общий client-writable users.save — тот же класс дыры, что и у шмота (см.
            // gameops.php.applyShmotOwnBonus()). Level растёт только вверх, поэтому "+1 за
            // апгрейд" корректно применять аддитивно, без риска задвоения.
            if($sid === 9) $this->ops->add($user, 'max_energy', 1);

            // skills_levels уже выставлен в $user ВЫШЕ, если лока не было (чтобы saveUser()
            // ниже реально его сохранил) — если лок был, он уже записан отдельным UPDATE, и
            // здесь безопасно переприсвоить то же значение (идемпотентно, saveUser() его либо
            // пропустит как неизменившееся, либо перезапишет тем же самым).
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            $user['skills_levels'] = $finalSkillsJson;

            $patch = $this->ops->patchCurrencies($user, ['skills_levels', 'max_energy']);
            $this->ops->ok(['patch' => $patch, 'levels' => $levels, 'newLevel' => $levels[$sid]]);
        }
    }
?>
