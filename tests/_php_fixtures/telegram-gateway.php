<?php
require_once __DIR__.'/../../server/core/models/telegramgateway.php';
function checkTg($v){if(!$v)throw new RuntimeException('Проверка Telegram gateway не пройдена');}
foreach(['security.getToken','users.resetAllPlayers','users.setFriendsCache','users.setFriendsScopeGranted','event.activate','event.save','users.get.extra','../users.get','users._private'] as $m) checkTg(!TelegramGateway::allowed($m));
foreach(['users.resetSession','users.devGrantCurrency','users.setDevFlag','users.toggleDevKeyring'] as $m)checkTg(TelegramGateway::allowed($m)&&TelegramGateway::requiresDeveloper($m));
foreach(['users.get','users.save','users.getProfile','zone.fillCheckpoint','achievements.sync','event.get','bosses.attack'] as $m)checkTg(TelegramGateway::allowed($m));
class GatewayPDO extends PDO {
    public $session, $race=false;
    function __construct(){}
    function prepare(string $query,array $options=[]):PDOStatement|false{return new GatewayStatement($this,$query);}
}
class GatewayStatement extends PDOStatement {
    private $db,$sql,$count=0;
    function __construct($db,$sql){$this->db=$db;$this->sql=$sql;}
    function execute(?array $params=null):bool{
        if(str_starts_with($this->sql,'SELECT player_id'))checkTg($params[0]===hash('sha256',str_repeat('a',64)));
        elseif(str_starts_with($this->sql,'UPDATE telegram_sessions')){
            checkTg(str_contains($this->sql,'AND request_key=? AND expires_at>?'));
            if(!$this->db->race && $this->db->session['request_key']===$params[2]){$this->db->session['request_key']=$params[0];$this->count=1;}
        }
        return true;
    }
    function fetch(int $mode=PDO::FETCH_DEFAULT,int $cursorOrientation=PDO::FETCH_ORI_NEXT,int $cursorOffset=0):mixed{return $this->db->session;}
    function rowCount():int{return $this->count;}
}
$db=new GatewayPDO;$db->session=['player_id'=>42,'expires_at'=>2000,'request_key'=>str_repeat('b',32)];
checkTg(TelegramGateway::authenticate($db,'invalid','x',1000)['code']===5);
checkTg(TelegramGateway::authenticate($db,str_repeat('a',64),str_repeat('c',32),1000)['code']===4);
$auth=TelegramGateway::authenticate($db,str_repeat('a',64),str_repeat('b',32),1000);
checkTg($auth['uid']===42 && $auth['req_key']!==str_repeat('b',32));
checkTg(TelegramGateway::authenticate($db,str_repeat('a',64),str_repeat('b',32),1000)['code']===4);
checkTg(TelegramGateway::authenticate($db,str_repeat('a',64),$auth['req_key'],2000)['code']===3);
$db->race=true;
checkTg(TelegramGateway::authenticate($db,str_repeat('a',64),$auth['req_key'],1000)['code']===4);
$save=TelegramGateway::parameters('users.save',['udata_json'=>json_encode(['id'=>999,'friends'=>'999','friends_since'=>['999'=>1],'friends_scope_granted'=>1,'nick'=>'Сталкер','snd_vol'=>'0.2'])],42,$db);
$data=json_decode($save['udata_json'],true);
checkTg(!isset($data['id'],$data['friends'],$data['friends_since'],$data['friends_scope_granted']) && $data['nick']==='Сталкер' && $data['snd_vol']==='0.2');
echo "Telegram gateway: привязка к сессии, запреты методов, expiry, CAS/replay/race, защита дружбы проверены\n";
