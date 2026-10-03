<?php
Class Gangs {
    private $registry, $ops;

    public $permits;

    function __construct($registry){
        $this->registry = $registry;
        $this->ops = new Gameops($registry);
        $this->permits = ['join', 'donate'];
    }

    // 21.09.2026 (по прямому указанию) — Банда ещё не готова к бета-тесту. UI-кнопка (нижняя
    // панель) отдельно приглушается на клиенте, но это не мешает вызвать gangs.join/donate
    // напрямую из консоли — блокируем здесь, сервер отклоняет ЛЮБОЙ вызов. Убрать одной строкой,
    // когда раздел будет готов к запуску.
    private $BETA_LOCKED = true;

    function join(){
        if($this->BETA_LOCKED) return $this->ops->fail(56);
        $gid = intval($this->registry['user_params']['gang_id'] ?? -1);
        if($gid < 0 || $gid > 5) return $this->ops->fail(54);

        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);

        $cur = $user['gang_id'] ?? '';
        if($cur !== '' && $cur !== null) return $this->ops->fail(52);

        $user['gang_id'] = strval($gid);
        $gdata = $this->ops->j($user, 'gang_data', []);
        while(count($gdata) < 6) $gdata[] = ['level'=>1,'xp'=>0,'xp_next'=>500,'members'=>0];
        $gdata[$gid]['members'] = intval($gdata[$gid]['members'] ?? 0) + 1;
        $user['gang_data'] = json_encode($gdata);

        if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
        $this->ops->ok(['patch' => $this->ops->patchCurrencies($user)]);
    }

    function donate(){
        if($this->BETA_LOCKED) return $this->ops->fail(56);
        $idx = intval($this->registry['user_params']['gang_id'] ?? -1);
        if($idx < 0 || $idx > 5) return $this->ops->fail(54);

        $costs = [
            ['stew'=>10,'coins'=>0,'xp'=>20],
            ['stew'=>0,'coins'=>300,'xp'=>30],
            ['stew'=>0,'coins'=>250,'xp'=>25],
            ['stew'=>15,'coins'=>200,'xp'=>35],
            ['stew'=>5,'coins'=>150,'xp'=>22],
            ['stew'=>0,'coins'=>500,'xp'=>50],
        ];

        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);
        if(strval($user['gang_id'] ?? '') !== strval($idx)) return $this->ops->fail(53);

        $c = $costs[$idx];
        if($c['stew'] && !$this->ops->deduct($user, 'stew', $c['stew'])) return $this->ops->fail(50);
        if($c['coins'] && !$this->ops->deduct($user, 'coins', $c['coins'])) return $this->ops->fail(50);
        // 27.09.2026 (аудит по прямому указанию — гонка whitelist coins_spent/stew_spent):
        // deduct() сам ведёт stew_spent для тушёнки (currency === 'stew'), но НЕ coins_spent для
        // монет — считаем её здесь вручную, тот же приём, что уже применён в
        // base.php.upgrade()/vassilich.php.buy()/hapuga.php.buy().
        if($c['coins']) $user['coins_spent'] = $this->ops->i($user, 'coins_spent') + $c['coins'];

        $gdata = $this->ops->j($user, 'gang_data', []);
        while(count($gdata) < 6) $gdata[] = ['level'=>1,'xp'=>0,'xp_next'=>500,'members'=>0];
        $g = $gdata[$idx];
        $g['xp'] = intval($g['xp'] ?? 0) + $c['xp'];
        $xp_next = intval($g['xp_next'] ?? 500);
        $level = intval($g['level'] ?? 1);
        if($g['xp'] >= $xp_next && $level < 10){
            $g['xp'] -= $xp_next;
            $g['level'] = $level + 1;
            $g['xp_next'] = intval(floor($xp_next * 1.6));
        }
        $gdata[$idx] = $g;
        $user['gang_data'] = json_encode($gdata);

        if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
        $this->ops->ok(['patch' => $this->ops->patchCurrencies($user)]);
    }
}
?>
