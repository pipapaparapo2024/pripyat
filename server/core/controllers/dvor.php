<?php
    // ── SERVER-AUTHORITATIVE СБОР СИГАРЕТ ВО ДВОРЕ (26.09.2026, перенос экономики;
    //    27.09.2026 — замена модели "1 раз в календарные сутки" на кулдаун 30 мин/облачко) ──
    //
    // Раньше клик по любому из 4 "облачков" на экране Двора считался ПОЛНОСТЬЮ на клиенте
    // (dvor.js._collectCig()) — и cigarettes, и dvor_daily_sigs (JSON {date,collected[4]})
    // были обычными client-writable полями в whitelist users.php, без единой серверной
    // проверки. Игрок мог открыть консоль браузера, выставить dvor_daily_sigs в "ничего не
    // собрано" (users.save) и собирать 4×30 сигарет неограниченное число раз в день, либо
    // просто напрямую подделать cigarettes. Найдено и задокументировано как регресс-маркер в
    // tests/dead-code-audit-dvor-fla-roulette-removed-cig-cloud-risk.test.js («Находка 1») —
    // этот контроллер и закрывает описанную там дыру.
    //
    // dvor_daily_sigs — server-only session-поле — НЕ в whitelist $allowed users.php (см.
    // список server-only полей в CLAUDE.md), читает/пишет его только сервер через
    // Gameops::loadUser()/saveUser() (полная строка, в обход whitelist), тот же принцип, что у
    // dice_session/poker_session/roulette_cups и т.п.
    //
    // 27.09.2026 (по прямому указанию — жалоба "облачка не отображаются у некоторых игроков"):
    // диагностика показала, что присланные "новые" арт-файлы (сбор сиг 1..4.png) байт-в-байт
    // идентичны (MD5) уже используемым cloud_sig_1..4.png — это НЕ замена картинки, ассеты на
    // проде и так уже актуальны (сверено вживую: HTTP 200 + совпадающий MD5 на
    // pripyat-game.ru/client/ver0_41/images/). Более вероятное объяснение репорта — старая
    // модель "1 раз в календарные сутки": игрок,
    // уже собравший облачко сегодня, не видел его до полуночи по СЕРВЕРНЫМ часам и трактовал
    // это как "не отображается/сломано". Формат dvor_daily_sigs сменился с
    // {date:'YYYY-MM-DD', collected:[bool×4]} на {lastMs:[int|null ×4]} — момент последнего
    // успешного сбора каждого облачка в мс (серверное время); собрать снова можно, когда
    // прошло >= SIG_COOLDOWN_MS с последнего lastMs[idx], независимо от календарных суток.
    Class Dvor {
        private $registry, $ops;

        public $permits;

        // Открытый вопрос пользователю: сумма награды (30 сигарет/облачко) оставлена БЕЗ
        // изменений — в задаче явно сказано "сохрани текущую сумму, не меняй баланс". Если
        // 30 минут — не то число, поменять здесь одной константой.
        const SIG_COOLDOWN_MS = 30 * 60 * 1000;

        function __construct($registry){
            $this->registry = $registry;
            $this->ops = new Gameops($registry);
            $this->permits = ['collectCig'];
        }

        // Читает dvor_daily_sigs из уже загруженного $user и приводит к валидной структуре —
        // если структура повреждена/отсутствует, состояние считается "ничего ещё не собиралось":
        // {lastMs:[null×4]}.
        private function _loadSigState($user){
            $state = $this->ops->j($user, 'dvor_daily_sigs', []);
            if(!isset($state['lastMs']) || !is_array($state['lastMs'])){
                $state = ['lastMs' => [null, null, null, null]];
            }
            while(count($state['lastMs']) < 4) $state['lastMs'][] = null;
            return $state;
        }

        // Клик по одному из 4 "облачков сигарет" во дворе — кулдаун 30 минут НА КАЖДОЕ
        // облачко отдельно (не общий, не привязан к календарным суткам): повторный вызов для
        // idx, у которого не прошло SIG_COOLDOWN_MS с последнего сбора, отклоняется fail(52).
        // Время — серверные часы (microtime), не устройство игрока.
        function collectCig(){
            $idx = intval($this->registry['user_params']['idx'] ?? -1);
            if($idx < 0 || $idx > 3) return $this->ops->fail(54);

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $nowMs = intval(round(microtime(true) * 1000)); // серверные часы — единый источник правды для ВСЕХ игроков
            $rawSigsFromDb = isset($user['dvor_daily_sigs']) ? $user['dvor_daily_sigs'] : null;
            $state = $this->_loadSigState($user);

            $lastMs = intval($state['lastMs'][$idx] ?? 0);
            if($lastMs > 0 && ($nowMs - $lastMs) < self::SIG_COOLDOWN_MS){
                $remainMs = self::SIG_COOLDOWN_MS - ($nowMs - $lastMs);
                error_log('[dvor.collectCig] uid=' . abs(intval($this->registry['uid']))
                    . ' idx=' . $idx . ' ОТКЛОНЕНО — кулдаун ещё не истёк, осталось ' . $remainMs . 'ms');
                return $this->ops->fail(52); // кулдаун 30 минут ещё не истёк для этого облачка
            }

            $state['lastMs'][$idx] = $nowMs;
            $this->ops->add($user, 'cigarettes', 30);
            $user['dvor_daily_sigs'] = json_encode($state);

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            error_log('[dvor.collectCig] uid=' . abs(intval($this->registry['uid'])) . ' idx=' . $idx
                . ' начислено +30 сигарет | nowMs=' . $nowMs . ' rawSigsFromDb=' . json_encode($rawSigsFromDb)
                . ' savedState=' . $user['dvor_daily_sigs']);

            // 'dvor_daily_sigs' явно включено в patch (как в habar.php.collectDay() —
            // habar_last_collect_ts) — иначе клиентский udata['dvor_daily_sigs'] останется
            // с моментом последней полной загрузки страницы, и периодический
            // _refreshCigSprites() в dvor.js (тикает раз в 30 сек) будет ошибочно показывать
            // только что собранное облачко снова видимым до следующего users.get().
            $this->ops->ok(['patch' => $this->ops->patchCurrencies($user, ['cigarettes', 'dvor_daily_sigs'])]);
        }
    }
?>
