<?php
Class Bp {
    private $registry, $ops;

    public $permits;

    function __construct($registry){
        $this->registry = $registry;
        $this->ops = new Gameops($registry);
        $this->permits = ['claim'];
    }

    // 21.09.2026 (по прямому указанию) — Пропуск (боевой пропуск) ещё не готов к бета-тесту.
    // UI-кнопка отдельно приглушена на клиенте (disabled:true, interface-panels.js), но это не
    // мешает вызвать bp.claim напрямую из консоли — блокируем здесь, сервер отклоняет ЛЮБОЙ
    // вызов. Убрать одной строкой, когда раздел будет готов к запуску.
    private $BETA_LOCKED = true;

    function claim(){
        if($this->BETA_LOCKED) return $this->ops->fail(56);
        $lv = intval($this->registry['user_params']['level'] ?? 0);
        if($lv < 1 || $lv > 500) return $this->ops->fail(54);

        $user = $this->ops->loadUser();
        if(!$user) return $this->ops->fail(99);

        $bpLevel = $this->ops->i($user, 'bp_level', 1);
        if($lv > $bpLevel) return $this->ops->fail(53);

        $claimed = $this->ops->j($user, 'bp_claimed', []);
        if(!empty($claimed[strval($lv)]) || !empty($claimed[$lv])) return $this->ops->fail(52);

        $cycle = [
            ['type'=>'coins','amount'=>200],
            ['type'=>'stew','amount'=>5],
            ['type'=>'energy','amount'=>20],
            ['type'=>'cig','amount'=>2],
            ['type'=>'coins','amount'=>500],
            ['type'=>'stew','amount'=>15],
            ['type'=>'energy','amount'=>50],
            ['type'=>'cig','amount'=>5],
            ['type'=>'coins','amount'=>1000],
            ['type'=>'coins','amount'=>2000],
        ];
        $base = $cycle[($lv - 1) % 10];
        $mult = 1 + floor(($lv - 1) / 10) * 0.5;
        $amount = intval(floor($base['amount'] * $mult));
        $type = $base['type'] === 'cig' ? 'cigarettes' : $base['type'];
        $this->ops->add($user, $type, $amount);

        $claimed[strval($lv)] = true;
        $user['bp_claimed'] = json_encode($claimed);

        if(!$this->ops->saveUser($user)) return $this->ops->fail(99);
        $this->ops->ok(['patch' => $this->ops->patchCurrencies($user), 'level' => $lv, 'reward' => ['type'=>$type,'amount'=>$amount]]);
    }
}
?>
