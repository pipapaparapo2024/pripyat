<?php
require __DIR__.'/../../server/core/models/gameops.php';
require __DIR__.'/../../server/core/controllers/zaruba.php';
require __DIR__.'/../../server/core/controllers/bosses.php';

function check($condition, $message){
    if(!$condition) throw new RuntimeException($message);
}

class FakeResult {
    function __construct(private array $rows){}
    function fetch_all($mode){return $this->rows;}
    function fetch_assoc(){return $this->rows[0] ?? null;}
}

const MYSQLI_ASSOC = 1;
class mysqli {
    public $connect_error = false;
    static $players = [];
    static $badges = [];
    static $failWrite = false;
    private $before;

    function set_charset($name){}
    function close(){}
    function begin_transaction(){$this->before = [self::$players, self::$badges];}
    function rollback(){[self::$players, self::$badges] = $this->before;}
    function commit(){return true;}
    function execute_query($sql, $args){
        if(str_starts_with($sql, 'SELECT id,')){
            check(str_contains($sql,'FOR UPDATE'), 'Обе строки должны быть заблокированы');
            return new FakeResult(array_values(array_intersect_key(self::$players, array_flip($args))));
        }
        if(str_starts_with($sql, 'SELECT bosses_data')){
            check(str_contains($sql,'FOR UPDATE'), 'Подтверждение должно быть заблокировано');
            return new FakeResult([self::$players[$args[0]]]);
        }
        if(str_starts_with($sql, 'UPDATE users SET str_xp_total')){
            self::$players[$args[1]]['str_xp_total'] = $args[0];
        } elseif(str_starts_with($sql, 'UPDATE users SET gym_pump_cooldowns')){
            if(self::$failWrite) return false;
            self::$players[$args[2]]['gym_pump_cooldowns'] = $args[0];
            self::$players[$args[2]]['gym_invites_sent'] = $args[1];
        } elseif(str_starts_with($sql, 'INSERT INTO boss_last_kill')){
            self::$badges[$args[0]] = $args[1];
        } elseif(str_starts_with($sql, 'UPDATE users SET bosses_data')){
            if(self::$failWrite) return false;
            self::$players[$args[1]]['bosses_data'] = $args[0];
        } else {
            throw new LogicException($sql);
        }
        return true;
    }
}

class RaznaryadkaProgress {
    static function report(...$args){}
}

$tools = new class {
    public $code;
    public $response;
    function error($code){$this->code=$code;}
    function output($response){$this->response=$response;}
};
$registry = ['uid'=>1,'utb'=>'users','server'=>'fake','user'=>'fake','pass'=>'','db'=>'fake','tools'=>$tools,
    'user_params'=>['target_id'=>2,'boss_id'=>3]];
mysqli::$players = [
    1=>['id'=>1,'str_xp_total'=>30,'gym_pump_cooldowns'=>'{}','gym_invites_sent'=>5,'bosses_data'=>'{}'],
    2=>['id'=>2,'str_xp_total'=>45,'gym_pump_cooldowns'=>'{}','gym_invites_sent'=>0],
];

$gym = new Zaruba($registry);
$gym->pump();
check(mysqli::$players[2]['str_xp_total']===46 && mysqli::$players[1]['str_xp_total']===30, 'Сила прибавляется только цели');
check(mysqli::$players[1]['gym_invites_sent']===6, 'Засчитано одно приглашение');
$gym->pump();
check($tools->code===92 && mysqli::$players[2]['str_xp_total']===46, 'Повтор заблокирован');
mysqli::$players[1]['gym_pump_cooldowns']='{}';
mysqli::$failWrite=true;
$gym->pump();
check($tools->code===99 && mysqli::$players[2]['str_xp_total']===46, 'При сбое записи кулдауна прибавка откатывается');

$bosses = new Bosses($registry);
$bosses->recordKill();
check($tools->code===52 && mysqli::$badges===[], 'Неподтверждённая победа не меняет публичную отметку');
mysqli::$players[1]['bosses_data']='{"pendingKillBadge":{"3":true}}';
$bosses->recordKill();
check($tools->code===99 && mysqli::$badges===[], 'Отметка откатывается при сбое погашения подтверждения');
mysqli::$failWrite=false;
$bosses->recordKill();
check(mysqli::$badges===[3=>1], 'Подтверждённая победа обновляет отметку при закрытии окна');
mysqli::$badges[3]=2;
$bosses->recordKill();
check($tools->code===52 && mysqli::$badges[3]===2, 'Повторное закрытие не заменяет нового победителя');
echo "Проверены откаты и повторные запросы.\n";
