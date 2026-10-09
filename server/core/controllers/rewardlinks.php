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

        // 08.10.2026 — см. комментарий у места использования в claim(): ammo_machete/ammo_gun/
        // ammo_auto не являются независимой валютой, это легаси-зеркало weapons[idx].qty.
        const WEAPON_AMMO_MAP = ['ammo_machete' => 3, 'ammo_gun' => 4, 'ammo_auto' => 5];

        // 09.10.2026 (расширение фикса гонки от этого же дня — по прямому запросу "посмотри,
        // есть ли ещё такие же места несинхронизированности в наградных ссылках"): помимо
        // weapons/shmot/bosses_data, _applyRewardEntry() пишет ЕЩЁ 7 "плоских" (не-JSON) полей
        // — coins/cigarettes/stew/respect/exp/energy ('currency') и habar_bought ('habar').
        // Проверено построчно по всем server/core/controllers/*.php (grep `lockCols\s*=`):
        // habar_bought лочится в habar.php.buy() (вместе с habar_counts и ценовой валютой);
        // coins/cigarettes/stew/energy лочатся в base.php/vassilich.php/habar.php.collectDay();
        // exp лочится в yashik.php.collect(). Т.е. ровно тот же класс гонки, что уже был у
        // weapons (конкурентный claim() между loadUser() и saveUser() читает и потом тупо
        // перезатирает устаревшим снимком то, что эти контроллеры успели закоммитить под своим
        // локом) — просто для других колонок той же строки. 'respect' сейчас не лочится НИГДЕ
        // (poker.php/blackjack.php/zone.php тоже пишут его без лока — это отдельная, более
        // широкая архитектурная задача, не специфичная для наградных ссылок), добавлен сюда не
        // для защиты от них, а чтобы два параллельных claim() по разным ссылкам одного игрока
        // не затирали друг друга.
        const PLAIN_LOCK_FIELDS = ['coins', 'cigarettes', 'stew', 'respect', 'exp', 'energy', 'habar_bought'];

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

        // 08.10.2026 (вынесено из claim() при фиксе бага "посылки оружия не используются") —
        // ЧИСТАЯ логика разбора ОДНОЙ строки награды, без $link/БД (только $this->ops->j()/i()/
        // add()/applyShmotOwnBonus(), все — операции над переданным по ссылке $user). Вынесено
        // отдельным методом специально для тестируемости — этот код не трогает SQL вообще,
        // поэтому его можно звать через ReflectionMethod с минимальным фейковым registry/ops,
        // без мока mysqli (см. tests/_php_fixtures/rewardlinks-weapon-ammo-sync-core.php).
        //
        // $state — общее изменяемое состояние между вызовами для одной claim(): ['shmot'=>...,
        // 'bosses_data'=>...,'weapons'=>...], лениво инициализируется из $user при первом
        // обращении к соответствующему ключу (тот же паттерн, что раньше был инлайн в claim()).
        // Возвращает запись для $summary, либо null, если строка не дала результата (некорректный
        // kind/поле, уже владеет предметом и т.п.) — эти строки в $summary не попадают.
        private function _applyRewardEntry(&$user, $entry, &$state){
            $kind = $entry['kind'] ?? '';

            if($kind === 'currency'){
                $field  = strval($entry['field'] ?? '');
                $amount = intval($entry['amount'] ?? 0);
                if(!in_array($field, self::CURRENCY_FIELDS, true) || $amount <= 0) return null;

                // 08.10.2026 (баг по репорту — "получили посылки оружия, но не могут его
                // использовать, при атаке вылетает ошибка"): ammo_machete/ammo_gun/ammo_auto —
                // ЛЕГАСИ-поле, чистое ЗЕРКАЛО weapons[idx].qty (см. weapons.php.buy(), комментарий
                // "Легаси-поле патрона — ОТДЕЛЬНАЯ колонка"). bosses.php.attack() читает
                // ИСКЛЮЧИТЕЛЬНО weapons[idx].owned/qty — само это легаси-поле боевого веса не
                // имеет. Раньше эти три поля обрабатывались как обычная валюта ($this->ops->add())
                // — оружие оставалось НЕ купленным (owned=false), клиент получал fail(89) "оружие
                // не куплено" при попытке атаковать, а сам "бонус" рано или поздно молча
                // затирался следующим легитимным weapons.php.buy() (он пишет ammoKey =
                // weapons[idx].qty СВЕЖИМ значением, не суммой — переданное по ссылке число
                // просто терялось без следа).
                if(isset(self::WEAPON_AMMO_MAP[$field])){
                    $wid = self::WEAPON_AMMO_MAP[$field];
                    if($state['weapons'] === null) $state['weapons'] = $this->ops->j($user, 'weapons', []);
                    while(count($state['weapons']) <= $wid) $state['weapons'][] = ['owned' => false, 'equipped' => false, 'upg' => 0, 'qty' => 0];
                    if(!isset($state['weapons'][$wid]['qty'])) $state['weapons'][$wid]['qty'] = 0;
                    $state['weapons'][$wid]['owned'] = true;
                    $state['weapons'][$wid]['qty']   = intval($state['weapons'][$wid]['qty']) + $amount;
                    // Тот же легаси-паттерн зеркала, что weapons.php.buy() — присваиваем
                    // СВЕЖИМ итоговым qty (не прибавляем отдельно), иначе поле снова разойдётся
                    // с источником правды при следующем чтении до buy()/attack().
                    $user[$field] = strval($state['weapons'][$wid]['qty']);
                    return ['kind' => 'currency', 'field' => $field, 'amount' => $amount];
                }

                $this->ops->add($user, $field, $amount);
                return ['kind' => 'currency', 'field' => $field, 'amount' => $amount];
            }

            if($kind === 'shmot'){
                $itemId = intval($entry['itemId'] ?? -1);
                if($itemId < 0) return null;
                if($state['shmot'] === null) $state['shmot'] = $this->ops->j($user, 'shmot', []);
                while(count($state['shmot']) <= $itemId) $state['shmot'][] = ['owned' => false, 'equipped' => false];
                if(empty($state['shmot'][$itemId]['owned'])){
                    $state['shmot'][$itemId]['owned'] = true;
                    $this->ops->applyShmotOwnBonus($user, $itemId);
                    return ['kind' => 'shmot', 'itemId' => $itemId];
                }
                return null;
            }

            if($kind === 'key'){
                $bossId = intval($entry['bossId'] ?? -1);
                $amount = intval($entry['amount'] ?? 1);
                if($bossId < 0 || $bossId > 7 || $amount <= 0) return null;
                if($state['bosses_data'] === null) $state['bosses_data'] = $this->ops->j($user, 'bosses_data', []);
                if(!isset($state['bosses_data']['keys']) || !is_array($state['bosses_data']['keys'])) $state['bosses_data']['keys'] = array_fill(0, 8, 0);
                while(count($state['bosses_data']['keys']) < 8) $state['bosses_data']['keys'][] = 0;
                $state['bosses_data']['keys'][$bossId] = intval($state['bosses_data']['keys'][$bossId]) + $amount;
                return ['kind' => 'key', 'bossId' => $bossId, 'amount' => $amount];
            }

            if($kind === 'habar'){
                // 27.09.2026 (по прямому указанию — "выдача хабаров по ссылке, чтобы игрок мог
                // собирать 30 дней как обычно"): выдаём ТОТ ЖЕ habar_bought=containerId+1, что и
                // habar.php.buy() при покупке за валюту — это единственное поле, которое
                // разблокирует habar.php.collectDay() (30-дневный ежедневный сбор). "Один хабар в
                // одни руки" — то же правило, что и в buy() (код=56 там же): если у игрока УЖЕ
                // есть хабар (куплен раньше или получен по другой ссылке), строка молча
                // пропускается (не перезаписываем чужой/уже открытый хабар), как и shmot выше
                // пропускает уже принадлежащий предмет.
                $containerId = intval($entry['containerId'] ?? -1);
                if($containerId < 0 || $containerId > 3) return null;
                if($this->ops->i($user, 'habar_bought') > 0) return null;
                $user['habar_bought'] = $containerId + 1;
                return ['kind' => 'habar', 'containerId' => $containerId];
            }

            return null;
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

            // 09.10.2026 (баг по живому репорту — "купил оружие, но оно обнулилось после
            // промокода"): weapons/shmot/bosses_data — те же поля, что weapons.php.buy()/
            // upgrade() и bosses.php.attack() уже защищают SELECT...FOR UPDATE (04.10.2026,
            // "аудит гонок состояний", см. комментарий там же) — здесь, в claim(), этого лока
            // не было, хотя он читает-мутирует-пишет ровно те же поля той же строки игрока.
            // Конкурентный запрос (покупка оружия, удар боссу, другой claim) между loadUser()
            // выше и saveUser() ниже читал СВОЙ снимок и сохранял его ПОЗЖЕ — тёр только что
            // начисленную/купленную награду целиком (classic lost update). Берём тот же
            // физический лок строки, что и остальные файлы (любая FOR UPDATE-транзакция на
            // этой строке — из ЛЮБОГО файла — реально ждёт COMMIT), и перечитываем САМЫЕ
            // свежие weapons/shmot/bosses_data ПОД локом прямо перед тем, как их мутировать.
            // 09.10.2026 — расширено на PLAIN_LOCK_FIELDS (см. комментарий у константы выше) —
            // те же причины, другие колонки.
            $jsonLockFields = ['weapons', 'shmot', 'bosses_data'];
            $allLockFields  = array_merge($jsonLockFields, self::PLAIN_LOCK_FIELDS);
            $link->begin_transaction();
            $lockColList = implode(',', array_map(function($c){ return "`$c`"; }, $allLockFields));
            $lockRes = $link->query("SELECT $lockColList FROM `{$this->registry['utb']}` WHERE `id`=" . $uid . " FOR UPDATE");
            $lockRow = ($lockRes && $lockRes->num_rows > 0) ? $lockRes->fetch_assoc() : null;
            if($lockRow !== null){
                foreach($allLockFields as $lockedField){
                    if($lockRow[$lockedField] !== null) $user[$lockedField] = $lockRow[$lockedField];
                }
            }

            // Снимок PLAIN_LOCK_FIELDS СРАЗУ ПОСЛЕ перечитывания под локом, но ДО применения
            // наград — currency/habar-записи мутируют $user напрямую (через $this->ops->add()/
            // прямое присваивание, см. _applyRewardEntry()), а не через $state, как
            // weapons/shmot/bosses_data — этот снимок нужен ниже, чтобы понять, какие из них
            // реально изменились именно в ЭТОМ claim().
            $plainBefore = [];
            foreach(self::PLAIN_LOCK_FIELDS as $f) $plainBefore[$f] = $user[$f] ?? null;

            $summary = [];
            $state = ['shmot' => null, 'bosses_data' => null, 'weapons' => null];
            foreach($reward as $entry){
                $result = $this->_applyRewardEntry($user, $entry, $state);
                if($result !== null) $summary[] = $result;
            }
            $shmotState   = $state['shmot'];
            $bossesData   = $state['bosses_data'];
            $weaponsState = $state['weapons'];

            if(empty($summary)){
                // Все строки награды оказались пустыми/некорректными (например, ссылку
                // сгенерировали без валидных полей) — ничего не выдаём, откатываем claim, чтобы
                // игрок мог получить награду позже, если её поправят вручную в БД.
                $link->rollback();
                $_rollbackClaim();
                $link->close();
                error_log('[Rewardlinks.claim] код=' . $code . ' дал пустой summary (reward: ' . $row['reward'] . '), uid=' . $uid);
                return $this->ops->ok(['claimed' => 0, 'reason' => 'notfound']);
            }

            // weapons/shmot/bosses_data + изменившиеся PLAIN_LOCK_FIELDS пишем ОТДЕЛЬНЫМ UPDATE
            // внутри ТОЙ ЖЕ транзакции, прямо под локом, выставленным выше — тот же приём, что
            // weapons.php.buy() (см. комментарий там). Эти ключи НЕ передаём в общий $user для
            // saveUser() ниже — иначе он переписал бы их устаревшим снимком из loadUser() в
            // начале функции, сводя на нет весь смысл лока. Присваиваем их в $user только ПОСЛЕ
            // saveUser().
            $lockedUpdates = [];
            if($shmotState   !== null) $lockedUpdates['shmot']       = json_encode($shmotState);
            if($bossesData   !== null) $lockedUpdates['bosses_data'] = json_encode($bossesData);
            if($weaponsState !== null) $lockedUpdates['weapons']     = json_encode($weaponsState);
            foreach(self::PLAIN_LOCK_FIELDS as $f){
                if(isset($user[$f]) && $user[$f] !== $plainBefore[$f]) $lockedUpdates[$f] = strval($user[$f]);
            }
            if(!empty($lockedUpdates)){
                $setParts = [];
                foreach($lockedUpdates as $col => $val) $setParts[] = "`$col`='" . $link->real_escape_string($val) . "'";
                $link->query("UPDATE `{$this->registry['utb']}` SET " . implode(',', $setParts) . " WHERE `id`=" . $uid);
            }
            $link->commit();
            foreach(array_keys($lockedUpdates) as $col) unset($user[$col]);

            if(!$this->ops->saveUser($user)){
                // weapons/shmot/bosses_data/PLAIN_LOCK_FIELDS уже закоммичены под локом выше —
                // реальная награда (как минимум эта часть) УЖЕ выдана, поэтому НЕ откатываем
                // claim (иначе игрок мог бы получить её повторно) — только логируем частичный
                // сбой.
                $link->close();
                error_log('[Rewardlinks.claim] код=' . $code . ' uid=' . $uid . ' — часть полей закоммичена под локом, но saveUser() для остальных полей упал');
                return $this->ops->fail(99);
            }
            foreach($lockedUpdates as $col => $val) $user[$col] = $val;

            $link->close();

            error_log('[Rewardlinks.claim] код=' . $code . ' выдан uid=' . $uid . ' | summary=' . json_encode($summary, JSON_UNESCAPED_UNICODE));

            $patch = $this->ops->patchCurrencies($user, array_merge(self::CURRENCY_FIELDS, ['shmot', 'bosses_data', 'habar_bought', 'max_energy', 'weapons']));
            $this->ops->ok(['claimed' => 1, 'patch' => $patch, 'summary' => $summary]);
        }
    }
?>
