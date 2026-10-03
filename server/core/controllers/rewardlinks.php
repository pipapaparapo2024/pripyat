<?php
    // ── НАГРАДНЫЕ ССЫЛКИ (25.09.2026, по прямому указанию) ──────────────────────────────
    //
    // Отдельный сайт-генератор (vk_game/сайт/, деплоится на этот же сервер, /rewards-admin/)
    // создаёт запись в reward_links (код + JSON награды + опциональный срок действия) и отдаёт
    // администратору ссылку вида vk.com/app<id>?reward=CODE. Клиент при загрузке главного
    // экрана (game-boot.js._finishLoading → modules/reward-link.js) видит `reward` в
    // vk_params (index.js уже парсит ВСЕ query-параметры лаунч-ссылки в window.vk_params, не
    // только vk_*) и шлёт сюда rewardlinks.claim.
    //
    // Тот же класс защиты, что и у остальной server-authoritative экономики: клиент передаёт
    // только code (строку) — какую награду и сколько выдать, решает ИСКЛЮЧИТЕЛЬНО сервер по
    // содержимому reward_links.reward, прочитанному из БД. Один игрок может получить ОДНУ
    // конкретную ссылку только один раз (уникальный индекс reward_link_claims(link_id,user_id) +
    // явная проверка ДО применения награды) — ссылка при этом остаётся рабочей для ДРУГИХ
    // игроков (по прямому указанию — "многоразовая, но каждый игрок может получить строго
    // только один раз").
    Class Rewardlinks {
        private $registry, $ops;

        const CURRENCY_FIELDS = ['coins', 'cigarettes', 'stew', 'respect', 'exp', 'energy',
            'ammo_auto', 'ammo_gun', 'ammo_machete'];

        public $permits;

        function __construct($registry){
            $this->registry = $registry;
            $this->ops = new Gameops($registry);
            $this->permits = ['claim'];
        }

        // reward_links/reward_link_claims — глобальные таблицы, не привязаны к текущему
        // игроку через udb/utb — тот же паттерн прямого подключения, что zone.php._rawLink()/
        // bosses.php._rawLink().
        private function _rawLink(){
            $link = new mysqli($this->registry['server'], $this->registry['user'], $this->registry['pass'], $this->registry['db'], 3306);
            if($link->connect_error) return null;
            $link->set_charset('utf8mb4');
            return $link;
        }

        function claim(){
            $code = isset($this->registry['user_params']['code']) ? trim(strval($this->registry['user_params']['code'])) : '';
            if($code === '' || strlen($code) > 64) return $this->ops->ok(['claimed' => 0, 'reason' => 'notfound']);

            $link = $this->_rawLink();
            if(!$link) return $this->ops->fail(99);

            $uid = intval($this->registry['uid']);
            $now = time();

            $stmt = $link->prepare('SELECT id, reward, expires_at, active FROM reward_links WHERE code = ? LIMIT 1');
            $stmt->bind_param('s', $code);
            $stmt->execute();
            $row = $stmt->get_result()->fetch_assoc();
            $stmt->close();

            if(!$row || !intval($row['active'])){
                $link->close();
                return $this->ops->ok(['claimed' => 0, 'reason' => 'notfound']);
            }
            $linkId = intval($row['id']);

            if($row['expires_at'] !== null && intval($row['expires_at']) > 0 && $now > intval($row['expires_at'])){
                $link->close();
                error_log('[Rewardlinks.claim] код=' . $code . ' истёк (expires_at=' . $row['expires_at'] . ', now=' . $now . '), uid=' . $uid);
                return $this->ops->ok(['claimed' => 0, 'reason' => 'expired']);
            }

            // 27.09.2026 (по прямому указанию — "проверь чтобы за одну ссылку не давали
            // награду дважды"): раньше здесь был SELECT "уже получено?" (см. историю), а сама
            // отметка INSERT INTO reward_link_claims писалась в САМОМ КОНЦЕ, уже после того как
            // награда начислена и users сохранён. Между SELECT и финальным INSERT — окно гонки:
            // два одновременных claim() (двойной клик/replay запроса) оба проходят SELECT (ни
            // один claim ещё не записан), оба начисляют награду, и только ВТОРОЙ INSERT падает
            // на UNIQUE KEY uniq_link_user(link_id,user_id) (см. migrate22.php) — но к этому
            // моменту награда уже выдана дважды. Фикс: сама отметка о получении теперь пишется
            // ПЕРВОЙ, ДО начисления награды — INSERT либо резервирует право получить (и тогда
            // начисляем), либо падает на дубликате (и тогда сразу выходим с reason:'already',
            // ничего не начисляя). Атомарность гарантирует та же UNIQUE-constraint в БД, просто
            // теперь она защищает ДО начисления, а не после.
            $stmtI = $link->prepare('INSERT IGNORE INTO reward_link_claims (link_id, user_id, claimed_at) VALUES (?, ?, ?)');
            $stmtI->bind_param('iii', $linkId, $uid, $now);
            $stmtI->execute();
            $reserved = $link->affected_rows === 1;
            $stmtI->close();
            if(!$reserved){
                $link->close();
                return $this->ops->ok(['claimed' => 0, 'reason' => 'already']);
            }

            // Со следующей строки claim уже зарезервирован — любой путь ниже, где награда
            // в итоге НЕ выдана (битый JSON, не удалось прочитать/сохранить юзера, пустой
            // summary), обязан откатить резервацию через этот же коллбэк, иначе игрок
            // навсегда теряет право получить ссылку, хотя реально ничего не получил.
            $_rollbackClaim = function() use ($link, $linkId, $uid){
                $stmtR = $link->prepare('DELETE FROM reward_link_claims WHERE link_id = ? AND user_id = ?');
                $stmtR->bind_param('ii', $linkId, $uid);
                $stmtR->execute();
                $stmtR->close();
            };

            $reward = json_decode($row['reward'], true);
            if(!is_array($reward)){
                $_rollbackClaim();
                $link->close();
                error_log('[Rewardlinks.claim] код=' . $code . ' — reward не распарсился как JSON-массив: ' . $row['reward']);
                return $this->ops->fail(99);
            }

            $user = $this->ops->loadUser();
            if(!$user){
                $_rollbackClaim();
                $link->close();
                return $this->ops->fail(99);
            }

            $summary = [];
            $shmotState = null;
            $bossesData = null;
            foreach($reward as $entry){
                $kind = $entry['kind'] ?? '';
                if($kind === 'currency'){
                    $field  = strval($entry['field'] ?? '');
                    $amount = intval($entry['amount'] ?? 0);
                    if(!in_array($field, self::CURRENCY_FIELDS, true) || $amount <= 0) continue;
                    $this->ops->add($user, $field, $amount);
                    $summary[] = ['kind' => 'currency', 'field' => $field, 'amount' => $amount];
                } else if($kind === 'shmot'){
                    $itemId = intval($entry['itemId'] ?? -1);
                    if($itemId < 0) continue;
                    if($shmotState === null) $shmotState = $this->ops->j($user, 'shmot', []);
                    while(count($shmotState) <= $itemId) $shmotState[] = ['owned' => false, 'equipped' => false];
                    if(empty($shmotState[$itemId]['owned'])){
                        $shmotState[$itemId]['owned'] = true;
                        $this->ops->applyShmotOwnBonus($user, $itemId);
                        $summary[] = ['kind' => 'shmot', 'itemId' => $itemId];
                    }
                } else if($kind === 'key'){
                    $bossId = intval($entry['bossId'] ?? -1);
                    $amount = intval($entry['amount'] ?? 1);
                    if($bossId < 0 || $bossId > 7 || $amount <= 0) continue;
                    if($bossesData === null) $bossesData = $this->ops->j($user, 'bosses_data', []);
                    if(!isset($bossesData['keys']) || !is_array($bossesData['keys'])) $bossesData['keys'] = array_fill(0, 8, 0);
                    while(count($bossesData['keys']) < 8) $bossesData['keys'][] = 0;
                    $bossesData['keys'][$bossId] = intval($bossesData['keys'][$bossId]) + $amount;
                    $summary[] = ['kind' => 'key', 'bossId' => $bossId, 'amount' => $amount];
                } else if($kind === 'habar'){
                    // 27.09.2026 (по прямому указанию — "выдача хабаров по ссылке, чтобы игрок
                    // мог собирать 30 дней как обычно"): выдаём ТОТ ЖЕ habar_bought=containerId+1,
                    // что и habar.php.buy() при покупке за валюту — это единственное поле,
                    // которое разблокирует habar.php.collectDay() (30-дневный ежедневный сбор).
                    // "Один хабар в одни руки" — то же правило, что и в buy() (см. код=56 там же):
                    // если у игрока УЖЕ есть хабар (куплен раньше или получен по другой ссылке),
                    // эта строка молча пропускается (не перезаписываем чужой/уже открытый хабар),
                    // как и shmot выше пропускает уже принадлежащий предмет.
                    $containerId = intval($entry['containerId'] ?? -1);
                    if($containerId < 0 || $containerId > 3) continue;
                    if($this->ops->i($user, 'habar_bought') > 0) continue;
                    $user['habar_bought'] = $containerId + 1;
                    $summary[] = ['kind' => 'habar', 'containerId' => $containerId];
                }
            }

            if(empty($summary)){
                // Все строки награды оказались пустыми/некорректными (например, ссылку
                // сгенерировали без валидных полей) — ничего не выдаём, откатываем claim, чтобы
                // игрок мог получить награду позже, если её поправят вручную в БД.
                $_rollbackClaim();
                $link->close();
                error_log('[Rewardlinks.claim] код=' . $code . ' дал пустой summary (reward: ' . $row['reward'] . '), uid=' . $uid);
                return $this->ops->ok(['claimed' => 0, 'reason' => 'notfound']);
            }

            if($shmotState !== null) $user['shmot'] = json_encode($shmotState);
            if($bossesData !== null) $user['bosses_data'] = json_encode($bossesData);

            if(!$this->ops->saveUser($user)){
                $_rollbackClaim();
                $link->close();
                return $this->ops->fail(99);
            }

            $link->close();

            error_log('[Rewardlinks.claim] код=' . $code . ' выдан uid=' . $uid . ' | summary=' . json_encode($summary, JSON_UNESCAPED_UNICODE));

            $patch = $this->ops->patchCurrencies($user, array_merge(self::CURRENCY_FIELDS, ['shmot', 'bosses_data', 'habar_bought', 'max_energy']));
            $this->ops->ok(['claimed' => 1, 'patch' => $patch, 'summary' => $summary]);
        }
    }
?>
