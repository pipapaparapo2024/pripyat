<?php
    // ── SERVER-AUTHORITATIVE "РАЗНАРЯДКА" (23.10.2026, по прямому указанию — новая фича,
    // месячный календарь ежедневных заданий, см. doc "ежедневные задания.docx") ──
    //
    // Состояние (какой день какое задание, прогресс, что уже оплачено/забрано) хранится в
    // raznaryadka_data — СОЗНАТЕЛЬНО НЕ В whitelist users.php (тот же паттерн, что
    // dice_session/poker_session и т.п.) — клиент не может подделать прогресс через
    // users.save, читает и пишет только сервер (сам контроллер + RaznaryadkaProgress::report()
    // хук, вызываемый из bosses.php/zone.php/dvor.php/zaruba.php/dice.php/blackjack.php/
    // poker.php/roulette.php после их собственных успешных действий).
    //
    // Прогрессия отката проваленного дня тушёнкой — по РАНГУ дня среди дней, НЕ выполненных
    // по-настоящему (не по абсолютному расстоянию до "сегодня"!), отсортированных от САМОГО
    // СВЕЖЕГО провала к самому старому: 1-й (самый свежий провал) = 2 тушёнки, 2-й = 4,
    // 3-й = 8, ... потолок 64 (см. doc, пример "провалил только 1й день — откатить можно за
    // 2 тушёнки" — ранг считается только по МНОЖЕСТВУ дней, НЕ выполненных по-настоящему;
    // честно выполненные дни между ними не влияют на ранг).
    //
    // 24.10.2026 (баг найден и исправлен по прямому указанию — порядок откупа влиял на
    // суммарную цену): УЖЕ ОТКУПЛЕННЫЙ тушёнкой день продолжает занимать свой ранг в этом
    // списке (не освобождает место соседям) — ранг "тает" только когда день выполнен ПО-
    // НАСТОЯЩЕМУ через RaznaryadkaProgress::report(). См. докблок _failedDaysDesc() ниже.
    Class Raznaryadka {
        private $registry, $ops;

        public $permits;

        function __construct($registry){
            $this->registry = $registry;
            $this->ops = new Gameops($registry);
            // devCompleteToday/devFailDay — дев-панель (23.10.2026, по прямому указанию —
            // "хочу проверить, что награда собрана, что можно собрать, что можно откатить
            // тушёнкой"), без них пришлось бы реально фармить задания/ждать 00:00 МСК, чтобы
            // увидеть каждое состояние экрана. Тот же уровень доступа, что и у остальных
            // dev_force_*/devGrant*-пермитов в users.php — защищены только отсутствием кнопки
            // в обычном UI, не отдельной проверкой uid на сервере (см. AGENTS.md про этот класс).
            $this->permits = ['getState', 'claim', 'payDay', 'devCompleteToday', 'devFailDay', 'devSeedMonth', 'devSkipDay', 'devResetDaySkip', 'devForceLaunchMonth', 'devRevertToRealMonth'];
        }

        // Список failed-дней (day < сегодня, status !== 'done'), отсортированный от САМОГО
        // СВЕЖЕГО к самому старому — индекс в этом массиве = ранг-1, используется и для
        // расчёта цены отката, и чтобы отдать клиенту готовые цены (не дублировать ранжирование
        // на фронте).
        //
        // 24.10.2026 (баг найден по прямому указанию — "нажимаю на день, ничего не открывается"):
        // раньше здесь было `foreach($data['days'] ?? [] as ...)` — перебирались ТОЛЬКО дни,
        // для которых уже существует запись в raznaryadka_data (т.е. хотя бы раз сработал
        // RaznaryadkaProgress::report() с совпадающим типом). День, по которому игрок вообще
        // ничего не делал (самый частый случай — только что запущенный октябрьский календарь),
        // никогда не попадал в $failed, значит не попадал и в pay_costs в getState(), и клик по
        // такому дню в _onDayClick() (raznaryadka.js) молча не находил cost и ничего не делал.
        // getState()'s собственный цикл построения $daysOut (visualStatus) УЖЕ считал статус
        // правильно для ВСЕХ дней 1..todayDay-1 (день без записи = 'failed', не 'pending') — этот
        // метод был просто не синхронизирован с той же логикой. Перебираем все номера дней
        // напрямую, а не только существующие ключи $data['days'].
        //
        // 24.10.2026 (баг найден по прямому указанию — "откупаю день 16, потом день 15 — выходит
        // 4 тушёнки; в обратном порядке — 6"): раньше день, уже ОТКУПЛЕННЫЙ тушёнкой (payDay()
        // ставит status='done','paid'=true), полностью исчезал из этого списка наравне с ЧЕСТНО
        // выполненным днём — список укорачивался, и ранги ОСТАВШИХСЯ проваленных дней съезжали
        // вниз (становились дешевле). Это позволяло платить МЕНЬШЕ суммарно за несколько дней,
        // просто откупая их в определённом порядке (сначала самый дорогой ранг — он обрушивает
        // ранги соседей). Теперь откупленный день ОСТАЁТСЯ в списке и занимает свой ранг — из
        // ранжирования исключаются только дни, выполненные ПО-НАСТОЯЩЕМУ (status=done И НЕ paid,
        // т.е. через RaznaryadkaProgress::report()). getState()/payDay() ниже отдельно исключают
        // уже оплаченные дни из предложения купить повторно — но их МЕСТО в ранжировании для
        // соседей сохраняется, поэтому порядок покупки больше не влияет на итоговую сумму.
        private function _failedDaysDesc($data, $todayDay){
            $failed = [];
            for($day = 1; $day < $todayDay; $day++){
                $rec = $data['days'][strval($day)] ?? null;
                $reallyDone = $rec && ($rec['status'] ?? '') === 'done' && empty($rec['paid']);
                if(!$reallyDone) $failed[] = $day;
            }
            rsort($failed);
            return $failed;
        }

        private function _payCost($config, $rank){ // $rank: 0-индекс (0 = самый свежий провал)
            $progression = $config['pay_progression'];
            $idx = min($rank, count($progression) - 1);
            return intval($progression[$idx]);
        }

        function getState(){
            // 28.10.2026 (баг найден по прямому указанию — "пропадают надписи наград при
            // форсировании ноября"): до этой правки НИ ОДНА fail-ветка/исключение в этом методе
            // не логировались — по серверным логам было невозможно понять, почему конкретный
            // запрос getState не прошёл (ПРАВИЛО №8). try/catch вокруг всего тела (БЕЗ вынесения
            // в отдельный метод — он бы разорвал текстовый поиск "внутри getState()" в нескольких
            // уже существующих тестах) — последняя линия защиты (ловит и фатальные Throwable, не
            // только явные fail()), чтобы при следующей репродукции бага в логе осталась причина.
            try {
            $user = $this->ops->loadUser();
            if(!$user){ error_log('[Raznaryadka.getState] FAIL 99 (loadUser) uid=' . abs(intval($this->registry['uid'] ?? 0))); return $this->ops->fail(99); }

            list($data, $config) = RaznaryadkaProgress::loadAndRollover($this->ops, $user);
            // loadAndRollover() могла начислить автосбор прошлого месяца (_grantTier) — сохраняем
            // ДО построения ответа, чтобы patch ниже отражал актуальный баланс.
            $user['raznaryadka_data'] = json_encode($data, JSON_UNESCAPED_UNICODE);
            if(!$this->ops->saveUser($user)){ error_log('[Raznaryadka.getState] FAIL 99 (saveUser) uid=' . abs(intval($this->registry['uid'] ?? 0))); return $this->ops->fail(99); }

            // 24.10.2026: effectiveDay() = mskDay() + dev-only смещение (см. докблок в
            // raznaryadkaprogress.php) — везде, где раньше было "сегодня" для Разнарядки.
            // 27.10.2026 (баг найден по прямому указанию — "форснул на ноябрь, показывается 27
            // ноября вместо 1"): дни-в-месяце считаем ПО ЦЕЛЕВОМУ $data['month'] (daysInMonthFor),
            // не по реальному текущему (daysInMskMonth()) — ноябрь (30 дней) короче октября (31),
            // после форса вперёд это давало и неверный "сегодня" (через effectiveDay(), чинится
            // там же), и неверный общий счётчик "ВЫПОЛНЕНО ЗАДАНИЙ N/31" вместо "N/30".
            $today = RaznaryadkaProgress::effectiveDay($data);
            $daysInMonth = RaznaryadkaProgress::daysInMonthFor($data['month']);
            $monthCfg = RaznaryadkaProgress::monthConfig($config, $data['month'], $daysInMonth);

            // 26.10.2026 (репорт по скриншоту — "крестики на днях 1-25 выглядят так, будто
            // игроки провалили задания, хотя фича реально стартует только 1 ноября"): фича
            // ещё НЕ запущена для реальных игроков (config['launch_month'] = "2026-11"), но
            // raznaryadka_data.month у игрока, который открыл экран ДО старта, равен текущему
            // МСК-месяцу (октябрь) — getState() считал дни 1..(today-1) 'failed' независимо от
            // того, был ли месяц реально "живым". Теперь день может стать 'failed' ТОЛЬКО если
            // данные игрока относятся к месяцу >= launch_month (сравнение строк "YYYY-MM"
            // работает лексикографически) — до старта все дни остаются 'pending', ничего не
            // выглядит проваленным.
            $launchMonth = $config['launch_month'] ?? null;
            $featureLive = !$launchMonth || $data['month'] >= $launchMonth;
            $failedCutoffDay = $featureLive ? $today : 1; // до старта — ни один день не "раньше сегодня"

            $doneCount = 0;
            $daysOut = [];
            for($d = 1; $d <= $daysInMonth; $d++){
                $dk = strval($d);
                $st = $data['days'][$dk]['status'] ?? 'pending';
                if($st === 'done') $doneCount++;
                $visualStatus = $st === 'done' ? 'done' : ($d < $failedCutoffDay ? 'failed' : 'pending');
                $daysOut[$dk] = ['status' => $visualStatus];
            }

            $failedDesc = $this->_failedDaysDesc($data, $failedCutoffDay);
            $payCosts = [];
            foreach($failedDesc as $rank => $day){
                // Уже откупленный день не предлагаем купить повторно — но его ранг УЖЕ учтён в
                // $failedDesc выше, поэтому на цену СОСЕДНИХ (ещё не купленных) дней это не влияет.
                if(!empty($data['days'][strval($day)]['paid'])) continue;
                $payCosts[strval($day)] = $this->_payCost($config, $rank);
            }

            $todayCfg = $monthCfg['days'][strval($today)] ?? null;
            // 23.10.2026 (по прямому указанию — фича официально стартует с 1 ноября 2026,
            // до этого момента конкретные задания видимо НЕ раскрываются игроку, хотя сам
            // механизм (рандомный список октября, прогресс, тесты) уже работает "под капотом").
            // Сравнение строк вида "2026-10" < "2026-11" работает лексикографически корректно,
            // т.к. формат YYYY-MM фиксированной ширины.
            $isPreLaunch = isset($config['launch_month']) && $data['month'] < $config['launch_month'];
            $todayOut = null;
            if($todayCfg){
                $todayOut = [
                    'type'  => $todayCfg['type'],
                    'label' => $isPreLaunch ? 'Скоро' : RaznaryadkaProgress::taskLabel($config, $todayCfg),
                    // 24.10.2026 (по прямому указанию, уточнение): до старта фичи клиент не должен
                    // показывать "(0/100)" рядом со "Скоро" — need/prog обнуляются ТОЛЬКО в этом
                    // ответе (визуальная выдача), реальное число need для матчинга в
                    // RaznaryadkaProgress::report() берётся из конфига напрямую, не из этого поля.
                    'need'  => $isPreLaunch ? 0 : intval($todayCfg['need']),
                    'prog'  => $isPreLaunch ? 0 : intval($data['days'][strval($today)]['prog'] ?? 0),
                    'done'  => ($data['days'][strval($today)]['status'] ?? '') === 'done',
                ];
            }

            $claimed = $data['claimed'] ?? [];
            $tiersOut = [];
            foreach($config['reward_tiers'] as $tier){
                $need = $tier['need'] == -1 ? $daysInMonth : intval($tier['need']);
                $tiersOut[] = [
                    'need'       => $need,
                    'icon'       => $tier['label_icon'],
                    'amt'        => intval($tier['amt']),
                    'eligible'   => $doneCount >= $need,
                    'claimed'    => in_array($need, $claimed, true),
                ];
            }

            $nowMsk = RaznaryadkaProgress::mskNow();
            $midnight = clone $nowMsk;
            $midnight->modify('tomorrow midnight');
            $resetInMs = ($midnight->getTimestamp() - $nowMsk->getTimestamp()) * 1000;

            $this->ops->ok([
                'patch'         => $this->ops->patchCurrencies($user),
                'month'         => $data['month'],
                'day_today'     => $today,
                'days_in_month' => $daysInMonth,
                'days'          => $daysOut,
                'today'         => $todayOut,
                'done_count'    => $doneCount,
                'pay_costs'     => $payCosts,
                'reward_tiers'  => $tiersOut,
                'reset_in_ms'   => $resetInMs,
                // 23.10.2026 (по прямому указанию, уточнение): до launch_month таймер ("сколько
                // осталось до сброса") тоже не раскрывается настоящим обратным отсчётом — вместо
                // него клиент показывает статичную дату старта (01.11.2026).
                'pre_launch'    => $isPreLaunch,
            ]);
            } catch (\Throwable $e) {
                error_log('[Raznaryadka.getState] EXCEPTION uid=' . abs(intval($this->registry['uid'] ?? 0)) . ' | ' . get_class($e) . ': ' . $e->getMessage() . ' | ' . $e->getFile() . ':' . $e->getLine());
                return $this->ops->fail(99);
            }
        }

        function claim(){
            $need = intval($this->registry['user_params']['need'] ?? -1);
            if($need <= 0) return $this->ops->fail(54);

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            list($data, $config) = RaznaryadkaProgress::loadAndRollover($this->ops, $user);
            // 27.10.2026: см. тот же фикс в getState() — дни-в-месяце по целевому $data['month'].
            $daysInMonth = RaznaryadkaProgress::daysInMonthFor($data['month']);

            $tier = null;
            foreach($config['reward_tiers'] as $t){
                $tNeed = $t['need'] == -1 ? $daysInMonth : intval($t['need']);
                if($tNeed === $need){ $tier = $t; break; }
            }
            if(!$tier) return $this->ops->fail(54); // такого порога нет в конфиге этого месяца

            $claimed = $data['claimed'] ?? [];
            if(in_array($need, $claimed, true)) return $this->ops->fail(55); // уже забрано

            $doneCount = 0;
            foreach($data['days'] ?? [] as $d){ if(($d['status'] ?? '') === 'done') $doneCount++; }
            if($doneCount < $need) return $this->ops->fail(56); // ещё не выполнено нужное число заданий

            RaznaryadkaProgress::grantTier($this->ops, $user, $tier);
            $claimed[] = $need;
            $data['claimed'] = $claimed;
            $user['raznaryadka_data'] = json_encode($data, JSON_UNESCAPED_UNICODE);
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            error_log('[Raznaryadka.claim] uid=' . abs(intval($this->registry['uid'])) . ' награда забрана | need=' . $need);
            $this->ops->ok(['patch' => $this->ops->patchCurrencies($user)]);
        }

        function payDay(){
            $day = intval($this->registry['user_params']['day'] ?? -1);
            if($day <= 0) return $this->ops->fail(54);

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            list($data, $config) = RaznaryadkaProgress::loadAndRollover($this->ops, $user);
            // 24.10.2026: effectiveDay() = mskDay() + dev-only смещение (см. докблок в
            // raznaryadkaprogress.php) — везде, где раньше было "сегодня" для Разнарядки.
            $today = RaznaryadkaProgress::effectiveDay($data);
            if($day >= $today) return $this->ops->fail(54); // сегодняшний/будущий день нельзя откатить — ещё не провален

            // 26.10.2026 (см. тот же гейт в getState() — фича не считается "живой" для месяцев
            // раньше launch_month): без этого игрок мог бы вручную дёрнуть payDay() для дня ДО
            // реального старта фичи — клиент такой кнопки не покажет (status не 'failed'), но
            // сервер обязан быть источником истины сам, не полагаться на то, что клиент не
            // пришлёт такой запрос.
            $launchMonth = $config['launch_month'] ?? null;
            $featureLive = !$launchMonth || $data['month'] >= $launchMonth;
            if(!$featureLive) return $this->ops->fail(55); // фича ещё не стартовала для этого месяца — нечего откупать

            $failedDesc = $this->_failedDaysDesc($data, $today);
            $rank = array_search($day, $failedDesc, true);
            if($rank === false) return $this->ops->fail(55); // день не в числе проваленных (выполнен по-настоящему/вне месяца)
            if(!empty($data['days'][strval($day)]['paid'])) return $this->ops->fail(55); // уже откуплен ранее — повторно нельзя

            $cost = $this->_payCost($config, $rank);
            if(!$this->ops->deduct($user, 'stew', $cost)) return $this->ops->fail(56); // недостаточно тушёнки

            $dayKey = strval($day);
            if(!isset($data['days'][$dayKey])) $data['days'][$dayKey] = ['prog' => 0];
            $data['days'][$dayKey]['status'] = 'done';
            $data['days'][$dayKey]['paid'] = true;

            $user['raznaryadka_data'] = json_encode($data, JSON_UNESCAPED_UNICODE);
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            error_log('[Raznaryadka.payDay] uid=' . abs(intval($this->registry['uid'])) . ' день ' . $day . ' откатен за ' . $cost . ' тушёнки (ранг ' . ($rank+1) . ')');
            $this->ops->ok(['patch' => $this->ops->patchCurrencies($user), 'cost' => $cost]);
        }

        // ── DEV-ПАНЕЛЬ (23.10.2026, по прямому указанию) ────────────────────────────────
        // Мгновенно засчитывает сегодняшнее задание как выполненное (prog=need) — без этого
        // пришлось бы реально фармить нужное действие, чтобы увидеть кнопку "ЗАБРАТЬ"/попасть
        // в count для порогов наград.
        function devCompleteToday(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            list($data, $config) = RaznaryadkaProgress::loadAndRollover($this->ops, $user);
            // 24.10.2026: effectiveDay() = mskDay() + dev-only смещение (см. докблок в
            // raznaryadkaprogress.php) — везде, где раньше было "сегодня" для Разнарядки.
            $today = RaznaryadkaProgress::effectiveDay($data);
            // 27.10.2026: дни-в-месяце по целевому $data['month'] (см. фикс в getState()).
            $monthCfg = RaznaryadkaProgress::monthConfig($config, $data['month'], RaznaryadkaProgress::daysInMonthFor($data['month']));
            $dayCfg = $monthCfg['days'][strval($today)] ?? null;
            if($dayCfg){
                $data['days'][strval($today)] = ['prog' => intval($dayCfg['need']), 'status' => 'done'];
            }
            $user['raznaryadka_data'] = json_encode($data, JSON_UNESCAPED_UNICODE);
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            $this->ops->ok(['patch' => $this->ops->patchCurrencies($user)]);
        }

        // Сбрасывает указанный ПРОШЕДШИЙ день обратно в "не выполнено" — чтобы проверить
        // попап отката тушёнкой, не дожидаясь реального провала (00:00 МСК).
        function devFailDay(){
            $day = intval($this->registry['user_params']['day'] ?? -1);
            if($day <= 0) return $this->ops->fail(54);

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            list($data, $config) = RaznaryadkaProgress::loadAndRollover($this->ops, $user);
            // 24.10.2026: effectiveDay() = mskDay() + dev-only смещение (см. докблок в
            // raznaryadkaprogress.php) — везде, где раньше было "сегодня" для Разнарядки.
            $today = RaznaryadkaProgress::effectiveDay($data);
            if($day >= $today) return $this->ops->fail(54); // только прошедшие дни можно "провалить" задним числом

            $data['days'][strval($day)] = ['prog' => 0, 'status' => 'pending'];
            $user['raznaryadka_data'] = json_encode($data, JSON_UNESCAPED_UNICODE);
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            $this->ops->ok(['patch' => $this->ops->patchCurrencies($user)]);
        }

        // 24.10.2026 (по прямому указанию — "сделай как будто там какие-то задания выполнены,
        // какие-то нет, мне нужно проверить попытку откупа заданий, всю логику"): засевает ВСЕ
        // прошедшие дни месяца случайным статусом (done/pending), без фарма реальных действий и
        // без devFailDay/devCompleteToday по одному дню за раз — сразу готовая "рваная" картина
        // для проверки попапа выкупа (ранги 2/4/8/16/32/64 среди проваленных дней) и получения
        // наград за пороги.
        function devSeedMonth(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            list($data, $config) = RaznaryadkaProgress::loadAndRollover($this->ops, $user);
            // 24.10.2026: effectiveDay() = mskDay() + dev-only смещение (см. докблок в
            // raznaryadkaprogress.php) — везде, где раньше было "сегодня" для Разнарядки.
            $today = RaznaryadkaProgress::effectiveDay($data);
            // 27.10.2026: дни-в-месяце по целевому $data['month'] (см. фикс в getState()).
            $monthCfg = RaznaryadkaProgress::monthConfig($config, $data['month'], RaznaryadkaProgress::daysInMonthFor($data['month']));

            for($day = 1; $day < $today; $day++){
                $dayCfg = $monthCfg['days'][strval($day)] ?? null;
                $need = $dayCfg ? intval($dayCfg['need']) : 1;
                if(mt_rand(0, 1) === 1){
                    $data['days'][strval($day)] = ['prog' => $need, 'status' => 'done'];
                } else {
                    $data['days'][strval($day)] = ['prog' => 0, 'status' => 'pending'];
                }
            }

            $user['raznaryadka_data'] = json_encode($data, JSON_UNESCAPED_UNICODE);
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            error_log('[Raznaryadka.devSeedMonth] uid=' . abs(intval($this->registry['uid'])) . ' засеяно ' . ($today - 1) . ' прошедших дней случайным статусом');
            $this->ops->ok(['patch' => $this->ops->patchCurrencies($user)]);
        }

        // 24.10.2026 (по прямому указанию — "кнопка, при нажатии на которую следующий день
        // становится автоматически"): сдвигает dev_day_offset на +1 — всё, что опирается на
        // RaznaryadkaProgress::effectiveDay() (getState/payDay/devCompleteToday/devFailDay/
        // devSeedMonth/report()), с этого момента считает "сегодня" на день позже. Капается на
        // последний день РЕАЛЬНОГО месяца — переход за его пределы дал бы пустой $dayCfg везде
        // (monthCfg хранит только дни 1..daysInMskMonth этого месяца).
        function devSkipDay(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            list($data, $config) = RaznaryadkaProgress::loadAndRollover($this->ops, $user);
            // 27.10.2026 (тот же баг, что в effectiveDay() — см. докблок baseDay() в
            // raznaryadkaprogress.php): капать смещение нужно относительно БАЗЫ целевого месяца
            // (1, если $data['month'] форснут вперёд реального; иначе реальный mskDay()) и
            // дней-в-ЦЕЛЕВОМ месяце, а не реального текущего — иначе в форснутом вперёд коротком
            // месяце (например ноябрь, 30 дней, при реальном октябре 31) офсет считался бы от
            // неверной пары чисел.
            $daysInMonth = RaznaryadkaProgress::daysInMonthFor($data['month'] ?? RaznaryadkaProgress::mskMonthKey());
            $base = RaznaryadkaProgress::baseDay($data);
            $maxOffset = max(0, $daysInMonth - $base);
            $offset = min(intval($data['dev_day_offset'] ?? 0) + 1, $maxOffset);
            $data['dev_day_offset'] = $offset;

            $user['raznaryadka_data'] = json_encode($data, JSON_UNESCAPED_UNICODE);
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            error_log('[Raznaryadka.devSkipDay] uid=' . abs(intval($this->registry['uid'])) . ' dev_day_offset=' . $offset . ' (эффективный день=' . RaznaryadkaProgress::effectiveDay($data) . ')');
            $this->ops->ok(['patch' => $this->ops->patchCurrencies($user), 'day_offset' => $offset]);
        }

        // Возвращает Разнарядку на РЕАЛЬНЫЙ сегодняшний день — отменяет накопленные devSkipDay().
        function devResetDaySkip(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            list($data, $config) = RaznaryadkaProgress::loadAndRollover($this->ops, $user);
            $data['dev_day_offset'] = 0;

            $user['raznaryadka_data'] = json_encode($data, JSON_UNESCAPED_UNICODE);
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            error_log('[Raznaryadka.devResetDaySkip] uid=' . abs(intval($this->registry['uid'])) . ' dev_day_offset сброшен в 0');
            $this->ops->ok(['patch' => $this->ops->patchCurrencies($user)]);
        }

        // 25.10.2026 (по прямому указанию — "кнопка, при нажатии на которую ежедневные задания
        // станут такими, как будто на 1 ноября", dev-панель): переключает месяц на
        // config['launch_month'] — закрывает текущий месяц (автосбор невыбранных наград) той же
        // логикой, что обычная граница календарного месяца, см. RaznaryadkaProgress::
        // devForceLaunchMonth(). Не трогает реальные системные часы сервера.
        function devForceLaunchMonth(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $data = RaznaryadkaProgress::devForceLaunchMonth($this->ops, $user);
            if($data === null) return $this->ops->fail(54); // launch_month не задан в конфиге

            $user['raznaryadka_data'] = json_encode($data, JSON_UNESCAPED_UNICODE);
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            error_log('[Raznaryadka.devForceLaunchMonth] uid=' . abs(intval($this->registry['uid'])) . ' месяц переключён на ' . $data['month']);
            $this->ops->ok(['patch' => $this->ops->patchCurrencies($user)]);
        }

        // 27.10.2026 (по прямому указанию — "кнопка вернуть как должно быть", два проверяемых
        // состояния — pre-launch/live): обратная операция к devForceLaunchMonth() — возвращает
        // Разнарядку на реальный текущий МСК-месяц с чистого состояния (см.
        // RaznaryadkaProgress::devRevertToRealMonth()).
        function devRevertToRealMonth(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $data = RaznaryadkaProgress::devRevertToRealMonth($this->ops, $user);

            $user['raznaryadka_data'] = json_encode($data, JSON_UNESCAPED_UNICODE);
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            error_log('[Raznaryadka.devRevertToRealMonth] uid=' . abs(intval($this->registry['uid'])) . ' месяц возвращён на ' . $data['month']);
            $this->ops->ok(['patch' => $this->ops->patchCurrencies($user)]);
        }
    }
?>
