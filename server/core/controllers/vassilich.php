<?php
Class Vassilich {
    private $registry, $ops;

    public $permits;

    function __construct($registry){
        $this->registry = $registry;
        $this->ops = new Gameops($registry);
        $this->permits = ['buy', 'open_loot'];
    }

    function buy(){
        $params = $this->registry['user_params'];
        $item_id = intval($params['item_id'] ?? -1);
        $shop = $this->ops->catalog('vassilich_shop');
        $item = null;
        foreach($shop as $it){ if(intval($it['id']) === $item_id){ $item = $it; break; } }
        if(!$item) return $this->ops->fail(51);

        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);

        $type = $item['price']['type'];
        $amount = intval($item['price']['amount']);
        if(!$this->ops->deduct($user, $type, $amount)) return $this->ops->fail(50);
        // 27.09.2026 (регрессия найдена полным прогоном тестов, tests/achievements-v2-and-
        // battlepass-off.test.js): раньше coins_spent (ачивка spend_coins) считал КЛИЕНТ
        // локально в vassilich.js._buy(), рядом со старым локальным списанием валюты. При
        // переводе _buy() на честный запрос-ответ (см. vassilich.js) локальный подсчёт убран
        // вместе со списанием — сервер её никогда не вёл, из-за чего покупки у Василича
        // перестали бы двигать эту ачивку вовсе. stew_spent — НЕ дублируем отдельной строкой:
        // Gameops::deduct() уже сам инкрементит её при $currency==='stew' (см. gameops.php).
        if($type === 'coins') $user['coins_spent'] = $this->ops->i($user, 'coins_spent') + $amount;

        $user['vassilich_buys'] = $this->ops->i($user, 'vassilich_buys') + 1;
        $this->_applyEffect($user, $item['effect'] ?? []);

        if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
        $this->ops->ok(['patch' => $this->ops->patchCurrencies($user), 'item_id' => $item_id]);
    }

    function open_loot(){
        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);
        if(!$this->ops->deduct($user, 'cigarettes', 5)) return $this->ops->fail(50);

        $loot = $this->ops->catalog('vassilich_loot');
        $pool = [];
        foreach($loot as $it){
            $w = intval($it['weight'] ?? 1);
            for($i=0;$i<$w;$i++) $pool[] = $it;
        }
        $pick = $pool[array_rand($pool)];
        $this->_applyEffect($user, $pick['effect'] ?? []);

        if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
        $this->ops->ok(['patch' => $this->ops->patchCurrencies($user), 'loot' => ['name'=>$pick['name'], 'rarity'=>intval($pick['rarity']??0)]]);
    }

    private function _applyEffect(&$user, $effect){
        if(isset($effect['stew'])) $this->ops->add($user, 'stew', $effect['stew']);
        if(isset($effect['coins'])) $this->ops->add($user, 'coins', $effect['coins']);
        if(isset($effect['cigarettes'])) $this->ops->add($user, 'cigarettes', $effect['cigarettes']);
        if(isset($effect['energy'])) $this->ops->add($user, 'energy', $effect['energy']);
        if(isset($effect['boss_keys'])) $this->ops->add($user, 'boss_keys', $effect['boss_keys']);
        if(isset($effect['max_energy'])){
            $user['max_energy'] = max(50, $this->ops->i($user, 'max_energy', 50) + intval($effect['max_energy']));
        }
        if(isset($effect['bp_levels'])){
            $lv = $this->ops->i($user, 'bp_level', 1) + intval($effect['bp_levels']);
            $user['bp_level'] = min(500, $lv);
        }
    }
}
?>
