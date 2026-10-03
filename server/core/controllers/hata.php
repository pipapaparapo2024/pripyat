<?php
    // ── SERVER-AUTHORITATIVE ХАТА (22.09.2026, по прямому указанию) ──
    //
    // Баг: "хата после покупки снова просит её купить, хоть в ней и нахожусь". Причина была
    // на клиенте (hata.js._buyHata/_selectHata) — покупка шла через обычный fire-and-forget
    // TS.php('users.save', {...}, null, null): БЕЗ callback на успех/ошибку, локальный udata
    // менялся оптимистично ДО подтверждения сервера. Если конкретно этот users.save тихо не
    // сохранялся (сетевой сбой и т.п.), при следующей свежей загрузке (users.get) владение
    // откатывалось, и хата снова предлагалась к покупке — хотя игрок только что "жил в ней".
    // Заодно закрывает дыру: списание сигарет раньше шло client-side, игрок теоретически мог
    // подделать base_bg_owned/cigarettes через консоль (тот же класс дыр, что уже закрывали
    // для оружия/шмоток) — теперь сервер сам проверяет цену/разблокировку и сам пишет владение.
    Class Hata {
        private $registry, $ops;

        public $permits;

        function __construct($registry){
            $this->registry = $registry;
            $this->ops = new Gameops($registry);
            $this->permits = ['buy', 'select'];
        }

        private function _catalog(){
            return $this->ops->catalog('hata_config');
        }

        private function _findLoc($locId){
            foreach($this->_catalog()['locations'] as $l){
                if(intval($l['id']) === $locId) return $l;
            }
            return null;
        }

        // Та же логика разблокировки, что hata.js._render() — либо hata_progress (максимальный
        // побеждённый босс) дошёл до требуемого, либо есть прямой счётчик убийств этого босса
        // (boss_kills_N) как страховка для старых сохранений без hata_progress.
        private function _isUnlocked($user, $loc){
            $bossReq = intval($loc['bossReq']);
            if($bossReq < 0) return true;
            if($this->ops->i($user, 'hata_progress', -1) >= $bossReq) return true;
            return $this->ops->i($user, 'boss_kills_' . $bossReq, 0) > 0;
        }

        function buy(){
            $locId = intval($this->registry['user_params']['loc_id'] ?? -1);
            $loc = $this->_findLoc($locId);
            if(!$loc) return $this->ops->fail(54);

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            if(!$this->_isUnlocked($user, $loc)) return $this->ops->fail(94); // нужный босс ещё не побеждён

            $owned = $this->ops->j($user, 'base_bg_owned', [0]);
            if(in_array($locId, $owned)) return $this->ops->fail(52); // уже куплено

            $cost = intval($loc['cost']);
            if($cost > 0 && !$this->ops->deduct($user, 'cigarettes', $cost)) return $this->ops->fail(50); // не хватает сигарет

            $owned[] = $locId;
            $user['base_bg_owned']  = json_encode($owned);
            $user['base_bg_active'] = strval($locId);

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            $patch = $this->ops->patchCurrencies($user, ['cigarettes', 'base_bg_owned', 'base_bg_active']);
            $this->ops->ok(['patch' => $patch]);
        }

        // «Переезд» — бесплатный выбор уже купленной локации (или Кубрика, id0, который всегда
        // считается «купленным» по умолчанию — та же логика, что hata.js._getOwned() default [0]).
        function select(){
            $locId = intval($this->registry['user_params']['loc_id'] ?? -1);
            $loc = $this->_findLoc($locId);
            if(!$loc) return $this->ops->fail(54);

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            // 25.09.2026 (баг найден по прямому указанию + логу ошибки — "выбрал новую локацию,
            // захотел выбрать предыдущую (стартовую), сервер отказал кодом 53 'не куплена'"):
            // клиент (hata.js._render(), см. `h.id === 0 || isOwned`) ВСЕГДА показывает кнопку
            // ВЫБРАТЬ для Кубрика (id0), независимо от содержимого base_bg_owned — та же логика,
            // что уже применена к _isUnlocked() выше (`if($bossReq < 0) return true;`). Но
            // select() строго требовал locId физически внутри base_bg_owned — у части аккаунтов
            // (например заведённых/сброшенных до 22.09.2026 миграции хаты на сервер, когда
            // owned писался клиентом напрямую через users.save) это поле могло сохраниться БЕЗ
            // явного 0 внутри. Кубрик — бесплатная стартовая база, сервер не должен требовать то,
            // что клиент никогда явно не предлагает купить.
            $owned = $this->ops->j($user, 'base_bg_owned', [0]);
            if($locId !== 0 && !in_array($locId, $owned)) return $this->ops->fail(53); // локация не куплена

            $user['base_bg_active'] = strval($locId);
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            $patch = $this->ops->patchCurrencies($user, ['base_bg_active']);
            $this->ops->ok(['patch' => $patch]);
        }
    }
?>
