<?php
require_once __DIR__ . '/../models/weaponprogress.php';
require_once __DIR__ . '/../models/rewardlinktargets.php';
require_once __DIR__ . '/../models/rewardaudit.php';
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
        const PLAIN_LOCK_FIELDS = ['coins', 'cigarettes', 'stew', 'respect', 'exp', 'energy', 'habar_bought', 'habar_bought_ts', 'habar_days_collected', 'habar_last_collect_ts'];

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
                    WeaponProgress::acquire($state['weapons'][$wid], $amount, intval($state['weapons'][$wid]['qty']));
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
                // Действующий хабар сохраняем. Истёкший заменяем под блокировкой строки.
                // При неизвестной дате откатываем всю выдачу: ссылку не расходуем.
                $containerId = intval($entry['containerId'] ?? -1);
                if($containerId < 0 || $containerId > 3) return null;
                $nowMs = $state['now_ms'] ?? intval(round(microtime(true) * 1000));
                if($this->ops->i($user, 'habar_bought') > 0){
                    $start = $this->ops->i($user, 'habar_bought_ts');
                    if($start <= 0){$state['habar_blocked_reason']='habar_date_missing';return null;}
                    if($nowMs < Gameops::habarExpiresAtMs($start)){
                        $state['habar_blocked_reason']='habar_active';return null;
                    }
                }
                $user['habar_bought'] = $containerId + 1;
                $user['habar_bought_ts'] = $nowMs;
                $user['habar_days_collected'] = 0;
                $user['habar_last_collect_ts'] = 0;
                return ['kind' => 'habar', 'containerId' => $containerId];
            }

            return null;
        }

        private function auditReward(string $stage,string $reason): void {
            RewardAudit::write($stage,$reason,(string)$this->registry['db'],(int)$this->registry['uid'],trim(strval($this->registry['user_params']['code']??'')));
        }
        private function rewardResult(array $result,?string $reason=null){
            $this->auditReward('claim_result',$reason??(($result['claimed']??0)===1?'credited':($result['reason']??'unknown')));
            return $this->ops->ok($result);
        }
        function claim(){
            $this->auditReward('claim','requested');
            $code = trim(strval($this->registry['user_params']['code'] ?? ''));
            if($code === '' || strlen($code) > 64) return $this->rewardResult(['claimed'=>0,'reason'=>'notfound']);
            if(!RewardLinkTargets::matches($code,(string)$this->registry['db']))return $this->rewardResult(['claimed'=>0,'reason'=>'notfound'],'target_mismatch');
            $link = null;
            try {
                $link = $this->_rawLink();
                if(!$link){$this->auditReward('claim_result','database_unavailable');return $this->ops->fail(99);}
                if(!$link->begin_transaction()) throw new RuntimeException('Transaction failed');
                // Share-lock the definition while allowing other players to claim this link.
                $stmt = $link->prepare('SELECT id, reward, expires_at, active FROM reward_links WHERE code = ? LIMIT 1 LOCK IN SHARE MODE');
                $stmt->bind_param('s',$code);
                if(!$stmt->execute()) throw new RuntimeException('Link lookup failed');
                $row = $stmt->get_result()->fetch_assoc(); $stmt->close();
                if(!$row || !intval($row['active'])){
                    $link->rollback(); $link->close();
                    return $this->rewardResult(['claimed'=>0,'reason'=>'notfound']);
                }
                $uid=intval($this->registry['uid']);
                // All reward fields are read and written on this same locked connection.
                $res=$link->query("SELECT * FROM `{$this->registry['utb']}` WHERE `id`=$uid FOR UPDATE");
                if(!$res || !$res->num_rows) throw new RuntimeException('User missing');
                $user=$res->fetch_assoc(); $before=$user;
                // Evaluate expiry and receipt time after any wait for the user lock.
                $nowMs = intval(round(microtime(true) * 1000)); $now = intdiv($nowMs,1000);
                if(intval($row['expires_at'] ?? 0)>0 && $now>=intval($row['expires_at'])){
                    $link->rollback(); $link->close();
                    return $this->rewardResult(['claimed'=>0,'reason'=>'expired']);
                }
                $linkId=intval($row['id']);
                // The unique (link_id,user_id) reservation commits with the reward, never before it.
                $stmtI=$link->prepare('INSERT IGNORE INTO reward_link_claims (link_id, user_id, claimed_at) VALUES (?, ?, ?)');
                $stmtI->bind_param('iii',$linkId,$uid,$now);
                if(!$stmtI->execute()) throw new RuntimeException('Reservation failed');
                $reserved=$link->affected_rows===1; $stmtI->close();
                if(!$reserved){
                    $link->rollback(); $link->close();
                    return $this->rewardResult(['claimed'=>0,'reason'=>'already']);
                }
                $reward=json_decode($row['reward'],true);
                if(!is_array($reward)) throw new RuntimeException('Invalid reward');
                $state=['shmot'=>null,'bosses_data'=>null,'weapons'=>null,'now_ms'=>$nowMs]; $summary=[];
                foreach($reward as $entry){
                    if(!is_array($entry)) throw new RuntimeException('Invalid entry');
                    $result=$this->_applyRewardEntry($user,$entry,$state);
                    if($result!==null) $summary[]=$result;
                }
                if(($state['habar_blocked_reason'] ?? '')==='habar_date_missing' || !$summary){
                    $reason=$state['habar_blocked_reason'] ?? 'notfound';
                    $link->rollback(); $link->close();
                    return $this->rewardResult(['claimed'=>0,'reason'=>$reason]);
                }
                foreach(['shmot','bosses_data','weapons'] as $field) if($state[$field]!==null) $user[$field]=json_encode($state[$field]);
                if(isset($user['exp']) && strval($user['exp'])!==strval($before['exp'] ?? '')){
                    $user['level']=strval(max(0,(int)floor((-1+sqrt(1+intval($user['exp'])/5))/2)));
                }
                $updates=[];
                foreach($user as $field=>$value){
                    if($field==='id') continue;
                    if(is_array($value)) $value=json_encode($value);
                    if($value===($before[$field] ?? null) || ($value!==null && isset($before[$field]) && strval($value)===strval($before[$field]))) continue;
                    if(!array_key_exists($field,$before) || !preg_match('/^[a-z_]+$/D',$field)) throw new RuntimeException('Invalid reward field');
                    $updates[]="`$field`=".($value===null?'NULL':"'".$link->real_escape_string(strval($value))."'");
                }
                if(!$updates) throw new RuntimeException('Empty update');
                if(!$link->query("UPDATE `{$this->registry['utb']}` SET ".implode(',',$updates)." WHERE `id`=$uid")) throw new RuntimeException('Reward write failed');
                if(!$link->commit()) throw new RuntimeException('Commit failed');
                $link->close();
                $patch=$this->ops->patchCurrencies($user,array_merge(self::CURRENCY_FIELDS,['shmot','bosses_data','weapons','max_energy','energy_time','level','habar_bought','habar_bought_ts','habar_days_collected','habar_last_collect_ts']));
                return $this->rewardResult(['claimed'=>1,'patch'=>$patch,'summary'=>$summary]);
            } catch(Throwable $error){
                if($link){try{$link->rollback();}catch(Throwable $ignored){} $link->close();}
                $this->auditReward('claim_result','transaction_failed');
                return $this->ops->fail(99);
            }
        }
    }
?>
