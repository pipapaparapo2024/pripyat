<?php
require_once __DIR__.'/../../server/core/models/telegramauth.php';
require_once __DIR__.'/../../server/core/models/telegramloginstore.php';
function check($condition, $label) { if (!$condition) throw new RuntimeException($label); }
function rejected($fn) { try { $fn(); } catch (Throwable $e) { return; } throw new RuntimeException('Ожидался отказ'); }
$now = 1793530000;
$token = '123456:abcdefghijklmnopqrstuvwxyz_TEST';
$config = ['enabled'=>true,'environment'=>'test','database'=>'stalker_telegram_test','bot_token'=>$token];
function signedData($fields, $token) {
    ksort($fields); $lines=[];
    foreach($fields as $key=>$value) $lines[]=$key.'='.$value;
    $fields['hash']=hash_hmac('sha256',implode("\n",$lines),hash_hmac('sha256',$token,'WebAppData',true));
    return http_build_query($fields, '', '&', PHP_QUERY_RFC3986);
}
$fields=['auth_date'=>(string)$now,'query_id'=>'AA+test/=', 'user'=>json_encode(['id'=>4503599627370494,'first_name'=>'Сергей']), 'signature'=>'signed_extra'];
$raw=signedData($fields,$token);
check(TelegramAuth::verify($raw,$token,$now)['telegram_id']==='4503599627370494','52-битный Telegram ID сохранён точно');
rejected(fn()=>TelegramAuth::verify($raw,'another_bot',$now));
rejected(fn()=>TelegramAuth::verify($raw,$token,$now+601));
rejected(fn()=>TelegramAuth::verify($raw,$token,$now-31));
rejected(fn()=>TelegramAuth::verify($raw.'&auth_date='.$now,$token,$now));
rejected(fn()=>TelegramAuth::verify($raw.'&user%5Bfoo%5D=bar',$token,$now));
rejected(fn()=>TelegramAuth::verify(str_replace('AA%2B','AB%2B',$raw),$token,$now));
rejected(fn()=>TelegramAuth::verify('user=%GG',$token,$now));
rejected(fn()=>TelegramAuth::verify(signedData(['auth_date'=>(string)$now,'user'=>'{bad'],$token),$token,$now));
foreach([0,-1,'123',1.5,4503599627370496] as $id) {
    rejected(fn()=>TelegramAuth::verify(signedData(['auth_date'=>(string)$now,'user'=>json_encode(['id'=>$id])],$token),$token,$now));
}
foreach(['stalker','stalker_ok','stalker_test','stalker_telegram'] as $db) rejected(fn()=>TelegramAuth::validateConfig(array_replace($config,['database'=>$db])));
rejected(fn()=>TelegramAuth::validateConfig(array_replace($config,['environment'=>'prod'])));
rejected(fn()=>TelegramAuth::validateConfig(array_replace($config,['enabled'=>false])));
class MemoryTelegramStore {
    public $players=[], $sessions=[], $fail=false, $begins=0;
    private $before;
    function begin(){ $this->begins++; $this->before=[$this->players,$this->sessions]; }
    function resolvePlayer($id,$now){ if(!isset($this->players[$id])) $this->players[$id]=count($this->players)+1; return $this->players[$id]; }
    function saveSession($uid,$hash,$expires){$this->sessions[$hash]=[$uid,$expires];if($this->fail)throw new RuntimeException('write_failed');}
    function commit(){}
    function rollback(){[$this->players,$this->sessions]=$this->before;}
}
$store=new MemoryTelegramStore;
$a=TelegramAuth::login($raw,$config,$store,$now);
$b=TelegramAuth::login($raw,$config,$store,$now);
check($a['player_id']==='1' && $b['player_id']==='1','Повторный вход сохраняет внутренний ID');
check($a['token']!==$b['token'],'Независимые случайные сессии');
check(isset($store->sessions[hash('sha256',$a['token'])]),'Хранится SHA256 сессии');
check(!isset($store->sessions[$a['token']]),'Исходный токен не хранится');
$store->fail=true; $before=[$store->players,$store->sessions];
$other=signedData(['auth_date'=>(string)$now,'user'=>json_encode(['id'=>111])],$token);
rejected(fn()=>TelegramAuth::login($other,$config,$store,$now));
check([$store->players,$store->sessions]===$before,'Ошибка сессии откатывает создание аккаунта');
$begins=$store->begins;
rejected(fn()=>TelegramAuth::login($raw.'x',$config,$store,$now));
check($store->begins===$begins,'Поддельный вход отклонён до транзакции');
// Execute the real SQL store against a PDO test double; no MySQL connection.
class FakeTelegramPDO extends PDO {
    public $identities=[], $users=[], $sessions=[], $fail=false;
    private $snapshot;
    function __construct() {}
    function beginTransaction(): bool { $this->snapshot=[$this->identities,$this->users,$this->sessions]; return true; }
    function commit(): bool { $this->snapshot=null; return true; }
    function inTransaction(): bool { return $this->snapshot!==null; }
    function rollBack(): bool { [$this->identities,$this->users,$this->sessions]=$this->snapshot; $this->snapshot=null; return true; }
    function prepare(string $query, array $options=[]): PDOStatement|false { return new FakeTelegramStatement($this,$query); }
}
class FakeTelegramStatement extends PDOStatement {
    private $db,$sql,$result=false;
    function __construct($db,$sql){$this->db=$db;$this->sql=$sql;}
    function execute(?array $params=null): bool {
        $p=$params; $db=$this->db;
        if(str_starts_with($this->sql,'SELECT GET_LOCK')||str_starts_with($this->sql,'SELECT RELEASE_LOCK'))$this->result=1;
        elseif(str_starts_with($this->sql,'DELETE FROM telegram_sessions')){
            foreach($db->sessions as $hash=>$session)if($session[0]===$p[0])unset($db->sessions[$hash]);
        } elseif(str_starts_with($this->sql,'INSERT INTO telegram_identities')) {
            if(!isset($db->identities[$p[0]]))$db->identities[$p[0]]=count($db->identities)+1;
        } elseif(str_starts_with($this->sql,'SELECT player_id')) {
            check(str_contains($this->sql,'FOR UPDATE'),'Связь блокируется');
            $this->result=$db->identities[$p[0]];
        } elseif(str_starts_with($this->sql,'SELECT role')) $this->result=false;
        elseif(str_starts_with($this->sql,'SELECT id')) $this->result=$db->users[$p[0]]['id']??false;
        elseif(str_starts_with($this->sql,'INSERT INTO users')) $db->users[$p[0]]=['id'=>$p[0],'coins'=>10,'cigarettes'=>1000];
        elseif(str_starts_with($this->sql,'INSERT INTO telegram_sessions')) {
            if($db->fail)throw new RuntimeException('session_failed');
            $db->sessions[$p[0]]=[$p[1],$p[2]];
        } else throw new RuntimeException('Неожиданный SQL');
        return true;
    }
    function fetchColumn(int $column=0): mixed {return $this->result;}
}
$db=new FakeTelegramPDO;
$sqlStore=new TelegramLoginStore($db);
$first=TelegramAuth::login($raw,$config,$sqlStore,$now);
check($db->users[1]['coins']===10 && $db->users[1]['cigarettes']===1000,'Стартовые ресурсы игрока');
$db->users[1]['coins']=777;
TelegramAuth::login($raw,$config,$sqlStore,$now);
check(count($db->identities)===1 && $db->users[1]['coins']===777,'Реальный store не сбрасывает прогресс');
check(count($db->sessions)===1 && !isset($db->sessions[hash('sha256',$first['token'])]),'Новый вход отзывает прежнюю сессию персонажа');
$db->fail=true;$before=[$db->identities,$db->users,$db->sessions];
rejected(fn()=>TelegramAuth::login($raw,$config,$sqlStore,$now));
check([$db->identities,$db->users,$db->sessions]===$before,'Ошибка нового входа сохраняет прежнюю сессию');
$db->fail=true;$before=[$db->identities,$db->users,$db->sessions];
rejected(fn()=>TelegramAuth::login($other,$config,$sqlStore,$now));
check([$db->identities,$db->users,$db->sessions]===$before,'Реальный store откатывает все три таблицы');
echo "Telegram: подпись, срок, ID, изоляция конфигурации, повторный вход и rollback проверены\n";
