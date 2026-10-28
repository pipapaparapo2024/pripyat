<?php
    // ── SERVER-AUTHORITATIVE "ЗАНАЧКИ" (26.10.2026, по прямому указанию — восстановление
    // полноценной механики коллекционных карточек поверх уже готовой инфраструктуры, см.
    // zanachkimodel.php докблок и AGENTS.md про историю stash_data/stash_count) ──
    //
    // Состояние (кол-во карточек по коллекциям, какие коллекции уже забраны, список запросов
    // у друзей) хранится частично в whitelist-поле stash_data (видно клиенту через users.get/
    // patch как обычно) и частично в server-only полях stash_claims/stash_wishlist (НЕ в
    // whitelist users.php — тот же паттерн, что raznaryadka_data/dice_session и т.п., клиент не
    // может подделать через users.save, читает/пишет только сам сервер).
    Class Zanachki {
        private $registry, $ops;

        public $permits;

        function __construct($registry){
            $this->registry = $registry;
            $this->ops = new Gameops($registry);
            $this->permits = ['getState', 'claimCollection', 'requestCard', 'cancelRequest', 'getFriendWishlist', 'giveCard', 'devGrantAll'];
        }

        private function _rawLink(){
            $link = new mysqli($this->registry['server'], $this->registry['user'], $this->registry['pass'], $this->registry['db'], 3306);
            if($link->connect_error) return null;
            $link->set_charset('utf8mb4');
            return $link;
        }

        // Два advisory-лока (GET_LOCK) по ОБОИМ uid, в детерминированном порядке (меньший id
        // первым) — иначе встречные giveCard() двух игроков друг другу одновременно могли бы
        // выстроиться в классический deadlock (A ждёт лок B, B ждёт лок A). Тот же примитив,
        // что zone.php._withUserLock(), обобщённый на пару имён.
        private function _withTwoUserLock($uidA, $uidB, callable $fn){
            $link = $this->_rawLink();
            if(!$link) return $fn();

            $lo = min($uidA, $uidB); $hi = max($uidA, $uidB);
            $lockLo = $link->real_escape_string('zanachki_user_' . $lo);
            $lockHi = $link->real_escape_string('zanachki_user_' . $hi);
            $link->query("SELECT GET_LOCK('{$lockLo}', 5)");
            $link->query("SELECT GET_LOCK('{$lockHi}', 5)");
            try {
                return $fn();
            } finally {
                $link->query("SELECT RELEASE_LOCK('{$lockHi}')");
                $link->query("SELECT RELEASE_LOCK('{$lockLo}')");
                $link->close();
            }
        }

        // Весь экран строится из одного вызова — коллекции (stash_data), какие уже забраны
        // (stash_claims), и свой список запросов (stash_wishlist).
        function getState(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $stashData = ZanachkiModel::getStashData($this->ops, $user);
            $claimed   = ZanachkiModel::getClaimedMap($this->ops, $user);
            $wishlist  = ZanachkiModel::getWishlist($this->ops, $user);

            $this->ops->ok([
                'patch'          => $this->ops->patchCurrencies($user, ['cigarettes', 'exp', 'stash_count']),
                'stashData'      => $stashData,
                'claimed'        => $claimed,
                'wishlist'       => $wishlist,
                'collectedCount' => count($claimed),
            ]);
        }

        function claimCollection(){
            $col = intval($this->registry['user_params']['collection_id'] ?? -1);

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $result = ZanachkiModel::claimCollectionReward($this->ops, $user, $col);
            if($result !== true) return $this->ops->fail($result);

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            error_log('[Zanachki.claimCollection] uid=' . abs(intval($this->registry['uid'])) . ' коллекция ' . $col . ' забрана, +' . ZanachkiModel::collectionReward($col) . ' сухарей/опыта');

            $this->ops->ok([
                'patch'   => $this->ops->patchCurrencies($user, ['cigarettes', 'exp', 'stash_claims', 'stash_data']),
                'claimed' => true,
            ]);
        }

        function requestCard(){
            $col = intval($this->registry['user_params']['collection_id'] ?? -1);
            $pos = intval($this->registry['user_params']['position'] ?? -1);

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $result = ZanachkiModel::requestCard($this->ops, $user, $col, $pos);
            if($result !== true) return $this->ops->fail($result);

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            $this->ops->ok(['wishlist' => ZanachkiModel::getWishlist($this->ops, $user)]);
        }

        function cancelRequest(){
            $col = intval($this->registry['user_params']['collection_id'] ?? -1);
            $pos = intval($this->registry['user_params']['position'] ?? -1);

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $result = ZanachkiModel::cancelRequest($this->ops, $user, $col, $pos);
            if($result !== true) return $this->ops->fail($result);

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
            $this->ops->ok(['wishlist' => ZanachkiModel::getWishlist($this->ops, $user)]);
        }

        // Показывает ЧУЖОЙ список запросов (при визите в гости, кнопка "Попросить заначки") —
        // плюс мои собственные количества по каждой запрошенной карточке, чтобы клиент сразу
        // знал, какие "Дать" активны, без второго запроса (см. docблок myOwnedCounts).
        function getFriendWishlist(){
            $uid = intval($this->registry['uid']);
            $targetId = intval($this->registry['user_params']['target_id'] ?? -1);
            if($targetId <= 0) return $this->ops->fail(54);
            if($targetId === $uid) return $this->ops->fail(93);

            $targetRow = $this->registry['udb']->getData(
                $this->registry['utb'], ['id', 'nick', 'stash_wishlist'], 'id=' . $targetId
            );
            if(isset($targetRow['error']) && $targetRow['error']) return $this->ops->fail(91);

            $raw = $targetRow['stash_wishlist'] ?? null;
            $wishlist = is_array($raw) ? $raw : (is_string($raw) && $raw !== '' ? json_decode($raw, true) : []);
            if(!is_array($wishlist)) $wishlist = [];
            $wishlist = array_values($wishlist);

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);
            $myStash = ZanachkiModel::getStashData($this->ops, $user);

            $myOwnedCounts = [];
            foreach($wishlist as $item){
                $colKey = strval(intval($item['col'] ?? 0));
                $posKey = strval(intval($item['pos'] ?? 0));
                $myOwnedCounts[$colKey . '_' . $posKey] = intval($myStash[$colKey][$posKey] ?? 0);
            }

            $this->ops->ok([
                'targetId'      => $targetId,
                'targetNick'    => strval($targetRow['nick'] ?? ''),
                'wishlist'      => $wishlist,
                'myOwnedCounts' => $myOwnedCounts,
            ]);
        }

        // Отдаёт 1 копию карточки из МОЕГО инвентаря ЦЕЛИ (target_id) — целевая карточка должна
        // реально быть в wishlist цели (защита от непрошеных подарков). Мутирует ОБЕ строки —
        // двойная блокировка по uid (см. _withTwoUserLock), запись цели идёт напрямую через udb
        // (может быть офлайн), тот же приём, что уже используется zaruba.php.pump().
        function giveCard(){
            $uid = intval($this->registry['uid']);
            $targetId = intval($this->registry['user_params']['target_id'] ?? -1);
            $col = intval($this->registry['user_params']['collection_id'] ?? -1);
            $pos = intval($this->registry['user_params']['position'] ?? -1);
            // 28.10.2026 (баг найден по прямому указанию — "нажимаем ОТПРАВИТЬ, ничего не
            // происходит"): раньше ни одна fail-ветка этого метода не логировалась (только
            // успех, см. error_log ниже) — по логам сервера было невозможно понять, ПОЧЕМУ
            // конкретная попытка отправки не прошла (ПРАВИЛО №8).
            if($targetId <= 0){ error_log('[Zanachki.giveCard] FAIL 54 (targetId<=0) uid=' . abs($uid)); return $this->ops->fail(54); }
            if($targetId === $uid){ error_log('[Zanachki.giveCard] FAIL 93 (targetId===uid) uid=' . abs($uid)); return $this->ops->fail(93); }

            $result = $this->_withTwoUserLock($uid, $targetId, function() use ($uid, $targetId, $col, $pos){
                $giver = $this->ops->loadUser();
                if(!$giver){ error_log('[Zanachki.giveCard] FAIL 99 (loadUser giver) uid=' . abs($uid)); return $this->ops->fail(99); }

                $targetRow = $this->registry['udb']->getData(
                    $this->registry['utb'], ['id', 'nick', 'stash_data', 'stash_wishlist'], 'id=' . $targetId
                );
                if(isset($targetRow['error']) && $targetRow['error']){ error_log('[Zanachki.giveCard] FAIL 91 (getData target) uid=' . abs($uid) . ' target_id=' . abs($targetId)); return $this->ops->fail(91); }
                $target = $targetRow;

                $giveResult = ZanachkiModel::giveCard($this->ops, $giver, $target, $col, $pos);
                if($giveResult !== true){
                    error_log('[Zanachki.giveCard] FAIL ' . $giveResult . ' (ZanachkiModel::giveCard) uid=' . abs($uid) . ' target_id=' . abs($targetId) . ' col=' . $col . ' pos=' . $pos);
                    return $this->ops->fail($giveResult);
                }

                if(!$this->ops->saveUser($giver)){ error_log('[Zanachki.giveCard] FAIL 99 (saveUser giver) uid=' . abs($uid)); return $this->ops->fail(99); }
                $this->registry['udb']->saveData($this->registry['utb'], [
                    'id'             => $targetId,
                    'stash_data'     => $target['stash_data'],
                    'stash_wishlist' => $target['stash_wishlist'],
                ]);

                error_log('[Zanachki.giveCard] uid=' . abs($uid) . ' → target_id=' . abs($targetId) . ' | col=' . $col . ' pos=' . $pos);

                return $this->ops->ok([
                    'patch' => $this->ops->patchCurrencies($giver, ['stash_data']),
                ]);
            });

            return $result;
        }

        // ── DEV-ПАНЕЛЬ (27.10.2026, по прямому указанию) ────────────────────────────────
        // Выдаёт +100 к КАЖДОЙ из 105 карточек (все 15 коллекций сразу) — без этого пришлось бы
        // реально фармить дроп по всей игре, чтобы проверить экран с заполненными коллекциями.
        // Тот же уровень доступа, что у остальных dev_force_*/devGrant*-пермитов в проекте —
        // защищён только отсутствием кнопки в обычном UI, см. AGENTS.md.
        function devGrantAll(){
            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            ZanachkiModel::grantAllCollections($this->ops, $user, 100);
            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            error_log('[Zanachki.devGrantAll] uid=' . abs(intval($this->registry['uid'])) . ' +100 к каждой из 105 карточек');
            $this->ops->ok(['patch' => $this->ops->patchCurrencies($user, ['stash_data'])]);
        }
    }
?>
