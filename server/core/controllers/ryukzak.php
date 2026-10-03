<?php
    // ── SERVER-AUTHORITATIVE РЮКЗАК (21.09.2026, перенос экономики, по прямому указанию) ──
    //
    // Раньше открытие рюкзака (списание 20 тушёнки, розыгрыш оружия по весам, начисление
    // сигарет/рублей/опыта/ключей) целиком делал клиент (ryukzak.js._openRyukzakReward) — читер
    // мог вызвать награду без единой тушёнки. Теперь сервер сам проверяет и списывает тушёнку,
    // сам катает оружие и сам начисляет остальное по таблице server/json/ryukzak_config.json
    // (сверена построчно с прежним _client/src/data/ryukzak_rewards.json при переносе).
    //
    // По прямому указанию (21.09.2026): рюкзак открывается СКОЛЬКО УГОДНО раз подряд — очки
    // рюкзака (ryukzak_points, начисляются за убийство боссов в bosses.php.claimKill) влияют
    // ТОЛЬКО на то, какой из 20 уровней наград используется, а не на возможность открытия —
    // единственное условие открытия — 20 тушёнки. Уровень не может превышать 20 (массив
    // thresholds ровно из 20 порогов — level = индекс последнего пройденного порога + 1, больше
    // физически не бывает).
    //
    // 25.09.2026 (по прямому указанию — РЕВЕРС решения выше про накопленные очки): "рюкзак
    // после забора награды должен обнулять уровень до 0. Игроку необходимо заново убивать
    // боссов и копить очки." open() по-прежнему открывается сколько угодно раз (тушёнка —
    // единственное условие входа не изменилось), но теперь СРАЗУ ПОСЛЕ начисления награды
    // текущего уровня очки (ryukzak_points) обнуляются — следующее открытие пойдёт уже с
    // уровня 1 (see max(1, ...) в _levelFromPoints), пока игрок не наберёт новые очки с боссов.
    // ryukzak_points НЕ в whitelist users.php ($allowed) — пишет и читает его только сервер
    // (см. CLAUDE.md, список server-only полей), поэтому обнуление здесь — единственный
    // легитимный путь, клиент не может ни подделать, ни откатить его напрямую.
    Class Ryukzak {
        private $registry, $ops;

        public $permits;

        function __construct($registry){
            $this->registry = $registry;
            $this->ops = new Gameops($registry);
            $this->permits = ['open'];
        }

        private function _catalog(){
            return $this->ops->catalog('ryukzak_config');
        }

        private function _levelFromPoints($points, $thresholds){
            $lvl = 0;
            foreach($thresholds as $i => $t){
                if($points >= intval($t)) $lvl = $i + 1;
                else break;
            }
            return $lvl;
        }

        // 04.10.2026 (баг найден по прямому указанию — "ударил босса мачете, попап «оружие не
        // куплено», хотя оно есть"): open() начислял ammo_machete/ammo_gun/ammo_auto напрямую
        // через Gameops::add() — это ТОЛЬКО легаси-зеркало, не трогает weapons[id].owned в
        // авторитетном JSON-блобе. bosses.php.attack() проверяет именно weapons[weaponId]
        // ['owned'] — если игрок получил ПЕРВЫЕ патроны машете/ствола/автомата через рюкзак (не
        // через weapons.buy()/покер/хабар, которые корректно зовут этот же приём), owned там
        // навсегда оставался false. Клиент (weapons.js._loadFromUdata()) при этом подставляет
        // owned=true локально по фолбэку "ammo>0 → owned" — поэтому в интерфейсе оружие
        // выглядело доступным, а сервер на каждый удар отвечал кодом 89. Портировано 1-в-1 из
        // poker.php._grantWeaponReward() (тот же приём, что уже применён в habar.php).
        private function _grantWeaponReward(&$user, $type, $amount){
            $wid = ['machete' => 3, 'gun' => 4, 'auto' => 5][$type] ?? null;
            $amount = max(0, intval($amount));
            if($wid === null || $amount === 0) return;
            $data = $this->ops->j($user, 'weapons', []);
            if(!is_array($data)) $data = [];
            for($i = 0; $i < 6; $i++){
                $data[$i] = array_merge(
                    ['owned' => $i < 3, 'equipped' => false, 'upg' => 0, 'qty' => 0],
                    isset($data[$i]) && is_array($data[$i]) ? $data[$i] : []
                );
            }
            $ammoKey = 'ammo_' . $type;
            $data[$wid]['qty'] = max(0, intval($data[$wid]['qty']), intval($user[$ammoKey] ?? 0)) + $amount;
            $data[$wid]['owned'] = true;
            ksort($data);
            $user['weapons'] = json_encode(array_values($data));
            $user[$ammoKey] = strval($data[$wid]['qty']);
        }

        function open(){
            $uid = intval($this->registry['uid']);
            $user = $this->ops->loadUser();
            if(!$user){
                error_log('[Ryukzak.open] loadUser() вернул null | uid=' . $uid);
                return $this->ops->fail(99);
            }

            $catalog = $this->_catalog();
            $cost = intval($catalog['open_cost_stew']);
            if(!$this->ops->deduct($user, 'stew', $cost)){
                error_log('[Ryukzak.open] недостаточно тушёнки | uid=' . $uid . ' нужно=' . $cost . ' есть=' . $this->ops->i($user, 'stew'));
                return $this->ops->fail(46); // недостаточно тушёнки
            }

            $points = $this->ops->i($user, 'ryukzak_points', 0);
            // Хотя бы уровень 1 даже при 0 очков — то же поведение, что и у клиента раньше
            // (previewLevel = Math.max(1, level)), просто теперь награда реально начисляется
            // по этому уровню, а не только показывается как превью.
            $level = max(1, $this->_levelFromPoints($points, $catalog['thresholds']));
            $tier = $catalog['tiers'][$level - 1];

            // RNG оружия по весам d=[machete%, gun%, auto%] — та же формула, что раньше
            // считал клиент (ryukzak.js: for i<w { roll=rand(0,100); ... }).
            $mach = 0; $pist = 0; $ak = 0;
            for($i = 0; $i < intval($tier['w']); $i++){
                $roll = mt_rand(0, 9999) / 100.0;
                if($roll < $tier['d'][0]) $mach++;
                else if($roll < $tier['d'][0] + $tier['d'][1]) $pist++;
                else $ak++;
            }

            $this->ops->add($user, 'cigarettes', intval($tier['cig']));
            $this->ops->add($user, 'coins', intval($tier['c']));
            $this->ops->add($user, 'exp', intval($tier['exp']));
            // Ключ рюкзака всегда персональный: tier.key_boss — слот конкретного босса
            // (1=Счастливчик, 2=Ястреб, 3=Меченный, 4=Крыс). Баркут, Борода и Жгут в
            // таблице намеренно отсутствуют. Пишем в bosses_data.keys — то же место, откуда
            // bosses.startFight() реально читает и списывает ключи.
            $keyBoss = intval($tier['key_boss'] ?? -1);
            $keyCount = intval($tier['k'] ?? 0);
            if($keyCount > 0 && $keyBoss >= 1 && $keyBoss <= 4){
                $bossData = $this->ops->j($user, 'bosses_data', []);
                if(!isset($bossData['keys']) || !is_array($bossData['keys'])) $bossData['keys'] = array_fill(0, 8, 0);
                while(count($bossData['keys']) < 8) $bossData['keys'][] = 0;
                $bossData['keys'][$keyBoss] = intval($bossData['keys'][$keyBoss]) + $keyCount;
                $user['bosses_data'] = json_encode($bossData);
            } else {
                $keyBoss = -1; $keyCount = 0;
            }
            if($mach > 0) $this->_grantWeaponReward($user, 'machete', $mach);
            if($pist > 0) $this->_grantWeaponReward($user, 'gun', $pist);
            if($ak   > 0) $this->_grantWeaponReward($user, 'auto', $ak);

            // 25.09.2026 (по прямому указанию — см. большой коммент у класса): обнуляем очки
            // СРАЗУ после розыгрыша награды текущего уровня, в той же записи в БД — атомарно,
            // без отдельного запроса, той же строкой saveUser() ниже.
            $user['ryukzak_points'] = 0;

            if(!$this->ops->saveUser($user)){
                error_log('[Ryukzak.open] saveUser() вернул false после начисления награды | uid=' . $uid . ' level=' . $level);
                return $this->ops->fail(99);
            }

            $patch = $this->ops->patchCurrencies($user, [
                'stew', 'stew_spent', 'cigarettes', 'coins', 'exp', 'bosses_data',
                'ammo_machete', 'ammo_gun', 'ammo_auto', 'ryukzak_points', 'weapons',
            ]);
            $reward = [
                'level' => $level, 'cig' => intval($tier['cig']), 'c' => intval($tier['c']),
                'exp' => intval($tier['exp']), 'k' => $keyCount, 'key_boss' => $keyBoss,
                'mach' => $mach, 'pist' => $pist, 'ak' => $ak,
            ];
            error_log('[Ryukzak.open] выдана награда уровня ' . $level . ' | uid=' . $uid .
                ' pointsBefore=' . $points . ' pointsAfter=0 | reward=' . json_encode($reward, JSON_UNESCAPED_UNICODE));
            $this->ops->ok(['patch' => $patch, 'reward' => $reward]);
        }
    }
?>
