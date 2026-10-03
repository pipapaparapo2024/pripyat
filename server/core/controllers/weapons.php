<?php
    // ── SERVER-AUTHORITATIVE ОРУЖИЕ (18.09.2026, перенос экономики — шаг после Дворa/Зоны/Боссов) ──
    //
    // Раньше ВСЯ покупка/прокачка оружия (weapons.js._buy/_upgrade) считалась на клиенте:
    // проверка цены, списание рублей/тушёнки, выдача оружия/патронов — читер мог вызвать
    // weapons._buy(5, 100) или weapons._upgrade(0) напрямую из консоли браузера БЕЗ единого
    // рубля и получить автомат/максимальную прокачку бесплатно, либо просто присвоить себе
    // udata['coins'] = 999999999 перед вызовом. Теперь клиент только просит сервер купить/
    // прокачать конкретное оружие (weapon_id) — сервер сам проверяет цену по каталогу
    // json/weapons_config.json (сверен построчно с исходными данными weapons.js), сам решает,
    // хватает ли рублей/тушёнки, и сам пишет итоговое поле 'weapons' (тот же JSON-формат,
    // что клиент использовал всегда — [{owned,equipped,upg,qty}, ×6], порядок нож/цепь/бита/
    // мачете/ствол/автомат) — клиент просто применяет патч в ответе, как везде.
    //
    // Экипировка (equip) НЕ перенесена — она ничего не тратит и не выдаёт, это чистое
    // предпочтение "каким оружием бить", не требует защиты от читов (то же решение, что было
    // принято для Скиллов/расчёта урона в бою — урон по-прежнему считает клиент, это отдельный,
    // намного больший фронт переноса).
    Class Weapons {
        private $registry, $ops;

        public $permits;

        function __construct($registry){
            $this->registry = $registry;
            $this->ops = new Gameops($registry);
            $this->permits = ['buy', 'upgrade'];
        }

        private function _catalog(){
            return $this->ops->catalog('weapons_config');
        }

        // Тот же формат и тот же порядок, что weapons.js._saveToUdata()/_loadFromUdata():
        // [{owned,equipped,upg,qty}, ×6] — 0=нож,1=цепь,2=бита,3=мачете,4=ствол,5=автомат.
        // Бесплатное оружие (0-2) всегда owned=true, как и на клиенте.
        private function _loadWeapons($user){
            $raw = $this->ops->j($user, 'weapons', []);
            $data = is_array($raw) ? $raw : [];
            for($i = 0; $i < 6; $i++){
                if(!isset($data[$i]) || !is_array($data[$i])){
                    $data[$i] = ['owned' => false, 'equipped' => false, 'upg' => 0, 'qty' => 0];
                }
                if(!isset($data[$i]['owned']))    $data[$i]['owned']    = false;
                if(!isset($data[$i]['equipped'])) $data[$i]['equipped'] = false;
                if(!isset($data[$i]['upg']))      $data[$i]['upg']      = 0;
                if(!isset($data[$i]['qty']))      $data[$i]['qty']      = 0;
            }
            for($i = 0; $i < 3; $i++) $data[$i]['owned'] = true;
            ksort($data);
            return array_values($data);
        }

        // Покупка донатного оружия (только id 3-5 — мачете/ствол/автомат). mult — множитель
        // из бирки X1/X10/X100 на клиенте (birka.on('pointerdown', cycleMult) в weapons.js).
        function buy(){
            $wid  = intval($this->registry['user_params']['weapon_id'] ?? -1);
            $mult = intval($this->registry['user_params']['mult'] ?? 1);
            if($wid < 0 || $wid > 5) return $this->ops->fail(73); // некорректный id оружия
            if(!in_array($mult, [1, 10, 100], true)) return $this->ops->fail(73); // некорректный множитель

            $catalog = $this->_catalog();
            $cfg = $catalog['weapons'][$wid];
            if(!$cfg['donate']) return $this->ops->fail(73); // бесплатное оружие не покупается за рубли

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $totalCost = intval($cfg['cost']) * $mult;
            if(!$this->ops->deduct($user, 'coins', $totalCost)) return $this->ops->fail(74); // недостаточно рублей

            $weapons = $this->_loadWeapons($user);
            $weapons[$wid]['owned'] = true;
            $weapons[$wid]['qty']   = intval($weapons[$wid]['qty']) + $mult;

            // Если у игрока вообще ничего не экипировано — экипируем только что купленное
            // (та же логика, что weapons.js._buy(): "if(!this.data.some(w=>w.equipped))").
            $hasEquipped = false;
            foreach($weapons as $w){ if(!empty($w['equipped'])){ $hasEquipped = true; break; } }
            if(!$hasEquipped) $weapons[$wid]['equipped'] = true;

            $this->ops->add($user, 'coins_spent', $totalCost);
            $user['weapons'] = json_encode($weapons);

            // Легаси-поля патронов — клиент их тоже читает как fallback (weapons.js._loadFromUdata).
            $ammoKeys = [3 => 'ammo_machete', 4 => 'ammo_gun', 5 => 'ammo_auto'];
            $patchKeys = ['coins', 'coins_spent', 'weapons'];
            if(isset($ammoKeys[$wid])){
                $ammoKey = $ammoKeys[$wid];
                $user[$ammoKey] = strval($weapons[$wid]['qty']);
                $patchKeys[] = $ammoKey;
            }

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            $patch = $this->ops->patchCurrencies($user, $patchKeys);
            $this->ops->ok(['patch' => $patch, 'qty' => $weapons[$wid]['qty']]);
        }

        // Прокачка (любое из 6 оружий, включая бесплатное — по ТЗ апгрейд доступен всем).
        // upg_cost[текущий_уровень]: положительное число = рубли, отрицательное = тушёнка
        // (тот же формат, что общий массив _uc в weapons.js).
        function upgrade(){
            $wid = intval($this->registry['user_params']['weapon_id'] ?? -1);
            if($wid < 0 || $wid > 5) return $this->ops->fail(73);

            $catalog = $this->_catalog();
            $maxUpg  = intval($catalog['max_upg']);
            $upgCost = $catalog['upg_cost'];

            $user = $this->ops->loadUser();
            if(!$user) return $this->ops->fail(99);

            $weapons = $this->_loadWeapons($user);
            $curUpg = intval($weapons[$wid]['upg']);
            if($curUpg >= $maxUpg) return $this->ops->fail(75); // уже максимальный уровень прокачки

            $rawCost = intval($upgCost[$curUpg]);
            $useStew = $rawCost < 0;
            $cost    = abs($rawCost);
            $resKey  = $useStew ? 'stew' : 'coins';

            if(!$this->ops->deduct($user, $resKey, $cost)) return $this->ops->fail(74); // недостаточно рублей/тушёнки

            $weapons[$wid]['upg'] = $curUpg + 1;
            $user['weapons'] = json_encode($weapons);

            if(!$this->ops->saveUser($user)) return $this->ops->fail(99);

            $patchKeys = [$resKey, 'weapons'];
            if($useStew) $patchKeys[] = 'stew_spent'; // deduct() сам ведёт stew_spent для тушёнки
            $patch = $this->ops->patchCurrencies($user, $patchKeys);
            $this->ops->ok(['patch' => $patch, 'newUpg' => $weapons[$wid]['upg']]);
        }
    }
?>
