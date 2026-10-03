<?php
Class Hapuga {
    private $registry, $ops;

    public $permits;

    function __construct($registry){
        $this->registry = $registry;
        $this->ops = new Gameops($registry);
        $this->permits = ['buy'];
    }

    // 21.09.2026 (по прямому указанию) — Хапуга/Скряга ещё не готова к бета-тесту (клиентская
    // иконка уже приглушена и некликабельна, см. disabled:true в interface-panels.js), но это
    // не мешает вызвать hapuga.buy напрямую из консоли браузера в обход UI. Блокируем и здесь —
    // единственное надёжное место: сервер отклоняет ЛЮБОЙ вызов независимо от того, что и как
    // прислал клиент. Убрать одной строкой, когда раздел будет готов к запуску.
    private $BETA_LOCKED = true;

    function buy(){
        if($this->BETA_LOCKED) return $this->ops->fail(56);
        $idx = intval($this->registry['user_params']['item_idx'] ?? -1);
        if($idx < 0 || $idx > 7) return $this->ops->fail(54);

        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);

        $names = $this->ops->j($user, 'hapuga_items', []);
        $sold  = $this->ops->j($user, 'hapuga_sold', []);
        if(isset($sold[strval($idx)]) || isset($sold[$idx])) return $this->ops->fail(52);
        if(!isset($names[$idx]) || !$names[$idx]) return $this->ops->fail(51);

        $pool = $this->ops->catalog('hapuga_pool');
        $it = null;
        foreach($pool as $p){ if($p['name'] === $names[$idx]){ $it = $p; break; } }
        if(!$it) return $this->ops->fail(51);

        $sale = intval(floor($it['orig'] * (1 - $it['disc'] / 100)));
        if(!$this->ops->deduct($user, 'coins', $sale)) return $this->ops->fail(50);
        // 27.09.2026 (аудит по прямому указанию — гонка whitelist coins_spent/stew_spent):
        // deduct() сам ведёт stew_spent для тушёнки, но НЕ coins_spent для монет (см. тот же
        // комментарий в shmot.php) — считаем эту статистику здесь вручную, тот же приём, что
        // уже применён в base.php.upgrade()/vassilich.php.buy().
        $user['coins_spent'] = $this->ops->i($user, 'coins_spent') + $sale;

        switch($it['type']){
            case 'coins': $this->ops->add($user, 'coins', $it['amount']); break;
            case 'stew': $this->ops->add($user, 'stew', $it['amount']); break;
            case 'cig': $this->ops->add($user, 'cigarettes', $it['amount']); break;
            case 'energy': $this->ops->add($user, 'energy', $it['amount']); break;
            case 'heal': $user['health'] = min(100, $this->ops->i($user,'health',100) + intval($it['amount'])); break;
            case 'max_energy':
                $user['max_energy'] = $this->ops->i($user,'max_energy',50) + intval($it['amount']);
                break;
            case 'habar':
                $counts = $this->ops->j($user, 'habar_counts', [0,0,0,0]);
                while(count($counts) < 4) $counts[] = 0;
                $cidx = intval($it['amount']) === 2 ? 2 : 1;
                $counts[$cidx] = intval($counts[$cidx]) + 1;
                $user['habar_counts'] = json_encode($counts);
                break;
        }

        $sold[strval($idx)] = true;
        $user['hapuga_sold'] = json_encode($sold);

        if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
        $this->ops->ok(['patch' => $this->ops->patchCurrencies($user)]);
    }
}
?>
